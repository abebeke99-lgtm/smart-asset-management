const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Config, AuditLog } = require('../src/models');
const { login } = require('../src/controllers/authController');
const { initializeInitialAdmin } = require('../src/services/initialAdminService');

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
    jwtSecret: process.env.JWT_SECRET,
  };

  User.findOne = async (options) => {
    queryOptions = options;
    return user;
  };
  Config.findByPk = async () => null;
  AuditLog.create = async () => ({});
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
      const user = { id: createCalls, ...values };
      users.push(user);
      return user;
    },
  };

  const previousPassword = process.env.INITIAL_ADMIN_PASSWORD;
  process.env.INITIAL_ADMIN_PASSWORD = testPassword;
  let first;
  let second;
  let firstHash;
  try {
    first = await initializeInitialAdmin({ userModel });
    firstHash = users[0].password;
    process.env.INITIAL_ADMIN_PASSWORD = makeTestPassword();
    second = await initializeInitialAdmin({ userModel });
  } finally {
    if (previousPassword === undefined) delete process.env.INITIAL_ADMIN_PASSWORD;
    else process.env.INITIAL_ADMIN_PASSWORD = previousPassword;
  }

  assert.deepEqual(first, { created: true, userId: 1 });
  assert.deepEqual(second, { created: false, userId: 1 });
  assert.equal(createCalls, 1);
  assert.equal(users.length, 1);
  assert.match(firstHash, /^\$2[aby]\$/);
  assert.equal(users[0].password, firstHash);
  assert.equal(await bcrypt.compare(testPassword, firstHash), true);
  assert.equal(users[0].active, true);
  assert.equal(users[0].role, 'admin');
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