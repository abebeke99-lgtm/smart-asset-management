const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
    DB_TEST_PASSWORD: 'unit-test-only-password',
  });
  assert.ok(config.database);
  assert.ok(config.host || config.hostname);
  assert.ok(Number.isInteger(config.port));
});

test('backup service skips missing MySQL dump paths and resolves an existing configured binary', () => {
  const originalMysqlDumpPath = process.env.MYSQLDUMP_PATH;
  const originalMysqlBinDir = process.env.MYSQL_BIN_DIR;
  const originalExistsSync = fs.existsSync;
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-bin-'));
  const binaryName = process.platform === 'win32' ? 'mysqldump.exe' : 'mysqldump';
  const expectedBinary = path.join(tempDirectory, binaryName);
  fs.writeFileSync(expectedBinary, '');

  try {
    process.env.MYSQLDUMP_PATH = path.join(tempDirectory, 'missing-mysqldump');
    process.env.MYSQL_BIN_DIR = tempDirectory;
    fs.existsSync = (candidate) => path.resolve(candidate) === expectedBinary;

    assert.equal(backupService.resolveMysqlDumpBinary(), expectedBinary);
  } finally {
    fs.existsSync = originalExistsSync;
    if (originalMysqlDumpPath === undefined) delete process.env.MYSQLDUMP_PATH;
    else process.env.MYSQLDUMP_PATH = originalMysqlDumpPath;
    if (originalMysqlBinDir === undefined) delete process.env.MYSQL_BIN_DIR;
    else process.env.MYSQL_BIN_DIR = originalMysqlBinDir;
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('backup metadata filenames use a valid compact timestamp format', () => {
  const label = backupService.buildTimestampLabel(new Date('2026-10-11T10:34:55.225Z'));
  assert.equal(label, '20261011T103455');
  assert.match(`backup_${label}_aaaaaaaa.json`, /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/i);
});
