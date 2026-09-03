const { sequelize } = require('../config/database');
const User = require('./User');
const Asset = require('./Asset');
const Infrastructure = require('./Infrastructure')(sequelize);
const Assignment = require('./Assignment');
const Transfer = require('./Transfer');
const AuditLog = require('./AuditLog');
const AuditLogArchive = require('./AuditLogArchive');
const Category = require('./Category');
const Department = require('./Department');
const Maintenance = require('./Maintenance');
const MaintenanceInspection = require('./MaintenanceInspection');
const MaintenanceWorkOrder = require('./MaintenanceWorkOrder');
const MaintenanceRepair = require('./MaintenanceRepair');
const PreventiveMaintenance = require('./PreventiveMaintenance');
const SparePart = require('./SparePart');
const SparePartTransaction = require('./SparePartTransaction');
const MaintenanceTask = require('./MaintenanceTask');
const MaintenanceTest = require('./MaintenanceTest');
const MaintenanceCost = require('./MaintenanceCost');
const MaintenanceHistory = require('./MaintenanceHistory');
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

// Maintenance Relationships
Asset.hasMany(Maintenance, { foreignKey: 'assetId' });
Maintenance.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(Maintenance, { foreignKey: 'requestedBy', as: 'MaintenanceRequests' });
Maintenance.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
User.hasMany(Maintenance, { foreignKey: 'assignedTo', as: 'MaintenanceAssignments' });
Maintenance.belongsTo(User, { foreignKey: 'assignedTo', as: 'Technician' });

// Maintenance Inspection Relationships
Asset.hasMany(MaintenanceInspection, { foreignKey: 'assetId' });
MaintenanceInspection.belongsTo(Asset, { foreignKey: 'assetId' });
Maintenance.hasMany(MaintenanceInspection, { foreignKey: 'maintenanceId' });
MaintenanceInspection.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
User.hasMany(MaintenanceInspection, { foreignKey: 'inspectorId' });
MaintenanceInspection.belongsTo(User, { foreignKey: 'inspectorId', as: 'Inspector' });

// Maintenance Work Order Relationships
Asset.hasMany(MaintenanceWorkOrder, { foreignKey: 'assetId' });
MaintenanceWorkOrder.belongsTo(Asset, { foreignKey: 'assetId' });
Maintenance.hasMany(MaintenanceWorkOrder, { foreignKey: 'maintenanceId' });
MaintenanceWorkOrder.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
User.hasMany(MaintenanceWorkOrder, { foreignKey: 'technicianId' });
MaintenanceWorkOrder.belongsTo(User, { foreignKey: 'technicianId', as: 'Technician' });

// Maintenance Repair Relationships
Asset.hasMany(MaintenanceRepair, { foreignKey: 'assetId' });
MaintenanceRepair.belongsTo(Asset, { foreignKey: 'assetId' });
Maintenance.hasMany(MaintenanceRepair, { foreignKey: 'maintenanceId' });
MaintenanceRepair.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
MaintenanceWorkOrder.hasMany(MaintenanceRepair, { foreignKey: 'workOrderId' });
MaintenanceRepair.belongsTo(MaintenanceWorkOrder, { foreignKey: 'workOrderId' });
User.hasMany(MaintenanceRepair, { foreignKey: 'technicianId', as: 'Repairs' });
MaintenanceRepair.belongsTo(User, { foreignKey: 'technicianId', as: 'Technician' });

// Preventive Maintenance Relationships
Asset.hasMany(PreventiveMaintenance, { foreignKey: 'assetId' });
PreventiveMaintenance.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(PreventiveMaintenance, { foreignKey: 'technicianId' });
PreventiveMaintenance.belongsTo(User, { foreignKey: 'technicianId', as: 'Technician' });

// Spare Parts Relationships
SparePart.hasMany(SparePartTransaction, { foreignKey: 'sparePartId' });
SparePartTransaction.belongsTo(SparePart, { foreignKey: 'sparePartId' });
Maintenance.hasMany(SparePartTransaction, { foreignKey: 'maintenanceId' });
SparePartTransaction.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
MaintenanceRepair.hasMany(SparePartTransaction, { foreignKey: 'repairId' });
SparePartTransaction.belongsTo(MaintenanceRepair, { foreignKey: 'repairId' });
User.hasMany(SparePartTransaction, { foreignKey: 'userId' });
SparePartTransaction.belongsTo(User, { foreignKey: 'userId' });

