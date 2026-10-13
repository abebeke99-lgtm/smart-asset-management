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

test('backup history and download paths use the configured storage directory', async (t) => {
  const originalStoragePath = process.env.BACKUP_STORAGE_PATH;
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-storage-'));
  process.env.BACKUP_STORAGE_PATH = storagePath;
  t.after(() => {
    if (originalStoragePath === undefined) delete process.env.BACKUP_STORAGE_PATH;
    else process.env.BACKUP_STORAGE_PATH = originalStoragePath;
    fs.rmSync(storagePath, { recursive: true, force: true });
  });

  const filename = 'backup_20261013T130000_abcdef12.json';
  fs.writeFileSync(path.join(storagePath, filename), JSON.stringify({
    id: 'test-backup',
    filename,
    status: 'Successful',
    createdAt: '2026-10-13T13:00:00.000Z',
    size: 0,
  }));

  const history = await backupService.listBackupHistory();
  assert.equal(history.total, 1);
  assert.equal(history.items[0].filename, filename);
  assert.equal(backupService.resolveBackupFilePath(filename), path.join(storagePath, filename));
  assert.equal(backupService.resolveBackupFilePath('..\\outside.json'), null);
});

test('failed backup attempts are persisted with a failure reason for history and counters', async (t) => {
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-failure-'));
  const originalEnvironment = {
    BACKUP_DIR: process.env.BACKUP_DIR,
    BACKUP_STORAGE_PATH: process.env.BACKUP_STORAGE_PATH,
    MYSQLDUMP_PATH: process.env.MYSQLDUMP_PATH,
    MYSQL_BIN_DIR: process.env.MYSQL_BIN_DIR,
    DB_TEST_HOST: process.env.DB_TEST_HOST,
    DB_TEST_PORT: process.env.DB_TEST_PORT,
    DB_TEST_NAME: process.env.DB_TEST_NAME,
    DB_TEST_USER: process.env.DB_TEST_USER,
    DB_TEST_PASSWORD: process.env.DB_TEST_PASSWORD,
  };
  process.env.BACKUP_DIR = storagePath;
  delete process.env.BACKUP_STORAGE_PATH;
  process.env.MYSQLDUMP_PATH = path.join(storagePath, 'missing-mysqldump');
  process.env.MYSQL_BIN_DIR = storagePath;
  process.env.DB_TEST_HOST = 'backup-test.invalid';
  process.env.DB_TEST_PORT = '3306';
  process.env.DB_TEST_NAME = 'backup_failure_test';
  process.env.DB_TEST_USER = 'backup_test_user';
  process.env.DB_TEST_PASSWORD = 'backup-test-password';
  t.after(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(storagePath, { recursive: true, force: true });
  });

  await assert.rejects(
    backupService.createManualBackup({ createdBy: { id: 42, username: 'test-admin' } }),
    /mysqldump is unavailable/,
  );

  const history = await backupService.listBackupHistory();
  assert.equal(history.total, 1);
  assert.equal(history.items[0].status, 'failed');
  assert.equal(history.items[0].createdBy, 'test-admin');
  assert.match(history.items[0].errorMessage, /mysqldump is unavailable/);
  const stats = await backupService.getBackupStats();
  assert.equal(stats.failed, 1);
  assert.equal(stats.successful, 0);
});
