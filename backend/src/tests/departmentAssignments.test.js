const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const auditLogService = require('../services/auditLogService');
const notificationService = require('../services/notificationService');

const auditLogEntries = [];
let auditLogError = null;
auditLogService.createAuditLog = async (entry) => {
  if (auditLogError) throw auditLogError;
  auditLogEntries.push(entry);
};
const eventNotifications = [];
notificationService.createEventNotification = async (entry) => { eventNotifications.push(entry); };
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
  [models.Asset, 'findOne'],
  [models.Asset, 'update'],
  [models.User, 'findByPk'],
  [models.Department, 'findByPk'],
  [models.Room, 'findByPk'],
  [models.Assignment, 'findOne'],
  [models.Assignment, 'findAll'],
  [models.Assignment, 'create'],
  [models.Assignment, 'findByPk'],
  [models.Approval, 'findByPk'],
  [models.InventoryTransaction, 'create'],
  [models.AssetMovement, 'create'],
  [models.AuditLog, 'create'],
  [models.Department, 'findOne'],
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

test('assignment routes enforce role-specific permissions and expose department workspace routes', () => {
  assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.name === 'router' && layer.regexp.test('/assignments')));
  const cases = [
    { method: 'get', path: '/', role: 'department_head', permissions: ['assets.view'], expected: 200 },
    { method: 'post', path: '/', role: 'department_head', permissions: ['assets.assign'], expected: 200 },
    { method: 'post', path: '/', role: 'department_head', permissions: ['assets.view'], expected: 403 },
    { method: 'post', path: '/:id/return', role: 'department_head', permissions: ['department_head.returns.manage'], expected: 200 },
    { method: 'post', path: '/', role: 'ict_officer', permissions: ['ict.assets.assign'], expected: 200 },
    { method: 'get', path: '/', role: 'college', permissions: ['college.assignments.view'], expected: 200 },
    { method: 'post', path: '/', role: 'college', permissions: ['college.assignments.view'], expected: 403 },
    { method: 'post', path: '/', role: 'college_manager', permissions: ['college.assignments.manage'], expected: 200 },
    { method: 'get', path: '/', role: 'admin', permissions: [], expected: 403 },
  ];
  for (const { method, path, role, permissions, expected } of cases) {
    const route = getRoute(assignmentRoutes, method, path);
    const permission = route.stack.find((layer) => layer.handle.name === 'requireAssignmentPermissionForRole');
    assert.ok(permission, `${method.toUpperCase()} route must enforce assignment permissions`);
    const response = makeResponse();
    let advanced = false;
    permission.handle({ user: { role, permissions } }, response, () => { advanced = true; });
    assert.equal(response.statusCode, expected);
    assert.equal(advanced, expected === 200);
  }

  const fulfillmentRoute = getRoute(assignmentRoutes, 'post', '/fulfill-request/:id');
  const stockOutPermission = fulfillmentRoute.stack.find((layer) => layer.handle.name === 'requirePermission')?.handle;
  assert.ok(stockOutPermission, 'approved request fulfillment must require inventory.stock_out');
  const deniedFulfillment = makeResponse();
  let fulfilled = false;
  stockOutPermission({ user: { role: 'store_manager', permissions: ['assets.assign'] } }, deniedFulfillment, () => { fulfilled = true; });
  assert.equal(deniedFulfillment.statusCode, 403);
  assert.equal(fulfilled, false);
  const allowedFulfillment = makeResponse();
  stockOutPermission({ user: { role: 'store_manager', permissions: ['inventory.stock_out'] } }, allowedFulfillment, () => { fulfilled = true; });
  assert.equal(allowedFulfillment.statusCode, 200);
  assert.equal(fulfilled, true);
});

