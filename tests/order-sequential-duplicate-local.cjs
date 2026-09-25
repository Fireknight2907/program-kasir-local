// Run against a disposable PostgreSQL cluster only. No .env is loaded.
// Skenario (BUKAN race/concurrent): kirim order 1, TUNGGU sampai order itu benar-benar
// tercatat di DB (query langsung, bukan cuma percaya respons HTTP), baru KEMUDIAN kirim
// order 2 dengan requestId, meja, menu, dan quantity SAMA PERSIS. Sistem harus mengembalikan
// order yang sudah tercatat (bukan bikin order baru).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NextResponse } = require('next/server');

const url = process.env.SEQDUP_DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw Error('Requires a disposable local PostgreSQL via SEQDUP_DATABASE_URL (loopback only)');
}

const db = new PrismaClient({ datasources: { db: { url } } });
const root = path.resolve(__dirname, '..');
const routeSource = fs.readFileSync(path.join(root, 'src/app/api/order/route.js'), 'utf8');
const limitsSource = fs.readFileSync(path.join(root, 'src/lib/order-limits.js'), 'utf8');
const errors = [];
const context = vm.createContext({ prisma: db, NextResponse, createHash,
  console: { error: (...args) => errors.push({ code: args[1]?.code || null, message: args[1]?.message || String(args[1]) }) }
});
vm.runInContext(limitsSource.replace(/export /g, '') + '\n' + routeSource
  .replace(/^import .*;\r?\n/gm, '').replace(/export /g, ''), context);

const server = http.createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const response = await context.POST(new Request('http://localhost/api/order', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: Buffer.concat(chunks).toString()
    }));
    res.writeHead(response.status, { 'content-type': 'application/json' });
    res.end(await response.text());
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: error.message })); }
});

const sessionIds = [];
let menu;

async function post(payload) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/order`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000)
  });
  return { status: response.status, body: await response.json() };
}

// Key order from a fresh Prisma object vs. one round-tripped through a stored JSON column can
// differ even when the data is identical, so compare by sorted-key JSON, not raw string equality.
function stableStringify(value) {
  return JSON.stringify(value, (_, v) => (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
}

async function dbState(transactionId) {
  const [orders, receipts, trx] = await Promise.all([
    db.order.findMany({ where: { transactionId }, include: { items: true } }),
    db.orderSubmission.findMany({ where: { transactionId } }),
    db.transaction.findUnique({ where: { id: transactionId } }),
  ]);
  return { orderCount: orders.length, orderIds: orders.map(o => o.id), receiptCount: receipts.length, total: trx.total };
}

(async () => {
  await db.$connect();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  menu = await db.menuItem.create({ data: { name: '__seqdup_' + randomUUID(), price: 10000 } });
  const table = await db.transaction.create({ data: { tableNumber: '__seqdup_' + randomUUID(), status: 'open', total: 0 } });
  sessionIds.push(table.id);

  const requestId = randomUUID();
  const cart = [{ menuItemId: menu.id, quantity: 3 }];

  // 1. Kirim order pertama dan TUNGGU respons (transaksi DB sudah commit begitu response.json
  //    dikembalikan oleh route.js, karena NextResponse.json(result) baru dipanggil setelah
  //    prisma.$transaction selesai — lihat src/app/api/order/route.js).
  const first = await post({ transactionId: table.id, requestId, items: cart });

  // 2. Verifikasi LANGSUNG ke database (bukan cuma percaya body respons) bahwa order pertama
  //    benar-benar tercatat sebelum mengirim order kedua.
  const afterFirst = await dbState(table.id);

  // 3. Baru kirim order kedua, requestId/meja/menu/quantity SAMA PERSIS.
  const second = await post({ transactionId: table.id, requestId, items: cart });
  const afterSecond = await dbState(table.id);

  const result = {
    scenario: 'sequential duplicate requestId (wait for DB persistence before retry)',
    requestId,
    first: { status: first.status, orderId: first.body.id },
    second: { status: second.status, orderId: second.body.id },
    dbAfterFirst: afterFirst,
    dbAfterSecond: afterSecond,
    pass: first.status === 200 && second.status === 200
      && second.body.id === first.body.id
      && stableStringify(second.body) === stableStringify(first.body)
      && afterFirst.orderCount === 1 && afterFirst.receiptCount === 1
      && afterSecond.orderCount === 1 && afterSecond.receiptCount === 1
      && afterSecond.total === 30000
      && errors.length === 0
  };
  console.log(JSON.stringify(result, null, 2));

  fs.writeFileSync(path.join(root, 'tmp/order-sequential-duplicate-results.json'), JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await db.orderSubmission.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.orderItem.deleteMany({ where: { order: { transactionId: { in: sessionIds } } } });
    await db.order.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.transaction.deleteMany({ where: { id: { in: sessionIds } } });
    if (menu) await db.menuItem.delete({ where: { id: menu.id } });
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.$disconnect();
  }
});
