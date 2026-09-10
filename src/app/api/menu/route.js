import { requireAdmin } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const menu = await prisma.menuItem.findMany({
      orderBy: { id: 'desc' }
    });
    return NextResponse.json(menu);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const { name, price, category, image, isAvailable } = body;
    const parsedPrice = typeof price === 'string' && /^\d+$/.test(price.trim()) ? Number(price.trim()) : price;
    if ((typeof parsedPrice !== 'number' || !Number.isSafeInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > 2147483647)) {
      return NextResponse.json({ error: 'Harga harus bilangan bulat nol atau lebih, maksimal 2147483647.' }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ error: 'Nama dan harga menu wajib diisi' }, { status: 400 });
    }

    const newItem = await prisma.menuItem.create({
      data: {
        name,
        price: parsedPrice,
        category: category || 'Umum',
        image: image || null,
        isAvailable: isAvailable !== undefined ? isAvailable : true,
      },
    });

    return NextResponse.json(newItem);
  } catch (error) {
    console.error('Error adding menu:', error);
    return NextResponse.json({ error: 'Gagal menambahkan menu' }, { status: 500 });
  }
}