test('department-head assignment list uses a database-column-mapped department filter', async (t) => {
  const handler = getHandler(getRoute(assignmentRoutes, 'get', '/'));
  const originalFindAndCountAll = models.Assignment.findAndCountAll;
  const originalFindAll = models.Assignment.findAll;
  let queryOptions;
  let groupedOptions;
  models.Assignment.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 9, rows: [] };
  };
  models.Assignment.findAll = async (options) => {
    groupedOptions = options;
    return [
      { status: 'active', count: '6' },
      { status: 'returned', count: '2' },
      { status: 'pending', count: '1' },
    ];
  };
  t.after(() => {
    models.Assignment.findAndCountAll = originalFindAndCountAll;
    models.Assignment.findAll = originalFindAll;
  });

  const response = makeResponse();
  await handler(request(), response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  const assetInclude = queryOptions.include.find((include) => include.model === models.Asset);
  assert.deepEqual(assetInclude.where, { departmentId: 7, collegeId: 3 });
  assert.equal(assetInclude.required, true);
  assert.deepEqual(response.body.summary, { total: 9, active: 6, returned: 2, pending: 1 });
  groupedOptions.model = models.Assignment;
  models.Assignment._validateIncludedElements(groupedOptions);
  const groupedSql = models.sequelize.dialect.queryGenerator.selectQuery(
    models.Assignment.getTableName(),
    groupedOptions,
    models.Assignment,
  );
  assert.match(groupedSql, /`Asset`\.`department_id` = 7/);
  assert.match(groupedSql, /GROUP BY `Assignment`\.`status`/);
  assert.doesNotMatch(groupedSql, /`Asset`\.`id` AS|`User`\.`id` AS|`AssignedByUser`\.`id` AS/);

  queryOptions.model = models.Assignment;
  models.Assignment._validateIncludedElements(queryOptions);
  const sql = models.sequelize.dialect.queryGenerator.selectQuery(
    models.Assignment.getTableName(),
    queryOptions,
    models.Assignment,
  );
  assert.match(sql, /`Asset`\.`department_id` = 7/);
  assert.doesNotMatch(sql, /`Asset`\.`departmentId`/);
});

test('assignment list query errors are logged and returned as a message-only 500', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'get', '/'));
  const originalFindAndCountAll = models.Assignment.findAndCountAll;
  const originalFindAll = models.Assignment.findAll;
  const originalConsoleError = console.error;
  const databaseError = Object.assign(new Error('Assignment query failed'), {
    name: 'SequelizeDatabaseError',
    original: { code: 'ER_BAD_FIELD_ERROR', sqlMessage: "Unknown column 'assignments.createdAt'" },
    sql: 'SELECT assignments.createdAt FROM assignments',
  });
  let logged;
  models.Assignment.findAndCountAll = async () => { throw databaseError; };
  models.Assignment.findAll = async () => [];
  console.error = (...args) => { logged = args; };
  try {
    const response = makeResponse();
    await handler(request(), response, (error) => { throw error; });
    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { message: 'Failed to load assignments' });
    assert.equal(logged[0], 'Failed to list assignments:');
    assert.deepEqual(logged[1], {
      name: 'SequelizeDatabaseError',
      message: 'Assignment query failed',
      code: 'ER_BAD_FIELD_ERROR',
      sqlMessage: "Unknown column 'assignments.createdAt'",
      sql: 'SELECT assignments.createdAt FROM assignments',
    });
  } finally {
    models.Assignment.findAndCountAll = originalFindAndCountAll;
    models.Assignment.findAll = originalFindAll;
    console.error = originalConsoleError;
  }
});

test('assignment search uses database column names for included model fields', async (t) => {
  const handler = getHandler(getRoute(assignmentRoutes, 'get', '/'));
  const originalFindAndCountAll = models.Assignment.findAndCountAll;
  const originalFindAll = models.Assignment.findAll;
  let queryOptions;
  models.Assignment.findAndCountAll = async (options) => {
    queryOptions = options;
    return { count: 0, rows: [] };
  };
  models.Assignment.findAll = async () => [];
  t.after(() => {
    models.Assignment.findAndCountAll = originalFindAndCountAll;
    models.Assignment.findAll = originalFindAll;
  });

  const req = request();
  req.query.search = 'projector';
  const response = makeResponse();
  await handler(req, response, (error) => { throw error; });

  queryOptions.model = models.Assignment;
  models.Assignment._validateIncludedElements(queryOptions);
  const sql = models.sequelize.dialect.queryGenerator.selectQuery(
    models.Assignment.getTableName(),
    queryOptions,
    models.Assignment,
  );
  assert.match(sql, /`Asset`\.`asset_code`/);
  assert.match(sql, /`Asset`\.`serial_number`/);
  assert.match(sql, /`User`\.`full_name`/);
  assert.match(sql, /`AssignedLaboratory`\.`room_name`/);
  assert.doesNotMatch(sql, /`Asset`\.`assetCode`|`Asset`\.`serialNumber`|`User`\.`fullName`|`AssignedLaboratory`\.`roomName`/);
});

