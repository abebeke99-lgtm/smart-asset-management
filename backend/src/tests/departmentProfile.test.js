const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, User, Department } = require('../models');
const { resolveConfiguredDepartmentScope } = require('../middlewares/organizationScope');
const departmentRoutes = require('../routes/departmentRoutes');
const { getDepartmentProfile } = require('../controllers/departmentController');
const { listDepartmentStaff } = require('../controllers/departmentController');

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

test('department head profile returns scoped department details and database summary counts', async (t) => {
  const originalFindByPk = Department.findByPk;
  const originalUserCount = User.count;
  const originalAssetCount = Asset.count;
  const department = {
    id: 3,
    name: 'Engineering',
    code: 'ENG',
    description: 'Engineering Department',
    headId: 10,
    collegeId: 1,
    locationId: 2,
    phone: '55512345',
    email: 'engineering@example.test',
    status: 'active',
    College: { id: 1, collegeName: 'Engineering College' },
    Head: { id: 10, fullName: 'Department Head' },
    LocationRecord: { id: 2, name: 'Main Office' },
  };
  let departmentLookupId;
  let staffCountDepartmentId;
  let assetCountDepartmentId;
  Department.findByPk = async (id) => {
    departmentLookupId = id;
    return department;
  };
  User.count = async ({ where }) => {
    staffCountDepartmentId = where.departmentId;
    return 7;
  };
  Asset.count = async ({ where }) => {
    assetCountDepartmentId = where.departmentId;
    return 12;
  };
  t.after(() => {
    Department.findByPk = originalFindByPk;
    User.count = originalUserCount;
    Asset.count = originalAssetCount;
  });

  const req = { organizationScope: { departmentId: 3 }, user: { departmentId: 999 } };
  const res = makeResponse();
  let nextError;
  await getDepartmentProfile(req, res, (error) => { nextError = error; });

  assert.equal(nextError, undefined);
  assert.equal(departmentLookupId, 3);
  assert.equal(staffCountDepartmentId, 3);
  assert.equal(assetCountDepartmentId, 3);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.data.name, 'Engineering');
  assert.equal(res.payload.data.college.collegeName, 'Engineering College');
  assert.equal(res.payload.data.office, 'Main Office');
  assert.deepEqual(res.payload.data.summary, { totalStaff: 7, totalAssets: 12 });
});

test('department head profile reads require an existing authenticated department scope', async (t) => {
  const originalFindByPk = Department.findByPk;
  let lookupId;
  Department.findByPk = async (id) => {
    lookupId = id;
    return { id: 3, collegeId: 1 };
  };
  t.after(() => { Department.findByPk = originalFindByPk; });

  const req = { user: { role: 'department_head', departmentId: 3 }, params: { id: 1 }, query: { departmentId: 1 } };
  const res = makeResponse();
  let nextCalled = false;
  await resolveConfiguredDepartmentScope(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(lookupId, 3);
  assert.equal(req.organizationScope.departmentId, 3);
  assert.equal(req.organizationScope.collegeId, 1);
});

test('department head profile reads reject missing and nonexistent department scope', async (t) => {
  const originalFindByPk = Department.findByPk;
  t.after(() => { Department.findByPk = originalFindByPk; });

  const missingIdResponse = makeResponse();
  let databaseLookups = 0;
  Department.findByPk = async () => {
    databaseLookups += 1;
    return null;
  };
  await resolveConfiguredDepartmentScope({ user: { role: 'department_head' } }, missingIdResponse, () => {
    assert.fail('A missing department scope must not pass middleware');
  });
  assert.equal(missingIdResponse.statusCode, 403);

  const nonexistentResponse = makeResponse();
  await resolveConfiguredDepartmentScope({ user: { role: 'department_head', departmentId: 999 } }, nonexistentResponse, () => {
    assert.fail('A nonexistent department scope must not pass middleware');
  });
  assert.equal(nonexistentResponse.statusCode, 403);
  assert.equal(databaseLookups, 1);
});

test('the existing department list and detail endpoints enforce configured department scope', () => {
  const scopedGetRoutes = departmentRoutes.stack
    .filter((layer) => layer.route?.methods.get && ['/', '/stats', '/:id'].includes(layer.route.path))
    .map((layer) => layer.route);

  assert.equal(scopedGetRoutes.length, 3);
  for (const route of scopedGetRoutes) {
    assert.ok(route.stack.some((layer) => layer.handle === resolveConfiguredDepartmentScope));
  }
});

test('department staff listing searches and filters only the authenticated department records', async (t) => {
  const originals = {
    findAndCountAll: User.findAndCountAll,
    findAll: User.findAll,
    count: User.count,
  };
  let staffQuery;
  const countQueries = [];
  User.findAndCountAll = async (options) => {
    staffQuery = options;
    return { count: 1, rows: [{ id: 22, fullName: 'Department Lecturer', role: 'staff' }] };
  };
  User.findAll = async () => [{ role: 'staff' }, { role: 'teaching_assistant' }];
  User.count = async ({ where }) => {
    countQueries.push(where);
    if (where.active === true) return 5;
    if (where[Op.or]) return 2;
    return 7;
  };
  t.after(() => {
    User.findAndCountAll = originals.findAndCountAll;
    User.findAll = originals.findAll;
    User.count = originals.count;
  });

  const res = makeResponse();
  await listDepartmentStaff({
    organizationScope: { departmentId: 7, collegeId: 2 },
    query: { departmentId: 99, search: 'lecturer', position: 'staff', status: 'inactive', page: '1', limit: '25' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(staffQuery.where.departmentId, 7);
  assert.equal(staffQuery.where.role, 'staff');
  assert.equal(staffQuery.where[Op.and][0][Op.or][0].active, false);
  assert.equal(staffQuery.where[Op.and][0][Op.or][1].status[Op.ne], 'active');
  assert.ok(staffQuery.where[Op.or].some((field) => field.fullName));
  assert.equal(staffQuery.attributes.includes('password'), false);
  assert.deepEqual(countQueries.map((where) => where.departmentId), [7, 7, 7]);
  assert.deepEqual(res.payload.summary, { total: 7, active: 5, inactive: 2 });
  assert.deepEqual(res.payload.filters.positions, ['staff', 'teaching_assistant']);
  assert.equal(res.payload.data[0].fullName, 'Department Lecturer');
});

test('department staff endpoint rejects missing scope and is behind department-head authentication and scope middleware', async (t) => {
  const res = makeResponse();
  await listDepartmentStaff({ organizationScope: {}, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);

  const staffRoute = require('../routes/departmentWorkspaceRoutes').stack
    .find((layer) => layer.route?.path === '/staff' && layer.route.methods.get);
  assert.ok(staffRoute);
  const { requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
  const workspaceRouter = require('../routes/departmentWorkspaceRoutes');
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(workspaceRouter.stack.some((layer) => layer.handle === middleware));
  }
});
