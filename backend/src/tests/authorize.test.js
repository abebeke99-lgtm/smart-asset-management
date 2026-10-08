const test = require('node:test');
const assert = require('node:assert/strict');
const { Permission, RolePermission, UserRole } = require('../models');
const { authorize, matchesAssignmentScope } = require('../middlewares/authorize');
const { requirePermission } = require('../middlewares/auth');
const { getAdministratorAssignmentError } = require('../services/roleGovernanceService');

const runMiddleware = async (middleware, user, target = {}) => {
  const result = { status: 200, body: null, nextError: null };
  const req = { user, method: 'GET', originalUrl: '/api/test' };
  const res = {
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  await middleware(req, res, (error) => { result.nextError = error || null; });
  return result;
};

const withMocks = async (mocks, run) => {
  const originals = mocks.map(([object, methods]) => (
    Object.entries(methods).map(([method, implementation]) => {
      const previous = object[method];
      object[method] = implementation;
      return [object, method, previous];
    })
  )).flat();
  try {
    await run();
  } finally {
    for (const [object, method, previous] of originals) object[method] = previous;
  }
};

test('authorize returns 401 for unauthenticated requests', async () => {
  const result = await runMiddleware(authorize('roles_permissions.view'), null);
  assert.equal(result.status, 401);
  assert.equal(result.body.message, 'Authentication required.');
});

test('authorize resolves permissions across multiple assigned roles', async () => {
  await withMocks([
    [Permission, { findOne: async () => ({ id: 50 }) }],
    [UserRole, { findAll: async () => [
      { Role: { id: 1 }, scopeType: 'system', scopeId: null },
      { Role: { id: 2 }, scopeType: 'system', scopeId: null },
    ] }],
    [RolePermission, { findAll: async () => [{ roleId: 2, scopeType: 'system', limited: false }] }],
  ], async () => {
    const result = await runMiddleware(
      authorize('roles_permissions.view', { audit: async () => {} }),
      { id: 7, role: 'staff' },
    );
    assert.equal(result.status, 200);
    assert.equal(result.nextError, null);
  });
});

test('authorize denies a removed permission immediately', async () => {
  await withMocks([
    [Permission, { findOne: async () => ({ id: 50 }) }],
    [UserRole, { findAll: async () => [
      { Role: { id: 1 }, scopeType: 'system', scopeId: null },
    ] }],
    [RolePermission, { findAll: async () => [] }],
  ], async () => {
    const result = await runMiddleware(
      authorize('roles_permissions.delete', { audit: async () => {} }),
      { id: 7, role: 'admin' },
    );
    assert.equal(result.status, 403);
  });
});

test('limited permissions reject out-of-scope and allow matching targets only', () => {
  const assignment = { scopeType: 'college', scopeId: 12 };
  const grant = { scopeType: 'college', limited: true };
  assert.equal(matchesAssignmentScope(assignment, grant, { scopes: { college: 13 } }, 7), false);
  assert.equal(matchesAssignmentScope(assignment, grant, { scopes: { college: 12 } }, 7), true);
});

test('a scoped user does not become system-wide through a full permission grant', () => {
  assert.equal(
    matchesAssignmentScope(
      { scopeType: 'college', scopeId: 12 },
      { scopeType: 'system', limited: false },
      { scopes: { college: 13 } },
      7,
    ),
    false,
  );
});

test('high-risk permissions never accept the legacy wildcard', () => {
  const result = { status: 200, body: null };
  const res = {
    status(status) { result.status = status; return this; },
    json(body) { result.body = body; return this; },
  };
  requirePermission('assets.delete')({ user: { permissions: ['*'] } }, res, () => {});
  assert.equal(result.status, 403);
  requirePermission('assets.delete')({ user: { permissions: ['assets.delete'] } }, res, () => {
    result.status = 200;
  });
  assert.equal(result.status, 200);
});

test('last administrator and self-administration protections are enforced', () => {
  assert.equal(getAdministratorAssignmentError({
    actorId: 5,
    targetUserId: 8,
    wasAdministrator: true,
    willBeAdministrator: false,
    activeAdministratorCount: 1,
  }).status, 409);
  assert.equal(getAdministratorAssignmentError({
    actorId: 5,
    targetUserId: 5,
    wasAdministrator: true,
    willBeAdministrator: false,
    activeAdministratorCount: 3,
  }).status, 403);
  assert.equal(getAdministratorAssignmentError({
    actorId: 5,
    targetUserId: 8,
    wasAdministrator: true,
    willBeAdministrator: false,
    activeAdministratorCount: 2,
  }), null);
});
