const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserActivityLog = sequelize.define('UserActivityLog', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  action: { type: DataTypes.STRING(255), allowNull: false },
  ip: { type: DataTypes.STRING(45), allowNull: true },
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
}, {
  tableName: 'user_activity_logs',
  timestamps: false,
  indexes: [{ fields: ['user_id', 'created_at'] }],
});

module.exports = UserActivityLog;
