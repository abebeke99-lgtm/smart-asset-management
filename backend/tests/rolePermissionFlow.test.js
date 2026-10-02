const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const passport = require('../src/config/passport');
const { requireAuth, requirePermission, requireRole } = require('../src/middlewares/auth');
const { getCurrentUserProfile } = require('../src/controllers/userController');
const { getConfiguredRolePermissions } = require('../src/services/rolePermissionService');

const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test('protected requests enforce the current saved role permission matrix', async () => {
  const originalAuthenticate = passport.authenticate;
  const originalConfigFindByPk = models.Config.findByPk;
  let staffPermissions = ['assets.view'];
  passport.authenticate = () => (req, _res, next) => {
    req.user = { id: 42, role: 'staff', active: true };
    return next();
  };
  models.Config.findByPk = async (key) => key === 'role_permissions'
    ? { value: JSON.stringify({ staff: staffPermissions }) }
    : null;

  try {
    const req = {};
    const authResponse = response();
    let authenticated = false;
    await requireAuth(req, authResponse, () => { authenticated = true; });
    assert.equal(authenticated, true);

    let allowed = false;
    requirePermission('assets.view')(req, response(), () => { allowed = true; });
    assert.equal(allowed, true);

    const deniedResponse = response();
    requirePermission('users.create')(req, deniedResponse, () => assert.fail('users.create must be denied'));
    assert.equal(deniedResponse.statusCode, 403);

    staffPermissions = ['reports.view'];
    const refreshedReq = {};
    await requireAuth(refreshedReq, authResponse, () => {});
    const removedPermissionResponse = response();
    requirePermission('assets.view')(refreshedReq, removedPermissionResponse, () => assert.fail('stale permission must be denied'));
    assert.equal(removedPermissionResponse.statusCode, 403);
    let refreshedPermissionAllowed = false;
    requirePermission('reports.view')(refreshedReq, response(), () => { refreshedPermissionAllowed = true; });
    assert.equal(refreshedPermissionAllowed, true);
  } finally {
    passport.authenticate = originalAuthenticate;
    models.Config.findByPk = originalConfigFindByPk;
  }
});

test('session profile refresh returns the current database role and role permissions without password hashes', async () => {
  const originalFindByPk = models.User.findByPk;
  const originalConfigFindByPk = models.Config.findByPk;
  const user = { id: 42, username: 'test.user', role: 'staff', password: '$2b$hash' };
  models.User.findByPk = async () => user;
  models.Config.findByPk = async (key) => key === 'role_permissions'
    ? { value: JSON.stringify({ staff: ['assets.view'], finance: ['financial.view'] }) }
    : null;

  const makeRequest = async () => {
    const res = response();
    await getCurrentUserProfile({ user: { id: user.id } }, res);
    return res;
  };

  try {
    const initial = await makeRequest();
    assert.equal(initial.body.data.role, 'staff');
    assert.deepEqual(initial.body.data.permissions, ['assets.view']);
    assert.equal(Object.hasOwn(initial.body.data, 'password'), false);

    user.role = 'finance';
    const refreshed = await makeRequest();
    assert.equal(refreshed.body.data.role, 'finance');
    assert.deepEqual(refreshed.body.data.permissions, ['financial.view']);
  } finally {
    models.User.findByPk = originalFindByPk;
    models.Config.findByPk = originalConfigFindByPk;
  }
});

test('admin-only API role guards reject staff with HTTP 403', () => {
  const res = response();
  requireRole('admin')({ user: { role: 'staff' } }, res, () => assert.fail('staff must not enter admin APIs'));
  assert.equal(res.statusCode, 403);
});

test('default role permissions are least-privilege when no custom matrix is saved', async () => {
  const originalConfigFindByPk = models.Config.findByPk;
  models.Config.findByPk = async () => null;

  try {
    const staffPermissions = await getConfiguredRolePermissions('staff');
    const studentPermissions = await getConfiguredRolePermissions('student');
    assert.deepEqual(staffPermissions, ['assets.view']);
    assert.deepEqual(studentPermissions, ['assets.view']);
    assert.equal(staffPermissions.includes('*'), false);
  } finally {
    models.Config.findByPk = originalConfigFindByPk;
  }
});