const routerFactory = (incoming) => {
  const router = require('express').Router();
  const prisma = require('../config/database');
  const { authenticate } = require('../middlewares/auth');
  const { fail, positive, atomic, reference, changed, shortages, refreshWaiting } = require('../services/inventory');
  const model = incoming ? 'receipt' : 'deliveryOrder';
  const contactField = incoming ? 'supplier_name' : 'customer_ref';
  const qtyField = incoming ? 'quantity_expected' : 'quantity';
  const include = { creator: { select: { id: true, name: true } }, items: { include: { product: true, location: { include: { warehouse: true } } } } };
  const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
  const lines = async (tx, items, warehouseId) => {
    if (!Array.isArray(items)) fail('Items must be an array');
    const result = [];
    for (const item of items) {
      const loc = await tx.location.findUnique({ where: { id: Number(item.location_id) } });
      if (!loc || loc.warehouse_id !== warehouseId) fail('Every line must use a location in the selected warehouse');
      result.push({ product_id: Number(item.product_id), location_id: loc.id, [qtyField]: positive(item[qtyField] ?? item.quantity) });
    }
    return result;
  };
  const fields = (body, user) => {
    const date = new Date(body.schedule_date || Date.now());
    if (Number.isNaN(date.getTime())) fail('Invalid schedule date');
    return { [contactField]: String(body[contactField] || ''), contact: String(body.contact || body[contactField] || ''), responsible: String(body.responsible ?? user.name), schedule_date: date, ...(!incoming && { delivery_address: String(body.delivery_address || ''), operation_type: String(body.operation_type || 'Delivery') }) };
  };
  router.use(authenticate);
  router.get('/', wrap(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.search) where.OR = ['reference', 'contact', contactField].map(k => ({ [k]: { contains: req.query.search, mode: 'insensitive' } }));
    const data = await prisma[model].findMany({ where, include, orderBy: { id: 'desc' } });
    res.json({ success: true, data });
  }));
  router.get('/:id', wrap(async (req, res) => {
    const data = await prisma[model].findUnique({ where: { id: Number(req.params.id) }, include });
    if (!data) fail('Document not found', 404);
    res.json({ success: true, data });
  }));
  router.post('/', wrap(async (req, res) => {
    const data = await atomic(async tx => {
      const warehouse_id = Number(req.body.warehouse_id);
      return tx[model].create({ data: { ...fields(req.body, req.user), warehouse_id, reference: await reference(tx, warehouse_id, incoming ? 'IN' : 'OUT'), created_by: req.user.id, items: { create: await lines(tx, req.body.items || [], warehouse_id) } }, include });
    });
    await changed([]); res.status(201).json({ success: true, data });
  }));
  for (const action of ['edit', 'lines', 'advance', 'validate', 'cancel']) {
    router[action === 'edit' ? 'put' : 'post'](action === 'edit' ? '/:id' : `/:id/${action}`, wrap(async (req, res) => {
      const result = await atomic(async tx => {
        const doc = await tx[model].findUnique({ where: { id: Number(req.params.id) }, include });
        if (!doc) fail('Document not found', 404);
        if (['done', 'canceled'].includes(doc.status)) fail('Completed or canceled documents are immutable', 409);
        let update = {}, short = [];
        if (action === 'edit' || action === 'lines') {
          if (doc.status !== 'draft') fail('Only draft documents can be edited', 409);
          if (req.body.status || req.body.reference || req.body.warehouse_id && Number(req.body.warehouse_id) !== doc.warehouse_id) fail('Reference, warehouse and status cannot be edited');
          if (action === 'lines') update.items = { create: await lines(tx, [req.body], doc.warehouse_id) };
          else {
            update = fields({ ...doc, ...req.body }, req.user);
            if (req.body.items) update.items = { deleteMany: {}, create: await lines(tx, req.body.items, doc.warehouse_id) };
          }
        } else if (action === 'cancel') update.status = 'canceled';
        else {
          if (!doc.items.length || !doc[contactField].trim()) fail('Add a contact and at least one product line first');
          if (action === 'advance') {
            if (!['draft', 'waiting'].includes(doc.status)) fail('Document has already been marked ready');
            if (!incoming) short = await shortages(tx, doc.items, doc.id);
            update.status = short.length ? 'waiting' : 'ready';
          } else {
            if (incoming && doc.status !== 'ready') fail('Mark this receipt To Do before validation', 409);
            if (!incoming && doc.status === 'draft') fail('Mark this delivery To Do before validation', 409);
            if (!incoming) short = await shortages(tx, doc.items, doc.id);
            update.status = short.length ? 'waiting' : 'done';
            if (!short.length) {
              for (const item of doc.items) {
                await tx.stockLedger.create({ data: { product_id: item.product_id, location_id: item.location_id, quantity_delta: (incoming ? 1 : -1) * item[qtyField], movement_type: incoming ? 'receipt' : 'delivery', reference_id: doc.id, reference_type: incoming ? 'receipt' : 'delivery', created_by: req.user.id } });
                if (incoming) await tx.receiptItem.update({ where: { id: item.id }, data: { quantity_received: item.quantity_expected } });
              }
            }
          }
        }
        const data = await tx[model].update({ where: { id: doc.id }, data: update, include });
        await refreshWaiting(tx);
        return { data, insufficientItems: short };
      });
      await changed(result.data.items.map(i => i.product_id), result.data.status === 'done' ? `${incoming ? 'receipt' : 'delivery'}:validated` : 'inventory:changed');
      res.status(result.insufficientItems.length && action === 'validate' ? 409 : 200).json({ success: !result.insufficientItems.length, ...result, message: result.insufficientItems.length ? 'Insufficient stock. Delivery is Waiting.' : 'Document saved' });
    }));
  }
  return router;
};
module.exports = routerFactory;
