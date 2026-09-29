const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

// Same source-loading trick as tests/payment-auth.test.cjs: strip ESM import/export
// syntax so the real route file can run unmodified inside a vm sandbox.
function source(path) {
  return fs.readFileSync(path, 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/export (async function|const|function)/g, '$1');
}

// Builds a sandbox with the REAL src/lib/session.js loaded (real HMAC signing/verification),
// a real logged-in cookie for `user`, and a prisma double that (a) answers session lookups
// truthfully and (b) records every other call it receives so we can assert "zero side effects
// happened" when a request is supposed to be rejected before touching the database.
function makeActor(user) {
  let token;
  const jar = { get: () => (token ? { value: token } : undefined), set: v => { token = v.value; }, delete: () => { token = undefined; } };
  const calls = [];
  function model(name) {
    return new Proxy({}, { get(_, method) { return async (...args) => { calls.push(`${name}.${method}`); return {}; }; } });
  }
  const prisma = new Proxy({}, {
    get(_, prop) {
      if (prop === 'user') return { findUnique: async ({ where }) => (user && where.id === user.id ? user : null) };
      if (prop === '$transaction') return async cb => { calls.push('$transaction'); return cb(prisma); };
      if (prop === '$executeRaw') return async () => { calls.push('$executeRaw'); return undefined; };
      return model(prop);
    }
  });
  const env = { SESSION_SECRET: 'test-only-secret-that-is-at-least-32-characters', NODE_ENV: 'production' };
  const ctx = vm.createContext({
    Buffer, URL, Date, process: { env },
    createHmac: crypto.createHmac, timingSafeEqual: crypto.timingSafeEqual,
    cookies: async () => jar, NextResponse: Response, console, prisma,
  });
  vm.runInContext(source('src/lib/session.js'), ctx);
  return {
    ctx, calls,
    login: async () => { await ctx.createSession(user); },
  };
}

function loadRoute(actor, path) {
  vm.runInContext(source(path), actor.ctx);
  return actor.ctx;
}

const admin = () => ({ id: 1, username: 'admin', role: 'ADMIN', password: 'admin-hash', mustChangePassword: false });
const kasir = () => ({ id: 2, username: 'kasir', role: 'KASIR', password: 'kasir-hash', mustChangePassword: false });

// --- 1. Real, validly-signed KASIR session calling ADMIN-only endpoints directly ---
// Every one of these must be rejected BEFORE touching prisma (calls.length === 0),
// proving the guard runs first and no data is read or written on behalf of the wrong actor.
const ADMIN_ONLY = [
  ['src/app/api/users/route.js', 'GET', {}, undefined],
  ['src/app/api/users/route.js', 'POST', {}, undefined],
  ['src/app/api/users/[id]/route.js', 'PUT', {}, { id: '1' }],
  ['src/app/api/users/[id]/route.js', 'DELETE', {}, { id: '1' }],
  ['src/app/api/menu/route.js', 'POST', {}, undefined],
  ['src/app/api/menu/[id]/route.js', 'PUT', {}, { id: '1' }],
  ['src/app/api/menu/[id]/route.js', 'DELETE', {}, { id: '1' }],
  ['src/app/api/categories/route.js', 'POST', {}, undefined],
  ['src/app/api/categories/route.js', 'PUT', {}, undefined],
  ['src/app/api/categories/route.js', 'DELETE', {}, undefined],
  ['src/app/api/upload/route.js', 'POST', {}, undefined],
];

for (const [path, method, req, params] of ADMIN_ONLY) {
  test(`KASIR (valid session) is rejected calling admin-only ${method} ${path}`, async () => {
    const actor = makeActor(kasir());
    await actor.login();
    const ctx = loadRoute(actor, path);
    const res = params ? await ctx[method](req, { params: Promise.resolve(params) }) : await ctx[method](req);
    assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
    assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
  });

  test(`Anonymous customer (no session) is rejected calling admin-only ${method} ${path}`, async () => {
    const actor = makeActor(null);
    const ctx = loadRoute(actor, path);
    const res = params ? await ctx[method](req, { params: Promise.resolve(params) }) : await ctx[method](req);
    assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
    assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
  });
}

// --- 2. Positive control: prove the guard actually distinguishes roles instead of denying everyone ---
test('ADMIN (valid session) is allowed past the guard for admin-only routes', async () => {
  for (const path of ['src/app/api/menu/route.js', 'src/app/api/categories/route.js']) {
    const actor = makeActor(admin());
    await actor.login();
    const ctx = loadRoute(actor, path);
    const res = await ctx.POST({ json: async () => ({ name: 'Test', price: 1000 }) });
    assert.notEqual(res.status, 401, `${path} POST: admin should not get 401`);
    assert.notEqual(res.status, 403, `${path} POST: admin should not get 403`);
    assert.ok(actor.calls.length > 0, `${path} POST: admin request should reach prisma`);
  }
});

// --- 3. Nested admin check inside a staff-guarded route: kitchen force-complete ---
// KASIR passes requireStaff() (it's a staff route) but must still be blocked by the
// second, admin-only guard that gates the forceServed shortcut specifically.
test('KASIR passes the staff guard but is blocked from admin-only forceServed on kitchen orders', async () => {
  const actor = makeActor(kasir());
  await actor.login();
  const ctx = loadRoute(actor, 'src/app/api/kitchen/[id]/route.js');
  const res = await ctx.PUT({ json: async () => ({ forceServed: true }) }, { params: Promise.resolve({ id: '1' }) });
  assert.equal(res.status, 403);
  assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
});

// --- 4. Explicit (non-requireAdmin-helper) role checks: deleting a transaction ---
test('KASIR passes the staff guard but is blocked from deleting a transaction (admin-only by explicit check)', async () => {
  const actor = makeActor(kasir());
  await actor.login();
  const ctx = loadRoute(actor, 'src/app/api/transaction/[id]/route.js');
  const res = await ctx.DELETE({}, { params: Promise.resolve({ id: 'TEST' }) });
  assert.equal(res.status, 403);
  assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
});

// --- 5. Explicit role check gating archive/report access regardless of client-supplied query params ---
test('KASIR passes the staff guard but is blocked from the archive tab (admin-only by explicit check)', async () => {
  const actor = makeActor(kasir());
  await actor.login();
  const ctx = loadRoute(actor, 'src/app/api/transaction/route.js');
  const res = await ctx.GET({ url: 'http://localhost:3000/api/transaction?tab=archive' });
  assert.equal(res.status, 403);
  assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
});

// --- 6. Anonymous customer hitting staff-only routes not already covered by trial-security.test.cjs ---
const STAFF_ONLY_UNCOVERED = [
  ['src/app/api/kitchen/route.js', 'GET', {}, undefined],
  ['src/app/api/kitchen/[id]/route.js', 'PUT', { json: async () => ({ expectedStatus: 'queued', status: 'accepted', expectedVersion: 0 }) }, { id: '1' }],
];
for (const [path, method, req, params] of STAFF_ONLY_UNCOVERED) {
  test(`Anonymous customer (no session) is rejected calling staff-only ${method} ${path}`, async () => {
    const actor = makeActor(null);
    const ctx = loadRoute(actor, path);
    const res = params ? await ctx[method](req, { params: Promise.resolve(params) }) : await ctx[method](req);
    assert.ok([401, 403].includes(res.status), `expected 401/403, got ${res.status}`);
    assert.equal(actor.calls.length, 0, `expected no prisma access before rejection, saw: ${actor.calls.join(', ')}`);
  });
}
