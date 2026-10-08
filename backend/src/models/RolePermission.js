const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('RolePermission', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  roleId: { type: DataTypes.INTEGER, allowNull: false, field: 'role_id' },
  permissionId: { type: DataTypes.INTEGER, allowNull: false, field: 'permission_id' },
  scopeType: {
    type: DataTypes.ENUM('system', 'college', 'department', 'store', 'location', 'own'),
    allowNull: false,
    defaultValue: 'system',
    field: 'scope_type',
  },
  limited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'role_permissions',
  timestamps: true,
  indexes: [{ unique: true, fields: ['role_id', 'permission_id'] }],
});
