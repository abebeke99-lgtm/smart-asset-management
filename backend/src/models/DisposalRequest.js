const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DisposalRequest = sequelize.define('DisposalRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  disposalNumber: { type: DataTypes.STRING(80), allowNull: false, unique: true, field: 'disposal_number' },
  assetId: { type: DataTypes.INTEGER, allowNull: false, field: 'asset_id' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  locationId: { type: DataTypes.INTEGER, allowNull: true, field: 'location_id' },
  type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Disposal' },
  status: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Requested' },
  condition: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Poor' },
  reason: { type: DataTypes.TEXT, allowNull: false },
  technicalAssessment: { type: DataTypes.TEXT, allowNull: true, field: 'technical_assessment' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'requested_by' },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'reviewed_by' },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'approved_by' },
  executedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'executed_by' },
  purchaseValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'purchase_value' },
  bookValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'book_value' },
  accumulatedDepreciation: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'accumulated_depreciation' },
  netBookValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'net_book_value' },
  estimatedDisposalValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'estimated_disposal_value' },
  recoveryValue: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'recovery_value' },
  disposalCost: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0, field: 'disposal_cost' },
  scheduledDate: { type: DataTypes.DATE, allowNull: true, field: 'scheduled_date' },
  completedDate: { type: DataTypes.DATE, allowNull: true, field: 'completed_date' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true, field: 'rejection_reason' },
  cancellationReason: { type: DataTypes.TEXT, allowNull: true, field: 'cancellation_reason' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  documents: { type: DataTypes.TEXT, allowNull: true },
  createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'disposal_requests',
  timestamps: true,
});

module.exports = DisposalRequest;
