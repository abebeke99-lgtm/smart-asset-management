const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ChemicalTransaction = sequelize.define('ChemicalTransaction', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  chemicalId: { type: DataTypes.INTEGER, allowNull: false, field: 'chemical_id' },
  type: { type: DataTypes.ENUM('consumption', 'restock', 'adjustment', 'transfer-out', 'transfer-in', 'disposal'), allowNull: false, defaultValue: 'consumption' },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'L' },
  laboratorySession: { type: DataTypes.STRING(255), allowNull: true, field: 'laboratory_session' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  recordedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'recorded_by' },
}, {
  tableName: 'chemical_transactions',
  timestamps: true,
  indexes: [{ fields: ['chemical_id'] }, { fields: ['type'] }],
});

module.exports = ChemicalTransaction;