const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RFIDLog = sequelize.define('RFIDLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  tag: { type: DataTypes.STRING(255), allowNull: false },
  action: { type: DataTypes.STRING(100), defaultValue: 'scan' },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'rfid_logs',
  timestamps: true,
});

module.exports = RFIDLog;
