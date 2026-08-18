import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json();
    const { transactionId, items, isTakeaway } = body;
    
    // items should be [{ menuItemId, quantity, price }]
    
    let orderTotal = 0;
    const orderItemsData = items.map(item => {
      const itemTotal = item.price * item.quantity;
      orderTotal += itemTotal;
      return {
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price
      };
    });

    // Create Order and Items
    const order = await prisma.order.create({
      data: {
        transactionId,
        total: orderTotal,
        isTakeaway: isTakeaway || false,
        items: {
          create: orderItemsData
        }
      }
    });

    // Update Transaction total and status
    const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
    await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        total: transaction.total + orderTotal,
        status: 'ordered' // update status to ordered since client placed order
      }
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to place order' }, { status: 500 });
  }
}
