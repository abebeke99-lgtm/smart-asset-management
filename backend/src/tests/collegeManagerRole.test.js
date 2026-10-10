const test = require('node:test');
const assert = require('node:assert/strict');
const { Config } = require('../models');
const { normalizeRoleValue, requireRole } = require('../middlewares/auth');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { DEFAULT_ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const makeResponse = () => ({
  status(code) {
    return {
      json(payload) {
        return { code, payload };
      },
    };
  },
});

test('college manager role is accepted under the college scope guard', () => {
  const req = { user: { role: 'college_manager' } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'college_manager should satisfy the role check');
  assert.equal(req.user.role, 'college_manager', 'college_manager should remain the canonical college manager role');
});

test('college role remains distinct from college_manager authorization', () => {
  const req = { user: { role: 'college' } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(normalizeRoleValue('college'), 'college');
  assert.equal(normalizeRoleValue('college_manager'), 'college_manager');
  assert.equal(nextCalled, false, 'college role must not pass the college-manager guard');
  assert.equal(req.user.role, 'college', 'college role should retain its own identity');
});

test('college role receives only its own configured permissions', async () => {
  const originalFindByPk = Config.findByPk;
  Config.findByPk = async () => null;
  try {
    const permissions = await getConfiguredRolePermissions('college');
    assert.deepEqual(permissions, DEFAULT_ROLE_PERMISSIONS.college);
    assert.notDeepEqual(permissions, await getConfiguredRolePermissions('college_manager'));
  } finally {
    Config.findByPk = originalFindByPk;
  }
});

test('explicit department-head permission matrices retain notification policy grants', async () => {
  const originalFindByPk = Config.findByPk;
  Config.findByPk = async (key) => {
    if (key !== 'role_permissions') return originalFindByPk.call(Config, key);
    return { value: JSON.stringify({ department_head: ['assets.view', 'assets.assign', 'users.view', 'reports.view'] }) };
  };

  try {
    const permissions = await getConfiguredRolePermissions('department_head');
    assert.deepEqual(permissions, [
      'assets.view',
      'assets.assign',
      'users.view',
      'reports.view',
      'notifications.view',
      'notifications.delete',
    ]);
  } finally {
    Config.findByPk = originalFindByPk;
  }
});
