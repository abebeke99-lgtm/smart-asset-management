const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RfidDevice = sequelize.define('RfidDevice', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  reader_id: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  ip_address: { type: DataTypes.STRING(80), allowNull: true, defaultValue: '' },
  location: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '' },
  status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
  last_connected: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'rfid_devices',
  timestamps: true,
});

module.exports = RfidDevice;