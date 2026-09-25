const { sequelize } = require('../config/database');
const User = require('./User');
const College = require('./College');
const Asset = require('./Asset');
const Infrastructure = require('./Infrastructure')(sequelize);
const InfrastructureInspection = require('./InfrastructureInspection');
const Assignment = require('./Assignment');
const Transfer = require('./Transfer');
const AuditLog = require('./AuditLog');
const AuditLogArchive = require('./AuditLogArchive');
const Category = require('./Category');
const Location = require('./Location');
const RfidDevice = require('./RfidDevice');
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
const NotificationDelivery = require('./NotificationDelivery');
const RFIDLog = require('./RFIDLog');
const Inventory = require('./Inventory');
const InventoryTransaction = require('./InventoryTransaction');
const Approval = require('./Approval');
const FinancialRecord = require('./FinancialRecord');
const DepreciationRecord = require('./DepreciationRecord');
const CapitalizationRecord = require('./CapitalizationRecord');
const DisposalFinancialRecord = require('./DisposalFinancialRecord');
const Config = require('./Config');
const SettingsVersion = require('./SettingsVersion');
const SystemAlert = require('./SystemAlert');
const MfaSetting = require('./MfaSetting');
const VerificationSession = require('./VerificationSession');
const VerificationItem = require('./VerificationItem');
const AssetMovement = require('./AssetMovement');
const AssetReturn = require('./AssetReturn');
const DisposalRequest = require('./DisposalRequest');
const PurchaseOrder = require('./PurchaseOrder');
const PurchaseOrderItem = require('./PurchaseOrderItem');
const Supplier = require('./Supplier');
const Invoice = require('./Invoice');
const InvoiceItem = require('./InvoiceItem');
const Payment = require('./Payment');
const FiscalYear = require('./FiscalYear');
const FundSource = require('./FundSource');
const Budget = require('./Budget');
const Campus = require('./Campus');
const Building = require('./Building');
const Room = require('./Room');
const Chemical = require('./Chemical');
const ChemicalTransaction = require('./ChemicalTransaction');
const ChemicalTransfer = require('./ChemicalTransfer');
const ChemicalDocument = require('./ChemicalDocument');
const HazardousWaste = require('./HazardousWaste');
const StockOrder = require('./StockOrder');
const ServiceRequest = require('./ServiceRequest');
const RequestAttachment = require('./RequestAttachment');
const RequestStatusHistory = require('./RequestStatusHistory');
const Feedback = require('./Feedback');
const SupportTicketComment = require('./SupportTicketComment');
const CleaningSchedule = require('./CleaningSchedule');
const UploadRecord = require('./UploadRecord');
const AssetDocument = require('./AssetDocument');
const AssetGrant = require('./AssetGrant');
const AssetCustody = require('./AssetCustody');
const SoftwareLicense = require('./SoftwareLicense');
const SoftwareLicenseAssignment = require('./SoftwareLicenseAssignment');
const Incident = require('./Incident');
const IncidentComment = require('./IncidentComment');
const IncidentHistory = require('./IncidentHistory');
const IncidentAttachment = require('./IncidentAttachment');

