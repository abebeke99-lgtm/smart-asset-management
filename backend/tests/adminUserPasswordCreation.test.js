const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const { Op } = require('sequelize');
const path = require('node:path');

const models = require('../src/models');
const userController = require('../src/controllers/userController');
const authController = require('../src/controllers/authController');
const { requirePermission, requireRole } = require('../src/middlewares/auth');

test('admin-created user stores a bcrypt password and can log in normally', async () => {
  const originalFindOne = models.User.findOne;
  const originalFindAll = models.User.findAll;
  const originalCreate = models.User.create;
  const originalAuditCreate = models.AuditLog.create;
  const originalActivityCreate = models.UserActivityLog.create;
  const originalConfigFindByPk = models.Config.findByPk;
  const originalRoleFindOne = models.Role.findOne;
  const originalTransaction = models.sequelize.transaction;
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
  models.Role.findOne = async () => ({ name: 'staff', active: true });
  models.sequelize.transaction = async (callback) => callback({ id: 'test-transaction' });
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
    models.Role.findOne = originalRoleFindOne;
    models.sequelize.transaction = originalTransaction;
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

  const missingName = makeResponse();
  await userController.createUser({
    body: {
      username: 'new.staff',
      role: 'staff',
      password: 'ManageMe#42',
      confirmPassword: 'ManageMe#42',
    },
  }, missingName);
  assert.equal(missingName.statusCode, 400);
  assert.equal(missingName.payload.message, 'Full name is required');
});

test('admin user creation rejects invalid email, unsupported password, and inactive database roles', async (t) => {
  const originalRoleFindOne = models.Role.findOne;
  const originalTransaction = models.sequelize.transaction;
  const originalConfigFindByPk = models.Config.findByPk;
  let transactionCalls = 0;

  models.Role.findOne = async () => null;
  models.sequelize.transaction = async (callback) => {
    transactionCalls += 1;
    return callback({ id: 'test-transaction' });
  };
  models.Config.findByPk = async () => null;
  t.after(() => {
    models.Role.findOne = originalRoleFindOne;
    models.sequelize.transaction = originalTransaction;
    models.Config.findByPk = originalConfigFindByPk;
  });

  const makeResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  });
  const body = {
    fullName: 'New Staff',
    username: 'new.staff',
    role: 'staff',
    password: 'weakpass',
    confirmPassword: 'weakpass',
  };
  const invalidEmail = makeResponse();
  await userController.createUser({
    user: { id: 1, role: 'admin' },
    body: { ...body, email: 'not-an-email', password: 'ManageMe#42', confirmPassword: 'ManageMe#42' },
  }, invalidEmail);
  assert.equal(invalidEmail.statusCode, 400);
  assert.equal(invalidEmail.payload.message, 'Invalid email address');

  const weakPassword = makeResponse();
  await userController.createUser({ user: { id: 1, role: 'admin' }, body }, weakPassword);
  assert.equal(weakPassword.statusCode, 400);
  assert.match(weakPassword.payload.message, /uppercase/i);
  assert.equal(transactionCalls, 0);

  const inactiveRole = makeResponse();
  await userController.createUser({
    user: { id: 1, role: 'admin' },
    body: { ...body, password: 'ManageMe#42', confirmPassword: 'ManageMe#42' },
  }, inactiveRole);
  assert.equal(inactiveRole.statusCode, 400);
  assert.equal(inactiveRole.payload.message, 'Invalid or inactive user role');
  assert.equal(JSON.stringify(inactiveRole.payload).includes('ManageMe#42'), false);
  assert.equal(transactionCalls, 1);
});

test('user creation API requires an authenticated admin with users.create permission', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/userRoutes.js'), 'utf8');
  assert.ok(source.includes("router.post('/', requireAuth, requireRole('admin'), requirePermission('users.create'), createUser);"));

  const makeResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  });
  const wrongRoleResponse = makeResponse();
  let nextCalled = false;
  requireRole('admin')({ user: { id: 2, role: 'staff', permissions: [] } }, wrongRoleResponse, () => { nextCalled = true; });
  assert.equal(wrongRoleResponse.statusCode, 403);
  assert.equal(nextCalled, false);

  const missingPermissionResponse = makeResponse();
  requirePermission('users.create')({ user: { id: 1, role: 'admin', permissions: [] } }, missingPermissionResponse, () => { nextCalled = true; });
  assert.equal(missingPermissionResponse.statusCode, 403);
  assert.equal(nextCalled, false);

  const noAuthResponse = makeResponse();
  requireRole('admin')({}, noAuthResponse, () => { nextCalled = true; });
  assert.equal(noAuthResponse.statusCode, 401);
  assert.equal(nextCalled, false);
});

test('admin user creation rejects duplicate username and email regardless of casing', async () => {
  const originalFindOne = models.User.findOne;
  const originalFindAll = models.User.findAll;
  const originalCreate = models.User.create;
  const originalRoleFindOne = models.Role.findOne;
  const originalTransaction = models.sequelize.transaction;
  const originalConfigFindByPk = models.Config.findByPk;

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
  models.Role.findOne = async () => ({ name: 'staff', active: true });
  models.sequelize.transaction = async (callback) => callback({ id: 'test-transaction' });
  models.Config.findByPk = async () => null;
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

    const duplicateEmailResponse = makeResponse();
    await userController.createUser({
      user: { id: 1, role: 'admin' },
      body: {
        fullName: 'Another User',
        username: 'different.username',
        email: 'EXISTING.USER@example.edu',
        role: 'staff',
        password: 'ManageMe#42',
        confirmPassword: 'ManageMe#42',
      },
    }, duplicateEmailResponse);
    assert.equal(duplicateEmailResponse.statusCode, 409);
  } finally {
    models.User.findOne = originalFindOne;
    models.User.findAll = originalFindAll;
    models.User.create = originalCreate;
    models.Role.findOne = originalRoleFindOne;
    models.sequelize.transaction = originalTransaction;
    models.Config.findByPk = originalConfigFindByPk;
  }
});

