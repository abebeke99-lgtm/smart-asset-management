const test = require('node:test');
const assert = require('node:assert/strict');
const router = require('../routes/rolesPermissionRoutes');
const { AuditLog, Permission, Role, RolePermission, User, UserRole, sequelize } = require('../models');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const findRoute = (method, routePath) => router.stack
  .find((layer) => layer.route?.path === routePath && layer.route.methods[method])
  ?.route;

test('role and permission management routes require the Administrator role', (t) => {
  const route = findRoute('get', '/roles');
  assert.ok(route);
  const requireAdministrator = route.stack[0].handle;
  const res = response();
  let nextCalled = false;

  requireAdministrator({ user: { id: 4, role: 'ict_officer' } }, res, () => { nextCalled = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('custom role deletion is blocked for users still on the legacy primary role', async (t) => {
  const route = findRoute('delete', '/roles/:roleId');
  assert.ok(route);
  const handler = route.stack[3].handle;
  const originals = {
    findByPk: Role.findByPk,
    userFindAll: User.findAll,
    userRoleFindAll: UserRole.findAll,
    auditCreate: AuditLog.create,
    transaction: sequelize.transaction,
  };
  const role = { id: 42, name: 'research_coordinator', async destroy() { assert.fail('assigned role must not be deleted'); } };
  Role.findByPk = async () => role;
  User.findAll = async () => [{ id: 17 }];
  UserRole.findAll = async () => [];
  AuditLog.create = async () => ({ id: 1 });
  sequelize.transaction = async () => assert.fail('assigned role must not open a deletion transaction');
  t.after(() => {
    Role.findByPk = originals.findByPk;
    User.findAll = originals.userFindAll;
    UserRole.findAll = originals.userRoleFindAll;
    AuditLog.create = originals.auditCreate;
    sequelize.transaction = originals.transaction;
  });

  const res = response();
  await handler({ params: { roleId: '42' }, user: { id: 1, role: 'admin' } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /Remove all user assignments/);
});

test('deleting an unassigned custom role removes grants in the same transaction', async (t) => {
  const route = findRoute('delete', '/roles/:roleId');
  assert.ok(route);
  const handler = route.stack[3].handle;
  const originals = {
    findByPk: Role.findByPk,
    userFindAll: User.findAll,
    userRoleFindAll: UserRole.findAll,
    permissionDestroy: RolePermission.destroy,
    auditCreate: AuditLog.create,
    transaction: sequelize.transaction,
  };
  const transaction = { id: 'role-delete-transaction' };
  const observed = { permissionTransaction: null, roleTransaction: null };
  const role = {
    id: 43,
    name: 'research_coordinator',
    isSystem: false,
    async destroy(options) { observed.roleTransaction = options.transaction; },
  };
  Role.findByPk = async () => role;
  User.findAll = async () => [];
  UserRole.findAll = async () => [];
  RolePermission.destroy = async (options) => { observed.permissionTransaction = options.transaction; };
  AuditLog.create = async (_record, options) => {
    assert.equal(options.transaction, transaction);
    return { id: 1 };
  };
  sequelize.transaction = async (callback) => callback(transaction);
  t.after(() => {
    Role.findByPk = originals.findByPk;
    User.findAll = originals.userFindAll;
    UserRole.findAll = originals.userRoleFindAll;
    RolePermission.destroy = originals.permissionDestroy;
    AuditLog.create = originals.auditCreate;
    sequelize.transaction = originals.transaction;
  });

  const res = response();
  await handler({ params: { roleId: '43' }, user: { id: 1, role: 'admin' } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(observed.permissionTransaction, transaction);
  assert.equal(observed.roleTransaction, transaction);
});

test('the active Administrator role cannot replace full Configure access with a limited grant', async (t) => {
  const route = findRoute('put', '/roles/:roleId/permissions');
  assert.ok(route);
  const handler = route.stack[3].handle;
  const originals = {
    roleFindByPk: Role.findByPk,
    permissionFindAll: Permission.findAll,
    permissionFindAllForRole: RolePermission.findAll,
    permissionDestroy: RolePermission.destroy,
    userRoleCount: UserRole.count,
    auditCreate: AuditLog.create,
    transaction: sequelize.transaction,
  };
  const adminRole = { id: 1, name: 'admin' };
  Role.findByPk = async () => adminRole;
  Permission.findAll = async () => [{ id: 9, action: 'configure' }];
  RolePermission.findAll = async () => [];
  RolePermission.destroy = async () => assert.fail('invalid Configure update must not be saved');
  UserRole.count = async () => 1;
  AuditLog.create = async () => ({ id: 1 });
  sequelize.transaction = async (callback) => callback({ id: 'permission-test-transaction' });
  t.after(() => {
    Role.findByPk = originals.roleFindByPk;
    Permission.findAll = originals.permissionFindAll;
    RolePermission.findAll = originals.permissionFindAllForRole;
    RolePermission.destroy = originals.permissionDestroy;
    UserRole.count = originals.userRoleCount;
    AuditLog.create = originals.auditCreate;
    sequelize.transaction = originals.transaction;
  });

  const res = response();
  let nextError;
  await handler({
    params: { roleId: '1' },
    body: { grants: [{ permissionId: 9, state: 'limited', scopeType: 'college' }] },
    user: { id: 1, role: 'admin' },
  }, res, (error) => { nextError = error; });

  assert.equal(nextError?.status, 409);
  assert.match(nextError?.message || '', /must retain Configure permission/);
});
