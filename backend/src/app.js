require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const { sequelize, testConnection } = require('./config/database');
const { syncDatabase } = require('./config/sync');
const { seedDatabase } = require('./config/seed');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const assetRoutes = require('./routes/assetRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const rfidRoutes = require('./routes/rfidRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminSupportRoutes = require('./routes/adminSupportRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const transferRoutes = require('./routes/transferRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const approvalRoutes = require('./routes/approvalRoutes');
const financeRoutes = require('./routes/financeRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5000'
].filter(Boolean);

const normalizeOrigin = (value = '') => value.replace(/\/+$/, '');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const allowed = allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin);

    if (allowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

let databaseReady = false;

app.get('/api/health', (req, res) => {
  const status = databaseReady ? 200 : 503;
  res.status(status).json({
    success: databaseReady,
    status: databaseReady ? 'ok' : 'unavailable',
    database: databaseReady ? 'connected' : 'disconnected',
    message: databaseReady ? 'Smart Asset Management API is running.' : 'Database connection is unavailable.'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', adminSupportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

async function startServer() {
  const connected = await testConnection();
  if (!connected) {
    console.error('Database connection failed. Server will not start.');
    await sequelize.close();
    process.exitCode = 1;
    return;
  }

  const synced = await syncDatabase();
  if (!synced) {
    console.error('Database synchronization failed. Server will not start.');
    await sequelize.close();
    process.exitCode = 1;
    return;
  }

  await seedDatabase();
  databaseReady = true;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;
