const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole, requirePermission } = require('../middlewares/auth');

const makeResponse = () => ({
  status(code) {
    return {
      json(payload) {
        return { code, payload };
      },
    };
  },
});

test('college_manager is accepted as a valid college manager role', () => {
  const req = { user: { role: 'college_manager', active: true, permissions: ['college.dashboard.view'] } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'college_manager should pass the role guard');
  assert.equal(req.user.role, 'college_manager', 'college_manager should remain canonical');
});

test('legacy college role still resolves to the college manager authorization model', () => {
  const req = { user: { role: 'college', active: true, permissions: ['college.dashboard.view'] } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'legacy college role should still be accepted');
  assert.equal(req.user.role, 'college_manager', 'legacy role should normalize to the supported college manager role');
});

test('requirePermission blocks requests when the required permission is missing', () => {
  const req = { user: { role: 'college_manager', active: true, permissions: ['college.assets.view'] } };
  const res = makeResponse();
  let blocked = false;

  const response = requirePermission('college.dashboard.view')(req, res, () => {
    blocked = false;
  });

  assert.equal(response && response.code, 403, 'missing permission should return a 403 response');
});

test('requirePermission allows valid college manager permissions', () => {
  const req = { user: { role: 'college_manager', active: true, permissions: ['college.dashboard.view'] } };
  const res = makeResponse();
  let nextCalled = false;

  requirePermission('college.dashboard.view')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'authorized college manager should pass the permission guard');
});
