import { requireStaff, getSessionUser } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const { id } = await params;
  
  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            items: {
              include: { menuItem: true }
            }
          }
        }
      }
    });
    
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    
    const viewer = await getSessionUser();
    const today = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const openedDay = new Date(new Date(transaction.createdAt).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const cashierScope = ['open', 'ordered'].includes(transaction.status) || openedDay === today;
    if (viewer?.role === 'KASIR' && !cashierScope) {
      return NextResponse.json({ error: 'Arsip transaksi hanya untuk admin.' }, { status: 403 });
    }
    if (viewer && ['ADMIN', 'KASIR'].includes(viewer.role) && !viewer.mustChangePassword) {
      return NextResponse.json(transaction);
    }
    return NextResponse.json({
      id: transaction.id, tableNumber: transaction.tableNumber, status: transaction.status,
      createdAt: transaction.createdAt, completedAt: transaction.completedAt, total: transaction.total,
      orders: transaction.orders.map(order => ({
        id: order.id, createdAt: order.createdAt, total: order.total,
        isTakeaway: order.isTakeaway, kitchenStatus: order.kitchenStatus,
        items: order.items.map(item => ({
          id: item.id, menuItemId: item.menuItemId, quantity: item.quantity, price: item.price,
          menuItem: { name: item.menuItem?.name }
        }))
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

import { normalizeTable, tableConflict } from '@/lib/table-session';
export async function PUT(request, { params }) {
  const denied=await requireStaff(request); if(denied)return denied;
  const {id}=await params;
  try {
    const user=await getSessionUser();
    const body=await request.json().catch(()=>null);
    if(!body)return NextResponse.json({error:'Permintaan tidak valid.'},{status:400});
    const {status,paymentMethod,expectedRevision,expectedTotal,paymentRequestId}=body;
    const tableNumber=body.tableNumber===undefined?undefined:normalizeTable(body.tableNumber);
    if((status!==undefined&&!['completed','cancelled'].includes(status)) ||
      (tableNumber===null) || (paymentMethod!==undefined&&!['CASH','QRIS','CARD'].includes(paymentMethod)) ||
      (status==='completed'&&(!paymentMethod||!Number.isSafeInteger(expectedTotal)||expectedTotal<0||!Number.isSafeInteger(expectedRevision)||typeof paymentRequestId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(paymentRequestId))) ||
      (status===undefined&&tableNumber===undefined)) return NextResponse.json({error:'Data transaksi atau pembayaran tidak valid. Buka ulang modal pembayaran.'},{status:400});
    const result=await prisma.$transaction(async tx=>{
      if(tableNumber!==undefined&&await tableConflict(tx,tableNumber,id))return {error:'Meja tujuan sedang terisi.',code:'TABLE_CONFLICT'};
      const lock=await tx.transaction.updateMany({where:{id},data:{total:{increment:0}}});
      if(!lock.count)return {error:'Sesi tidak ditemukan.',code:'SESSION_CLOSED'};
      const current=await tx.transaction.findUnique({where:{id}});
      if(current.status==='completed'&&status==='completed'&&current.paymentRequestId===paymentRequestId&&current.paidTotal===expectedTotal&&current.paymentMethod===paymentMethod)return current;
      if(!['open','ordered'].includes(current.status))return {error:'Sesi sudah ditutup. Data pembayaran tidak diubah.',code:'SESSION_CLOSED'};
      if(status==='completed'&&(current.revision!==expectedRevision||current.total!==expectedTotal))return {error:'Pesanan atau total berubah. Buka ulang pembayaran dan periksa tagihan terbaru.',code:'PAYMENT_CONFLICT'};
      if(status==='cancelled') await tx.order.updateMany({where:{transactionId:id,kitchenStatus:{notIn:['served','dismissed']}},data:{kitchenStatus:'cancelled',kitchenVersion:{increment:1}}});
      return tx.transaction.update({where:{id},data:{
        ...(tableNumber!==undefined?{tableNumber}:{}),
        ...(status?{status,revision:{increment:1}}:{}),
        ...(status==='completed'?{completedAt:new Date(),paidTotal:current.total,paidById:user.id,paymentRequestId,paymentMethod}:{}),
        ...(status==='cancelled'?{completedAt:null}:{}),
      }});
    });
    return NextResponse.json(result,{status:result.code?409:200});
  }catch(error){console.error(error);return NextResponse.json({error:'Gagal menyimpan transaksi.'},{status:500});}
}

export async function DELETE(request,{params}) {
  const denied=await requireStaff(request);if(denied)return denied;
  const user=await getSessionUser();if(user.role!=='ADMIN')return NextResponse.json({error:'Hanya admin dapat menghapus transaksi.'},{status:403});
  const {id}=await params;
  try {
    await prisma.$transaction(async tx=>{
      await tx.transaction.updateMany({where:{id},data:{total:{increment:0}}});
      await tx.orderItem.deleteMany({where:{order:{transactionId:id}}});
      await tx.order.deleteMany({where:{transactionId:id}});
      await tx.transaction.delete({where:{id}});
    });return NextResponse.json({success:true});
  }catch{return NextResponse.json({error:'Gagal menghapus transaksi.'},{status:500});}
}
