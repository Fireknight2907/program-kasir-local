import { requireStaff } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const denied = await requireStaff(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const { items, expectedOrderIds } = await request.json();
    if (!Array.isArray(expectedOrderIds) ||
        expectedOrderIds.some(id => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(expectedOrderIds).size !== expectedOrderIds.length) {
      return NextResponse.json({ code: 'ORDER_CONFLICT', error: 'Muat ulang halaman kasir dan buka kembali edit pesanan sebelum menyimpan.' }, { status: 409 });
    }
    if (!Array.isArray(items) || items.some(item =>
      !item || !Number.isSafeInteger(item.menuItemId) || item.menuItemId <= 0 ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
      !Number.isSafeInteger(item.price) || item.price < 0
    )) {
      return NextResponse.json({ error: 'Item pesanan tidak valid.' }, { status: 400 });
    }
    const orderTotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
    if (!Number.isSafeInteger(orderTotal) || orderTotal > 2147483647) {
      return NextResponse.json({ error: 'Total pesanan terlalu besar.' }, { status: 400 });
    }
    const orderItemsData = items.map(({ menuItemId, quantity, price }) => ({ menuItemId, quantity, price }));

    const transaction = await prisma.$transaction(async (tx) => {
      // Lock the session before replacing any orders. Concurrent saves (and
      // customer orders) wait for this transaction instead of interleaving.
      const activeSession = await tx.transaction.updateMany({
        where: { id, status: { in: ['open', 'ordered'] }, completedAt: null },
        data: { total: { increment: 0 } }
      });
      if (activeSession.count === 0) return null;

      // Order IDs change whenever an order is added or an edit replaces it.
      // Compare only after taking the same session lock as customer ordering.
      const currentOrders = await tx.order.findMany({ where: { transactionId: id }, select: { id: true } });
      const expected = new Set(expectedOrderIds);
      if (currentOrders.length !== expected.size || currentOrders.some(order => !expected.has(order.id))) {
        return { conflict: true };
      }

      await tx.orderItem.deleteMany({ where: { order: { transactionId: id } } });
      await tx.order.deleteMany({ where: { transactionId: id } });
      if (items.length > 0) {
        await tx.order.create({
          data: { transactionId: id, total: orderTotal, items: { create: orderItemsData } }
        });
      }
      // All changes, including the total, roll back if any step fails.
      return tx.transaction.update({ where: { id }, data: { total: orderTotal, status: items.length > 0 ? 'ordered' : 'open' } });
    });

    if (transaction?.conflict) {
      return NextResponse.json({ code: 'ORDER_CONFLICT', error: 'Pesanan sudah berubah sejak edit dibuka. Perubahan Anda belum disimpan. Buka kembali Edit Pesanan untuk melihat data terbaru.' }, { status: 409 });
    }
    if (!transaction) {
      return NextResponse.json({
        code: 'SESSION_CLOSED',
        error: 'Sesi meja sudah ditutup atau tidak berlaku. Pesanan tidak dapat diubah.'
      }, { status: 409 });
    }
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error editing order:', error);
    return NextResponse.json({ error: 'Gagal menyimpan perubahan pesanan.' }, { status: 500 });
  }
}