test('college and college-manager assignment lists constrain joined assets to their resolved college', async (t) => {
  const handler = getHandler(getRoute(assignmentRoutes, 'get', '/'));
  const originalFindAndCountAll = models.Assignment.findAndCountAll;
  const originalFindAll = models.Assignment.findAll;
  const observedIncludes = [];
  models.Assignment.findAndCountAll = async ({ include }) => {
    observedIncludes.push(include);
    return { count: 0, rows: [] };
  };
  models.Assignment.findAll = async ({ include }) => {
    observedIncludes.push(include);
    return [];
  };
  t.after(() => {
    models.Assignment.findAndCountAll = originalFindAndCountAll;
    models.Assignment.findAll = originalFindAll;
  });

  for (const role of ['college', 'college_manager']) {
    const req = request();
    req.user.role = role;
    req.organizationScope = { collegeId: 44 };
    const response = makeResponse();
    await handler(req, response, (error) => { throw error; });
  }

  assert.equal(observedIncludes.length, 4);
  for (const include of observedIncludes) {
    const assetInclude = include.find((entry) => entry.model === models.Asset);
    assert.deepEqual(assetInclude.where, { collegeId: 44 });
    assert.equal(assetInclude.required, true);
  }
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

test('assignment validation rejects non-positive or fractional stock quantities before opening a transaction', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const originalTransaction = models.sequelize.transaction;
  let transactionStarted = false;
  models.sequelize.transaction = async () => { transactionStarted = true; throw new Error('unexpected transaction'); };
  try {
    for (const quantity of [0, -1, 1.5]) {
      const response = makeResponse();
      await handler(request(assignmentBody({ quantity })), response, (error) => { throw error; });
      assert.equal(response.statusCode, 400);
      assert.match(response.body.message, /positive whole-number quantity/i);
    }
    assert.equal(transactionStarted, false);
  } finally {
    models.sequelize.transaction = originalTransaction;
  }
});

test('bulk creation decrements only the issued quantity and records it in assignment and movement history', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const assignedDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const expectedReturnDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const inventory = { id: 2, availableQuantity: 4, async update(value) { Object.assign(this, value); } };
  const asset = {
    id: 45, status: 'available', departmentId: 7, collegeId: 3, condition: 'Good',
    async update(value) { Object.assign(this, value); },
  };
  const staff = { id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3, fullName: 'Department Staff' };
  const department = { id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' };
  let createdAssignment;
  let inventoryTransaction;
  let assetMovement;
  let createdAssignmentRecord;
  auditLogEntries.length = 0;
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
    [models.AssetMovement, 'create', async (values) => { assetMovement = values; }],
    [models.AuditLog, 'create', async () => {}],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody({
      quantity: 3,
      assigned_date: assignedDate.toISOString(),
      expected_return_date: expectedReturnDate.toISOString(),
    })), response, (error) => { throw error; });

    assert.equal(response.statusCode, 201);
    assert.equal(transaction.finished, 'commit');
    assert.equal(inventory.availableQuantity, 1);
    assert.equal(asset.status, 'available');
    assert.equal(createdAssignment.assignedDate.toISOString(), assignedDate.toISOString());
    assert.equal(new Date(createdAssignment.expectedReturnDate).toISOString(), expectedReturnDate.toISOString());
    assert.equal(createdAssignment.status, 'active');
    assert.equal(createdAssignment.quantity, 3);
    assert.equal(inventoryTransaction.type, 'issue');
    assert.equal(inventoryTransaction.quantity, 3);
    assert.match(assetMovement.notes, /"quantity":3/);
    assert.equal(auditLogEntries.length, 1);
    assert.equal(auditLogEntries[0].action, 'ASSIGN_ASSET');
    assert.equal(auditLogEntries[0].entityId, 45);
    assert.equal(auditLogEntries[0].newValue.assignment.id, 99);
    assert.equal(auditLogEntries[0].transaction, transaction);
    assert.equal(response.body.assignment.id, 99);
  });
});

