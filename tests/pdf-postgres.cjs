// Explicit integration test. Creates only transaction-local fixtures; always rolls back.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{
 const source=fs.readFileSync('src/app/api/transaction/route.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');
 const id=randomUUID(),rollback=new Error('ROLLBACK_PDF_CHECK');
 try{await db.$transaction(async tx=>{
  const c=vm.createContext({prisma:tx,URL,Date,NextResponse:Response,console,requireStaff:async()=>null,getSessionUser:async()=>({role:'ADMIN'})});vm.runInContext(source,c);
  await tx.transaction.create({data:{id,tableNumber:'TEST-ROLLBACK',status:'completed',createdAt:new Date('2026-09-09T23:55:00+08:00'),completedAt:new Date('2026-09-10T00:10:00+08:00'),paymentMethod:'CASH',total:25000,paidTotal:25000}});
  const before=await c.GET({url:'http://localhost/api/transaction?tab=archive&date=2026-09-09'});
  assert.equal(before.status,200);assert.ok((await before.json()).some(t=>t.id===id));
  const after=await c.GET({url:'http://localhost/api/transaction?tab=archive&date=2026-09-10'});
  assert.equal(after.status,200);assert.ok(!(await after.json()).some(t=>t.id===id));
  console.log('PASS overnight payment is included only on opening day');
  throw rollback;
 },{timeout:30000});}catch(e){if(e!==rollback)throw e;}
 assert.equal(await db.transaction.findUnique({where:{id}}),null);
 console.log('PASS fixture rolled back');
 const tables=['User','Transaction','Order','OrderItem','OrderSubmission','LoginThrottle','MenuItem','Category'];
 for(const table of tables){
  const name='public."'+table+'"';
  const [flags]=await db.$queryRaw`SELECT relrowsecurity FROM pg_class WHERE oid=${name}::regclass`;
  assert.equal(flags.relrowsecurity,true);
  for(const role of ['anon','authenticated'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE']){
   const [r]=await db.$queryRaw`SELECT has_table_privilege(${role},${name},${privilege}) AS allowed`;
   assert.equal(r.allowed,false,role+' '+table+' '+privilege);
  }
 }
 console.log('PASS 64 role/table/operation privileges denied and 8 RLS flags enabled');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
