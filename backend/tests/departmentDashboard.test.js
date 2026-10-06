const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  Asset,
  User,
  Approval,
  Assignment,
  Transfer,
  AssetReturn,
  Maintenance,
  VerificationSession,
  ServiceRequest,
  Room,
} = require('../src/models');
const { getDepartmentDashboard } = require('../src/controllers/departmentController');
const { resolveDepartmentScope } = require('../src/middlewares/organizationScope');

const models = {
  Asset: [Asset, 'findAll'],
  User: [User, 'count'],
  Approval: [Approval, 'findAll'],
  Assignment: [Assignment, 'findAll'],
  Transfer: [Transfer, 'findAll'],
  AssetReturn: [AssetReturn, 'findAll'],
  Maintenance: [Maintenance, 'findAll'],
  VerificationSession: [VerificationSession, 'findAll'],
  ServiceRequest: [ServiceRequest, 'findAll'],
  Room: [Room, 'findAll'],
};

const originals = Object.fromEntries(Object.entries(models).map(([name, [model, method]]) => [
  name,
  model[method],
]));

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const restoreModels = () => Object.entries(models).forEach(([name, [model, method]]) => {
  model[method] = originals[name];
});

const configureEmptyModels = () => {
  Asset.findAll = async () => [];
  User.count = async () => 0;
  Approval.findAll = async () => [];
  Assignment.findAll = async () => [];
  Transfer.findAll = async () => [];
  AssetReturn.findAll = async () => [];
  Maintenance.findAll = async () => [];
  VerificationSession.findAll = async () => [];
  ServiceRequest.findAll = async () => [];
  Room.findAll = async () => [];
};

test.afterEach(restoreModels);

test('dashboard route requires an authenticated Department Head and resolves server-owned scope', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/departmentWorkspaceRoutes.js'), 'utf8');
  assert.match(source, /router\.use\(\.\.\.requireDepartmentHead, resolveDepartmentScope\)/);
  assert.match(source, /router\.get\('\/dashboard', getDepartmentDashboard\)/);
});

test('dashboard rejects a request without authenticated department scope', async () => {
  configureEmptyModels();
  const response = makeResponse();
  await getDepartmentDashboard({ organizationScope: {} }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.success, false);
});