test('unavailable serialized assets are rejected without creating an assignment', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  let assignmentLookup = false;
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => ({ id: 2, availableQuantity: 1 })],
    [models.Asset, 'findByPk', async () => ({ id: 45, status: 'assigned', serialNumber: 'SER-45', departmentId: 7, collegeId: 3 })],
    [models.User, 'findByPk', async () => ({ id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => null],
    [models.Assignment, 'findOne', async () => { assignmentLookup = true; return { id: 90 }; }],
    [models.Assignment, 'create', async () => assert.fail('unavailable asset must not create an assignment')],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody()), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /cannot be assigned/i);
    assert.equal(assignmentLookup, false);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('serialized assets with an active assignment cannot be assigned twice', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  let assignmentLookup = false;
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => ({ id: 2, availableQuantity: 1 })],
    [models.Asset, 'findByPk', async () => ({ id: 45, status: 'available', serialNumber: 'SER-45', departmentId: 7, collegeId: 3 })],
    [models.User, 'findByPk', async () => ({ id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => null],
    [models.Assignment, 'findOne', async () => { assignmentLookup = true; return { id: 90, status: 'active' }; }],
    [models.Assignment, 'create', async () => assert.fail('duplicate active assignment must not create another assignment')],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody()), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /already assigned/i);
    assert.equal(assignmentLookup, true);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('inactive recipients are rejected without creating an assignment', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => ({ id: 2, availableQuantity: 1 })],
    [models.Asset, 'findByPk', async () => ({ id: 45, status: 'available', departmentId: 7, collegeId: 3 })],
    [models.User, 'findByPk', async () => ({ id: 81, active: false, status: 'inactive', departmentId: 7, collegeId: 3 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => null],
    [models.Assignment, 'create', async () => assert.fail('inactive recipient must not create an assignment')],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody()), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /inactive user/i);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('college managers cannot assign to recipients from another college', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => ({ id: 2, availableQuantity: 1 })],
    [models.Asset, 'findByPk', async () => ({ id: 45, status: 'available', departmentId: 7, collegeId: 3 })],
    [models.User, 'findByPk', async () => ({ id: 81, active: true, status: 'active', role: 'staff', departmentId: 7, collegeId: 4 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Foreign Department', collegeId: 4, status: 'active' })],
    [models.Assignment, 'create', async () => assert.fail('cross-college assignment must not be created')],
  ];

  await withModelStubs(stubs, async () => {
    const req = request(assignmentBody());
    req.user.role = 'college_manager';
    req.organizationScope = { collegeId: 3 };
    const response = makeResponse();
    await handler(req, response, (error) => { throw error; });
    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /outside your organization scope/i);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('bulk assignment rejects quantities greater than available stock without writing movements', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Inventory, 'findOne', async () => ({ id: 2, availableQuantity: 2 })],
    [models.Asset, 'findByPk', async () => ({ id: 45, status: 'available', departmentId: 7, collegeId: 3 })],
    [models.User, 'findByPk', async () => ({ id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3 })],
    [models.Department, 'findByPk', async () => ({ id: 7, name: 'Authorized Department', collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => null],
    [models.Assignment, 'findOne', async () => null],
    [models.Assignment, 'create', async () => assert.fail('insufficient stock must not create an assignment')],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    await handler(request(assignmentBody({ quantity: 3 })), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /insufficient available inventory/i);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('bulk assignment return restores its recorded quantity without exceeding total stock', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/:id/return'));
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: null,
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  const assignment = {
    id: 99, assetId: 45, quantity: 3, status: 'active', assignedToType: 'department', assignedToId: 7,
    departmentId: 7, async update(values) { Object.assign(this, values); },
    toJSON() { return { ...this }; },
  };
  const inventory = {
    id: 2, quantity: 10, availableQuantity: 1, reservedQuantity: 2, damagedQuantity: 1,
    async update(values) { Object.assign(this, values); },
  };
  const asset = { id: 45, status: 'assigned', departmentId: 7, collegeId: 3, name: 'Gloves', async update(values) { Object.assign(this, values); } };
  let stockMovement;
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Assignment, 'findByPk', async () => assignment],
    [models.Inventory, 'findOne', async () => inventory],
    [models.Asset, 'findByPk', async () => asset],
    [models.InventoryTransaction, 'create', async (values) => { stockMovement = values; }],
    [models.AssetMovement, 'create', async () => {}],
    [models.AuditLog, 'create', async () => {}],
  ];

  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    const req = request({ notes: 'Restocked returned units' });
    req.params.id = '99';
    await handler(req, response, (error) => { throw error; });
    assert.equal(transaction.finished, 'commit');
    assert.equal(inventory.availableQuantity, 4);
    assert.equal(asset.status, 'available');
    assert.equal(assignment.status, 'returned');
    assert.equal(stockMovement.type, 'return');
    assert.equal(stockMovement.quantity, 3);
    assert.equal(response.body.assignment.quantity, 3);
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
    [models.User, 'findByPk', async () => ({ id: 81, active: true, status: 'active', departmentId: 7, collegeId: 3 })],
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

test('Department Head transfer rejects a recipient without a matching department', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/:id/transfer'));
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: null, async rollback() { this.finished = 'rollback'; }, async commit() { this.finished = 'commit'; } };
  const assignment = { id: 90, assetId: 45, departmentId: 7, status: 'active', notes: '{}', toJSON() { return { ...this }; } };
  const asset = { id: 45, departmentId: 7, collegeId: 3 };
  const recipient = { id: 82, active: true, status: 'active', departmentId: null, collegeId: 3 };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Assignment, 'findByPk', async () => assignment],
    [models.Asset, 'findByPk', async () => asset],
    [models.User, 'findByPk', async () => recipient],
    [models.Department, 'findByPk', async () => ({ id: 7, collegeId: 3, status: 'active' })],
  ];
  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    const req = request({ assigned_to_type: 'user', assigned_to_id: 82 });
    req.params.id = '90';
    await handler(req, response, (error) => { throw error; });
    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /outside your department/i);
    assert.equal(transaction.finished, 'rollback');
  });
});

test('Department Head transfer rejects a laboratory in another department', async () => {
  const handler = getHandler(getRoute(assignmentRoutes, 'post', '/:id/transfer'));
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: null, async rollback() { this.finished = 'rollback'; }, async commit() { this.finished = 'commit'; } };
  const assignment = { id: 90, assetId: 45, departmentId: 7, status: 'active', notes: '{}', toJSON() { return { ...this }; } };
  const asset = { id: 45, departmentId: 7, collegeId: 3 };
  const stubs = [
    [models.sequelize, 'transaction', async () => transaction],
    [models.Assignment, 'findByPk', async () => assignment],
    [models.Asset, 'findByPk', async () => asset],
    [models.Department, 'findByPk', async () => ({ id: 7, collegeId: 3, status: 'active' })],
    [models.Room, 'findByPk', async () => ({ id: 18, departmentId: 8, roomType: 'laboratory', status: 'active', roomName: 'Foreign lab' })],
  ];
  await withModelStubs(stubs, async () => {
    const response = makeResponse();
    const req = request({ assigned_to_type: 'laboratory', assigned_to_id: 18 });
    req.params.id = '90';
    await handler(req, response, (error) => { throw error; });
    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /laboratory is outside your department/i);
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
