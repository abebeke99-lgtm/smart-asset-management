const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { getRequestContext } = require('../middlewares/requestContext');

const parseAuditDetails = (value) => {
  if (value === null || value === undefined || value === '') return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : { value: parsed };
    } catch (error) {
      return { value };
    }
  }

  if (typeof value === 'object') {
    return value;
  }

  return { value };
};

const applyRequestContext = (instance) => {
  if (!instance || typeof instance !== 'object') return;

  const context = getRequestContext();
  if (!context) return;

  const currentDetails = parseAuditDetails(instance.details);
  const nextDetails = {
    ...currentDetails,
    requestId: currentDetails.requestId || context.requestId || null,
    ipAddress: currentDetails.ipAddress || context.ipAddress || null,
    userAgent: currentDetails.userAgent || context.userAgent || null,
  };

  instance.details = JSON.stringify(nextDetails);
};

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
    beforeValidate(instance) {
      applyRequestContext(instance);
    },
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
