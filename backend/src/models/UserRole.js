const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('UserRole', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
  scopeType: {
    type: DataTypes.ENUM('system', 'college', 'department', 'store', 'location', 'own'),
    allowNull: false,
    defaultValue: 'system',
    field: 'scope_type',
  },
  scopeId: { type: DataTypes.INTEGER, allowNull: true, field: 'scope_id' },
}, {
  tableName: 'user_roles',
  timestamps: true,
  indexes: [{ unique: true, fields: ['user_id', 'role_id', 'scope_type', 'scope_id'] }],
});
