const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { sequelize, User, Role, UserActivityLog, AuditLog, Config } = require('../models');
const { getAllUsers, getUserStats, getStoreManagerAccounts, getRoles, createUser, updateUser } = require('../controllers/userController');
const userRoutes = require('../routes/userRoutes');
const { requireAuth } = require('../middlewares/auth');
const passport = require('../config/passport');

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

test('user-management models map the documented status, password and activity columns', () => {
  assert.equal(User.rawAttributes.password.field, 'password_hash');
  assert.equal(User.rawAttributes.lastLoginAt.field, 'last_login');
  assert.equal(User.rawAttributes.collegeId.field, 'college_id');
  assert.equal(User.rawAttributes.departmentId.field, 'department_id');
  assert.deepEqual(User.rawAttributes.status.type.values, ['active', 'inactive', 'suspended']);
  assert.ok(User.rawAttributes.role.type.values.includes('maintenance'));
  assert.equal(User.options.paranoid, false, 'the User model uses hard deletion rather than soft deletion');
  assert.equal(User.rawAttributes.deletedAt, undefined);
  assert.equal(Role.getTableName(), 'roles');
  assert.equal(UserActivityLog.getTableName(), 'user_activity_logs');
  assert.equal(UserActivityLog.rawAttributes.userId.field, 'user_id');
});

test('user statistics report all explicit account statuses and retain legacy aliases', async (t) => {
  const originalFindAll = User.findAll;
  User.findAll = async ({ attributes }) => (
    attributes[0] === 'status'
      ? [
        { status: 'active', count: '7' },
        { status: 'inactive', count: '2' },
        { status: 'suspended', count: '1' },
      ]
      : [
        { role: 'admin', count: '1' },
        { role: 'staff', count: '9' },
      ]
  );
  t.after(() => { User.findAll = originalFindAll; });

  const res = makeResponse();
  await getUserStats({}, res, (error) => { throw error; });

  assert.deepEqual(res.payload.data, {
    total: 10,
    totalUsers: 10,
    active: 7,
    activeUsers: 7,
    inactive: 2,
    inactiveUsers: 2,
    suspended: 1,
    admins: 1,
    adminCount: 1,
    roleCounts: { admin: 1, staff: 9 },
  });
});

test('user list applies status, role, college, search and pagination filters', async (t) => {
  const originalFindAndCountAll = User.findAndCountAll;
  let query;
  User.findAndCountAll = async (options) => {
    query = options;
    return { count: 0, rows: [] };
  };
  t.after(() => { User.findAndCountAll = originalFindAndCountAll; });

  const req = {
    user: { id: 1, role: 'admin' },
    query: {
      status: 'suspended',
      role: 'ict_officer',
      collegeId: '4',
      search: 'network',
      page: '2',
      limit: '5',
    },
  };
  const res = makeResponse();
  await getAllUsers(req, res);

  assert.equal(query.where.status, 'suspended');
  assert.equal(query.where.role, 'ict_officer');
  assert.equal(query.where.collegeId, 4);
  assert.equal(query.limit, 5);
  assert.equal(query.offset, 5);
  assert.ok(query.where[Op.or].some((condition) => condition.attribute?.col === 'College.college_name'));
  assert.equal(res.payload.pagination.page, 2);
  assert.equal(res.payload.pagination.total, 0);
});