test('admin user creation validates database-backed role and organization IDs and keeps writes whitelisted', async (t) => {
  const originalRoleFindOne = models.Role.findOne;
  const originalCollegeFindByPk = models.College.findByPk;
  const originalDepartmentFindByPk = models.Department.findByPk;
  const originalUserFindAll = models.User.findAll;
  const originalUserCreate = models.User.create;
  const originalAuditCreate = models.AuditLog.create;
  const originalActivityCreate = models.UserActivityLog.create;
  const originalConfigFindByPk = models.Config.findByPk;
  const originalTransaction = models.sequelize.transaction;
  const transaction = { id: 'test-transaction' };
  let createValues;
  let createOptions;
  let departmentLookupCount = 0;
  let collegeLookupCount = 0;

  models.Role.findOne = async ({ where, transaction: usedTransaction }) => {
    assert.deepEqual(where, { name: 'staff', active: true });
    assert.equal(usedTransaction, transaction);
    return { name: 'staff', active: true };
  };
  models.College.findByPk = async (id, options) => {
    collegeLookupCount += 1;
    assert.equal(options.transaction, transaction);
    return Number(id) === 3 ? { id: 3 } : null;
  };
  models.Department.findByPk = async (id, options) => {
    departmentLookupCount += 1;
    assert.equal(options.transaction, transaction);
    return Number(id) === 8 ? { id: 8, name: 'Computer Science', collegeId: 3 } : null;
  };
  models.User.findAll = async () => [];
  models.User.create = async (values, options) => {
    createValues = values;
    createOptions = options;
    return {
      id: 81,
      ...values,
      toJSON() { return { ...this }; },
    };
  };
  models.AuditLog.create = async (_values, options) => {
    assert.equal(options.transaction, transaction);
    return { id: 1 };
  };
  models.UserActivityLog.create = async (_values, options) => {
    assert.equal(options.transaction, transaction);
    return { id: 1 };
  };
  models.sequelize.transaction = async (callback) => callback(transaction);
  models.Config.findByPk = async () => null;

  t.after(() => {
    models.Role.findOne = originalRoleFindOne;
    models.College.findByPk = originalCollegeFindByPk;
    models.Department.findByPk = originalDepartmentFindByPk;
    models.User.findAll = originalUserFindAll;
    models.User.create = originalUserCreate;
    models.AuditLog.create = originalAuditCreate;
    models.UserActivityLog.create = originalActivityCreate;
    models.Config.findByPk = originalConfigFindByPk;
    models.sequelize.transaction = originalTransaction;
  });

  const makeResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  });
  const validRequest = {
    user: { id: 1, role: 'admin', username: 'admin' },
    body: {
      fullName: 'New Staff Member',
      username: 'new.staff.organization',
      email: 'new.staff.organization@example.edu',
      role: 'staff',
      collegeId: '3',
      departmentId: '8',
      status: 'inactive',
      password: 'ManageMe#42',
      confirmPassword: 'ManageMe#42',
      active: true,
      passwordHash: 'untrusted-field',
    },
  };
  const response = makeResponse();
  await userController.createUser(validRequest, response);

  assert.equal(response.statusCode, 201);
  assert.equal(createOptions.transaction, transaction);
  assert.deepEqual(Object.keys(createValues).sort(), [
    'active', 'collegeId', 'department', 'departmentId', 'email', 'fullName', 'password', 'phone', 'role', 'status', 'username',
  ]);
  assert.equal(createValues.collegeId, 3);
  assert.equal(createValues.departmentId, 8);
  assert.equal(createValues.department, 'Computer Science');
  assert.equal(createValues.status, 'inactive');
  assert.equal(createValues.active, false);
  assert.notEqual(createValues.password, validRequest.body.password);
  assert.equal(Object.hasOwn(response.payload.data, 'password'), false);
  assert.equal(Object.hasOwn(response.payload.data, 'passwordHash'), false);

  const invalidCollege = makeResponse();
  await userController.createUser({
    ...validRequest,
    body: { ...validRequest.body, username: 'invalid.college.user', collegeId: 'not-an-id' },
  }, invalidCollege);
  assert.equal(invalidCollege.statusCode, 400);
  assert.match(invalidCollege.payload.message, /college id/i);

  const invalidDepartment = makeResponse();
  await userController.createUser({
    ...validRequest,
    body: { ...validRequest.body, username: 'invalid.department.user', departmentId: '99' },
  }, invalidDepartment);
  assert.equal(invalidDepartment.statusCode, 400);
  assert.equal(invalidDepartment.payload.message, 'Department not found');

  const invalidCollegeRecord = makeResponse();
  await userController.createUser({
    ...validRequest,
    body: { ...validRequest.body, username: 'invalid.college.record', collegeId: '99' },
  }, invalidCollegeRecord);
  assert.equal(invalidCollegeRecord.statusCode, 400);
  assert.equal(invalidCollegeRecord.payload.message, 'College not found');

  const mismatchedDepartment = makeResponse();
  models.Department.findByPk = async () => ({ id: 8, name: 'Computer Science', collegeId: 4 });
  await userController.createUser({
    ...validRequest,
    body: { ...validRequest.body, username: 'mismatched.department.user' },
  }, mismatchedDepartment);
  assert.equal(mismatchedDepartment.statusCode, 400);
  assert.match(mismatchedDepartment.payload.message, /does not belong/i);
  assert.ok(departmentLookupCount > 0);
  assert.ok(collegeLookupCount > 0);
});
