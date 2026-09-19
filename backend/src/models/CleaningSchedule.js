const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CleaningSchedule = sequelize.define('CleaningSchedule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  roomId: { type: DataTypes.INTEGER, allowNull: true, field: 'room_id' },
  laboratory: { type: DataTypes.STRING(255), allowNull: false },
  cleaningDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'cleaning_date' },
  assignedStaff: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_staff' },
  assignedByName: { type: DataTypes.STRING(255), defaultValue: '', field: 'assigned_by_name' },
  notes: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'scheduled' },
}, {
  tableName: 'cleaning_schedules',
  timestamps: true,
  indexes: [{ fields: ['cleaning_date'] }, { fields: ['status'] }],
});

module.exports = CleaningSchedule;