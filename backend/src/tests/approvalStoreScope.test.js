const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const models = require('../models');
const notificationService = require('../services/notificationService');

notificationService.createBulkNotification = async () => {};

const { sequelize, Approval, Asset, Department, AuditLog, Inventory, AssetMovement } = models;
const { listApprovals, getApprovalById, createApproval, decideApproval } = require('../controllers/approvalController');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/approvalRoutes.js'), 'utf8');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const storeRequest = (overrides = {}) => ({
  user: { id: 9, role: 'store_manager', collegeId: 1 },
  organizationScope: { collegeId: 1 },
  params: { id: '25' },
  query: {},
  body: { status: 'approved', comment: 'Reviewed' },
  ...overrides,
});

const approvalRecord = ({ collegeId = 1, departmentId = 12, assetId = null } = {}) => ({
  id: 25,
  type: 'asset_request',
  status: 'pending',
  requestedBy: 42,
  departmentId,
  assetId,
  Department: departmentId ? { id: departmentId, name: 'Department', collegeId } : null,
  Asset: assetId ? { id: assetId, name: 'Asset', collegeId } : null,
  Requester: { id: 42, fullName: 'Requester' },
  Reviewer: null,
  async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  toJSON() { return { id: this.id, type: this.type, status: this.status, requestedBy: this.requestedBy, departmentId: this.departmentId }; },
});

test('store-manager approval list query is limited to own College department and asset IDs', async () => {
  const originalFindAll = Approval.findAll;
  let queryOptions;
  Approval.findAll = async (options) => { queryOptions = options; return []; };
  try {
    const response = makeResponse();
    await listApprovals(storeRequest({ query: { collegeId: '2', requested_by: '42' } }), response, (error) => { throw error; });
    const scopePredicates = queryOptions.where[Op.and];
    assert.equal(scopePredicates[0][Op.or][1]['$Department.collegeId$'], 1);
    assert.equal(scopePredicates[1][Op.or][1]['$Asset.collegeId$'], 1);
    assert.equal(scopePredicates[2][Op.or][0]['$Department.collegeId$'], 1);
    assert.equal(scopePredicates[2][Op.or][1]['$Asset.collegeId$'], 1);
    assert.equal(queryOptions.include[0].attributes.includes('collegeId'), true);
    assert.equal(queryOptions.include[1].attributes.includes('collegeId'), true);
    assert.equal(queryOptions.where.requestedBy, '42');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.total, 0);
  } finally {
    Approval.findAll = originalFindAll;
  }
});

test('store manager cannot read or decide an approval linked to another College', async () => {
  const originals = { findByPk: Approval.findByPk, transaction: sequelize.transaction };
  const foreignRecord = approvalRecord({ collegeId: 2, departmentId: 22 });
  let updateCalls = 0;
  let rollbackCalls = 0;
  Approval.findByPk = async () => foreignRecord;
  sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    rollback: async () => { rollbackCalls += 1; },
    commit: async () => {},
  });
  foreignRecord.update = async () => { updateCalls += 1; };
  try {
    const detailResponse = makeResponse();
    await getApprovalById(storeRequest(), detailResponse, (error) => { throw error; });
    assert.equal(detailResponse.statusCode, 404);

    const decisionResponse = makeResponse();
    await decideApproval(storeRequest(), decisionResponse, (error) => { throw error; });
    assert.equal(decisionResponse.statusCode, 404);
    assert.equal(updateCalls, 0);
    assert.equal(rollbackCalls, 1);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
  }
});

test('same-College decision and audit row use the same transaction', async () => {
  const originals = { findByPk: Approval.findByPk, transaction: sequelize.transaction, auditCreate: AuditLog.create };
  const record = approvalRecord();
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  let auditOptions;
  let auditValues;
  Approval.findByPk = async () => record;
  sequelize.transaction = async () => transaction;
  AuditLog.create = async (values, options) => { auditValues = values; auditOptions = options; return values; };
  try {
    const response = makeResponse();
    await decideApproval(storeRequest(), response, (error) => { throw error; });
    assert.equal(response.statusCode, 200);
    assert.equal(record.updateOptions.transaction, transaction);
    assert.equal(auditOptions.transaction, transaction);
    assert.equal(auditValues.action, 'REQUEST_APPROVED');
    assert.equal(transaction.committed, true);
    assert.equal(transaction.rolledBack, false);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    AuditLog.create = originals.auditCreate;
  }
});

