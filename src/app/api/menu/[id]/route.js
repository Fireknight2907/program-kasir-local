import { requireAdmin } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, price, category, image, isAvailable } = body;
    const parsedPrice = typeof price === 'string' && /^\d+$/.test(price.trim()) ? Number(price.trim()) : price;
    if (price !== undefined && (typeof parsedPrice !== 'number' || !Number.isSafeInteger(parsedPrice) || parsedPrice < 0 || parsedPrice > 2147483647)) {
      return NextResponse.json({ error: 'Harga harus bilangan bulat nol atau lebih, maksimal 2147483647.' }, { status: 400 });
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(price !== undefined && { price: parsedPrice }),
        ...(category && { category }),
        ...(image !== undefined && { image }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('Error updating menu item:', error);
    return NextResponse.json({ error: 'Gagal mengubah data menu' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
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
