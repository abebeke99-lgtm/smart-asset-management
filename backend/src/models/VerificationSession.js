const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('VerificationSession', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  collegeId: { type: DataTypes.INTEGER, allowNull: false, field: 'college_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  status: { type: DataTypes.ENUM('draft', 'in_progress', 'submitted', 'finalized'), defaultValue: 'draft' },
  startedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'started_by' },
  finalizedAt: { type: DataTypes.DATE, allowNull: true, field: 'finalized_at' },
}, { tableName: 'verification_sessions', timestamps: true });
