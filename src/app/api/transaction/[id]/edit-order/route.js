import { requireStaff } from '@/lib/session';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(request,{params}) {
  const denied=await requireStaff(request);if(denied)return denied;
  const {id}=await params;
  try {
    const body=await request.json().catch(()=>null);
    if(!body||!Number.isSafeInteger(body.expectedRevision))return NextResponse.json({code:'ORDER_CONFLICT',error:'Buka ulang Edit Pesanan untuk memuat data terbaru.'},{status:409});
    const {items,expectedRevision}=body;
    if(!Array.isArray(items)||items.length>200||items.some(i=>!i||!Number.isSafeInteger(i.quantity)||i.quantity<=0||i.quantity>1000||!Number.isSafeInteger(i.menuItemId)||i.menuItemId<=0||(i.itemId!==undefined&&(!Number.isSafeInteger(i.itemId)||i.itemId<=0))||(i.isTakeaway!==undefined&&typeof i.isTakeaway!=='boolean')))
      return NextResponse.json({error:'Item pesanan tidak valid.'},{status:400});
    const ids=items.filter(i=>i.itemId).map(i=>i.itemId);
    if(new Set(ids).size!==ids.length)return NextResponse.json({error:'Baris pesanan duplikat.'},{status:400});
    const result=await prisma.$transaction(async tx=>{
      const lock=await tx.transaction.updateMany({where:{id,status:{in:['open','ordered']},completedAt:null},data:{total:{increment:0}}});
      if(!lock.count)return {code:'SESSION_CLOSED',error:'Sesi sudah ditutup.'};
      const session=await tx.transaction.findUnique({where:{id}});
      if(session.revision!==expectedRevision)return {code:'ORDER_CONFLICT',error:'Pesanan berubah sejak edit dibuka. Buka kembali Edit Pesanan.'};
      const orders=await tx.order.findMany({where:{transactionId:id},include:{items:true}});
      const original=new Map(orders.flatMap(o=>o.items.map(i=>[i.id,{...i,order:o}])));
      if(items.some(i=>i.itemId&&(!original.has(i.itemId)||original.get(i.itemId).menuItemId!==i.menuItemId)))return {code:'ORDER_CONFLICT',error:'Item asal tidak sesuai. Muat ulang pesanan.'};
      const added=items.filter(i=>!i.itemId);
      const menu=await tx.menuItem.findMany({where:{id:{in:[...new Set(added.map(i=>i.menuItemId))]}}});
      const prices=new Map(menu.map(m=>[m.id,m]));
      if(added.some(i=>!prices.get(i.menuItemId)?.isAvailable))return {code:'MENU_UNAVAILABLE',error:'Menu tambahan tidak tersedia.'};
      if(added.some(i=>!Number.isSafeInteger(prices.get(i.menuItemId)?.price)||prices.get(i.menuItemId).price<0))return {code:'INVALID_PRICE',error:'Harga menu tidak valid. Minta admin memperbaiki harga menu.'};
      let total=0;const incoming=new Map(items.filter(i=>i.itemId).map(i=>[i.itemId,i]));
      for(const item of items)total+=item.quantity*(item.itemId?original.get(item.itemId).price:prices.get(item.menuItemId).price);
      if(!Number.isSafeInteger(total)||total<0||total>2147483647)return {code:'INVALID_TOTAL',error:'Total tidak valid.'};
      // Preserve original order identity, prices, service type, and creation time.
      for(const order of orders){
        let changed=false,orderTotal=0;
        for(const item of order.items){
          const next=incoming.get(item.id);
          if(!next){await tx.orderItem.delete({where:{id:item.id}});changed=true;}
          else {orderTotal+=next.quantity*item.price;if(next.quantity!==item.quantity){await tx.orderItem.update({where:{id:item.id},data:{quantity:next.quantity}});changed=true;}}
        }
        if(changed)await tx.order.update({where:{id:order.id},data:{total:orderTotal,kitchenStatus:orderTotal===0&&!order.items.some(i=>incoming.has(i.id))?'cancelled':'queued',acceptedAt:null,acceptedById:null,kitchenVersion:{increment:1}}});
      }
      for(const takeaway of [false,true]){
        const group=added.filter(i=>(i.isTakeaway??session.tableNumber?.toLowerCase().startsWith('take away')??false)===takeaway);
        if(group.length)await tx.order.create({data:{transactionId:id,isTakeaway:takeaway,total:group.reduce((s,i)=>s+i.quantity*prices.get(i.menuItemId).price,0),items:{create:group.map(i=>({menuItemId:i.menuItemId,quantity:i.quantity,price:prices.get(i.menuItemId).price}))}}});
      }
      return tx.transaction.update({where:{id},data:{total,status:items.length?'ordered':'open',revision:{increment:1}}});
    });
    return NextResponse.json(result,{status:result.code?409:200});
  }catch(error){console.error(error);return NextResponse.json({error:'Gagal menyimpan pesanan.'},{status:500});}
}
