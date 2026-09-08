const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/order-api.cjs');

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

for (const price of [1, 0, -1000, 999999, undefined]) test('uses database price instead of browser price ' + price, async () => {
  const app = setup([{ id: 'old', status: 'open', completedAt: null, total: 0 }]);
  const response = await app.send('old', [{ menuItemId: 1, quantity: 2, price }]);
  assert.equal(response.status, 200);
  assert.equal(app.state().sessions[0].total, 20000);
  assert.equal(app.state().orders[0].items.create[0].price, 10000);
});
for (const quantity of [0, -1, 1.5, '2', null, 2147483648]) test('rejects invalid quantity ' + quantity, async () => {
  const app = setup([{ id: 'old', status: 'open', completedAt: null, total: 0 }]);
  const before = structuredClone(app.state());
  assert.equal((await app.send('old', [{ menuItemId: 1, quantity }])).status, 400);
  assert.deepEqual(app.state(), before);
});
for (const menu of [[], [{ id: 1, price: 10000, isAvailable: false }]]) test('missing or unavailable menu rejected without writes', async () => {
  const app = setup([{ id: 'old', status: 'open', completedAt: null, total: 0 }], false, menu);
  const before = structuredClone(app.state());
  const response = await app.send();
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'MENU_UNAVAILABLE');
  assert.deepEqual(app.state(), before);
});
test('one unavailable item rejects entire cart', async () => {
  const app = setup([{ id: 'old', status: 'open', completedAt: null, total: 0 }]);
  const before = structuredClone(app.state());
  assert.equal((await app.send('old', [{ menuItemId: 1, quantity: 1 }, { menuItemId: 2, quantity: 1 }])).status, 409);
  assert.deepEqual(app.state(), before);
});
test('overflowing total rejected before database writes', async () => {
  const app = setup([{ id: 'old', status: 'open', completedAt: null, total: 0 }]);
  const before = structuredClone(app.state());
  assert.equal((await app.send('old', [{ menuItemId: 1, quantity: 2147483647 }])).status, 400);
  assert.deepEqual(app.state(), before);
});
