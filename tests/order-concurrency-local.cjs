// Run against a disposable PostgreSQL cluster only. No .env is loaded.
// HTTP harness executes the current order handler with real Prisma/NextResponse.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { createHash, randomUUID } = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { PrismaClient } = require('@prisma/client');
const { NextResponse } = require('next/server');
const url = process.env.CONCURRENCY_DATABASE_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).port !== '55439') {
  throw Error('Requires disposable local PostgreSQL on port 55439 via CONCURRENCY_DATABASE_URL');
}
const db = new PrismaClient({ datasources: { db: { url } } });
const root = path.resolve(__dirname, '..');
const routeSource = fs.readFileSync(path.join(root, 'src/app/api/order/route.js'), 'utf8');
const limitsSource = fs.readFileSync(path.join(root, 'src/lib/order-limits.js'), 'utf8');
const errors = [];
let writeGate = null;
const prisma = new Proxy(db, { get(target, key) {
  if (key === '$transaction') return async (...args) => {
    if (writeGate) await writeGate();
    return target.$transaction(...args);
  };
  const value = target[key];
  return typeof value === 'function' ? value.bind(target) : value;
} });
const context = vm.createContext({ prisma, NextResponse, createHash,
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
const results = [];
async function session(quantity = 0) {
  const row = await db.transaction.create({ data: { tableNumber: '__concurrency_' + randomUUID(),
    status: quantity ? 'ordered' : 'open', total: quantity * 1000,
    ...(quantity ? { orders: { create: { total: quantity * 1000, items: { create: { menuItemId: menu.id, quantity, price: 1000 } } } } } : {})
  } });
  sessionIds.push(row.id);
  return row;
}
function barrier(count) {
  let arrivals = 0, release, reject;
  const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
  const timer = setTimeout(() => reject(Error('Pre-write barrier timed out')), 10000);
  return async () => {
    if (++arrivals === count) { clearTimeout(timer); release(); }
    await pending;
  };
}
async function snapshot(ids) {
  const rows = await db.transaction.findMany({ where: { id: { in: ids } }, include: { orders: { include: { items: true } } } });
  return {
    orders: rows.reduce((n, r) => n + r.orders.length, 0),
    portions: rows.reduce((n, r) => n + r.orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0), 0),
    total: rows.reduce((n, r) => n + r.total, 0),
    totalsConsistent: rows.every(r => r.total === r.orders.reduce((n, o) => n + o.total, 0)
      && r.orders.every(o => o.total === o.items.reduce((n, i) => n + i.price * i.quantity, 0))),
    receipts: await db.orderSubmission.count({ where: { transactionId: { in: ids } } })
  };
}
async function run(name, sessions, quantity, count, synchronized, duplicate = false) {
  const ids = [...new Set(sessions.map(s => s.id))];
  const key = randomUUID();
  const payloads = Array.from({ length: count }, (_, i) => ({ transactionId: sessions[i % sessions.length].id,
    requestId: duplicate ? key : randomUUID(), items: [{ menuItemId: menu.id, quantity }] }));
  const before = await snapshot(ids);
  writeGate = synchronized ? barrier(count) : null;
  const starts = [];
  const firstError = errors.length;
  const started = performance.now();
  const responses = await Promise.all(payloads.map(async payload => {
    starts.push(performance.now());
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/order`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000)
    });
    return { status: response.status, body: await response.json() };
  }));
  writeGate = null;
  const after = await snapshot(ids);
  const result = { name, mode: synchronized ? 'pre-write barrier after real reads' : 'natural concurrent HTTP', count,
    dispatchSpreadMs: +(Math.max(...starts) - Math.min(...starts)).toFixed(2), durationMs: +(performance.now() - started).toFixed(2),
    statuses: responses.map(r => r.status), codes: responses.map(r => r.body.code || null), before, after,
    databaseErrorCodes: errors.slice(firstError).map(e => e.code),
    pass: after.totalsConsistent && (name === 'session-limit' ? after.portions <= 100
      : name === 'rate-limit' ? after.receipts <= 5
      : duplicate ? after.orders === 1 && after.receipts === 1 && responses.every(r => r.status === 200)
      : responses.every(r => r.status === 200) && after.orders - before.orders === count)
  };
  if (duplicate) {
    const retry = await context.POST(new Request('http://localhost/api/order', { method: 'POST', body: JSON.stringify(payloads[0]) }));
    result.retryStatus = retry.status;
    result.afterRetry = await snapshot(ids);
  }
  results.push(result);
  console.log(JSON.stringify(result));
}
(async () => {
  await db.$connect();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  menu = await db.menuItem.create({ data: { name: '__concurrency_' + randomUUID(), price: 1000 } });
  // Warm the HTTP connection and Prisma before measuring concurrent dispatch.
  await run('warmup', [await session()], 1, 1, false);
  await run('different-tables', await Promise.all(Array.from({ length: 10 }, () => session())), 1, 10, false);
  for (const synchronized of [false, true]) {
    for (let round = 0; round < 3; round++) {
      await run('same-table-within-limits', [await session()], 2, 5, synchronized);
      await run('session-limit', [await session(90)], 10, 5, synchronized);
      await run('rate-limit', [await session()], 1, 10, synchronized);
      await run('duplicate-request', [await session()], 2, 6, synchronized, true);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  writeGate = null;
  try {
    await db.orderSubmission.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.orderItem.deleteMany({ where: { order: { transactionId: { in: sessionIds } } } });
    await db.order.deleteMany({ where: { transactionId: { in: sessionIds } } });
    await db.transaction.deleteMany({ where: { id: { in: sessionIds } } });
    if (menu) await db.menuItem.delete({ where: { id: menu.id } });
    const remainingFixtures = await db.transaction.count({ where: { id: { in: sessionIds } } });
    const report = { date: new Date().toISOString(), routeSha256: createHash('sha256').update(routeSource).digest('hex'),
      scope: 'Actual route handler and PostgreSQL through local HTTP harness; not full Next.js/browser/production', results, remainingFixtures };
    fs.writeFileSync(path.join(root, 'tmp/order-concurrency-results.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ cleanup: remainingFixtures === 0, passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length }));
    if (results.some(r => !r.pass)) process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.$disconnect();
  }
});
