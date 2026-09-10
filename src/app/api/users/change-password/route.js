import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { passwordError } from '@/lib/account-policy';
import { getSessionUser, createSession } from '@/lib/session';

export async function PUT(request) {
  try {
    const currentUser = await getSessionUser();
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { oldPassword, newPassword } = await request.json();

    const origin = request.headers?.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({error:'Asal permintaan tidak diizinkan.'},{status:403});
    const invalid = passwordError(newPassword);
    if (invalid || typeof oldPassword !== 'string') return NextResponse.json({error:invalid || 'Password lama wajib diisi.'},{status:400});
    if (oldPassword === newPassword) return NextResponse.json({error:'Password baru harus berbeda.'},{status:400});
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

    const updated = await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: hashedNewPassword, mustChangePassword: false }
    });

    await createSession(updated);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
