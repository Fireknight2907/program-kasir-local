const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/app/api/order/route.js'), 'utf8')
  .replace(/^\uFEFF/, '')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export async function POST', 'async function POST');

// In-memory transaction adapter: no connection to the restaurant database.
function setup(sessions, failOrder = false) {
  let state = { sessions: structuredClone(sessions), orders: [] };
  const prisma = {
    async $transaction(callback) {
      const draft = structuredClone(state);
      const result = await callback({
        transaction: {
          async updateMany({ where, data }) {
            const session = draft.sessions.find(s => s.id === where.id &&
              where.status.in.includes(s.status) && s.completedAt === where.completedAt);
            if (!session) return { count: 0 };
            session.total += data.total.increment;
            session.status = data.status;
            return { count: 1 };
          }
        },
        order: {
          async create({ data }) {
            if (failOrder) throw new Error('Simulated item persistence failure');
            const order = { id: draft.orders.length + 1, ...data };
            draft.orders.push(order);
            return order;
          }
        }
      });
      state = draft;
      return result;
    }
  };
  const context = vm.createContext({ prisma, NextResponse: {
    json: (body, options = {}) => ({ status: options.status || 200, body })
  }, console: { error() {} } });
  vm.runInContext(source, context);
  return {
    send: (transactionId = 'old') => context.POST({ json: async () => ({
      transactionId, items: [{ menuItemId: 1, quantity: 2, price: 10000 }]
    }) }),
    state: () => state
  };
}

for (const status of ['completed', 'cancelled']) {
  test(`stale customer page cannot order into ${status} session or affect reused table`, async () => {
    const sessions = [
      { id: 'old', tableNumber: '5', status, completedAt: status === 'completed' ? '2026-09-08' : null, total: 50000 },
      { id: 'new', tableNumber: '5', status: 'open', completedAt: null, total: 0 }
    ];
    const app = setup(sessions);
    const response = await app.send();
    assert.equal(response.status, 409);
    assert.equal(response.body.code, 'SESSION_CLOSED');
    assert.deepEqual(app.state(), { sessions, orders: [] });
    assert.equal((await app.send('new')).status, 200);
    assert.equal(app.state().sessions[1].total, 20000);
    assert.equal(app.state().sessions[0].status, status);
  });
}
for (const status of ['open', 'ordered']) {
  test(`accepts order for ${status} session`, async () => {
    const app = setup([{ id: 'old', status, completedAt: null, total: 10000 }]);
    assert.equal((await app.send()).status, 200);
    assert.equal(app.state().sessions[0].total, 30000);
    assert.equal(app.state().sessions[0].status, 'ordered');
    assert.equal(app.state().orders.length, 1);
  });
}
test('deleted session rejects order', async () => {
  const app = setup([]);
  assert.equal((await app.send()).status, 409);
  assert.equal(app.state().orders.length, 0);
});
test('failed item save rolls back session total and status', async () => {
  const sessions = [{ id: 'old', status: 'open', completedAt: null, total: 0 }];
  const app = setup(sessions, true);
  assert.equal((await app.send()).status, 500);
  assert.deepEqual(app.state(), { sessions, orders: [] });
});
