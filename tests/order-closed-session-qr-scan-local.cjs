// Run against a disposable PostgreSQL cluster only. No .env is loaded.
// Skenario: order sudah selesai & sesi meja SUDAH DITUTUP (status 'completed'), lalu customer
// scan QR meja itu lagi (GET /api/transaction/[id], tanpa login/cookie staf — persis akses
// customer). Sistem harus:
//   1. Tetap memberi tahu status sesi sudah tertutup (bukan error generik/500).
//   2. Menolak percobaan order BARU ke sesi itu dengan pesan yang menyuruh minta QR baru ke kasir.
// Poin 3 (statis) memverifikasi halaman customer (order/[transactionId]/page.js) memang
// menerjemahkan status tertutup itu menjadi pesan "Transaksi ini sudah selesai... hubungi kasir
// untuk QR Code baru" — bukan simulasi render React sungguhan (repo ini tidak punya
// infrastruktur testing React/browser), jadi ini pemeriksaan sumber, bukan bukti visual.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { NextResponse } = require('next/server');

const url = process.env.QRCLOSED_DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw Error('Requires a disposable local PostgreSQL via QRCLOSED_DATABASE_URL (loopback only)');
}

const db = new PrismaClient({ datasources: { db: { url } } });
const root = path.resolve(__dirname, '..');
const strip = src => src.replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const limitsSource = fs.readFileSync(path.join(root, 'src/lib/order-limits.js'), 'utf8');
const sessionSource = fs.readFileSync(path.join(root, 'src/lib/session.js'), 'utf8');
const orderRouteSource = fs.readFileSync(path.join(root, 'src/app/api/order/route.js'), 'utf8');
const transactionIdRouteSource = fs.readFileSync(path.join(root, 'src/app/api/transaction/[id]/route.js'), 'utf8');
const orderPagePath = path.join(root, 'src/app/order/[transactionId]/page.js');
const orderPageSource = fs.readFileSync(orderPagePath, 'utf8');

const errors = [];
const context = vm.createContext({
  prisma: db, NextResponse, createHash, process,
  // Anonymous customer request: no user_session cookie present at all.
  cookies: async () => ({ get: () => undefined, set: () => {} }),
  console: { error: (...args) => errors.push(args.map(a => a?.message || a).join(' ')) }
});
vm.runInContext(
  [limitsSource, sessionSource, orderRouteSource, transactionIdRouteSource].map(strip).join('\n'),
  context
);

const sessionIds = [];
let menu;

async function scanQr(transactionId) {
  // request object is unused by GET /api/transaction/[id] itself (only `params` matters),
  // mirroring what a plain unauthenticated page load actually sends.
  return context.GET({}, { params: Promise.resolve({ id: transactionId }) })
    .then(async response => ({ status: response.status, body: await response.json() }));
}

async function placeOrder(payload) {
  return context.POST({ json: async () => payload }).then(async response => ({ status: response.status, body: await response.json() }));
}

(async () => {
  await db.$connect();
  menu = await db.menuItem.create({ data: { name: '__qrclosed_' + randomUUID(), price: 10000 } });
  const table = await db.transaction.create({ data: { tableNumber: '__qrclosed_' + randomUUID(), status: 'open', total: 0 } });
  sessionIds.push(table.id);

  // 1. Order selesai dikirim selagi sesi masih terbuka (alur normal sebelum ditutup).
  const orderResult = await placeOrder({ transactionId: table.id, requestId: randomUUID(), items: [{ menuItemId: menu.id, quantity: 2 }] });

  // 2. Sesi ditutup (setara kasir menyelesaikan pembayaran). Ditulis langsung ke DB, bukan lewat
  //    PUT /api/transaction/[id], karena endpoint itu butuh login staf (di luar scope skenario
  //    "customer scan QR lagi" — status akhir "closed" ini yang relevan diuji di sini).
  await db.transaction.update({ where: { id: table.id }, data: { status: 'completed', completedAt: new Date(), total: orderResult.body.total } });

  // 3. Customer scan QR meja yang sama lagi (anonymous GET, tanpa cookie).
  const scan = await scanQr(table.id);

  // 4. Customer (atau tab lama yang masih terbuka) coba pesan lagi ke sesi yang sudah tertutup ini.
  const retryOrder = await placeOrder({ transactionId: table.id, requestId: randomUUID(), items: [{ menuItemId: menu.id, quantity: 1 }] });

  const staticChecks = {
    hasClosedHeading: orderPageSource.includes('Transaksi ini sudah selesai.'),
    hasNewQrInstruction: orderPageSource.includes('Silakan hubungi kasir untuk mendapatkan QR Code baru.'),
    hasStatusGate: orderPageSource.includes("trxData.status !== 'open'"),
  };

  const result = {
    scenario: 'closed-session QR re-scan tells customer session is closed and to request a new QR',
    orderPlacedFirst: { status: orderResult.status, orderId: orderResult.body.id },
    qrScanAfterClose: { status: scan.status, transactionStatus: scan.body.status, completedAt: scan.body.completedAt },
    orderAttemptAfterClose: { status: retryOrder.status, code: retryOrder.body.code, error: retryOrder.body.error },
    frontendTextGuard: staticChecks,
    pass: orderResult.status === 200
      && scan.status === 200 && scan.body.status === 'completed' && !!scan.body.completedAt
      && retryOrder.status === 409 && retryOrder.body.code === 'SESSION_CLOSED'
      && /qr/i.test(retryOrder.body.error) && /kasir/i.test(retryOrder.body.error)
      && Object.values(staticChecks).every(Boolean)
      && errors.length === 0
  };
  console.log(JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(root, 'tmp/order-closed-session-qr-scan-results.json'), JSON.stringify(result, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    await db.orderSubmission.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.orderItem.deleteMany({ where: { order: { transactionId: { in: sessionIds } } } });
    await db.order.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.transaction.deleteMany({ where: { id: { in: sessionIds } } });
    if (menu) await db.menuItem.delete({ where: { id: menu.id } });
  } finally {
    await db.$disconnect();
  }
});
