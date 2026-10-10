const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Config, AuditLog, UserActivityLog, UserRole, Role, RolePermission } = require('../src/models');
const { login } = require('../src/controllers/authController');
const verificationController = require('../src/controllers/verificationController');
const { initializeInitialAdmin } = require('../src/services/initialAdminService');
const { repairExistingAdminPassword } = require('../src/scripts/repairExistingAdminPassword');

const makeTestPassword = () => `Test-${randomBytes(24).toString('hex')}!Aa1`;
const testPassword = makeTestPassword();
const jwtSecret = 'test-only-jwt-secret';

const makeUser = async ({ password = testPassword, active = true } = {}) => ({
  id: 7,
  username: 'admin',
  email: 'admin@bekelei.com',
  password: await bcrypt.hash(password, 4),
  fullName: 'System Administrator',
  role: 'admin',
  department: 'Administration',
  active,
  sessionVersion: 0,
  update: async function update(values) { Object.assign(this, values); },
});

const invokeLogin = async (user) => {
  let queryOptions;
  const previous = {
    findOne: User.findOne,
    findByPk: Config.findByPk,
    createAudit: AuditLog.create,
    createUserActivity: UserActivityLog.create,
    userRoleFindAll: UserRole.findAll,
    roleFindOne: Role.findOne,
    rolePermissionFindAll: RolePermission.findAll,
    jwtSecret: process.env.JWT_SECRET,
  };

  User.findOne = async (options) => {
    queryOptions = options;
    return user;
  };
  Config.findByPk = async () => null;
  AuditLog.create = async () => ({});
  UserActivityLog.create = async () => ({});
  UserRole.findAll = async () => [];
  Role.findOne = async () => null;
  RolePermission.findAll = async () => [];
  process.env.JWT_SECRET = jwtSecret;

  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await login({ body: { username: 'admin', password: testPassword }, headers: {}, ip: '127.0.0.1' }, response);
    return { response, queryOptions };
  } finally {
    User.findOne = previous.findOne;
    Config.findByPk = previous.findByPk;
    AuditLog.create = previous.createAudit;
    UserActivityLog.create = previous.createUserActivity;
    UserRole.findAll = previous.userRoleFindAll;
    Role.findOne = previous.roleFindOne;
    RolePermission.findAll = previous.rolePermissionFindAll;
    if (previous.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous.jwtSecret;
  }
};

test('valid login returns a JWT and the authentication query includes the password field', async () => {
  const user = await makeUser();
  const { response, queryOptions } = await invokeLogin(user);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.token, 'string');
  assert.equal(jwt.verify(response.body.token, jwtSecret).id, user.id);
  assert.equal(User.rawAttributes.password.fieldName, 'password');
  assert.equal(queryOptions.attributes, undefined);
});

test('jwt secret falls back to a stable development value when no explicit secret is configured', () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousDevSecret = process.env.JWT_DEV_SECRET;
  const jwtConfigPath = require.resolve('../src/config/jwt');

  const restore = () => {
    delete require.cache[jwtConfigPath];
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousDevSecret === undefined) delete process.env.JWT_DEV_SECRET;
    else process.env.JWT_DEV_SECRET = previousDevSecret;
  };

  try {
    delete require.cache[jwtConfigPath];
    delete process.env.JWT_SECRET;
    process.env.JWT_DEV_SECRET = '';
    const { getJwtSecret: fallbackGetJwtSecret } = require('../src/config/jwt');
    assert.equal(fallbackGetJwtSecret(), 'dev-smart-asset-management-secret-2026-10-01');

    delete require.cache[jwtConfigPath];
    process.env.JWT_DEV_SECRET = 'configured-dev-secret';
    const { getJwtSecret: configuredGetJwtSecret } = require('../src/config/jwt');
    assert.equal(configuredGetJwtSecret(), 'configured-dev-secret');
  } finally {
    restore();
  }
});

test('verification session listing tolerates requests without organization scope data', async () => {
  const { VerificationSession } = require('../src/models');
  const previousFindAll = VerificationSession.findAll;
  const calls = [];

  VerificationSession.findAll = async (options) => {
    calls.push(options);
    return [];
  };

  try {
    await verificationController.listSessions(
      { user: { id: 1 }, organizationScope: undefined },
      { json: () => {} },
      (error) => { throw error; }
    );

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].where, {});
  } finally {
    VerificationSession.findAll = previousFindAll;
  }
});

test('unknown users receive 401', async () => {
  const { response } = await invokeLogin(null);
  assert.equal(response.statusCode, 401);
});

test('incorrect passwords receive 401', async () => {
  const user = await makeUser({ password: 'Different-Password-42!' });
  const { response } = await invokeLogin(user);
  assert.equal(response.statusCode, 401);
});

test('inactive users receive 403 before password comparison', async () => {
  const user = await makeUser({ active: false });
  const { response } = await invokeLogin(user);
  assert.equal(response.statusCode, 403);
});

