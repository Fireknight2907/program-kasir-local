// Simulasi restoran langsung (50 meja aktif, beberapa putaran, order nakal, human error).
// HANYA menyentuh cluster PostgreSQL disposable yang dibuat & dihapus sendiri oleh skrip ini.
// .env / database lokal kasir_local / Supabase produksi TIDAK pernah disentuh.
//
// Menjalankan server `next dev` SUNGGUHAN (bukan vm sandbox) dan menembakkan request HTTP asli
// ke semua endpoint yang dipakai alur restoran: buka meja, order customer, dapur, pembayaran.

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PG_BIN = 'C:\\Program Files\\PostgreSQL\\18\\bin';
const RUN_TAG = Date.now();
const PGDATA = path.join(ROOT, 'tmp', `pgdata-sim-${RUN_TAG}`);
const PG_LOG = path.join(ROOT, 'tmp', `pgdata-sim-${RUN_TAG}.log`);
const PG_PORT = 55513;
const DB_NAME = 'kasir_sim';
const DATABASE_URL = `postgresql://postgres@127.0.0.1:${PG_PORT}/${DB_NAME}`;
const APP_PORT = 39123;
const BASE_URL = `http://127.0.0.1:${APP_PORT}`;
const SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const ADMIN_USER = 'sim_admin';
const ADMIN_PASS = 'Sim-Strong-Pass-932!';
const KASIR_USER = 'sim_kasir';
const KASIR_PASS = 'Sim-Kasir-Pass-932!';

const TABLES = 50;
const ROUNDS = 3;

let nextProc = null;
let pgStarted = false;
const metrics = [];
const findings = [];

function log(...a) { console.log(new Date().toISOString().slice(11, 23), ...a); }
function addFinding(severity, title, detail) {
  findings.push({ severity, title, detail });
  log(`[${severity}] ${title} :: ${JSON.stringify(detail).slice(0, 300)}`);
}

async function call(label, url, opts = {}) {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
    const ms = performance.now() - started;
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    const setCookie = res.headers.get('set-cookie');
    metrics.push({ label, status: res.status, ms: +ms.toFixed(1) });
    if (ms > 3000) addFinding('PERF', 'Respons API lambat (>3s)', { label, ms: +ms.toFixed(0), status: res.status });
    return { status: res.status, body, ms, cookie: setCookie ? setCookie.split(';')[0] : null };
  } catch (error) {
    const ms = performance.now() - started;
    metrics.push({ label, status: 'ERR', ms: +ms.toFixed(1) });
    addFinding('CRITICAL', 'Request gagal total / timeout', { label, error: String(error?.message || error), ms: +ms.toFixed(0) });
    return { status: 0, body: null, ms, cookie: null, error };
  }
}

