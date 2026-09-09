const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING(255), allowNull: false },
  entity: { type: DataTypes.STRING(255), defaultValue: '' },
  details: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  hooks: {
    beforeUpdate() {
      throw new Error('Audit logs are immutable and cannot be updated');
    },
    beforeDestroy(instance, options) {
      if (options?.auditRetentionArchive !== true) {
        throw new Error('Audit logs are immutable and cannot be deleted');
      }
    },
  },
});

module.exports = AuditLog;
