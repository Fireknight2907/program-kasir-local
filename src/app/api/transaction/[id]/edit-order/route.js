import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { items } = body; // Array of { menuItemId, quantity, price }

    // Calculate new total
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

    // Delete existing orders and order items for this transaction
    await prisma.orderItem.deleteMany({
      where: {
        order: {
          transactionId: id
        }
      }
    });
    
    await prisma.order.deleteMany({
      where: {
        transactionId: id
      }
    });

    // Create a new consolidated order if there are items
    if (items.length > 0) {
      await prisma.order.create({
        data: {
          transactionId: id,
          total: orderTotal,
          items: {
            create: orderItemsData
          }
        }
      });
    }

    // Update Transaction total
    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        total: orderTotal,
        // if no items left, keep it open, otherwise keep it ordered
        status: items.length > 0 ? 'ordered' : 'open'
      }
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error editing order:', error);
    return NextResponse.json({ error: 'Failed to edit order' }, { status: 500 });
  }
}
