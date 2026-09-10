require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('./config/passport');
const { sequelize, testConnection, isSqliteEnabled } = require('./config/database');
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
const departmentRoutes = require('./routes/departmentRoutes');
const infrastructureRoutes = require('./routes/infrastructureRoutes');
const collegeRoutes = require('./routes/collegeRoutes');
const departmentWorkspaceRoutes = require('./routes/departmentWorkspaceRoutes');
const transferWorkflowRoutes = require('./routes/transferWorkflowRoutes');
const returnWorkflowRoutes = require('./routes/returnWorkflowRoutes');
const supportRoutes = require('./routes/supportRoutes');
const storeRoutes = require('./routes/storeRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const adminNotificationRoutes = require('./routes/adminNotificationRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const adminRoleRoutes = require('./routes/adminRoleRoutes');
const systemMonitoringRoutes = require('./routes/systemMonitoringRoutes');
const { requestMetricsMiddleware } = require('./middleware/requestMetrics');

const app = express();
const PORT = process.env.PORT || 5000;
const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGINS
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean);
const localOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5000'
];
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : [...configuredOrigins, ...localOrigins];

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
app.use(requestMetricsMiddleware);

let databaseReady = false;

const healthHandler = async (req, res) => {
  let connected = databaseReady;
  if (connected) {
    try {
      await sequelize.authenticate();
    } catch (error) {
      connected = false;
      databaseReady = false;
    }
  }
  const status = connected ? 'ok' : 'degraded';
  res.status(connected ? 200 : 503).json({
    success: connected,
    status,
    database: connected ? 'connected' : 'unavailable',
    message: connected ? 'Smart Asset Management API is ready.' : 'Database unavailable.'
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/tracking', rfidRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/college', collegeRoutes);
app.use('/api/department', departmentWorkspaceRoutes);
app.use('/api', transferWorkflowRoutes);
app.use('/api', returnWorkflowRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/admin', analyticsRoutes);
app.use('/api/admin', adminNotificationRoutes);
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/admin', adminRoleRoutes);
app.use('/api/admin/monitoring', systemMonitoringRoutes);
app.use('/api/admin/system-monitoring', systemMonitoringRoutes);
// Canonical administrator namespace. Legacy /api routes remain available for compatibility.
app.use('/api/admin', adminSupportRoutes);
app.use('/api', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/support', supportRoutes);
app.use('/api', adminSupportRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

async function startServer() {
  const retryDelays = [5000, 10000, 20000, 30000, 60000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    if (await testConnection() && await syncDatabase()) {
      if (process.env.NODE_ENV !== 'production' && (process.env.SEED_DEMO_DATA === 'true' || isSqliteEnabled)) await seedDatabase();
      databaseReady = true;
      console.log('Database initialization completed.');
      break;
    }

    if (attempt === retryDelays.length) {
      throw new Error('Database initialization failed after retry limit. Verify Render DB_HOST, DB_PORT, credentials, SSL, and provider firewall settings.');
    }

    const delay = retryDelays[attempt];
    console.error(`Database unavailable. Retrying in ${delay / 1000} seconds (attempt ${attempt + 1}/${retryDelays.length}).`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  await new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      resolve();
    });
    server.once('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Application startup failed:', error);
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.startServer = startServer;