Asset.hasMany(Assignment, { foreignKey: 'assetId' });
Assignment.belongsTo(Asset, { foreignKey: 'assetId' });
College.hasMany(Department, { foreignKey: 'collegeId' });
Department.belongsTo(College, { foreignKey: 'collegeId' });
Department.belongsTo(Location, { foreignKey: 'locationId', as: 'LocationRecord' });
Department.belongsTo(User, { foreignKey: 'headId', as: 'Head' });
College.hasMany(User, { foreignKey: 'collegeId' });
User.belongsTo(College, { foreignKey: 'collegeId' });
College.hasMany(Asset, { foreignKey: 'collegeId' });
Asset.belongsTo(College, { foreignKey: 'collegeId' });
Asset.hasMany(AssetMovement, { foreignKey: 'assetId' });
AssetMovement.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(AssetMovement, { foreignKey: 'performedBy' });
AssetMovement.belongsTo(User, { foreignKey: 'performedBy' });
Asset.hasMany(AssetReturn, { foreignKey: 'assetId' });
AssetReturn.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(AssetReturn, { foreignKey: 'requestedBy', as: 'RequestedReturns' });
AssetReturn.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
AssetReturn.belongsTo(User, { foreignKey: 'sourceUserId', as: 'SourceUser' });
Transfer.hasMany(AssetMovement, { foreignKey: 'referenceId', constraints: false, scope: { referenceType: 'transfer' } });
Department.hasMany(User, { foreignKey: 'departmentId' });
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
Department.hasMany(Asset, { foreignKey: 'departmentId' });
Asset.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
User.hasMany(Assignment, { foreignKey: 'assignedTo' });
Assignment.belongsTo(User, { foreignKey: 'assignedTo' });
Asset.hasMany(Transfer, { foreignKey: 'assetId' });
Transfer.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(Transfer, { foreignKey: 'createdBy', as: 'CreatedTransfers' });
Transfer.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
User.hasMany(Transfer, { foreignKey: 'approvedBy', as: 'ApprovedTransfers' });
User.hasMany(Transfer, { foreignKey: 'requestedBy', as: 'RequestedTransfers' });
Transfer.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
Transfer.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
Asset.hasOne(Inventory, { foreignKey: 'assetId' });
Inventory.belongsTo(Asset, { foreignKey: 'assetId' });
Department.hasMany(Inventory, { foreignKey: 'departmentId' });
Inventory.belongsTo(Department, { foreignKey: 'departmentId' });
Inventory.hasMany(InventoryTransaction, { foreignKey: 'inventoryId' });
InventoryTransaction.belongsTo(Inventory, { foreignKey: 'inventoryId' });
Department.hasMany(InventoryTransaction, { foreignKey: 'departmentId' });
InventoryTransaction.belongsTo(Department, { foreignKey: 'departmentId' });
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
Asset.hasMany(DisposalFinancialRecord, { foreignKey: 'assetId' });
DisposalFinancialRecord.belongsTo(Asset, { foreignKey: 'assetId' });
DisposalRequest.hasOne(DisposalFinancialRecord, { foreignKey: 'disposalRequestId' });
DisposalFinancialRecord.belongsTo(DisposalRequest, { foreignKey: 'disposalRequestId' });
Department.hasMany(DisposalFinancialRecord, { foreignKey: 'departmentId' });
DisposalFinancialRecord.belongsTo(Department, { foreignKey: 'departmentId' });
Asset.hasMany(DepreciationRecord, { foreignKey: 'assetId' });
DepreciationRecord.belongsTo(Asset, { foreignKey: 'assetId' });
Asset.hasOne(CapitalizationRecord, { foreignKey: 'assetId' });
CapitalizationRecord.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(FinancialRecord, { foreignKey: 'recordedBy' });
FinancialRecord.belongsTo(User, { foreignKey: 'recordedBy' });
User.hasMany(DepreciationRecord, { foreignKey: 'recordedBy' });
DepreciationRecord.belongsTo(User, { foreignKey: 'recordedBy' });
User.hasMany(CapitalizationRecord, { foreignKey: 'createdBy' });
CapitalizationRecord.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: 'purchaseOrderId', as: 'items', onDelete: 'CASCADE' });
PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
PurchaseOrder.hasOne(CapitalizationRecord, { foreignKey: 'purchaseOrderId' });
CapitalizationRecord.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId' });
PurchaseOrder.belongsTo(Approval, { foreignKey: 'purchaseRequestId', as: 'PurchaseRequest' });
Approval.hasMany(PurchaseOrder, { foreignKey: 'purchaseRequestId', as: 'PurchaseOrders' });
PurchaseOrder.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
PurchaseOrder.belongsTo(Budget, { foreignKey: 'budgetId', as: 'BudgetRecord' });
Budget.hasMany(PurchaseOrder, { foreignKey: 'budgetId', as: 'PurchaseOrders' });
Budget.belongsTo(FiscalYear, { foreignKey: 'fiscalYearId', as: 'FiscalYear' });
Budget.belongsTo(FundSource, { foreignKey: 'fundSourceId', as: 'FundSource' });
Budget.belongsTo(College, { foreignKey: 'collegeId', as: 'CollegeRecord' });
Budget.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
FiscalYear.hasMany(Budget, { foreignKey: 'fiscalYearId' });
FundSource.hasMany(Budget, { foreignKey: 'fundSourceId' });
College.hasMany(Budget, { foreignKey: 'collegeId', as: 'Budgets' });
Department.hasMany(Budget, { foreignKey: 'departmentId', as: 'Budgets' });
PurchaseOrder.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
PurchaseOrder.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });
Invoice.hasOne(CapitalizationRecord, { foreignKey: 'invoiceId' });
CapitalizationRecord.belongsTo(Invoice, { foreignKey: 'invoiceId' });
Invoice.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'PurchaseOrder' });
Invoice.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
Invoice.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Invoice.hasMany(Payment, { foreignKey: 'invoiceId', as: 'payments' });
Payment.belongsTo(Invoice, { foreignKey: 'invoiceId', as: 'InvoiceRecord' });
Payment.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
Payment.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
Payment.belongsTo(User, { foreignKey: 'processedBy', as: 'Processor' });

