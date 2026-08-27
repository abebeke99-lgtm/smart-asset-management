const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'smart_asset_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
    },
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error.message);
    return false;
  }
}

module.exports = { sequelize, testConnection };
