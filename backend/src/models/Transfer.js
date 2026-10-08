const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transfer = sequelize.define('Transfer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transferNumber: { type: DataTypes.STRING(40), allowNull: true, unique: true, field: 'transfer_number' },
  assetId: { type: DataTypes.INTEGER, allowNull: false },
  sourceCampusId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_campus_id' },
  sourceCollegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_college_id' },
  sourceDepartmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_department_id' },
  sourceBuildingId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_building_id' },
  sourceRoomId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_room_id' },
  sourceFloor: { type: DataTypes.INTEGER, allowNull: true, field: 'source_floor' },
  destinationCampusId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_campus_id' },
  destinationCollegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_college_id' },
  destinationDepartmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_department_id' },
  destinationBuildingId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_building_id' },
  destinationRoomId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_room_id' },
  destinationFloor: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_floor' },
  conditionAtTransfer: { type: DataTypes.STRING(100), allowNull: true, field: 'condition_at_transfer' },
  expectedReturnDate: { type: DataTypes.DATE, allowNull: true, field: 'expected_return_date' },
  assetStatusBeforeTransfer: { type: DataTypes.STRING(100), allowNull: true, field: 'asset_status_before_transfer' },
  sourceDepartment: { type: DataTypes.STRING(255), allowNull: false },
  destinationDepartment: { type: DataTypes.STRING(255), allowNull: false },
  currentLocation: { type: DataTypes.STRING(255), defaultValue: '' },
  newLocation: { type: DataTypes.STRING(255), allowNull: false },
  transferReason: { type: DataTypes.TEXT, allowNull: false },
  transferDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.STRING(100), defaultValue: 'Pending' }, // Pending, Approved, Rejected, In Progress, Completed, Cancelled
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  createdBy: { type: DataTypes.INTEGER, defaultValue: null },
  requestedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'requested_by' },
  dispatchedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'dispatched_by' },
  receivedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'received_by' },
  approvedBy: { type: DataTypes.INTEGER, defaultValue: null },
  approvalDate: { type: DataTypes.DATE, defaultValue: null },
  approvalReason: { type: DataTypes.TEXT, allowNull: true, field: 'approval_reason' },
  requestedAt: { type: DataTypes.DATE, allowNull: true, field: 'requested_at' },
  readyAt: { type: DataTypes.DATE, allowNull: true, field: 'ready_at' },
  dispatchedAt: { type: DataTypes.DATE, allowNull: true, field: 'dispatched_at' },
  receivedAt: { type: DataTypes.DATE, allowNull: true, field: 'received_at' },
}, {
  tableName: 'transfers',
  timestamps: true,
});

module.exports = Transfer;
