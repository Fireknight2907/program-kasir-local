const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/order-api.cjs');
const session = () => [{ id:'old', status:'open', total:0, completedAt:null }];
const key = 'fixed-request-key-12345';
const cart = [{ menuItemId:1, quantity:2 }];
test('20 concurrent retries create one order and charge once', async () => {
 const app=setup(session());const replies=await Promise.all(Array.from({length:20},()=>app.send('old',cart,key)));
 assert.ok(replies.every(r=>r.status===200 && r.body.id===replies[0].body.id));
 assert.equal(app.state().orders.length,1);assert.equal(app.state().sessions[0].total,20000);
});
test('same key with changed quantities is rejected without charge', async()=>{
 const app=setup(session());await app.send('old',cart,key);
 assert.equal((await app.send('old',[{menuItemId:1,quantity:3}],key)).status,409);
 assert.equal(app.state().sessions[0].total,20000);
});
test('receipt remains replayable after cashier replaces orders and closes session',async()=>{
 const app=setup(session());const first=await app.send('old',cart,key);
 app.state().orders.splice(0);app.state().sessions[0].status='completed';app.state().sessions[0].completedAt='closed';
 const replay=await app.send('old',cart,key);assert.equal(replay.body.id,first.body.id);assert.equal(app.state().orders.length,0);
 assert.equal(app.state().sessions[0].total,20000);assert.equal((await app.send()).status,409);
});
test('two intentional submissions with distinct IDs remain separate',async()=>{
 const app=setup(session());await app.send();await app.send();assert.equal(app.state().orders.length,2);assert.equal(app.state().sessions[0].total,40000);
});
test('1000 portions and split duplicate rows cannot bypass per-menu limit',async()=>{
 const app=setup(session());assert.equal((await app.send('old',[{menuItemId:1,quantity:1000}])).status,400);
 assert.equal((await app.send('old',[{menuItemId:1,quantity:6},{menuItemId:1,quantity:5}])).status,400);assert.equal(app.state().orders.length,0);
});
test('30 portions accepted; 31 rejected',async()=>{
 const menu=[1,2,3,4].map(id=>({id,price:100,isAvailable:true}));const app=setup(session(),false,menu);
 const max=[1,2,3].map(menuItemId=>({menuItemId,quantity:10}));assert.equal((await app.send('old',max)).status,200);
 assert.equal((await app.send('old',[...max,{menuItemId:4,quantity:1}])).status,400);
});
test('cumulative session cap cannot be bypassed with fresh IDs or cashier deletion',async()=>{
 const menu=[1,2,3].map(id=>({id,price:100,isAvailable:true}));const app=setup(session(),false,menu);
 const thirty=[1,2,3].map(menuItemId=>({menuItemId,quantity:10}));
 for(let i=0;i<3;i++)assert.equal((await app.send('old',thirty)).status,200);
 assert.equal((await app.send('old',[{menuItemId:1,quantity:10}])).status,200);
 app.state().orders.splice(0);app.ageReceipts();
 const next=await app.send('old',[{menuItemId:1,quantity:1}]);assert.equal(next.body.code,'SESSION_LIMIT');assert.equal(app.state().sessions[0].total,10000);
});
test('rate limit rejects sixth new order but allows retry of first',async()=>{
 const app=setup(session());await app.send('old',cart,key);for(let i=0;i<4;i++)await app.send();
 assert.equal((await app.send()).status,429);assert.equal((await app.send('old',cart,key)).status,200);
 app.ageReceipts();assert.equal((await app.send()).status,200);
});
test('missing key and malformed body rejected before persistence',async()=>{
 const app=setup(session());assert.equal((await app.raw(null)).status,400);assert.equal((await app.raw({transactionId:'old',items:cart})).status,400);assert.equal(app.state().orders.length,0);
});
