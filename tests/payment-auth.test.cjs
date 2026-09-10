const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
function source(path){return fs.readFileSync(path,'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export async function/g,'async function');}
function setup(){
 let token, writes=0;
 let transaction={id:'TEST',status:'ordered',total:30000,revision:1};
 let user={id:1,username:'test',role:'KASIR',password:'test-password-hash'};
 const env={SESSION_SECRET:'test-only-secret-that-is-at-least-32-characters',NODE_ENV:'production'};
 const jar={get:()=>token?{value:token}:undefined,set:value=>{token=value.value;jar.options=value;},delete:()=>{token=undefined;}};
 const ctx=vm.createContext({Buffer,URL,Date,process:{env},createHmac:crypto.createHmac,timingSafeEqual:crypto.timingSafeEqual,
 cookies:async()=>jar,NextResponse:Response,console,
 prisma:{user:{findUnique:async({where})=>user&&where.id===user.id?user:null},transaction:{update:async({data})=>{writes++;return data;}}}});
 ctx.prisma.$transaction=async callback=>callback({transaction:{updateMany:async()=>({count:1}),findUnique:async()=>transaction,update:async({data})=>{writes++;const {revision,...rest}=data;Object.assign(transaction,rest);transaction.revision+=revision?.increment||0;return transaction;}}});
 ctx.bcrypt=require('bcryptjs');ctx.allowLogin=async()=>true;ctx.clearLoginAttempts=async()=>{};ctx.prisma.user.update=async({data})=>Object.assign(user,data);
 vm.runInContext(source('src/lib/session.js'),ctx);
 return {ctx,jar,user,env,token:()=>token,setToken:v=>token=v,setUser:v=>user=v,writes:()=>writes,
 transaction:()=>transaction,
 pay:async(body={status:'completed',paymentMethod:'CASH',expectedTotal:30000,expectedRevision:1,paymentRequestId:'payment-test-00001'},origin='http://localhost:3000')=>{
 vm.runInContext(source('src/app/api/transaction/[id]/route.js'),ctx);
 return ctx.PUT(new Request('http://localhost:3000/api/transaction/TEST',{method:'PUT',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}),{params:Promise.resolve({id:'TEST'})});
 }};
}
test('payment without login returns 401 without changing database',async()=>{const a=setup();assert.equal((await a.pay()).status,401);assert.equal(a.writes(),0);});
test('old fabricated ADMIN cookie rejected',async()=>{const a=setup();a.setToken(JSON.stringify({id:1,role:'ADMIN'}));assert.equal((await a.pay()).status,401);assert.equal(a.writes(),0);});
test('valid cashier session can record payment',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal((await a.pay()).status,200);assert.equal(a.writes(),1);});
test('valid admin session can record payment',async()=>{const a=setup();a.user.role='ADMIN';await a.ctx.createSession(a.user);assert.equal((await a.pay()).status,200);});
test('signed cookie is HttpOnly, Secure in production, SameSite Lax',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal(a.jar.options.httpOnly,true);assert.equal(a.jar.options.secure,true);assert.equal(a.jar.options.sameSite,'lax');assert.ok(!a.token().includes('ADMIN'));});
test('altered session payload rejected',async()=>{const a=setup();await a.ctx.createSession(a.user);const [payload,sig]=a.token().split('.');const claims=JSON.parse(Buffer.from(payload,'base64url'));claims.exp-=10;a.setToken(Buffer.from(JSON.stringify(claims)).toString('base64url')+'.'+sig);assert.equal((await a.pay()).status,401);assert.equal(a.writes(),0);});
test('altered signature rejected',async()=>{const a=setup();await a.ctx.createSession(a.user);const [p]=a.token().split('.');a.setToken(p+'.'+Buffer.alloc(32).toString('base64url'));assert.equal((await a.pay()).status,401);});
test('expired signed session rejected',async()=>{const a=setup();const p=Buffer.from(JSON.stringify({id:1,exp:Math.floor(Date.now()/1000)-1})).toString('base64url');const sig=crypto.createHmac('sha256',a.env.SESSION_SECRET).update(p).update('\0').update(a.user.password).digest('base64url');a.setToken(p+'.'+sig);assert.equal((await a.pay()).status,401);});
test('deleted user session rejected',async()=>{const a=setup();await a.ctx.createSession(a.user);a.setUser(null);assert.equal((await a.pay()).status,401);});
test('password change invalidates existing session',async()=>{const a=setup();await a.ctx.createSession(a.user);a.user.password='changed-password-hash';assert.equal((await a.pay()).status,401);});
test('role is reloaded from database and nonstaff is denied',async()=>{const a=setup();await a.ctx.createSession(a.user);a.user.role='CUSTOMER';assert.equal((await a.pay()).status,403);assert.equal(a.writes(),0);});
test('cross-origin payment denied',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal((await a.pay(undefined,'https://other.example')).status,403);assert.equal(a.writes(),0);});
test('invalid payment method rejected',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal((await a.pay({status:'completed',paymentMethod:'FAKE'})).status,400);assert.equal(a.writes(),0);});
test('API does not permit reopening via arbitrary status',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal((await a.pay({status:'ordered'})).status,400);});
test('auth/me rejects forged cookie and accepts signed session without exposing password',async()=>{const a=setup();vm.runInContext(source('src/app/api/auth/me/route.js'),a.ctx);a.setToken('{"id":1,"role":"ADMIN"}');assert.equal((await a.ctx.GET()).status,401);await a.ctx.createSession(a.user);const res=await a.ctx.GET();assert.equal(res.status,200);assert.equal((await res.json()).user.password,undefined);await a.ctx.DELETE();assert.equal((await a.ctx.GET()).status,401);});
test('forged ADMIN cannot create an account or change another password',async()=>{for(const [path,method]of [['src/app/api/users/route.js','POST'],['src/app/api/users/[id]/route.js','PUT'],['src/app/api/users/change-password/route.js','PUT']]){const a=setup();a.setToken('{"id":1,"role":"ADMIN"}');vm.runInContext(source(path),a.ctx);const res=await a.ctx[method]({}, {params:Promise.resolve({id:'1'})});assert.ok([401,403].includes(res.status));}});
test('all guarded staff endpoints reject missing login before processing input',async()=>{
for(const [path,methods]of [
 ['src/app/api/transaction/route.js',['GET','POST']],['src/app/api/transaction/[id]/route.js',['PUT','DELETE']],
 ['src/app/api/transaction/[id]/edit-order/route.js',['PUT']],['src/app/api/menu/route.js',['POST']],
 ['src/app/api/menu/[id]/route.js',['PUT','DELETE']],['src/app/api/categories/route.js',['POST','PUT','DELETE']]
]){const a=setup();vm.runInContext(source(path),a.ctx);for(const method of methods)assert.equal((await a.ctx[method]({}, {params:Promise.resolve({id:'TEST'})})).status,401,path+' '+method);}
});
test('real login handler checks password before issuing signed cookie',async()=>{
 const a=setup();a.ctx.require=require;
 a.ctx.prisma.user.findUnique=async()=>a.user;
 vm.runInContext(source('src/app/api/auth/login/route.js'),a.ctx);
 const bad=await a.ctx.POST({json:async()=>({username:'test',password:'incorrect'})});
 assert.equal(bad.status,401);assert.equal(a.token(),undefined);
 const good=await a.ctx.POST({json:async()=>({username:'test',password:a.user.password})});
 assert.equal(good.status,200);assert.ok(a.token().includes('.'));
 assert.equal((await good.json()).password,undefined);
 assert.equal((await a.ctx.getSessionUser()).role,'KASIR');
});
test('missing server signing secret cannot issue session',async()=>{const a=setup();delete a.env.SESSION_SECRET;await assert.rejects(a.ctx.createSession(a.user));assert.equal(a.token(),undefined);});
test('payment UI keeps modal open and redirects to login after 401',async()=>{
 const page=fs.readFileSync('src/app/page.js','utf8');
 const start=page.indexOf('  const confirmCompleteTransaction = async () => {');
 const end=page.indexOf('  const handleChangeTableNumber',start);
 let closed=false,busy=false,redirect;
 const ctx=vm.createContext({paymentBusyRef:{current:false},paymentRequestRef:{current:'payment-test-00001'},paymentTransaction:{id:'test'},selectedPaymentMethod:'CASH',
 setSubmittingPayment:v=>busy=v,setShowPaymentModal:v=>closed=!v,setPaymentTransaction(){},
 fetch:async()=>({ok:false,status:401,json:async()=>({error:'Login required'})}),
 alert(){},router:{push:v=>redirect=v},console});
 vm.runInContext(page.slice(start,end)+'\nglobalThis.pay = confirmCompleteTransaction;',ctx);
 await ctx.pay();assert.equal(closed,false);assert.equal(busy,false);assert.equal(redirect,'/login');
});

