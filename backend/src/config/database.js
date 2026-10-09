const { Sequelize } = require('sequelize');
const path = require('node:path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '../..');
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: [path.join(backendRoot, '.env.test'), path.join(backendRoot, '.env')] });
} else {
  dotenv.config({ path: path.join(backendRoot, '.env') });
}

const isProduction = process.env.NODE_ENV === 'production';

function getDatabaseConfig(environment = process.env) {
  const production = environment.NODE_ENV === 'production';
  const testing = environment.NODE_ENV === 'test';
  const connectionString = String(environment.DATABASE_URL || environment.MYSQL_URL || '').trim();
  let config;

  if (testing) {
    const testDatabase = {
      host: String(environment.DB_TEST_HOST || '').trim(),
      port: environment.DB_TEST_PORT || '3306',
      database: String(environment.DB_TEST_NAME || '').trim(),
      username: String(environment.DB_TEST_USER || '').trim(),
      password: environment.DB_TEST_PASSWORD,
    };
    const missing = [
      ['DB_TEST_HOST', testDatabase.host],
      ['DB_TEST_NAME', testDatabase.database],
      ['DB_TEST_USER', testDatabase.username],
    ].filter(([, value]) => !value).map(([name]) => name);
    if (!String(environment.DB_TEST_PASSWORD || '').trim()) missing.push('DB_TEST_PASSWORD');
    if (missing.length) {
      const error = new Error(`Missing test database configuration: ${missing.join(', ')}`);
      error.code = 'DB_TEST_CONFIG_MISSING';
      throw error;
    }

    const developmentHost = String(environment.DB_HOST || environment.MYSQLHOST || 'localhost').trim().toLowerCase();
    const developmentPort = String(environment.DB_PORT || environment.MYSQLPORT || '3306');
    const developmentDatabase = String(environment.DB_NAME || environment.MYSQLDATABASE || 'smart_asset_db').trim().toLowerCase();
    if (
      testDatabase.host.toLowerCase() === developmentHost
      && String(testDatabase.port) === developmentPort
      && testDatabase.database.toLowerCase() === developmentDatabase
    ) {
      const error = new Error('Test database must be separate from the configured development database');
      error.code = 'DB_TEST_CONFIG_INVALID';
      throw error;
    }
    config = testDatabase;
  } else if (connectionString) {
    let parsed;
    try {
      parsed = new URL(connectionString);
    } catch {
      const error = new Error('DATABASE_URL must be a valid MySQL connection URL');
      error.code = 'DB_CONFIG_INVALID';
      throw error;
    }
    if (!['mysql:', 'mysql2:'].includes(parsed.protocol)) {
      const error = new Error('DATABASE_URL must use the MySQL protocol');
      error.code = 'DB_CONFIG_INVALID';
      throw error;
    }
    config = {
      host: parsed.hostname,
      port: parsed.port || '3306',
      database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    };
    if (!config.host || !config.database || !config.username || !config.password) {
      const error = new Error('DATABASE_URL must include a MySQL host, database, username, and password');
      error.code = 'DB_CONFIG_INVALID';
      throw error;
    }
  } else {
    config = {
      database: environment.DB_NAME || environment.MYSQLDATABASE,
      username: environment.DB_USER || environment.MYSQLUSER,
      password: environment.DB_PASSWORD || environment.MYSQLPASSWORD,
      host: environment.DB_HOST || environment.MYSQLHOST,
      port: environment.DB_PORT || environment.MYSQLPORT || '3306',
    };
    const requiredValues = [
      ['DB_HOST/MYSQLHOST', config.host],
      ['DB_NAME/MYSQLDATABASE', config.database],
      ['DB_USER/MYSQLUSER', config.username],
      ['DB_PASSWORD/MYSQLPASSWORD', config.password],
    ];
    const missing = production
      ? requiredValues.filter(([, value]) => !String(value || '').trim()).map(([name]) => name)
      : [];
    if (missing.length) {
      const error = new Error(`Missing production database configuration: ${missing.join(', ')} or DATABASE_URL/MYSQL_URL`);
      error.code = 'DB_CONFIG_MISSING';
      throw error;
    }
    config.database = config.database || 'smart_asset_db';
    config.username = config.username || 'root';
    config.password = config.password || '';
    config.host = config.host || 'localhost';
  }

  if (production && !environment.DB_PORT && !environment.MYSQLPORT && !connectionString) {
    console.warn('DB_PORT is not configured; using the standard MySQL port 3306.');
  }
  const port = Number(config.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error('DB_PORT must be a valid TCP port');
    error.code = 'DB_CONFIG_INVALID';
    throw error;
  }

  return { ...config, port };
}

let databaseConfigError = null;
let databaseConfig;
try {
  databaseConfig = getDatabaseConfig();
} catch (error) {
  if (!['DB_CONFIG_MISSING', 'DB_CONFIG_INVALID', 'DB_TEST_CONFIG_MISSING', 'DB_TEST_CONFIG_INVALID'].includes(error.code)) throw error;
  databaseConfigError = error;
  const isTest = process.env.NODE_ENV === 'test';
  databaseConfig = {
    database: isTest
      ? process.env.DB_TEST_NAME || 'smart_asset_test_unconfigured'
      : process.env.DB_NAME || process.env.MYSQLDATABASE || 'smart_asset_db',
    username: isTest
      ? process.env.DB_TEST_USER || 'test_user_unconfigured'
      : process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: isTest
      ? process.env.DB_TEST_PASSWORD || ''
      : process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    host: isProduction || isTest
      ? 'database-not-configured.invalid'
      : process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    port: Number(isTest ? process.env.DB_TEST_PORT : process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  };
  console.error(`Database configuration unavailable: ${error.message}`);
}
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
  ...(databaseConfig.database ? { database: databaseConfig.database } : {}),
  ...(databaseConfig.username ? { username: databaseConfig.username } : {}),
  ...(databaseConfig.password !== undefined ? { password: databaseConfig.password } : {}),
  ...(databaseConfig.host ? { host: databaseConfig.host } : {}),
  ...(databaseConfig.port ? { port: databaseConfig.port } : {}),
  timezone: process.env.DB_TIMEZONE || '+00:00',
  dialectOptions: {
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
    charset: process.env.DB_CHARSET || 'utf8mb4',
    ...(ssl ? { ssl } : {}),
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: 0,
    acquire: Number(process.env.DB_POOL_ACQUIRE_MS) || 30000,
    idle: Number(process.env.DB_POOL_IDLE_MS) || 10000,
    evict: Number(process.env.DB_POOL_EVICT_MS) || 1000,
  },
  define: {
    timestamps: true,
    underscored: true,
    charset: process.env.DB_CHARSET || 'utf8mb4',
    collate: process.env.DB_COLLATION || 'utf8mb4_unicode_ci',
  },
};

const sequelize = new Sequelize(sequelizeOptions);

async function testConnection() {
  if (databaseConfigError) return false;

  try {
    await sequelize.authenticate();
    console.log(`Database connection established successfully (host=${databaseConfig.host}, port=${databaseConfig.port}, database=${databaseConfig.database}).`);
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

module.exports = { sequelize, testConnection, getDatabaseConfig };
