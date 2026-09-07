import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const { transactionId, items, isTakeaway } = await request.json();
    if (typeof transactionId !== 'string' || !transactionId.trim() ||
        !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Pesanan tidak valid.' }, { status: 400 });
    }

    let orderTotal = 0;
    const orderItemsData = items.map(item => {
      orderTotal += item.price * item.quantity;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price
      };
    });

    const order = await prisma.$transaction(async (tx) => {
      // Update first: the row lock serializes this order with session closure.
      // A closed/deleted session must never create an order or change its total.
      const activeSession = await tx.transaction.updateMany({
        where: {
          id: transactionId,
          status: { in: ['open', 'ordered'] },
          completedAt: null
        },
        data: {
          total: { increment: orderTotal },
          status: 'ordered'
        }
      });
      if (activeSession.count === 0) return null;

      // Any failure here also rolls back the session total above.
      return tx.order.create({
        data: {
          transactionId,
          total: orderTotal,
          isTakeaway: isTakeaway || false,
          items: { create: orderItemsData }
        }
      });
    });

    if (!order) {
      return NextResponse.json({
        code: 'SESSION_CLOSED',
        error: 'Sesi meja ini sudah ditutup atau tidak berlaku. Silakan minta QR Code baru kepada kasir.'
      }, { status: 409 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
