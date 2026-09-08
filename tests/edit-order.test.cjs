const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/app/api/transaction/[id]/edit-order/route.js'), 'utf8')
  .replace(/^\uFEFF/, '').replace(/^import .*;\r?\n/gm, '').replace('export async function PUT', 'async function PUT');
const items = [{ menuItemId: 1, quantity: 3, price: 10000 }];

function setup(status = 'ordered', failCreate = false) {
  let state = { session: { id: 'A', status, completedAt: status === 'completed' ? 'closed' : null, total: 10000 },
    orders: [{ id: 1, transactionId: 'A', total: 10000, items: { create: [{ menuItemId: 1, quantity: 1, price: 10000 }] } }] };
  let nextOrderId = 2;
  let tail = Promise.resolve();
  const prisma = { $transaction: async callback => {
    // Emulate the DB session row lock, acquired by updateMany, not callback entry.
    let unlock, draft;
    const requireLock = () => assert.ok(draft, 'Must lock session before touching orders');
    try {
      const result = await callback({
        transaction: {
          async updateMany({ where, data }) {
            const previous = tail;
            tail = new Promise(resolve => { unlock = resolve; });
            await previous;
            draft = structuredClone(state);
            const s = draft.session;
            if (where.id !== s.id || !where.status.in.includes(s.status) || s.completedAt !== where.completedAt) return { count: 0 };
            s.total += data.total.increment;
            return { count: 1 };
          },
          async update({ data }) { requireLock(); Object.assign(draft.session, data); return draft.session; }
        },
        orderItem: { async deleteMany() { requireLock(); } },
        order: {
          async findMany() { requireLock(); return draft.orders.map(o => ({ id: o.id })); },
          async deleteMany() { requireLock(); draft.orders = []; },
          async create({ data }) {
            requireLock();
            await new Promise(resolve => setImmediate(resolve));
            if (failCreate) throw new Error('Simulated write failure');
            draft.orders.push({ id: nextOrderId++, ...data });
            return data;
          }
        }
      });
      state = draft;
      return result;
    } finally { if (unlock) unlock(); }
  } };
  const context = vm.createContext({ prisma, requireStaff: async () => null, NextResponse: { json: (body, opts = {}) => ({ body, status: opts.status || 200 }) }, console: { error() {} } });
  vm.runInContext(source, context);
  return { send: (value = items, expectedOrderIds = [1]) => context.PUT({ json: async () => ({ items: value, expectedOrderIds }) }, { params: Promise.resolve({ id: 'A' }) }), state: () => state };
}

test('20 overlapping identical saves leave one order and matching total', async () => {
  const app = setup();
  const responses = await Promise.all(Array.from({ length: 20 }, () => app.send()));
  assert.equal(responses.filter(r => r.status === 200).length, 1);
  assert.equal(responses.filter(r => r.status === 409 && r.body.code === 'ORDER_CONFLICT').length, 19);
  assert.equal(app.state().orders.length, 1);
  assert.equal(app.state().session.total, 30000);
  assert.equal(app.state().orders[0].items.create[0].quantity, 3);
});
test('overlapping different saves keep order total consistent with items', async () => {
  const app = setup();
  await Promise.all([app.send(), app.send([{ menuItemId: 1, quantity: 5, price: 10000 }])]);
  const state = app.state();
  assert.equal(state.orders.length, 1);
  assert.equal(state.session.total, state.orders[0].items.create.reduce((sum, i) => sum + i.price * i.quantity, 0));
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
  assert.equal(app.state().orders.length, 0);
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
  app.state().orders.push({ id: 2, transactionId: 'A', total: 10000, items: { create: [{ menuItemId: 2, quantity: 1, price: 10000 }] } });
  app.state().session.total = 20000;
  const before = structuredClone(app.state());
  const response = await app.send(items, [1]);
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'ORDER_CONFLICT');
  assert.deepEqual(app.state(), before);
});
test('stale edit cannot clear newly received items', async () => {
  const app = setup();
  const before = structuredClone(app.state());
  assert.equal((await app.send([], [])).status, 409);
  assert.deepEqual(app.state(), before);
});
test('refreshing snapshot permits deliberate edits after conflict', async () => {
  const app = setup();
  assert.equal((await app.send()).status, 200);
  assert.equal((await app.send()).status, 409);
  assert.equal((await app.send(items, app.state().orders.map(o => o.id))).status, 200);
});
test('old client without order snapshot cannot overwrite orders', async () => {
  const app = setup();
  const before = structuredClone(app.state());
  assert.equal((await app.send(items, null)).status, 409);
  assert.deepEqual(app.state(), before);
});
