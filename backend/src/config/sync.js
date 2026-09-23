const { sequelize } = require('./database');

/*
 * Repair duplicate, auto-suffixed (`name_2`, `name_3`, ...) indexes.
 *
 * Root cause: the model graph contains cyclic foreign-key references, so
 * Sequelize's `sync()` falls back to `_syncModelsWithCyclicReferences()`,
 * which performs a second pass with `alter: true` on every model. Each boot
 * that pass re-runs `ALTER TABLE ... CHANGE col col ... UNIQUE`, which forces
 * MySQL to materialise a brand-new unique index with an incremented suffix
 * (`username`, `username_2`, ...). Over many boots tables reached MySQL's
 * 64-index-per-table limit and the app could no longer start.
 *
 * This routine drops duplicate indexes that share the same fingerprint
 * (unique + ordered column list), keeping the canonical name when one exists.
 * Foreign-key-owned indexes are preserved (they have no suffixed twins).
 */
async function repairDuplicateIndexes() {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR '|') AS cols
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     GROUP BY TABLE_NAME, INDEX_NAME
     ORDER BY TABLE_NAME, INDEX_NAME`
  );

  const byTable = {};
  for (const row of rows) {
    const table = row.TABLE_NAME;
    if (!byTable[table]) byTable[table] = [];
    byTable[table].push({ name: row.INDEX_NAME, unique: String(row.NON_UNIQUE) === '0', cols: String(row.cols) });
  }

  const dropPlan = [];
  for (const [table, indexes] of Object.entries(byTable)) {
    const groups = {};
    for (const index of indexes) {
      if (index.name === 'PRIMARY') continue;
      const fingerprint = `${index.unique ? 'U' : 'N'}:${index.cols}`;
      if (!groups[fingerprint]) groups[fingerprint] = [];
      groups[fingerprint].push(index.name);
    }
    for (const names of Object.values(groups)) {
      if (names.length < 2) continue;
      names.sort((left, right) => {
        const leftMatch = left.match(/^(.+)_(\d+)$/);
        const rightMatch = right.match(/^(.+)_(\d+)$/);
        return (leftMatch ? Number(leftMatch[2]) : -1) - (rightMatch ? Number(rightMatch[2]) : -1);
      });
      for (const name of names.slice(1)) {
        dropPlan.push({ table, name });
      }
    }
  }

  const queryInterface = sequelize.getQueryInterface();
  let dropped = 0;
  for (const { table, name } of dropPlan) {
    try {
      await queryInterface.removeIndex(table, name);
      dropped += 1;
    } catch (error) {
      // Index may be required by a foreign-key constraint; leaving it in place is safe.
      console.warn(`Skipped removing index ${table}.${name}: ${error.message}`);
    }
  }
  if (dropped > 0) console.log(`Removed ${dropped} duplicate database indexes.`);
  return dropped;
}

/*
 * Create only the tables that do not exist yet. Existing tables are never
 * altered, which prevents the schema-drift pollution described above.
 *
 * Tables are created with their foreign-key constraints first; any tables that
 * remain un-creatable after several rounds (cyclic reference graphs) are
 * created without constraints rather than blocking startup.
 */
async function createMissingTables() {
  const queryInterface = sequelize.getQueryInterface();
  const seen = new Set();
  const models = sequelize.modelManager.models.filter((model) => {
    if (model.sequelize !== sequelize) return false;
    if (seen.has(model.name)) return false;
    seen.add(model.name);
    return true;
  });

  const missing = [];
  for (const model of models) {
    const exists = await queryInterface.tableExists(model.getTableName());
    if (!exists) missing.push(model);
  }
  if (missing.length === 0) return 0;

  let pending = missing;
  const maxRounds = 5;
  for (let round = 0; round < maxRounds && pending.length > 0; round += 1) {
    const nextPending = [];
    for (const model of pending) {
      try {
        await model.sync({ force: false });
      } catch (error) {
        nextPending.push(model);
      }
    }
    if (nextPending.length === pending.length) {
      pending = nextPending;
      break;
    }
    pending = nextPending;
  }

  for (const model of pending) {
    try {
      await model.sync({ force: false, withoutForeignKeyConstraints: true });
      console.log(`Created table ${model.getTableName()} (without foreign-key constraints).`);
    } catch (error) {
      console.warn(`Could not create table ${model.getTableName()}: ${error.message}`);
    }
  }

  console.log(`Database schema synchronized. ${missing.length} table(s) created.`);
  return missing.length;
}

async function syncDatabase() {
  try {
    const ensureColumn = async (tableName, columnName, definition) => {
      const table = await sequelize.getQueryInterface().describeTable(tableName);
      if (!table[columnName]) await sequelize.getQueryInterface().addColumn(tableName, columnName, definition);
    };

    // Repair pollution from past sync passes before anything else runs.
    await repairDuplicateIndexes();

    // Create only missing tables; existing tables are left untouched by sync.
    await createMissingTables();

    for (const [column, definition] of Object.entries({
      digital_id: { type: require('sequelize').DataTypes.STRING(100), allowNull: true },
      campus_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      building_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      room_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      quantity: { type: require('sequelize').DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      specifications: { type: require('sequelize').DataTypes.JSON, allowNull: true },
      funding_source: { type: require('sequelize').DataTypes.STRING(255), allowNull: true, defaultValue: '' },
      deleted_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      deleted_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
    })) await ensureColumn('assets', column, definition);
    await ensureColumn('rfid_logs', 'reader_id', { type: require('sequelize').DataTypes.STRING(80), allowNull: true });
    await ensureColumn('purchase_orders', 'budget_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    for (const [column, definition] of Object.entries({
      verification_status: { type: require('sequelize').DataTypes.ENUM('Pending', 'Verified', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
      approval_status: { type: require('sequelize').DataTypes.ENUM('Pending', 'Approved', 'Rejected'), allowNull: false, defaultValue: 'Pending' },
      verified_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      verified_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      approved_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      approved_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
    })) await ensureColumn('invoices', column, definition);

    const assetIndexes = await sequelize.getQueryInterface().showIndex('assets');
    const hasUniqueDigitalId = assetIndexes.some((index) => index.unique && index.fields.some((field) => (field.attribute || field) === 'digital_id'));
    if (!hasUniqueDigitalId) {
      await sequelize.getQueryInterface().sequelize.query('ALTER TABLE `assets` ADD UNIQUE INDEX `assets_digital_id_unique` (`digital_id`)');
    }

    const { Supplier, Asset, PurchaseOrder, Location } = require('../models');
    const { Op } = require('sequelize');
    const legacyRows = await Promise.all([
      Asset.findAll({ attributes: ['supplier'], where: { supplier: { [Op.ne]: '' } }, group: ['supplier'], raw: true }),
      PurchaseOrder.findAll({ attributes: ['supplierName'], where: { supplierName: { [Op.ne]: '' } }, group: ['supplierName'], raw: true }),
    ]);
    const legacyNames = [...new Set([...legacyRows[0].map((row) => row.supplier), ...legacyRows[1].map((row) => row.supplierName)].map((name) => String(name || '').trim()).filter(Boolean))];
    for (const [index, supplierName] of legacyNames.entries()) {
      await Supplier.findOrCreate({ where: { supplierName }, defaults: { supplierCode: `LEGACY-${String(index + 1).padStart(4, '0')}`, supplierName, status: 'active' } });
    }
    await sequelize.query("UPDATE locations SET code = NULL WHERE code IS NULL OR TRIM(code) = ''");
    await sequelize.query("UPDATE categories SET code = NULL WHERE code IS NULL OR TRIM(code) = ''");

    const distinctLocations = await Asset.findAll({ attributes: ['location'], where: { location: { [Op.ne]: '' } }, group: ['location'], raw: true });
    for (const row of distinctLocations) {
      const name = String(row.location || '').trim();
      if (name) await Location.findOrCreate({ where: { name }, defaults: { name, code: null, description: `${name} asset location` } });
    }

    await ensureColumn('users', 'college_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('users', 'department_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('assets', 'college_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('assets', 'department_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('departments', 'college_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('departments', 'location_id', { type: require('sequelize').DataTypes.INTEGER, allowNull: true });
    await ensureColumn('departments', 'phone', { type: require('sequelize').DataTypes.STRING(50), allowNull: true });
    await ensureColumn('departments', 'email', { type: require('sequelize').DataTypes.STRING(255), allowNull: true });
    await ensureColumn('departments', 'status', { type: require('sequelize').DataTypes.STRING(20), allowNull: false, defaultValue: 'active' });
    await ensureColumn('colleges', 'address', { type: require('sequelize').DataTypes.STRING(500), allowNull: true, defaultValue: '' });
    await ensureColumn('colleges', 'established_date', { type: require('sequelize').DataTypes.DATEONLY, allowNull: true });
    for (const [column, definition] of Object.entries({
      recipient_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      sender_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      college_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      department_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      asset_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      event_key: { type: require('sequelize').DataTypes.STRING(160), allowNull: true },
      priority: { type: require('sequelize').DataTypes.STRING(30), allowNull: false, defaultValue: 'medium' },
      channel: { type: require('sequelize').DataTypes.STRING(100), allowNull: false, defaultValue: 'in_app' },
      status: { type: require('sequelize').DataTypes.STRING(30), allowNull: false, defaultValue: 'sent' },
      read_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      scheduled_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      sent_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      expires_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      archived_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      archived_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
    })) await ensureColumn('notifications', column, definition);
    await ensureColumn('categories', 'code', { type: require('sequelize').DataTypes.STRING(80), allowNull: true, defaultValue: '' });
    await ensureColumn('categories', 'icon', { type: require('sequelize').DataTypes.STRING(80), allowNull: true, defaultValue: 'layers' });
    await ensureColumn('categories', 'status', { type: require('sequelize').DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' });
    for (const [column, definition] of Object.entries({
      transfer_number: { type: require('sequelize').DataTypes.STRING(40), allowNull: true },
      source_college_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      source_department_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      destination_college_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      destination_department_id: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      requested_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      dispatched_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      received_by: { type: require('sequelize').DataTypes.INTEGER, allowNull: true },
      requested_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      ready_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      dispatched_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
      received_at: { type: require('sequelize').DataTypes.DATE, allowNull: true },
    })) await ensureColumn('transfers', column, definition);
    const table = await sequelize.getQueryInterface().describeTable('users');
    if (!table.reset_token_hash) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_hash', {
        type: require('sequelize').DataTypes.STRING(128),
        allowNull: true,
      });
    }
    if (!table.reset_token_expires_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_expires_at', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!table.reset_token_used_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_used_at', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!table.reset_otp_hash) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_hash', {
        type: require('sequelize').DataTypes.STRING(128),
        allowNull: true,
      });
    }
    if (!table.reset_otp_expires_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_expires_at', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!table.reset_otp_used_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_used_at', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!table.reset_otp_attempts) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_attempts', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    const userColumns = await sequelize.getQueryInterface().describeTable('users');
    if (!userColumns.failed_login_attempts) {
      await sequelize.getQueryInterface().addColumn('users', 'failed_login_attempts', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!userColumns.lockout_until) {
      await sequelize.getQueryInterface().addColumn('users', 'lockout_until', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    if (!userColumns.force_password_change) {
      await sequelize.getQueryInterface().addColumn('users', 'force_password_change', {
        type: require('sequelize').DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!userColumns.session_version) {
      await sequelize.getQueryInterface().addColumn('users', 'session_version', {
        type: require('sequelize').DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!userColumns.last_login_at) {
      await sequelize.getQueryInterface().addColumn('users', 'last_login_at', {
        type: require('sequelize').DataTypes.DATE,
        allowNull: true,
      });
    }
    console.log('Database synced successfully.');
    return true;
  } catch (error) {
    console.error('Database sync failed:', error.message);
    return false;
  }
}

module.exports = { syncDatabase, repairDuplicateIndexes, createMissingTables };