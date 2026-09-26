const prisma = require('../config/database');
const ledgerService = require('../services/ledgerService');
const { emitEvent } = require('../services/socketService');

const getDeliveries = async (req, res, next) => {
  try {
    const { status, customer, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (customer) where.customer_ref = { contains: customer, mode: 'insensitive' };

    const [total, deliveries] = await Promise.all([
      prisma.deliveryOrder.count({ where }),
      prisma.deliveryOrder.findMany({
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
      data: deliveries,
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

const getDeliveryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dId = parseInt(id, 10);

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id: dId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: true,
            location: { include: { warehouse: true } },
          },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' });
    }

    return res.json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};

const createDelivery = async (req, res, next) => {
  try {
    const { customer_ref, items } = req.body;

    if (!customer_ref || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Customer reference and at least one item are required' });
    }

    for (const item of items) {
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for product ${item.product_id}. Quantity must be positive.`,
        });
      }
      if (!item.location_id) {
        return res.status(400).json({
          success: false,
          message: 'Pick location is required for all items.',
        });
      }
    }

    const delivery = await prisma.deliveryOrder.create({
      data: {
        customer_ref: customer_ref.trim(),
        status: 'draft',
        created_by: req.user.id,
        items: {
          create: items.map((item) => ({
            product_id: parseInt(item.product_id, 10),
            location_id: parseInt(item.location_id, 10),
            quantity: parseFloat(item.quantity),
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
      message: 'Delivery order created',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

const updateDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dId = parseInt(id, 10);
    const { customer_ref, status, items } = req.body;

    const existing = await prisma.deliveryOrder.findUnique({
      where: { id: dId },
      include: { items: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' });
    }

    if (existing.status === 'done') {
      return res.status(400).json({ success: false, message: 'Validated delivery orders cannot be modified' });
    }

    const updateData = {};
    if (customer_ref) updateData.customer_ref = customer_ref.trim();
    if (status && ['draft', 'waiting', 'ready', 'canceled'].includes(status)) {
      updateData.status = status;
    }

    if (items && Array.isArray(items)) {
      await prisma.deliveryItem.deleteMany({ where: { delivery_order_id: dId } });
      updateData.items = {
        create: items.map((item) => ({
          product_id: parseInt(item.product_id, 10),
          location_id: parseInt(item.location_id, 10),
          quantity: Math.max(0.01, parseFloat(item.quantity)),
        })),
      };
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id: dId },
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

    return res.json({ success: true, message: 'Delivery order updated', data: updated });
  } catch (error) {
    next(error);
  }
};

const validateDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    const dId = parseInt(id, 10);

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id: dId },
      include: {
        items: {
          include: {
            product: true,
            location: true,
          },
        },
      },
    });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery order not found' });
    }

    if (delivery.status === 'done') {
      return res.status(400).json({ success: false, message: 'This delivery order has already been validated' });
    }

    if (delivery.status === 'canceled') {
      return res.status(400).json({ success: false, message: 'Cannot validate a canceled delivery order' });
    }

    if (!delivery.items || delivery.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cannot validate delivery with no items' });
    }

    // Check available stock from ledger for each item at its location
    const insufficientItems = [];
    for (const item of delivery.items) {
      const availableStock = await ledgerService.getDerivedStock(item.product_id, item.location_id);
      if (availableStock < item.quantity) {
        insufficientItems.push({
          product: item.product.name,
          sku: item.product.sku,
          location: item.location.name,
          available: availableStock,
          requested: item.quantity,
          shortage: item.quantity - availableStock,
        });
      }
    }

    if (insufficientItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot validate delivery: Insufficient stock in designated locations.',
        insufficientItems,
      });
    }

    // Execute atomic validation & write negative ledger entries
    const result = await prisma.$transaction(async (tx) => {
      for (const item of delivery.items) {
        // Write negative delta to stock_ledger
        await tx.stockLedger.create({
          data: {
            product_id: item.product_id,
            location_id: item.location_id,
            quantity_delta: -item.quantity, // Negative delta outgoing
            movement_type: 'delivery',
            reference_id: delivery.id,
            reference_type: 'delivery',
            created_by: req.user.id,
          },
        });
      }

      const validatedDelivery = await tx.deliveryOrder.update({
        where: { id: delivery.id },
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

      return validatedDelivery;
    });

    // Invalidate caches & trigger alerts
    for (const item of delivery.items) {
      await ledgerService.invalidateCacheForProduct(item.product_id);
      await ledgerService.checkAndEmitLowStockAlert(item.product_id);
    }

    // Emit live socket event
    emitEvent('delivery:validated', {
      deliveryId: result.id,
      customer: result.customer_ref,
      itemsCount: result.items.length,
      validatedBy: req.user.name,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      message: 'Delivery order validated successfully. Negative stock ledger entries recorded.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  validateDelivery,
};
