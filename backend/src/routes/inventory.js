const router = require('express').Router();
const prisma = require('../config/database');
const cache = require('../config/redis');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');
const { fail, stock, atomic, changed, refreshWaiting, positive } = require('../services/inventory');
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
router.use(authenticate);
const manager = requireRole(['manager']);
router.get('/products', wrap(async (req, res) => {
  const products = await prisma.product.findMany({ where: req.query.search ? { OR: ['name', 'sku'].map(k => ({ [k]: { contains: req.query.search, mode: 'insensitive' } })) } : {}, include: { category: true }, orderBy: { name: 'asc' } });
  const data = await Promise.all(products.map(async p => {
    const on_hand = await require('../services/ledgerService').getDerivedStock(p.id);
    const reserved = await prisma.deliveryItem.aggregate({ where: { product_id: p.id, deliveryOrder: { status: { in: ['draft', 'waiting', 'ready'] } } }, _sum: { quantity: true } });
    return { ...p, on_hand, current_stock: on_hand, free_to_use: on_hand - (reserved._sum.quantity || 0), stock_status: on_hand <= 0 ? 'out_of_stock' : on_hand <= p.reorder_threshold ? 'low_stock' : 'in_stock' };
  }));
  res.json({ success: true, data });
}));
router.post('/products', manager, wrap(async (req, res) => {
  const b = req.body;
  if (!b.name?.trim() || !b.sku?.trim() || !b.category_id) fail('Name, SKU and category are required');
  const cost = Number(b.per_unit_cost || 0), initial = Number(b.quantity || 0);
  if (![cost, initial].every(n => Number.isFinite(n) && n >= 0)) fail('Cost and initial quantity must be non-negative numbers');
  if (initial && !b.location_id) fail('Select a location for initial stock');
  const data = await atomic(async tx => {
    const p = await tx.product.create({ data: { name: b.name.trim(), sku: b.sku.trim().toUpperCase(), category_id: Number(b.category_id), unit_of_measure: b.unit_of_measure || 'units', per_unit_cost: cost }, include: { category: true } });
    if (initial) await tx.stockLedger.create({ data: { product_id: p.id, location_id: Number(b.location_id), quantity_delta: initial, movement_type: 'adjustment', reference_type: 'initial', reference_id: p.id, created_by: req.user.id } });
    await refreshWaiting(tx); return p;
  });
  await changed([data.id]); res.status(201).json({ success: true, data });
}));
router.put('/products/:id', manager, wrap(async (req, res) => {
  const data = {};
  for (const k of ['name', 'sku', 'unit_of_measure']) if (req.body[k]) data[k] = String(req.body[k]).trim();
  for (const k of ['category_id', 'per_unit_cost', 'reorder_threshold']) if (req.body[k] !== undefined) { data[k] = Number(req.body[k]); if (!Number.isFinite(data[k]) || data[k] < 0) fail('Invalid numeric value'); }
  const product = await prisma.product.update({ where: { id: Number(req.params.id) }, data });
  await changed([product.id]); res.json({ success: true, data: product });
}));
const adjust = wrap(async (req, res) => {
  const product_id = Number(req.params.id || req.body.product_id), location_id = Number(req.body.location_id), counted = Number(req.body.counted_quantity);
  if (req.body.counted_quantity === undefined || !Number.isFinite(counted) || counted < 0) fail('Counted quantity must be non-negative');
  const data = await atomic(async tx => {
    const current = await stock(tx, product_id, location_id);
    const adjustment = await tx.adjustment.create({ data: { product_id, location_id, counted_quantity: counted, system_quantity: current, delta: counted - current, reason: req.body.reason || 'Stock count', created_by: req.user.id } });
    await tx.stockLedger.create({ data: { product_id, location_id, quantity_delta: counted - current, movement_type: 'adjustment', reference_id: adjustment.id, reference_type: 'adjustment', created_by: req.user.id } });
    // A lower stock count may invalidate an existing reservation.
    const ready = await tx.deliveryOrder.findMany({ where: { status: 'ready' }, include: { items: true } });
    for (const d of ready) if (d.items.some(i => i.product_id === product_id && i.location_id === location_id)) await tx.deliveryOrder.update({ where: { id: d.id }, data: { status: 'waiting' } });
    await refreshWaiting(tx); return adjustment;
  });
  await changed([product_id], 'adjustment:created'); res.status(201).json({ success: true, data });
});
router.post('/products/:id/stock-update', manager, adjust);
router.post('/adjustments', manager, adjust);
for (const kind of ['warehouses', 'locations']) {
  const model = kind === 'warehouses' ? 'warehouse' : 'location';
  const include = model === 'warehouse' ? { locations: true } : { warehouse: true };
  router.get(`/${kind}`, wrap(async (req, res) => res.json({ success: true, data: await prisma[model].findMany({ include, orderBy: { name: 'asc' } }) })));
  router.get(`/${kind}/:id`, wrap(async (req, res) => {
    const data = await prisma[model].findUnique({ where: { id: Number(req.params.id) }, include });
    if (!data) fail('Record not found', 404);
    res.json({ success: true, data });
  }));
  router.delete(`/${kind}/:id`, manager, wrap(async (req, res) => {
    await atomic(async tx => {
      const id = Number(req.params.id);
      const where = model === 'warehouse' ? { location: { warehouse_id: id } } : { location_id: id };
      if (await tx.stockLedger.count({ where })) fail('Cannot delete a record with stock movement history');
      if (model === 'warehouse' && (await tx.receipt.count({ where: { warehouse_id: id } }) || await tx.deliveryOrder.count({ where: { warehouse_id: id } }))) fail('This warehouse is referenced by inventory documents');
      const locationIds = model === 'warehouse' ? (await tx.location.findMany({ where: { warehouse_id: id }, select: { id: true } })).map(l => l.id) : [id];
      if (await tx.receiptItem.count({ where: { location_id: { in: locationIds } } }) || await tx.deliveryItem.count({ where: { location_id: { in: locationIds } } }) || await tx.transfer.count({ where: { OR: [{ from_location_id: { in: locationIds } }, { to_location_id: { in: locationIds } }] } })) fail('Locations referenced by documents cannot be deleted');
      if (model === 'warehouse') await tx.location.deleteMany({where:{warehouse_id:id}});
      await tx[model].delete({ where: { id } });
    });
    await changed([]); res.json({ success: true });
  }));
  for (const method of ['post', 'put']) router[method](`/${kind}${method === 'put' ? '/:id' : ''}`, manager, wrap(async (req, res) => {
    const b = req.body;
    if (!b.name?.trim() || !/^[A-Za-z0-9_-]{1,12}$/.test(b.short_code || '')) fail('Name and a short code (1–12 letters, digits, _ or -) are required');
    const data = { name: b.name.trim(), short_code: b.short_code.trim(), ...(model === 'warehouse' ? { address: String(b.address || '') } : { warehouse_id: Number(b.warehouse_id) }) };
    // Location identity must not change under historical ledger entries.
    if (method === 'put' && model === 'location') {
      const old = await prisma.location.findUnique({ where: { id: Number(req.params.id) } });
      if (old && old.warehouse_id !== data.warehouse_id && await prisma.stockLedger.count({ where: { location_id: old.id } })) fail('Cannot move a location with stock history to another warehouse');
    }
    const result = method === 'post' ? await prisma[model].create({ data, include }) : await prisma[model].update({ where: { id: Number(req.params.id) }, data, include });
    res.json({ success: true, data: result });
  }));
}
router.get('/dashboard/stats', wrap(async (req, res) => {
  const cached = await cache.get('dashboard:stats'); if (cached) return res.json({ success: true, data: JSON.parse(cached) });
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const stats = async model => { const rows = await prisma[model].findMany({ where: { status: { notIn: ['done', 'canceled'] } } }); return { count: rows.length, late: rows.filter(d => d.schedule_date < today).length, waiting: rows.filter(d => d.status === 'waiting').length, operations: rows.filter(d => d.schedule_date >= tomorrow).length }; };
  const data = { receipts: await stats('receipt'), deliveries: await stats('deliveryOrder'), products: await prisma.product.count(), warehouses: await prisma.warehouse.count() };
  await cache.set('dashboard:stats', JSON.stringify(data), 'EX', 30); res.json({ success: true, data });
}));
router.get('/move-history', wrap(async (req, res) => {
  const where = {};
  if (req.query.type) where.movement_type = req.query.type;
  if (req.query.from || req.query.to) where.created_at = { ...(req.query.from && { gte: new Date(req.query.from) }), ...(req.query.to && { lte: new Date(`${req.query.to}T23:59:59.999Z`) }) };
  const entries = await prisma.stockLedger.findMany({ where, include: { product: true, location: { include: { warehouse: true } } }, orderBy: { id: 'desc' } });
  let data = await Promise.all(entries.map(async e => {
    const model = { receipt: 'receipt', delivery: 'deliveryOrder', transfer: 'transfer' }[e.movement_type];
    const doc = model && e.reference_id ? await prisma[model].findUnique({ where: { id: e.reference_id }, ...(model === 'transfer' && { include: { fromLocation: { include: { warehouse: true } }, toLocation: { include: { warehouse: true } } } }) }) : null;
    const label = l => `${l.warehouse.short_code}/${l.short_code}`;
    const contact = doc?.contact || doc?.supplier_name || doc?.customer_ref || '';
    return { ...e, reference: doc?.reference || `${doc?.fromLocation?.warehouse.short_code || e.location.warehouse.short_code}/${e.movement_type === 'transfer' ? 'INT' : 'ADJ'}/${String(e.reference_id || e.id).padStart(4, '0')}`, date: e.created_at, contact, status: 'done', quantity: Math.abs(e.quantity_delta), direction: e.quantity_delta >= 0 ? 'in' : 'out', from: doc?.fromLocation ? label(doc.fromLocation) : e.quantity_delta >= 0 ? contact || 'Inventory adjustment' : label(e.location), to: doc?.toLocation ? label(doc.toLocation) : e.quantity_delta >= 0 ? label(e.location) : contact || 'Inventory adjustment' };
  }));
  if (req.query.search) { const q = req.query.search.toLowerCase(); data = data.filter(e => `${e.reference} ${e.contact}`.toLowerCase().includes(q)); }
  if (req.query.status && req.query.status !== 'done') data = [];
  res.json({ success: true, data });
}));
// Transfer validation shares the same stock lock as all other ledger writers.
for (const method of ['post', 'put']) router[method](`/transfers${method === 'put' ? '/:id' : ''}`, wrap(async (req, res) => {
  const data = await atomic(async tx => {
    const existing = method === 'put' ? await tx.transfer.findUnique({ where: { id: Number(req.params.id) } }) : null;
    if (method === 'put' && (!existing || existing.status !== 'draft')) fail('Only draft transfers can be edited', 409);
    const b = { ...existing, ...req.body };
    const from_location_id = Number(b.from_location_id), to_location_id = Number(b.to_location_id);
    if (!from_location_id || !to_location_id || from_location_id === to_location_id) fail('Select two different locations');
    if (b.status && !['draft', 'canceled'].includes(b.status)) fail('Use validation to complete a transfer');
    if (!Array.isArray(req.body.items) || !req.body.items.length) fail('Add at least one product line');
    const items = req.body.items.map(i => ({ product_id: Number(i.product_id), quantity: positive(i.quantity) }));
    const payload = { from_location_id, to_location_id, status: b.status || 'draft', items: { ...(existing && { deleteMany: {} }), create: items } };
    const include = { items: { include: { product: true } }, fromLocation: { include: { warehouse: true } }, toLocation: { include: { warehouse: true } } };
    return existing ? tx.transfer.update({ where: { id: existing.id }, data: payload, include }) : tx.transfer.create({ data: { ...payload, created_by: req.user.id }, include });
  });
  await changed([]); res.status(method === 'post' ? 201 : 200).json({ success: true, data });
}));
router.post('/transfers/:id/validate', wrap(async (req, res) => {
  const data = await atomic(async tx => {
    const d = await tx.transfer.findUnique({ where: { id: Number(req.params.id) }, include: { items: true } });
    if (!d || ['done', 'canceled'].includes(d.status)) fail('Transfer is unavailable for validation', 409);
    if (!d.items.length || d.from_location_id === d.to_location_id) fail('Transfer requires items and two different locations');
    const totals = new Map();
    for (const i of d.items) totals.set(i.product_id, (totals.get(i.product_id) || 0) + positive(i.quantity));
    for (const [id, qty] of totals) {
      const reserved = await tx.deliveryItem.aggregate({ where: { product_id: id, location_id: d.from_location_id, deliveryOrder: { status: 'ready' } }, _sum: { quantity: true } });
      if (qty > await stock(tx, id, d.from_location_id) - (reserved._sum.quantity || 0)) fail('Insufficient unreserved stock', 409);
    }
    for (const i of d.items) for (const [location_id, sign] of [[d.from_location_id, -1], [d.to_location_id, 1]]) await tx.stockLedger.create({ data: { product_id: i.product_id, location_id, quantity_delta: sign * i.quantity, movement_type: 'transfer', reference_id: d.id, reference_type: 'transfer', created_by: req.user.id } });
    const result = await tx.transfer.update({ where: { id: d.id }, data: { status: 'done' }, include: { items: true } });
    await refreshWaiting(tx); return result;
  });
  await changed(data.items.map(i => i.product_id), 'transfer:validated'); res.json({ success: true, data });
}));
module.exports = router;
