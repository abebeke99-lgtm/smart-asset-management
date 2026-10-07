const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { sequelize, Asset, User, Department, Location, AuditLog } = require('../models');
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

  const req = { organizationScope: { departmentId: 99 }, user: { role: 'department_head', departmentId: 3 } };
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

test('department profile scope is derived from the authenticated user and returns 404 when unassigned', async (t) => {
  const originalFindByPk = Department.findByPk;
  let requestedId;
  Department.findByPk = async (id) => {
    requestedId = id;
    return { id: 3, collegeId: 1, status: 'inactive' };
  };
  t.after(() => { Department.findByPk = originalFindByPk; });

  const req = { path: '/profile', user: { role: 'department_head', departmentId: 3 }, params: { departmentId: 99 }, query: { departmentId: 99 } };
  const res = makeResponse();
  let nextCalled = false;
  await resolveDepartmentScope(req, res, () => { nextCalled = true; });
  assert.equal(requestedId, 3);
  assert.equal(nextCalled, true);
  assert.equal(req.organizationScope.departmentId, 3);

  const missingResponse = makeResponse();
  await resolveDepartmentScope({ path: '/profile', user: { role: 'department_head' } }, missingResponse, () => {
    assert.fail('An unassigned department head must not pass profile scope');
  });
  assert.equal(missingResponse.statusCode, 404);
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

test('department profile controller derives scope from the authenticated user, not request parameters', async (t) => {
  const originalFindByPk = Department.findByPk;
  let lookups = 0;
  Department.findByPk = async (id) => {
    lookups += 1;
    assert.equal(id, 3);
    return null;
  };
  t.after(() => { Department.findByPk = originalFindByPk; });

  const res = makeResponse();
  await getDepartmentProfile({
    user: { id: 10, role: 'department_head', departmentId: 3 },
    organizationScope: { departmentId: 99 },
    params: { departmentId: 99 },
    query: { departmentId: 99 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 404);
  assert.equal(lookups, 1);
});

test('department profile update rejects protected fields and invalid editable values', async (t) => {
  const originalFindByPk = Department.findByPk;
  const department = { id: 3, update: async () => assert.fail('Invalid changes must not be persisted') };
  Department.findByPk = async () => department;
  t.after(() => { Department.findByPk = originalFindByPk; });

  for (const body of [
    { departmentId: 99 },
    { name: 'Changed Name' },
    { code: 'CHANGED' },
    { collegeId: 99 },
    { status: 'inactive' },
    { email: 'not-an-email' },
    { email: 'x'.repeat(250) + '@example.test' },
    { contact: '555' },
    { contact: '.......' },
    { description: 'x'.repeat(501) },
    { office: { id: 9 } },
    {},
  ]) {
    const res = makeResponse();
    await updateDepartmentProfile({ user: { id: 10, role: 'department_head', departmentId: 3 }, organizationScope: { departmentId: 3 }, body }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 422, `Expected 422 for ${JSON.stringify(body).slice(0, 80)}`);
    assert.ok(res.payload.errors);
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
  await updateDepartmentProfile({ user: { id: 10, role: 'department_head', departmentId: 3 }, organizationScope: { departmentId: 3 }, body: { contact: '55512345' } }, notFoundResponse, (error) => { throw error; });
  assert.equal(notFoundResponse.statusCode, 404);

  Department.findByPk = async () => { throw new Error('database unavailable'); };
  const serverErrorResponse = makeResponse();
  await updateDepartmentProfile({ user: { id: 10, role: 'department_head', departmentId: 3 }, organizationScope: { departmentId: 3 }, body: { contact: '55512345' } }, serverErrorResponse, (error) => { throw error; });
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
    auditLogCreate: AuditLog.create,
    transaction: sequelize.transaction,
  };
  const persistedUpdates = [];
  const auditEntries = [];
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
  AuditLog.create = async (entry) => { auditEntries.push(entry); };
  sequelize.transaction = async (callback) => callback({ id: 'profile-test-transaction' });
  t.after(() => {
    Department.findByPk = originals.departmentFindByPk;
    User.count = originals.userCount;
    Asset.count = originals.assetCount;
    Location.findOne = originals.locationFindOne;
    Location.findByPk = originals.locationFindByPk;
    AuditLog.create = originals.auditLogCreate;
    sequelize.transaction = originals.transaction;
  });

  const res = makeResponse();
  await updateDepartmentProfile({
    user: { id: 10, role: 'department_head', departmentId: 3 },
    organizationScope: { departmentId: 3 },
    body: { contact: '+1 (555) 123-4567', email: 'new@example.test', office: 'Main Office', description: 'Updated' },
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
  assert.equal(auditEntries.length, 1);
  assert.equal(auditEntries[0].userId, 10);
  assert.equal(auditEntries[0].action, 'UPDATE_DEPARTMENT_PROFILE');
  assert.deepEqual(JSON.parse(auditEntries[0].details), {
    departmentId: 3,
    oldValues: { contact: '55512345', email: 'engineering@example.test', office: 'Main Office', description: 'Old description' },
    newValues: { contact: '+1 (555) 123-4567', email: 'new@example.test', office: 'Main Office', description: 'Updated' },
  });
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
  const dashboardRouteIndex = departmentWorkspaceRoutes.stack.findIndex((layer) => layer.route?.path === '/dashboard' && layer.route.methods.get);
  const profileRouteIndexes = [];

  for (const method of ['get', 'put']) {
    const layerIndex = departmentWorkspaceRoutes.stack.findIndex((layer) => layer.route?.path === '/profile' && layer.route.methods[method]);
    const route = departmentWorkspaceRoutes.stack[layerIndex]?.route;
    assert.ok(route, `Expected profile ${method.toUpperCase()} route`);
    assert.equal(route.stack.length, 1, `Profile ${method.toUpperCase()} is authorized by the router's Department Head role guard`);
    assert.equal(route.stack[0].handle.name, method === 'get' ? 'getDepartmentProfile' : 'updateDepartmentProfile');
    profileRouteIndexes.push(layerIndex);
  }
  assert.ok(dashboardRouteIndex >= 0, 'Expected the department dashboard route');
  const sharedAssetGateIndex = departmentWorkspaceRoutes.stack.findIndex((layer, index) =>
    index > Math.max(...profileRouteIndexes) && index < dashboardRouteIndex && !layer.route
  );
  assert.ok(sharedAssetGateIndex >= 0, 'Expected the shared assets.view gate after the profile routes');
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
  }
  assert.equal(
    departmentWorkspaceRoutes.stack.findIndex((layer) => layer.handle.name === 'requireDepartmentPermission'),
    -1,
    'Profile endpoints must not depend on optional per-role permission-matrix entries',
  );
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
