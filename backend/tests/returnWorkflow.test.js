const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const workflow = require('../src/controllers/returnWorkflowController');
const routes = require('../src/routes/returnWorkflowRoutes');
const notificationService = require('../src/services/notificationService');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const names = [
  ['transaction', models.sequelize, 'transaction'],
  ['assetReturnFindAndCountAll', models.AssetReturn, 'findAndCountAll'],
  ['assetReturnFindAll', models.AssetReturn, 'findAll'],
  ['assetReturnCreate', models.AssetReturn, 'create'],
  ['assetFindOne', models.Asset, 'findOne'],
  ['assignmentFindOne', models.Assignment, 'findOne'],
  ['assignmentFindAll', models.Assignment, 'findAll'],
  ['custodyFindOne', models.AssetCustody, 'findOne'],
  ['custodyFindAll', models.AssetCustody, 'findAll'],
  ['custodyUpdate', models.AssetCustody, 'update'],
  ['userFindByPk', models.User, 'findByPk'],
  ['userFindAll', models.User, 'findAll'],
  ['auditCreate', models.AuditLog, 'create'],
  ['inventoryFindOne', models.Inventory, 'findOne'],
  ['inventoryTransactionCreate', models.InventoryTransaction, 'create'],
  ['assetMovementCreate', models.AssetMovement, 'create'],
  ['notification', notificationService, 'createEventNotification'],
];
const originals = Object.fromEntries(names.map(([key, model, method]) => [key, model[method]]));
const restoreModels = () => names.forEach(([key, model, method]) => { model[method] = originals[key]; });

const request = (query = {}) => ({
  method: 'GET',
  path: '/college/returns',
  requestId: 'request-return-test',
  organizationScope: { collegeId: 22 },
  user: { id: 7, role: 'college_manager' },
  query,
});

test('college returns routes provide scoped list, eligible options, registration, and review actions', () => {
  const source = routes.stack.map((layer) => layer.route && `${Object.keys(layer.route.methods).join(',')} ${layer.route.path}`).filter(Boolean);
  assert.ok(source.includes('get /college/returns'));
  assert.ok(source.includes('get /college/returns/options'));
  assert.ok(source.includes('post /college/returns'));
  assert.ok(source.includes('post /college/returns/:id/approve'));
  assert.ok(source.includes('post /college/returns/:id/reject'));
  assert.ok(source.includes('post /college/returns/:id/cancel'));
  assert.ok(source.includes('post /store/returns/:id/ready'));
  assert.ok(source.includes('post /store/returns/:id/dispatch'));
  assert.ok(source.includes('post /store/returns/:id/receive'));
  assert.ok(source.includes('post /store/returns/:id/inspect'));
  assert.ok(source.includes('post /store/returns/:id/complete'));
});

test('return list validates pagination/status and refuses unscoped requests', async (t) => {
  let calls = 0;
  models.AssetReturn.findAndCountAll = async () => { calls += 1; return { rows: [], count: 0 }; };
  models.AssetReturn.findAll = async () => [];
  t.after(restoreModels);

  const badPage = response();
  await workflow.listReturns(request({ page: '0' }), badPage, (error) => { throw error; });
  assert.equal(badPage.statusCode, 400);

  const badStatus = response();
  await workflow.listReturns(request({ status: 'Invented' }), badStatus, (error) => { throw error; });
  assert.equal(badStatus.statusCode, 400);

  const unscoped = response();
  await workflow.listReturns({ method: 'GET', path: '/college/returns', query: {} }, unscoped, (error) => { throw error; });
  assert.equal(unscoped.statusCode, 403);
  assert.equal(calls, 0);
});

