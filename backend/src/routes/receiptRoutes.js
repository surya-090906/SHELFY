const express = require('express');
const router = express.Router();
const receiptController = require('../controllers/receiptController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', receiptController.getReceipts);
router.get('/:id', receiptController.getReceiptById);
router.post('/', requireRole(['manager', 'staff']), receiptController.createReceipt);
router.put('/:id', requireRole(['manager', 'staff']), receiptController.updateReceipt);
router.post('/:id/validate', requireRole(['manager', 'staff']), receiptController.validateReceipt);

module.exports = router;
