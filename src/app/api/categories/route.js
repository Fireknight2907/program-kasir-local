import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    let categories = await prisma.category.findMany({
      orderBy: [
        { order: 'asc' },
        { id: 'asc' }
      ]
    });

    // Fetch existing categories from MenuItem to ensure all categories are synced in Category table
    const menuItems = await prisma.menuItem.findMany({
      select: { category: true },
      distinct: ['category']
    });

    const existingNames = new Set(categories.map(c => c.name));
    let nextOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) + 1 : 1;

    let addedNew = false;
    for (const item of menuItems) {
      const catName = item.category?.trim();
      if (catName && !existingNames.has(catName)) {
        try {
          await prisma.category.create({
            data: {
              name: catName,
              order: nextOrder++
            }
          });
          addedNew = true;
        } catch (e) {
          // ignore duplicate constraint
        }
      }
    }

    if (addedNew) {
      categories = await prisma.category.findMany({
        orderBy: [
          { order: 'asc' },
          { id: 'asc' }
        ]
      });
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama kategori wajib diisi' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Check if category already exists
    const existing = await prisma.category.findUnique({
      where: { name: trimmedName }
    });

    if (existing) {
      return NextResponse.json({ error: 'Kategori sudah ada' }, { status: 400 });
    }

    // Get max order
    const lastCategory = await prisma.category.findFirst({
      orderBy: { order: 'desc' }
    });
    const nextOrder = lastCategory ? lastCategory.order + 1 : 1;

    const newCategory = await prisma.category.create({
      data: {
        name: trimmedName,
        order: nextOrder
      }
    });

    return NextResponse.json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Gagal membuat kategori' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { categories } = body; // Array of { id, order }

    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: 'Data kategori tidak valid' }, { status: 400 });
    }

    // Update orders
    const updatePromises = categories.map((cat, idx) => 
      prisma.category.update({
        where: { id: cat.id },
        data: { order: cat.order !== undefined ? cat.order : idx + 1 }
      })
    );

    await Promise.all(updatePromises);

    const updatedCategories = await prisma.category.findMany({
      orderBy: [
        { order: 'asc' },
        { id: 'asc' }
      ]
    });

    return NextResponse.json(updatedCategories);
  } catch (error) {
    console.error('Error updating category orders:', error);
    return NextResponse.json({ error: 'Gagal mengurutkan kategori' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const nameParam = searchParams.get('name');

    let categoryToDelete;
    if (idParam) {
      categoryToDelete = await prisma.category.findUnique({ where: { id: parseInt(idParam) } });
    } else if (nameParam) {
      categoryToDelete = await prisma.category.findUnique({ where: { name: nameParam } });
    }

    if (!categoryToDelete) {
      return NextResponse.json({ error: 'Kategori tidak ditemukan' }, { status: 404 });
    }

    // Update MenuItems with this category to 'Umum'
    await prisma.menuItem.updateMany({
      where: { category: categoryToDelete.name },
      data: { category: 'Umum' }
    });

    // Delete category
    await prisma.category.delete({
      where: { id: categoryToDelete.id }
    });

    return NextResponse.json({ success: true, message: `Kategori ${categoryToDelete.name} berhasil dihapus` });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Gagal menghapus kategori' }, { status: 500 });
  }
}
