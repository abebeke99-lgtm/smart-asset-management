const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Room = sequelize.define('Room', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buildingId: { type: DataTypes.INTEGER, allowNull: false, field: 'building_id' },
  campusId: { type: DataTypes.INTEGER, allowNull: true, field: 'campus_id' },
  roomCode: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'room_code' },
  roomName: { type: DataTypes.STRING(255), allowNull: false, field: 'room_name' },
  roomType: { type: DataTypes.STRING(100), defaultValue: 'laboratory' },
  floor: { type: DataTypes.INTEGER, allowNull: true },
  capacity: { type: DataTypes.INTEGER, allowNull: true },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' },
}, {
  tableName: 'rooms',
  timestamps: true,
  indexes: [{ fields: ['building_id'] }, { fields: ['campus_id'] }, { fields: ['room_type'] }],
});

module.exports = Room;