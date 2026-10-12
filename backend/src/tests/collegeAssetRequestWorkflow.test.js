const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  sequelize,
  Category,
  College,
  Department,
  DepartmentAssetRequest,
  DepartmentAssetRequestHistory,
  AuditLog,
  User,
} = require('../models');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');
const notifications = require('../services/notificationService');
notifications.createBulkNotification = async () => ({ recipientCount: 1 });
delete require.cache[require.resolve('../controllers/collegeAssetRequestController')];
delete require.cache[require.resolve('../routes/collegeRoutes')];
const controller = require('../controllers/collegeAssetRequestController');
const routeSource = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');

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

test('college manager request routes are permission-gated and preserve view-only College access', () => {
  assert.match(routeSource, /router\.post\('\/requests', requireRole\('college_manager'\), requirePermission\('college\.requests\.create'\), collegeAssetRequests\.create\)/);
  assert.match(routeSource, /router\.put\('\/requests\/:id', requireRole\('college_manager'\), requirePermission\('college\.requests\.update'\), collegeAssetRequests\.update\)/);
  assert.match(routeSource, /router\.post\('\/requests\/:id\/cancel', requireRole\('college_manager'\), requirePermission\('college\.requests\.cancel'\), collegeAssetRequests\.cancel\)/);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.college.includes('college.requests.create'), false);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.college.includes('college.requests.update'), false);
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.requests.create'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.requests.update'));
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.requests.cancel'));
});

test('college request list scopes data to the authorized college and computes unfiltered status totals', async (t) => {
  const original = {
    departments: Department.findAll,
    requests: DepartmentAssetRequest.findAndCountAll,
    statuses: DepartmentAssetRequest.findAll,
    categories: DepartmentAssetRequest.findAll,
    college: College.findByPk,
  };
  const filters = [];
  Department.findAll = async () => [{ id: 14, name: 'Physics', code: 'PHY' }];
  DepartmentAssetRequest.findAndCountAll = async (options) => {
    filters.push(options);
    return { rows: [], count: 0 };
  };
  DepartmentAssetRequest.findAll = async (options) => {
    filters.push(options);
    if (options.attributes?.includes('category')) return [{ category: 'Laboratory Equipment' }];
    return [{ status: 'Submitted' }, { status: 'Under Review' }, { status: 'Approved' }, { status: 'Cancelled' }];
  };
  College.findByPk = async () => ({ id: 4, collegeName: 'Engineering College' });
  t.after(() => {
    Department.findAll = original.departments;
    DepartmentAssetRequest.findAndCountAll = original.requests;
    DepartmentAssetRequest.findAll = original.statuses;
    College.findByPk = original.college;
  });

  const response = makeResponse();
  await controller.list({ organizationScope: { collegeId: 4 }, query: { page: '2', limit: '5', departmentId: '14', sortBy: 'requestCode', sortOrder: 'ASC' } }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload.data.summary, { total: 4, pending: 2, approved: 1, rejected: 0, cancelled: 1 });
  assert.equal(response.payload.data.pagination.page, 2);
  assert.equal(response.payload.data.filters.departments[0].id, 14);
  assert.ok(filters[0].where.departmentId === 14);
  assert.ok(filters.some((query) => Array.isArray(query.where.departmentId?.[Op.in]) && query.where.departmentId[Op.in][0] === 14));
});

