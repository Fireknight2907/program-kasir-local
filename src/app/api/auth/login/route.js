import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSession } from '@/lib/session';
import { allowLogin, clearLoginAttempts } from '@/lib/login-throttle';
import bcrypt from 'bcryptjs';
export async function POST(request) {
  try {
    const body=await request.json();
    if(typeof body.username!=='string'||!body.username.trim()||body.username.length>32||typeof body.password!=='string'||!body.password||body.password.length>256) return NextResponse.json({error:'Username atau password tidak valid.'},{status:400});
    const username=body.username.trim().toLowerCase(), password=body.password;
    if(!await allowLogin(username)) return NextResponse.json({error:'Terlalu banyak percobaan login. Coba kembali dalam 15 menit.'},{status:429,headers:{'Retry-After':'900'}});
    let user=await prisma.user.findUnique({where:{username}});
    const hashed=user && /^\$2[aby]\$/.test(user.password);
    const valid=user && (hashed?await bcrypt.compare(password,user.password):password===user.password);
    if(!valid) return NextResponse.json({error:'Username atau password salah.'},{status:401});
    const mustChangePassword=user.mustChangePassword||['admin123','kasir123'].includes(password.toLowerCase());
    if(!hashed || mustChangePassword!==user.mustChangePassword) user=await prisma.user.update({where:{id:user.id},data:{...(!hashed?{password:await bcrypt.hash(password,12)}:{}),mustChangePassword}});
    await clearLoginAttempts(username);
    await createSession(user);
    const {password:_,...safe}=user; return NextResponse.json(safe);
  } catch { return NextResponse.json({error:'Gagal melakukan login.'},{status:500}); }
}
