const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const workspaceRoutes = require('../routes/departmentWorkspaceRoutes');
const {
  Asset, AssetHistory, AssetRegistrationRequest, Assignment, User, Approval, AuditLog, Maintenance, sequelize,
} = require('../models');
const { listAssets, updateAsset, exportAssets, createAssetRequest } = require('../controllers/departmentAssetController');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('Department Head asset listing always uses authenticated department scope', async () => {
  const original = Asset.findAndCountAll;
  const originals = {
    findAll: Asset.findAll,
    assignmentFindAll: Assignment.findAll,
    maintenanceFindAll: Maintenance.findAll,
    auditCreate: AuditLog.create,
  };
  let options;
  let facetsQuery;
  let auditValues;
  Asset.findAndCountAll = async (value) => { options = value; return { count: 0, rows: [] }; };
  Asset.findAll = async (value) => {
    facetsQuery = value;
    return [{ id: 5, category: 'Computing', status: 'available', condition: 'Good', location: 'Lab 1', warrantyExpiry: null }];
  };
  Assignment.findAll = async () => [{ assignedTo: 18, User: { fullName: 'Full Dataset User', username: 'staff18' } }];
  Maintenance.findAll = async () => [];
  AuditLog.create = async (value) => { auditValues = value; return { id: 1 }; };
  try {
    const res = response();
    await listAssets({
      user: { id: 3, role: 'department_head' },
      organizationScope: { departmentId: 7, department: { id: 7, name: 'Physics', code: 'PHY' } },
      query: { departmentId: '99', page: '2', limit: '10', sortBy: 'name', sortOrder: 'ASC' },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(options.where.departmentId, 7);
    assert.equal(options.limit, 10);
    assert.equal(options.offset, 10);
    assert.deepEqual(options.order, [['name', 'ASC']]);
    assert.deepEqual(facetsQuery.where, { departmentId: 7 });
    assert.deepEqual(res.body.assets, []);
    assert.deepEqual(res.body.data.assets, []);
    assert.deepEqual(res.body.data.department, { id: 7, name: 'Physics', code: 'PHY' });
    assert.deepEqual(res.body.data.pagination, res.body.pagination);
    assert.deepEqual(res.body.data.filterOptions, {
      categories: ['Computing'], statuses: ['available'], conditions: ['Good'], locations: ['Lab 1'],
      users: [{ id: 18, name: 'Full Dataset User' }],
      assignedUsers: [{ id: 18, name: 'Full Dataset User', username: 'staff18' }],
      maintenanceStatuses: [], warranties: ['valid', 'expired'], warrantyStatuses: ['valid', 'expired'],
    });
    assert.equal(auditValues.action, 'DEPARTMENT_ASSET_LIST_VIEWED');
    assert.equal(auditValues.entity, 'department:7:assets');
    const auditDetails = JSON.parse(auditValues.details);
    assert.equal(auditDetails.departmentId, 7);
    assert.deepEqual(auditDetails.filterNames, []);
    assert.equal(JSON.stringify(auditDetails).includes('99'), false);
  } finally {
    Asset.findAndCountAll = original;
    Asset.findAll = originals.findAll;
    Assignment.findAll = originals.assignmentFindAll;
    Maintenance.findAll = originals.maintenanceFindAll;
    AuditLog.create = originals.auditCreate;
  }
});

test('asset search includes digital ID and supports requested sort/filter parameter names', async () => {
  const originals = {
    findAndCountAll: Asset.findAndCountAll,
    assetFindAll: Asset.findAll,
    assignmentFindAll: Assignment.findAll,
    maintenanceFindAll: Maintenance.findAll,
    auditCreate: AuditLog.create,
  };
  let options;
  Asset.findAndCountAll = async (value) => { options = value; return { count: 0, rows: [] }; };
  Asset.findAll = async () => [];
  Assignment.findAll = async () => [];
  Maintenance.findAll = async () => [];
  AuditLog.create = async () => ({ id: 1 });
  try {
    const res = response();
    await listAssets({
      user: { id: 3, role: 'department_head' },
      organizationScope: { departmentId: 7 },
      query: { search: 'DIG-42', sort: 'digitalId', order: 'ASC', warranty: 'expired', maintenanceStatus: 'in progress' },
    }, res, (error) => { throw error; });
    assert.deepEqual(options.order, [['digitalId', 'ASC']]);
    assert.equal(options.where.departmentId, 7);
    assert.ok(options.where[Op.or].some((filter) => filter.digitalId));
    assert.ok(options.where.warrantyExpiry[Op.lt]);
    assert.ok(res.body.filterOptions.warranties.includes('valid'));
    assert.ok(res.body.filterOptions.warranties.includes('expired'));
  } finally {
    Asset.findAndCountAll = originals.findAndCountAll;
    Asset.findAll = originals.assetFindAll;
    Assignment.findAll = originals.assignmentFindAll;
    Maintenance.findAll = originals.maintenanceFindAll;
    AuditLog.create = originals.auditCreate;
  }
});

test('asset list applies assigned-user, maintenance, and warranty filters within department scope', async () => {
  const originals = {
    findAndCountAll: Asset.findAndCountAll,
    assetFindAll: Asset.findAll,
    assignmentFindAll: Assignment.findAll,
    maintenanceFindAll: Maintenance.findAll,
    auditCreate: AuditLog.create,
  };
  let options;
  let assignmentOptions;
  let maintenanceOptions;
  Asset.findAndCountAll = async (value) => { options = value; return { count: 0, rows: [] }; };
  Asset.findAll = async () => [];
  Assignment.findAll = async (value) => {
    assignmentOptions = value;
    return [{ assetId: 51 }];
  };
  Maintenance.findAll = async (value) => {
    maintenanceOptions = value;
    return [{ assetId: 51, status: 'in progress', updatedAt: '2026-10-01T00:00:00.000Z' }];
  };
  AuditLog.create = async () => ({ id: 1 });
  try {
    const res = response();
    await listAssets({
      user: { id: 3, role: 'department_head' },
      organizationScope: { departmentId: 7 },
      query: { assignedUser: '18', maintenanceStatus: 'in progress', warranty: 'valid', sortBy: 'assignedUser', sortOrder: 'ASC' },
    }, res, (error) => { throw error; });
    assert.equal(assignmentOptions.include[1].where.id, 18);
    assert.equal(maintenanceOptions.include[0].where.departmentId, 7);
    assert.deepEqual(maintenanceOptions.order, [['updatedAt', 'DESC'], ['createdAt', 'DESC']]);
    assert.deepEqual(options.where.id[Op.in], [51]);
    assert.ok(options.where.warrantyExpiry[Op.gte]);
    assert.ok(options.order[0].some((segment) => typeof segment !== 'string' && segment.model === Assignment));
  } finally {
    Asset.findAndCountAll = originals.findAndCountAll;
    Asset.findAll = originals.assetFindAll;
    Assignment.findAll = originals.assignmentFindAll;
    Maintenance.findAll = originals.maintenanceFindAll;
    AuditLog.create = originals.auditCreate;
  }
});

test('asset detail views and exports write scoped audit records without leaking filter values', async () => {
  const originals = {
    assetFindOne: Asset.findOne,
    assetFindAll: Asset.findAll,
    assetCount: Asset.count,
    auditCreate: AuditLog.create,
  };
  const auditRecords = [];
  Asset.findOne = async (options) => {
    assert.equal(options.where.departmentId, 7);
    return {
      id: 12,
      toJSON: () => ({ id: 12, Assignments: [], Maintenances: [] }),
    };
  };
  Asset.findAll = async (options) => {
    assert.equal(options.where.departmentId, 7);
    return [];
  };
  Asset.count = async () => 0;
  AuditLog.create = async (value) => {
    auditRecords.push(value);
    return { id: auditRecords.length };
  };
  const res = {
    headers: {},
    output: '',
    set(headers) { this.headers = headers; },
    send(body) { this.body = body; return this; },
    write(chunk) { this.output += chunk; return true; },
    end() { this.body = this.output; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.jsonBody = body; return this; },
  };
  try {
    const req = {
      organizationScope: { departmentId: 7, department: { id: 7, name: 'Physics', code: 'PHY' } },
      user: { id: 3, role: 'department_head' },
      params: { id: '12' },
      query: { search: 'private-search-value', departmentId: '999' },
    };
    await require('../controllers/departmentAssetController').getAsset(req, res, (error) => { throw error; });
    await exportAssets({ ...req, query: { ...req.query, format: 'csv' } }, res, (error) => { throw error; });
    assert.deepEqual(auditRecords.map((entry) => entry.action), ['DEPARTMENT_ASSET_VIEWED', 'DEPARTMENT_ASSETS_EXPORTED']);
    auditRecords.forEach((entry) => {
      const details = JSON.parse(entry.details);
      assert.equal(details.departmentId, 7);
      assert.equal(JSON.stringify(details).includes('999'), false);
      assert.equal(JSON.stringify(details).includes('private-search-value'), false);
    });
    assert.equal(auditRecords[0].entity, 'asset:12');
    assert.equal(auditRecords[1].entity, 'department:7:assets');
  } finally {
    Asset.findOne = originals.assetFindOne;
    Asset.findAll = originals.assetFindAll;
    Asset.count = originals.assetCount;
    AuditLog.create = originals.auditCreate;
  }
});

test('department-head asset routes include the registration, detail, PUT, and export paths', () => {
  const routes = fs.readFileSync(path.resolve(__dirname, '../routes/departmentWorkspaceRoutes.js'), 'utf8');
  assert.match(routes, /router\.post\('\/assets\/registration-requests'/);
  assert.match(routes, /router\.get\('\/assets\/:id'/);
  assert.match(routes, /router\.put\('\/assets\/:id'/);
  assert.match(routes, /router\.get\('\/assets\/export'/);
  assert.match(routes, /router\.get\('\/staff', requirePermission\('users\.view'\), listDepartmentStaff\)/);
  const { up: migration } = require('../scripts/migrations/departmentHeadAssetRegistration');
  assert.equal(typeof migration, 'function');
});

test('asset update rejects every field outside the edit whitelist', async () => {
  const originalTransaction = sequelize.transaction;
  sequelize.transaction = async () => { throw new Error('must not open transaction for invalid input'); };
  try {
    const res = response();
    await updateAsset({
      organizationScope: { departmentId: 7 },
      params: { id: '12' },
      user: { id: 3, role: 'department_head' },
      body: { status: 'retired' },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Unsupported asset field/);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('asset assignment rejects active users outside the authenticated department', async () => {
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    assignmentFindOne: Assignment.findOne,
    userFindOne: User.findOne,
  };
  let userWhere;
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async rollback() { this.finished = 'rollback'; },
  };
  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => ({ id: 12, departmentId: 7, location: 'Room 1', condition: 'Good' });
  Assignment.findOne = async () => null;
  User.findOne = async (options) => { userWhere = options.where; return null; };
  try {
    const res = response();
    await updateAsset({
      organizationScope: { departmentId: 7, collegeId: 2 },
      params: { id: '12' },
      user: { id: 3, role: 'department_head' },
      body: { assignedUserId: 88 },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400);
    assert.equal(userWhere.departmentId, 7);
    assert.equal(userWhere.collegeId, 2);
    assert.equal(userWhere.id, 88);
    assert.equal(transaction.finished, 'rollback');
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    Assignment.findOne = originals.assignmentFindOne;
    User.findOne = originals.userFindOne;
  }
});

test('asset update explicitly accepts note and records old/new notes in asset audit history', async () => {
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    assignmentFindOne: Assignment.findOne,
    auditCreate: AuditLog.create,
    assetHistoryCreate: AssetHistory.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: false, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  let assetUpdate;
  let audit;
  let history;
  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => ({
    id: 12, departmentId: 7, location: 'Room 1', condition: 'Good', notes: 'Existing note',
    async update(values) { assetUpdate = values; Object.assign(this, values); },
    toJSON() { return { id: this.id, ...assetUpdate }; },
  });
  Assignment.findOne = async () => null;
  AuditLog.create = async (values) => { audit = values; return { id: 1 }; };
  AssetHistory.create = async (values) => { history = values; return { id: 1 }; };
  try {
    const res = response();
    await updateAsset({
      organizationScope: { departmentId: 7 },
      params: { id: '12' },
      user: { id: 3, role: 'department_head' },
      body: { location: 'Room 2', condition: 'Fair', assignedUserId: null, note: 'Checked during inspection' },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(assetUpdate, { location: 'Room 2', condition: 'Fair', notes: 'Checked during inspection' });
    const details = JSON.parse(audit.details);
    assert.equal(details.old_value.note, 'Existing note');
    assert.equal(details.new_value.note, 'Checked during inspection');
    assert.equal(details.note, 'Checked during inspection');
    assert.deepEqual(details.changedFields, ['location', 'condition', 'assignedUserId', 'note']);
    assert.equal(history.oldValue.note, 'Existing note');
    assert.equal(history.newValue.note, 'Checked during inspection');
    assert.equal(history.details.note, 'Checked during inspection');
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    Assignment.findOne = originals.assignmentFindOne;
    AuditLog.create = originals.auditCreate;
    AssetHistory.create = originals.assetHistoryCreate;
  }
});

test('asset request registration submits a pending approval using only authenticated scope', async () => {
  const notificationService = require('../services/notificationService');
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    registrationFindOne: AssetRegistrationRequest.findOne,
    registrationCreate: AssetRegistrationRequest.create,
    approvalCreate: Approval.create,
    auditCreate: AuditLog.create,
    notify: notificationService.createFinanceNotification,
  };
  const transaction = { finished: false, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  let approvalValues;
  let registrationValues;
  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => null;
  AssetRegistrationRequest.findOne = async () => null;
  AssetRegistrationRequest.create = async (values) => {
    registrationValues = values;
    return { id: 91, toJSON: () => ({ id: 91, ...values }) };
  };
  Approval.create = async (values) => {
    approvalValues = values;
    return { id: 27, status: values.status, ...values };
  };
  AuditLog.create = async () => ({ id: 1 });
  notificationService.createFinanceNotification = async () => ({});
  try {
    const res = response();
    await createAssetRequest({
      organizationScope: { departmentId: 7 },
      user: { id: 3, role: 'department_head' },
      body: {
        name: 'Laptop', category: 'Computing', serialNumber: 'SER-1', condition: 'Good', location: 'Room 2',
        purchaseDate: '2026-01-01', warrantyExpiry: '2028-01-01', justification: 'Replacement',
        quantity: 2, departmentId: 99, requestedBy: 88,
      },
    }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 201);
    assert.equal(approvalValues.departmentId, 7);
    assert.equal(approvalValues.requestedBy, 3);
    assert.equal(approvalValues.status, 'pending');
    assert.equal(approvalValues.type, 'purchase');
    assert.equal(approvalValues.item, 'Laptop');
    assert.match(approvalValues.reason, /Replacement/);
    assert.equal(registrationValues.serialNumber, 'SER-1');
    assert.equal(registrationValues.category, 'Computing');
    assert.equal(registrationValues.condition, 'Good');
    assert.equal(registrationValues.location, 'Room 2');
    assert.equal(registrationValues.purchaseDate, '2026-01-01');
    assert.equal(registrationValues.warrantyExpiry, '2028-01-01');
    assert.equal(registrationValues.status, 'Pending');
    assert.equal(transaction.finished, 'commit');
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    AssetRegistrationRequest.findOne = originals.registrationFindOne;
    AssetRegistrationRequest.create = originals.registrationCreate;
    Approval.create = originals.approvalCreate;
    AuditLog.create = originals.auditCreate;
    notificationService.createFinanceNotification = originals.notify;
  }
});

test('registration rejects future purchase dates and zero quantity before persistence', async () => {
  const originalTransaction = sequelize.transaction;
  sequelize.transaction = async () => { throw new Error('invalid request must not persist'); };
  try {
    for (const body of [
      { name: 'Laptop', category: 'Computing', condition: 'Good', location: 'Room 2', justification: 'Need it', quantity: 1, purchaseDate: '2999-01-01' },
      { name: 'Laptop', category: 'Computing', condition: 'Good', location: 'Room 2', justification: 'Need it', quantity: 0 },
    ]) {
      const res = response();
      await createAssetRequest({
        organizationScope: { departmentId: 7 },
        user: { id: 3, role: 'department_head' },
        body,
      }, res, (error) => { throw error; });
      assert.equal(res.statusCode, 400);
    }
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('CSV export contains complete asset columns and department/export metadata', async () => {
  const originals = { findAll: Asset.findAll, count: Asset.count };
  Asset.findAll = async () => [{
    toJSON: () => ({
      id: 1, name: 'Microscope', assetCode: 'PHY-1', digitalId: 'DIG-1', specifications: { lens: '40x' },
      quantity: 1, notes: 'Do not omit', departmentId: 7, warrantyExpiry: '2028-01-01',
      Assignments: [{ assignedTo: 3, status: 'active', User: { fullName: 'A Staff' } }],
    }),
  }];
  Asset.count = async () => 1;
  const res = {
    headers: {},
    output: '',
    set(headers) { this.headers = headers; },
    write(chunk) { this.output += chunk; return true; },
    end() { this.body = this.output; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.jsonBody = body; return this; },
  };
  try {
    await exportAssets({
      organizationScope: { departmentId: 7, department: { id: 7, name: 'Physics', code: 'PHY' } },
      user: { id: 3, fullName: 'Department Head' },
      query: { format: 'csv', search: 'Microscope' },
    }, res, (error) => { throw error; });
    assert.match(res.headers['Content-Disposition'], /assets_PHY_\d{4}-\d{2}-\d{2}\.csv/);
    assert.match(res.body, /"Department","Physics"/);
    assert.match(res.body, /"Exported By","Department Head"/);
    assert.match(res.body, /Digital ID/);
    assert.match(res.body, /Specifications/);
    assert.match(res.body, /Assigned User ID/);
    assert.match(res.body, /Microscope/);
    assert.match(res.body, /Do not omit/);
  } finally {
    Asset.findAll = originals.findAll;
    Asset.count = originals.count;
  }
});

test('CSV streams fixed-size batches, and PDF/XLSX enforce documented row caps', async () => {
  const originals = { findAll: Asset.findAll, count: Asset.count, auditCreate: AuditLog.create };
  const calls = [];
  Asset.count = async () => 501;
  Asset.findAll = async (options) => {
    calls.push({ limit: options.limit, offset: options.offset });
    return Array.from({ length: options.limit }, (_, index) => ({
      toJSON: () => ({ id: options.offset + index + 1, name: `Asset ${options.offset + index + 1}` }),
    }));
  };
  AuditLog.create = async () => ({ id: 1 });
  const responseMock = () => ({
    headers: {},
    set(headers) { this.headers = headers; },
    write() { return true; },
    end() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  try {
    const baseRequest = {
      organizationScope: { departmentId: 7, department: { id: 7, name: 'Physics', code: 'PHY' } },
      user: { id: 3, role: 'department_head' },
      query: {},
    };
    const csvResponse = responseMock();
    await exportAssets({ ...baseRequest, query: { format: 'csv' } }, csvResponse, (error) => { throw error; });
    assert.deepEqual(calls, [{ limit: 500, offset: 0 }, { limit: 500, offset: 500 }]);

    Asset.count = async () => 2001;
    calls.length = 0;
    const pdfResponse = responseMock();
    await exportAssets({ ...baseRequest, query: { format: 'pdf' } }, pdfResponse, (error) => { throw error; });
    assert.equal(pdfResponse.statusCode, 413);
    assert.equal(pdfResponse.body.maxAssets, 2000);
    assert.equal(calls.length, 0);

    Asset.count = async () => 5001;
    const xlsxResponse = responseMock();
    await exportAssets({ ...baseRequest, query: { format: 'xlsx' } }, xlsxResponse, (error) => { throw error; });
    assert.equal(xlsxResponse.statusCode, 413);
    assert.equal(xlsxResponse.body.maxAssets, 5000);
  } finally {
    Asset.findAll = originals.findAll;
    Asset.count = originals.count;
    AuditLog.create = originals.auditCreate;
  }
});

test('registration model requires positive quantity, non-future purchase date, and unique serials', async () => {
  assert.equal(AssetRegistrationRequest.getTableName(), 'asset_requests');
  assert.equal(AssetRegistrationRequest.rawAttributes.serialNumber.unique, true);
  const invalidQuantity = AssetRegistrationRequest.build({
    departmentId: 7, requestedBy: 3, approvalId: 27, name: 'Laptop', category: 'Computing',
    quantity: 0, condition: 'Good', location: 'Room 2', justification: 'Required',
  });
  await assert.rejects(invalidQuantity.validate(), /quantity|min/);
  const futurePurchase = AssetRegistrationRequest.build({
    departmentId: 7, requestedBy: 3, approvalId: 27, name: 'Laptop', category: 'Computing',
    quantity: 1, condition: 'Good', location: 'Room 2', justification: 'Required',
    purchaseDate: '2999-01-01',
  });
  await assert.rejects(futurePurchase.validate(), /Purchase date cannot be in the future/);
});
