const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { sequelize } = require('../config/database');
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

test('database dump generation uses Sequelize and writes schema and escaped rows', async (t) => {
  const storagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-native-'));
  const originalBackupDir = process.env.BACKUP_DIR;
  const originalStoragePath = process.env.BACKUP_STORAGE_PATH;
  const originalQuery = sequelize.query;
  const originalTransaction = sequelize.transaction;
  process.env.BACKUP_DIR = storagePath;
  delete process.env.BACKUP_STORAGE_PATH;
  sequelize.transaction = async (options, callback) => callback({});
  sequelize.query = async (sql) => {
    if (sql === 'SHOW FULL TABLES') {
      return [{ Tables_in_test_database: 'assets', Table_type: 'BASE TABLE' }];
    }
    if (sql === 'SHOW CREATE TABLE `assets`') {
      return [{ Table: 'assets', 'Create Table': 'CREATE TABLE `assets` (`id` int NOT NULL, `name` varchar(80))' }];
    }
    if (sql === 'SELECT * FROM `assets` LIMIT 250 OFFSET 0') {
      return [{ id: 8, name: "Director's chair" }];
    }
    if (sql === 'SELECT * FROM `assets` LIMIT 250 OFFSET 1') return [];
    if (sql.startsWith('SHOW TRIGGERS FROM')) return [];
    if (sql.startsWith('SHOW PROCEDURE STATUS')) return [];
    if (sql.startsWith('SHOW FUNCTION STATUS')) return [];
    throw new Error(`Unexpected backup query: ${sql}`);
  };
  t.after(() => {
    sequelize.query = originalQuery;
    sequelize.transaction = originalTransaction;
    if (originalBackupDir === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = originalBackupDir;
    if (originalStoragePath === undefined) delete process.env.BACKUP_STORAGE_PATH;
    else process.env.BACKUP_STORAGE_PATH = originalStoragePath;
    fs.rmSync(storagePath, { recursive: true, force: true });
  });

  const dumpPath = await backupService.writeDatabaseDump({ database: 'test_database' });
  const dump = fs.readFileSync(dumpPath, 'utf8');
  assert.match(dump, /CREATE TABLE `assets`/);
  assert.match(dump, /INSERT INTO `assets` \(`id`, `name`\)/);
  assert.ok(dump.includes("Director\\'s chair"));
  assert.match(dump, /SET FOREIGN_KEY_CHECKS=1/);
});

test('production backup creation requires persistent volume configuration', async (t) => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBackupDir = process.env.BACKUP_DIR;
  const originalStoragePath = process.env.BACKUP_STORAGE_PATH;
  process.env.NODE_ENV = 'production';
  delete process.env.BACKUP_DIR;
  delete process.env.BACKUP_STORAGE_PATH;
  t.after(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalBackupDir === undefined) delete process.env.BACKUP_DIR;
    else process.env.BACKUP_DIR = originalBackupDir;
    if (originalStoragePath === undefined) delete process.env.BACKUP_STORAGE_PATH;
    else process.env.BACKUP_STORAGE_PATH = originalStoragePath;
  });

  await assert.rejects(backupService.ensureBackupDirectory(), {
    code: 'BACKUP_STORAGE_NOT_CONFIGURED',
  });
});
