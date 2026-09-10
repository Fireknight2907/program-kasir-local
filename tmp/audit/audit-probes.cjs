const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
const findings=[];
const record=(name,result)=>{findings.push({name,...result});console.log(JSON.stringify({name,...result}));};
const source=p=>fs.readFileSync(p,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export (async )?function/g,'$1function');
const load=(p,prisma,extra={})=>{const ctx=vm.createContext({prisma,NextResponse:Response,console,Buffer,Date,URL,requireStaff:async()=>null,getSessionUser:async()=>({id:99,role:'KASIR'}),...extra});vm.runInContext(source(p),ctx);return ctx;};
const body=x=>({json:async()=>x});const params=id=>({params:Promise.resolve({id:String(id)})});
(async()=>{
 const acl=await db.$queryRaw`SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,has_table_privilege('anon',c.oid,'SELECT') AS anon_select,has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,has_table_privilege('anon',c.oid,'DELETE') AS anon_delete FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('User','Transaction','Order','OrderItem','OrderSubmission','LoginThrottle','MenuItem','Category') ORDER BY c.relname`;
 record('live_database_acl',{tables:acl});
 const policies=await db.$queryRaw`SELECT policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects'`;
 record('live_storage_policies',{policies,serviceKeyConfigured:Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)});
 for(const table of ['User','Transaction','OrderSubmission']){const res=await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/'+table+'?select=id&limit=0',{headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(10000)});record('anonymous_empty_read',{table,status:res.status});}
 const rollback=Error('ROLLBACK_AUDIT_ONLY');
 try{await db.$transaction(async tx=>{
  const prisma={$transaction:fn=>fn(tx),menuItem:tx.menuItem,transaction:tx.transaction};
  const menuRoute=load('src/app/api/menu/route.js',prisma);
  const edit=load('src/app/api/transaction/[id]/edit-order/route.js',prisma);
  const menuRes=await menuRoute.POST(body({name:'__AUDIT_NEGATIVE_PRICE__',price:-10000}));const badMenu=await menuRes.json();
  record('negative_menu_price',{status:menuRes.status,savedPrice:badMenu.price});
  const validMenu=await tx.menuItem.create({data:{name:'__AUDIT_VALID__',price:50000}});
  const session=await tx.transaction.create({data:{tableNumber:'__AUDIT_ROLLBACK__',total:50000,status:'ordered'}});
  const order=await tx.order.create({data:{transactionId:session.id,total:50000,isTakeaway:true,kitchenStatus:'served',kitchenVersion:4,acceptedAt:new Date(),items:{create:[{menuItemId:validMenu.id,quantity:1,price:50000}]}},include:{items:true}});
  const res=await edit.PUT(body({expectedRevision:0,items:[{itemId:order.items[0].id,menuItemId:validMenu.id,quantity:1},{menuItemId:badMenu.id,quantity:1}]}),params(session.id));
  const changed=await tx.transaction.findUnique({where:{id:session.id},include:{orders:true}});
  record('negative_price_edit_reduces_bill',{status:res.status,totalBefore:50000,totalAfter:changed.total,newOrderTotals:changed.orders.map(o=>o.total)});
  const previousRows=await tx.order.findMany({where:{transactionId:session.id},include:{items:true}});
  const items=previousRows.flatMap(o=>o.items.map(i=>({itemId:i.id,menuItemId:i.menuItemId,quantity:i.menuItemId===validMenu.id?2:1})));
  const second=await edit.PUT(body({expectedRevision:1,items}),params(session.id));
  const after=await tx.order.findUnique({where:{id:order.id},include:{items:true}});
  record('served_order_requeued_without_delta',{status:second.status,priorKitchenStatus:'served',priorQuantity:1,newKitchenStatus:after.kitchenStatus,newDisplayedQuantity:after.items[0].quantity,acceptedAt:after.acceptedAt,deltaFieldPresent:Object.keys(after).some(k=>/delta|previousQuantity|fulfilled/i.test(k))});
  throw rollback;
 },{timeout:30000});}catch(e){if(e!==rollback)throw e;}
 record('database_fixture_cleanup',{rolledBack:true});
 const fixture={id:'fixture',tableNumber:'5',status:'completed',total:20000,paymentMethod:'CASH',createdAt:'2026-09-08T15:50:00.000Z',completedAt:'2026-09-08T16:10:00.000Z',orders:[{items:[{quantity:1,price:20000,menuItem:{id:1,name:'Fixture food'}}]}]};
 let capturedQuery;const collection=load('src/app/api/transaction/route.js',{transaction:{findMany:async q=>{capturedQuery=q;const span=q.where.createdAt;return !span||new Date(fixture.createdAt)>=span.gte&&new Date(fixture.createdAt)<=span.lte?[fixture]:[];}}});
 const dateResults=[];
 for(const date of ['2026-09-08','2026-09-09']){const res=await collection.GET(new Request('http://localhost/api/transaction?tab=archive&date='+date));const rows=await res.json();dateResults.push({date,count:rows.length,revenue:rows.reduce((s,r)=>s+r.total,0)});}
 record('midnight_revenue_uses_opening_day',{localOpened:'2026-09-08 23:50 UTC+8',localPaid:'2026-09-09 00:10 UTC+8',results:dateResults});
 const page=fs.readFileSync('src/app/page.js','utf8');const a=page.indexOf('  const calculateDailyRecap ='),b=page.indexOf('  // Export Daily Recap',a);
 const recapctx=vm.createContext({archiveTransactions:[{...fixture,total:50000,orders:[{items:[{quantity:1,price:20000,menuItem:{id:1,name:'Nasi'}},{quantity:1,price:30000,menuItem:{id:1,name:'Nasi'}}]}]}]});vm.runInContext(page.slice(a,b)+'\nglobalThis.recap=calculateDailyRecap();',recapctx);
 record('recap_mixed_price_label',{quantity:recapctx.recap.itemList[0].quantity,displayedUnitPrice:recapctx.recap.itemList[0].unitPrice,revenue:recapctx.recap.totalRevenue});
 const detail=load('src/app/api/transaction/[id]/route.js',{transaction:{findUnique:async()=>({...fixture,paidById:99,paymentRequestId:'fixture-payment-identity'})}});
 const detailRes=await detail.GET({},params('fixture'));const details=await detailRes.json();record('public_transaction_internal_fields',{status:detailRes.status,exposedFields:['paidById','paymentRequestId','paymentMethod'].filter(k=>Object.hasOwn(details,k)),requiresKnownId:true});
 const staffRes=await collection.GET(new Request('http://localhost/api/transaction?tab=archive'));record('cashier_archive_scope',{status:staffRes.status,queryWhere:capturedQuery.where,role:'KASIR',authStub:'requireStaff allowed; route has no admin check'});
 const ta=page.indexOf('  const handleCreateDirectTakeaway ='),tb=page.indexOf('  const openPaymentModal',ta);let creates=0;
 const tc=vm.createContext({takeawaySubmittingRef:{current:false},takeawayCart:{1:{menuItem:{id:1},quantity:1,price:10000}},takeawayCustomerName:'Fixture',localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTakeawayError(){},setSubmittingTakeaway(){},setPendingTakeaway(){},setShowDirectTakeawayModal(){},setTakeawayCart(){},fetchTransactions(){},newOrderRequestId:()=>crypto.randomUUID(),console:{error(){}},fetch:async url=>{if(url==='/api/transaction'){creates++;throw Error('commit succeeded but response lost');}throw Error('unexpected');}});
 vm.runInContext(page.slice(ta,tb)+'\nglobalThis.send=handleCreateDirectTakeaway;',tc);await tc.send();await tc.send();record('takeaway_creation_retry_not_idempotent',{createRequests:creates,pendingSavedBeforeFirstCreate:false,scenario:'response lost after session creation; order not yet submitted'});
 fs.writeFileSync('tmp/audit/evidence.json',JSON.stringify({date:'2026-09-09',findings},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
