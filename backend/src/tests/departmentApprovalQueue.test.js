const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const models = require('../models');
const { decideApproval, getApprovalReview } = require('../controllers/departmentAssetRequestController');
const { requirePermission, requireRole } = require('../middlewares/auth');

const { sequelize, DepartmentAssetRequest, DepartmentAssetRequestHistory, AuditLog } = models;
const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/departmentWorkspaceRoutes.js'), 'utf8');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeRequest = (decision, overrides = {}) => ({
  user: { id: 7, role: 'department_head', permissions: ['department_head.approvals.review', `department_head.approvals.${decision === 'request-changes' ? 'request_changes' : decision}`] },
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
    assert.equal(JSON.parse(auditValues.details).role, 'department_head');
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

test('approval routes authenticate, department-scope, and enforce action-specific permissions', () => {
  assert.match(routeSource, /router\.use\(\.\.\.requireDepartmentHead, resolveDepartmentScope\)/);
  for (const [method, routePath, permission] of [
    ['get', '/approvals', 'department_head.approvals.review'],
    ['get', '/approvals/:id', 'department_head.approvals.review'],
    ['post', '/approvals/:id/approve', 'department_head.approvals.approve'],
    ['post', '/approvals/:id/reject', 'department_head.approvals.reject'],
    ['post', '/approvals/:id/request-changes', 'department_head.approvals.request_changes'],
    ['post', '/approvals/:id/escalate', 'department_head.approvals.escalate'],
  ]) {
    assert.ok(routeSource.includes(`router.${method}('${routePath}'`));
    const routeRegistration = routeSource.match(new RegExp(`router\\.${method}\\('${routePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}', ([^\\n]+)`));
    assert.ok(routeRegistration);
    assert.match(routeRegistration[1], new RegExp(`requirePermission\\('${permission.replace(/\./g, '\\.')}'\\)`));
  }
});

test('approval queue uses authenticated department scope, authoritative summary, filters, and server pagination', async (t) => {
  const originals = {
    findAndCountAll: DepartmentAssetRequest.findAndCountAll,
    findAll: DepartmentAssetRequest.findAll,
    auditCreate: AuditLog.create,
  };
  let query;
  let audit;
  DepartmentAssetRequest.findAndCountAll = async (options) => {
    query = options;
    return {
      rows: [{
        toJSON: () => ({
          id: 25,
          requestCode: 'AR-2026-25',
          status: 'Approved',
          category: 'Equipment',
          AssetRecord: {
            id: 51,
            name: 'Microscope',
            AssetDocuments: [{
              id: 3,
              originalName: 'specification.pdf',
              filePath: 'uploads/private/specification.pdf',
              mimeType: 'application/pdf',
              description: 'Product specification',
              createdAt: '2026-01-01T00:00:00.000Z',
            }],
          },
          History: [],
        }),
      }],
      count: 21,
    };
  };
  DepartmentAssetRequest.findAll = async (options) => {
    assert.equal(options.where.departmentId, 12);
    if (options.attributes.includes('category')) return [{ category: 'Equipment' }];
    return [
      { status: 'Submitted', count: '1' },
      { status: 'Under Review', count: '1' },
      { status: 'Approved', count: '1' },
      { status: 'Rejected', count: '1' },
    ];
  };
  AuditLog.create = async (values) => { audit = values; };
  t.after(() => {
    DepartmentAssetRequest.findAndCountAll = originals.findAndCountAll;
    DepartmentAssetRequest.findAll = originals.findAll;
    AuditLog.create = originals.auditCreate;
  });

  const response = makeResponse();
  await require('../controllers/departmentAssetRequestController').listApprovalQueue({
    user: { id: 7 },
    organizationScope: { departmentId: 12 },
    query: { page: '2', limit: '5', status: 'Pending', priority: 'high', requestType: 'Equipment', search: 'Requester', dateFrom: '2026-01-01', dateTo: '2026-01-31', departmentId: '99' },
  }, response, (error) => { throw error; });

  assert.equal(query.where.departmentId, 12);
  assert.deepEqual(query.where.status[Op.in], ['Submitted', 'Under Review']);
  assert.equal(query.where.priority, 'high');
  assert.equal(query.where.category, 'Equipment');
  assert.ok(query.where[Op.or].some((condition) => condition['$Requester.fullName$']));
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.equal(response.body.pagination.total, 21);
  assert.equal(response.body.summary.total, 4);
  assert.equal(response.body.summary.Submitted, 1);
  assert.equal(response.body.summary['Under Review'], 1);
  assert.deepEqual(response.body.filters.requestTypes, ['Equipment']);
  assert.deepEqual(response.body.data[0].supportingDocuments, [{
    id: 3,
    assetId: 51,
    name: 'specification.pdf',
    mimeType: 'application/pdf',
    description: 'Product specification',
    createdAt: '2026-01-01T00:00:00.000Z',
  }]);
  assert.equal('AssetRecord' in response.body.data[0], false);
  assert.equal(JSON.stringify(response.body.data).includes('uploads/private'), false);
  assert.equal(audit.userId, 7);
  assert.match(audit.details, /"departmentId":12/);
});

