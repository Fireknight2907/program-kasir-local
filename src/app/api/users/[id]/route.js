import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdmin, getSessionUser, createSession } from '@/lib/session';
import { accountData } from '@/lib/account-policy';
import bcrypt from 'bcryptjs';
export async function PUT(request, {params}) {
  const denied = await requireAdmin(request); if (denied) return denied;
  const user = await getSessionUser(), id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id<1) return NextResponse.json({error:'ID akun tidak valid.'},{status:400});
  let body, data;
  try { body=await request.json(); data=accountData(body); }
  catch(e) { return NextResponse.json({error:e.message},{status:400}); }
  if (id===user.id && data.role && data.role!=='ADMIN') return NextResponse.json({error:'Peran akun yang sedang digunakan tidak boleh diturunkan.'},{status:409});
  if (body.password) {data.password=await bcrypt.hash(body.password,12); data.mustChangePassword=false;}
  try {
    const saved=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('account-admins'))`;
      const target=await tx.user.findUnique({where:{id}});
      if(!target) return null;
      if(target.role==='ADMIN' && data.role==='KASIR' && await tx.user.count({where:{role:'ADMIN'}})<=1) throw new Error('LAST_ADMIN');
      return tx.user.update({where:{id},data});
    });
    if(!saved) return NextResponse.json({error:'Akun tidak ditemukan.'},{status:404});
    if(id===user.id && body.password) await createSession(saved);
    const {password,...safe}=saved; return NextResponse.json(safe);
  } catch(e) { return NextResponse.json({error:e.message==='LAST_ADMIN'?'Admin terakhir tidak dapat diturunkan.':e.code==='P2002'?'Username sudah digunakan.':'Gagal memperbarui akun.'},{status:e.message==='LAST_ADMIN'||e.code==='P2002'?409:500}); }
}
export async function DELETE(request,{params}) {
  const denied=await requireAdmin(request); if(denied) return denied;
  const user=await getSessionUser(), id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<1) return NextResponse.json({error:'ID akun tidak valid.'},{status:400});
  if(id===user.id) return NextResponse.json({error:'Akun yang sedang digunakan tidak dapat dihapus.'},{status:409});
  try {
    const result=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('account-admins'))`;
      const target=await tx.user.findUnique({where:{id}});
      if(!target) return 'MISSING';
      if(target.role==='ADMIN' && await tx.user.count({where:{role:'ADMIN'}})<=1) return 'LAST_ADMIN';
      await tx.user.delete({where:{id}}); return 'OK';
    });
    return result==='OK'?NextResponse.json({success:true}):NextResponse.json({error:result==='MISSING'?'Akun tidak ditemukan.':'Admin terakhir tidak dapat dihapus.'},{status:result==='MISSING'?404:409});
  } catch { return NextResponse.json({error:'Gagal menghapus akun.'},{status:500}); }
}
