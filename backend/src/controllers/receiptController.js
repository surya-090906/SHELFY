const prisma = require('../config/database');
const ledgerService = require('../services/ledgerService');
const { emitEvent } = require('../services/socketService');

const getReceipts = async (req, res, next) => {
  try {
    const { status, supplier, startDate, endDate, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (supplier) {
      where.supplier_name = { contains: supplier, mode: 'insensitive' };
    }
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, unit_of_measure: true } },
              location: {
                select: { id: true, name: true, warehouse: { select: { id: true, name: true } } },
              },
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
      data: receipts,
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

const getReceiptById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rId = parseInt(id, 10);

    const receipt = await prisma.receipt.findUnique({
      where: { id: rId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: true,
            location: {
              include: { warehouse: true },
            },
          },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    return res.json({ success: true, data: receipt });
  } catch (error) {
    next(error);
  }
};

const createReceipt = async (req, res, next) => {
  try {
    const { supplier_name, items } = req.body;

    if (!supplier_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Supplier name and at least one item are required' });
    }

    // Validate quantities
    for (const item of items) {
      const qty = parseFloat(item.quantity_expected);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ID ${item.product_id}. Quantity must be positive.`,
        });
      }
      if (!item.location_id) {
        return res.status(400).json({
          success: false,
          message: 'Destination location is required for each receipt item.',
        });
      }
    }

    const receipt = await prisma.receipt.create({
      data: {
        supplier_name: supplier_name.trim(),
        status: 'draft',
        created_by: req.user.id,
        items: {
          create: items.map((item) => ({
            product_id: parseInt(item.product_id, 10),
            location_id: parseInt(item.location_id, 10),
            quantity_expected: parseFloat(item.quantity_expected),
            quantity_received: 0,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: true,
            location: { include: { warehouse: true } },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Receipt draft created',
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
};

const updateReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rId = parseInt(id, 10);
    const { supplier_name, status, items } = req.body;

    const existing = await prisma.receipt.findUnique({
      where: { id: rId },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (existing.status === 'done') {
      return res.status(400).json({ success: false, message: 'Validated receipts cannot be modified' });
    }

    const updateData = {};
    if (supplier_name) updateData.supplier_name = supplier_name.trim();
    if (status && ['draft', 'waiting', 'ready', 'canceled'].includes(status)) {
      updateData.status = status;
    }

    // If items are provided and receipt is still draft/waiting/ready
    if (items && Array.isArray(items)) {
      // Delete existing and recreate
      await prisma.receiptItem.deleteMany({ where: { receipt_id: rId } });
      updateData.items = {
        create: items.map((item) => ({
          product_id: parseInt(item.product_id, 10),
          location_id: parseInt(item.location_id, 10),
          quantity_expected: Math.max(0.01, parseFloat(item.quantity_expected)),
          quantity_received: parseFloat(item.quantity_received || 0),
        })),
      };
    }

    const updated = await prisma.receipt.update({
      where: { id: rId },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
            location: { include: { warehouse: true } },
          },
        },
      },
    });

    return res.json({ success: true, message: 'Receipt updated', data: updated });
  } catch (error) {
    next(error);
  }
};

const validateReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rId = parseInt(id, 10);

    const receipt = await prisma.receipt.findUnique({
      where: { id: rId },
      include: {
        items: {
          include: { product: true, location: true },
        },
      },
    });

    if (!receipt) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }

    if (receipt.status === 'done') {
      return res.status(400).json({ success: false, message: 'This receipt has already been validated' });
    }

    if (receipt.status === 'canceled') {
      return res.status(400).json({ success: false, message: 'Cannot validate a canceled receipt' });
    }

    if (!receipt.items || receipt.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot validate receipt with no items' });
    }

    // Execute atomic validation & write immutable ledger entries
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update receipt items received qty to expected (or given)
      for (const item of receipt.items) {
        const receivedQty = item.quantity_received > 0 ? item.quantity_received : item.quantity_expected;
        await tx.receiptItem.update({
          where: { id: item.id },
          data: { quantity_received: receivedQty },
        });

        // 2. Write immutable row to stock_ledger
        await tx.stockLedger.create({
          data: {
            product_id: item.product_id,
            location_id: item.location_id,
            quantity_delta: receivedQty, // Positive delta incoming
            movement_type: 'receipt',
            reference_id: receipt.id,
            reference_type: 'receipt',
            created_by: req.user.id,
          },
        });
      }

      // 3. Mark receipt as done
      const validatedReceipt = await tx.receipt.update({
        where: { id: receipt.id },
        data: { status: 'done' },
        include: {
          items: {
            include: {
              product: true,
              location: { include: { warehouse: true } },
            },
          },
        },
      });

      return validatedReceipt;
    });

    // 4. Invalidate caches & check alerts
    for (const item of receipt.items) {
      await ledgerService.invalidateCacheForProduct(item.product_id);
      await ledgerService.checkAndEmitLowStockAlert(item.product_id);
    }

    // 5. Emit socket event
    emitEvent('receipt:validated', {
      receiptId: result.id,
      supplier: result.supplier_name,
      itemsCount: result.items.length,
      validatedBy: req.user.name,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Receipt validated successfully. Stock ledger entries recorded.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  validateReceipt,
};
