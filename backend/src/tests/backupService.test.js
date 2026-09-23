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
  const config = backupService.getDatabaseConfig();
  assert.ok(config.database);
  assert.ok(config.host || config.hostname);
  assert.ok(Number.isInteger(config.port));
});
