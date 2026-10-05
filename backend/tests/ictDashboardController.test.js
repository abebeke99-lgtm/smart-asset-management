const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/ictAssetController');
const { sequelize, Asset, Department, Approval, ServiceRequest, Notification, Incident, PreventiveMaintenance, Assignment, Maintenance, SoftwareLicense, AuditLog, MaintenanceHistory, RequestStatusHistory, IncidentHistory } = require('../src/models');

const originals = {
  sequelizeAuthenticate: sequelize.authenticate,
  assetFindAll: Asset.findAll,
  departmentFindAll: Department.findAll,
  approvalFindAll: Approval.findAll,
  approvalCount: Approval.count,
  serviceRequestCount: ServiceRequest.count,
  serviceRequestFindAll: ServiceRequest.findAll,
  notificationFindAll: Notification.findAll,
  incidentCount: Incident.count,
  incidentFindAll: Incident.findAll,
  preventiveMaintenanceCount: PreventiveMaintenance.count,
  preventiveMaintenanceFindAll: PreventiveMaintenance.findAll,
  assignmentCount: Assignment.count,
  assignmentFindAll: Assignment.findAll,
  maintenanceFindAll: Maintenance.findAll,
  softwareLicenseCount: SoftwareLicense.count,
  auditLogFindAll: AuditLog.findAll,
  maintenanceHistoryFindAll: MaintenanceHistory.findAll,
  requestStatusHistoryFindAll: RequestStatusHistory.findAll,
  incidentHistoryFindAll: IncidentHistory.findAll,
};

const successResponse = { success: true, dashboard: { summary: { totalAssets: 0 } } };

test('ICT dashboard controller builds payload without undefined term lists', async () => {
  sequelize.authenticate = async () => {};
  Asset.findAll = async (options = {}) => {
    if (options.attributes && options.attributes.some((field) => Array.isArray(field) ? field[0] === 'COUNT' : field === 'status')) {
      return [];
    }
    if (options.attributes && options.attributes.includes('id')) {
      return [];
    }
    if (options.attributes && options.attributes.includes('status')) {
      return [];
    }
    return [];
  };
  Department.findAll = async () => [];
  Approval.findAll = async () => [];
  Approval.count = async () => 0;
  ServiceRequest.count = async () => 0;
  ServiceRequest.findAll = async () => [];
  Notification.findAll = async () => [];
  Incident.count = async () => 0;
  Incident.findAll = async () => [];
  PreventiveMaintenance.count = async () => 0;
  PreventiveMaintenance.findAll = async () => [];
  Assignment.count = async () => 0;
  Assignment.findAll = async () => [];
  Maintenance.findAll = async () => [];
  SoftwareLicense.count = async () => 0;
  AuditLog.findAll = async () => [];
  MaintenanceHistory.findAll = async () => [];
  RequestStatusHistory.findAll = async () => [];
  IncidentHistory.findAll = async () => [];

  const req = {
    user: { id: 1, role: 'ict_officer' },
    organizationScope: { collegeId: 11 },
    query: {},
  };
  const res = { json: (payload) => { successResponse.dashboard = payload.dashboard; return payload; } };

  await assert.doesNotReject(() => controller.getIctDashboard(req, res, () => {
    throw new Error('next should not be called');
  }));

  assert.equal(successResponse.dashboard.summary.totalAssets, 0);
  assert.equal(successResponse.dashboard.health.success, true);
});

test.afterEach(() => {
  sequelize.authenticate = originals.sequelizeAuthenticate;
  Asset.findAll = originals.assetFindAll;
  Department.findAll = originals.departmentFindAll;
  Approval.findAll = originals.approvalFindAll;
  Approval.count = originals.approvalCount;
  ServiceRequest.count = originals.serviceRequestCount;
  ServiceRequest.findAll = originals.serviceRequestFindAll;
  Notification.findAll = originals.notificationFindAll;
  Incident.count = originals.incidentCount;
  Incident.findAll = originals.incidentFindAll;
  PreventiveMaintenance.count = originals.preventiveMaintenanceCount;
  PreventiveMaintenance.findAll = originals.preventiveMaintenanceFindAll;
  Assignment.count = originals.assignmentCount;
  Assignment.findAll = originals.assignmentFindAll;
  Maintenance.findAll = originals.maintenanceFindAll;
  SoftwareLicense.count = originals.softwareLicenseCount;
  AuditLog.findAll = originals.auditLogFindAll;
  MaintenanceHistory.findAll = originals.maintenanceHistoryFindAll;
  RequestStatusHistory.findAll = originals.requestStatusHistoryFindAll;
  IncidentHistory.findAll = originals.incidentHistoryFindAll;
});
