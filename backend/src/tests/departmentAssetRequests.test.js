const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const {
  sequelize,
  DepartmentAssetRequest,
  DepartmentAssetRequestHistory,
  Asset,
} = require('../models');
const { requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const notificationService = require('../services/notificationService');
notificationService.createDepartmentEventNotification = async () => {};
notificationService.createEventNotification = async () => {};
delete require.cache[require.resolve('../controllers/departmentAssetRequestController')];
delete require.cache[require.resolve('../routes/departmentWorkspaceRoutes')];
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');
const controller = require('../controllers/departmentAssetRequestController');

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

test('asset request list is filtered and paginated inside the resolved department scope', async (t) => {
  const originals = {
    findAndCountAll: DepartmentAssetRequest.findAndCountAll,
    findAll: DepartmentAssetRequest.findAll,
  };
  let query;
  DepartmentAssetRequest.findAndCountAll = async (options) => {
    query = options;
    return { rows: [], count: 0 };
  };
  DepartmentAssetRequest.findAll = async () => [];
  t.after(() => {
    DepartmentAssetRequest.findAndCountAll = originals.findAndCountAll;
    DepartmentAssetRequest.findAll = originals.findAll;
  });

  const res = makeResponse();
  await controller.listRequests({
    organizationScope: { departmentId: 12 },
    query: { status: 'Under Review', priority: 'high', search: 'lab', page: '2', limit: '5' },
  }, res, (error) => { throw error; });

  assert.equal(query.where.departmentId, 12);
  assert.equal(query.where.status, 'Under Review');
  assert.equal(query.where.priority, 'high');
  assert.ok(query.where[Op.or].some((field) => field.justification));
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.deepEqual(res.payload.statuses, controller.STATUSES);
});

test('asset request list rejects absent department scope and invalid status filters', async () => {
  const noScope = makeResponse();
  await controller.listRequests({ organizationScope: {}, query: {} }, noScope, (error) => { throw error; });
  assert.equal(noScope.statusCode, 403);

  const invalidFilter = makeResponse();
  await controller.listRequests({ organizationScope: { departmentId: 12 }, query: { status: 'Pending' } }, invalidFilter, (error) => { throw error; });
  assert.equal(invalidFilter.statusCode, 400);
});

test('asset request details cannot be read outside the requested department', async (t) => {
  const original = DepartmentAssetRequest.findOne;
  let query;
  DepartmentAssetRequest.findOne = async (options) => { query = options; return null; };
  t.after(() => { DepartmentAssetRequest.findOne = original; });

  const res = makeResponse();
  await controller.getRequest({
    organizationScope: { departmentId: 12 },
    params: { id: '999' },
  }, res, (error) => { throw error; });

  assert.deepEqual(query.where, { id: '999', departmentId: 12 });
  assert.equal(res.statusCode, 404);
});

test('creating an asset request requires justification', async (t) => {
  const original = sequelize.transaction;
  let rolledBack = false;
  sequelize.transaction = async () => ({ rollback: async () => { rolledBack = true; } });
  t.after(() => { sequelize.transaction = original; });

  const res = makeResponse();
  await controller.createRequest({
    organizationScope: { departmentId: 12, collegeId: 4 },
    user: { id: 8 },
    body: { requestedItem: 'Microscope', quantity: 1 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /justification/i);
  assert.equal(rolledBack, true);
});

test('creating a real request writes its department scope and initial status history', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    create: DepartmentAssetRequest.create,
    historyCreate: DepartmentAssetRequestHistory.create,
    findOne: DepartmentAssetRequest.findOne,
  };
  const transaction = { finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  let createdValues;
  let historyValues;
  sequelize.transaction = async () => transaction;
  DepartmentAssetRequest.create = async (values) => {
    createdValues = values;
    return { id: 34, ...values };
  };
  DepartmentAssetRequestHistory.create = async (values) => { historyValues = values; };
  DepartmentAssetRequest.findOne = async () => ({ toJSON: () => ({ id: 34, ...createdValues, History: [] }) });
  t.after(() => {
    sequelize.transaction = originals.transaction;
    DepartmentAssetRequest.create = originals.create;
    DepartmentAssetRequestHistory.create = originals.historyCreate;
    DepartmentAssetRequest.findOne = originals.findOne;
  });

  const res = makeResponse();
  await controller.createRequest({
    organizationScope: { departmentId: 12, collegeId: 4 },
    user: { id: 8 },
    body: { requestedItem: 'Microscope', quantity: '2', priority: 'high', justification: 'For scheduled lab classes' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(createdValues.departmentId, 12);
  assert.equal(createdValues.requestedBy, 8);
  assert.equal(createdValues.status, 'Submitted');
  assert.equal(createdValues.justification, 'For scheduled lab classes');
  assert.equal(historyValues.newStatus, 'Submitted');
  assert.equal(transaction.finished, 'commit');
});

test('an associated asset must belong to the authorized department and college', async (t) => {
  const originals = { transaction: sequelize.transaction, findOne: Asset.findOne };
  let assetWhere;
  let rolledBack = false;
  sequelize.transaction = async () => ({ rollback: async () => { rolledBack = true; } });
  Asset.findOne = async ({ where }) => { assetWhere = where; return null; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.findOne;
  });

  const res = makeResponse();
  await controller.createRequest({
    organizationScope: { departmentId: 12, collegeId: 4 },
    user: { id: 8 },
    body: { requestedItem: 'Replacement', assetId: 99, justification: 'Replacement needed' },
  }, res, (error) => { throw error; });

  assert.deepEqual(assetWhere, { id: 99, departmentId: 12, collegeId: 4 });
  assert.equal(res.statusCode, 403);
  assert.equal(rolledBack, true);
});

test('department head can submit an in-scope draft with a status history entry', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: DepartmentAssetRequest.findOne,
    historyCreate: DepartmentAssetRequestHistory.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const queries = [];
  let history;
  const record = { id: 34, update: async (values) => { record.status = values.status; }, status: 'Draft' };
  sequelize.transaction = async () => transaction;
  DepartmentAssetRequest.findOne = async (options) => {
    queries.push(options);
    return options.transaction ? record : { toJSON: () => ({ id: 34, status: record.status, History: [] }) };
  };
  DepartmentAssetRequestHistory.create = async (values) => { history = values; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    DepartmentAssetRequest.findOne = originals.findOne;
    DepartmentAssetRequestHistory.create = originals.historyCreate;
  });

  const res = makeResponse();
  await controller.submitDraft({
    organizationScope: { departmentId: 12 },
    user: { id: 8 },
    params: { id: '34' },
    body: {},
  }, res, (error) => { throw error; });

  assert.equal(queries[0].where.departmentId, 12);
  assert.deepEqual(queries[0].where.status[Op.in], ['Draft', 'Changes Requested']);
  assert.equal(history.previousStatus, 'Draft');
  assert.equal(history.newStatus, 'Submitted');
  assert.equal(res.payload.data.status, 'Submitted');
  assert.equal(transaction.finished, 'commit');
});

test('approval status transitions record history and reject self-approval', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    findOne: DepartmentAssetRequest.findOne,
    historyCreate: DepartmentAssetRequestHistory.create,
    auditCreate: require('../models').AuditLog.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  const record = {
    id: 34,
    requestedBy: 20,
    status: 'Submitted',
    update: async (values) => { record.status = values.status; },
    toJSON: () => ({ id: 34, status: record.status, History: [] }),
  };
  let history;
  sequelize.transaction = async () => transaction;
  DepartmentAssetRequest.findOne = async (options) => options.transaction
    ? record
    : record;
  DepartmentAssetRequestHistory.create = async (values) => { history = values; };
  require('../models').AuditLog.create = async () => {};
  t.after(() => {
    sequelize.transaction = originals.transaction;
    DepartmentAssetRequest.findOne = originals.findOne;
    DepartmentAssetRequestHistory.create = originals.historyCreate;
    require('../models').AuditLog.create = originals.auditCreate;
  });

  const response = makeResponse();
  await controller.decideApproval({
    organizationScope: { departmentId: 12 },
    user: { id: 8 },
    params: { id: '34' },
    body: {},
    approvalDecision: 'approve',
  }, response, (error) => { throw error; });
  assert.equal(response.payload.data.status, 'Approved');
  assert.equal(history.previousStatus, 'Submitted');
  assert.equal(history.newStatus, 'Approved');

  const selfApproval = makeResponse();
  await controller.decideApproval({
    organizationScope: { departmentId: 12 },
    user: { id: 20 },
    params: { id: '34' },
    body: {},
    approvalDecision: 'approve',
  }, selfApproval, (error) => { throw error; });
  assert.equal(selfApproval.statusCode, 403);
});

test('asset request endpoints are behind department-head authentication and scope', () => {
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
  }
  for (const [routePath, method] of [
    ['/asset-requests', 'get'],
    ['/asset-requests', 'post'],
    ['/asset-requests/:id', 'get'],
    ['/asset-requests/:id/submit', 'post'],
  ]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.route?.path === routePath && layer.route.methods[method]));
  }
});
