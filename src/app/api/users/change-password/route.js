import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('user_session');
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    let currentUser;
    try {
      currentUser = JSON.parse(session.value);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    
    if (!user || user.password !== oldPassword) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: { password: newPassword }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Gagal mengubah password' }, { status: 500 });
  }
}