test('approving an asset issue request reserves stock and records the movement atomically', async () => {
  const originals = {
    findByPk: Approval.findByPk,
    transaction: sequelize.transaction,
    inventoryFindOne: Inventory.findOne,
    movementCreate: AssetMovement.create,
    auditCreate: AuditLog.create,
  };
  const record = { ...approvalRecord({ departmentId: 12, assetId: 3 }), type: 'asset_issue', quantity: 2 };
  const inventory = {
    availableQuantity: 5,
    reservedQuantity: 1,
    async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  let movementValues;
  let auditValues;
  Approval.findByPk = async () => record;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async (options) => { assert.equal(options.transaction, transaction); return inventory; };
  AssetMovement.create = async (values, options) => { movementValues = values; assert.equal(options.transaction, transaction); };
  AuditLog.create = async (values, options) => { auditValues = values; assert.equal(options.transaction, transaction); };
  try {
    const response = makeResponse();
    await decideApproval(storeRequest(), response, (error) => { throw error; });
    assert.equal(response.statusCode, 200);
    assert.equal(inventory.availableQuantity, 3);
    assert.equal(inventory.reservedQuantity, 3);
    assert.equal(movementValues.movementType, 'reserved');
    assert.equal(movementValues.referenceId, record.id);
    assert.deepEqual(JSON.parse(auditValues.details).reservation, {
      action: 'reserved',
      quantity: 2,
      before: { availableQuantity: 5, reservedQuantity: 1 },
      after: { availableQuantity: 3, reservedQuantity: 3 },
    });
    assert.equal(transaction.committed, true);
    assert.equal(transaction.rolledBack, false);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.inventoryFindOne;
    AssetMovement.create = originals.movementCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('approval refuses an asset issue request when inventory is insufficient', async () => {
  const originals = {
    findByPk: Approval.findByPk,
    transaction: sequelize.transaction,
    inventoryFindOne: Inventory.findOne,
    movementCreate: AssetMovement.create,
  };
  const record = { ...approvalRecord({ departmentId: 12, assetId: 3 }), type: 'asset_issue', quantity: 3 };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  Approval.findByPk = async () => record;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => ({ availableQuantity: 2, reservedQuantity: 0 });
  AssetMovement.create = async () => assert.fail('no reservation movement should be recorded');
  try {
    const response = makeResponse();
    await decideApproval(storeRequest(), response, (error) => { throw error; });
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.message, 'Insufficient available inventory to approve this request');
    assert.equal(transaction.rolledBack, true);
    assert.equal(transaction.committed, false);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.inventoryFindOne;
    AssetMovement.create = originals.movementCreate;
  }
});

test('cancelling an unfulfilled approved asset issue releases its reservation once', async () => {
  const originals = {
    findByPk: Approval.findByPk,
    transaction: sequelize.transaction,
    inventoryFindOne: Inventory.findOne,
    movementCreate: AssetMovement.create,
    auditCreate: AuditLog.create,
  };
  const record = { ...approvalRecord({ departmentId: 12, assetId: 3 }), type: 'asset_issue', status: 'approved', requestedBy: 9, quantity: 2, fulfilledAt: null };
  const inventory = {
    availableQuantity: 2,
    reservedQuantity: 2,
    async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  let movementValues;
  let auditValues;
  Approval.findByPk = async () => record;
  sequelize.transaction = async () => transaction;
  Inventory.findOne = async () => inventory;
  AssetMovement.create = async (values, options) => { movementValues = values; assert.equal(options.transaction, transaction); };
  AuditLog.create = async (values) => { auditValues = values; };
  try {
    const response = makeResponse();
    await decideApproval(storeRequest({ body: { status: 'cancelled', reason: 'No longer needed' } }), response, (error) => { throw error; });
    assert.equal(response.statusCode, 200);
    assert.equal(inventory.availableQuantity, 4);
    assert.equal(inventory.reservedQuantity, 0);
    assert.equal(movementValues.movementType, 'released');
    assert.equal(movementValues.referenceId, record.id);
    assert.equal(JSON.parse(auditValues.details).beforeStatus, 'approved');
    assert.equal(transaction.committed, true);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    Inventory.findOne = originals.inventoryFindOne;
    AssetMovement.create = originals.movementCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('Store Manager request creation requires and resolves asset and department within own College', async (context) => {
  const originals = {
    assetFindByPk: Asset.findByPk,
    departmentFindByPk: Department.findByPk,
    approvalCreate: Approval.create,
    auditCreate: AuditLog.create,
  };
  const createdValues = [];
  Asset.findByPk = async (id) => Number(id) === 3 ? { id: 3, collegeId: 1, name: 'Asset' } : { id: Number(id), collegeId: 2, name: 'Foreign asset' };
  Department.findByPk = async (id) => Number(id) === 12 ? { id: 12, collegeId: 1 } : { id: Number(id), collegeId: 2 };
  Approval.create = async (values) => {
    createdValues.push(values);
    return { ...values, id: 81, status: 'pending', toJSON() { return { ...this }; } };
  };
  AuditLog.create = async () => {};
  try {
    await context.test('creates a request using the validated College department', async () => {
      const response = makeResponse();
      await createApproval(storeRequest({ body: { type: 'asset_issue', asset_id: 3, department_id: 12, quantity: 1, reason: 'Need equipment' } }), response, (error) => { throw error; });
      assert.equal(response.statusCode, 201);
      assert.equal(createdValues[0].assetId, 3);
      assert.equal(createdValues[0].departmentId, 12);
    });

    await context.test('rejects a cross-College asset without creating a request', async () => {
      const response = makeResponse();
      await createApproval(storeRequest({ body: { type: 'asset_issue', asset_id: 4, department_id: 12, quantity: 1, reason: 'Need equipment' } }), response, (error) => { throw error; });
      assert.equal(response.statusCode, 404);
      assert.equal(createdValues.length, 1);
    });

    await context.test('rejects a cross-College department without creating a request', async () => {
      const response = makeResponse();
      await createApproval(storeRequest({ body: { type: 'asset_issue', asset_id: 3, department_id: 24, quantity: 1, reason: 'Need equipment' } }), response, (error) => { throw error; });
      assert.equal(response.statusCode, 404);
      assert.equal(createdValues.length, 1);
    });
  } finally {
    Asset.findByPk = originals.assetFindByPk;
    Department.findByPk = originals.departmentFindByPk;
    Approval.create = originals.approvalCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('audit failure rolls back the approval decision', async () => {
  const originals = { findByPk: Approval.findByPk, transaction: sequelize.transaction, auditCreate: AuditLog.create };
  const record = approvalRecord();
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  const auditFailure = new Error('audit unavailable');
  Approval.findByPk = async () => record;
  sequelize.transaction = async () => transaction;
  AuditLog.create = async () => { throw auditFailure; };
  try {
    let forwardedError;
    await decideApproval(storeRequest(), makeResponse(), (error) => { forwardedError = error; });
    assert.equal(forwardedError, auditFailure);
    assert.equal(transaction.committed, false);
    assert.equal(transaction.rolledBack, true);
  } finally {
    Approval.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    AuditLog.create = originals.auditCreate;
  }
});

test('approval list, detail, and decision routes resolve store-manager College scope', () => {
  assert.match(routeSource, /const resolveStoreManagerCollegeScope = .*resolveCollegeScope/);
  assert.match(routeSource, /router\.get\('\/', requireAuth, resolveStoreManagerCollegeScope, listApprovals\)/);
  assert.match(routeSource, /router\.post\('\/', requireAuth, resolveStoreManagerCollegeScope, createApproval\)/);
  assert.match(routeSource, /router\.get\('\/:id', requireAuth, resolveStoreManagerCollegeScope, getApprovalById\)/);
  assert.match(routeSource, /router\.patch\('\/:id', requireAuth, resolveStoreManagerCollegeScope, decideApproval\)/);
});