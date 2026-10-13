const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { QueryTypes, Transaction } = require('sequelize');
const { getDatabaseConfig, sequelize } = require('../config/database');

const BACKUP_DIRECTORY = path.resolve(__dirname, '../../backups');
const METADATA_FILE_PATTERN = /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/;

function normalizeBackupPath(candidatePath) {
  if (!candidatePath) return null;
  const absolutePath = path.resolve(candidatePath);
  const backupDirectory = getBackupStorageLocation();
  if (!absolutePath.startsWith(`${backupDirectory}${path.sep}`) && absolutePath !== backupDirectory) {
    return null;
  }
  return absolutePath;
}

function getBackupStorageLocation() {
  return path.resolve(process.env.BACKUP_DIR || process.env.BACKUP_STORAGE_PATH || BACKUP_DIRECTORY);
}

async function ensureBackupDirectory() {
  if (
    process.env.NODE_ENV === 'production'
    && !process.env.BACKUP_DIR
    && !process.env.BACKUP_STORAGE_PATH
  ) {
    const error = new Error('Configure BACKUP_DIR to a persistent mounted volume before creating production backups.');
    error.code = 'BACKUP_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  const targetDirectory = getBackupStorageLocation();
  await fs.mkdir(targetDirectory, { recursive: true });
  return targetDirectory;
}

function randomSuffix() {
  return crypto.randomBytes(4).toString('hex');
}

function buildTimestampLabel(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
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
      const directMatch = fsSync.existsSync(resolvedPath) ? resolvedPath : null;
      if (directMatch) return directMatch;
      const exeMatch = fsSync.existsSync(`${resolvedPath}.exe`) ? `${resolvedPath}.exe` : null;
      if (exeMatch) return exeMatch;
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
  const backupDirectory = getBackupStorageLocation();
  const filePath = path.resolve(backupDirectory, filename);
  if (!filePath.startsWith(`${backupDirectory}${path.sep}`) && filePath !== backupDirectory) {
    return null;
  }
  return filePath;
}

function resolveBackupFilePath(filename) {
  if (!filename || path.basename(filename) !== filename) return null;
  return normalizeBackupPath(path.join(getBackupStorageLocation(), filename));
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

async function writeDatabaseDump(databaseConfig) {
  const dumpPath = path.join(await ensureBackupDirectory(), `db_${buildTimestampLabel()}_${randomSuffix()}.sql`);
  const output = fsSync.createWriteStream(dumpPath, { flags: 'wx' });
  let outputError;
  output.on('error', (error) => { outputError = error; });
  const writeChunk = (chunk) => new Promise((resolve, reject) => {
    output.write(chunk, (error) => {
      if (error || outputError) reject(error || outputError);
      else resolve();
    });
  });
  const quoteIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;
  const getTableName = (row) => {
    const tableNameKey = Object.keys(row).find((key) => /^Tables_in_/i.test(key)) || Object.keys(row)[0];
    return row[tableNameKey];
  };
  const getCreateStatement = (row) => Object.entries(row)
    .find(([key]) => /^Create (?:Table|View|Trigger|Procedure|Function)$/i.test(key) || /^SQL Original Statement$/i.test(key))?.[1];
  const toSqlLiteral = (value) => (
    value !== null
    && typeof value === 'object'
    && !(value instanceof Date)
    && !Buffer.isBuffer(value)
      ? sequelize.escape(JSON.stringify(value))
      : sequelize.escape(value)
  );

  try {
    await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ },
      async (transaction) => {
        await writeChunk(`-- Smart Asset Management database backup\n-- Database: ${String(databaseConfig.database).replace(/[\r\n]/g, '')}\nSET FOREIGN_KEY_CHECKS=0;\n\n`);
        const tableRows = await sequelize.query('SHOW FULL TABLES', { type: QueryTypes.SELECT, transaction });
        const views = [];
        const triggers = [];

        for (const tableRow of tableRows) {
          const tableName = getTableName(tableRow);
          const tableTypeKey = Object.keys(tableRow).find((key) => /^Table_type$/i.test(key));
          const tableType = String(tableTypeKey ? tableRow[tableTypeKey] : 'BASE TABLE').toUpperCase();
          if (!tableName) continue;

          const quotedName = quoteIdentifier(tableName);
          if (tableType !== 'VIEW' && tableType !== 'BASE TABLE') continue;
          if (tableType === 'VIEW') {
            const [viewRow] = await sequelize.query(`SHOW CREATE VIEW ${quotedName}`, {
              type: QueryTypes.SELECT,
              transaction,
            });
            const createView = viewRow && getCreateStatement(viewRow);
            if (createView) views.push(`${createView};\n`);
            continue;
          }

          const [schemaRow] = await sequelize.query(`SHOW CREATE TABLE ${quotedName}`, {
            type: QueryTypes.SELECT,
            transaction,
          });
          const createTable = schemaRow && getCreateStatement(schemaRow);
          if (!createTable) throw new Error(`Could not read the schema for table ${tableName}.`);
          await writeChunk(`-- Table ${tableName}\nDROP TABLE IF EXISTS ${quotedName};\n${createTable};\n`);

          let offset = 0;
          while (true) {
            const records = await sequelize.query(`SELECT * FROM ${quotedName} LIMIT 250 OFFSET ${offset}`, {
              type: QueryTypes.SELECT,
              raw: true,
              transaction,
            });
            if (!records.length) break;
            const columns = Object.keys(records[0]);
            const columnSql = columns.map(quoteIdentifier).join(', ');
            const escapedRows = records.map((record) => `(${columns.map((column) => toSqlLiteral(record[column])).join(', ')})`);
            await writeChunk(`INSERT INTO ${quotedName} (${columnSql}) VALUES\n${escapedRows.join(',\n')};\n`);
            offset += records.length;
            if (records.length < 250) break;
          }
        }

        const triggerRows = await sequelize.query(`SHOW TRIGGERS FROM ${quoteIdentifier(databaseConfig.database)}`, {
          type: QueryTypes.SELECT,
          transaction,
        });
        for (const trigger of triggerRows) {
          const triggerName = trigger.Trigger || trigger.trigger;
          if (!triggerName) continue;
          const [triggerDefinition] = await sequelize.query(
            `SHOW CREATE TRIGGER ${quoteIdentifier(databaseConfig.database)}.${quoteIdentifier(triggerName)}`,
            { type: QueryTypes.SELECT, transaction }
          );
          const createTrigger = triggerDefinition && getCreateStatement(triggerDefinition);
          if (createTrigger) triggers.push(`${createTrigger}$$\n`);
        }

        const routines = [];
        for (const routineType of ['PROCEDURE', 'FUNCTION']) {
          const routineRows = await sequelize.query(
            `SHOW ${routineType} STATUS WHERE Db = ${sequelize.escape(databaseConfig.database)}`,
            { type: QueryTypes.SELECT, transaction }
          );
          for (const routine of routineRows) {
            const routineName = routine.Name || routine.name;
            if (!routineName) continue;
            const [routineDefinition] = await sequelize.query(
              `SHOW CREATE ${routineType} ${quoteIdentifier(databaseConfig.database)}.${quoteIdentifier(routineName)}`,
              { type: QueryTypes.SELECT, transaction }
            );
            const createRoutine = routineDefinition && getCreateStatement(routineDefinition);
            if (createRoutine) routines.push(`${createRoutine}$$\n`);
          }
        }

        if (views.length || triggers.length || routines.length) await writeChunk('DELIMITER $$\n');
        for (const view of views) await writeChunk(view);
        for (const trigger of triggers) await writeChunk(trigger);
        for (const routine of routines) await writeChunk(routine);
        if (views.length || triggers.length || routines.length) await writeChunk('DELIMITER ;\n');
        await writeChunk('\nSET FOREIGN_KEY_CHECKS=1;\n');
      }
    );
    await new Promise((resolve, reject) => {
      if (outputError) {
        reject(outputError);
        return;
      }
      output.once('error', reject);
      output.end(() => (outputError ? reject(outputError) : resolve()));
    });
    return dumpPath;
  } catch (error) {
    output.destroy();
    await fs.unlink(dumpPath).catch(() => {});
    throw error;
  }
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
  const backupDirectory = await ensureBackupDirectory();
  const entries = await fs.readdir(backupDirectory, { withFileTypes: true });
  const metadataFiles = entries.filter((entry) => entry.isFile() && METADATA_FILE_PATTERN.test(entry.name)).map((entry) => entry.name).sort().reverse();
  const backups = [];

  for (const filename of metadataFiles) {
    const metadataPath = resolveBackupMetadataPath(filename);
    if (!metadataPath) continue;
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      const dumpFilePath = metadata.dumpFilePath ? normalizeBackupPath(metadata.dumpFilePath) : path.join(backupDirectory, extractDumpFileName(filename));
      const sourceFile = metadata.encrypted ? (metadata.encryptedFile ? resolveBackupFilePath(metadata.encryptedFile) : null) : dumpFilePath;
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
        errorMessage: metadata.errorMessage || metadata.error_message || null,
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
  const successful = items.filter((item) => ['completed', 'successful'].includes(String(item.status).toLowerCase())).length;
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
    inProgress: items.filter((item) => String(item.status).toLowerCase() === 'in_progress').length,
    database: getDatabaseConfig().database,
  };
}

