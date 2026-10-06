const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, User, Department, Location } = require('../models');
const { requireDepartmentHead, resolveDepartmentScope, resolveConfiguredDepartmentScope } = require('../middlewares/organizationScope');
const departmentRoutes = require('../routes/departmentRoutes');
const { getDepartmentProfile, updateDepartmentProfile } = require('../controllers/departmentController');
const { listDepartmentStaff } = require('../controllers/departmentController');
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');

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

test('department profile controller only trusts the resolved authenticated department scope', async (t) => {
  const originalFindByPk = Department.findByPk;
  let lookups = 0;
  Department.findByPk = async () => {
    lookups += 1;
    return null;
  };
  t.after(() => { Department.findByPk = originalFindByPk; });

  const res = makeResponse();
  await getDepartmentProfile({
    user: { role: 'department_head', departmentId: 999 },
    params: { departmentId: 3 },
    query: { departmentId: 3 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.equal(lookups, 0);
});

test('department profile update rejects protected fields and invalid editable values', async (t) => {
  const originalFindByPk = Department.findByPk;
  const department = { id: 3, update: async () => assert.fail('Invalid changes must not be persisted') };
  Department.findByPk = async () => department;
  t.after(() => { Department.findByPk = originalFindByPk; });

  for (const body of [
    { departmentId: 99 },
    { name: 'Changed Name' },
    { status: 'inactive' },
    { email: 'not-an-email' },
    { email: 'x'.repeat(250) + '@example.test' },
    { phone: '555' },
    { phone: '.......' },
    { description: 'x'.repeat(2001) },
    { office: { id: 9 } },
    {},
  ]) {
    const res = makeResponse();
    await updateDepartmentProfile({ organizationScope: { departmentId: 3 }, body }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 422, `Expected 422 for ${JSON.stringify(body).slice(0, 80)}`);
  }
});

test('department profile update reports missing profiles and backend failures accurately', async (t) => {
  const originalFindByPk = Department.findByPk;
  const originalError = console.error;
  let logCount = 0;
  console.error = () => { logCount += 1; };
  t.after(() => {
    Department.findByPk = originalFindByPk;
    console.error = originalError;
  });

  Department.findByPk = async () => null;
  const notFoundResponse = makeResponse();
  await updateDepartmentProfile({ organizationScope: { departmentId: 3 }, body: { phone: '55512345' } }, notFoundResponse, (error) => { throw error; });
  assert.equal(notFoundResponse.statusCode, 404);

  Department.findByPk = async () => { throw new Error('database unavailable'); };
  const serverErrorResponse = makeResponse();
  await updateDepartmentProfile({ organizationScope: { departmentId: 3 }, body: { phone: '55512345' } }, serverErrorResponse, (error) => { throw error; });
  assert.equal(serverErrorResponse.statusCode, 500);
  assert.equal(logCount, 1);
});

test('department profile update persists only editable fields and returns the same profile shape', async (t) => {
  const originals = {
    departmentFindByPk: Department.findByPk,
    userCount: User.count,
    assetCount: Asset.count,
    locationFindOne: Location.findOne,
    locationFindByPk: Location.findByPk,
  };
  const persistedUpdates = [];
  const department = {
    id: 3,
    name: 'Engineering',
    code: 'ENG',
    description: 'Old description',
    headId: 10,
    collegeId: 1,
    locationId: 2,
    phone: '55512345',
    email: 'engineering@example.test',
    status: 'active',
    College: { id: 1, collegeName: 'Engineering College' },
    Head: { id: 10, fullName: 'Department Head' },
    LocationRecord: { id: 2, name: 'Main Office' },
    update: async (updates) => {
      persistedUpdates.push(updates);
      Object.assign(department, updates);
      if (updates.locationId !== undefined) {
        department.LocationRecord = updates.locationId === 2 ? { id: 2, name: 'Main Office' } : null;
      }
    },
  };
  Department.findByPk = async () => department;
  User.count = async () => 7;
  Asset.count = async () => 12;
  Location.findOne = async () => ({ id: 2 });
  Location.findByPk = async () => ({ id: 2 });
  t.after(() => {
    Department.findByPk = originals.departmentFindByPk;
    User.count = originals.userCount;
    Asset.count = originals.assetCount;
    Location.findOne = originals.locationFindOne;
    Location.findByPk = originals.locationFindByPk;
  });

  const res = makeResponse();
  await updateDepartmentProfile({
    organizationScope: { departmentId: 3 },
    body: { phone: '+1 (555) 123-4567', email: 'new@example.test', office: 'Main Office', description: 'Updated' },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(persistedUpdates, [{
    phone: '+1 (555) 123-4567',
    email: 'new@example.test',
    locationId: 2,
    description: 'Updated',
  }]);
  assert.equal(res.payload.data.id, 3);
  assert.equal(res.payload.data.name, 'Engineering');
  assert.equal(res.payload.data.status, 'active');
  assert.equal(res.payload.data.office, 'Main Office');
  assert.deepEqual(res.payload.data.summary, { totalStaff: 7, totalAssets: 12 });
  assert.deepEqual(res.payload.summary, res.payload.data.summary);
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

test('department profile endpoints require department-head authentication, scope, and permissions', () => {
  for (const method of ['get', 'put']) {
    const route = departmentWorkspaceRoutes.stack.find((layer) => layer.route?.path === '/profile' && layer.route.methods[method])?.route;
    assert.ok(route, `Expected profile ${method.toUpperCase()} route`);
    assert.equal(route.stack.length, 2, `Expected profile ${method.toUpperCase()} permission middleware and controller`);
  }
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
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
