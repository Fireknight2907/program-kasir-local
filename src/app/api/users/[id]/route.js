import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

async function checkAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get('user_session');
  if (!session) return false;
  try {
    const user = JSON.parse(session.value);
    return user.role === 'ADMIN';
  } catch (e) {
    return false;
  }
}

export async function DELETE(request, { params }) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const { id } = await params;

  try {
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
