const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { getDatabaseConfig } = require('../config/database');

const BACKUP_DIRECTORY = path.resolve(__dirname, '../../backups');
const METADATA_FILE_PATTERN = /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/;

function normalizeBackupPath(candidatePath) {
  if (!candidatePath) return null;
  const absolutePath = path.resolve(candidatePath);
  if (!absolutePath.startsWith(`${BACKUP_DIRECTORY}${path.sep}`) && absolutePath !== BACKUP_DIRECTORY) {
    return null;
  }
  return absolutePath;
}

function getBackupStorageLocation() {
  return process.env.BACKUP_STORAGE_PATH || BACKUP_DIRECTORY;
}

async function ensureBackupDirectory() {
  const targetDirectory = getBackupStorageLocation();
  await fs.mkdir(targetDirectory, { recursive: true });
  return targetDirectory;
}

function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

function buildTimestampLabel(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function getEncryptionKey() {
  const configuredKey = process.env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_KEY || process.env.JWT_SECRET;
  if (!configuredKey || String(configuredKey).trim().length < 32) {
    return null;
  }
  return crypto.createHash('sha256').update(String(configuredKey)).digest();
}

function resolveMysqlBinary(binaryName) {
  const candidates = [];
  if (process.env[`${binaryName.toUpperCase()}_PATH`]) {
    candidates.push(process.env[`${binaryName.toUpperCase()}_PATH`]);
  }
  const windowsDefault = binaryName === 'mysqldump'
    ? ['C:/xampp/mysql/bin/mysqldump.exe', 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe']
    : ['C:/xampp/mysql/bin/mysql.exe', 'C:/Program Files/MySQL/MySQL Server 8.0/bin/mysql.exe'];
  candidates.push(...windowsDefault);
  if (process.env.MYSQL_BIN_DIR) candidates.push(path.join(process.env.MYSQL_BIN_DIR, binaryName));
  if (process.env.MYSQL_HOME) candidates.push(path.join(process.env.MYSQL_HOME, 'bin', binaryName));
  if (process.env.PATH) {
    const paths = process.env.PATH.split(path.delimiter);
    for (const entry of paths) {
      candidates.push(path.join(entry, binaryName));
      if (process.platform === 'win32') {
        candidates.push(path.join(entry, `${binaryName}.exe`));
      }
    }
  }
  const uniqueCandidates = [...new Set(candidates.filter(Boolean))];
  for (const candidate of uniqueCandidates) {
    try {
      const resolvedPath = path.resolve(candidate);
      if (resolvedPath && (resolvedPath.endsWith(binaryName) || resolvedPath.endsWith(`${binaryName}.exe`))) {
        return resolvedPath;
      }
    } catch (error) {
      // ignore invalid path candidates
    }
  }
  return binaryName;
}

function resolveBackupMetadataPath(filename) {
  if (!filename || !METADATA_FILE_PATTERN.test(filename)) {
    return null;
  }
  const filePath = path.resolve(BACKUP_DIRECTORY, filename);
  if (!filePath.startsWith(`${BACKUP_DIRECTORY}${path.sep}`) && filePath !== BACKUP_DIRECTORY) {
    return null;
  }
  return filePath;
}

async function readMetadataFile(filename) {
  const filePath = resolveBackupMetadataPath(filename);
  if (!filePath) return null;
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

async function computeFileChecksum(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function encryptFile(filePath) {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    return { encrypted: false, outputPath: filePath };
  }
  const input = await fs.readFile(filePath);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();
  const outputPath = `${filePath}.enc`;
  await fs.writeFile(outputPath, Buffer.concat([iv, tag, encrypted]));
  return { encrypted: true, outputPath, algorithm: 'AES-256-GCM', iv: iv.toString('hex'), authTag: tag.toString('hex') };
}

async function decryptFile(filePath) {
  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    return { encrypted: false, content: await fs.readFile(filePath) };
  }
  const encryptedPayload = await fs.readFile(filePath);
  if (encryptedPayload.length < 32) {
    throw new Error('Encrypted backup payload is incomplete');
  }
  const iv = encryptedPayload.subarray(0, 16);
  const tag = encryptedPayload.subarray(16, 32);
  const ciphertext = encryptedPayload.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return { encrypted: true, content: decrypted };
}

function extractDumpFileName(filename) {
  return filename.replace(/\.json$/, '.sql');
}

function isValidSqlDump(content) {
  const buffer = Buffer.isBuffer(content) ? content.toString('utf8') : String(content || '');
  return buffer.length > 128 && /(CREATE TABLE|INSERT INTO|-- MySQL dump|-- MariaDB dump)/i.test(buffer);
}

async function runMysqlDump(databaseConfig) {
  const dumpBinary = resolveMysqlBinary('mysqldump');
  const dumpPath = path.join(await ensureBackupDirectory(), `db_${buildTimestampLabel()}_${randomSuffix()}.sql`);

  const args = [
    '--host', databaseConfig.host,
    '--port', String(databaseConfig.port || 3306),
    '--user', databaseConfig.username,
    '--password=' + (databaseConfig.password || ''),
    '--single-transaction',
    '--routines',
    '--triggers',
    '--databases',
    databaseConfig.database,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(dumpBinary, args, {
      env: { ...process.env, MYSQL_PWD: databaseConfig.password || '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    let fileHandle;

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.stdout.on('data', (chunk) => {
      if (!fileHandle) {
        fileHandle = true;
      }
    });

    const outStream = require('fs').createWriteStream(dumpPath);
    child.stdout.pipe(outStream);

    child.on('error', (error) => {
      if (outStream.destroy) outStream.destroy();
      reject(new Error(`mysqldump failed to start: ${error.message}`));
    });

    child.on('close', async (code) => {
      try {
        if (code !== 0) {
          throw new Error(stderr.trim() || `mysqldump exited with code ${code}`);
        }
        if (!require('fs').existsSync(dumpPath)) {
          throw new Error('Backup dump file was not created');
        }
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  return dumpPath;
}

async function runMysqlRestore(databaseConfig, dumpPath) {
  const mysqlBinary = resolveMysqlBinary('mysql');
  const input = await fs.readFile(dumpPath);

  await new Promise((resolve, reject) => {
    const child = spawn(mysqlBinary, ['-h', databaseConfig.host, '-P', String(databaseConfig.port || 3306), '-u', databaseConfig.username, `--password=${databaseConfig.password || ''}`, databaseConfig.database], {
      env: { ...process.env, MYSQL_PWD: databaseConfig.password || '' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stdin.write(input);
    child.stdin.end();

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`mysql failed to start: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `mysql exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function verifyBackupContents(dumpPath, metadata) {
  const content = await fs.readFile(dumpPath);
  const validDump = isValidSqlDump(content);
  const checksum = crypto.createHash('sha256').update(content).digest('hex');
  const expectedChecksum = metadata?.checksum || null;
  const checksumValid = !expectedChecksum || checksum === expectedChecksum;
  const encryptionValid = metadata?.encrypted ? !!metadata.encryption && !!metadata.encryptedFile : !metadata?.encrypted;
  const valid = Boolean(validDump && checksumValid && encryptionValid);

  return {
    file: validDump ? 'VALID' : 'INVALID',
    databaseDump: validDump ? 'VALID' : 'INVALID',
    checksum: checksum,
    checksumValid,
    encryption: metadata?.encrypted ? (encryptionValid ? 'VALID' : 'INVALID') : 'NOT REQUIRED',
    encryptionValid,
    valid,
    verifiedAt: new Date().toISOString(),
  };
}

async function listBackupHistory({ search = '', status = '', type = '', page = 1, limit = 25 } = {}) {
  await ensureBackupDirectory();
  const entries = await fs.readdir(BACKUP_DIRECTORY, { withFileTypes: true });
  const metadataFiles = entries.filter((entry) => entry.isFile() && METADATA_FILE_PATTERN.test(entry.name)).map((entry) => entry.name).sort().reverse();
  const backups = [];

  for (const filename of metadataFiles) {
    const metadataPath = resolveBackupMetadataPath(filename);
    if (!metadataPath) continue;
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      const dumpFilePath = metadata.dumpFilePath ? normalizeBackupPath(metadata.dumpFilePath) : path.join(BACKUP_DIRECTORY, extractDumpFileName(filename));
      const sourceFile = metadata.encrypted ? (metadata.encryptedFile ? normalizeBackupPath(metadata.encryptedFile) : null) : dumpFilePath;
      let fileSize = metadata.size || 0;
      let checksum = metadata.checksum || null;
      let verificationStatus = metadata.verificationStatus || 'Not Verified';

      if (sourceFile) {
        try {
          const stats = await fs.stat(sourceFile);
          fileSize = stats.size;
        } catch (error) {
          fileSize = 0;
        }
      }

      if (checksum === null && dumpFilePath) {
        try {
          checksum = await computeFileChecksum(dumpFilePath);
        } catch (error) {
          checksum = null;
        }
      }

      const backup = {
        id: metadata.id || filename,
        filename,
        filenameLabel: metadata.filename || filename,
        type: metadata.type || 'Manual',
        status: metadata.status || 'Successful',
        size: fileSize,
        storage: metadata.storage || 'Local backup directory',
        encrypted: Boolean(metadata.encrypted),
        encryption: metadata.encrypted ? 'Encrypted' : 'Not Encrypted',
        checksum,
        verified: metadata.verified === true || verificationStatus === 'Verified',
        verificationStatus,
        createdAt: metadata.createdAt || new Date().toISOString(),
        completedAt: metadata.completedAt || metadata.createdAt || new Date().toISOString(),
        createdBy: metadata.createdBy || 'System',
        fileName: metadata.dumpFileName || extractDumpFileName(filename),
        fileSize: fileSize,
        backupType: metadata.backupType || 'Database Backup',
        database: metadata.database || getDatabaseConfig().database,
        format: metadata.format || 'smart-asset-management-backup',
      };
      backups.push(backup);
    } catch (error) {
      continue;
    }
  }

  const normalizedSearch = String(search).trim().toLowerCase();
  const normalizedStatus = String(status).trim().toLowerCase();
  const normalizedType = String(type).trim().toLowerCase();
  const filtered = backups.filter((backup) => {
    const matchesSearch = !normalizedSearch || [backup.filename, backup.createdBy, backup.type, backup.backupType, backup.database].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    const matchesStatus = !normalizedStatus || String(backup.status).toLowerCase() === normalizedStatus || String(backup.verificationStatus).toLowerCase() === normalizedStatus;
    const matchesType = !normalizedType || String(backup.type).toLowerCase() === normalizedType || String(backup.backupType).toLowerCase() === normalizedType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const total = filtered.length;
  const start = (pageNumber - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    },
    total,
  };
}

async function getBackupStats() {
  const history = await listBackupHistory({ page: 1, limit: 1000 });
  const items = history.items || [];
  const successful = items.filter((item) => String(item.status).toLowerCase() === 'successful').length;
  const failed = items.filter((item) => ['failed', 'verification failed', 'restore failed'].includes(String(item.status).toLowerCase())).length;
  const verified = items.filter((item) => String(item.verificationStatus).toLowerCase() === 'verified' || item.verified === true).length;
  const storageUsed = items.reduce((sum, item) => sum + Number(item.size || 0), 0);
  const latest = items.length ? items[0] : null;
  return {
    totalBackups: items.length,
    successful,
    failed,
    verified,
    unverified: Math.max(0, items.length - verified),
    storageUsed,
    latestBackup: latest ? latest.createdAt : null,
    latestStatus: latest ? latest.status : 'Not Available',
    verificationStatus: latest ? latest.verificationStatus : 'Not Available',
    database: getDatabaseConfig().database,
  };
}

async function createManualBackup({ createdBy = 'system', type = 'Manual', source = 'database' } = {}) {
  const databaseConfig = getDatabaseConfig();
  const backupDirectory = await ensureBackupDirectory();
  let dumpPath;

  try {
    dumpPath = await runMysqlDump(databaseConfig);
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }

  const dumpStats = await fs.stat(dumpPath);
  const checksum = await computeFileChecksum(dumpPath);
  const encryption = await encryptFile(dumpPath);
  const encryptedFilePath = encryption.encrypted ? encryption.outputPath : null;
  const now = new Date();
  const metadata = {
    format: 'smart-asset-management-backup',
    version: 1,
    id: `backup_${buildTimestampLabel(now).replace(/:/g, '-')}_${randomSuffix()}`,
    filename: `backup_${buildTimestampLabel(now).replace(/:/g, '-')}_${randomSuffix()}.json`,
    type,
    backupType: source === 'database' ? 'Database Backup' : 'System Backup',
    status: 'Successful',
    createdAt: now.toISOString(),
    completedAt: now.toISOString(),
    createdBy,
    storage: 'Local backup directory',
    database: databaseConfig.database,
    dumpFileName: path.basename(dumpPath),
    dumpFilePath: dumpPath,
    encrypted: Boolean(encryption.encrypted),
    encryption: encryption.encrypted ? encryption.algorithm : 'None',
    encryptedFile: encryptedFilePath ? path.basename(encryptedFilePath) : null,
    fileSize: dumpStats.size,
    size: dumpStats.size,
    checksum,
    verified: false,
    verificationStatus: 'Not Verified',
  };

  const metadataPath = path.join(backupDirectory, metadata.filename);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  const verification = await verifyBackupFile(metadata.filename, { skipPersist: true });
  metadata.verified = verification.valid;
  metadata.verificationStatus = verification.valid ? 'Verified' : 'Verification Failed';
  metadata.verification = verification;
  metadata.status = verification.valid ? 'Successful' : 'Failed';
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return {
    id: metadata.id,
    filename: metadata.filename,
    dumpFileName: metadata.dumpFileName,
    type: metadata.type,
    backupType: metadata.backupType,
    status: metadata.status,
    size: metadata.size,
    storage: metadata.storage,
    encrypted: metadata.encrypted,
    verified: metadata.verified,
    verificationStatus: metadata.verificationStatus,
    createdAt: metadata.createdAt,
    completedAt: metadata.completedAt,
    createdBy: metadata.createdBy,
    checksum: metadata.checksum,
    checksumValid: verification.checksumValid,
    database: metadata.database,
  };
}

async function verifyBackupFile(filename, { skipPersist = false } = {}) {
  const metadataPath = resolveBackupMetadataPath(filename);
  if (!metadataPath) {
    throw new Error('Invalid backup filename');
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const dumpFileName = metadata.dumpFileName || extractDumpFileName(filename);
  const dumpPath = normalizeBackupPath(metadata.dumpFilePath) || path.join(BACKUP_DIRECTORY, dumpFileName);
  const encryptedFilePath = metadata.encryptedFile ? normalizeBackupPath(path.join(BACKUP_DIRECTORY, metadata.encryptedFile)) : null;

  if (metadata.encrypted && encryptedFilePath) {
    const decrypted = await decryptFile(encryptedFilePath);
    const validDump = isValidSqlDump(decrypted.content);
    const expectedChecksum = metadata.checksum || null;
    const actualChecksum = crypto.createHash('sha256').update(decrypted.content).digest('hex');
    const checksumValid = !expectedChecksum || actualChecksum === expectedChecksum;
    const result = {
      valid: Boolean(validDump && checksumValid),
      checksum: actualChecksum,
      checksumValid,
      file: validDump ? 'VALID' : 'INVALID',
      databaseDump: validDump ? 'VALID' : 'INVALID',
      encryption: 'VALID',
      encryptionValid: true,
      verifiedAt: new Date().toISOString(),
      message: validDump && checksumValid ? 'Backup verification successful.' : 'Backup verification failed.'
    };

    if (!skipPersist) {
      metadata.verified = result.valid;
      metadata.verificationStatus = result.valid ? 'Verified' : 'Verification Failed';
      metadata.status = result.valid ? 'Successful' : 'Failed';
      metadata.verifiedAt = result.verifiedAt;
      metadata.checksum = actualChecksum;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    }
    return result;
  }

  const content = await fs.readFile(dumpPath);
  const actualChecksum = crypto.createHash('sha256').update(content).digest('hex');
  const checksumValid = !metadata.checksum || actualChecksum === metadata.checksum;
  const validDump = isValidSqlDump(content);
  const result = {
    valid: Boolean(validDump && checksumValid),
    checksum: actualChecksum,
    checksumValid,
    file: validDump ? 'VALID' : 'INVALID',
    databaseDump: validDump ? 'VALID' : 'INVALID',
    encryption: 'NOT REQUIRED',
    encryptionValid: true,
    verifiedAt: new Date().toISOString(),
    message: validDump && checksumValid ? 'Backup verification successful.' : 'Backup verification failed.'
  };

  if (!skipPersist) {
    metadata.verified = result.valid;
    metadata.verificationStatus = result.valid ? 'Verified' : 'Verification Failed';
    metadata.status = result.valid ? 'Successful' : 'Failed';
    metadata.verifiedAt = result.verifiedAt;
    metadata.checksum = actualChecksum;
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  }
  return result;
}

async function restoreBackup(filename, { requestedBy = 'system' } = {}) {
  const metadataPath = resolveBackupMetadataPath(filename);
  if (!metadataPath) {
    throw new Error('Invalid backup filename');
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const verification = await verifyBackupFile(filename, { skipPersist: true });
  if (!verification.valid) {
    throw new Error('Backup verification failed. Restore blocked for an unverified backup.');
  }

  const databaseConfig = getDatabaseConfig();
  const dumpFileName = metadata.encrypted ? (metadata.encryptedFile ? metadata.encryptedFile.replace(/\.enc$/, '') : metadata.dumpFileName) : metadata.dumpFileName;
  let dumpPath = normalizeBackupPath(metadata.dumpFilePath) || path.join(BACKUP_DIRECTORY, dumpFileName);

  if (metadata.encrypted) {
    const encryptedFilePath = metadata.encryptedFile ? normalizeBackupPath(path.join(BACKUP_DIRECTORY, metadata.encryptedFile)) : null;
    if (!encryptedFilePath) {
      throw new Error('Encrypted backup is missing its payload');
    }
    const decrypted = await decryptFile(encryptedFilePath);
    dumpPath = path.join(BACKUP_DIRECTORY, `restore_${path.basename(metadata.dumpFileName || 'database_restore.sql')}`);
    await fs.writeFile(dumpPath, decrypted.content);
  }

  const safetyBackup = await createManualBackup({ createdBy: requestedBy, type: 'Pre-Restore Safety' });
  if (!safetyBackup || !safetyBackup.status || safetyBackup.status === 'Failed') {
    throw new Error('Restore cancelled because the required pre-restore safety backup could not be completed.');
  }

  await runMysqlRestore(databaseConfig, dumpPath);

  metadata.lastRestoreAt = new Date().toISOString();
  metadata.restoreHistory = Array.isArray(metadata.restoreHistory) ? [...metadata.restoreHistory, { requestedBy, restoredAt: metadata.lastRestoreAt }] : [{ requestedBy, restoredAt: metadata.lastRestoreAt }];
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return {
    restoredFrom: filename,
    safetyBackup: safetyBackup.filename,
    requestedBy,
    restoredAt: metadata.lastRestoreAt,
    database: databaseConfig.database,
    verification,
  };
}

async function deleteBackup(filename) {
  const metadataPath = resolveBackupMetadataPath(filename);
  if (!metadataPath) {
    throw new Error('Invalid backup filename');
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const relatedFiles = [metadata.dumpFilePath, metadata.encryptedFile ? path.join(BACKUP_DIRECTORY, metadata.encryptedFile) : null].filter(Boolean);
  for (const filePath of relatedFiles) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // ignore missing related files
    }
  }

  await fs.unlink(metadataPath);
  return { filename, deleted: true };
}

module.exports = {
  BACKUP_DIRECTORY,
  getDatabaseConfig,
  resolveMysqlDumpBinary: () => resolveMysqlBinary('mysqldump'),
  resolveMysqlBinary: () => resolveMysqlBinary('mysql'),
  ensureBackupDirectory,
  createManualBackup,
  listBackupHistory,
  verifyBackupFile,
  restoreBackup,
  deleteBackup,
  getBackupStats,
  getBackupSettings: () => ({
    automaticBackupEnabled: process.env.BACKUP_AUTO_ENABLE === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
    retention: process.env.BACKUP_RETENTION || '30 backups',
    storage: process.env.BACKUP_STORAGE_PROVIDER || 'Local backup directory',
    encryptionEnabled: Boolean(getEncryptionKey()),
    verificationEnabled: true,
    timezone: process.env.TZ || 'UTC',
  }),
  startAutomaticBackupScheduler: () => {
    if (process.env.BACKUP_AUTO_ENABLE !== 'true') {
      return null;
    }

    try {
      const cron = require('node-cron');
      const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
      const task = cron.schedule(schedule, async () => {
        try {
          await createManualBackup({ createdBy: 'System Scheduler', type: 'Automatic' });
        } catch (error) {
          console.error('Automatic backup failed:', error.message);
        }
      }, { timezone: process.env.TZ || 'UTC' });
      task.start();
      return { started: true, schedule };
    } catch (error) {
      console.warn('Automatic backup scheduler is unavailable because node-cron is not installed.');
      return null;
    }
  },
};
