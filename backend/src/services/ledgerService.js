const prisma = require('../config/database');
const redis = require('../config/redis');
const { emitEvent } = require('./socketService');

/**
 * Derives current stock for a product, optionally scoped to a specific location.
 * Uses SUM(quantity_delta) from the immutable stock_ledger table.
 * Caches derived stock in Redis with a 60s TTL.
 */
const getDerivedStock = async (productId, locationId = null) => {
  const pId = parseInt(productId, 10);
  const lId = locationId ? parseInt(locationId, 10) : null;
  const version = await redis.get(`stock-version:${pId}`) || '0';
  const cacheKey = `stock:${pId}:${version}:${lId || 'all'}`;

  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached !== null && cached !== undefined) {
    return parseFloat(cached);
  }

  // Derive from immutable stock_ledger
  const whereClause = { product_id: pId };
  if (lId) {
    whereClause.location_id = lId;
  }

  const aggregate = await prisma.stockLedger.aggregate({
    where: whereClause,
    _sum: {
      quantity_delta: true,
    },
  });

  const currentStock = aggregate._sum.quantity_delta !== null ? aggregate._sum.quantity_delta : 0;

  // Cache result for 60 seconds
  await redis.set(cacheKey, currentStock, 'EX', 60);

  return currentStock;
};

/**
 * Returns derived stock broken down per warehouse & location for a specific product.
 */
const getLocationStockBreakdown = async (productId) => {
  const pId = parseInt(productId, 10);

  // Group by location_id and sum deltas
  const grouped = await prisma.stockLedger.groupBy({
    by: ['location_id'],
    where: { product_id: pId },
    _sum: {
      quantity_delta: true,
    },
  });

  // Fetch location & warehouse details
  const locationIds = grouped.map((g) => g.location_id);
  const locations = await prisma.location.findMany({
    where: { id: { in: locationIds } },
    include: {
      warehouse: true,
      parent: true,
    },
  });

  const locationMap = new Map();
  locations.forEach((loc) => locationMap.set(loc.id, loc));

  const breakdown = grouped.map((group) => {
    const loc = locationMap.get(group.location_id);
    const stock = group._sum.quantity_delta || 0;
    return {
      location_id: group.location_id,
      location_name: loc ? loc.name : 'Unknown Location',
      warehouse_id: loc ? loc.warehouse_id : null,
      warehouse_name: loc && loc.warehouse ? loc.warehouse.name : 'Unknown Warehouse',
      parent_location_name: loc && loc.parent ? loc.parent.name : null,
      current_stock: stock,
    };
  });

  return breakdown;
};

/**
 * Checks if current product stock has breached reorder threshold and emits stock:low event.
 */
const checkAndEmitLowStockAlert = async (productId) => {
  const pId = parseInt(productId, 10);
  const product = await prisma.product.findUnique({
    where: { id: pId },
    include: { category: true },
  });

  if (!product) return;

  const currentStock = await getDerivedStock(pId, null);

  if (currentStock <= product.reorder_threshold) {
    const alertData = {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      category: product.category ? product.category.name : '',
      currentStock,
      reorderThreshold: product.reorder_threshold,
      unitOfMeasure: product.unit_of_measure,
      timestamp: new Date().toISOString(),
    };

    // Emit live socket event
    emitEvent('stock:low', alertData);

    // Also publish to Redis pub-sub
    await redis.publish('stocksense:alerts', alertData);
  }
};

/**
 * Invalidates Redis caches associated with this product and dashboard KPIs
 */
const invalidateCacheForProduct = async (productId) => {
  const pId = parseInt(productId, 10);
  // Versioned keys prevent an in-flight pre-commit read from repopulating the active cache.
  await redis.set(`stock-version:${pId}`, require('crypto').randomUUID());
  await redis.delPattern(`stock:${pId}:*`);
  await redis.del('dashboard:kpis');
};

/**
 * Writes an immutable row to stock_ledger and invalidates caches.
 */
const recordLedgerEntry = async (entryData, tx = prisma) => {
  const {
    productId,
    locationId,
    quantityDelta,
    movementType,
    referenceId = null,
    referenceType = null,
    createdBy = null,
  } = entryData;

  const pId = parseInt(productId, 10);
  const lId = parseInt(locationId, 10);
  const delta = parseFloat(quantityDelta);

  const entry = await tx.stockLedger.create({
    data: {
      product_id: pId,
      location_id: lId,
      quantity_delta: delta,
      movement_type: movementType,
      reference_id: referenceId ? parseInt(referenceId, 10) : null,
      reference_type: referenceType,
      created_by: createdBy ? parseInt(createdBy, 10) : null,
    },
    include: {
      product: true,
      location: {
        include: { warehouse: true },
      },
    },
  });

  // Invalidate caches & check low-stock alert after commit
  await invalidateCacheForProduct(pId);
  await checkAndEmitLowStockAlert(pId);

  return entry;
};

/**
 * Writes multiple immutable rows to stock_ledger (e.g. transfers, batch receipts/deliveries)
 */
const recordMultipleLedgerEntries = async (entries, tx = prisma) => {
  const createdEntries = [];
  const affectedProductIds = new Set();

  for (const entry of entries) {
    const pId = parseInt(entry.productId, 10);
    const lId = parseInt(entry.locationId, 10);
    const delta = parseFloat(entry.quantityDelta);

    const record = await tx.stockLedger.create({
      data: {
        product_id: pId,
        location_id: lId,
        quantity_delta: delta,
        movement_type: entry.movementType,
        reference_id: entry.referenceId ? parseInt(entry.referenceId, 10) : null,
        reference_type: entry.referenceType || null,
        created_by: entry.createdBy ? parseInt(entry.createdBy, 10) : null,
      },
    });

    createdEntries.push(record);
    affectedProductIds.add(pId);
  }

  for (const pId of affectedProductIds) {
    await invalidateCacheForProduct(pId);
    await checkAndEmitLowStockAlert(pId);
  }

  return createdEntries;
};

module.exports = {
  getDerivedStock,
  getLocationStockBreakdown,
  checkAndEmitLowStockAlert,
  invalidateCacheForProduct,
  recordLedgerEntry,
  recordMultipleLedgerEntries,
};
