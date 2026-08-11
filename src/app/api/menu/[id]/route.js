import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, price, category, image } = body;

    const updatedItem = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(price && { price: parseInt(price) }),
        ...(category && { category }),
        ...(image !== undefined && { image }),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Gagal mengubah data menu' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    await prisma.menuItem.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return NextResponse.json({ error: 'Gagal menghapus menu. Menu mungkin terkait dengan transaksi yang ada.' }, { status: 500 });
  }
}