Asset.hasMany(DisposalRequest, { foreignKey: 'assetId' });
DisposalRequest.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(DisposalRequest, { foreignKey: 'requestedBy', as: 'RequestedDisposals' });
DisposalRequest.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
User.hasMany(DisposalRequest, { foreignKey: 'reviewedBy', as: 'ReviewedDisposals' });
DisposalRequest.belongsTo(User, { foreignKey: 'reviewedBy', as: 'Reviewer' });
User.hasMany(DisposalRequest, { foreignKey: 'approvedBy', as: 'ApprovedDisposals' });
DisposalRequest.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
User.hasMany(DisposalRequest, { foreignKey: 'executedBy', as: 'ExecutedDisposals' });
DisposalRequest.belongsTo(User, { foreignKey: 'executedBy', as: 'Executor' });
Department.hasMany(DisposalRequest, { foreignKey: 'departmentId' });
DisposalRequest.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
College.hasMany(DisposalRequest, { foreignKey: 'collegeId' });
DisposalRequest.belongsTo(College, { foreignKey: 'collegeId', as: 'CollegeRecord' });

// Maintenance Relationships
Infrastructure.hasMany(InfrastructureInspection, { foreignKey: 'assetId', constraints: false });
InfrastructureInspection.belongsTo(Infrastructure, { foreignKey: 'assetId', constraints: false });

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
User.hasMany(Notification, { foreignKey: 'userId', as: 'Notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'Recipient' });
Notification.hasMany(NotificationDelivery, { foreignKey: 'notificationId' });
NotificationDelivery.belongsTo(Notification, { foreignKey: 'notificationId' });
User.hasMany(NotificationDelivery, { foreignKey: 'recipientId', as: 'NotificationDeliveries' });
NotificationDelivery.belongsTo(User, { foreignKey: 'recipientId', as: 'DeliveryRecipient' });
User.hasOne(MfaSetting, { foreignKey: 'userId', onDelete: 'CASCADE' });
MfaSetting.belongsTo(User, { foreignKey: 'userId' });
College.hasMany(VerificationSession, { foreignKey: 'collegeId' });
VerificationSession.belongsTo(College, { foreignKey: 'collegeId' });
Department.hasMany(VerificationSession, { foreignKey: 'departmentId' });
VerificationSession.belongsTo(Department, { foreignKey: 'departmentId' });
User.hasMany(VerificationSession, { foreignKey: 'startedBy' });
VerificationSession.belongsTo(User, { foreignKey: 'startedBy', as: 'Starter' });
VerificationSession.hasMany(VerificationItem, { foreignKey: 'sessionId' });
VerificationItem.belongsTo(VerificationSession, { foreignKey: 'sessionId' });
Asset.hasMany(VerificationItem, { foreignKey: 'assetId' });
VerificationItem.belongsTo(Asset, { foreignKey: 'assetId' });

// Location Hierarchy Relationships
Campus.hasMany(Building, { foreignKey: 'campusId' });
Building.belongsTo(Campus, { foreignKey: 'campusId' });
Campus.hasMany(Room, { foreignKey: 'campusId' });
Room.belongsTo(Campus, { foreignKey: 'campusId' });
Building.hasMany(Room, { foreignKey: 'buildingId' });
Room.belongsTo(Building, { foreignKey: 'buildingId' });
Asset.belongsTo(Campus, { foreignKey: 'campusId', as: 'CampusRecord' });
Asset.belongsTo(Building, { foreignKey: 'buildingId', as: 'BuildingRecord' });
Asset.belongsTo(Room, { foreignKey: 'roomId', as: 'RoomRecord' });

// Chemical Relationships
Chemical.hasMany(ChemicalTransaction, { foreignKey: 'chemicalId' });
ChemicalTransaction.belongsTo(Chemical, { foreignKey: 'chemicalId' });
Chemical.hasMany(ChemicalTransfer, { foreignKey: 'chemicalId', as: 'Transfers' });
ChemicalTransfer.belongsTo(Chemical, { foreignKey: 'chemicalId' });
User.hasMany(ChemicalTransfer, { foreignKey: 'requestedBy', as: 'RequestedChemicalTransfers' });
ChemicalTransfer.belongsTo(User, { foreignKey: 'requestedBy', as: 'Requester' });
User.hasMany(ChemicalTransfer, { foreignKey: 'approvedBy', as: 'ApprovedChemicalTransfers' });
ChemicalTransfer.belongsTo(User, { foreignKey: 'approvedBy', as: 'Approver' });
User.hasMany(ChemicalTransfer, { foreignKey: 'acceptedBy', as: 'AcceptedChemicalTransfers' });
ChemicalTransfer.belongsTo(User, { foreignKey: 'acceptedBy', as: 'Accepter' });
Chemical.hasMany(ChemicalDocument, { foreignKey: 'chemicalId' });
ChemicalDocument.belongsTo(Chemical, { foreignKey: 'chemicalId' });
Chemical.hasMany(HazardousWaste, { foreignKey: 'chemicalId' });
HazardousWaste.belongsTo(Chemical, { foreignKey: 'chemicalId' });
Chemical.hasMany(StockOrder, { foreignKey: 'chemicalId' });
StockOrder.belongsTo(Chemical, { foreignKey: 'chemicalId' });
User.hasMany(StockOrder, { foreignKey: 'assignedTo', as: 'AssignedStockOrders' });
StockOrder.belongsTo(User, { foreignKey: 'assignedTo', as: 'Assignee' });
Chemical.belongsTo(Room, { foreignKey: 'roomId', as: 'RoomRecord' });
Chemical.belongsTo(Building, { foreignKey: 'buildingId', as: 'BuildingRecord' });
Chemical.belongsTo(Campus, { foreignKey: 'campusId', as: 'CampusRecord' });

// Service Request Relationships
ServiceRequest.hasMany(RequestAttachment, { foreignKey: 'requestId', onDelete: 'CASCADE' });
RequestAttachment.belongsTo(ServiceRequest, { foreignKey: 'requestId' });
ServiceRequest.hasMany(RequestStatusHistory, { foreignKey: 'requestId', onDelete: 'CASCADE' });
RequestStatusHistory.belongsTo(ServiceRequest, { foreignKey: 'requestId' });
ServiceRequest.hasMany(Feedback, { foreignKey: 'requestId' });
Feedback.belongsTo(ServiceRequest, { foreignKey: 'requestId' });
User.hasMany(ServiceRequest, { foreignKey: 'reportedBy', as: 'ReportedServiceRequests' });
ServiceRequest.belongsTo(User, { foreignKey: 'reportedBy', as: 'Reporter' });
User.hasMany(ServiceRequest, { foreignKey: 'assignedTo', as: 'AssignedServiceRequests' });
ServiceRequest.belongsTo(User, { foreignKey: 'assignedTo', as: 'Assignee' });
Asset.hasMany(ServiceRequest, { foreignKey: 'assetId' });
ServiceRequest.belongsTo(Asset, { foreignKey: 'assetId' });
ServiceRequest.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
ServiceRequest.belongsTo(College, { foreignKey: 'collegeId', as: 'CollegeRecord' });
ServiceRequest.hasOne(Feedback, { foreignKey: 'requestId', as: 'RequestFeedback' });
ServiceRequest.hasMany(SupportTicketComment, { foreignKey: 'ticketId', onDelete: 'CASCADE' });
SupportTicketComment.belongsTo(ServiceRequest, { foreignKey: 'ticketId' });
SupportTicketComment.belongsTo(User, { foreignKey: 'userId', as: 'Author' });
User.hasMany(SupportTicketComment, { foreignKey: 'userId' });
User.hasMany(Feedback, { foreignKey: 'submittedBy', as: 'SubmittedFeedback' });
Feedback.belongsTo(User, { foreignKey: 'submittedBy', as: 'Submitter' });

// Cleaning Schedule Relationships
CleaningSchedule.belongsTo(Room, { foreignKey: 'roomId' });
CleaningSchedule.belongsTo(User, { foreignKey: 'assignedStaff', as: 'Staff' });

// Asset Document / Grant / Custody Relationships
Asset.hasMany(AssetDocument, { foreignKey: 'assetId' });
AssetDocument.belongsTo(Asset, { foreignKey: 'assetId' });
Asset.hasMany(AssetGrant, { foreignKey: 'assetId' });
AssetGrant.belongsTo(Asset, { foreignKey: 'assetId' });
Asset.hasMany(AssetCustody, { foreignKey: 'assetId' });
AssetCustody.belongsTo(Asset, { foreignKey: 'assetId' });
User.hasMany(AssetCustody, { foreignKey: 'custodianId', as: 'CustodianRecords' });
AssetCustody.belongsTo(User, { foreignKey: 'custodianId', as: 'Custodian' });

SoftwareLicense.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
SoftwareLicense.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });
SoftwareLicense.belongsTo(College, { foreignKey: 'collegeId', as: 'CollegeRecord' });
SoftwareLicense.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
SoftwareLicense.belongsTo(Location, { foreignKey: 'locationId', as: 'LocationRecord' });
SoftwareLicense.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'SupplierRecord' });
SoftwareLicense.hasMany(SoftwareLicenseAssignment, { foreignKey: 'softwareLicenseId', as: 'Assignments', onDelete: 'RESTRICT' });
SoftwareLicenseAssignment.belongsTo(SoftwareLicense, { foreignKey: 'softwareLicenseId' });
SoftwareLicenseAssignment.belongsTo(User, { foreignKey: 'userId', as: 'User' });
SoftwareLicenseAssignment.belongsTo(Asset, { foreignKey: 'assetId', as: 'Asset' });

