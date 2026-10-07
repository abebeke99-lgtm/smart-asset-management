const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const models = require('../models');
const { decideApproval, getApprovalReview } = require('../controllers/departmentAssetRequestController');

const { sequelize, DepartmentAssetRequest, DepartmentAssetRequestHistory, AuditLog } = models;
const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/departmentWorkspaceRoutes.js'), 'utf8');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeRequest = (decision, overrides = {}) => ({
  user: { id: 7, permissions: ['department_head.approvals.review', `department_head.approvals.${decision === 'request-changes' ? 'request_changes' : decision}`] },
  organizationScope: { departmentId: 12, collegeId: 2 },
  params: { id: '25' },
  approvalDecision: decision,
  body: decision === 'approve' ? {} : { reason: 'Reviewed for this decision' },
  ...overrides,
});

const makeApprovalRecord = () => ({
  id: 25,
  requestedBy: 42,
  status: 'Submitted',
  async update(values, options) { Object.assign(this, values); this.updateOptions = options; },
  toJSON() { return { id: this.id, requestedBy: this.requestedBy, status: this.status }; },
});

test('approval decisions map named actions to statuses and atomically write history and audit', async (t) => {
  const original = {
    transaction: sequelize.transaction,
    findOne: DepartmentAssetRequest.findOne,
    historyCreate: DepartmentAssetRequestHistory.create,
    auditCreate: AuditLog.create,
  };
  const expected = [
    ['approve', 'Approved', 'APPROVAL_REQUEST_APPROVED'],
    ['reject', 'Rejected', 'APPROVAL_REQUEST_REJECTED'],
    ['request-changes', 'Changes Requested', 'APPROVAL_CHANGES_REQUESTED'],
    ['escalate', 'Escalated', 'APPROVAL_ESCALATED_TO_COLLEGE'],
  ];
  t.after(() => {
    sequelize.transaction = original.transaction;
    DepartmentAssetRequest.findOne = original.findOne;
    DepartmentAssetRequestHistory.create = original.historyCreate;
    AuditLog.create = original.auditCreate;
  });

  for (const [decision, status, auditAction] of expected) {
    const record = makeApprovalRecord();
    const transaction = { LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
    let historyValues;
    let historyOptions;
    let auditValues;
    let auditOptions;
    sequelize.transaction = async () => transaction;
    DepartmentAssetRequest.findOne = async (options) => {
      assert.equal(options.where.departmentId, 12);
      return record;
    };
    DepartmentAssetRequestHistory.create = async (values, options) => { historyValues = values; historyOptions = options; };
    AuditLog.create = async (values, options) => { auditValues = values; auditOptions = options; };
    const response = makeResponse();
    await decideApproval(makeRequest(decision), response, (error) => { throw error; });

    assert.equal(response.statusCode, 200);
    assert.equal(record.status, status);
    assert.equal(record.updateOptions.transaction, transaction);
    assert.equal(historyValues.previousStatus, 'Submitted');
    assert.equal(historyValues.newStatus, status);
    assert.equal(historyOptions.transaction, transaction);
    assert.equal(auditValues.action, auditAction);
    assert.equal(auditOptions.transaction, transaction);
    assert.equal(transaction.committed, true);
    assert.equal(transaction.rolledBack, false);
  }
});

test('invalid action requests require a reason and do not change status', async (t) => {
  const originalTransaction = sequelize.transaction;
  let transactionCalls = 0;
  sequelize.transaction = async () => { transactionCalls += 1; throw new Error('Should not start transaction'); };
  t.after(() => { sequelize.transaction = originalTransaction; });

  const response = makeResponse();
  await decideApproval(makeRequest('reject', { body: { reason: '   ' } }), response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /reason is required/i);
  assert.equal(transactionCalls, 0);
});

test('invalid request IDs are rejected before database access', async (t) => {
  const originalTransaction = sequelize.transaction;
  const originalFindOne = DepartmentAssetRequest.findOne;
  let databaseCalls = 0;
  sequelize.transaction = async () => { databaseCalls += 1; throw new Error('Should not start transaction'); };
  DepartmentAssetRequest.findOne = async () => { databaseCalls += 1; throw new Error('Should not query request'); };
  t.after(() => {
    sequelize.transaction = originalTransaction;
    DepartmentAssetRequest.findOne = originalFindOne;
  });

  const response = makeResponse();
  await decideApproval(makeRequest('approve', { params: { id: '25invalid' } }), response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /invalid approval request id/i);
  assert.equal(databaseCalls, 0);

  const reviewResponse = makeResponse();
  await getApprovalReview(makeRequest('approve', { params: { id: '0' } }), reviewResponse, (error) => { throw error; });
  assert.equal(reviewResponse.statusCode, 400);
  assert.match(reviewResponse.body.message, /invalid approval request id/i);
  assert.equal(databaseCalls, 0);
});

test('approval routes authenticate and department-scope without optional permission-matrix entries', () => {
  assert.match(routeSource, /router\.use\(\.\.\.requireDepartmentHead, resolveDepartmentScope\)/);
  for (const [method, routePath] of [
    ['get', '/approvals'],
    ['get', '/approvals/:id'],
    ['post', '/approvals/:id/approve'],
    ['post', '/approvals/:id/reject'],
    ['post', '/approvals/:id/request-changes'],
    ['post', '/approvals/:id/escalate'],
  ]) {
    assert.ok(routeSource.includes(`router.${method}('${routePath}'`));
    const routeRegistration = routeSource.match(new RegExp(`router\\.${method}\\('${routePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}', ([^\\n]+)`));
    assert.ok(routeRegistration);
    assert.doesNotMatch(routeRegistration[1], /requirePermission/);
  }
});
