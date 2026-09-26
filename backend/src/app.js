const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { errorHandler } = require('./middlewares/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const transferRoutes = require('./routes/transferRoutes');
const adjustmentRoutes = require('./routes/adjustmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const locationRoutes = require('./routes/locationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Shelfy IMS',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api', require('./routes/workspace'));
app.use('/api', require('./routes/inventory'));
app.use('/api/products', productRoutes);
app.use('/api/receipts', require('./routes/documents')(true));
app.use('/api/deliveries', require('./routes/documents')(false));
// Inventory mutations use the transaction-safe routes above. Keep only
// existing read handlers for resource details.
const { authenticate } = require('./middlewares/auth');
app.get('/api/transfers', authenticate, require('./controllers/transferController').getTransfers);
app.get('/api/transfers/:id', authenticate, require('./controllers/transferController').getTransferById);
app.use('/api/categories', categoryRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
