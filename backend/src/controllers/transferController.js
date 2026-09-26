const prisma = require('../config/database');
const ledgerService = require('../services/ledgerService');
const { emitEvent } = require('../services/socketService');

const getTransfers = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;

    const [total, transfers] = await Promise.all([
      prisma.transfer.count({ where }),
      prisma.transfer.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          fromLocation: {
            include: { warehouse: { select: { id: true, name: true, short_code: true } } },
          },
          toLocation: {
            include: { warehouse: { select: { id: true, name: true, short_code: true } } },
          },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      data: transfers,
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

const getTransferById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tId = parseInt(id, 10);

    const transfer = await prisma.transfer.findUnique({
      where: { id: tId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        fromLocation: { include: { warehouse: true } },
        toLocation: { include: { warehouse: true } },
        items: { include: { product: true } },
      },
    });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    return res.json({ success: true, data: transfer });
  } catch (error) {
    next(error);
  }
};

const createTransfer = async (req, res, next) => {
  try {
    const { from_location_id, to_location_id, items } = req.body;

    if (!from_location_id || !to_location_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Origin location, destination location, and at least one item are required.',
      });
    }

    const fromId = parseInt(from_location_id, 10);
    const toId = parseInt(to_location_id, 10);

    if (fromId === toId) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination locations cannot be the same.',
      });
    }

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${item.product_id}. Quantity must be positive.`,
        });
      }
    }

    const transfer = await prisma.transfer.create({
      data: {
        from_location_id: fromId,
        to_location_id: toId,
        status: 'draft',
        created_by: req.user.id,
        items: {
          create: items.map((item) => ({
            product_id: parseInt(item.product_id, 10),
            quantity: parseFloat(item.quantity),
          })),
        },
      },
      include: {
        fromLocation: { include: { warehouse: true } },
        toLocation: { include: { warehouse: true } },
        items: { include: { product: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Internal transfer draft created',
      data: transfer,
    });
  } catch (error) {
    next(error);
  }
};

const updateTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tId = parseInt(id, 10);
    const { from_location_id, to_location_id, status, items } = req.body;

    const existing = await prisma.transfer.findUnique({ where: { id: tId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (existing.status === 'done') {
      return res.status(400).json({ success: false, message: 'Validated transfers cannot be modified' });
    }

    const updateData = {};
    if (from_location_id) updateData.from_location_id = parseInt(from_location_id, 10);
    if (to_location_id) updateData.to_location_id = parseInt(to_location_id, 10);
    if (status && ['draft', 'waiting', 'ready', 'canceled'].includes(status)) {
      updateData.status = status;
    }

    if (items && Array.isArray(items)) {
      await prisma.transferItem.deleteMany({ where: { transfer_id: tId } });
      updateData.items = {
        create: items.map((item) => ({
          product_id: parseInt(item.product_id, 10),
          quantity: Math.max(0.01, parseFloat(item.quantity)),
        })),
      };
    }

    const updated = await prisma.transfer.update({
      where: { id: tId },
      data: updateData,
      include: {
        fromLocation: { include: { warehouse: true } },
        toLocation: { include: { warehouse: true } },
        items: { include: { product: true } },
      },
    });

    return res.json({ success: true, message: 'Transfer updated', data: updated });
  } catch (error) {
    next(error);
  }
};

const validateTransfer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tId = parseInt(id, 10);

    const transfer = await prisma.transfer.findUnique({
      where: { id: tId },
      include: {
        items: { include: { product: true } },
        fromLocation: true,
        toLocation: true,
      },
    });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    if (transfer.status === 'done') {
      return res.status(400).json({ success: false, message: 'This transfer has already been completed' });
    }

    if (transfer.status === 'canceled') {
      return res.status(400).json({ success: false, message: 'Cannot validate a canceled transfer' });
    }

    // Verify stock at source location
    const shortages = [];
    for (const item of transfer.items) {
      const sourceStock = await ledgerService.getDerivedStock(item.product_id, transfer.from_location_id);
      if (sourceStock < item.quantity) {
        shortages.push({
          product: item.product.name,
          sku: item.product.sku,
          location: transfer.fromLocation.name,
          available: sourceStock,
          requested: item.quantity,
          shortage: item.quantity - sourceStock,
        });
      }
    }

    if (shortages.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot execute transfer: Insufficient stock at source location.',
        shortages,
      });
    }

    // Atomic transaction: write paired ledger entries (-qty from source, +qty to destination)
    const result = await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // Source location: negative delta
        await tx.stockLedger.create({
          data: {
            product_id: item.product_id,
            location_id: transfer.from_location_id,
            quantity_delta: -item.quantity,
            movement_type: 'transfer',
            reference_id: transfer.id,
            reference_type: 'transfer',
            created_by: req.user.id,
          },
        });

        // Destination location: positive delta
        await tx.stockLedger.create({
          data: {
            product_id: item.product_id,
            location_id: transfer.to_location_id,
            quantity_delta: item.quantity,
            movement_type: 'transfer',
            reference_id: transfer.id,
            reference_type: 'transfer',
            created_by: req.user.id,
          },
        });
      }

      const completed = await tx.transfer.update({
        where: { id: transfer.id },
        data: { status: 'done' },
        include: {
          fromLocation: { include: { warehouse: true } },
          toLocation: { include: { warehouse: true } },
          items: { include: { product: true } },
        },
      });

      return completed;
    });

    for (const item of transfer.items) {
      await ledgerService.invalidateCacheForProduct(item.product_id);
      await ledgerService.checkAndEmitLowStockAlert(item.product_id);
    }

    emitEvent('transfer:validated', {
      transferId: result.id,
      from: result.fromLocation.name,
      to: result.toLocation.name,
      itemsCount: result.items.length,
      validatedBy: req.user.name,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Transfer executed successfully. Paired ledger entries recorded.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTransfers,
  getTransferById,
  createTransfer,
  updateTransfer,
  validateTransfer,
};