test('Store Manager account list returns only permitted identity and status fields with the current cap', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    count: User.count,
    findAll: User.findAll,
    findByPk: User.findByPk,
  };
  const transaction = {};
  sequelize.transaction = async (callback) => callback(transaction);
  let countQuery;
  let listQuery;
  User.count = async (options) => {
    countQuery = options;
    assert.equal(options.transaction, transaction);
    return 5;
  };
  User.findAll = async (options) => {
    listQuery = options;
    assert.equal(options.transaction, transaction);
    return [
      { id: 4, fullName: 'Store Lead', username: 'store.lead', email: 'lead@example.edu', status: 'active', collegeId: 2, departmentId: 7, createdAt: new Date('2026-10-01T00:00:00Z') },
      { id: 5, fullName: 'Store Assistant', username: 'store.assistant', email: null, status: 'inactive', collegeId: 2, departmentId: 7, createdAt: new Date('2026-10-02T00:00:00Z') },
    ];
  };
  User.findByPk = async () => assert.fail('account listing must not perform individual-user lookups');
  t.after(() => {
    sequelize.transaction = originals.transaction;
    User.count = originals.count;
    User.findAll = originals.findAll;
    User.findByPk = originals.findByPk;
  });

  const res = makeResponse();
  await getStoreManagerAccounts({ user: { role: 'admin' } }, res, (error) => { throw error; });

  assert.equal(res.payload.data.count, 5);
  assert.equal(res.payload.data.limit, 8);
  assert.equal(res.payload.data.remaining, 3);
  assert.equal(res.payload.data.visibleCount, 2);
  assert.deepEqual(listQuery.where, { role: 'store_manager' });
  assert.deepEqual(countQuery.where, { role: 'store_manager' });
  assert.equal(Object.prototype.hasOwnProperty.call(countQuery.where, 'status'), false, 'inactive/suspended managers count toward the total limit');
  assert.deepEqual(listQuery.attributes, ['id', 'fullName', 'username', 'email', 'status', 'createdAt', 'collegeId', 'departmentId', 'department']);
  assert.deepEqual(listQuery.include.map(({ as, attributes }) => ({ as, attributes })), [
    { as: undefined, attributes: ['id', 'collegeName'] },
    { as: 'DepartmentRecord', attributes: ['id', 'name'] },
  ]);
  assert.equal(res.payload.data.users.length, 2);
  assert.equal(res.payload.data.users[1].status, 'inactive');
  assert.equal(res.payload.data.users[0].email, 'lead@example.edu');
  assert.equal(res.payload.data.users[0].password, undefined);
});

test('Store Manager list is scoped to the caller college while the cap count remains global', async (t) => {
  const originals = { transaction: sequelize.transaction, count: User.count, findAll: User.findAll };
  const transaction = {};
  sequelize.transaction = async (callback) => callback(transaction);
  let countQuery;
  let listQuery;
  User.count = async (options) => {
    countQuery = options;
    assert.equal(options.transaction, transaction);
    return 5;
  };
  User.findAll = async (options) => {
    listQuery = options;
    assert.equal(options.transaction, transaction);
    return [{ id: 9, collegeId: 12, status: 'active' }];
  };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    User.count = originals.count;
    User.findAll = originals.findAll;
  });

  const res = makeResponse();
  await getStoreManagerAccounts({ user: { role: 'store_manager', collegeId: 12 } }, res, (error) => { throw error; });

  assert.deepEqual(countQuery.where, { role: 'store_manager' });
  assert.deepEqual(listQuery.where, { role: 'store_manager', collegeId: 12 });
  assert.equal(res.payload.data.count, 5);
  assert.equal(res.payload.data.visibleCount, 1);
  assert.equal(res.payload.data.users[0].collegeId, 12);
});

test('Store Manager account listing denies callers without a valid college scope', async () => {
  const res = makeResponse();
  await getStoreManagerAccounts({ user: { role: 'store_manager', collegeId: 'invalid' } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /College scope is not configured/i);
});

test('Store Manager account list returns an empty list and zero capacity usage when no accounts exist', async (t) => {
  const originals = { transaction: sequelize.transaction, findAll: User.findAll, count: User.count };
  const transaction = {};
  sequelize.transaction = async (callback) => callback(transaction);
  let listQuery;
  User.findAll = async (options) => {
    listQuery = options;
    return [];
  };
  User.count = async () => 0;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    User.findAll = originals.findAll;
    User.count = originals.count;
  });

  const res = makeResponse();
  await getStoreManagerAccounts({ user: { role: 'admin' } }, res, (error) => { throw error; });

  assert.deepEqual(listQuery.where, { role: 'store_manager' });
  assert.equal(res.payload.data.count, 0);
  assert.equal(res.payload.data.limit, 8);
  assert.equal(res.payload.data.remaining, 8);
  assert.equal(res.payload.data.visibleCount, 0);
  assert.deepEqual(res.payload.data.users, []);
});

