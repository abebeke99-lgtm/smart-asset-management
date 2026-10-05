const { DataTypes } = require('sequelize');
const crypto = require('node:crypto');
const { sequelize } = require('../config/database');

const Asset = sequelize.define('Asset', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(255), defaultValue: '' },
  subcategory: { type: DataTypes.STRING(255), defaultValue: '' },
  unit: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'unit' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  serialNumber: { type: DataTypes.STRING(255), defaultValue: '' },
  assetCode: { type: DataTypes.STRING(255), defaultValue: '' },
  digitalId: { type: DataTypes.STRING(100), allowNull: true, unique: true, field: 'digital_id' },
  qrCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'qr_code' },
  rfidTag: { type: DataTypes.STRING(255), allowNull: true, defaultValue: null, unique: true },
  status: { type: DataTypes.STRING(100), defaultValue: 'available' },
  condition: { type: DataTypes.STRING(100), defaultValue: 'Good' },
  department: { type: DataTypes.STRING(255), defaultValue: '' },
  collegeId: { type: DataTypes.INTEGER, allowNull: true, field: 'college_id' },
  departmentId: { type: DataTypes.INTEGER, allowNull: true, field: 'department_id' },
  campusId: { type: DataTypes.INTEGER, allowNull: true, field: 'campus_id' },
  buildingId: { type: DataTypes.INTEGER, allowNull: true, field: 'building_id' },
  roomId: { type: DataTypes.INTEGER, allowNull: true, field: 'room_id' },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  specifications: { type: DataTypes.JSON, allowNull: true },
  fundingSource: { type: DataTypes.STRING(255), defaultValue: '' },
  purchaseDate: { type: DataTypes.DATE, allowNull: true },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'expiry_date' },
  batchLot: { type: DataTypes.STRING(100), allowNull: true, field: 'batch_lot' },
  purchasePrice: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  supplier: { type: DataTypes.STRING(255), defaultValue: '' },
  manufacturer: { type: DataTypes.STRING(255), defaultValue: '' },
  model: { type: DataTypes.STRING(255), defaultValue: '' },
  warrantyExpiry: { type: DataTypes.DATE, allowNull: true },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  currentValue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  healthScore: { type: DataTypes.INTEGER, defaultValue: 100 },
  createdBy: { type: DataTypes.INTEGER, defaultValue: 0 },
  deletedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'deleted_by' },
}, {
  tableName: 'assets',
  timestamps: true,
  indexes: [{ fields: ['digital_id'] }, { fields: ['status'] }, { fields: ['serial_number'] }, { fields: ['campus_id'] }, { fields: ['building_id'] }, { fields: ['room_id'] }],
  hooks: {
    beforeValidate(asset) {
      const qrChanged = asset.changed('qrCode');
      const legacyQrChanged = asset.changed('digitalId');
      if (qrChanged) {
        const value = asset.qrCode || asset.digitalId || `QR-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
        asset.qrCode = value;
        asset.digitalId = value;
      } else if (legacyQrChanged) {
        const value = asset.digitalId || asset.qrCode || `QR-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
        asset.digitalId = value;
        asset.qrCode = value;
      } else if (asset.isNewRecord && !asset.qrCode && !asset.digitalId) {
        const generated = `QR-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
        asset.qrCode = generated;
        asset.digitalId = generated;
      } else if (asset.isNewRecord && !asset.qrCode) {
        asset.qrCode = asset.digitalId;
      } else if (asset.isNewRecord && !asset.digitalId) {
        asset.digitalId = asset.qrCode;
      }
      if (typeof asset.qrCode === 'string') asset.qrCode = asset.qrCode.trim().toUpperCase() || null;
      if (typeof asset.digitalId === 'string') asset.digitalId = asset.digitalId.trim().toUpperCase() || null;
      if (typeof asset.rfidTag === 'string') asset.rfidTag = asset.rfidTag.trim().toUpperCase() || null;
    },
  },
  paranoid: true,
});

module.exports = Asset;