const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLogArchive = sequelize.define('AuditLogArchive', {
  archiveId: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  originalId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING(255), allowNull: false },
  entity: { type: DataTypes.STRING(255), defaultValue: '' },
  details: { type: DataTypes.TEXT, defaultValue: '' },
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
  archivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'audit_logs_archive',
  timestamps: false,
});

module.exports = AuditLogArchive;
