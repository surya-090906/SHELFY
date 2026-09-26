const prisma = require('../config/database');
const ledgerService = require('../services/ledgerService');
const { emitEvent } = require('../services/socketService');

const getAdjustments = async (req, res, next) => {
  try {
    const { productId, locationId, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (productId) where.product_id = parseInt(productId, 10);
    if (locationId) where.location_id = parseInt(locationId, 10);

    const [total, adjustments] = await Promise.all([
      prisma.adjustment.count({ where }),
      prisma.adjustment.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
          location: {
            include: { warehouse: { select: { id: true, name: true } } },
          },
        },
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      data: adjustments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

const createAdjustment = async (req, res, next) => {
  try {
    const { product_id, location_id, counted_quantity, reason } = req.body;

    if (!product_id || !location_id || counted_quantity === undefined || counted_quantity === null) {
      return res.status(400).json({
        success: false,
        message: 'Product, location, and counted quantity are required.',
      });
    }

    const pId = parseInt(product_id, 10);
    const lId = parseInt(location_id, 10);
    const counted = parseFloat(counted_quantity);

    if (isNaN(counted) || counted < 0) {
      return res.status(400).json({
        success: false,
        message: 'Counted quantity must be a non-negative number.',
      });
    }

    // 1. Fetch current derived system stock from immutable ledger
    const systemQty = await ledgerService.getDerivedStock(pId, lId);
    const delta = counted - systemQty;

    // Execute atomic transaction: record adjustment row and write delta to stock_ledger
    const result = await prisma.$transaction(async (tx) => {
      const adj = await tx.adjustment.create({
        data: {
          product_id: pId,
          location_id: lId,
          system_quantity: systemQty,
          counted_quantity: counted,
          delta,
          reason: reason ? reason.trim() : null,
          created_by: req.user.id,
        },
        include: {
          product: true,
          location: { include: { warehouse: true } },
        },
      });

      // Write ONLY the delta to stock_ledger if delta != 0
      if (delta !== 0) {
        await tx.stockLedger.create({
          data: {
            product_id: pId,
            location_id: lId,
            quantity_delta: delta,
            movement_type: 'adjustment',
            reference_id: adj.id,
            reference_type: 'adjustment',
            created_by: req.user.id,
          },
        });
      }

      return adj;
    });

    // Invalidate Redis cache & check reorder alert
    await ledgerService.invalidateCacheForProduct(pId);
    await ledgerService.checkAndEmitLowStockAlert(pId);

    // Emit live event
    emitEvent('adjustment:created', {
      adjustmentId: result.id,
      product: result.product.name,
      location: result.location.name,
      systemQty,
      counted,
      delta,
      createdBy: req.user.name,
      timestamp: new Date().toISOString(),
    });

    return res.status(201).json({
      success: true,
      message: `Stock adjusted successfully. Delta (${delta >= 0 ? '+' : ''}${delta}) applied to ledger.`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAdjustments,
  createAdjustment,
};