async function createManualBackup({ createdBy = 'system', type = 'Manual', source = 'database' } = {}) {
  const backupDirectory = await ensureBackupDirectory();
  const now = new Date();
  const timestamp = buildTimestampLabel(now);
  const backupId = `backup_${timestamp}_${randomSuffix()}`;
  const filename = `${backupId}.json`;
  const metadataPath = path.join(backupDirectory, filename);
  const metadata = {
    format: 'smart-asset-management-backup',
    version: 1,
    id: backupId,
    filename,
    type,
    backupType: source === 'database' ? 'Database Backup' : 'System Backup',
    status: 'in_progress',
    createdAt: now.toISOString(),
    completedAt: null,
    createdBy: typeof createdBy === 'object' ? (createdBy.username || createdBy.fullName || 'System') : createdBy,
    createdById: typeof createdBy === 'object' ? createdBy.id || null : null,
    storage: process.env.BACKUP_STORAGE_PROVIDER || (process.env.NODE_ENV === 'production' ? 'Persistent volume' : 'Local backup directory'),
    database: null,
    dumpFileName: null,
    dumpFilePath: null,
    encrypted: false,
    encryption: 'None',
    encryptedFile: null,
    fileSize: 0,
    size: 0,
    checksum: null,
    verified: false,
    verificationStatus: 'Not Verified',
    errorMessage: null,
  };
  metadata.file_name = filename;
  metadata.file_path = metadataPath;
  metadata.include_files = false;
  metadata.created_by = metadata.createdById;
  metadata.created_at = metadata.createdAt;
  metadata.completed_at = null;
  metadata.error_message = null;
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  let dumpPath;

  try {
    const databaseConfig = getDatabaseConfig();
    metadata.database = databaseConfig.database;
    dumpPath = await writeDatabaseDump(databaseConfig);
    metadata.dumpFileName = path.basename(dumpPath);
    metadata.dumpFilePath = dumpPath;
    const dumpStats = await fs.stat(dumpPath);
    const checksum = await computeFileChecksum(dumpPath);
    const encryption = await encryptFile(dumpPath);
    const encryptedFilePath = encryption.encrypted ? encryption.outputPath : null;
    const verification = await verifyBackupFile(filename, { skipPersist: true });
    if (!verification.valid) throw new Error(verification.message || 'Backup verification failed.');

    metadata.encrypted = Boolean(encryption.encrypted);
    metadata.encryption = encryption.encrypted ? encryption.algorithm : 'None';
    metadata.encryptedFile = encryptedFilePath ? path.basename(encryptedFilePath) : null;
    metadata.fileSize = dumpStats.size;
    metadata.size = dumpStats.size;
    metadata.checksum = checksum;
    metadata.verified = true;
    metadata.verificationStatus = 'Verified';
    metadata.verification = verification;
    metadata.status = 'completed';
    metadata.completedAt = new Date().toISOString();
    metadata.completed_at = metadata.completedAt;
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
  } catch (error) {
    metadata.status = 'failed';
    metadata.completedAt = new Date().toISOString();
    metadata.completed_at = metadata.completedAt;
    metadata.errorMessage = error.message || 'Unknown backup error';
    metadata.error_message = metadata.errorMessage;
    if (dumpPath) {
      metadata.dumpFileName = path.basename(dumpPath);
      metadata.dumpFilePath = dumpPath;
    }
    try {
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    } catch (metadataError) {
      error.metadataPersistenceError = metadataError;
    }
    throw error;
  }
}

