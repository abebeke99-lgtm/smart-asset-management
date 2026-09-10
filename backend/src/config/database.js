const path = require('path');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const requiredProductionVariables = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

const isSqliteEnabled = process.env.DB_USE_SQLITE === 'true' || (!isProduction && !process.env.DB_HOST && !process.env.DB_NAME && !process.env.DB_USER && !process.env.DB_PASSWORD && !process.env.DB_PORT);

const sqliteStoragePath = path.join(__dirname, '..', '..', 'smart_asset_dev.sqlite');

function getDatabaseConfig() {
  if (isSqliteEnabled) {
    return {
      dialect: 'sqlite',
      storage: sqliteStoragePath,
      logging: false,
    };
  }

  const missing = isProduction ? requiredProductionVariables.filter((name) => !String(process.env[name] || '').trim()) : [];
  if (missing.length) {
    const error = new Error(`Missing production database configuration: ${missing.join(', ')}`);
    error.code = 'DB_CONFIG_MISSING';
    throw error;
  }

  const portValue = process.env.DB_PORT || '3306';
  if (isProduction && !process.env.DB_PORT) {
    console.warn('DB_PORT is not configured; using the standard MySQL port 3306.');
  }
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('DB_PORT must be a valid TCP port');
    error.code = 'DB_CONFIG_INVALID';
    throw error;
  }

  return {
    database: process.env.DB_NAME || 'smart_asset_db',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port,
  };
}

const databaseConfig = getDatabaseConfig();
const dbHost = databaseConfig.host || '';
const sslEnabled = process.env.DB_SSL === 'true' || dbHost.includes('aivencloud.com');
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
const ssl = sslEnabled ? {
  rejectUnauthorized: sslRejectUnauthorized,
  ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
} : undefined;

const sequelizeOptions = {
  dialect: databaseConfig.dialect || 'mysql',
  logging: databaseConfig.logging !== undefined ? databaseConfig.logging : false,
  ...(databaseConfig.storage ? { storage: databaseConfig.storage } : {}),
  ...(databaseConfig.host ? { host: databaseConfig.host } : {}),
  ...(databaseConfig.port ? { port: databaseConfig.port } : {}),
  ...(databaseConfig.dialect === 'sqlite' ? {} : {
    dialectOptions: {
      connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
      ...(ssl ? { ssl } : {}),
    },
    pool: {
      max: Number(process.env.DB_POOL_MAX) || 10,
      min: 0,
      acquire: Number(process.env.DB_POOL_ACQUIRE_MS) || 30000,
      idle: Number(process.env.DB_POOL_IDLE_MS) || 10000,
      evict: Number(process.env.DB_POOL_EVICT_MS) || 1000,
    },
  }),
  define: {
    timestamps: true,
    underscored: true,
  },
};

const sequelize = new Sequelize(sequelizeOptions);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log(`Database connection established (host=${databaseConfig.host}, port=${databaseConfig.port}, database=${databaseConfig.database}).`);
    return true;
  } catch (error) {
    const code = error.code || error.parent?.code || error.original?.code || 'UNKNOWN';
    const details = [`code=${code}`, `host=${databaseConfig.host}`, `port=${databaseConfig.port}`, `database=${databaseConfig.database}`];
    if (code === 'ENOTFOUND') details.push('diagnosis=database DNS resolution failed');
    else if (code === 'ECONNREFUSED') details.push('diagnosis=database connection refused');
    else if (code === 'ETIMEDOUT') details.push('diagnosis=database connection timed out');
    else if (code === 'ER_ACCESS_DENIED_ERROR') details.push('diagnosis=database authentication failed');
    else if (code === 'ER_BAD_DB_ERROR') details.push('diagnosis=database does not exist');
    else if (code === 'HANDSHAKE_SSL_ERROR') details.push('diagnosis=database SSL/TLS handshake failed');
    console.error(`Database connection failed (${details.join(', ')}).`);
    return false;
  }
}

module.exports = { sequelize, testConnection, getDatabaseConfig, isSqliteEnabled };