test('Store Manager account list forwards database errors to the Express error handler', async (t) => {
  const originals = { transaction: sequelize.transaction, findAll: User.findAll };
  sequelize.transaction = async (callback) => callback({});
  const databaseError = new Error('database unavailable');
  User.findAll = async () => { throw databaseError; };
  t.after(() => {
    sequelize.transaction = originals.transaction;
    User.findAll = originals.findAll;
  });

  let forwardedError;
  await getStoreManagerAccounts({ user: { role: 'admin' } }, makeResponse(), (error) => { forwardedError = error; });
  assert.equal(forwardedError, databaseError);
});

test('Store Manager registration entry is read-only and account creation remains administrator-only', () => {
  const accountListRoute = userRoutes.stack.find((layer) => layer.route?.path === '/store-manager-accounts' && layer.route.methods.get);
  assert.ok(accountListRoute);
  assert.equal(accountListRoute.route.stack[1].handle, requireAuth);
  const denied = makeResponse();
  accountListRoute.route.stack[2].handle({ user: { role: 'student' } }, denied, () => assert.fail('non-Store-Manager users must be denied'));
  assert.equal(denied.statusCode, 403);

  const createRoute = userRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
  assert.ok(createRoute);
  const managerDenied = makeResponse();
  createRoute.route.stack[1].handle({ user: { role: 'store_manager' } }, managerDenied, () => assert.fail('Store Managers must not create users'));
  assert.equal(managerDenied.statusCode, 403);
  const maintenanceDenied = makeResponse();
  createRoute.route.stack[1].handle({ user: { role: 'maintenance' } }, maintenanceDenied, () => assert.fail('Maintenance users must not create users'));
  assert.equal(maintenanceDenied.statusCode, 403);
});

test('role catalog exposes one canonical Admin and Maintenance option with consistent labels', async (t) => {
  const originalFindAll = Role.findAll;
  Role.findAll = async () => [
    { name: 'maintenance_coordinator', displayName: 'Maintenance Coordinator' },
    { name: 'maintenance', displayName: 'Maintenance Coordinator' },
    { name: 'admin', displayName: 'System Administrator' },
    { name: 'admin', displayName: 'Administrator duplicate' },
    { name: 'unknown_role', displayName: 'Unknown Role' },
  ];
  t.after(() => { Role.findAll = originalFindAll; });

  const res = makeResponse();
  await getRoles({}, res, (error) => { throw error; });

  assert.deepEqual(res.payload.roles.map(({ name, displayName }) => ({ name, displayName })), [
    { name: 'maintenance', displayName: 'Maintenance' },
    { name: 'admin', displayName: 'Admin' },
  ]);
  assert.equal(res.payload.data, res.payload.roles);
});

test('account-list route returns HTTP 401 when JWT authentication finds no user', async (t) => {
  const originalAuthenticate = passport.authenticate;
  passport.authenticate = (_strategy, _options, callback) => (_req, _res, _next) => callback(null, null);
  t.after(() => { passport.authenticate = originalAuthenticate; });

  const res = makeResponse();
  await requireAuth({}, res, () => assert.fail('unauthenticated account-list access must stop at authentication'));

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.success, false);
});

test('Store Manager creation locks the role row, counts existing accounts transactionally, and hashes the password', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userCount: User.count,
    userFindAll: User.findAll,
    userCreate: User.create,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
    configFindByPk: Config.findByPk,
  };
  let creation;
  let roleQuery;
  let transaction;
  sequelize.transaction = async (callback) => callback(transaction = { LOCK: { UPDATE: 'UPDATE' } });
  Role.findOne = async (query) => {
    roleQuery = query;
    return { id: 7, name: 'store_manager', active: true };
  };
  User.count = async (query) => {
    assert.equal(query.transaction, transaction);
    return 7;
  };
  User.findAll = async () => [];
  User.create = async (values) => {
    creation = values;
    return { id: 22, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  Config.findByPk = async () => null;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.count = originals.userCount;
    User.findAll = originals.userFindAll;
    User.create = originals.userCreate;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
    Config.findByPk = originals.configFindByPk;
  });

  const res = makeResponse();
  await createUser({
    body: {
      username: 'new.store.manager',
      fullName: 'New Store Manager',
      email: 'new.store.manager@example.edu',
      role: 'store_manager',
      status: 'active',
      password: 'StorePass123',
      confirmPassword: 'StorePass123',
    },
    user: { id: 1, username: 'administrator', role: 'admin' },
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.data.role, 'store_manager');
  assert.equal(roleQuery.lock, transaction.LOCK.UPDATE);
  assert.equal(roleQuery.transaction, transaction);
  assert.notEqual(creation.password, 'StorePass123');
  assert.match(creation.password, /^\$2[aby]\$/);
  assert.equal(res.payload.data.password, undefined);
});