async function verifyBackupFile(filename, { skipPersist = false } = {}) {
  const metadataPath = resolveBackupMetadataPath(filename);
  if (!metadataPath) {
    throw new Error('Invalid backup filename');
  }

  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const dumpFileName = metadata.dumpFileName || extractDumpFileName(filename);
  const backupDirectory = getBackupStorageLocation();
  const dumpPath = normalizeBackupPath(metadata.dumpFilePath) || path.join(backupDirectory, dumpFileName);
  const encryptedFilePath = metadata.encryptedFile ? resolveBackupFilePath(metadata.encryptedFile) : null;

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
  const backupDirectory = getBackupStorageLocation();
  let dumpPath = normalizeBackupPath(metadata.dumpFilePath) || path.join(backupDirectory, dumpFileName);

  if (metadata.encrypted) {
    const encryptedFilePath = metadata.encryptedFile ? resolveBackupFilePath(metadata.encryptedFile) : null;
    if (!encryptedFilePath) {
      throw new Error('Encrypted backup is missing its payload');
    }
    const decrypted = await decryptFile(encryptedFilePath);
    dumpPath = path.join(backupDirectory, `restore_${path.basename(metadata.dumpFileName || 'database_restore.sql')}`);
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
  const relatedFiles = [
    normalizeBackupPath(metadata.dumpFilePath),
    metadata.encryptedFile ? resolveBackupFilePath(metadata.encryptedFile) : null,
  ].filter(Boolean);
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
  getBackupStorageLocation,
  resolveBackupFilePath,
  getDatabaseConfig,
  buildTimestampLabel,
  resolveMysqlDumpBinary: () => resolveMysqlBinary('mysqldump'),
  resolveMysqlBinary: () => resolveMysqlBinary('mysql'),
  ensureBackupDirectory,
  writeDatabaseDump,
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
    storage: process.env.BACKUP_STORAGE_PROVIDER || (process.env.NODE_ENV === 'production' ? 'Persistent volume' : 'Local backup directory'),
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