function rid() { return crypto.randomUUID(); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------- Infra: PostgreSQL disposable ----------
function setupPostgres() {
  if (fs.existsSync(PGDATA)) fs.rmSync(PGDATA, { recursive: true, force: true });
  log('initdb (cluster disposable)...');
  execFileSync(path.join(PG_BIN, 'initdb.exe'), ['-D', PGDATA, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-locale'], { stdio: 'ignore' });
  log('pg_ctl start...');
  // stdio MUST be 'ignore' here: pg_ctl forks a detached postgres.exe on Windows that inherits
  // pipe handles, so execFileSync with stdio:'pipe' never sees EOF and hangs forever even though
  // the server itself started fine (observed directly: confirmed stuck 5+ minutes while the
  // server log already showed "ready to accept connections").
  execFileSync(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', PGDATA, '-l', PG_LOG, '-o', `-p ${PG_PORT} -h 127.0.0.1`, 'start', '-w'], { stdio: 'ignore' });
  pgStarted = true;
  log('createdb kasir_sim...');
  execFileSync(path.join(PG_BIN, 'createdb.exe'), ['-h', '127.0.0.1', '-p', String(PG_PORT), '-U', 'postgres', DB_NAME], { stdio: 'ignore' });
}

function prismaDbPush() {
  log('prisma db push ke cluster disposable...');
  // shell:true is required on Windows/Node 24 to spawn .cmd files at all (Node now refuses
  // plain spawnSync('npx.cmd', ...) with EINVAL since the CVE-2024-27980 hardening).
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'], {
    cwd: ROOT, stdio: 'pipe', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL }
  });
}

async function seedData() {
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  await db.user.create({ data: { username: ADMIN_USER, password: await bcrypt.hash(ADMIN_PASS, 12), name: 'Sim Admin', role: 'ADMIN' } });
  await db.user.create({ data: { username: KASIR_USER, password: await bcrypt.hash(KASIR_PASS, 12), name: 'Sim Kasir', role: 'KASIR' } });
  const categories = ['Makanan', 'Minuman', 'Snack'];
  for (const name of categories) await db.category.create({ data: { name } });
  const menuDefs = [
    ['Nasi Goreng', 25000], ['Mie Goreng', 23000], ['Ayam Bakar', 30000], ['Ayam Geprek', 27000],
    ['Sate Ayam', 28000], ['Rendang', 35000], ['Gado-Gado', 22000], ['Soto Ayam', 24000],
    ['Nasi Campur', 26000], ['Bakso', 20000],
    ['Es Teh Manis', 8000], ['Es Jeruk', 9000], ['Kopi Hitam', 10000], ['Jus Alpukat', 15000], ['Air Mineral', 5000],
    ['Kerupuk', 5000], ['Tahu Goreng', 10000], ['Tempe Goreng', 10000], ['Pisang Goreng', 12000], ['Es Krim', 15000],
  ];
  const menu = [];
  for (let i = 0; i < menuDefs.length; i++) {
    const [name, price] = menuDefs[i];
    menu.push(await db.menuItem.create({ data: { name, price, category: categories[i % categories.length] } }));
  }
  const soldOut = await db.menuItem.create({ data: { name: 'Menu Habis (Spesial Chef)', price: 50000, isAvailable: false } });
  const megaPrice = await db.menuItem.create({ data: { name: '__sim_mega_price__', price: 2000000000, isAvailable: true } });
  await db.$disconnect();
  return { menu, soldOut, megaPrice };
}

function startNextServer() {
  return new Promise((resolve, reject) => {
    let settled = false;
    let out = '';
    nextProc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', String(APP_PORT)], {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL, DIRECT_URL: DATABASE_URL, SESSION_SECRET, PORT: String(APP_PORT) },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error('next dev timeout. Output so far:\n' + out)); } }, 90000);
    const onData = d => {
      out += d.toString();
      if (!settled && /Ready in|started server on/i.test(out)) { settled = true; clearTimeout(timer); resolve(); }
    };
    nextProc.stdout.on('data', onData);
    nextProc.stderr.on('data', d => { out += d.toString(); onData(d); });
    nextProc.on('error', err => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } });
    nextProc.on('exit', code => { if (!settled && code !== 0 && code !== null) { settled = true; clearTimeout(timer); reject(new Error('next dev exited ' + code + '\n' + out)); } });
  });
}

