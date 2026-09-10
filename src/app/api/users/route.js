import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { accountData } from '@/lib/account-policy';
import bcrypt from 'bcryptjs';
export async function GET(request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } }); return NextResponse.json(users.map(({password, ...user}) => user)); }
  catch { return NextResponse.json({error:'Gagal memuat akun.'}, {status:500}); }
}
export async function POST(request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  let body, data;
  try { body = await request.json(); data = accountData(body, true); }
  catch (e) { return NextResponse.json({error:e.message}, {status:400}); }
  try {
    const user = await prisma.user.create({data:{...data, password:await bcrypt.hash(body.password, 12)}});
    const {password, ...safe} = user; return NextResponse.json(safe, {status:201});
  } catch (e) { return NextResponse.json({error:e.code==='P2002'?'Username sudah digunakan.':'Gagal menyimpan akun.'}, {status:e.code==='P2002'?409:500}); }
}
