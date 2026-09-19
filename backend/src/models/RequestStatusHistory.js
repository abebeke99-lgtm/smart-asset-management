const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RequestStatusHistory = sequelize.define('RequestStatusHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  previousStatus: { type: DataTypes.STRING(50), allowNull: true, field: 'previous_status' },
  newStatus: { type: DataTypes.STRING(50), allowNull: false, field: 'new_status' },
  changedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'changed_by' },
  comment: { type: DataTypes.STRING(1000), defaultValue: '' },
}, {
  tableName: 'request_status_histories',
  timestamps: true,
  indexes: [{ fields: ['request_id'] }],
});

module.exports = RequestStatusHistory;