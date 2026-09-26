const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', warehouseController.getCategories);
router.post('/', requireRole(['manager']), warehouseController.createCategory);

module.exports = router;
