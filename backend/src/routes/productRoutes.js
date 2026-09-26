const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(authenticate);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/stock', productController.getProductStock);

// Manager only for create & delete
router.post('/', requireRole(['manager']), productController.createProduct);
router.put('/:id', requireRole(['manager']), productController.updateProduct);
router.delete('/:id', requireRole(['manager']), productController.deleteProduct);

module.exports = router;