test('creating a College Manager request validates references and records scoped requester, status history, and audit', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    category: Category.findOne,
    department: Department.findOne,
    create: DepartmentAssetRequest.create,
    history: DepartmentAssetRequestHistory.create,
    audit: AuditLog.create,
    users: User.findAll,
    saved: DepartmentAssetRequest.findOne,
  };
  const transaction = { finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const created = [];
  const history = [];
  const audit = [];
  sequelize.transaction = async () => transaction;
  Category.findOne = async () => ({ id: 2 });
  Department.findOne = async ({ where }) => where.collegeId === 4 && where.id === 14 ? { id: 14, name: 'Physics' } : null;
  DepartmentAssetRequest.create = async (values) => {
    created.push(values);
    return { id: 52, requestCode: values.requestCode, ...values };
  };
  DepartmentAssetRequestHistory.create = async (values) => { history.push(values); };
  AuditLog.create = async (values) => { audit.push(values); };
  User.findAll = async () => [];
  DepartmentAssetRequest.findOne = async () => ({
    toJSON: () => ({
      id: 52,
      requestCode: created[0].requestCode,
      requestedBy: 7,
      departmentId: 14,
      requestedItem: 'Microscope',
      category: 'Laboratory Equipment',
      quantity: 2,
      unit: 'unit',
      status: 'Submitted',
      justification: 'For laboratory instruction',
      description: JSON.stringify({ collegeRequest: true, title: 'Physics lab equipment', preferredLocation: 'Room 4', description: 'New teaching equipment' }),
      Requester: { id: 7, fullName: 'A. User', role: 'college_manager' },
      DepartmentRecord: { id: 14, name: 'Physics', code: 'PHY' },
      History: [],
    }),
  });
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Category.findOne = originals.category;
    Department.findOne = originals.department;
    DepartmentAssetRequest.create = originals.create;
    DepartmentAssetRequestHistory.create = originals.history;
    AuditLog.create = originals.audit;
    User.findAll = originals.users;
    DepartmentAssetRequest.findOne = originals.saved;
  });

  const response = makeResponse();
  await controller.create({
    organizationScope: { collegeId: 4 },
    user: { id: 7, role: 'college_manager' },
    body: {
      requestTitle: 'Physics lab equipment',
      requestedItem: 'Microscope',
      category: 'Laboratory Equipment',
      description: 'New teaching equipment',
      justification: 'For laboratory instruction',
      quantity: 2,
      unit: 'unit',
      priority: 'high',
      departmentId: 14,
      preferredLocation: 'Room 4',
      estimatedValue: '1500',
    },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(created[0].departmentId, 14);
  assert.equal(created[0].requestedBy, 7);
  assert.equal(created[0].status, 'Submitted');
  assert.equal(created[0].estimatedValue, 1500);
  assert.equal(history[0].newStatus, 'Submitted');
  assert.equal(audit[0].action, 'COLLEGE_ASSET_REQUEST_SUBMITTED');
  assert.equal(transaction.finished, 'commit');
  assert.equal(response.payload.data.requestTitle, 'Physics lab equipment');
  assert.equal(response.payload.data.preferredLocation, 'Room 4');
});

test('requests reject a department outside the authorized College scope', async (t) => {
  const original = {
    transaction: sequelize.transaction,
    category: Category.findOne,
    department: Department.findOne,
  };
  let rolledBack = false;
  sequelize.transaction = async () => ({ finished: undefined, rollback: async () => { rolledBack = true; } });
  Category.findOne = async () => ({ id: 2 });
  Department.findOne = async () => null;
  t.after(() => {
    sequelize.transaction = original.transaction;
    Category.findOne = original.category;
    Department.findOne = original.department;
  });
  const response = makeResponse();
  await controller.create({
    organizationScope: { collegeId: 4 },
    user: { id: 7, role: 'college_manager' },
    body: { requestTitle: 'Needs', requestedItem: 'Projector', category: 'Electronics', justification: 'Classes', departmentId: 99 },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 422);
  assert.match(response.payload.message, /department in your college/i);
  assert.equal(rolledBack, true);
});

test('editing a returned request resubmits it and allows clearing the estimated value', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    departments: Department.findAll,
    department: Department.findOne,
    category: Category.findOne,
    request: DepartmentAssetRequest.findOne,
    history: DepartmentAssetRequestHistory.create,
    audit: AuditLog.create,
    users: User.findAll,
  };
  const transaction = { finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const data = {
    id: 52,
    requestCode: 'CM-2026-TEST',
    requestedBy: 7,
    departmentId: 14,
    requestedItem: 'Microscope',
    category: 'Laboratory Equipment',
    quantity: 2,
    unit: 'unit',
    priority: 'high',
    status: 'Changes Requested',
    justification: 'For laboratory instruction',
    description: JSON.stringify({ collegeRequest: true, title: 'Old title', preferredLocation: 'Room 4', description: 'Old description' }),
    estimatedValue: 1500,
    neededBy: null,
  };
  const record = {
    get id() { return data.id; },
    get requestCode() { return data.requestCode; },
    get requestedBy() { return data.requestedBy; },
    get status() { return data.status; },
    toJSON: () => ({ ...data, Requester: null, DepartmentRecord: { id: 14, name: 'Physics', code: 'PHY' }, History: [] }),
    update: async (values) => { Object.assign(data, values); },
  };
  const history = [];
  sequelize.transaction = async () => transaction;
  Department.findAll = async () => [{ id: 14 }];
  Department.findOne = async () => ({ id: 14, name: 'Physics' });
  Category.findOne = async () => ({ id: 2 });
  DepartmentAssetRequest.findOne = async (options) => options.transaction ? record : record;
  DepartmentAssetRequestHistory.create = async (values) => { history.push(values); };
  AuditLog.create = async () => {};
  User.findAll = async () => [];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findAll = originals.departments;
    Department.findOne = originals.department;
    Category.findOne = originals.category;
    DepartmentAssetRequest.findOne = originals.request;
    DepartmentAssetRequestHistory.create = originals.history;
    AuditLog.create = originals.audit;
    User.findAll = originals.users;
  });

  const response = makeResponse();
  await controller.update({
    organizationScope: { collegeId: 4 },
    user: { id: 7, role: 'college_manager' },
    params: { id: '52' },
    body: {
      requestTitle: 'Revised microscope request',
      requestedItem: 'Microscope',
      category: 'Laboratory Equipment',
      justification: 'For laboratory instruction and safety',
      quantity: 3,
      unit: 'unit',
      priority: 'high',
      departmentId: 14,
      estimatedValue: '',
      neededBy: '',
    },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(data.status, 'Submitted');
  assert.equal(data.estimatedValue, null);
  assert.equal(history[0].previousStatus, 'Changes Requested');
  assert.equal(history[0].newStatus, 'Submitted');
  assert.match(history[0].comment, /resubmitted/i);
  assert.equal(response.payload.data.requestTitle, 'Revised microscope request');
  assert.equal(transaction.finished, 'commit');
});

