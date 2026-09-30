const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const models = require('../models');
const notificationService = require('../services/notificationService');

notificationService.createBulkNotification = async () => {};

const { sequelize, Approval, Asset, Department, AuditLog } = models;
const { listApprovals, getApprovalById, decideApproval } = require('../controllers/approvalController');
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
  assert.match(routeSource, /router\.get\('\/:id', requireAuth, resolveStoreManagerCollegeScope, getApprovalById\)/);
  assert.match(routeSource, /router\.patch\('\/:id', requireAuth, resolveStoreManagerCollegeScope, decideApproval\)/);
});