test('return list provides scoped records, status totals, and pagination metadata', async (t) => {
  let listOptions;
  models.AssetReturn.findAndCountAll = async (options) => {
    listOptions = options;
    return { count: 1, rows: [{ toJSON: () => ({ id: 11, assetId: 5, status: 'Requested', Asset: { id: 5, name: 'Microscope' } }) }] };
  };
  models.AssetReturn.findAll = async (options) => {
    assert.deepEqual(options.where, { collegeId: 22 });
    return [{ status: 'Requested' }, { status: 'Completed' }];
  };
  t.after(restoreModels);

  const res = response();
  await workflow.listReturns(request({ page: '2', pageSize: '10', status: 'Requested' }), res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(listOptions.where.collegeId, 22);
  assert.equal(listOptions.where.status, 'Requested');
  assert.equal(listOptions.limit, 10);
  assert.equal(listOptions.offset, 10);
  assert.equal(listOptions.include[0].where.collegeId, 22);
  assert.deepEqual(res.body.summary, { total: 2, byStatus: { Requested: 1, Completed: 1 } });
  assert.deepEqual(res.body.pagination, { page: 2, pageSize: 10, total: 1, totalPages: 1 });
});

test('eligible return assets come only from active college assignments or custody and subtract open returns', async (t) => {
  models.Assignment.findAll = async (options) => {
    assert.equal(options.include[0].where.collegeId, 22);
    return [{
      assetId: 5,
      assignedTo: 8,
      quantity: 4,
      User: { id: 8, fullName: 'Custodian' },
      Asset: { id: 5, assetCode: 'AST-5', name: 'Microscope', collegeId: 22 },
    }];
  };
  models.AssetCustody.findAll = async () => [];
  models.AssetReturn.findAll = async () => [{ assetId: 5, sourceUserId: 8, quantity: 2 }];
  t.after(restoreModels);

  const res = response();
  await workflow.listEligibleReturnAssets(request(), res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data.map(({ id, availableQuantity, sourceUserId }) => ({ id, availableQuantity, sourceUserId })), [
    { id: 5, availableQuantity: 2, sourceUserId: 8 },
  ]);
});

test('return registration persists only an authorized asset and reserves a valid quantity', async (t) => {
  let committed = false;
  let created;
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; committed = true; },
    async rollback() { this.finished = 'rollback'; },
  };
  models.sequelize.transaction = async () => transaction;
  models.Asset.findOne = async (options) => {
    assert.deepEqual(options.where, { id: 5, collegeId: 22 });
    return { id: 5, collegeId: 22, departmentId: 3, status: 'assigned', name: 'Microscope' };
  };
  models.Assignment.findOne = async () => ({ assignedTo: 8, quantity: 4 });
  models.AssetCustody.findOne = async () => null;
  models.AssetReturn.findAll = async () => [{ quantity: 1 }];
  models.User.findByPk = async () => ({ id: 8, fullName: 'Custodian', toJSON() { return this; } });
  models.User.findAll = async () => [];
  models.AssetReturn.create = async (values) => {
    created = values;
    return { ...values, id: 14, toJSON() { return { ...this }; } };
  };
  models.AuditLog.create = async () => ({});
  notificationService.createEventNotification = async () => ({ skipped: true });
  t.after(() => {
    restoreModels();
  });

  const res = response();
  await workflow.createReturn({
    ...request(),
    method: 'POST',
    path: '/college/returns',
    body: { asset_id: '5', quantity: '2', reason: 'End of Assignment', condition: 'Good', return_date: '2026-10-12', notes: '' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(committed, true);
  assert.equal(created.quantity, 2);
  assert.equal(created.sourceUserId, 8);
  assert.equal(created.collegeId, 22);
  assert.equal(created.status, 'Requested');
});

test('return registration rejects quantities beyond the active assignment and rolls back', async (t) => {
  let rolledBack = false;
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() {},
    async rollback() { this.finished = 'rollback'; rolledBack = true; },
  });
  models.Asset.findOne = async () => ({ id: 5, collegeId: 22, status: 'assigned' });
  models.Assignment.findOne = async () => ({ assignedTo: 8, quantity: 2 });
  models.AssetCustody.findOne = async () => null;
  models.AssetReturn.findAll = async () => [];
  t.after(restoreModels);

  const res = response();
  await workflow.createReturn({
    ...request(),
    method: 'POST',
    body: { asset_id: 5, quantity: 3, reason: 'End of Assignment', condition: 'Good', return_date: '2026-10-12' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.equal(rolledBack, true);
});

test('return registration forwards database transaction-start failures to Express error handling', async (t) => {
  const databaseError = new Error('Database unavailable');
  models.sequelize.transaction = async () => { throw databaseError; };
  t.after(restoreModels);
  let forwardedError;

  await workflow.createReturn({
    ...request(),
    method: 'POST',
    body: { asset_id: 5, quantity: 1, reason: 'End of Assignment', condition: 'Good', return_date: '2026-10-12' },
  }, response(), (error) => { forwardedError = error; });

  assert.equal(forwardedError, databaseError);
});

test('store progression enforces the authorized college scope and records audited status changes', async (t) => {
  let transactionCommitted = false;
  let query;
  let notified;
  const row = {
    id: 14,
    status: 'Approved',
    _previousDataValues: { status: 'Approved' },
    returnNumber: 'RET-14',
    requestedBy: 7,
    sourceUserId: 8,
    assetId: 5,
    async update(values) { Object.assign(this, values); },
    toJSON() { return { ...this }; },
  };
  models.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
    async commit() { this.finished = 'commit'; transactionCommitted = true; },
    async rollback() { this.finished = 'rollback'; },
  });
  models.AssetReturn.findOne = async (options) => { query = options; return row; };
  models.AuditLog.create = async () => ({});
  notificationService.createEventNotification = async (payload) => { notified = payload; };
  t.after(restoreModels);

  const res = response();
  await workflow.readyReturn({
    ...request(),
    method: 'POST',
    path: '/store/returns/14/ready',
    organizationScope: { collegeId: 22 },
    user: { id: 9, role: 'store_manager' },
    params: { id: '14' },
    body: {},
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(row.status, 'Ready for Return');
  assert.deepEqual(query.where, { id: '14', collegeId: 22 });
  assert.equal(transactionCommitted, true);
  assert.equal(notified.event, 'asset_return_status_changed');
  assert.deepEqual(notified.userIds, [7, 8]);
});
