const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HazardousWaste = sequelize.define('HazardousWaste', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  wasteCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'waste_code' },
  wasteStream: { type: DataTypes.STRING(255), allowNull: false, field: 'waste_stream' },
  chemicalId: { type: DataTypes.INTEGER, allowNull: true, field: 'chemical_id' },
  chemicalName: { type: DataTypes.STRING(255), defaultValue: '' },
  volume: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'L' },
  generatedDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'generated_date' },
  disposalDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'disposal_date' },
  disposalMethod: { type: DataTypes.STRING(255), allowNull: true, field: 'disposal_method' },
  responsiblePerson: { type: DataTypes.INTEGER, allowNull: true, field: 'responsible_person' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'stored' },
}, {
  tableName: 'hazardous_wastes',
  timestamps: true,
  indexes: [{ fields: ['chemical_id'] }, { fields: ['status'] }],
});

module.exports = HazardousWaste;