const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');

auditLogService.createAuditLog = async () => {};
notificationService.createEventNotification = async () => {};
notificationService.createDepartmentEventNotification = async () => {};

const assignmentRoutes = require('../routes/assignmentRoutes');
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const getRoute = (router, method, routePath) => {
  const layer = router.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `expected ${method.toUpperCase()} ${routePath}`);
  return layer.route;
};

const getHandler = (route) => route.stack[route.stack.length - 1].handle;

const request = (body = {}) => ({
  body,
  params: {},
  query: {},
  ip: '127.0.0.1',
  sessionID: null,
  user: { id: 12, role: 'department_head', departmentId: 7, collegeId: 3 },
  organizationScope: { departmentId: 7, collegeId: 3 },
});

const assignmentBody = (overrides = {}) => ({
  asset_id: 45,
  assigned_to_type: 'user',
  assigned_to_id: 81,
  department_id: 7,
  location: 'Room 12',
  assigned_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

const modelMethods = [
  [models.sequelize, 'transaction'],
  [models.Inventory, 'findOne'],
  [models.Asset, 'findByPk'],
  [models.User, 'findByPk'],
  [models.Department, 'findByPk'],
  [models.Room, 'findByPk'],
  [models.Assignment, 'findOne'],
  [models.Assignment, 'create'],
  [models.Assignment, 'findByPk'],
  [models.InventoryTransaction, 'create'],
  [models.AuditLog, 'create'],
];

const withModelStubs = async (stubs, callback) => {
  const originals = modelMethods.map(([model, method]) => [model, method, model[method]]);
  for (const [model, method, implementation] of stubs) model[method] = implementation;
  try {
    await callback();
  } finally {
    for (const [model, method, original] of originals) model[method] = original;
  }
};

test('department assignments are exposed under the department workspace with view permission', () => {
  assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.name === 'router' && layer.regexp.test('/assignments')));
  for (const method of ['get', 'post']) {
    const route = getRoute(assignmentRoutes, method, method === 'get' ? '/' : '/');
    const permissionMiddlewareIndex = route.stack.findIndex((layer) => layer.handle.name === 'requireDepartmentPermission');
    assert.ok(permissionMiddlewareIndex >= 0, `${method.toUpperCase()} route must enforce department permissions`);
  }
});

test('department-head assignment reads require assets.view and creation requires assets.assign', async () => {
  const createRoute = getRoute(assignmentRoutes, 'post', '/');
  const permission = createRoute.stack.find((layer) => layer.handle.name === 'requireDepartmentPermission').handle;
  const denied = makeResponse();
  let advanced = false;
  permission({ user: { role: 'department_head', permissions: ['assets.view'] } }, denied, () => { advanced = true; });
  assert.equal(denied.statusCode, 403);
  assert.equal(advanced, false);

  const allowed = makeResponse();
  permission({ user: { role: 'department_head', permissions: ['assets.assign'] } }, allowed, () => { advanced = true; });
  assert.equal(allowed.statusCode, 200);
  assert.equal(advanced, true);

  const genericRole = makeResponse();
  permission({ user: { role: 'admin', permissions: [] } }, genericRole, () => { advanced = true; });
  assert.equal(genericRole.statusCode, 200);
});

test('assignment validation rejects malformed dates before opening a transaction', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const originalTransaction = models.sequelize.transaction;
  let transactionStarted = false;
  models.sequelize.transaction = async () => { transactionStarted = true; throw new Error('unexpected transaction'); };
  try {
    const response = makeResponse();
    await handler(request(assignmentBody({ assigned_date: 'not-a-date' })), response, (error) => { throw error; });
    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /assignment date/i);
    assert.equal(transactionStarted, false);
  } finally {
    models.sequelize.transaction = originalTransaction;
  }
});

test('creation uses a transaction and records the assignment, date, inventory issue, and asset status', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const assignedDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expectedReturnDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const inventory = { id: 2, availableQuantity: 1, async update(value) { Object.assign(this, value); } };
  const asset = {
    id: 45, status: 'available', departmentId: 7, collegeId: 3, condition: 'Good',
    async update(value) { Object.assign(this, value); },
  };
  const staff = { id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3, fullName: 'Department Staff' };
  const department = { id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' };
  let createdAssignment;
  let inventoryTransaction;
  let createdAssignmentRecord;
  const assignment = {
    id: 99,
    toJSON() { return createdAssignmentRecord; },
  };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => inventory],
    [models.Asset, 'findByPk', async () => asset],
    [models.User, 'findByPk', async () => staff],
    [models.Department, 'findByPk', async () => department],
    [models.Room, 'findByPk', async () => null],
    [models.Assignment, 'findOne', async () => null],
    [models.Assignment, 'create', async (values) => {
      createdAssignment = values;
      createdAssignmentRecord = { id: 99, ...values, createdAt: assignedDate, updatedAt: assignedDate };
      return assignment;
    }],
    [models.Assignment, 'findByPk', async () => assignment],
    [models.InventoryTransaction, 'create', async (values) => { inventoryTransaction = values; }],
    [models.AuditLog, 'create', async () => {}],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody({
      assigned_date: assignedDate.toISOString(),
      expected_return_date: expectedReturnDate.toISOString(),
    })), response, (error) => { throw error; });

    assert.equal(response.statusCode, 201);
    assert.equal(transaction.finished, 'commit');
    assert.equal(inventory.availableQuantity, 0);
    assert.equal(asset.status, 'assigned');
    assert.equal(createdAssignment.assignedDate.toISOString(), assignedDate.toISOString());
    assert.equal(new Date(createdAssignment.expectedReturnDate).toISOString(), expectedReturnDate.toISOString());
    assert.equal(createdAssignment.status, 'active');
    assert.equal(inventoryTransaction.type, 'issue');
    assert.equal(response.body.assignment.id, 99);
  });
});

test('department-head creation rejects an asset or recipient outside its resolved department', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const inventory = { id: 2, availableQuantity: 1 };
  const foreignAsset = { id: 45, status: 'available', departmentId: 8, collegeId: 3 };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => inventory],
    [models.Asset, 'findByPk', async () => foreignAsset],
    [models.User, 'findByPk', async () => ({ id: 81, active: true, departmentId: 7, collegeId: 3 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => null],
  ];
  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody()), response, (error) => { throw error; });
    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /outside your department scope/i);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('assignment history queries retain the authorized department constraint', async () => {
  const historyRoute = getRoute(assignmentRoutes, 'get', '/history');
  const handler = getHandler(historyRoute);
  const originalFindAll = models.Assignment.findAll;
  let query;
  models.Assignment.findAll = async (options) => { query = options; return []; };
  try {
    const response = makeResponse();
    await handler(request(), response, (error) => { throw error; });
    assert.equal(response.statusCode, 200);
    assert.ok(query.include.some((include) => include.model === models.Asset && include.where.departmentId === 7));
    assert.deepEqual(response.body.history, []);
  } finally {
    models.Assignment.findAll = originalFindAll;
  }
});
