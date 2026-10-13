const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Op } = require('sequelize');
const { sequelize, Approval, Asset, Department, AuditLog, User } = require('../models');
const notifications = require('../services/notificationService');
const originalBulkNotification = notifications.createBulkNotification;
const originalEventNotification = notifications.createEventNotification;
notifications.createBulkNotification = async () => {};
notifications.createEventNotification = async () => {};
const { createApproval } = require('../controllers/approvalController');
const { getCollegeApprovalOptions, listCollegeRequests } = require('../controllers/workspaceRequestController');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');
after(() => {
  notifications.createBulkNotification = originalBulkNotification;
  notifications.createEventNotification = originalEventNotification;
});
const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('college approval create and options routes are manager-only and permission-gated', () => {
  assert.match(routeSource, /router\.get\('\/approvals\/options', requireRole\('college_manager'\), requirePermission\('college\.requests\.create'\), getCollegeApprovalOptions\)/);
  assert.match(routeSource, /router\.post\('\/approvals', requireRole\('college_manager'\), requirePermission\('college\.requests\.create'\), createApproval\)/);
  assert.equal(DEFAULT_ROLE_PERMISSIONS.college.includes('college.requests.create'), false);
  assert.ok(DEFAULT_ROLE_PERMISSIONS.college_manager.includes('college.requests.create'));
});

test('approval options and request creation use only the authenticated college scope', async (t) => {
  const originals = {
    departmentFindAll: Department.findAll,
    assetFindAll: Asset.findAll,
    assetFindByPk: Asset.findByPk,
    departmentFindByPk: Department.findByPk,
    approvalCreate: Approval.create,
    auditCreate: AuditLog.create,
    userFindByPk: User.findByPk,
    userFindAll: User.findAll,
    transaction: sequelize.transaction,
    bulkNotification: notifications.createBulkNotification,
    eventNotification: notifications.createEventNotification,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: async () => { transaction.finished = 'commit'; }, rollback: async () => { transaction.finished = 'rollback'; } };
  let saved;
  let scopeWhere;
  let departmentsWhere;
  Department.findAll = async ({ where }) => { departmentsWhere = where; return [{ id: 12, name: 'Physics', code: 'PHY' }]; };
  Asset.findAll = async ({ where }) => { scopeWhere = where; return [{ id: 3, assetCode: 'A-3', name: 'Microscope', category: 'Lab' }]; };
  Asset.findByPk = async () => null;
  Department.findByPk = async (id, { transaction: passedTransaction } = {}) => Number(id) === 12 && passedTransaction ? { id: 12, collegeId: 4, status: 'active' } : null;
  Approval.create = async (values) => { saved = values; return { id: 61, status: 'pending', ...values, toJSON() { return { id: this.id, ...values }; } }; };
  AuditLog.create = async () => {};
  User.findByPk = async () => null;
  User.findAll = async () => [];
  sequelize.transaction = async () => transaction;
  notifications.createBulkNotification = async () => {};
  notifications.createEventNotification = async () => {};
  t.after(() => {
    Department.findAll = originals.departmentFindAll;
    Asset.findAll = originals.assetFindAll;
    Asset.findByPk = originals.assetFindByPk;
    Department.findByPk = originals.departmentFindByPk;
    Approval.create = originals.approvalCreate;
    AuditLog.create = originals.auditCreate;
    User.findByPk = originals.userFindByPk;
    User.findAll = originals.userFindAll;
    sequelize.transaction = originals.transaction;
    notifications.createBulkNotification = originals.bulkNotification;
    notifications.createEventNotification = originals.eventNotification;
  });

  const optionsResponse = makeResponse();
  await getCollegeApprovalOptions({ organizationScope: { collegeId: 4 } }, optionsResponse, (error) => { throw error; });
  assert.equal(optionsResponse.payload.data.departments[0].id, 12);
  assert.equal(optionsResponse.payload.data.assets[0].id, 3);
  assert.equal(departmentsWhere.collegeId, 4);
  assert.equal(scopeWhere.collegeId, 4);

  const response = makeResponse();
  await createApproval({
    user: { id: 8, role: 'college_manager', collegeId: 4, departmentId: 99 },
    organizationScope: { collegeId: 4 },
    body: { type: 'other', item: 'Physics lab equipment', department_id: 12, quantity: 1, priority: 'normal', reason: 'Needed for instruction' },
  }, response, (error) => { throw error; });
  assert.equal(response.statusCode, 201);
  assert.equal(saved.requestedBy, 8);
  assert.equal(saved.departmentId, 12);
  assert.equal(Approval.getAttributes().status.defaultValue, 'pending');
  assert.equal(saved.item, 'Physics lab equipment');
  assert.equal(transaction.finished, 'commit');
});

