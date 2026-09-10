import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStaff,getSessionUser } from '@/lib/session';
export async function PUT(request,{params}){
 const denied=await requireStaff(request);if(denied)return denied;
 const {id}=await params;const orderId=Number(id);
 const body=await request.json().catch(()=>null);
 const next={legacy:'accepted',cancelled:'dismissed',queued:'accepted',accepted:'preparing',preparing:'ready',ready:'served'};
 if(!Number.isSafeInteger(orderId)||orderId<1||!body||!Object.hasOwn(next,body.expectedStatus)||next[body.expectedStatus]!==body.status||!Number.isSafeInteger(body.expectedVersion))return NextResponse.json({error:'Perubahan status dapur tidak valid.'},{status:400});
 try {const user=await getSessionUser();const result=await prisma.$transaction(async tx=>{
  const order=await tx.order.findUnique({where:{id:orderId}});if(!order)return false;
  // Lock session first, as edit/order routes do, then check the kitchen revision.
  await tx.transaction.updateMany({where:{id:order.transactionId},data:{total:{increment:0}}});
  const session=await tx.transaction.findUnique({where:{id:order.transactionId}});if(!session||(session.status==='cancelled'&&body.status!=='dismissed'))return false;
  const changed=await tx.order.updateMany({where:{id:orderId,kitchenStatus:body.expectedStatus,kitchenVersion:body.expectedVersion},data:{kitchenStatus:body.status,kitchenVersion:{increment:1},...(body.status==='accepted'?{acceptedAt:new Date(),acceptedById:user.id}:{})}});return changed.count===1;
 });return NextResponse.json(result?{success:true}:{error:'Pesanan berubah. Muat ulang antrean sebelum melanjutkan.'},{status:result?200:409});}
 catch{return NextResponse.json({error:'Status dapur gagal disimpan.'},{status:500});}
}
