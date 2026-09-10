import { requireStaff, getSessionUser } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import { normalizeTable, tableConflict } from '@/lib/table-session';

export async function POST(request) {
  const denied = await requireStaff(request); if (denied) return denied;
  try {
    const body = await request.json().catch(() => null);
    const tableNumber = normalizeTable(body?.tableNumber);
    if (!tableNumber) return NextResponse.json({error:'Nomor meja wajib diisi, maksimal 80 karakter.'},{status:400});
    const result = await prisma.$transaction(async tx => {
      if (await tableConflict(tx, tableNumber)) return null;
      return tx.transaction.create({data:{id:randomUUID(),tableNumber,status:'open'}});
    });
    if (!result) return NextResponse.json({error:'Meja sedang terisi. Gunakan sesi yang sudah ada.'},{status:409});
    return NextResponse.json(result);
  } catch (error) { console.error(error); return NextResponse.json({error:'Gagal membuka meja.'},{status:500}); }
}

export async function GET(request) {
  const denied = await requireStaff(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const tabParam = searchParams.get('tab');

    const user = await getSessionUser();
    if (user?.role !== 'ADMIN' && tabParam !== 'active') {
      return NextResponse.json({ error: 'Arsip dan statistik hanya untuk admin.' }, { status: 403 });
    }
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

    if (user?.role !== 'ADMIN') {
      // Cashiers may see active sessions and today's opened sessions only,
      // regardless of a forged date query. Reports remain admin-only.
      const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const start = new Date(today + 'T00:00:00+08:00');
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      whereClause = { OR: [{ status: { in: ['open', 'ordered'] } }, { createdAt: { gte: start, lt: end } }] };
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
