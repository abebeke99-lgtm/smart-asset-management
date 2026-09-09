const { sequelize } = require('./database');

async function syncDatabase() {
  try {
    await sequelize.sync();
    const ensureColumn = async (tableName, columnName, definition) => {
      const table = await sequelize.getQueryInterface().describeTable(tableName);
      if (!table[columnName]) await sequelize.getQueryInterface().addColumn(tableName, columnName, definition);
    };
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

module.exports = { syncDatabase };
