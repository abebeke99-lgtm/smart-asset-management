const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const stockAlertChanged = Symbol('stockAlertChanged');
const reconcileAfterCommit = (inventory, options) => {
  const run = () => {
    const { reconcileInventoryStockAlert } = require('../services/inventoryStockAlertService');
    reconcileInventoryStockAlert(inventory.id).catch((error) => {
      console.error('Inventory stock alert reconciliation failed:', error.message);
    });
  };
  if (options.transaction?.afterCommit) options.transaction.afterCommit(run);
  else run();
};

const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  assetId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  departmentId: { type: DataTypes.INTEGER, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  availableQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  reservedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  damagedQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  minimumQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  location: { type: DataTypes.STRING(255), defaultValue: '' },
  status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'available' },
}, {
  tableName: 'inventory',
  timestamps: true,
  hooks: {
    afterCreate(inventory, options) {
      reconcileAfterCommit(inventory, options);
    },
    beforeUpdate(inventory, options) {
      options[stockAlertChanged] = inventory.changed('availableQuantity') || inventory.changed('minimumQuantity');
    },
    afterUpdate(inventory, options) {
      if (options[stockAlertChanged]) reconcileAfterCommit(inventory, options);
    },
  },
});

module.exports = Inventory;