test('initial admin creation stores one active admin with a bcrypt hash and is idempotent', async () => {
  const users = [];
  let createCalls = 0;
  const userModel = {
    async findOne({ where }) {
      return users.find((user) => user.username === where.username) || null;
    },
    async create(values) {
      createCalls += 1;
      const user = { id: createCalls, ...values, update: async function update(nextValues) { Object.assign(this, nextValues); } };
      users.push(user);
      return user;
    },
  };

  const previousPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const updatedPassword = makeTestPassword();
  process.env.INITIAL_ADMIN_PASSWORD = testPassword;
  let first;
  let second;
  let firstHash;
  try {
    first = await initializeInitialAdmin({ userModel });
    firstHash = users[0].password;
    process.env.INITIAL_ADMIN_PASSWORD = updatedPassword;
    second = await initializeInitialAdmin({ userModel });
  } finally {
    if (previousPassword === undefined) delete process.env.INITIAL_ADMIN_PASSWORD;
    else process.env.INITIAL_ADMIN_PASSWORD = previousPassword;
  }

  assert.deepEqual(first, { created: true, userId: 1 });
  assert.deepEqual(second, { created: false, userId: 1, passwordUpdated: true });
  assert.equal(createCalls, 1);
  assert.equal(users.length, 1);
  assert.match(firstHash, /^\$2[aby]\$/);
  assert.notEqual(users[0].password, firstHash);
  assert.equal(await bcrypt.compare(updatedPassword, users[0].password), true);
  assert.equal(users[0].active, true);
  assert.equal(users[0].role, 'admin');
});

test('existing admin is repaired to the configured initial password when it does not match', async () => {
  const configuredPassword = makeTestPassword();
  const oldPassword = makeTestPassword();
  const existingAdmin = {
    id: 99,
    username: 'admin',
    role: 'admin',
    active: true,
    password: await bcrypt.hash(oldPassword, 10),
    async update(values) {
      Object.assign(existingAdmin, values);
    },
  };

  const previousPassword = process.env.INITIAL_ADMIN_PASSWORD;
  process.env.INITIAL_ADMIN_PASSWORD = configuredPassword;
  try {
    const result = await initializeInitialAdmin({
      userModel: {
        async findOne() {
          return existingAdmin;
        },
      },
    });

    assert.deepEqual(result, { created: false, userId: 99, passwordUpdated: true });
    assert.equal(await bcrypt.compare(configuredPassword, existingAdmin.password), true);
    assert.equal(await bcrypt.compare(oldPassword, existingAdmin.password), false);
  } finally {
    if (previousPassword === undefined) delete process.env.INITIAL_ADMIN_PASSWORD;
    else process.env.INITIAL_ADMIN_PASSWORD = previousPassword;
  }
});

test('existing inactive or malformed-hash admin is rejected without mutation or duplication', async () => {
  const previousPassword = process.env.INITIAL_ADMIN_PASSWORD;
  process.env.INITIAL_ADMIN_PASSWORD = testPassword;
  let createCalls = 0;
  const inactiveAdmin = {
    id: 9,
    username: 'admin',
    role: 'admin',
    active: false,
    password: await bcrypt.hash(testPassword, 4),
  };
  const inactiveAdminHash = inactiveAdmin.password;
  const malformedHashAdmin = { ...inactiveAdmin, active: true, password: 'not-a-bcrypt-hash' };
  try {
    await assert.rejects(initializeInitialAdmin({
      userModel: {
        async findOne() { return inactiveAdmin; },
        async create() { createCalls += 1; },
      },
    }), /failed verification/);

    await assert.rejects(initializeInitialAdmin({
      userModel: {
        async findOne() { return malformedHashAdmin; },
        async create() { createCalls += 1; },
      },
    }), /failed verification/);
  } finally {
    if (previousPassword === undefined) delete process.env.INITIAL_ADMIN_PASSWORD;
    else process.env.INITIAL_ADMIN_PASSWORD = previousPassword;
  }

  assert.equal(inactiveAdmin.active, false);
  assert.equal(inactiveAdmin.password, inactiveAdminHash);
  assert.equal(malformedHashAdmin.password, 'not-a-bcrypt-hash');
  assert.equal(createCalls, 0);
});

test('initial admin initialization requires a configured secret', async () => {
  const previousPassword = process.env.INITIAL_ADMIN_PASSWORD;
  delete process.env.INITIAL_ADMIN_PASSWORD;
  try {
    await assert.rejects(initializeInitialAdmin({ userModel: {} }), /INITIAL_ADMIN_PASSWORD/);
  } finally {
    if (previousPassword !== undefined) process.env.INITIAL_ADMIN_PASSWORD = previousPassword;
  }
});

test('admin password repair updates only the password of the existing active admin', async () => {
  const user = await makeUser();
  const nextPassword = makeTestPassword();
  let updateCalls = 0;
  let createCalls = 0;
  user.update = async function update(values, options) {
    updateCalls += 1;
    assert.deepEqual(Object.keys(values), ['password']);
    assert.equal(options.silent, true);
    Object.assign(this, values);
  };

  const result = await repairExistingAdminPassword({
    userModel: {
      async findOne({ where }) {
        assert.deepEqual(where, { username: 'admin' });
        return user;
      },
      async create() { createCalls += 1; },
    },
    password: nextPassword,
    settings: {
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_lowercase: true,
      password_require_numbers: true,
      password_require_special: true,
    },
  });

  assert.deepEqual(result, { userId: user.id, changed: true });
  assert.equal(await bcrypt.compare(nextPassword, user.password), true);
  assert.equal(user.role, 'admin');
  assert.equal(updateCalls, 1);
  assert.equal(createCalls, 0);
});

test('admin password repair refuses missing, inactive, or non-admin accounts', async () => {
  const password = makeTestPassword();
  const settings = {
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_numbers: true,
    password_require_special: true,
  };

  await assert.rejects(repairExistingAdminPassword({ userModel: { async findOne() { return null; } }, password, settings }), /was not found/);

  const inactiveAdmin = await makeUser({ active: false });
  await assert.rejects(repairExistingAdminPassword({ userModel: { async findOne() { return inactiveAdmin; } }, password, settings }), /inactive or does not have the admin role/);

  const nonAdmin = { ...(await makeUser()), role: 'store_manager' };
  await assert.rejects(repairExistingAdminPassword({ userModel: { async findOne() { return nonAdmin; } }, password, settings }), /inactive or does not have the admin role/);
});