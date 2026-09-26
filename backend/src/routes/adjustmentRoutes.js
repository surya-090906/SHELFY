const express = require('express');
const router = express.Router();
const adjustmentController = require('../controllers/adjustmentController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', adjustmentController.getAdjustments);
router.post('/', requireRole(['manager', 'staff']), adjustmentController.createAdjustment);

module.exports = router;