// Maintenance Task Relationships
Maintenance.hasMany(MaintenanceTask, { foreignKey: 'maintenanceId' });
MaintenanceTask.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
MaintenanceWorkOrder.hasMany(MaintenanceTask, { foreignKey: 'workOrderId' });
MaintenanceTask.belongsTo(MaintenanceWorkOrder, { foreignKey: 'workOrderId' });
Asset.hasMany(MaintenanceTask, { foreignKey: 'assetId' });
MaintenanceTask.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(MaintenanceTask, { foreignKey: 'assignedToId' });
MaintenanceTask.belongsTo(User, { foreignKey: 'assignedToId', as: 'AssignedTo' });

// Maintenance Test Relationships
Maintenance.hasMany(MaintenanceTest, { foreignKey: 'maintenanceId' });
MaintenanceTest.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
MaintenanceWorkOrder.hasMany(MaintenanceTest, { foreignKey: 'workOrderId' });
MaintenanceTest.belongsTo(MaintenanceWorkOrder, { foreignKey: 'workOrderId' });
Asset.hasMany(MaintenanceTest, { foreignKey: 'assetId' });
MaintenanceTest.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(MaintenanceTest, { foreignKey: 'testerId' });
MaintenanceTest.belongsTo(User, { foreignKey: 'testerId', as: 'Tester' });

// Maintenance Cost Relationships
Maintenance.hasMany(MaintenanceCost, { foreignKey: 'maintenanceId' });
MaintenanceCost.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
MaintenanceRepair.hasMany(MaintenanceCost, { foreignKey: 'repairId' });
MaintenanceCost.belongsTo(MaintenanceRepair, { foreignKey: 'repairId' });
MaintenanceWorkOrder.hasMany(MaintenanceCost, { foreignKey: 'workOrderId' });
MaintenanceCost.belongsTo(MaintenanceWorkOrder, { foreignKey: 'workOrderId' });
Asset.hasMany(MaintenanceCost, { foreignKey: 'assetId' });
MaintenanceCost.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(MaintenanceCost, { foreignKey: 'approvedBy' });
MaintenanceCost.belongsTo(User, { foreignKey: 'approvedBy', as: 'ApprovedByUser' });

// Maintenance History Relationships
Asset.hasMany(MaintenanceHistory, { foreignKey: 'assetId' });
MaintenanceHistory.belongsTo(Asset, { foreignKey: 'assetId' });
Maintenance.hasMany(MaintenanceHistory, { foreignKey: 'maintenanceId' });
MaintenanceHistory.belongsTo(Maintenance, { foreignKey: 'maintenanceId' });
User.hasMany(MaintenanceHistory, { foreignKey: 'userId' });
MaintenanceHistory.belongsTo(User, { foreignKey: 'userId' });

// RFID and Audit Relationships
Asset.hasMany(RFIDLog, { foreignKey: 'assetId' });
RFIDLog.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(AuditLog, { foreignKey: 'userId' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });
User.hasOne(MfaSetting, { foreignKey: 'userId', onDelete: 'CASCADE' });
MfaSetting.belongsTo(User, { foreignKey: 'userId' });

module.exports = {
  sequelize,
  User,
  Asset,
  Infrastructure,
  Assignment,
  Transfer,
  AuditLog,
  AuditLogArchive,
  Category,
  Department,
  Maintenance,
  MaintenanceInspection,
  MaintenanceWorkOrder,
  MaintenanceRepair,
  PreventiveMaintenance,
  SparePart,
  SparePartTransaction,
  MaintenanceTask,
  MaintenanceTest,
  MaintenanceCost,
  MaintenanceHistory,
  Notification,
  RFIDLog,
  Inventory,
  InventoryTransaction,
  Approval,
  FinancialRecord,
  Config,
  SettingsVersion,
  MfaSetting,
};
