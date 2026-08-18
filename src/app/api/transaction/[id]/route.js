import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const { id } = await params;
  
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      }
    });
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { status, tableNumber } = body;
    
    if (tableNumber !== undefined && !tableNumber.toLowerCase().startsWith('take away')) {
      const existingActive = await prisma.transaction.findFirst({
        where: {
          id: { not: id },
          tableNumber: { equals: tableNumber, mode: 'insensitive' },
          status: { in: ['open', 'ordered'] }
        }
      });
      if (existingActive) {
        return NextResponse.json(
          { error: `Meja "${tableNumber}" sedang terisi dan belum selesai.` },
          { status: 400 }
        );
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: { 
        ...(status && { status }),
        ...(tableNumber !== undefined && { tableNumber })
      }
    });
    
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    // Delete all OrderItems that belong to Orders that belong to this Transaction
    const orders = await prisma.order.findMany({ where: { transactionId: id } });
    const orderIds = orders.map(o => o.id);
    
    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: orderIds } }
      });
      await prisma.order.deleteMany({
        where: { transactionId: id }
      });
    }

    await prisma.transaction.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