test('Maintenance account creation accepts and persists the canonical role', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userFindAll: User.findAll,
    userCreate: User.create,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
    configFindByPk: Config.findByPk,
  };
  let creation;
  let roleQuery;
  const transaction = {};
  sequelize.transaction = async (callback) => callback(transaction);
  Role.findOne = async (query) => {
    roleQuery = query;
    return { id: 9, name: 'maintenance', active: true };
  };
  User.findAll = async () => [];
  User.create = async (values, options) => {
    assert.equal(options.transaction, transaction);
    creation = values;
    return { id: 29, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  Config.findByPk = async () => null;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.findAll = originals.userFindAll;
    User.create = originals.userCreate;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
    Config.findByPk = originals.configFindByPk;
  });

  const res = makeResponse();
  await createUser({
    body: {
      username: 'maintenance.user',
      fullName: 'Maintenance User',
      email: 'maintenance.user@example.edu',
      role: 'maintenance',
      status: 'active',
      password: 'MaintainPass123',
      confirmPassword: 'MaintainPass123',
    },
    user: { id: 1, username: 'administrator', role: 'admin' },
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(roleQuery.where.name, 'maintenance');
  assert.equal(creation.role, 'maintenance');
  assert.equal(res.payload.data.role, 'maintenance');
});

test('Admin account creation persists the canonical role and password hash', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userFindAll: User.findAll,
    userCreate: User.create,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
    configFindByPk: Config.findByPk,
  };
  let creation;
  let roleQuery;
  const transaction = {};
  sequelize.transaction = async (callback) => callback(transaction);
  Role.findOne = async (query) => {
    roleQuery = query;
    return { id: 1, name: 'admin', active: true };
  };
  User.findAll = async () => [];
  User.create = async (values, options) => {
    assert.equal(options.transaction, transaction);
    creation = values;
    return { id: 30, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  Config.findByPk = async () => null;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.findAll = originals.userFindAll;
    User.create = originals.userCreate;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
    Config.findByPk = originals.configFindByPk;
  });

  const res = makeResponse();
  await createUser({
    body: {
      username: 'new.admin',
      fullName: 'New Administrator',
      email: 'new.admin@example.edu',
      role: 'Admin',
      status: 'active',
      password: 'AdminPass123',
      confirmPassword: 'AdminPass123',
    },
    user: { id: 1, username: 'administrator', role: 'admin' },
    ip: '127.0.0.1',
  }, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(roleQuery.where, { name: 'admin', active: true });
  assert.equal(creation.role, 'admin');
  assert.match(creation.password, /^\$2[aby]\$/);
  assert.equal(res.payload.data.role, 'admin');
  assert.equal(res.payload.data.password, undefined);
});

