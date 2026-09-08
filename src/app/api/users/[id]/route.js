import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

async function checkAdmin() {
  return (await getSessionUser())?.role === 'ADMIN';
}

export async function DELETE(request, { params }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;

  try {
    // Prevent deleting the main admin
    const userToDelete = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (userToDelete && userToDelete.username === 'admin') {
      return NextResponse.json({ error: 'Cannot delete primary admin' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  // Allow admin to edit anyone, or a user to edit themselves
  const currentUser = await getSessionUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (currentUser.role !== 'ADMIN' && currentUser.id !== parseInt(id)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { name, ttl, phone, address, password } = data;
    
    let updateData = { name, ttl, phone, address };
    
    if (password && password.trim() !== '') {
      const bcrypt = require('bcryptjs');
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    const { password: _, ...safeUser } = updatedUser;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui data pengguna' }, { status: 500 });
  }
}
