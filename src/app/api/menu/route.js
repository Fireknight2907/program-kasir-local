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
  try {
    const body = await request.json();
    const { name, price, category, image, isAvailable } = body;

    if (!name || !price) {
      return NextResponse.json({ error: 'Nama dan harga menu wajib diisi' }, { status: 400 });
    }

    const newItem = await prisma.menuItem.create({
      data: {
        name,
        price: parseInt(price),
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
