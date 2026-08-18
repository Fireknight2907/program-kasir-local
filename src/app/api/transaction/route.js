import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tableNumber = body.tableNumber ? String(body.tableNumber).trim() : '0';
    
    // Validasi meja dobel jika bukan Take Away
    if (!tableNumber.toLowerCase().startsWith('take away')) {
      const existingActive = await prisma.transaction.findFirst({
        where: {
          tableNumber: { equals: tableNumber, mode: 'insensitive' },
          status: { in: ['open', 'ordered'] }
        }
      });
      if (existingActive) {
        return NextResponse.json(
          { error: `Meja "${tableNumber}" sedang terisi dan belum selesai (Silakan selesaikan transaksi meja tersebut terlebih dahulu).` },
          { status: 400 }
        );
      }
    }

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
    const tabParam = searchParams.get('tab');

    let whereClause = {};

    if (dateParam) {
      // Handle UTC+8 timezone. 
      // Example: For dateParam '2026-08-13', the start of day in UTC+8 is 2026-08-12T16:00:00.000Z
      const startDate = new Date(dateParam);
      startDate.setUTCHours(-8, 0, 0, 0); // 00:00 UTC+8 is 16:00 UTC previous day

      const endDate = new Date(dateParam);
      endDate.setUTCHours(23 - 8, 59, 59, 999); // 23:59 UTC+8 is 15:59 UTC

      if (tabParam === 'active') {
        // Active tab: Show ALL open/ordered transactions, PLUS completed/cancelled today
        whereClause = {
          OR: [
            { status: 'open' },
            { status: 'ordered' },
            {
              createdAt: {
                gte: startDate,
                lte: endDate,
              }
            }
          ]
        };
      } else {
        // Archive tab: STRICTLY show transactions created on this date
        whereClause = {
          createdAt: {
            gte: startDate,
            lte: endDate,
          }
        };
      }
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
