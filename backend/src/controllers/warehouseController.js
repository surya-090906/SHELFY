const prisma = require('../config/database');

// Warehouses
const getWarehouses = async (req, res, next) => {
  try {
    const warehouses = await prisma.warehouse.findMany({
      include: {
        locations: {
          include: {
            parent: true,
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: warehouses });
  } catch (error) {
    next(error);
  }
};

const createWarehouse = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Warehouse name is required' });
    }

    const warehouse = await prisma.warehouse.create({
      data: { name: name.trim() },
    });

    return res.status(201).json({ success: true, message: 'Warehouse created', data: warehouse });
  } catch (error) {
    next(error);
  }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Warehouse name is required' });
    }

    const warehouse = await prisma.warehouse.update({
      where: { id: parseInt(id, 10) },
      data: { name: name.trim() },
    });

    return res.json({ success: true, message: 'Warehouse updated', data: warehouse });
  } catch (error) {
    next(error);
  }
};

const deleteWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const wId = parseInt(id, 10);

    // Check if locations have ledger entries
    const ledgerCount = await prisma.stockLedger.count({
      where: {
        location: { warehouse_id: wId },
      },
    });

    if (ledgerCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete warehouse with locations that contain stock ledger movement history.',
      });
    }

    await prisma.warehouse.delete({ where: { id: wId } });
    return res.json({ success: true, message: 'Warehouse deleted' });
  } catch (error) {
    next(error);
  }
};

// Locations
const getLocations = async (req, res, next) => {
  try {
    const { warehouse_id } = req.query;
    const where = {};
    if (warehouse_id) where.warehouse_id = parseInt(warehouse_id, 10);

    const locations = await prisma.location.findMany({
      where,
      include: {
        warehouse: true,
        parent: true,
        children: true,
      },
      orderBy: [{ warehouse_id: 'asc' }, { name: 'asc' }],
    });

    return res.json({ success: true, data: locations });
  } catch (error) {
    next(error);
  }
};

const createLocation = async (req, res, next) => {
  try {
    const { warehouse_id, name, parent_location_id } = req.body;

    if (!warehouse_id || !name) {
      return res.status(400).json({ success: false, message: 'Warehouse and location name are required' });
    }

    const location = await prisma.location.create({
      data: {
        warehouse_id: parseInt(warehouse_id, 10),
        name: name.trim(),
        parent_location_id: parent_location_id ? parseInt(parent_location_id, 10) : null,
      },
      include: {
        warehouse: true,
        parent: true,
      },
    });

    return res.status(201).json({ success: true, message: 'Location created', data: location });
  } catch (error) {
    next(error);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lId = parseInt(id, 10);
    const { name, warehouse_id, parent_location_id } = req.body;

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (warehouse_id) updateData.warehouse_id = parseInt(warehouse_id, 10);
    if (parent_location_id !== undefined) {
      updateData.parent_location_id = parent_location_id ? parseInt(parent_location_id, 10) : null;
    }

    const location = await prisma.location.update({
      where: { id: lId },
      data: updateData,
      include: { warehouse: true, parent: true },
    });

    return res.json({ success: true, message: 'Location updated', data: location });
  } catch (error) {
    next(error);
  }
};

const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lId = parseInt(id, 10);

    const ledgerCount = await prisma.stockLedger.count({
      where: { location_id: lId },
    });

    if (ledgerCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete location with existing stock movement history.',
      });
    }

    await prisma.location.delete({ where: { id: lId } });
    return res.json({ success: true, message: 'Location deleted' });
  } catch (error) {
    next(error);
  }
};

// Categories
const getCategories = async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    const category = await prisma.category.create({
      data: { name: name.trim() },
    });
    return res.status(201).json({ success: true, message: 'Category created', data: category });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWarehouses,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getCategories,
  createCategory,
};
