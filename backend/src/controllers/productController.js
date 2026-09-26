const prisma = require('../config/database');
const ledgerService = require('../services/ledgerService');

const getProducts = async (req, res, next) => {
  try {
    const { search, category, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category_id = parseInt(category, 10);
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { category: true },
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
    ]);

    // Derive current stock for each product from the immutable ledger
    const productsWithStock = await Promise.all(
      products.map(async (prod) => {
        const currentStock = await ledgerService.getDerivedStock(prod.id);
        let stockStatus = 'in_stock';
        if (currentStock <= 0) {
          stockStatus = 'out_of_stock';
        } else if (currentStock <= prod.reorder_threshold) {
          stockStatus = 'low_stock';
        }

        return {
          ...prod,
          current_stock: currentStock,
          stock_status: stockStatus,
        };
      })
    );

    return res.json({
      success: true,
      data: productsWithStock,
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

const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: pId },
      include: { category: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const currentStock = await ledgerService.getDerivedStock(pId);
    const locationsBreakdown = await ledgerService.getLocationStockBreakdown(pId);

    return res.json({
      success: true,
      data: {
        ...product,
        current_stock: currentStock,
        locations_breakdown: locationsBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getProductStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pId = parseInt(id, 10);

    const product = await prisma.product.findUnique({
      where: { id: pId },
      select: { id: true, name: true, sku: true, unit_of_measure: true, reorder_threshold: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const totalStock = await ledgerService.getDerivedStock(pId);
    const breakdown = await ledgerService.getLocationStockBreakdown(pId);

    return res.json({
      success: true,
      data: {
        product,
        total_stock: totalStock,
        locations: breakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, sku, category_id, unit_of_measure, reorder_threshold } = req.body;

    if (!name || !sku || !category_id) {
      return res.status(400).json({ success: false, message: 'Name, SKU, and category are required' });
    }

    const cleanSku = sku.trim().toUpperCase();
    const existing = await prisma.product.findUnique({ where: { sku: cleanSku } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Product with this SKU already exists' });
    }

    const threshold = reorder_threshold !== undefined ? Math.max(0, parseInt(reorder_threshold, 10)) : 10;

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        sku: cleanSku,
        category_id: parseInt(category_id, 10),
        unit_of_measure: unit_of_measure ? unit_of_measure.trim() : 'units',
        reorder_threshold: threshold,
      },
      include: { category: true },
    });

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        ...product,
        current_stock: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pId = parseInt(id, 10);
    const { name, sku, category_id, unit_of_measure, reorder_threshold } = req.body;

    const existing = await prisma.product.findUnique({ where: { id: pId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (sku) {
      const cleanSku = sku.trim().toUpperCase();
      if (cleanSku !== existing.sku) {
        const skuCheck = await prisma.product.findUnique({ where: { sku: cleanSku } });
        if (skuCheck) {
          return res.status(409).json({ success: false, message: 'SKU already in use by another product' });
        }
      }
      updateData.sku = cleanSku;
    }
    if (category_id) updateData.category_id = parseInt(category_id, 10);
    if (unit_of_measure) updateData.unit_of_measure = unit_of_measure.trim();
    if (reorder_threshold !== undefined) {
      updateData.reorder_threshold = Math.max(0, parseInt(reorder_threshold, 10));
    }

    const updated = await prisma.product.update({
      where: { id: pId },
      data: updateData,
      include: { category: true },
    });

    // Check low stock alert with new threshold
    await ledgerService.checkAndEmitLowStockAlert(pId);

    const currentStock = await ledgerService.getDerivedStock(pId);

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        ...updated,
        current_stock: currentStock,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pId = parseInt(id, 10);

    const existing = await prisma.product.findUnique({
      where: { id: pId },
      include: {
        stockLedger: { take: 1 },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (existing.stockLedger.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete product with existing stock ledger history. This maintains audit trail integrity.',
      });
    }

    await prisma.product.delete({ where: { id: pId } });
    await ledgerService.invalidateCacheForProduct(pId);

    return res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProducts,
  getProductById,
  getProductStock,
  createProduct,
  updateProduct,
  deleteProduct,
};