// Incident management relationships
Incident.belongsTo(User, { foreignKey: 'reporterId', as: 'Reporter' });
Incident.belongsTo(User, { foreignKey: 'assignedTechnicianId', as: 'Technician' });
Incident.belongsTo(User, { foreignKey: 'resolvedBy', as: 'Resolver' });
Incident.belongsTo(User, { foreignKey: 'closedBy', as: 'Closer' });
Incident.belongsTo(Asset, { foreignKey: 'assetId' });
Incident.belongsTo(Department, { foreignKey: 'departmentId', as: 'DepartmentRecord' });
Incident.belongsTo(Location, { foreignKey: 'locationId', as: 'LocationRecord' });
Incident.hasMany(IncidentComment, { foreignKey: 'incidentId', onDelete: 'CASCADE' });
IncidentComment.belongsTo(Incident, { foreignKey: 'incidentId' });
IncidentComment.belongsTo(User, { foreignKey: 'userId', as: 'Author' });
Incident.hasMany(IncidentHistory, { foreignKey: 'incidentId', onDelete: 'CASCADE' });
IncidentHistory.belongsTo(Incident, { foreignKey: 'incidentId' });
IncidentHistory.belongsTo(User, { foreignKey: 'userId', as: 'Actor' });
Incident.hasMany(IncidentAttachment, { foreignKey: 'incidentId', onDelete: 'CASCADE' });
IncidentAttachment.belongsTo(Incident, { foreignKey: 'incidentId' });
IncidentAttachment.belongsTo(User, { foreignKey: 'uploadedBy', as: 'Uploader' });

