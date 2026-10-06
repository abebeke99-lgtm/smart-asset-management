const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const models = require('../src/models');
const userController = require('../src/controllers/userController');
const authController = require('../src/controllers/authController');

test('admin-created user stores a bcrypt password and can log in normally', async () => {
  const originalFindOne = models.User.findOne;
  const originalFindAll = models.User.findAll;
  const originalCreate = models.User.create;
  const originalAuditCreate = models.AuditLog.create;
  const originalActivityCreate = models.UserActivityLog.create;
  const originalConfigFindByPk = models.Config.findByPk;
  const previousJwtSecret = process.env.JWT_SECRET;
  const password = 'ManageMe#42';
  let createdUser;

  process.env.JWT_SECRET = 'test-only-secret-for-admin-user-password-test';
  models.User.findOne = async () => createdUser || null;
  models.User.findAll = async () => [];
  models.User.create = async (values) => {
    createdUser = {
      id: 918273,
      ...values,
      failedLoginAttempts: 0,
      sessionVersion: 0,
      async update(changes) {
        Object.assign(this, changes);
        return this;
      },
      toJSON() {
        const { update, toJSON: toJSONMethod, ...safeFields } = this;
        return safeFields;
      },
    };
    return createdUser;
  };
  models.AuditLog.create = async () => ({ id: 1 });
  models.UserActivityLog.create = async () => ({ id: 1 });
  models.Config.findByPk = async (key) => key === 'role_permissions'
    ? { value: JSON.stringify({ staff: ['assets.view'] }) }
    : null;

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

  try {
    const createResponse = makeResponse();
    await userController.createUser({
      user: { id: 1, role: 'admin' },
      body: {
        name: 'New Staff Member',
        username: 'new.staff',
        email: 'new.staff@example.edu',
        phone: '0911000000',
        role: 'staff',
        collegeId: null,
        departmentId: null,
        status: 'Active',
        password,
        confirmPassword: password,
      },
    }, createResponse);

    assert.equal(createResponse.statusCode, 201);
    assert.equal(createdUser.username, 'new.staff');
    assert.equal(createdUser.role, 'staff');
    assert.equal(createdUser.fullName, 'New Staff Member');
    assert.notEqual(createdUser.password, password);
    assert.match(createdUser.password, /^\$2[aby]\$/);
    assert.equal(await bcrypt.compare(password, createdUser.password), true);
    assert.equal(Object.hasOwn(createResponse.payload.data, 'password'), false);
    assert.equal(Object.hasOwn(createResponse.payload.data, 'passwordHash'), false);

    models.User.findAll = async () => [createdUser];
    const loginResponse = makeResponse();
    await authController.login({
      body: { username: createdUser.username, password },
      headers: {},
      ip: '127.0.0.1',
    }, loginResponse);

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginResponse.payload.success, true);
    assert.equal(loginResponse.payload.user.email, createdUser.email);
    assert.deepEqual(loginResponse.payload.user.permissions, ['assets.view']);
    assert.equal(typeof loginResponse.payload.token, 'string');
    assert.equal(Object.hasOwn(loginResponse.payload.user, 'password'), false);
  } finally {
    models.User.findOne = originalFindOne;
    models.User.findAll = originalFindAll;
    models.User.create = originalCreate;
    models.AuditLog.create = originalAuditCreate;
    models.UserActivityLog.create = originalActivityCreate;
    models.Config.findByPk = originalConfigFindByPk;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  }
});

test('admin user creation rejects a missing or mismatched password confirmation', async () => {
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

  const missingConfirmation = makeResponse();
  await userController.createUser({ body: { password: 'ManageMe#42' } }, missingConfirmation);
  assert.equal(missingConfirmation.statusCode, 400);
  assert.equal(missingConfirmation.payload.message, 'Confirm Password is required');

  const mismatchedConfirmation = makeResponse();
  await userController.createUser({ body: { password: 'ManageMe#42', confirmPassword: 'OtherPass#42' } }, mismatchedConfirmation);
  assert.equal(mismatchedConfirmation.statusCode, 400);
  assert.equal(mismatchedConfirmation.payload.message, 'Password and Confirm Password must match');
});

test('admin user creation requires an explicit username and role', async () => {
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

  const missingUsername = makeResponse();
  await userController.createUser({ body: { fullName: 'New Staff', role: 'staff', password: 'ManageMe#42', confirmPassword: 'ManageMe#42' } }, missingUsername);
  assert.equal(missingUsername.statusCode, 400);
  assert.equal(missingUsername.payload.message, 'Username is required');

  const missingRole = makeResponse();
  await userController.createUser({ body: { fullName: 'New Staff', username: 'new.staff', password: 'ManageMe#42', confirmPassword: 'ManageMe#42' } }, missingRole);
  assert.equal(missingRole.statusCode, 400);
  assert.equal(missingRole.payload.message, 'Role is required');
});

test('admin user creation rejects duplicate username and email regardless of casing', async () => {
  const originalFindOne = models.User.findOne;
  const originalFindAll = models.User.findAll;
  const originalCreate = models.User.create;

  const existingUser = {
    id: 99,
    username: 'existing.user',
    email: 'existing.user@example.edu',
    role: 'staff',
    department: '',
  };

  models.User.findAll = async ({ where }) => {
    const candidates = Array.isArray(where[Op.or]) ? where[Op.or] : [];
    if (candidates.length === 0) return [];
    const matchUser = candidates.some((candidate) => {
      const rawUsername = String(candidate.username?.[Op.like] ?? candidate.username ?? '').replace(/^%|%$/g, '').trim().toLowerCase();
      const rawEmail = String(candidate.email?.[Op.like] ?? candidate.email ?? '').replace(/^%|%$/g, '').trim().toLowerCase();
      return rawUsername === existingUser.username.toLowerCase() || rawEmail === existingUser.email.toLowerCase();
    });
    return matchUser ? [existingUser] : [];
  };
  models.User.create = async () => { throw new Error('User.create should not be called for duplicate registration'); };

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

  try {
    const response = makeResponse();
    await userController.createUser({
      user: { id: 1, role: 'admin' },
      body: {
        fullName: 'Existing User',
        username: 'Existing.User',
        email: 'EXISTING.USER@example.edu',
        role: 'staff',
        password: 'ManageMe#42',
        confirmPassword: 'ManageMe#42',
      },
    }, response);

    assert.equal(response.statusCode, 409);
    assert.equal(response.payload.message, 'Username or email is already in use');
  } finally {
    models.User.findOne = originalFindOne;
    models.User.findAll = originalFindAll;
    models.User.create = originalCreate;
  }
});
