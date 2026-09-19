const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChemicalTransfer = sequelize.define('ChemicalTransfer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  transferCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'transfer_code' },
  chemicalId: { type: DataTypes.INTEGER, allowNull: false, field: 'chemical_id' },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'L' },
  sourceLab: { type: DataTypes.STRING(255), allowNull: false, field: 'source_lab' },
  sourceCampusId: { type: DataTypes.INTEGER, allowNull: true, field: 'source_campus_id' },
  destinationLab: { type: DataTypes.STRING(255), allowNull: false, field: 'destination_lab' },
  destinationCampusId: { type: DataTypes.INTEGER, allowNull: true, field: 'destination_campus_id' },
  requestedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'requested_by' },
  approvedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'approved_by' },
  acceptedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'accepted_by' },
  requestedAt: { type: DataTypes.DATE, allowNull: true, field: 'requested_at' },
  approvedAt: { type: DataTypes.DATE, allowNull: true, field: 'approved_at' },
  transferredAt: { type: DataTypes.DATE, allowNull: true, field: 'transferred_at' },
  acceptedAt: { type: DataTypes.DATE, allowNull: true, field: 'accepted_at' },
  safetyConfirmation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'safety_confirmation' },
  safetyNotes: { type: DataTypes.TEXT, defaultValue: '', field: 'safety_notes' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'pending' },
}, {
  tableName: 'chemical_transfers',
  timestamps: true,
  indexes: [{ fields: ['chemical_id'] }, { fields: ['status'] }],
});

module.exports = ChemicalTransfer;