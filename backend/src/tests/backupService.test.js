const test = require('node:test');
const assert = require('node:assert/strict');

const backupService = require('../services/backupService');

test('backup service exposes real backup and verification capabilities', () => {
  assert.equal(typeof backupService.resolveMysqlDumpBinary, 'function');
  assert.equal(typeof backupService.createManualBackup, 'function');
  assert.equal(typeof backupService.verifyBackupFile, 'function');
  assert.equal(typeof backupService.listBackupHistory, 'function');
  assert.equal(typeof backupService.getBackupStats, 'function');
});

test('backup service resolves a stable dump configuration', () => {
  const config = backupService.getDatabaseConfig({
    NODE_ENV: 'test',
    DB_TEST_HOST: 'localhost',
    DB_TEST_PORT: '3306',
    DB_TEST_NAME: 'smart_asset_db_test',
    DB_TEST_USER: 'test_user',
    DB_TEST_PASSWORD: '',
  });
  assert.ok(config.database);
  assert.ok(config.host || config.hostname);
  assert.ok(Number.isInteger(config.port));
});
