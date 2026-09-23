const { sequelize } = require('./src/config/database');
const { DataTypes } = require('sequelize');

async function ensureColumn(tableName, columnName, definition) {
  const table = await sequelize.getQueryInterface().describeTable(tableName);
  if (!table[columnName]) {
    console.log('adding', tableName, columnName);
    await sequelize.getQueryInterface().addColumn(tableName, columnName, definition);
    console.log('added', tableName, columnName);
  } else {
    console.log('exists', tableName, columnName);
  }
}

(async () => {
  try {
    console.log('repair start');
    const [rows] = await sequelize.query(`
      SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
             GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR '|') AS cols
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
      GROUP BY TABLE_NAME, INDEX_NAME
      ORDER BY TABLE_NAME, INDEX_NAME
    `);
    console.log('repair ok', rows.length);
  } catch (error) {
    console.error('repair fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('createMissing start');
    const queryInterface = sequelize.getQueryInterface();
    const seen = new Set();
    const models = sequelize.modelManager.models.filter((model) => {
      if (model.sequelize !== sequelize) return false;
      if (seen.has(model.name)) return false;
      seen.add(model.name);
      return true;
    });

    for (const model of models) {
      const exists = await queryInterface.tableExists(model.getTableName());
      if (!exists) {
        console.log('missing table', model.getTableName());
        try {
          await model.sync({ force: false });
          console.log('created', model.getTableName());
        } catch (err) {
          console.log('create failed', model.getTableName(), err.message);
        }
      }
    }
    console.log('createMissing ok');
  } catch (error) {
    console.error('createMissing fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('assets columns start');
    for (const [column, definition] of Object.entries({
      digital_id: { type: DataTypes.STRING(100), allowNull: true },
      campus_id: { type: DataTypes.INTEGER, allowNull: true },
      building_id: { type: DataTypes.INTEGER, allowNull: true },
      room_id: { type: DataTypes.INTEGER, allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      specifications: { type: DataTypes.JSON, allowNull: true },
      funding_source: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '' },
      deleted_by: { type: DataTypes.INTEGER, allowNull: true },
      deleted_at: { type: DataTypes.DATE, allowNull: true },
    })) {
      await ensureColumn('assets', column, definition);
    }
    console.log('assets columns ok');
  } catch (error) {
    console.error('assets columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('users columns start');
    await ensureColumn('users', 'college_id', { type: DataTypes.INTEGER, allowNull: true });
    await ensureColumn('users', 'department_id', { type: DataTypes.INTEGER, allowNull: true });
    console.log('users columns ok');
  } catch (error) {
    console.error('users columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('notifications columns start');
    for (const [column, definition] of Object.entries({
      recipient_id: { type: DataTypes.INTEGER, allowNull: true },
      sender_id: { type: DataTypes.INTEGER, allowNull: true },
      college_id: { type: DataTypes.INTEGER, allowNull: true },
      department_id: { type: DataTypes.INTEGER, allowNull: true },
      asset_id: { type: DataTypes.INTEGER, allowNull: true },
      priority: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'medium' },
      channel: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'in_app' },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'sent' },
      read_at: { type: DataTypes.DATE, allowNull: true },
      scheduled_at: { type: DataTypes.DATE, allowNull: true },
      sent_at: { type: DataTypes.DATE, allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: true },
      archived_at: { type: DataTypes.DATE, allowNull: true },
      archived_by: { type: DataTypes.INTEGER, allowNull: true },
    })) {
      await ensureColumn('notifications', column, definition);
    }
    console.log('notifications columns ok');
  } catch (error) {
    console.error('notifications columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('categories columns start');
    await ensureColumn('categories', 'code', { type: DataTypes.STRING(80), allowNull: true, defaultValue: '' });
    await ensureColumn('categories', 'icon', { type: DataTypes.STRING(80), allowNull: true, defaultValue: 'layers' });
    await ensureColumn('categories', 'status', { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' });
    console.log('categories columns ok');
  } catch (error) {
    console.error('categories columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('transfers columns start');
    for (const [column, definition] of Object.entries({
      transfer_number: { type: DataTypes.STRING(40), allowNull: true },
      source_college_id: { type: DataTypes.INTEGER, allowNull: true },
      source_department_id: { type: DataTypes.INTEGER, allowNull: true },
      destination_college_id: { type: DataTypes.INTEGER, allowNull: true },
      destination_department_id: { type: DataTypes.INTEGER, allowNull: true },
      requested_by: { type: DataTypes.INTEGER, allowNull: true },
      dispatched_by: { type: DataTypes.INTEGER, allowNull: true },
      received_by: { type: DataTypes.INTEGER, allowNull: true },
      requested_at: { type: DataTypes.DATE, allowNull: true },
      ready_at: { type: DataTypes.DATE, allowNull: true },
      dispatched_at: { type: DataTypes.DATE, allowNull: true },
      received_at: { type: DataTypes.DATE, allowNull: true },
    })) {
      await ensureColumn('transfers', column, definition);
    }
    console.log('transfers columns ok');
  } catch (error) {
    console.error('transfers columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('user reset columns start');
    const userTable = await sequelize.getQueryInterface().describeTable('users');
    if (!userTable.reset_token_hash) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_hash', { type: DataTypes.STRING(128), allowNull: true });
    }
    if (!userTable.reset_token_expires_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_expires_at', { type: DataTypes.DATE, allowNull: true });
    }
    if (!userTable.reset_token_used_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_token_used_at', { type: DataTypes.DATE, allowNull: true });
    }
    if (!userTable.reset_otp_hash) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_hash', { type: DataTypes.STRING(128), allowNull: true });
    }
    if (!userTable.reset_otp_expires_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_expires_at', { type: DataTypes.DATE, allowNull: true });
    }
    if (!userTable.reset_otp_used_at) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_used_at', { type: DataTypes.DATE, allowNull: true });
    }
    if (!userTable.reset_otp_attempts) {
      await sequelize.getQueryInterface().addColumn('users', 'reset_otp_attempts', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    }
    console.log('user reset columns ok');
  } catch (error) {
    console.error('user reset columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  try {
    console.log('late user columns start');
    const userColumns = await sequelize.getQueryInterface().describeTable('users');
    if (!userColumns.failed_login_attempts) {
      await sequelize.getQueryInterface().addColumn('users', 'failed_login_attempts', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    }
    if (!userColumns.lockout_until) {
      await sequelize.getQueryInterface().addColumn('users', 'lockout_until', { type: DataTypes.DATE, allowNull: true });
    }
    if (!userColumns.force_password_change) {
      await sequelize.getQueryInterface().addColumn('users', 'force_password_change', { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false });
    }
    if (!userColumns.session_version) {
      await sequelize.getQueryInterface().addColumn('users', 'session_version', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    }
    if (!userColumns.last_login_at) {
      await sequelize.getQueryInterface().addColumn('users', 'last_login_at', { type: DataTypes.DATE, allowNull: true });
    }
    console.log('late user columns ok');
  } catch (error) {
    console.error('late user columns fail', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('all sync steps complete');
})();
