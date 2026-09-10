const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/app/api/transaction/[id]/edit-order/route.js'), 'utf8')
  .replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, '').replace('export async function PUT', 'async function PUT');
const items = [{ itemId: 1, menuItemId: 1, quantity: 3, price: 1 }];
function setup(status = 'ordered', failWrite = false) {
 let state={session:{id:'A',status,revision:0,completedAt:status==='completed'?'closed':null,total:10000},orders:[{id:1,transactionId:'A',total:10000,isTakeaway:true,kitchenStatus:'accepted',kitchenVersion:1,createdAt:'original-time',items:[{id:1,menuItemId:1,quantity:1,price:10000}]}]};
 let tail=Promise.resolve(),nextOrderId=2;
 const prisma={$transaction:async callback=>{
  let draft,unlock;
  const locked=()=>assert.ok(draft,'Session lock required before touching orders');
  const item=(id)=>draft.orders.flatMap(o=>o.items).find(i=>i.id===id);
  try {const result=await callback({
   transaction:{
    async updateMany({where}){const previous=tail;tail=new Promise(resolve=>{unlock=resolve;});await previous;draft=structuredClone(state);return {count:where.id===draft.session.id&&where.status.in.includes(draft.session.status)&&draft.session.completedAt===where.completedAt?1:0};},
    async findUnique(){locked();return draft.session;},
    async update({data}){locked();const {revision,...rest}=data;Object.assign(draft.session,rest);draft.session.revision+=revision.increment;return draft.session;}
   },
   menuItem:{async findMany(){locked();return [{id:1,price:30000,isAvailable:true}];}},
   orderItem:{async delete({where}){locked();if(failWrite)throw Error('Simulated failure');for(const o of draft.orders)o.items=o.items.filter(i=>i.id!==where.id);},async update({where,data}){locked();if(failWrite)throw Error('Simulated failure');Object.assign(item(where.id),data);}},
   order:{async findMany(){locked();return structuredClone(draft.orders);},async update({where,data}){locked();const target=draft.orders.find(o=>o.id===where.id);const {kitchenVersion,...rest}=data;Object.assign(target,rest);target.kitchenVersion+=kitchenVersion.increment;return target;},async create({data}){locked();if(failWrite)throw Error('Simulated failure');const order={id:nextOrderId++,...data,items:data.items.create.map((i,index)=>({...i,id:nextOrderId*100+index}))};draft.orders.push(order);return order;}}
  });state=draft;return result;}finally{unlock?.();}
 }};
 const context=vm.createContext({prisma,requireStaff:async()=>null,NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})},console:{error(){}}});vm.runInContext(source,context);
 return {send:(value=items,expectedRevision=0)=>context.PUT({json:async()=>({items:value,expectedRevision})},{params:Promise.resolve({id:'A'})}),state:()=>state};
}

test('20 overlapping identical saves leave one order and matching total', async () => {
  const app = setup();
  const responses = await Promise.all(Array.from({ length: 20 }, () => app.send()));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409 && r.body.code === 'ORDER_CONFLICT').length, 19);
  assert.equal(app.state().orders.length, 1);
  assert.equal(app.state().session.total, 30000);
  assert.equal(app.state().orders[0].items[0].quantity, 3);
});
test('overlapping different saves keep order total consistent with items', async () => {
  const app = setup();
  await Promise.all([app.send(), app.send([{ itemId: 1, menuItemId: 1, quantity: 5, price: 10000 }])]);
  const state = app.state();
  assert.equal(state.orders.length, 1);
  assert.equal(state.session.total, state.orders[0].items.reduce((sum, i) => sum + i.price * i.quantity, 0));
});
test('failed replacement preserves original order and total', async () => {
  const app = setup('ordered', true);
  const before = structuredClone(app.state());
  assert.equal((await app.send()).status, 500);
  assert.deepEqual(app.state(), before);
});
for (const status of ['completed', 'cancelled']) test(`edit cannot reopen ${status} session`, async () => {
  const app = setup(status);
  const before = structuredClone(app.state());
  assert.equal((await app.send()).status, 409);
  assert.deepEqual(app.state(), before);
});
test('empty replacement removes items and resets total', async () => {
  const app = setup();
  assert.equal((await app.send([])).status, 200);
  assert.equal(app.state().session.total, 0);
  assert.equal(app.state().session.status, 'open');
  assert.equal(app.state().orders[0].items.length, 0);
  assert.equal(app.state().orders[0].kitchenStatus, 'cancelled');
});
test('invalid quantity rejected without changes', async () => {
  const app = setup();
  const before = structuredClone(app.state());
  assert.equal((await app.send([{ menuItemId: 1, quantity: -1, price: 10000 }])).status, 400);
  assert.deepEqual(app.state(), before);
});