test('a College Manager cannot review their own request', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    departments: Department.findAll,
    request: DepartmentAssetRequest.findOne,
  };
  let rolledBack = false;
  sequelize.transaction = async () => ({
    finished: undefined,
    rollback: async () => { rolledBack = true; },
  });
  Department.findAll = async () => [{ id: 14 }];
  DepartmentAssetRequest.findOne = async () => ({ requestedBy: 7, status: 'Submitted' });
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findAll = originals.departments;
    DepartmentAssetRequest.findOne = originals.request;
  });
  const response = makeResponse();
  await controller.decide('approve')({
    organizationScope: { collegeId: 4 },
    user: { id: 7, role: 'college_manager' },
    params: { id: '52' },
    body: {},
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 403);
  assert.equal(rolledBack, true);
});

test('rejecting a request requires a reason before opening a database transaction', async (t) => {
  const original = sequelize.transaction;
  let openedTransaction = false;
  sequelize.transaction = async () => {
    openedTransaction = true;
    throw new Error('A transaction must not be started');
  };
  t.after(() => { sequelize.transaction = original; });
  const response = makeResponse();
  await controller.decide('reject')({
    organizationScope: { collegeId: 4 },
    user: { id: 8, role: 'college_manager' },
    params: { id: '52' },
    body: {},
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /reason is required/i);
  assert.equal(openedTransaction, false);
});

test('a College Manager decision updates status, history, and audit for an in-scope request', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    departments: Department.findAll,
    request: DepartmentAssetRequest.findOne,
    history: DepartmentAssetRequestHistory.create,
    audit: AuditLog.create,
  };
  const transaction = { finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const data = {
    id: 52,
    requestCode: 'CM-2026-TEST',
    requestedBy: 8,
    departmentId: 14,
    requestedItem: 'Microscope',
    category: 'Laboratory Equipment',
    quantity: 2,
    unit: 'unit',
    priority: 'high',
    status: 'Submitted',
    justification: 'For laboratory instruction',
    description: JSON.stringify({ collegeRequest: true, title: 'Physics lab equipment', preferredLocation: '', description: '' }),
  };
  const record = {
    get id() { return data.id; },
    get requestCode() { return data.requestCode; },
    get requestedBy() { return data.requestedBy; },
    get status() { return data.status; },
    toJSON: () => ({ ...data, Requester: { id: 8, username: 'requester', fullName: 'Request Owner', role: 'college_manager' }, DepartmentRecord: { id: 14, name: 'Physics', code: 'PHY' }, History: [] }),
    update: async (values) => { Object.assign(data, values); },
  };
  const history = [];
  const audits = [];
  sequelize.transaction = async () => transaction;
  Department.findAll = async () => [{ id: 14 }];
  DepartmentAssetRequest.findOne = async () => record;
  DepartmentAssetRequestHistory.create = async (values) => { history.push(values); };
  AuditLog.create = async (values) => { audits.push(values); };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findAll = originals.departments;
    DepartmentAssetRequest.findOne = originals.request;
    DepartmentAssetRequestHistory.create = originals.history;
    AuditLog.create = originals.audit;
  });

  const response = makeResponse();
  await controller.decide('approve')({
    organizationScope: { collegeId: 4 },
    user: { id: 9, role: 'college_manager' },
    params: { id: '52' },
    body: {},
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 200);
  assert.equal(data.status, 'Approved');
  assert.equal(history[0].previousStatus, 'Submitted');
  assert.equal(history[0].newStatus, 'Approved');
  assert.equal(audits[0].action, 'COLLEGE_ASSET_REQUEST_APPROVED');
  assert.equal(transaction.finished, 'commit');
});
