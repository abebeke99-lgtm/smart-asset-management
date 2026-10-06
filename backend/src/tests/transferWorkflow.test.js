const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Transfer, Asset, Assignment, Department, User, AssetMovement, AuditLog, Notification } = require('../models');
const notificationService = require('../services/notificationService');
notificationService.createDepartmentEventNotification = async () => {};
delete require.cache[require.resolve('../controllers/transferWorkflowController')];
const workflow = require('../controllers/transferWorkflowController');
const transferRoutes = require('../routes/transferWorkflowRoutes');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

const makeTransaction = () => ({
  LOCK: { UPDATE: 'UPDATE' },
  finished: undefined,
  async commit() { this.finished = 'commit'; },
  async rollback() { this.finished = 'rollback'; },
});

const routeHas = (path, method) => transferRoutes.stack.some((layer) => (
  layer.route?.path === path && layer.route.methods[method]
));

test('department heads can request transfers and destination departments can confirm receipt', () => {
  assert.ok(DEFAULT_ROLE_PERMISSIONS.department_head.includes('assets.transfer'));
  assert.ok(routeHas('/department-head/transfers', 'post'));
  assert.ok(routeHas('/department-head/transfers/:id/receive', 'post'));
});

test('transfer request uses a real in-scope asset and writes the initial custody audit', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    departmentFindOne: Department.findOne,
    transferFindOne: Transfer.findOne,
    transferCreate: Transfer.create,
    userFindAll: User.findAll,
    auditCreate: AuditLog.create,
    notificationBulkCreate: Notification.bulkCreate,
  };
  const transaction = makeTransaction();
  const asset = {
    id: 18, campusId: 2, collegeId: 5, departmentId: 12, buildingId: 3, roomId: 4,
    department: 'Physics', location: 'Room 10', status: 'available',
  };
  let createdTransfer;
  const audits = [];
  sequelize.transaction = async () => transaction;
  Asset.findOne = async ({ where }) => {
    assert.deepEqual(where, { id: 18, departmentId: 12, collegeId: 5 });
    return asset;
  };
  Department.findOne = async ({ where }) => ({ id: Number(where.id), collegeId: 5, name: 'Chemistry' });
  Transfer.findOne = async () => null;
  Transfer.create = async (values) => {
    createdTransfer = {
      id: 91,
      ...values,
      toJSON() { return { ...this, toJSON: undefined }; },
    };
    return createdTransfer;
  };
  User.findAll = async () => [];
  AuditLog.create = async (values) => { audits.push(values); };
  Notification.bulkCreate = async () => [];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    Department.findOne = originals.departmentFindOne;
    Transfer.findOne = originals.transferFindOne;
    Transfer.create = originals.transferCreate;
    User.findAll = originals.userFindAll;
    AuditLog.create = originals.auditCreate;
    Notification.bulkCreate = originals.notificationBulkCreate;
  });

  const response = makeResponse();
  await workflow.createTransfer({
    organizationScope: { departmentId: 12, collegeId: 5 },
    user: { id: 7, role: 'department_head' },
    body: { asset_id: '18', destination_department_id: '13', destination_location: 'Chemistry Lab', reason: 'Reallocation' },
    ip: '127.0.0.1',
    headers: {},
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(createdTransfer.status, 'Requested');
  assert.equal(createdTransfer.sourceDepartmentId, 12);
  assert.equal(createdTransfer.destinationDepartmentId, 13);
  assert.equal(createdTransfer.requestedBy, 7);
  assert.equal(transaction.finished, 'commit');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'TRANSFER_REQUESTED');
});

test('transfer requests cannot use an asset from another department', async (t) => {
  const originalTransaction = sequelize.transaction;
  const originalAssetFindOne = Asset.findOne;
  const transaction = makeTransaction();
  let where;
  sequelize.transaction = async () => transaction;
  Asset.findOne = async (options) => { where = options.where; return null; };
  t.after(() => {
    sequelize.transaction = originalTransaction;
    Asset.findOne = originalAssetFindOne;
  });

  const response = makeResponse();
  await workflow.createTransfer({
    organizationScope: { departmentId: 12, collegeId: 5 },
    user: { id: 7, role: 'department_head' },
    body: { asset_id: 18, destination_department_id: 13, destination_location: 'Lab', reason: 'Move' },
  }, response, (error) => { throw error; });

  assert.deepEqual(where, { id: 18, departmentId: 12, collegeId: 5 });
  assert.equal(response.statusCode, 403);
  assert.equal(transaction.finished, 'rollback');
});

