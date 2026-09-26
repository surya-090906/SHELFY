const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', warehouseController.getLocations);
router.post('/', requireRole(['manager']), warehouseController.createLocation);
router.put('/:id', requireRole(['manager']), warehouseController.updateLocation);
router.delete('/:id', requireRole(['manager']), warehouseController.deleteLocation);

module.exports = router;