test('department scope is not guessed when the authenticated account has no department', async () => {
  const response = makeResponse();
  let nextCalled = false;
  await resolveDepartmentScope({
    user: { id: 99, role: 'department_head', department: '', departmentId: null },
  }, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
  assert.match(response.payload.message, /Department scope is not configured/);
});

test('dashboard returns real department-scoped KPI and chart calculations without query limits', async () => {
  configureEmptyModels();
  let assetQuery;
  let approvalQuery;
  let requestQuery;
  let assignmentQuery;
  let maintenanceQuery;
  let verificationQuery;
  let roomQuery;
  const assets = [
    { id: 1, status: 'active', category: 'laptop', condition: 'Good', currentValue: '500', location: 'Lab A' },
    { id: 2, status: 'damaged', category: 'laboratory equipment', condition: 'Damaged', currentValue: '20', location: 'Lab A' },
    { id: 3, status: 'under maintenance', category: 'agriculture equipment', condition: 'Good', currentValue: '10', location: 'Field' },
    { id: 4, status: 'replaced', category: 'furniture', condition: 'Good', currentValue: '10', location: 'Office' },
    { id: 5, status: 'active', category: 'ict equipment', condition: 'Good', expiryDate: '2020-01-01', currentValue: '10', location: 'Office' },
    { id: 6, status: 'disposed', category: 'electrical', condition: 'Good', currentValue: '0', location: 'Store' },
    { id: 7, status: 'available', category: 'other', condition: 'Good', currentValue: '10', location: 'Store' },
    { id: 8, status: 'assigned', category: 'other', condition: 'Good', currentValue: '10', location: 'Office' },
  ];
  Asset.findAll = async (options) => { assetQuery = options; return assets; };
  User.count = async ({ where }) => (where.departmentId === 4 ? 7 : 0);
  Approval.findAll = async (options) => {
    approvalQuery = options;
    return [
      { id: 1, type: 'purchase', item: 'Laptop', status: 'pending', createdAt: '2026-10-01T10:00:00Z', Requester: { username: 'requester' } },
      { id: 2, type: 'purchase', item: 'Microscope', status: 'approved', createdAt: '2026-10-02T10:00:00Z', Requester: { fullName: 'Requester Two' } },
      { id: 3, type: 'other', item: 'Transfer', status: 'pending', createdAt: '2026-10-03T10:00:00Z', Requester: { username: 'requester3' } },
    ];
  };
  ServiceRequest.findAll = async (options) => {
    requestQuery = options;
    return [
      { id: 1, title: 'Open service', status: 'submitted', dueDate: '2020-01-01', createdAt: '2026-10-01T11:00:00Z', Reporter: { fullName: 'Reporter' } },
      { id: 2, title: 'Escalated service', status: 'in progress', escalated: true, escalatedAt: '2026-10-03T11:00:00Z', dueDate: '2020-01-01', createdAt: '2026-10-02T11:00:00Z', Reporter: { username: 'reporter2' } },
      { id: 3, title: 'Completed service', status: 'completed', completedAt: '2026-10-04T11:00:00Z', createdAt: '2026-10-02T12:00:00Z', Assignee: { fullName: 'Technician' } },
    ];
  };
  Assignment.findAll = async (options) => {
    assignmentQuery = options;
    return [{
      id: 5,
      status: 'active',
      workflowStatus: 'assigned',
      assignedDate: '2026-10-03T12:00:00Z',
      Asset: { name: 'Scoped laptop', assetCode: 'A-5' },
      AssignedByUser: { fullName: 'Asset Officer' },
    }];
  };
  Maintenance.findAll = async (options) => { maintenanceQuery = options; return []; };
  VerificationSession.findAll = async (options) => { verificationQuery = options; return []; };
  Room.findAll = async (options) => { roomQuery = options; return [{ roomType: 'laboratory' }, { roomType: 'computer lab' }, { roomType: 'office' }]; };

  const response = makeResponse();
  await getDepartmentDashboard({
    organizationScope: { departmentId: 4, department: { id: 4, name: 'Engineering', code: 'ENG' } },
  }, response, (error) => { throw error; });

  const dashboard = response.payload.data;
  assert.equal(response.statusCode, 200);
  assert.equal(dashboard.department.name, 'Engineering');
  assert.equal(dashboard.totalAssets, 8);
  assert.equal(dashboard.activeAssets, 3);
  assert.equal(dashboard.damagedAssets, 1);
  assert.equal(dashboard.underMaintenance, 1);
  assert.equal(dashboard.availableAssets, 1);
  assert.equal(dashboard.assignedAssets, 1);
  assert.equal(dashboard.pendingAcquisitionRequests, 1);
  assert.equal(dashboard.pendingApprovals, 2);
  assert.equal(dashboard.openServiceRequests, 2);
  assert.equal(dashboard.overdueTickets, 2);
  assert.equal(dashboard.escalatedTickets, 1);
  assert.equal(dashboard.laboratories, 2);
  assert.deepEqual(dashboard.assetByStatus.map(({ label }) => label), ['Active', 'Damaged', 'Under Maintenance', 'Replaced', 'Expired', 'Disposed']);
  assert.equal(dashboard.assetByStatus.reduce((sum, item) => sum + item.value, 0), 8);
  assert.deepEqual(dashboard.assetByCategory.map(({ label }) => label), ['Computing', 'Laboratory Equipment', 'Agriculture Equipment', 'Furniture', 'ICT Equipment', 'Electrical', 'Other']);
  assert.equal(dashboard.serviceRequestStatus.find(({ label }) => label === 'Escalated').value, 1);
  assert.equal(dashboard.acquisitionRequestStatus.find(({ label }) => label === 'Under Review').value, 1);
  assert.deepEqual(dashboard.recentActivities.map(({ action }) => action).slice(0, 3), ['Service completion', 'Asset assignment', 'Ticket escalation']);
  assert.ok(dashboard.recentActivities.every((activity) => activity.user && activity.action && activity.entity && activity.status && activity.date));
  assert.equal(assetQuery.where.departmentId, 4);
  assert.equal(approvalQuery.where.departmentId, 4);
  assert.equal(requestQuery.where.departmentId, 4);
  assert.equal(assignmentQuery.where.departmentId, 4);
  assert.equal(assignmentQuery.include.find((entry) => entry.model === Asset).where.departmentId, 4);
  assert.equal(maintenanceQuery.include[0].where.departmentId, 4);
  assert.equal(verificationQuery.where.departmentId, 4);
  assert.equal(roomQuery.where.departmentId, 4);
  [approvalQuery, requestQuery, assignmentQuery, maintenanceQuery, verificationQuery].forEach((query) => {
    assert.equal(query.limit, undefined);
  });
});

test('valid empty departments return empty chart/activity series instead of errors', async () => {
  configureEmptyModels();
  const response = makeResponse();
  await getDepartmentDashboard({
    organizationScope: { departmentId: 8, department: { id: 8, name: 'New Department', code: 'NEW' } },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.equal(response.payload.data.totalAssets, 0);
  assert.deepEqual(response.payload.data.assetByStatus, []);
  assert.deepEqual(response.payload.data.assetByCategory, []);
  assert.deepEqual(response.payload.data.serviceRequestStatus, []);
  assert.deepEqual(response.payload.data.acquisitionRequestStatus, []);
  assert.deepEqual(response.payload.data.recentActivities, []);
});

test('dashboard queries scope nested asset data to the authenticated department', async () => {
  configureEmptyModels();
  let captured;
  ServiceRequest.findAll = async (options) => { captured = options; return []; };
  const response = makeResponse();
  await getDepartmentDashboard({
    organizationScope: { departmentId: 12, department: { id: 12, name: 'Department A' } },
  }, response, (error) => { throw error; });
  const assetInclude = captured.include.find((entry) => entry.model === Asset);
  assert.deepEqual(assetInclude.where, { departmentId: 12 });
});