test('a department head outside the destination cannot confirm receipt', async (t) => {
  const originalTransaction = sequelize.transaction;
  const originalTransferFindOne = Transfer.findOne;
  const transaction = makeTransaction();
  let assetLookup = false;
  sequelize.transaction = async () => transaction;
  Transfer.findOne = async () => ({ id: 91, destinationDepartmentId: 13, status: 'In Transit' });
  const originalAssetFindByPk = Asset.findByPk;
  Asset.findByPk = async () => { assetLookup = true; return null; };
  t.after(() => {
    sequelize.transaction = originalTransaction;
    Transfer.findOne = originalTransferFindOne;
    Asset.findByPk = originalAssetFindByPk;
  });

  const response = makeResponse();
  await workflow.receiveTransfer({
    organizationScope: { departmentId: 12, collegeId: 5 },
    user: { id: 7, role: 'department_head' },
    params: { id: 91 },
    body: {},
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 403);
  assert.equal(assetLookup, false);
  assert.equal(transaction.finished, 'rollback');
});

test('authorization changes transfer status without moving the asset', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    transferFindOne: Transfer.findOne,
    transferFindByPk: Transfer.findByPk,
    assetFindByPk: Asset.findByPk,
    auditCreate: AuditLog.create,
    notificationBulkCreate: Notification.bulkCreate,
  };
  const transaction = makeTransaction();
  let assetUpdated = false;
  const row = {
    id: 91, assetId: 18, requestedBy: 6, status: 'Requested',
    async update(values) { Object.assign(this, values); },
    toJSON() { return { id: this.id, assetId: this.assetId, requestedBy: this.requestedBy, status: this.status }; },
  };
  sequelize.transaction = async () => transaction;
  Transfer.findOne = async () => row;
  Transfer.findByPk = async () => row;
  Asset.findByPk = async () => ({ status: 'available', async update() { assetUpdated = true; } });
  AuditLog.create = async () => ({});
  Notification.bulkCreate = async () => [];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Transfer.findOne = originals.transferFindOne;
    Transfer.findByPk = originals.transferFindByPk;
    Asset.findByPk = originals.assetFindByPk;
    AuditLog.create = originals.auditCreate;
    Notification.bulkCreate = originals.notificationBulkCreate;
  });

  const response = makeResponse();
  await workflow.approveTransfer({
    organizationScope: { collegeId: 5 },
    user: { id: 7, role: 'college_manager' },
    params: { id: 91 },
    body: { reason: 'Approved' },
    headers: {},
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data.status, 'Approved');
  assert.equal(row.approvedBy, 7);
  assert.equal(assetUpdated, false);
  assert.equal(transaction.finished, 'commit');
});

test('destination confirmation records receipt and only then updates asset ownership and location', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    transferFindOne: Transfer.findOne,
    transferFindByPk: Transfer.findByPk,
    assetFindByPk: Asset.findByPk,
    departmentFindOne: Department.findOne,
    assignmentFindOne: Assignment.findOne,
    movementCreate: AssetMovement.create,
    auditCreate: AuditLog.create,
    notificationBulkCreate: Notification.bulkCreate,
  };
  const transaction = makeTransaction();
  const row = {
    id: 91, assetId: 18, requestedBy: 6, status: 'In Transit', sourceDepartmentId: 12,
    destinationDepartmentId: 13, destinationCollegeId: 5, newLocation: 'Chemistry Lab',
    transferReason: 'Reallocation', assetStatusBeforeTransfer: 'available',
    async update(values) { Object.assign(this, values); },
    toJSON() { return { id: this.id, assetId: this.assetId, status: this.status, receivedBy: this.receivedBy }; },
  };
  const asset = {
    id: 18, status: 'in-transfer', collegeId: 5, departmentId: 12, department: 'Physics',
    location: 'Physics Room', buildingId: 3, roomId: 4, condition: 'Good',
    async update(values) { Object.assign(this, values); },
    toJSON() { return { ...this }; },
  };
  let movement;
  sequelize.transaction = async () => transaction;
  Transfer.findOne = async () => row;
  Transfer.findByPk = async () => row;
  Asset.findByPk = async () => asset;
  Department.findOne = async () => ({ id: 13, collegeId: 5, name: 'Chemistry' });
  Assignment.findOne = async () => null;
  AssetMovement.create = async (values) => { movement = values; };
  AuditLog.create = async () => ({});
  Notification.bulkCreate = async () => [];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Transfer.findOne = originals.transferFindOne;
    Transfer.findByPk = originals.transferFindByPk;
    Asset.findByPk = originals.assetFindByPk;
    Department.findOne = originals.departmentFindOne;
    Assignment.findOne = originals.assignmentFindOne;
    AssetMovement.create = originals.movementCreate;
    AuditLog.create = originals.auditCreate;
    Notification.bulkCreate = originals.notificationBulkCreate;
  });

  const response = makeResponse();
  await workflow.receiveTransfer({
    organizationScope: { departmentId: 13, collegeId: 5 },
    user: { id: 9, role: 'department_head' },
    params: { id: 91 },
    body: { notes: 'Received in good condition' },
    headers: {},
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.data.status, 'Received');
  assert.equal(row.receivedBy, 9);
  assert.equal(asset.departmentId, 13);
  assert.equal(asset.location, 'Chemistry Lab');
  assert.equal(asset.status, 'available');
  assert.equal(movement.referenceType, 'transfer');
  assert.equal(movement.referenceId, 91);
  assert.equal(transaction.finished, 'commit');
});

test('transfer detail history is limited to the department scope and includes its audit trail', async (t) => {
  const originals = { transferFindOne: Transfer.findOne, transferFindAll: Transfer.findAll, auditFindAll: AuditLog.findAll };
  let historyQuery;
  let auditQuery;
  const row = {
    id: 91, assetId: 18, status: 'Received', sourceDepartmentId: 12, destinationDepartmentId: 13,
    toJSON() { return { ...this }; },
  };
  Transfer.findOne = async () => row;
  Transfer.findAll = async (options) => { historyQuery = options; return [row]; };
  AuditLog.findAll = async (options) => { auditQuery = options; return [{ action: 'TRANSFER_RECEIVED' }]; };
  t.after(() => {
    Transfer.findOne = originals.transferFindOne;
    Transfer.findAll = originals.transferFindAll;
    AuditLog.findAll = originals.auditFindAll;
  });

  const response = makeResponse();
  await workflow.getTransfer({
    organizationScope: { departmentId: 12, collegeId: 5 },
    params: { id: 91 },
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 200);
  assert.equal(historyQuery.where.assetId, 18);
  assert.equal(historyQuery.where[require('sequelize').Op.and][0][require('sequelize').Op.or][0].sourceDepartmentId, 12);
  assert.deepEqual(auditQuery.where, { entity: 'transfer:91' });
  assert.equal(response.payload.data.history.length, 1);
  assert.equal(response.payload.data.audit[0].action, 'TRANSFER_RECEIVED');
});
