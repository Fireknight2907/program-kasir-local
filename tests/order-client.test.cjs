const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const customer=fs.readFileSync('src/app/order/[transactionId]/page.js','utf8');
const submit=customer.slice(customer.indexOf('  const submitOrder = async () => {'),customer.indexOf('  if (pendingOrder) return'));
function client(store, fetch, pending=null){
 const context=vm.createContext({
  transactionId:'trial',storageKey:'pending-order:trial',cart:{1:{id:1,quantity:2}},isTakeaway:false,
  pendingRef:{current:pending},submittingRef:{current:false},newOrderRequestId:()=> 'new-request-key-12345',
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},fetch,
  setSubmitting(){},setSubmitMessage(){},setPendingOrder(){},setCart(){},setError(){},setOrdered(){},setShowCartModal(){},setTransaction(){}
 });
 vm.runInContext(submit+';globalThis.submit=submitOrder;',context);return context;
}
test('customer reload after lost response reuses persisted exact request',async()=>{
 const store=new Map();let sent;
 const first=client(store,async(url,opts)=>{sent=JSON.parse(opts.body);assert.equal(store.size,1);throw Error('Response lost');});
 await first.submit();assert.equal(first.submittingRef.current,false);assert.equal(store.size,1);
 const saved=JSON.parse(store.get('pending-order:trial'));
 let calls=0;
 const retry=client(store,async(url,opts)=>{if(url==='/api/order'){calls++;assert.deepEqual(JSON.parse(opts.body),sent);return {ok:true,json:async()=>({id:8})};}return {ok:false};},saved);
 await retry.submit();assert.equal(calls,1);assert.equal(store.size,0);assert.equal(retry.pendingRef.current,null);
});
test('customer rapid clicks only send one request',async()=>{
 const store=new Map();let done,calls=0;
 const ctx=client(store,async()=>{calls++;return new Promise(resolve=>{done=resolve});});
 const first=ctx.submit();await Promise.all(Array.from({length:20},()=>ctx.submit()));assert.equal(calls,1);
 done({ok:false,status:500,json:async()=>({})});await first;assert.equal(store.size,1);
});
test('storage failure stops request before network',async()=>{
 const ctx=client(new Map(),async()=>{throw Error('Network must not be called')});let calls=0;ctx.fetch=async()=>{calls++};ctx.localStorage.setItem=()=>{throw Error('Storage blocked')};await ctx.submit();assert.equal(calls,0);
});
test('definite limit rejection clears pending ID without retrying',async()=>{
 const store=new Map();const ctx=client(store,async()=>({ok:false,status:400,json:async()=>({code:'ORDER_LIMIT',error:'Too many portions'})}));
 await ctx.submit();assert.equal(store.size,0);assert.equal(ctx.pendingRef.current,null);
});
const dashboard=fs.readFileSync('src/app/page.js','utf8');
const takeaway=dashboard.slice(dashboard.indexOf('  const handleCreateDirectTakeaway = async (e) => {'),dashboard.indexOf('  const openPaymentModal'));
test('takeaway retry uses saved session and always releases submit guard',async()=>{
 const payload={transactionId:'trial',requestId:'saved-request-key-123',items:[{menuItemId:1,quantity:2}],isTakeaway:true};let saved=JSON.stringify(payload),calls=0;
 const ctx=vm.createContext({takeawaySubmittingRef:{current:false},takeawayCart:{},takeawayCustomerName:'',
  localStorage:{getItem:()=>saved,setItem:(k,v)=>{saved=v},removeItem:()=>{saved=null}},
  setTakeawayError(){},setSubmittingTakeaway(){},setPendingTakeaway(){},setShowDirectTakeawayModal(){},setTakeawayCart(){},fetchTransactions(){},console:{error(){}},
  fetch:async(url,opts)=>{calls++;assert.equal(url,'/api/order');assert.deepEqual(JSON.parse(opts.body),payload);throw Error('Timeout');}
 });
 vm.runInContext(takeaway+';globalThis.submit=handleCreateDirectTakeaway;',ctx);await ctx.submit();await ctx.submit();assert.equal(calls,2);assert.equal(ctx.takeawaySubmittingRef.current,false);assert.ok(saved);
});
