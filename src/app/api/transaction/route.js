import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tableNumber = body.tableNumber ? String(body.tableNumber).trim() : '0';
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const customId = `MEJA-${tableNumber}-${Date.now().toString(36).toUpperCase()}-${randomSuffix}`;

    const transaction = await prisma.transaction.create({
      data: {
        id: customId,
        tableNumber: tableNumber,
        status: 'open',
      },
    });
    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Transaction creation error:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      orderBy: { createdAt: 'desc' },
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
    return NextResponse.json(transactions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
