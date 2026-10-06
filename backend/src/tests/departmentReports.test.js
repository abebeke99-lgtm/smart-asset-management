const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, Assignment, Approval, Maintenance, User } = require('../models');
const { getDepartmentReports } = require('../controllers/departmentController');

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

test('staff report only selects existing user columns and stays department-scoped', async (t) => {
  const originalFindAndCountAll = User.findAndCountAll;
  const originalAssignmentsFindAll = Assignment.findAll;
  let userQuery;
  User.findAndCountAll = async (options) => {
    userQuery = options;
    return { count: 0, rows: [] };
  };
  Assignment.findAll = async () => [];
  t.after(() => {
    User.findAndCountAll = originalFindAndCountAll;
    Assignment.findAll = originalAssignmentsFindAll;
  });

  const res = makeResponse();
  await getDepartmentReports({
    organizationScope: { departmentId: 3, collegeId: 1 },
    query: { reportType: 'staff' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(userQuery.where, { departmentId: 3 });
  assert.deepEqual(userQuery.attributes, ['id', 'fullName', 'username', 'email', 'role', 'active', 'departmentId', 'createdAt']);
  assert.equal(userQuery.attributes.includes('status'), false);
});

test('approvals report filters by department and includes the requester without college_id', async (t) => {
  const originalFindAndCountAll = Approval.findAndCountAll;
  let approvalQuery;
  Approval.findAndCountAll = async (options) => {
    approvalQuery = options;
    return { count: 0, rows: [] };
  };
  t.after(() => { Approval.findAndCountAll = originalFindAndCountAll; });

  const res = makeResponse();
  await getDepartmentReports({
    organizationScope: { departmentId: 3, collegeId: 1 },
    query: { reportType: 'approvals', dateFrom: '', dateTo: '', status: '' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(approvalQuery.where, { departmentId: 3 });
  assert.equal(approvalQuery.include[0].as, 'Requester');
});

test('maintenance report normalizes status filters and scopes results through the asset department', async (t) => {
  const originalFindAndCountAll = Maintenance.findAndCountAll;
  let maintenanceQuery;
  Maintenance.findAndCountAll = async (options) => {
    maintenanceQuery = options;
    return { count: 0, rows: [] };
  };
  t.after(() => { Maintenance.findAndCountAll = originalFindAndCountAll; });

  const res = makeResponse();
  await getDepartmentReports({
    organizationScope: { departmentId: 3, collegeId: 1 },
    query: { reportType: 'maintenance', status: 'In-Progress' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(maintenanceQuery.where.status[Op.in], ['in-progress', 'in_progress', 'in progress']);
  assert.equal(maintenanceQuery.include[0].where.departmentId, 3);
  assert.equal(maintenanceQuery.include[0].where.collegeId, 1);
});

test('asset report returns dashboard totals and maps In-Use status to persisted status values', async (t) => {
  const originalFindAndCountAll = Asset.findAndCountAll;
  const originalFindAll = Asset.findAll;
  let assetQuery;
  Asset.findAndCountAll = async (options) => {
    assetQuery = options;
    return { count: 0, rows: [] };
  };
  Asset.findAll = async () => [];
  t.after(() => {
    Asset.findAndCountAll = originalFindAndCountAll;
    Asset.findAll = originalFindAll;
  });

  const res = makeResponse();
  await getDepartmentReports({
    organizationScope: { departmentId: 3, collegeId: 1 },
    query: { reportType: 'assets', status: 'In-Use', dateFrom: '', dateTo: '' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(assetQuery.where.status[Op.in], ['in-use', 'assigned', 'issued']);
  assert.deepEqual(assetQuery.include[0].where, {
    departmentId: 3,
    status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] },
  });
  assert.equal(res.payload.totals.totalAssets, 0);
  assert.deepEqual(res.payload.byCategory, []);
  assert.deepEqual(res.payload.byLocation, []);
  assert.deepEqual(res.payload.assets, []);
});

test('employee-filtered asset reports scope assignments and their assets to the department', async (t) => {
  const originalFindAndCountAll = Asset.findAndCountAll;
  const originalAssetFindAll = Asset.findAll;
  const originalAssignmentFindAll = Assignment.findAll;
  let assignmentQuery;
  Asset.findAndCountAll = async () => ({ count: 0, rows: [] });
  Asset.findAll = async () => [];
  Assignment.findAll = async (options) => {
    assignmentQuery = options;
    return [];
  };
  t.after(() => {
    Asset.findAndCountAll = originalFindAndCountAll;
    Asset.findAll = originalAssetFindAll;
    Assignment.findAll = originalAssignmentFindAll;
  });

  const res = makeResponse();
  await getDepartmentReports({
    organizationScope: { departmentId: 3, collegeId: 1 },
    query: { reportType: 'assets', employee: 'Engineering User' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(assignmentQuery.where.departmentId, 3);
  const assetInclude = assignmentQuery.include.find((include) => include.model === Asset);
  assert.deepEqual(assetInclude.where, { departmentId: 3, collegeId: 1 });
  assert.equal(assetInclude.required, true);
});

test('department reports return a clear forbidden response without a valid scope', async () => {
  const res = makeResponse();
  await getDepartmentReports({ organizationScope: {}, query: { reportType: 'assets' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /Department scope is not configured/);
});
