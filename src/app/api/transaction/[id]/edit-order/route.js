import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const { items } = await request.json();
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
        data: { total: orderTotal, status: items.length > 0 ? 'ordered' : 'open' }
      });
      if (activeSession.count === 0) return null;

      await tx.orderItem.deleteMany({ where: { order: { transactionId: id } } });
      await tx.order.deleteMany({ where: { transactionId: id } });
      if (items.length > 0) {
        await tx.order.create({
          data: { transactionId: id, total: orderTotal, items: { create: orderItemsData } }
        });
      }
      // All changes, including the total, roll back if any step fails.
      return tx.transaction.findUnique({ where: { id } });
    });

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
