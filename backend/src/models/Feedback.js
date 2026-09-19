const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Feedback = sequelize.define('Feedback', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  maintenanceId: { type: DataTypes.INTEGER, allowNull: true, field: 'maintenance_id' },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  feedback: { type: DataTypes.STRING(500), defaultValue: '' },
  comment: { type: DataTypes.TEXT, defaultValue: '' },
  submittedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'submitted_by' },
}, {
  tableName: 'feedbacks',
  timestamps: true,
  indexes: [{ fields: ['request_id'] }],
});

module.exports = Feedback;