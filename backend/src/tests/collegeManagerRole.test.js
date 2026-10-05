const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRoleValue, requireRole } = require('../middlewares/auth');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');

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

test('legacy college role is accepted and normalized to college_manager', () => {
  const req = { user: { role: 'college' } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(normalizeRoleValue('college'), 'college_manager');
  assert.equal(normalizeRoleValue('college_manager'), 'college_manager');
  assert.equal(nextCalled, true, 'legacy college role should pass the college-manager guard');
  assert.equal(req.user.role, 'college_manager', 'legacy role should normalize to the canonical manager role');
});

test('legacy college role receives college_manager permissions', async () => {
  const permissions = await getConfiguredRolePermissions('college');
  assert.deepEqual(permissions, await getConfiguredRolePermissions('college_manager'));
});