module.exports = {
  sequelize,
  User,
  College,
  Asset,
  CapitalizationRecord,
  DepreciationRecord,
  Infrastructure,
  Assignment,
  Transfer,
  AuditLog,
  AuditLogArchive,
  Category,
  Location,
  RfidDevice,
  Department,
  Maintenance,
  MaintenanceInspection,
  InfrastructureInspection,
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
  NotificationDelivery,
  RFIDLog,
  Inventory,
  InventoryTransaction,
  Approval,
  FinancialRecord,
  DisposalFinancialRecord,
  Config,
  SettingsVersion,
  SystemAlert,
  MfaSetting,
  VerificationSession,
  VerificationItem,
  AssetMovement,
  AssetReturn,
  DisposalRequest,
  PurchaseOrder,
  PurchaseOrderItem,
  Supplier,
  Invoice,
  InvoiceItem,
  FiscalYear,
  FundSource,
  Budget,
  Campus,
  Building,
  Room,
  Chemical,
  ChemicalTransaction,
  ChemicalTransfer,
  ChemicalDocument,
  HazardousWaste,
  StockOrder,
  ServiceRequest,
  RequestAttachment,
  RequestStatusHistory,
  SupportTicketComment,
  Feedback,
  CleaningSchedule,
  UploadRecord,
  AssetDocument,
  AssetGrant,
  AssetCustody,
  SoftwareLicense,
  SoftwareLicenseAssignment,
  Incident,
  IncidentComment,
  IncidentHistory,
  IncidentAttachment,
};
