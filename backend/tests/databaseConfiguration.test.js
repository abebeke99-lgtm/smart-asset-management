const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabaseConfig } = require('../src/config/database');

test('maps Railway MySQL variables into Sequelize connection settings', () => {
  const config = getDatabaseConfig({
    NODE_ENV: 'production',
    MYSQLHOST: 'mysql.railway.internal',
    MYSQLPORT: '3307',
    MYSQLDATABASE: 'smart_asset_db',
    MYSQLUSER: 'railway_user',
    MYSQLPASSWORD: 'railway_test_password',
  });

  assert.deepEqual(config, {
    host: 'mysql.railway.internal',
    port: 3307,
    database: 'smart_asset_db',
    username: 'railway_user',
    password: 'railway_test_password',
  });
});

test('prefers explicit DB variables over Railway aliases', () => {
  const config = getDatabaseConfig({
    NODE_ENV: 'production',
    DB_HOST: 'db.example.internal',
    DB_PORT: '3308',
    DB_NAME: 'uams',
    DB_USER: 'app_user',
    DB_PASSWORD: 'db_test_password',
    MYSQLHOST: 'mysql.railway.internal',
    MYSQLPORT: '3307',
    MYSQLDATABASE: 'smart_asset_db',
    MYSQLUSER: 'railway_user',
    MYSQLPASSWORD: 'railway_test_password',
  });

  assert.equal(config.host, 'db.example.internal');
  assert.equal(config.port, 3308);
  assert.equal(config.database, 'uams');
  assert.equal(config.username, 'app_user');
  assert.equal(config.password, 'db_test_password');
});

test('accepts Railway MYSQL_URL and refuses incomplete production configuration', () => {
  const config = getDatabaseConfig({
    NODE_ENV: 'production',
    MYSQL_URL: 'mysql://railway_user:railway_test_password@mysql.railway.internal:3307/smart_asset_db',
  });

  assert.equal(config.host, 'mysql.railway.internal');
  assert.equal(config.port, 3307);
  assert.equal(config.database, 'smart_asset_db');
  assert.throws(
    () => getDatabaseConfig({ NODE_ENV: 'production' }),
    { code: 'DB_CONFIG_MISSING' },
  );
});

test('uses only a distinct test database when NODE_ENV is test', () => {
  const config = getDatabaseConfig({
    NODE_ENV: 'test',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_NAME: 'smart_asset_db',
    DB_USER: 'development_user',
    DB_PASSWORD: 'development_password',
    DB_TEST_HOST: '127.0.0.1',
    DB_TEST_PORT: '3307',
    DB_TEST_NAME: 'smart_asset_db_test',
    DB_TEST_USER: 'test_user',
    DB_TEST_PASSWORD: '',
  });

  assert.deepEqual(config, {
    host: '127.0.0.1',
    port: 3307,
    database: 'smart_asset_db_test',
    username: 'test_user',
    password: '',
  });
});

test('refuses test mode without explicit isolated database credentials', () => {
  assert.throws(
    () => getDatabaseConfig({ NODE_ENV: 'test', DB_TEST_HOST: 'localhost' }),
    { code: 'DB_TEST_CONFIG_MISSING' },
  );
});

test('refuses a test target identical to the development database', () => {
  assert.throws(
    () => getDatabaseConfig({
      NODE_ENV: 'test',
      DB_HOST: 'localhost',
      DB_PORT: '3306',
      DB_NAME: 'smart_asset_db',
      DB_TEST_HOST: 'localhost',
      DB_TEST_PORT: '3306',
      DB_TEST_NAME: 'smart_asset_db',
      DB_TEST_USER: 'root',
      DB_TEST_PASSWORD: '',
    }),
    { code: 'DB_TEST_CONFIG_INVALID' },
  );
});