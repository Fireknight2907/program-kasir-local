import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';

// Helper to check if current user is ADMIN
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

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });
    // Don't send passwords to frontend
    const safeUsers = users.map(({ password, ...rest }) => rest);
    return NextResponse.json(safeUsers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  try {
    const data = await request.json();
    const { username, password, name, ttl, phone, address, role } = data;

    // Generate custom employeeId (e.g., KSR-001)
    const count = await prisma.user.count();
    const employeeId = `KSR-${String(count + 1).padStart(3, '0')}`;
    
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password || 'kasir123', 10);

    const user = await prisma.user.create({
      data: {
        employeeId,
        username,
        password: hashedPassword, // Store hashed password
        name,
        ttl,
        phone,
        address,
        role: role || 'KASIR',
      }
    });

    const { password: _, ...safeUser } = user;
    return NextResponse.json(safeUser);
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Gagal membuat pengguna. Username mungkin sudah ada.' }, { status: 500 });
  }
}