test('rapid clicks issue one save, and saving lock releases after failure', async () => {
  const dashboard = fs.readFileSync(path.join(__dirname, '../src/app/page.js'), 'utf8');
  const start = dashboard.indexOf('  const handleSaveEditOrder = async () => {');
  const end = dashboard.indexOf('  // Image Upload handler', start);
  let requests = 0, release;
  const context = vm.createContext({
    editOrderSavingRef: { current: false }, editingTransaction: { id: 'A' },
    editingOrderItems: [{ menuItem: { id: 1 }, quantity: 3, price: 10000 }],
    setSavingEditOrder() {}, setShowEditOrderModal() {}, activeTab: 'transactions',
    fetchTransactions: async () => {}, fetchArchive: async () => {},
    alert() {}, console: { error() {} },
    fetch: async () => { requests++; return new Promise(resolve => { release = resolve; }); }
  });
  vm.runInContext(dashboard.slice(start, end) + '\nglobalThis.save = handleSaveEditOrder;', context);
  const first = context.save();
  await Promise.all(Array.from({ length: 20 }, () => context.save()));
  assert.equal(requests, 1);
  release({ ok: false, json: async () => ({ error: 'Failed' }) });
  await first;
  assert.equal(context.editOrderSavingRef.current, false);
  const retry = context.save();
  assert.equal(requests, 2);
  release({ ok: true });
  await retry;
  assert.equal(context.editOrderSavingRef.current, false);
});


test('stale edit preserves a customer order received after modal opened', async () => {
  const app = setup();
  app.state().orders.push({ id: 2, transactionId: 'A', total: 10000, items: [{ id: 2, menuItemId: 2, quantity: 1, price: 10000 }] });
  app.state().session.total = 20000;
  app.state().session.revision = 1;
  const before = structuredClone(app.state());
  const response = await app.send(items, 0);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'ORDER_CONFLICT');
  assert.deepEqual(app.state(), before);
});
test('stale edit cannot clear newly received items', async () => {
  const app = setup();
  const before = structuredClone(app.state());
  assert.equal((await app.send([], -1)).status, 409);
  assert.deepEqual(app.state(), before);
});
test('refreshing snapshot permits deliberate edits after conflict', async () => {
  const app = setup();
  assert.equal((await app.send()).status, 200);
  assert.equal((await app.send()).status, 409);
  assert.equal((await app.send(items, app.state().session.revision)).status, 200);
});
test('old client without order snapshot cannot overwrite orders', async () => {
  const app = setup();
  const before = structuredClone(app.state());
  assert.equal((await app.send(items, null)).status, 409);
  assert.deepEqual(app.state(), before);
});

test('editing preserves historical price, takeaway, order ID and time',async()=>{const app=setup();assert.equal((await app.send()).status,200);const o=app.state().orders[0];assert.equal(o.id,1);assert.equal(o.isTakeaway,true);assert.equal(o.createdAt,'original-time');assert.equal(o.items[0].price,10000);assert.equal(o.total,30000);assert.equal(o.kitchenStatus,'queued');assert.equal(o.kitchenVersion,2);});
test('same menu at different historical prices stays separate',async()=>{const app=setup();app.state().orders.push({id:2,total:30000,transactionId:'A',isTakeaway:false,kitchenStatus:'queued',kitchenVersion:0,items:[{id:2,menuItemId:1,quantity:1,price:30000}]});app.state().session.total=40000;assert.equal((await app.send([{itemId:1,menuItemId:1,quantity:1},{itemId:2,menuItemId:1,quantity:1}])).status,200);assert.equal(app.state().session.total,40000);assert.equal(app.state().orders.length,2);});
test('new menu ignores browser price and uses current database price',async()=>{const app=setup();assert.equal((await app.send([...items,{menuItemId:1,quantity:1,price:1,isTakeaway:false}])).status,200);assert.equal(app.state().session.total,60000);assert.equal(app.state().orders[1].items[0].price,30000);assert.equal(app.state().orders[1].isTakeaway,false);});
