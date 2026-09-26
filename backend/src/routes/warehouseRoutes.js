const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', warehouseController.getWarehouses);
router.post('/', requireRole(['manager']), warehouseController.createWarehouse);
router.put('/:id', requireRole(['manager']), warehouseController.updateWarehouse);
router.delete('/:id', requireRole(['manager']), warehouseController.deleteWarehouse);

module.exports = router;
