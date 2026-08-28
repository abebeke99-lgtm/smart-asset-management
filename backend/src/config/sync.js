const { sequelize } = require('./database');

async function syncDatabase() {
  try {
    await sequelize.sync();
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
