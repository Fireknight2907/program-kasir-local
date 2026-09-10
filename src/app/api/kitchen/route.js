import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireStaff } from '@/lib/session';
export async function GET(request){
 const denied=await requireStaff(request);if(denied)return denied;
 try {const orders=await prisma.order.findMany({where:{OR:[{kitchenStatus:{in:['queued','accepted','preparing','ready']},transaction:{status:{not:'cancelled'}},items:{some:{}}},{kitchenStatus:'legacy',transaction:{status:{in:['open','ordered']}},items:{some:{}}},{kitchenStatus:'cancelled'}]},include:{items:{include:{menuItem:true}},transaction:{select:{tableNumber:true}}},orderBy:{createdAt:'asc'}});return NextResponse.json(orders);}
 catch{return NextResponse.json({error:'Antrean dapur gagal dimuat.'},{status:500});}
}
