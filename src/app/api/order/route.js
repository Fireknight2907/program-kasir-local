import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { ORDER_LIMITS } from '@/lib/order-limits';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pesanan tidak valid.' }, { status: 400 });
    const { transactionId, requestId, items, isTakeaway = false } = body;
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

    // 2. Parallel pre-flight read queries (Fast, no connection locks held)
    const [session, recentSubmissionsCount, currentItemAgg, submittedAgg, menuItems] = await Promise.all([
      prisma.transaction.findUnique({ where: { id: transactionId } }),
      prisma.orderSubmission.count({ where: { transactionId, createdAt: { gte: new Date(Date.now() - 60000) } } }),
      prisma.orderItem.aggregate({ where: { order: { transactionId } }, _sum: { quantity: true } }),
      prisma.orderSubmission.aggregate({ where: { transactionId }, _sum: { quantity: true } }),
      prisma.menuItem.findMany({ where: { id: { in: normalized.map(item => item.menuItemId) } }, select: { id: true, price: true, isAvailable: true } }),
    ]);

    if (!session || !['open', 'ordered'].includes(session.status) || session.completedAt) {
      return NextResponse.json({ code: 'SESSION_CLOSED', error: 'Sesi meja sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir.' }, { status: 409 });
    }

    if (recentSubmissionsCount >= ORDER_LIMITS.perMinute) {
      return NextResponse.json({ code: 'RATE_LIMIT', error: 'Terlalu banyak pengiriman. Tunggu satu menit sebelum memesan lagi.' }, { status: 429 });
    }

    if (Math.max(currentItemAgg._sum.quantity || 0, submittedAgg._sum.quantity || 0) + quantity > ORDER_LIMITS.perSession) {
      return NextResponse.json({ code: 'SESSION_LIMIT', error: 'Batas pemesanan mandiri sesi ini adalah 100 porsi. Silakan hubungi kasir.' }, { status: 409 });
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
      // Re-check idempotency under lock in case of simultaneous duplicate submits
      const doubleCheck = await tx.orderSubmission.findUnique({ where: { transactionId_requestId: { transactionId, requestId } } });
      if (doubleCheck) return doubleCheck.response;

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
    console.error('Order route error:', error);
    return NextResponse.json({ 
      error: 'Status pengiriman belum dapat dipastikan. Coba kembali dengan pengiriman yang sama. (' + (error?.message || 'Server timeout') + ')' 
    }, { status: 500 });
  }
}
