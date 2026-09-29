const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('../middlewares/auth');

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

test('legacy college role is still accepted and normalized to the college manager role', () => {
  const req = { user: { role: 'college' } };
  const res = makeResponse();
  let nextCalled = false;

  requireRole('college_manager')(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'legacy college role should still pass the explicit college manager guard');
  assert.equal(req.user.role, 'college_manager', 'legacy role should normalize to the supported college manager role');
});
