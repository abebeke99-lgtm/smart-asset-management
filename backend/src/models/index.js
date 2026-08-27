const { sequelize } = require('../config/database');
const User = require('./User');
const Asset = require('./Asset');
const Assignment = require('./Assignment');
const Transfer = require('./Transfer');
const AuditLog = require('./AuditLog');
const AuditLogArchive = require('./AuditLogArchive');
const Category = require('./Category');
const Department = require('./Department');
const Maintenance = require('./Maintenance');
const Notification = require('./Notification');
const RFIDLog = require('./RFIDLog');
const Inventory = require('./Inventory');
const InventoryTransaction = require('./InventoryTransaction');
const Approval = require('./Approval');
const FinancialRecord = require('./FinancialRecord');
const Config = require('./Config');
const SettingsVersion = require('./SettingsVersion');
const MfaSetting = require('./MfaSetting');

Asset.hasMany(Assignment, { foreignKey: 'assetId' });
Assignment.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(Assignment, { foreignKey: 'assignedTo' });
Assignment.belongsTo(User, { foreignKey: 'assignedTo' });
Asset.hasMany(Transfer, { foreignKey: 'assetId' });
Transfer.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(Transfer, { foreignKey: 'createdBy', as: 'CreatedTransfers' });
Transfer.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
User.hasMany(Transfer, { foreignKey: 'approvedBy', as: 'ApprovedTransfers' });
Transfer.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
Asset.hasOne(Inventory, { foreignKey: 'assetId' });
Inventory.belongsTo(Asset, { foreignKey: 'assetId' });
Department.hasMany(Inventory, { foreignKey: 'departmentId' });
Inventory.belongsTo(Department, { foreignKey: 'departmentId' });
Inventory.hasMany(InventoryTransaction, { foreignKey: 'inventoryId' });
InventoryTransaction.belongsTo(Inventory, { foreignKey: 'inventoryId' });
Asset.hasMany(InventoryTransaction, { foreignKey: 'assetId' });
InventoryTransaction.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(InventoryTransaction, { foreignKey: 'userId' });
InventoryTransaction.belongsTo(User, { foreignKey: 'userId' });
Asset.hasMany(Approval, { foreignKey: 'assetId' });
Approval.belongsTo(Asset, { foreignKey: 'assetId' });
Department.hasMany(Approval, { foreignKey: 'departmentId' });
Approval.belongsTo(Department, { foreignKey: 'departmentId' });
User.hasMany(Approval, { foreignKey: 'requestedBy', as: 'RequestedApprovals' });
Approval.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
User.hasMany(Approval, { foreignKey: 'reviewedBy', as: 'ReviewedApprovals' });
Approval.belongsTo(User, { foreignKey: 'reviewedBy', as: 'Reviewer' });
Asset.hasMany(FinancialRecord, { foreignKey: 'assetId' });
FinancialRecord.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(FinancialRecord, { foreignKey: 'recordedBy' });
FinancialRecord.belongsTo(User, { foreignKey: 'recordedBy' });
Asset.hasMany(Maintenance, { foreignKey: 'assetId' });
Maintenance.belongsTo(Asset, { foreignKey: 'assetId' });
Asset.hasMany(RFIDLog, { foreignKey: 'assetId' });
RFIDLog.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(Maintenance, { foreignKey: 'requestedBy', as: 'MaintenanceRequests' });
Maintenance.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
User.hasMany(Maintenance, { foreignKey: 'assignedTo', as: 'MaintenanceAssignments' });
Maintenance.belongsTo(User, { foreignKey: 'assignedTo', as: 'Technician' });
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(MfaSetting, { foreignKey: 'userId', onDelete: 'CASCADE' });
MfaSetting.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Asset,
  Assignment,
  Transfer,
  AuditLog,
  AuditLogArchive,
  Categ