test('stale payment cannot close a session after a new order',async()=>{const a=setup();await a.ctx.createSession(a.user);a.transaction().total=40000;a.transaction().revision=2;const res=await a.pay();assert.equal(res.status,409);assert.equal((await res.json()).code,'PAYMENT_CONFLICT');assert.equal(a.writes(),0);assert.equal(a.transaction().status,'ordered');});
test('same total with changed revision also requires reconfirmation',async()=>{const a=setup();await a.ctx.createSession(a.user);a.transaction().revision=2;assert.equal((await a.pay()).status,409);assert.equal(a.writes(),0);});
test('payment retries with same identity only record once',async()=>{const a=setup();await a.ctx.createSession(a.user);assert.equal((await a.pay()).status,200);assert.equal((await a.pay()).status,200);assert.equal(a.writes(),1);assert.equal(a.transaction().paidTotal,30000);assert.equal(a.transaction().paidById,1);});
test('closed payment cannot be overwritten by a new payment request',async()=>{const a=setup();await a.ctx.createSession(a.user);await a.pay();const res=await a.pay({status:'completed',paymentMethod:'QRIS',expectedTotal:30000,expectedRevision:1,paymentRequestId:'payment-test-00002'});assert.equal(res.status,409);assert.equal(a.transaction().paymentMethod,'CASH');});
test('default-password account cannot mutate restaurant data',async()=>{const a=setup();a.user.mustChangePassword=true;await a.ctx.createSession(a.user);const res=await a.pay();assert.equal(res.status,403);assert.equal((await res.json()).code,'PASSWORD_CHANGE_REQUIRED');assert.equal(a.writes(),0);});
