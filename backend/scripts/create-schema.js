require('dotenv').config();

const mysql = require('mysql2/promise');
const { getDatabaseConfig, sequelize } = require('../src/config/database');
const { createMissingTables } = require('../src/config/sync');
require('../src/models');

const createDatabaseName = (name) => {
  const databaseName = String(name || '').trim();
  if (!/^[A-Za-z0-9_$-]+$/.test(databaseName)) {
    throw new Error('Database name contains unsupported characters.');
  }
  return `\`${databaseName}\``;
};

const isLocalHost = (hostname) => ['localhost', '127.0.0.1', '::1'].includes(
  String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
);

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create application schema when NODE_ENV=production.');
  }

  const config = getDatabaseConfig();
  if (!isLocalHost(config.host)) {
    throw new Error('Refusing to create schema on a non-local database host.');
  }
  const databaseName = createDatabaseName(config.database);
  const connectionOptions = {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000,
    charset: process.env.DB_CHARSET || 'utf8mb4',
  };

  if (process.env.DB_SSL === 'true' || config.host.includes('aivencloud.com')) {
    connectionOptions.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
    };
  }

  let serverConnection;
  try {
    serverConnection = await mysql.createConnection(connectionOptions);
    await serverConnection.query(
      `CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    if (serverConnection) await serverConnection.end();
  }

  await sequelize.authenticate();
  console.log(`Connected to database "${config.database}".`);

  const createdCount = await createMissingTables();
  const queryInterface = sequelize.getQueryInterface();
  const models = sequelize.modelManager.models.filter((model) => model.sequelize === sequelize);
  const missingTables = [];
  for (const model of models) {
    if (!(await queryInterface.tableExists(model.getTableName()))) {
      missingTables.push(model.getTableName());
    }
  }

  if (missingTables.length) {
    throw new Error(`Schema creation incomplete. Missing tables: ${[...new Set(missingTables)].join(', ')}`);
  }

  console.log(`Schema check complete. ${createdCount} missing table(s) created; existing tables were not altered.`);
}

main()
  .catch((error) => {
    console.error('Schema creation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch((error) => {
      console.error('Could not close Sequelize connection:', error.message);
      process.exitCode = 1;
    });
  });
