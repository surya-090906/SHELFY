const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', transferController.getTransfers);
router.get('/:id', transferController.getTransferById);
router.post('/', requireRole(['manager', 'staff']), transferController.createTransfer);
router.put('/:id', requireRole(['manager', 'staff']), transferController.updateTransfer);
router.post('/:id/validate', requireRole(['manager', 'staff']), transferController.validateTransfer);

module.exports = router;
