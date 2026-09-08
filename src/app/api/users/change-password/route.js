import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/session';

export async function PUT(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { oldPassword, newPassword } = await request.json();

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const bcrypt = require('bcryptjs');
    let isMatch = false;
    
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      isMatch = await bcrypt.compare(oldPassword, user.password);
    } else {
      isMatch = user.password === oldPassword;
    }

    if (!isMatch) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: hashedNewPassword }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
