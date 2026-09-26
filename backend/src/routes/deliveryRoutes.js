const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', deliveryController.getDeliveries);
router.get('/:id', deliveryController.getDeliveryById);
router.post('/', requireRole(['manager', 'staff']), deliveryController.createDelivery);
router.put('/:id', requireRole(['manager', 'staff']), deliveryController.updateDelivery);
router.post('/:id/validate', requireRole(['manager', 'staff']), deliveryController.validateDelivery);

module.exports = router;