test('approval queue rejects invalid filters and never accepts caller-selected department scope', async (t) => {
  const original = DepartmentAssetRequest.findAndCountAll;
  let queried = false;
  DepartmentAssetRequest.findAndCountAll = async () => { queried = true; throw new Error('unexpected database query'); };
  t.after(() => { DepartmentAssetRequest.findAndCountAll = original; });

  const response = makeResponse();
  await require('../controllers/departmentAssetRequestController').listApprovalQueue({
    user: { id: 7 },
    organizationScope: { departmentId: 12 },
    query: { status: 'Imaginary', departmentId: '99' },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 400);
  assert.equal(queried, false);
});

test('approval detail and decisions do not expose requests from another department or finalized states', async (t) => {
  const originals = {
    findOne: DepartmentAssetRequest.findOne,
    transaction: sequelize.transaction,
  };
  let detailWhere;
  let decisionWhere;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, async rollback() { this.finished = 'rollback'; } };
  DepartmentAssetRequest.findOne = async (options) => {
    if (options.transaction) decisionWhere = options.where;
    else detailWhere = options.where;
    return null;
  };
  sequelize.transaction = async () => transaction;
  t.after(() => {
    DepartmentAssetRequest.findOne = originals.findOne;
    sequelize.transaction = originals.transaction;
  });

  const detailResponse = makeResponse();
  await getApprovalReview(makeRequest('approve'), detailResponse, (error) => { throw error; });
  assert.equal(detailResponse.statusCode, 404);
  assert.deepEqual(detailWhere, { id: 25, departmentId: 12 });

  const decisionResponse = makeResponse();
  await decideApproval(makeRequest('approve'), decisionResponse, (error) => { throw error; });
  assert.equal(decisionResponse.statusCode, 404);
  assert.deepEqual(decisionWhere.departmentId, 12);
  assert.deepEqual(decisionWhere.status[Op.in], ['Submitted', 'Under Review']);
  assert.equal(transaction.finished, 'rollback');
});

test('approval permissions reject unauthorized users server-side', () => {
  const makePermissionResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });
  const reject = requirePermission('department_head.approvals.approve');
  const deniedResponse = makePermissionResponse();
  let deniedNext = false;
  reject({ user: { role: 'department_head', permissions: ['department_head.approvals.review'] } }, deniedResponse, () => { deniedNext = true; });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(deniedNext, false);

  const allowedResponse = makePermissionResponse();
  let allowedNext = false;
  reject({ user: { role: 'department_head', permissions: ['department_head.approvals.approve'] } }, allowedResponse, () => { allowedNext = true; });
  assert.equal(allowedNext, true);

  const roleGate = requireRole('department_head');
  const otherRoleResponse = makePermissionResponse();
  let otherRoleNext = false;
  roleGate({ user: { id: 14, role: 'ict_officer' } }, otherRoleResponse, () => { otherRoleNext = true; });
  assert.equal(otherRoleResponse.statusCode, 403);
  assert.equal(otherRoleNext, false);
});

test('approval action comment input is type- and length-validated before starting a transaction', async (t) => {
  const originalTransaction = sequelize.transaction;
  let transactionCalls = 0;
  sequelize.transaction = async () => { transactionCalls += 1; throw new Error('Should not start transaction'); };
  t.after(() => { sequelize.transaction = originalTransaction; });

  for (const body of [{ reason: { text: 'invalid' } }, { reason: 'x'.repeat(1001) }]) {
    const response = makeResponse();
    await decideApproval(makeRequest('approve', { body }), response, (error) => { throw error; });
    assert.equal(response.statusCode, 422);
  }
  assert.equal(transactionCalls, 0);
});
