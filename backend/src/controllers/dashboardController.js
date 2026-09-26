const prisma = require('../config/database');
const redis = require('../config/redis');
const ledgerService = require('../services/ledgerService');

const getDashboardKPIs = async (req, res, next) => {
  try {
    const cacheKey = 'dashboard:kpis';
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        return res.json({
          success: true,
          fromCache: true,
          data: JSON.parse(cached),
        });
      } catch (e) {
        // Cache parse error, recompute
      }
    }

    // 1. Total products
    const totalProducts = await prisma.product.count();

    // 2. Pending receipts (draft, waiting, ready)
    const pendingReceipts = await prisma.receipt.count({
      where: { status: { in: ['draft', 'waiting', 'ready'] } },
    });

    // 3. Pending deliveries
    const pendingDeliveries = await prisma.deliveryOrder.count({
      where: { status: { in: ['draft', 'waiting', 'ready'] } },
    });

    // 4. Scheduled/pending transfers
    const scheduledTransfers = await prisma.transfer.count({
      where: { status: { in: ['draft', 'waiting', 'ready'] } },
    });

    // 5. Compute low/out of stock count & products overview
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        reorder_threshold: true,
        category: { select: { id: true, name: true } },
      },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;

    const stockPerCategory = {};

    for (const prod of allProducts) {
      const stock = await ledgerService.getDerivedStock(prod.id);
      const catName = prod.category ? prod.category.name : 'Uncategorized';
      stockPerCategory[catName] = (stockPerCategory[catName] || 0) + stock;

      if (stock <= 0) {
        outOfStockCount++;
      } else if (stock <= prod.reorder_threshold) {
        lowStockCount++;
      } else {
        inStockCount++;
      }
    }

    // Recent 7 days ledger activity for trend charts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentLedger = await prisma.stockLedger.findMany({
      where: {
        created_at: { gte: sevenDaysAgo },
      },
      select: {
        movement_type: true,
        quantity_delta: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    });

    // Aggregate movements by day
    const dayMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dayMap[dateStr] = { date: dateStr, receipt: 0, delivery: 0, transfer: 0, adjustment: 0 };
    }

    recentLedger.forEach((entry) => {
      const dateStr = entry.created_at.toISOString().split('T')[0];
      if (dayMap[dateStr]) {
        const type = entry.movement_type;
        const absQty = Math.abs(entry.quantity_delta);
        if (dayMap[dateStr][type] !== undefined) {
          dayMap[dateStr][type] += absQty;
        }
      }
    });

    const movementTrends = Object.values(dayMap);

    const categoryDistribution = Object.entries(stockPerCategory).map(([name, value]) => ({
      name,
      value: Math.max(0, value),
    }));

    const kpiData = {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      inStockCount,
      pendingReceipts,
      pendingDeliveries,
      scheduledTransfers,
      categoryDistribution,
      movementTrends,
      generatedAt: new Date().toISOString(),
    };

    // Cache in Redis with 30s TTL
    await redis.set(cacheKey, JSON.stringify(kpiData), 'EX', 30);

    return res.json({
      success: true,
      fromCache: false,
      data: kpiData,
    });
  } catch (error) {
    next(error);
  }
};

const getMoveHistory = async (req, res, next) => {
  try {
    const {
      movementType,
      productId,
      warehouseId,
      locationId,
      categoryId,
      startDate,
      endDate,
      page = 1,
      limit = 25,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};

    if (movementType && ['receipt', 'delivery', 'transfer', 'adjustment'].includes(movementType)) {
      where.movement_type = movementType;
    }

    if (productId) {
      where.product_id = parseInt(productId, 10);
    }

    if (locationId) {
      where.location_id = parseInt(locationId, 10);
    } else if (warehouseId) {
      where.location = {
        warehouse_id: parseInt(warehouseId, 10),
      };
    }

    if (categoryId) {
      where.product = {
        category_id: parseInt(categoryId, 10),
      };
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const [total, entries] = await Promise.all([
      prisma.stockLedger.count({ where }),
      prisma.stockLedger.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true, email: true } },
          product: {
            include: { category: true },
          },
          location: {
            include: { warehouse: true },
          },
        },
        skip,
        take: limitNum,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      data: entries,
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

module.exports = {
  getDashboardKPIs,
  getMoveHistory,
};
