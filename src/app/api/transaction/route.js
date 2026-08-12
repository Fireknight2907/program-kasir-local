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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    let whereClause = {};

    if (dateParam) {
      // Create start and end of the day for the given date
      const startDate = new Date(dateParam);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(dateParam);
      endDate.setHours(23, 59, 59, 999);

      whereClause = {
        createdAt: {
          gte: startDate,
          lte: endDate,
        }
      };
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
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
