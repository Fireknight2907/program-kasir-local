// Skenario: 2 submission terpisah (bukan race/concurrent), requestId SAMA PERSIS,
// meja sama, menu sama, quantity sama. Menjawab: apakah sistem membuat 2 order,
// dan apakah tercatat 1 atau 2 pesanan (OrderSubmission) di DB.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers/order-api.cjs');

const session = () => [{ id: 'meja-7', status: 'open', total: 0, completedAt: null }];
const sameRequestId = 'duplicate-request-id-0001';
const cart = [{ menuItemId: 1, quantity: 3 }];

test('2 submission berurutan dengan requestId identik: order kedua tidak dibuat, submission pertama dikembalikan', async () => {
  const app = setup(session());

  const first = await app.send('meja-7', cart, sameRequestId);
  const second = await app.send('meja-7', cart, sameRequestId);

  // Kedua respons sukses dan BERISI order YANG SAMA (id sama), bukan 2 order berbeda.
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual(second.body, first.body);
  assert.equal(second.body.id, first.body.id);

  // Hanya 1 order yang benar-benar tercatat di tabel Order.
  assert.equal(app.state().orders.length, 1);
  // Hanya 1 catatan OrderSubmission (receipt) walau ada 2 kali pengiriman.
  assert.equal(app.state().receipts.length, 1);
  // Tagihan meja hanya bertambah sekali (3 porsi x harga), bukan dobel.
  assert.equal(app.state().sessions[0].total, 30000);
});