// ---------- API helpers ----------
async function login(username, password) {
  const r = await call('login', `${BASE_URL}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  return r;
}
function authHeaders(cookie, extra = {}) { return { 'content-type': 'application/json', cookie, ...extra }; }

async function openTable(cookie, tableNumber, requestId = rid()) {
  return call('open-table', `${BASE_URL}/api/transaction`, { method: 'POST', headers: authHeaders(cookie), body: JSON.stringify({ tableNumber, requestId }) });
}
async function placeOrder(transactionId, items, extra = {}) {
  return call('place-order', `${BASE_URL}/api/order`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transactionId, requestId: rid(), items, ...extra }) });
}
async function placeOrderRaw(bodyObj, label = 'place-order-raw') {
  return call(label, `${BASE_URL}/api/order`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyObj) });
}
async function getTransaction(id, cookie = null) {
  return call('get-transaction', `${BASE_URL}/api/transaction/${id}`, { headers: cookie ? { cookie } : {} });
}
async function payTransaction(cookie, id, payload) {
  return call('pay-transaction', `${BASE_URL}/api/transaction/${id}`, { method: 'PUT', headers: authHeaders(cookie), body: JSON.stringify(payload) });
}
async function cancelTransaction(cookie, id, expectedRevision, expectedTotal) {
  // cancel reuses the same PUT, status 'cancelled' does not require paymentMethod/expectedTotal per route validation
  return call('cancel-transaction', `${BASE_URL}/api/transaction/${id}`, { method: 'PUT', headers: authHeaders(cookie), body: JSON.stringify({ status: 'cancelled' }) });
}
async function kitchenStep(cookie, orderId, expectedStatus, expectedVersion, status) {
  return call('kitchen-step', `${BASE_URL}/api/kitchen/${orderId}`, { method: 'PUT', headers: authHeaders(cookie), body: JSON.stringify({ expectedStatus, expectedVersion, status }) });
}
async function forceServed(cookie, orderId) {
  return call('kitchen-force-served', `${BASE_URL}/api/kitchen/${orderId}`, { method: 'PUT', headers: authHeaders(cookie), body: JSON.stringify({ forceServed: true }) });
}

function pickItems(menu, { minItems = 1, maxItems = 4, minQty = 1, maxQty = 3, excludeIds = [] } = {}) {
  const pool = menu.filter(m => !excludeIds.includes(m.id));
  const n = Math.min(pool.length, minItems + Math.floor(Math.random() * (maxItems - minItems + 1)));
  const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, n);
  return chosen.map(m => ({ menuItemId: m.id, quantity: minQty + Math.floor(Math.random() * (maxQty - minQty + 1)) }));
}

// ---------- Scenario per table ----------
const staleQr = new Map(); // tableNumber -> old closed transactionId (simulasi QR lama)

async function runTableScenario(ctx, round, idx) {
  const { adminCookie, kasirCookie, menu, soldOut, megaPrice } = ctx;
  const tableNumber = `Meja ${idx + 1}`;
  const scenario = idx % 10;
  const report = { tableNumber, round, scenario, events: [] };

  // Human error: waiter kasih QR lama (tabel ini pernah dipakai di round sebelumnya)
  if (staleQr.has(tableNumber)) {
    const oldId = staleQr.get(tableNumber);
    const scan = await getTransaction(oldId);
    const attempt = await placeOrder(oldId, pickItems(menu, { maxItems: 1 }));
    report.staleQrScan = { scanStatus: scan.status, scanTxStatus: scan.body?.status, orderAttemptStatus: attempt.status, orderAttemptCode: attempt.body?.code };
    if (attempt.status !== 409 || attempt.body?.code !== 'SESSION_CLOSED') {
      addFinding('CRITICAL', 'QR lama (meja sudah ditutup) masih bisa dipakai order baru', { tableNumber, oldId, attempt: attempt.body });
    }
  }

  // Buka meja (human error khusus: double-open untuk skenario 6)
  let session;
  if (scenario === 6) {
    const [r1, r2] = await Promise.all([openTable(kasirCookie, tableNumber), openTable(kasirCookie, tableNumber)]);
    const okCount = [r1, r2].filter(r => r.status === 200).length;
    const conflictCount = [r1, r2].filter(r => r.status === 409).length;
    report.doubleOpen = { s1: r1.status, s2: r2.status };
    if (okCount !== 1 || conflictCount !== 1) {
      addFinding('CRITICAL', 'Dobel-klik "buka meja" bisa membuat 2 sesi untuk meja yang sama', { tableNumber, r1: r1.status, r2: r2.status, bodies: [r1.body, r2.body] });
    }
    session = (r1.status === 200 ? r1.body : r2.body);
  } else {
    const r = await openTable(kasirCookie, tableNumber);
    if (r.status !== 200) { addFinding('CRITICAL', 'Gagal buka meja normal', { tableNumber, status: r.status, body: r.body }); return report; }
    session = r.body;
  }
  report.transactionId = session.id;

  if (scenario === 4) { // no-show: batalkan tanpa order
    const c = await cancelTransaction(kasirCookie, session.id);
    report.noShowCancel = c.status;
    if (c.status !== 200) addFinding('MEDIUM', 'Batalkan meja kosong (no-show) gagal', { tableNumber, status: c.status, body: c.body });
    return report;
  }

  if (scenario === 3) { // malicious injection attempts, lalu tetap order normal supaya meja tidak nyangkut
    const payloads = [
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: -5 }] },
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: -1, quantity: 1 }] },
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: 999999999 }] },
      { transactionId: session.id, requestId: rid(), items: Array.from({ length: 200 }, () => ({ menuItemId: menu[0].id, quantity: 1 })) },
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: 1.5 }] },
      { transactionId: "'); DROP TABLE \"Transaction\"; --", requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: 1 }] },
      { transactionId: session.id, requestId: 'short', items: [{ menuItemId: menu[0].id, quantity: 1 }] },
      { transactionId: session.id, requestId: rid(), items: [] },
      { transactionId: session.id, requestId: rid() }, // no items field at all
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: soldOut.id, quantity: 1 }] },
      { transactionId: session.id, requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: 1 }], isTakeaway: 'yes' },
    ];
    const results = [];
    for (const p of payloads) {
      const r = await placeOrderRaw(p, 'malicious-order');
      results.push({ status: r.status, code: r.body?.code, note: JSON.stringify(p).slice(0, 80) });
      if (r.status >= 500) addFinding('CRITICAL', 'Payload nakal menyebabkan 500 (bukan ditolak rapi)', { tableNumber, payload: p, status: r.status, body: r.body });
      if (r.status === 200) addFinding('CRITICAL', 'Payload nakal/invalid justru diterima (status 200)', { tableNumber, payload: p, body: r.body });
    }
    // huge body (DoS payload besar)
    const hugeNote = 'X'.repeat(5_000_000);
    const hugeResult = await placeOrderRaw({ transactionId: session.id, requestId: rid(), items: [{ menuItemId: menu[0].id, quantity: 1 }], _junk: hugeNote }, 'malicious-huge-body');
    results.push({ status: hugeResult.status, note: 'huge-5MB-body' });
    if (hugeResult.status >= 500) addFinding('HIGH', 'Body raksasa (5MB) bikin server error, bukan ditolak', { tableNumber, status: hugeResult.status });
    report.maliciousResults = results;
    // tampered cookie
    const tamperedCookie = kasirCookie.slice(0, -2) + 'zz';
    const tamperTry = await payTransaction(tamperedCookie, session.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: 0, expectedRevision: 0, paymentRequestId: rid() });
    report.tamperedCookieStatus = tamperTry.status;
    if (tamperTry.status !== 401) addFinding('CRITICAL', 'Cookie sesi yang diotak-atik (tamper) tidak ditolak 401', { tableNumber, status: tamperTry.status, body: tamperTry.body });
    // valid order so table doesn't get stuck
    const good = await placeOrder(session.id, pickItems(menu, { maxItems: 3 }));
    if (good.status !== 200) addFinding('HIGH', 'Order valid gagal setelah rentetan payload nakal (server mungkin ikut rusak)', { tableNumber, status: good.status, body: good.body });
  } else if (scenario === 8) { // overflow attempt
    const r1 = await placeOrder(session.id, [{ menuItemId: megaPrice.id, quantity: 2 }]);
    report.overflowAttempt = { status: r1.status, code: r1.body?.code };
    if (r1.status === 200) addFinding('CRITICAL', 'Order dengan total melebihi batas integer DITERIMA (potensi overflow DB)', { tableNumber, body: r1.body });
    const good = await placeOrder(session.id, pickItems(menu, { maxItems: 3 }));
    if (good.status !== 200) addFinding('HIGH', 'Order normal gagal setelah percobaan overflow', { tableNumber, status: good.status });
  } else if (scenario === 2) { // flood / rate limit
    const items = [{ menuItemId: menu[0].id, quantity: 1 }];
    const bursts = await Promise.all(Array.from({ length: 12 }, () => placeOrder(session.id, items)));
    const okCount = bursts.filter(r => r.status === 200).length;
    const limited = bursts.filter(r => r.status === 429).length;
    report.flood = { okCount, limited, statuses: bursts.map(r => r.status) };
    if (okCount > 5) addFinding('CRITICAL', 'Rate limit per menit TEMBUS saat 12 request paralel ke meja sama', { tableNumber, okCount, statuses: bursts.map(r => r.status) });
  } else if (scenario === 0) { // heavy order: banyak menu sekaligus
    const items = pickItems(menu, { minItems: 10, maxItems: 10, minQty: 1, maxQty: 2 });
    const r = await placeOrder(session.id, items);
    report.heavyOrder = { status: r.status, itemCount: items.length };
    if (r.status !== 200) addFinding('MEDIUM', 'Order besar (10 menu sekaligus, wajar) ditolak', { tableNumber, status: r.status, body: r.body });
  } else if (scenario === 1) { // add-on: order lalu nambah 2x lagi
    const r1 = await placeOrder(session.id, pickItems(menu, { maxItems: 2 }));
    await sleep(50);
    const r2 = await placeOrder(session.id, pickItems(menu, { maxItems: 2 }));
    await sleep(50);
    const r3 = await placeOrder(session.id, pickItems(menu, { maxItems: 2 }));
    report.addon = { statuses: [r1.status, r2.status, r3.status] };
    if ([r1, r2, r3].some(r => r.status !== 200)) addFinding('MEDIUM', 'Tambah pesanan (addon) bertahap ada yang gagal', { tableNumber, statuses: [r1.status, r2.status, r3.status] });
  } else if (scenario === 5) { // stale payment: kasir pakai bill lama setelah customer nambah order
    const first = await placeOrder(session.id, pickItems(menu, { maxItems: 2 }));
    const txBefore = await getTransaction(session.id, kasirCookie);
    const staleRevision = txBefore.body.revision, staleTotal = txBefore.body.total;
    // customer nyelip nambah order sebelum kasir klik bayar
    await placeOrder(session.id, pickItems(menu, { maxItems: 2 }));
    const stalePay = await payTransaction(kasirCookie, session.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: staleTotal, expectedRevision: staleRevision, paymentRequestId: rid() });
    report.stalePayment = { status: stalePay.status, code: stalePay.body?.code };
    if (stalePay.status !== 409) addFinding('CRITICAL', 'Pembayaran dengan tagihan BASI (sebelum tambahan order) malah BERHASIL — risiko kurang tagih', { tableNumber, status: stalePay.status, body: stalePay.body });
    // bayar ulang dengan data terbaru supaya meja bisa ditutup
    const txNow = await getTransaction(session.id, kasirCookie);
    const finalPay = await payTransaction(kasirCookie, session.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: txNow.body.total, expectedRevision: txNow.body.revision, paymentRequestId: rid() });
    report.stalePaymentRetry = finalPay.status;
    if (finalPay.status !== 200) addFinding('HIGH', 'Pembayaran ulang dengan data terbaru tetap gagal', { tableNumber, status: finalPay.status, body: finalPay.body });
    staleQr.set(tableNumber, session.id);
    return report;
  } else if (scenario === 7) { // race: order vs payment di waktu BERSAMAAN
    await placeOrder(session.id, pickItems(menu, { maxItems: 2 })); // isi tagihan dulu
    const txNow = await getTransaction(session.id, kasirCookie);
    const racedItems = pickItems(menu, { maxItems: 2 });
    const [orderRes, payRes] = await Promise.all([
      placeOrder(session.id, racedItems),
      payTransaction(kasirCookie, session.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: txNow.body.total, expectedRevision: txNow.body.revision, paymentRequestId: rid() }),
    ]);
    report.race = { orderStatus: orderRes.status, payStatus: payRes.status };
    const after = await getTransaction(session.id, kasirCookie);
    const sumOrders = (after.body.orders || []).reduce((s, o) => s + o.total, 0);
    report.raceConsistency = { transactionTotal: after.body.total, sumOrders, paidTotal: after.body.paidTotal, status: after.body.status };
    if (after.body.status === 'completed' && sumOrders !== after.body.paidTotal && orderRes.status === 200) {
      addFinding('CRITICAL', 'RACE order-vs-pembayaran: order masuk SETELAH meja completed, tagihan tidak konsisten (lubang balapan yang dicurigai sejak 2026-09-26 TERBUKTI)', { tableNumber, after: after.body, orderStatus: orderRes.status, payStatus: payRes.status });
    }
    if (after.body.status !== 'completed') {
      const finalPay = await payTransaction(kasirCookie, session.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: after.body.total, expectedRevision: after.body.revision, paymentRequestId: rid() });
      report.raceFinalPay = finalPay.status;
    }
    staleQr.set(tableNumber, session.id);
    return report;
  } else { // normal
    const r = await placeOrder(session.id, pickItems(menu, { maxItems: 4 }));
    report.normalOrder = { status: r.status };
    if (r.status !== 200) addFinding('MEDIUM', 'Order normal gagal', { tableNumber, status: r.status, body: r.body });
  }

  // Dapur proses sebagian (variasi: ada yang sampai served, ada yang nyangkut)
  const txDetail = await getTransaction(session.id, kasirCookie);
  const orders = txDetail.body?.orders || [];
  for (const order of orders) {
    if (order.kitchenStatus === 'cancelled' || order.kitchenStatus === 'served') continue;
    const progressTo = Math.random();
    try {
      let status = order.kitchenStatus, version = order.kitchenVersion;
      const steps = progressTo < 0.3 ? 0 : progressTo < 0.6 ? 1 : progressTo < 0.85 ? 3 : 4;
      const chain = { queued: 'accepted', accepted: 'preparing', preparing: 'ready', ready: 'served' };
      for (let s = 0; s < steps && chain[status]; s++) {
        const next = chain[status];
        const r = await kitchenStep(kasirCookie, order.id, status, version, next);
        if (r.status === 200) { status = next; version += 1; } else break;
      }
    } catch (e) { addFinding('MEDIUM', 'Error saat progres kitchen', { tableNumber, orderId: order.id, error: String(e) }); }
  }

  // Bayar dulu walau mungkin belum semua served (perilaku ini DISENGAJA, sudah terbukti aman di audit lama)
  const final = await getTransaction(session.id, kasirCookie);
  const pay = await payTransaction(kasirCookie, session.id, { status: 'completed', paymentMethod: ['CASH', 'QRIS', 'CARD'][idx % 3], expectedTotal: final.body.total, expectedRevision: final.body.revision, paymentRequestId: rid() });
  report.finalPayStatus = pay.status;
  if (pay.status !== 200) addFinding('HIGH', 'Pembayaran normal di akhir alur gagal', { tableNumber, status: pay.status, body: pay.body });
  staleQr.set(tableNumber, session.id);
  return report;
}

async function dbIntegrityCheck() {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const openTx = await db.transaction.findMany({ where: { status: { in: ['open', 'ordered'] } }, select: { id: true, tableNumber: true, status: true } });
  const byTable = new Map();
  for (const t of openTx) {
    const key = (t.tableNumber || '').toLowerCase().trim();
    byTable.set(key, (byTable.get(key) || 0) + 1);
  }
  for (const [table, count] of byTable) {
    if (count > 1) addFinding('CRITICAL', 'DUA sesi aktif untuk meja yang sama di database (bentrok meja nyata)', { table, count });
  }
  const allTx = await db.transaction.findMany({ include: { orders: { include: { items: true } } } });
  let mismatchCount = 0, negativeCount = 0, overMaxCount = 0;
  for (const t of allTx) {
    const sumOrders = t.orders.reduce((s, o) => s + o.total, 0);
    if (sumOrders !== t.total) { mismatchCount++; addFinding('CRITICAL', 'Total transaksi TIDAK SAMA dengan jumlah order di dalamnya', { id: t.id, tableNumber: t.tableNumber, total: t.total, sumOrders }); }
    for (const o of t.orders) {
      const sumItems = o.items.filter(i => !i.deletedAt).reduce((s, i) => s + i.price * i.quantity, 0);
      if (sumItems !== o.total) { mismatchCount++; addFinding('HIGH', 'Total order tidak sama dengan jumlah item', { orderId: o.id, total: o.total, sumItems }); }
    }
    if (t.total < 0) negativeCount++;
    if (t.total > 2147483647) overMaxCount++;
  }
  const submissionCount = await db.orderSubmission.count();
  const orderCount = await db.order.count();
  const txCount = await db.transaction.count();
  await db.$disconnect();
  return { openTableCount: openTx.length, duplicateTableConflicts: [...byTable.entries()].filter(([, c]) => c > 1), mismatchCount, negativeCount, overMaxCount, submissionCount, orderCount, txCount };
}

function teardown() {
  log('Teardown: menghentikan next dev...');
  try { if (nextProc && !nextProc.killed) { nextProc.kill(process.platform === 'win32' ? undefined : 'SIGTERM'); } } catch {}
  if (process.platform === 'win32' && nextProc?.pid) {
    try { execFileSync('taskkill', ['/pid', String(nextProc.pid), '/T', '/F'], { stdio: 'pipe' }); } catch {}
  }
  if (pgStarted) {
    log('Teardown: menghentikan cluster PostgreSQL disposable...');
    try { execFileSync(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', PGDATA, '-m', 'fast', 'stop'], { stdio: 'ignore' }); } catch (e) { log('pg_ctl stop gagal (lanjut hapus data dir):', String(e.message || e)); }
  }
  try { if (fs.existsSync(PGDATA)) fs.rmSync(PGDATA, { recursive: true, force: true }); } catch (e) { log('Gagal hapus pgdata:', String(e.message || e)); }
  try { if (fs.existsSync(PG_LOG)) fs.rmSync(PG_LOG, { force: true }); } catch {}
  log('Teardown selesai. Tidak ada kredensial/cluster tersisa di disk.');
}

async function rushHourBurst(ctx) {
  // Stress murni: 50 meja dibuka BERSAMAAN (bukan chunk 10 seperti ronde biasa), lalu 50 order
  // pertama ditembak BERSAMAAN juga, lalu 50 pembayaran BERSAMAAN. Tujuannya memancing masalah
  // yang baru muncul di concurrency tinggi: connection pool habis, query antre lama, dsb.
  log('=== RUSH HOUR: 50 meja dibuka BENAR-BENAR bersamaan ===');
  const names = Array.from({ length: TABLES }, (_, i) => `Rush ${i + 1}`);
  const openStart = performance.now();
  const opens = await Promise.all(names.map(n => openTable(ctx.kasirCookie, n)));
  const openMs = performance.now() - openStart;
  const openFailures = opens.filter(r => r.status !== 200);
  if (openFailures.length) addFinding('HIGH', 'Rush hour: sebagian meja GAGAL dibuka saat 50 permintaan bersamaan', { count: openFailures.length, statuses: openFailures.map(r => r.status) });
  const sessions = opens.filter(r => r.status === 200).map(r => r.body);

  const orderStart = performance.now();
  const orders = await Promise.all(sessions.map(s => placeOrder(s.id, pickItems(ctx.menu, { minItems: 2, maxItems: 5 }))));
  const orderMs = performance.now() - orderStart;
  const orderFailures = orders.filter(r => r.status !== 200);
  const poolErrors = orders.filter(r => r.status >= 500 || (typeof r.body === 'object' && JSON.stringify(r.body || '').match(/pool|timed out|ECONNREFUSED/i)));
  if (orderFailures.length) addFinding('HIGH', 'Rush hour: sebagian order pertama GAGAL saat 50 meja mengirim bersamaan', { count: orderFailures.length, statuses: orderFailures.map(r => r.status), bodies: orderFailures.slice(0, 3).map(r => r.body) });
  if (poolErrors.length) addFinding('CRITICAL', 'Rush hour: terindikasi database connection pool habis / timeout saat 50 order bersamaan', { count: poolErrors.length, samples: poolErrors.slice(0, 3).map(r => r.body) });

  const paid = await Promise.all(sessions.map(async s => {
    const tx = await getTransaction(s.id, ctx.kasirCookie);
    return payTransaction(ctx.kasirCookie, s.id, { status: 'completed', paymentMethod: 'CASH', expectedTotal: tx.body.total, expectedRevision: tx.body.revision, paymentRequestId: rid() });
  }));
  const payFailures = paid.filter(r => r.status !== 200);
  if (payFailures.length) addFinding('HIGH', 'Rush hour: sebagian pembayaran GAGAL saat 50 meja ditutup bersamaan', { count: payFailures.length, statuses: payFailures.map(r => r.status) });

  return {
    openedOk: sessions.length, openTotalMs: +openMs.toFixed(0),
    orderedOk: orders.filter(r => r.status === 200).length, orderTotalMs: +orderMs.toFixed(0),
    paidOk: paid.filter(r => r.status === 200).length,
  };
}

function summarize() {
  const byLabel = {};
  for (const m of metrics) {
    byLabel[m.label] ??= { count: 0, errors: 0, durations: [] };
    byLabel[m.label].count++;
    if (m.status === 'ERR' || (typeof m.status === 'number' && m.status >= 500)) byLabel[m.label].errors++;
    byLabel[m.label].durations.push(m.ms);
  }
  const stats = {};
  for (const [label, d] of Object.entries(byLabel)) {
    const sorted = [...d.durations].sort((a, b) => a - b);
    const pct = p => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    stats[label] = { count: d.count, errors: d.errors, p50: +pct(50).toFixed(1), p95: +pct(95).toFixed(1), max: +sorted[sorted.length - 1].toFixed(1) };
  }
  return stats;
}

(async () => {
  const allReports = [];
  try {
    setupPostgres();
    prismaDbPush();
    const seeded = await seedData();
    log('Server next dev menyala...');
    await startNextServer();
    log('Server siap. Login...');
    const adminLogin = await login(ADMIN_USER, ADMIN_PASS);
    const kasirLogin = await login(KASIR_USER, KASIR_PASS);
    if (adminLogin.status !== 200 || kasirLogin.status !== 200) throw new Error('Login awal gagal: ' + JSON.stringify({ adminLogin: adminLogin.status, kasirLogin: kasirLogin.status }));
    const ctx = { adminCookie: adminLogin.cookie, kasirCookie: kasirLogin.cookie, menu: seeded.menu, soldOut: seeded.soldOut, megaPrice: seeded.megaPrice };

    // Smoke-check cepat: anonim tidak bisa buka meja / bayar
    const anonOpen = await openTable(null, 'Meja Anonim Test');
    if (anonOpen.status !== 401) addFinding('CRITICAL', 'Anonim bisa buka meja tanpa login', { status: anonOpen.status });

    for (let round = 1; round <= ROUNDS; round++) {
      log(`=== RONDE ${round}/${ROUNDS}: ${TABLES} meja aktif ===`);
      // "Jam sibuk": buka semua meja hampir bersamaan dalam beberapa gelombang (stress test burst)
      const chunkSize = 10;
      for (let i = 0; i < TABLES; i += chunkSize) {
        const chunk = Array.from({ length: Math.min(chunkSize, TABLES - i) }, (_, j) => runTableScenario(ctx, round, i + j));
        const results = await Promise.all(chunk);
        allReports.push(...results);
      }
      log(`Ronde ${round} selesai. Findings sejauh ini: ${findings.length}`);
    }

    log('Semua ronde selesai. Menjalankan fase rush hour...');
    const rushHour = await rushHourBurst(ctx);
    log('Rush hour selesai: ' + JSON.stringify(rushHour));

    log('Menjalankan pemeriksaan integritas database...');
    const integrity = await dbIntegrityCheck();
    const perf = summarize();

    const finalReport = { seedMenuCount: ctx.menu.length, rounds: ROUNDS, tables: TABLES, rushHour, integrity, perf, findingsCount: findings.length, findings, sampleReports: allReports.slice(0, 20) };
    fs.writeFileSync(path.join(ROOT, 'tmp', 'sim-live-report.json'), JSON.stringify(finalReport, null, 2));
    console.log('\n===== RINGKASAN =====');
    console.log(JSON.stringify({ rushHour, integrity, perf, findingsCount: findings.length }, null, 2));
  } catch (error) {
    console.error('SIMULASI GAGAL:', error);
    process.exitCode = 1;
  } finally {
    teardown();
  }
})();