test('concurrent Store Manager creates serialize on the role lock and cannot exceed the account limit', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userCount: User.count,
    userFindAll: User.findAll,
    userCreate: User.create,
    auditCreate: AuditLog.create,
    activityCreate: UserActivityLog.create,
    configFindByPk: Config.findByPk,
  };
  let accountCount = 7;
  let nextId = 100;
  let previousLock = Promise.resolve();
  sequelize.transaction = async (callback) => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    try {
      return await callback(transaction);
    } finally {
      transaction.releaseStoreManagerRoleLock?.();
    }
  };
  Role.findOne = async (query) => {
    assert.equal(query.lock, 'UPDATE');
    const waitingForPreviousLock = previousLock;
    let release;
    previousLock = new Promise((resolve) => { release = resolve; });
    await waitingForPreviousLock;
    query.transaction.releaseStoreManagerRoleLock = release;
    return { id: 7, name: 'store_manager', active: true };
  };
  User.count = async ({ transaction, where }) => {
    assert.ok(transaction);
    assert.deepEqual(where, { role: 'store_manager' });
    return accountCount;
  };
  User.findAll = async () => [];
  User.create = async (values) => {
    accountCount += 1;
    return { id: nextId++, ...values, toJSON() { return { id: this.id, ...values }; } };
  };
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  Config.findByPk = async () => null;
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.count = originals.userCount;
    User.findAll = originals.userFindAll;
    User.create = originals.userCreate;
    AuditLog.create = originals.auditCreate;
    UserActivityLog.create = originals.activityCreate;
    Config.findByPk = originals.configFindByPk;
  });

  const makeRequest = (number) => ({
    body: {
      username: `parallel.store.manager.${number}`,
      fullName: `Parallel Store Manager ${number}`,
      email: `parallel.store.manager.${number}@example.edu`,
      role: 'store_manager',
      password: 'StorePass123',
      confirmPassword: 'StorePass123',
    },
    user: { id: 1, username: 'administrator', role: 'admin' },
  });
  const responses = [makeResponse(), makeResponse()];
  await Promise.all(responses.map((res, index) => createUser(makeRequest(index + 1), res)));

  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [201, 409]);
  assert.equal(accountCount, 8);
});

test('Store Manager creation rejects the ninth account without inserting it', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userCount: User.count,
    configFindByPk: Config.findByPk,
    userCreate: User.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  sequelize.transaction = async (callback) => callback(transaction);
  Role.findOne = async () => ({ id: 7, name: 'store_manager', active: true });
  User.count = async () => 8;
  Config.findByPk = async () => null;
  User.create = async () => assert.fail('the ninth Store Manager account must not be inserted');
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.count = originals.userCount;
    Config.findByPk = originals.configFindByPk;
    User.create = originals.userCreate;
  });

  const res = makeResponse();
  await createUser({
    body: {
      username: 'ninth.store.manager',
      fullName: 'Ninth Store Manager',
      email: 'ninth.store.manager@example.edu',
      role: 'store_manager',
      password: 'StorePass123',
      confirmPassword: 'StorePass123',
    },
    user: { id: 1, username: 'administrator', role: 'admin' },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /maximum of 8 Store Manager accounts/i);
});

test('administrator role promotion also rejects a ninth Store Manager account', async (t) => {
  const originals = {
    transaction: sequelize.transaction,
    roleFindOne: Role.findOne,
    userCount: User.count,
    userFindByPk: User.findByPk,
    userFindAll: User.findAll,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const existingUser = {
    id: 42,
    username: 'promotion.candidate',
    email: 'promotion.candidate@example.edu',
    role: 'staff',
    active: true,
    status: 'active',
    toJSON() {
      return { id: this.id, username: this.username, email: this.email, role: this.role, active: this.active, status: this.status };
    },
  };
  let findByPkCalls = 0;
  sequelize.transaction = async (callback) => callback(transaction);
  Role.findOne = async (query) => {
    assert.equal(query.lock, transaction.LOCK.UPDATE);
    return { id: 7, name: 'store_manager', active: true };
  };
  User.count = async (query) => {
    assert.equal(query.transaction, transaction);
    return 8;
  };
  User.findByPk = async () => {
    findByPkCalls += 1;
    return existingUser;
  };
  User.findAll = async () => [];
  t.after(() => {
    sequelize.transaction = originals.transaction;
    Role.findOne = originals.roleFindOne;
    User.count = originals.userCount;
    User.findByPk = originals.userFindByPk;
    User.findAll = originals.userFindAll;
  });

  const res = makeResponse();
  await updateUser({
    params: { id: '42' },
    body: { role: 'store_manager' },
    user: { id: 1, username: 'administrator', role: 'admin' },
  }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /maximum of 8 Store Manager accounts/i);
  assert.equal(findByPkCalls, 2);
});