test('college manager approval creation rejects missing department and foreign department references', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    departmentFindByPk: Department.findByPk,
    auditCreate: AuditLog.create,
    approvalCreate: Approval.create,
  };
  let createdCount = 0;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} };
  sequelize.transaction = async () => transaction;
  Department.findByPk = async (id) => Number(id) === 12 ? { id: 12, collegeId: 9, status: 'active' } : null;
  Approval.create = async () => { createdCount += 1; };
  AuditLog.create = async () => {};
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Department.findByPk = originals.departmentFindByPk;
    Approval.create = originals.approvalCreate;
    AuditLog.create = originals.auditCreate;
  });
  const req = { user: { id: 8, role: 'college_manager', collegeId: 4 }, organizationScope: { collegeId: 4 }, body: { type: 'other', item: 'Equipment', quantity: 1, reason: 'Needed' } };
  const missingDepartment = makeResponse();
  await createApproval(req, missingDepartment, (error) => { throw error; });
  assert.equal(missingDepartment.statusCode, 400);
  req.body.department_id = 12;
  const foreignDepartment = makeResponse();
  await createApproval(req, foreignDepartment, (error) => { throw error; });
  assert.equal(foreignDepartment.statusCode, 404);
  assert.equal(createdCount, 0);
});

test('college approval list scopes both linked references and summarizes all scoped records', async (t) => {
  const originals = {
    departmentFindAll: Department.findAll,
    assetFindAll: Asset.findAll,
    findAndCountAll: Approval.findAndCountAll,
    count: Approval.count,
    findAll: Approval.findAll,
  };
  let listOptions;
  let assetScope;
  const countQueries = [];
  Department.findAll = async () => [{ id: 14, name: 'Physics', code: 'PHY' }];
  Asset.findAll = async (options) => { assetScope = options.where; return [{ id: 8 }]; };
  Approval.findAndCountAll = async (options) => { listOptions = options; return { rows: [], count: 1 }; };
  Approval.count = async (options) => {
    countQueries.push(options);
    return options.where.status === 'pending' ? 2 : options.where.status === 'approved' ? 1 : options.where.status === 'rejected' ? 1 : options.where.status === 'cancelled' ? 0 : 4;
  };
  Approval.findAll = async () => [{ type: 'other', priority: 'normal' }];
  t.after(() => {
    Department.findAll = originals.departmentFindAll;
    Asset.findAll = originals.assetFindAll;
    Approval.findAndCountAll = originals.findAndCountAll;
    Approval.count = originals.count;
    Approval.findAll = originals.findAll;
  });

  const response = makeResponse();
  await listCollegeRequests({ organizationScope: { collegeId: 4 }, query: { page: '2', limit: '1', status: 'approved', departmentId: '14', requestType: 'other', priority: 'normal' } }, response, (error) => { throw error; });
  assert.equal(response.payload.data.summary.total, 4);
  assert.equal(response.payload.data.summary.pending, 2);
  assert.equal(response.payload.data.summary.approved, 1);
  assert.equal(response.payload.data.pagination.page, 2);
  assert.equal(listOptions.where.status, 'approved');
  assert.equal(listOptions.where.type, 'other');
  assert.ok(Array.isArray(listOptions.where[Op.and]));
  const collegeConstraints = listOptions.where[Op.and][0][Op.and];
  assert.equal(collegeConstraints.length, 3);
  assert.deepEqual(collegeConstraints[0][Op.or][0].departmentId[Op.in], [14]);
  assert.deepEqual(collegeConstraints[1][Op.or][0].assetId[Op.in], [8]);
  assert.equal(assetScope[Op.or].length, 2);
  assert.equal(countQueries.length, 5);
});
