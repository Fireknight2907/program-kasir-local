const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createHash } = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../../src/app/api/order/route.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export (const|async function)/g, '$1');
function setup(sessions, failOrder = false, menu = [{ id: 1, price: 10000, isAvailable: true }]) {
  let state = { sessions: structuredClone(sessions), orders: [], receipts: [] };
  let tail = Promise.resolve(), requestNumber = 0, orderNumber = 0;
  // Top-level (pre-transaction) reads see only committed `state`, mirroring a real DB
  // where reads outside a lock can't see another in-flight transaction's uncommitted draft.
  const prisma = {
    transaction: { async findUnique({ where }) { return state.sessions.find(s => s.id === where.id); } },
    menuItem: { async findMany({ where }) { return menu.filter(m => where.id.in.includes(m.id)); } },
    orderSubmission: { async findUnique({ where }) { const key = where.transactionId_requestId; return state.receipts.find(r => r.transactionId === key.transactionId && r.requestId === key.requestId); } },
    async $transaction(callback) {
    let unlock, draft;
    try {
      const tx = {
        // The advisory lock is the real serialization point (acquired before the idempotency
        // doubleCheck), so the draft snapshot must be taken here, not at updateMany.
        $executeRaw: async () => {
          const previous = tail; tail = new Promise(resolve => { unlock = resolve; }); await previous;
          draft = structuredClone(state);
        },
        transaction: {
          async updateMany({ where }) {
            return { count: draft.sessions.some(s => s.id === where.id) ? 1 : 0 };
          },
          async findUnique({ where }) { return draft.sessions.find(s => s.id === where.id); },
          async update({ where, data }) { const s = draft.sessions.find(s => s.id === where.id); s.total += data.total.increment; s.status = data.status; s.revision = (s.revision || 0) + data.revision.increment; return s; }
        },
        menuItem: { async findMany({ where }) { return menu.filter(m => where.id.in.includes(m.id)); } },
        orderItem: { async aggregate({ where }) { return { _sum: { quantity: draft.orders.filter(o => o.transactionId === where.order.transactionId).reduce((sum, o) => sum + o.items.create.reduce((s,i) => s+i.quantity,0),0) } }; } },
        orderSubmission: {
          async findUnique({ where }) { const key = where.transactionId_requestId; return draft.receipts.find(r => r.transactionId === key.transactionId && r.requestId === key.requestId); },
          async findMany({ where }) { return draft.receipts.filter(r => r.transactionId === where.transactionId && r.createdAt >= where.createdAt.gte).sort((a, b) => a.createdAt - b.createdAt).map(r => ({ createdAt: r.createdAt })); },
          async aggregate({ where }) { return { _sum: { quantity: draft.receipts.filter(r => r.transactionId === where.transactionId).reduce((s,r) => s+r.quantity,0) } }; },
          async create({ data }) { draft.receipts.push({ ...data, createdAt: new Date() }); }
        },
        order: { async create({ data }) { if (failOrder) throw Error('Simulated write failure'); const o = { id: ++orderNumber, ...data }; draft.orders.push(o); return o; } }
      };
      const result = await callback(tx); state = draft; return result;
    } finally { unlock?.(); }
  } };
  const context = vm.createContext({ prisma, createHash, ORDER_LIMITS: { perMenu: 10, perSubmission: 30, perSession: 100, perMinute: 5 }, console: { error() {} }, NextResponse: { json: (body, opts={}) => ({ body, status: opts.status || 200 }) } });
  vm.runInContext(source, context);
  return {
    send: (transactionId='old', items=[{ menuItemId:1, quantity:2, price:10000 }], requestId='request-number-' + String(++requestNumber).padStart(8,'0'), isTakeaway=false) => context.POST({ json: async () => ({ transactionId, requestId, items, isTakeaway }) }),
    raw: body => context.POST({ json: async () => body }),
    state: () => ({ sessions: state.sessions, orders: state.orders, receipts: state.receipts }),
    ageReceipts: () => { state.receipts.forEach(r => { r.createdAt = new Date(0); }); }
  };
}
module.exports = { setup };
