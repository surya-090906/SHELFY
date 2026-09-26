const prisma = require('../config/database');
const cache = require('../config/redis');
const ledger = require('./ledgerService');
const { emitEvent } = require('./socketService');
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const positive = value => { const n = Number(value); if (!Number.isFinite(n) || n <= 0) fail('Quantity must be a finite positive number'); return n; };
const stock = async (tx, product_id, location_id) => (await tx.stockLedger.aggregate({ where: { product_id, location_id }, _sum: { quantity_delta: true } }))._sum.quantity_delta || 0;
// All stock writers take the same transaction-scoped lock before reading balances.
// This also serializes document edits/validation and reference allocation.
const atomic = fn => prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(731942, ${require('../config/tenant').current().tenant_id}::integer)`; return fn(tx); }, { timeout: 20000 });
const reference = async (tx, warehouse_id, type) => {
  const wh = await tx.warehouse.findUnique({ where: { id: Number(warehouse_id) } });
  if (!wh) fail('Select a valid warehouse');
  const key = `${require('../config/tenant').current().tenant_id}/${wh.id}/${type}`;
  const counter = await tx.referenceCounter.upsert({ where: { key }, create: { key, value: 1 }, update: { value: { increment: 1 } } });
  return `${wh.short_code}/${type}/${String(counter.value).padStart(4, '0')}`;
};
const changed = async (ids, event = 'inventory:changed') => {
  for (const id of new Set(ids)) { await ledger.invalidateCacheForProduct(id); await ledger.checkAndEmitLowStockAlert(id); }
  await cache.del('dashboard:stats', 'dashboard:kpis');
  emitEvent(event, {}); emitEvent('inventory:changed', {});
};
const shortages = async (tx, items, excludeId) => {
  const groups = new Map();
  for (const line of items) { const key = `${line.product_id}:${line.location_id}`; const g = groups.get(key) || { product_id: line.product_id, location_id: line.location_id, requested: 0 }; g.requested += line.quantity; groups.set(key, g); }
  const short = [];
  for (const g of groups.values()) {
    const reserved = await tx.deliveryItem.aggregate({ where: { product_id: g.product_id, location_id: g.location_id, deliveryOrder: { status: 'ready', id: { not: excludeId } } }, _sum: { quantity: true } });
    g.available = await stock(tx, g.product_id, g.location_id) - (reserved._sum.quantity || 0);
    if (g.requested > g.available) short.push(g);
  }
  return short;
};
const refreshWaiting = async tx => {
  const waiting = await tx.deliveryOrder.findMany({ where: { status: 'waiting' }, include: { items: true }, orderBy: { id: 'asc' } });
  for (const d of waiting) if (!(await shortages(tx, d.items, d.id)).length) await tx.deliveryOrder.update({ where: { id: d.id }, data: { status: 'ready' } });
};
module.exports = { fail, positive, stock, atomic, reference, changed, shortages, refreshWaiting };
