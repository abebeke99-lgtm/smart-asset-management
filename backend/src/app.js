require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const passport = require('./config/passport');
const { sequelize, testConnection } = require('./config/database');
require('./models');
const { syncDatabase } = require('./config/sync');
const { seedDatabase } = require('./config/seed');
const { ensureUploadDirectories } = require('./utils/uploadUtils');

const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const userRoutes = require('./routes/userRoutes');
const assetRoutes = require('./routes/assetRoutes');
const ictAssetRoutes = require('./routes/ictAssetRoutes');
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
const chemicalRoutes = require('./routes/chemicalRoutes');
const serviceRequestRoutes = require('./routes/serviceRequestRoutes');
const locationRoutes = require('./routes/locationRoutes');
const cleaningRoutes = require('./routes/cleaningRoutes');
const softwareLicenseRoutes = require('./routes/softwareLicenseRoutes');
const technicalSupportRoutes = require('./routes/technicalSupportRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const searchRoutes = require('./routes/searchRoutes');
const contactRoutes = require('./routes/contactRoutes');
const backupService = require('./services/backupService');
const { requestMetricsMiddleware } = require('./middlewares/requestMetrics');
const { requestContextMiddleware } = require('./middlewares/requestContext');
const { requireAuth, requireRole } = require('./middlewares/auth');

const app = express();
const PORT = process.env.PORT || 5000;
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
const healthHandler = async (_req, res) => {
  try {
    await sequelize.query('SELECT 1');
    return res.status(200).json({ status: 'ok', database: 'connected' });
  } catch {
    return res.status(503).json({ status: 'error', database: 'unavailable' });
  }
};

const uploadRoot = path.resolve(__dirname, '..', (process.env.UPLOAD_DIR || './uploads').replace(/^\.\//, ''));
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
  'http://127.0.0.1:5000',
  'http://172.16.39.87:3000'
];
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? configuredOrigins
  : [...configuredOrigins, ...localOrigins];

const normalizeOrigin = (value = '') => value.replace(/\/+$/, '');
const isLocalDevelopmentOrigin = (origin) => {
  try {
    const { protocol, hostname, port } = new URL(origin);
    if (protocol !== 'http:' || !['3000', '3001', '5173'].includes(port)) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

    const octets = hostname.split('.').map(Number);
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;

    const [first, second] = octets;
    return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    const allowed = allowedOrigins.some((allowedOrigin) => normalizeOrigin(allowedOrigin) === normalizedOrigin)
      || (process.env.NODE_ENV !== 'production' && isLocalDevelopmentOrigin(normalizedOrigin));

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

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());
app.use(requestContextMiddleware);
app.use(requestMetricsMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/uploads', express.static(uploadRoot, { index: false, dotfiles: 'ignore' }));
app.use('/api/users', userRoutes);
app.use('/api/admin/users', requireAuth, requireRole('admin'), userRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/ict/software-licenses', softwareLicenseRoutes);
app.use('/api/ict', ictAssetRoutes);
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
app.use('/api/department-head', departmentWorkspaceRoutes);
app.use('/api', transferWorkflowRoutes);
app.use('/api', returnWorkflowRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/admin', analyticsRoutes);
app.use('/api/admin', adminNotificationRoutes);
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/admin', adminRoleRoutes);
app.use('/api/admin/inventory', requireAuth, requireRole('admin'), chemicalRoutes);
app.use('/api/admin/monitoring', systemMonitoringRoutes);
app.use('/api/admin/system-monitoring', systemMonitoringRoutes);
// Canonical administrator namespace. Legacy /api routes remain available for compatibility.
app.use('/api/admin', requireAuth, requireRole('admin'), adminSupportRoutes);
app.use('/api', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/support', supportRoutes);
app.use('/api', adminSupportRoutes);
app.use('/api/chemicals', chemicalRoutes);
app.use('/api/service-requests', serviceRequestRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/software-licenses', softwareLicenseRoutes);
app.use('/api/technical-support', technicalSupportRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/contact', contactRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: status >= 500 || process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Request failed'),
    ...(status < 500 && err.errors ? { errors: err.errors } : {}),
  });
});

async function initializeDatabase() {
  const retryDelays = [5000, 10000, 20000, 30000, 60000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const databaseConnected = await testConnection();
    let schemaReady = false;
    if (databaseConnected) {
      try {
        schemaReady = await syncDatabase();
      } catch (error) {
        console.error('Database schema initialization failed:', error.message);
      }
    }
    if (databaseConnected && schemaReady) {
      if (process.env.NODE_ENV !== 'production') {
        if (process.env.SEED_DEMO_DATA === 'true') {
          await seedDatabase();
        }
      }
      backupService.startAutomaticBackupScheduler();
      console.log('Database initialization completed.');
      break;
    }

    if (attempt === retryDelays.length) {
      console.error('Database initialization failed after retry limit. Verify DB_HOST, DB_PORT, credentials, SSL, and provider firewall settings.');
      throw new Error('Database initialization failed after retry limit.');
    }

    const delay = retryDelays[attempt];
    const failureReason = databaseConnected ? 'Database schema initialization incomplete' : 'Database connection unavailable';
    console.error(`${failureReason}. Retrying in ${delay / 1000} seconds (attempt ${attempt + 1}/${retryDelays.length}).`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function startServer() {
  try {
    ensureUploadDirectories();
  } catch (error) {
    console.error('Could not initialize upload directories:', error.message);
  }

  await initializeDatabase();

  return new Promise((resolve, reject) => {
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
