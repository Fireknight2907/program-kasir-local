// Run explicitly: node tests/trial-postgres.cjs. All business data is rolled back.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
const source=p=>fs.readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export (async )?function/g,'$1function').replace(/export const /g,'const ');
function load(p,prisma,extra={}){const ctx=vm.createContext({prisma,NextResponse:Response,Buffer,TextEncoder,URL,Date,console,createHash:crypto.createHash,randomUUID:crypto.randomUUID,requireStaff:async()=>null,requireAdmin:async()=>null,getSessionUser:async()=>({id:999,role:'ADMIN'}),createSession:async()=>{},bcrypt:require('bcryptjs'),ORDER_LIMITS:{perMenu:10,perSubmission:30,perSession:100,perMinute:5},...extra});vm.runInContext(source(p),ctx);return ctx;}
const request=body=>({json:async()=>body});const params=id=>({params:Promise.resolve({id:String(id)})});
(async()=>{
 let passed=0;const ok=label=>{passed++;console.log('PASS '+label);};
 const rollback=new Error('ROLLBACK_TRIAL_TEST');
 try{await db.$transaction(async tx=>{
  const prisma={...tx,$transaction:fn=>fn(tx),$queryRaw:tx.$queryRaw.bind(tx)};
  const table=load('src/lib/table-session.js',prisma);
  const transactions=load('src/app/api/transaction/route.js',prisma,{normalizeTable:table.normalizeTable,tableConflict:table.tableConflict});
  const order=load('src/app/api/order/route.js',prisma);
  const edit=load('src/app/api/transaction/[id]/edit-order/route.js',prisma);
  const payment=load('src/app/api/transaction/[id]/route.js',prisma,{normalizeTable:table.normalizeTable,tableConflict:table.tableConflict});
  const kitchen=load('src/app/api/kitchen/[id]/route.js',prisma);
  const menu=await tx.menuItem.create({data:{name:'__ROLLBACK_TRIAL__',price:20000}});
  const tableName='TRIAL-'+crypto.randomUUID();
  const created=await transactions.POST(request({tableNumber:tableName}));assert.equal(created.status,200);const session=await created.json();
  assert.equal((await transactions.POST(request({tableNumber:' '+tableName.toLowerCase()+' '}))).status,409);ok('normalized occupied table rejects duplicate');
  const body={transactionId:session.id,requestId:crypto.randomUUID(),items:[{menuItemId:menu.id,quantity:1}],isTakeaway:true};
  const first=await order.POST(request(body));assert.equal(first.status,200);const original=await first.json();assert.equal((await order.POST(request(body))).status,200);assert.equal(await tx.order.count({where:{transactionId:session.id}}),1);ok('durable receipt replays only once');
  const accept=await kitchen.PUT(request({expectedStatus:'queued',expectedVersion:0,status:'accepted'}),params(original.id));assert.equal(accept.status,200);ok('kitchen acknowledges saved order');
  await tx.menuItem.update({where:{id:menu.id},data:{price:30000}});
  assert.equal((await order.POST(request({...body,requestId:crypto.randomUUID(),isTakeaway:false}))).status,200);
  const stalePayment={status:'completed',paymentMethod:'CASH',expectedTotal:20000,expectedRevision:1,paymentRequestId:crypto.randomUUID()};
  assert.equal((await payment.PUT(request(stalePayment),params(session.id))).status,409);ok('payment rejects stale bill');
  const rows=await tx.order.findMany({where:{transactionId:session.id},include:{items:true},orderBy:{id:'asc'}});
  const items=rows.flatMap(o=>o.items.map(i=>({itemId:i.id,menuItemId:i.menuItemId,quantity:i.quantity,price:1})));
  assert.equal((await edit.PUT(request({expectedRevision:2,items}),params(session.id))).status,200);
  let saved=await tx.transaction.findUnique({where:{id:session.id},include:{orders:{include:{items:true}}}});
  assert.equal(saved.total,50000);assert.equal(saved.orders.length,2);assert.equal(saved.orders.find(o=>o.id===original.id).isTakeaway,true);assert.equal(saved.orders.find(o=>o.id===original.id).items[0].price,20000);ok('edit preserves historical prices and takeaway identity');
  assert.equal((await edit.PUT(request({expectedRevision:2,items:[]}),params(session.id))).status,409);ok('stale edit cannot remove current items');
  items[0].quantity=2;assert.equal((await edit.PUT(request({expectedRevision:3,items}),params(session.id))).status,200);
  assert.equal((await kitchen.PUT(request({expectedStatus:'accepted',expectedVersion:1,status:'preparing'}),params(original.id))).status,409);ok('kitchen cannot acknowledge a stale version after edit');
  saved=await tx.transaction.findUnique({where:{id:session.id}});
  const pay={status:'completed',paymentMethod:'CASH',expectedTotal:saved.total,expectedRevision:saved.revision,paymentRequestId:crypto.randomUUID()};
  assert.equal((await payment.PUT(request(pay),params(session.id))).status,200);assert.equal((await payment.PUT(request(pay),params(session.id))).status,200);
  const paid=await tx.transaction.findUnique({where:{id:session.id}});assert.equal(paid.paidTotal,70000);assert.equal(paid.paidById,999);ok('payment records confirmed amount and idempotent retry');
  assert.equal((await order.POST(request({...body,requestId:crypto.randomUUID()}))).status,409);
  assert.equal((await transactions.POST(request({tableNumber:tableName}))).status,200);assert.equal((await order.POST(request({...body,requestId:crypto.randomUUID()}))).status,409);ok('old browser cannot use a closed or reused table session');
  const policy=load('src/lib/account-policy.js',prisma);
  const accounts=load('src/app/api/users/route.js',prisma,{accountData:policy.accountData});
  const username='trial_'+crypto.randomBytes(6).toString('hex');
  let res=await accounts.POST(request({username,name:'Trial Admin',role:'ADMIN',password:'Trial-Strong-932!'}));assert.equal(res.status,201);const user=await res.json();assert.equal(user.role,'ADMIN');assert.equal(user.password,undefined);
  const stored=await tx.user.findUnique({where:{id:user.id}});assert.ok(await require('bcryptjs').compare('Trial-Strong-932!',stored.password));ok('new admin account stores hash and safe response');
  const throttle=load('src/lib/login-throttle.js',prisma);
  for(let i=0;i<10;i++)assert.equal(await throttle.allowLogin(username),true);assert.equal(await throttle.allowLogin(username),false);await throttle.clearLoginAttempts(username);assert.equal(await throttle.allowLogin(username),true);ok('database login throttle enforces limit and resets after success');
  throw rollback;
 },{timeout:60000,maxWait:10000});}catch(e){if(e!==rollback)throw e;}
 console.log(passed+' PostgreSQL checks passed; test business data rolled back.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
