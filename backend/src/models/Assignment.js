const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Assignment = sequelize.define('Assignment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  approvalId: { type: DataTypes.INTEGER, allowNull: true, field: 'approval_id' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  assignedToType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'user', field: 'assigned_to_type' },
  assignedToId: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_to_id' },
  assignedBy: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(100), defaultValue: 'active' },
  workflowStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'assigned', field: 'workflow_status' },
  assignedDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'assigned_date' },
  expectedReturnDate: { type: DataTypes.DATE, allowNull: true, field: 'expected_return_date' },
  returnedAt: { type: DataTypes.DATE, allowNull: true, field: 'returned_at' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  location: { type: DataTypes.STRING(255), allowNull: true },
  conditionAtAssignment: { type: DataTypes.STRING(100), allowNull: true, field: 'condition_at_assignment' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
}, {
  tableName: 'assignments',
  timestamps: true,
});

module.exports = Assignment;
