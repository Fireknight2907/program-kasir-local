import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import { ORDER_LIMITS } from '@/lib/order-limits';

const reject = (code, error, status = 400) => ({ rejected: true, code, error, status });

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
    const result = await prisma.$transaction(async tx => {
      // Same session row lock as editing/closure; retries and new orders serialize.
      const locked = await tx.transaction.updateMany({ where: { id: transactionId }, data: { total: { increment: 0 } } });
      if (!locked.count) return reject('SESSION_CLOSED', 'Sesi meja tidak berlaku. Silakan hubungi kasir.', 409);
      const previous = await tx.orderSubmission.findUnique({ where: { transactionId_requestId: { transactionId, requestId } } });
      if (previous) {
        if (previous.payloadHash !== payloadHash) return reject('REQUEST_CONFLICT', 'Isi pengiriman berbeda. Periksa pesanan sebelumnya atau hubungi kasir.', 409);
        return previous.response;
      }
      const session = await tx.transaction.findUnique({ where: { id: transactionId } });
      if (!['open', 'ordered'].includes(session.status) || session.completedAt) return reject('SESSION_CLOSED', 'Sesi meja sudah ditutup. Silakan minta QR Code baru kepada kasir.', 409);
      const recent = await tx.orderSubmission.count({ where: { transactionId, createdAt: { gte: new Date(Date.now() - 60000) } } });
      if (recent >= ORDER_LIMITS.perMinute) return reject('RATE_LIMIT', 'Terlalu banyak pengiriman. Tunggu satu menit sebelum memesan lagi.', 429);
      const current = await tx.orderItem.aggregate({ where: { order: { transactionId } }, _sum: { quantity: true } });
      const submitted = await tx.orderSubmission.aggregate({ where: { transactionId }, _sum: { quantity: true } });
      if (Math.max(current._sum.quantity || 0, submitted._sum.quantity || 0) + quantity > ORDER_LIMITS.perSession) {
        return reject('SESSION_LIMIT', 'Batas pemesanan mandiri sesi ini adalah 100 porsi. Silakan hubungi kasir.', 409);
      }
      const menu = await tx.menuItem.findMany({ where: { id: { in: normalized.map(item => item.menuItemId) } }, select: { id: true, price: true, isAvailable: true } });
      const menuById = new Map(menu.map(item => [item.id, item]));
      if (normalized.some(item => !menuById.get(item.menuItemId)?.isAvailable)) return reject('MENU_UNAVAILABLE', 'Ada menu yang sudah habis atau tidak tersedia. Muat ulang menu sebelum memesan kembali.', 409);
      const data = normalized.map(item => ({ ...item, price: menuById.get(item.menuItemId).price }));
      const total = data.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (data.some(item => !Number.isSafeInteger(item.price) || item.price < 0) || !Number.isSafeInteger(total) || total + session.total > 2147483647) return reject('INVALID_TOTAL', 'Total pesanan tidak valid. Silakan hubungi kasir.');
      const order = await tx.order.create({ data: { transactionId, total, isTakeaway, items: { create: data } } });
      await tx.transaction.update({ where: { id: transactionId }, data: { total: { increment: total }, status: 'ordered', revision: { increment: 1 } } });
      // Snapshot is independent of Order so edits cannot make a retry recreate food.
      const response = JSON.parse(JSON.stringify(order));
      await tx.orderSubmission.create({ data: { transactionId, requestId, payloadHash, quantity, response } });
      return response;
    });
    if (result.rejected) return NextResponse.json({ code: result.code, error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Status pengiriman belum dapat dipastikan. Coba kembali dengan pengiriman yang sama.' }, { status: 500 });
  }
}
