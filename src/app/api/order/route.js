import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { ORDER_LIMITS } from '@/lib/order-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Thrown inside the locked transaction below so the outer catch can turn a rejected
// limit check into the right HTTP status instead of the generic 500 fallback.
class OrderRejected extends Error {
  constructor(code, message, status, extra) {
    super(message);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

export async function POST(request) {
  // Hoisted so the outer catch can recover a raced duplicate requestId (see P2002 handling below).
  let transactionId, requestId;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pesanan tidak valid.' }, { status: 400 });
    ({ transactionId, requestId } = body);
    const { items, isTakeaway = false } = body;
    if (typeof transactionId !== 'string' || !transactionId.trim() || transactionId.length > 200 ||
        typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{16,80}$/.test(requestId) ||
        !Array.isArray(items) || !items.length || items.length > ORDER_LIMITS.perSubmission ||
        typeof isTakeaway !== 'boolean' || items.some(item => !item ||
          !Number.isSafeInteger(item.menuItemId) || item.menuItemId <= 0 ||
          !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
      return NextResponse.json({ error: 'Pesanan tidak valid. Muat ulang halaman dan periksa jumlah pesanan.' }, { status: 400 });
    }

    // Aggregate repeated menu IDs so splitting rows cannot bypass quantity limits.
    const quantities = new Map();
    for (const item of items) quantities.set(item.menuItemId, (quantities.get(item.menuItemId) || 0) + item.quantity);
    const normalized = [...quantities].sort(([a], [b]) => a - b).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
    const quantity = normalized.reduce((sum, item) => sum + item.quantity, 0);
    if (normalized.some(item => item.quantity > ORDER_LIMITS.perMenu) || quantity > ORDER_LIMITS.perSubmission) {
      return NextResponse.json({ code: 'ORDER_LIMIT', error: 'Maksimal 10 porsi per menu dan 30 porsi per kiriman. Untuk pesanan lebih besar, hubungi kasir.' }, { status: 400 });
    }

    const payloadHash = createHash('sha256').update(JSON.stringify({ items: normalized, isTakeaway })).digest('hex');

    // 1. Fast idempotency check (Read-only, completely outside locks)
    const previous = await prisma.orderSubmission.findUnique({ where: { transactionId_requestId: { transactionId, requestId } } });
    if (previous) {
      if (previous.payloadHash !== payloadHash) {
        return NextResponse.json({ code: 'REQUEST_CONFLICT', error: 'Isi pengiriman berbeda. Periksa pesanan sebelumnya atau hubungi kasir.' }, { status: 409 });
      }
      return NextResponse.json(previous.response);
    }

    // 2. Parallel pre-flight read queries (Fast, no connection locks held).
    // Rate-limit / session-limit counts are NOT read here: reading them outside a lock let
    // concurrent submissions all pass the check before any of them wrote (proven by repeated
    // load testing on 2026-09-22 — both limits could be bypassed by simultaneous requests).
    // They are re-read and enforced inside the locked transaction below instead.
    const [session, menuItems] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.menuItem.findMany({ where: { id: { in: normalized.map(item => item.menuItemId) } }, select: { id: true, price: true, isAvailable: true } }),
    ]);

    if (!session || !['open', 'ordered'].includes(session.status) || session.completedAt) {
      return NextResponse.json({ code: 'SESSION_CLOSED', error: 'Sesi meja sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir.' }, { status: 409 });
    }

    const menuById = new Map(menuItems.map(item => [item.id, item]));
    if (normalized.some(item => !menuById.get(item.menuItemId)?.isAvailable)) {
      return NextResponse.json({ code: 'MENU_UNAVAILABLE', error: 'Ada menu yang sudah habis atau tidak tersedia. Muat ulang menu sebelum memesan kembali.' }, { status: 409 });
    }

    const data = normalized.map(item => ({ ...item, price: menuById.get(item.menuItemId).price }));
    const total = data.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (data.some(item => !Number.isSafeInteger(item.price) || item.price < 0) || !Number.isSafeInteger(total) || total + session.total > 2147483647) {
      return NextResponse.json({ code: 'INVALID_TOTAL', error: 'Total pesanan tidak valid. Silakan hubungi kasir.' }, { status: 400 });
    }

    // 3. Lean & lightning-fast write transaction (< 50ms, minimal pooler stress)
    const result = await prisma.$transaction(async tx => {
      // Serialize every submission for this table/session so the checks below can't be
      // raced by concurrent requests (repeated QR scans, double-tab retries, etc). This also
      // fixes the duplicate-requestId race: a losing request now waits here instead of hitting
      // a raw unique-constraint error, then finds the winner's row via doubleCheck below.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'order-session:' + transactionId}))`;

      // Re-check idempotency under lock in case of simultaneous duplicate submits
      const doubleCheck = await tx.orderSubmission.findUnique({ where: { transactionId_requestId: { transactionId, requestId } } });
      if (doubleCheck) return doubleCheck.response;

      // Row-lock the transaction (a real Postgres row lock via UPDATE, not just the advisory
      // lock above) and re-read its status. The advisory lock only serializes this route against
      // itself — it does nothing against PUT /api/transaction/[id] (payment/cancel), which takes
      // its own row lock the same way before closing the session. Without this, a request that
      // passed the pre-flight status check above (line ~67) but is written here *after* a
      // concurrent payment completes would still create the order and force status back to
      // 'ordered' via the unconditional update below, silently reopening a paid transaction.
      await tx.transaction.updateMany({ where: { id: transactionId }, data: { total: { increment: 0 } } });
      const current = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!current || !['open', 'ordered'].includes(current.status) || current.completedAt) {
        throw new OrderRejected('SESSION_CLOSED', 'Sesi meja sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir.', 409);
      }
      if (total + current.total > 2147483647) {
        throw new OrderRejected('INVALID_TOTAL', 'Total pesanan tidak valid. Silakan hubungi kasir.', 400);
      }

      const now = Date.now();
      const recentSubmissions = await tx.orderSubmission.findMany({
        where: { transactionId, createdAt: { gte: new Date(now - 60000) } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true }
      });
      if (recentSubmissions.length >= ORDER_LIMITS.perMinute) {
        const retryAfterMs = Math.max(0, recentSubmissions[0].createdAt.getTime() + 60000 - now);
        throw new OrderRejected('RATE_LIMIT', 'Terlalu banyak pengiriman. Coba lagi setelah beberapa saat.', 429, { retryAfterMs });
      }

      const [currentItemAgg, submittedAgg] = await Promise.all([
        tx.orderItem.aggregate({ where: { order: { transactionId } }, _sum: { quantity: true } }),
        tx.orderSubmission.aggregate({ where: { transactionId }, _sum: { quantity: true } }),
      ]);
      if (Math.max(currentItemAgg._sum.quantity || 0, submittedAgg._sum.quantity || 0) + quantity > ORDER_LIMITS.perSession) {
        throw new OrderRejected('SESSION_LIMIT', `Pesanan sudah melewati ${ORDER_LIMITS.perSession} porsi. Panggil karyawan jika ingin menambah pesanan.`, 409);
      }

      const order = await tx.order.create({
        data: { transactionId, total, isTakeaway, kitchenStatus: 'queued', items: { create: data } }
      });
      await tx.transaction.update({
        where: { id: transactionId },
        data: { total: { increment: total }, status: 'ordered', revision: { increment: 1 } }
      });
      const response = JSON.parse(JSON.stringify(order));
      await tx.orderSubmission.create({
        data: { transactionId, requestId, payloadHash, quantity, response }
      });
      return response;
    }, {
      timeout: 15000,
      maxWait: 5000
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OrderRejected) {
      return NextResponse.json({ code: error.code, error: error.message, ...error.extra }, { status: error.status });
    }
    // Defensive: even with the advisory lock above, if two submissions with the same requestId
    // still raced (e.g. lock unavailable), the loser gets a unique-constraint error here.
    // Recover the winner's saved response instead of reporting a false failure to the client.
    if (error?.code === 'P2002' && transactionId && requestId) {
      const existing = await prisma.orderSubmission.findUnique({ where: { transactionId_requestId: { transactionId, requestId } } }).catch(() => null);
      if (existing) return NextResponse.json(existing.response);
    }
    console.error('Order route error:', error);
    return NextResponse.json({
      error: 'Status pengiriman belum dapat dipastikan. Coba kembali dengan pengiriman yang sama. (' + (error?.message || 'Server timeout') + ')'
    }, { status: 500 });
  }
}
