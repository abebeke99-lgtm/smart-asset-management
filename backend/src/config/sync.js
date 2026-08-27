const { sequelize } = require('./database');

async function syncDatabase() {
  try {
    await sequelize.sync();
    console.log('Database synced successfully.');
    return true;
  } catch (error) {
    console.error('Database sync failed:', error.message);
    return false;
  }
}

module.exports = { syncDatabase };
