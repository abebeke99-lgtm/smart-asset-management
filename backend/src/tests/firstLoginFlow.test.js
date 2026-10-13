const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User, VerificationCode, Config, sequelize, UserActivityLog, AuditLog, Role, UserRole } = require('../models');
const { generateToken, login } = require('../controllers/authController');
const { completeFirstLogin } = require('../controllers/firstLoginController');
const { verifyVerificationCode } = require('../services/verificationCodeService');
const { denyFirstLoginTokenOutsideFlow } = require('../middlewares/auth');
const { getJwtSecret } = require('../config/jwt');

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('the verification model and existing-user migration default preserve normal accounts', () => {
  assert.equal(User.rawAttributes.mustChangePassword.defaultValue, false);
  assert.equal(User.rawAttributes.emailVerifiedAt.allowNull, true);
  assert.equal(User.rawAttributes.phoneVerifiedAt.allowNull, true);
  assert.equal(VerificationCode.rawAttributes.codeHash.field, 'code_hash');
  assert.deepEqual(VerificationCode.rawAttributes.purpose.type.values, ['first_login', 'forgot_password']);
});

test('first-login JWT is short scoped and a scoped token is denied outside the flow', async () => {
  const token = await generateToken({ id: 21, sessionVersion: 0, role: 'admin' }, { scope: 'first_login' });
  const claims = jwt.verify(token, getJwtSecret({ allowFallback: true }));
  assert.equal(claims.scope, 'first_login');
  assert.equal(claims.role, undefined);
  assert.ok(claims.exp - claims.iat <= 15 * 60);

  let nextCalled = false;
  const denied = makeResponse();
  denyFirstLoginTokenOutsideFlow({
    headers: { authorization: `Bearer ${token}` },
    baseUrl: '/api',
    path: '/users/profile',
  }, denied, () => { nextCalled = true; });
  assert.equal(denied.statusCode, 403);
  assert.equal(nextCalled, false);

  let allowed = false;
  denyFirstLoginTokenOutsideFlow({
    headers: { authorization: `Bearer ${token}` },
    baseUrl: '/api',
    path: '/auth/first-login/complete',
  }, makeResponse(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test('new accounts receive a first-login token while existing users retain normal login', async (t) => {
  const originals = {
    findOne: User.findOne,
    configFindByPk: Config.findByPk,
    activityCreate: UserActivityLog.create,
    auditCreate: AuditLog.create,
    roleFindOne: Role.findOne,
    userRoleFindAll: UserRole.findAll,
  };
  let mustChangePassword = true;
  const user = {
    id: 24,
    username: 'new-user',
    email: 'new-user@example.edu',
    fullName: 'New User',
    role: 'maintenance',
    department: 'Facilities',
    collegeId: null,
    departmentId: null,
    phone: '',
    active: true,
    status: 'active',
    password: await bcrypt.hash('Temporary1!', 4),
    sessionVersion: 0,
    failedLoginAttempts: 0,
    forcePasswordChange: false,
    get mustChangePassword() { return mustChangePassword; },
    update: async (values) => Object.assign(user, values),
  };
  User.findOne = async () => user;
  Config.findByPk = async () => null;
  UserActivityLog.create = async () => ({});
  AuditLog.create = async () => ({});
  Role.findOne = async () => null;
  UserRole.findAll = async () => [];
  t.after(() => {
    User.findOne = originals.findOne;
    Config.findByPk = originals.configFindByPk;
    UserActivityLog.create = originals.activityCreate;
    AuditLog.create = originals.auditCreate;
    Role.findOne = originals.roleFindOne;
    UserRole.findAll = originals.userRoleFindAll;
  });

  const req = { body: { username: 'new-user', password: 'Temporary1!' }, headers: {}, ip: '127.0.0.1' };
  const firstLoginResponse = makeResponse();
  await login(req, firstLoginResponse);
  assert.equal(firstLoginResponse.payload.requiresFirstLogin, true);
  assert.equal(jwt.decode(firstLoginResponse.payload.token).scope, 'first_login');
  assert.deepEqual(firstLoginResponse.payload.user.contactMethods, [{ channel: 'email', masked: 'n***@example.edu' }]);

  mustChangePassword = false;
  const existingResponse = makeResponse();
  await login(req, existingResponse);
  assert.equal(existingResponse.payload.requiresFirstLogin, undefined);
  assert.equal(jwt.decode(existingResponse.payload.token).scope, undefined);
  assert.equal(existingResponse.payload.user.role, 'maintenance');
});

test('verification code rejects expired and wrong codes and locks after five attempts', async (t) => {
  const originalFindOne = VerificationCode.findOne;
  let record;
  VerificationCode.findOne = async ({ where }) => {
    assert.equal(where.userId, 5);
    return record?.usedAt ? null : record;
  };
  t.after(() => { VerificationCode.findOne = originalFindOne; });

  record = {
    codeHash: hashCode('123456'),
    expiresAt: new Date(Date.now() - 1),
    attempts: 0,
  };
  assert.deepEqual(await verifyVerificationCode({ userId: 5, channel: 'email', purpose: 'first_login', code: '123456' }), {
    valid: false,
    reason: 'expired',
  });

  record.expiresAt = new Date(Date.now() + 60000);
  record.update = async (values) => Object.assign(record, values);
  for (let attempt = 1; attempt < 5; attempt += 1) {
    const result = await verifyVerificationCode({ userId: 5, channel: 'email', purpose: 'first_login', code: '000000' });
    assert.equal(result.reason, 'invalid');
    assert.equal(record.attempts, attempt);
  }
  const finalAttempt = await verifyVerificationCode({ userId: 5, channel: 'email', purpose: 'first_login', code: '000000' });
  assert.equal(finalAttempt.reason, 'attempts');
  assert.ok(record.usedAt);
});

test('weak new password is rejected before password, code, or user mutation', async () => {
  const res = makeResponse();
  await completeFirstLogin({
    user: { id: 8 },
    body: { channel: 'email', code: '123456', newPassword: 'weakpass1', confirmPassword: 'weakpass1' },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /uppercase and lowercase/);
});

test('successful first-login completion consumes the code, clears the gate, and returns a normal token', async (t) => {
  const originals = {
    findByPk: User.findByPk,
    transaction: sequelize.transaction,
    findOne: VerificationCode.findOne,
    updateCode: VerificationCode.update,
    findConfig: Config.findByPk,
    roleFindOne: Role.findOne,
    userRoleFindAll: UserRole.findAll,
  };
  const user = {
    id: 12,
    username: 'maint-user',
    email: 'm***@university.edu',
    fullName: 'Maintenance User',
    role: 'maintenance',
    department: 'Facilities',
    collegeId: 4,
    departmentId: 7,
    active: true,
    mustChangePassword: true,
    sessionVersion: 2,
    password: await bcrypt.hash('Temporary1!', 4),
    update: async function update(values) { Object.assign(this, values); return this; },
  };
  const codeRecord = {
    id: 99,
    codeHash: hashCode('654321'),
    expiresAt: new Date(Date.now() + 60000),
    attempts: 0,
  };
  User.findByPk = async () => user;
  sequelize.transaction = async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } });
  VerificationCode.findOne = async () => (codeRecord.usedAt ? null : codeRecord);
  VerificationCode.update = async (values) => {
    if (values.usedAt) codeRecord.usedAt = values.usedAt;
    return [1];
  };
  Config.findByPk = async () => null;
  Role.findOne = async () => null;
  UserRole.findAll = async () => [];
  t.after(() => {
    User.findByPk = originals.findByPk;
    sequelize.transaction = originals.transaction;
    VerificationCode.findOne = originals.findOne;
    VerificationCode.update = originals.updateCode;
    Config.findByPk = originals.findConfig;
    Role.findOne = originals.roleFindOne;
    UserRole.findAll = originals.userRoleFindAll;
  });

  const res = makeResponse();
  await completeFirstLogin({
    user: { id: user.id },
    requestId: 'first-login-test',
    body: { channel: 'email', code: '654321', newPassword: 'StrongPass1!', confirmPassword: 'StrongPass1!' },
  }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(user.mustChangePassword, false);
  assert.equal(user.sessionVersion, 3);
  assert.ok(user.passwordChangedAt);
  assert.ok(user.emailVerifiedAt);
  assert.ok(codeRecord.usedAt);
  assert.equal(jwt.decode(res.payload.token).scope, undefined);
  assert.equal(res.payload.user.role, 'maintenance');
  assert.deepEqual(await verifyVerificationCode({
    userId: user.id,
    channel: 'email',
    purpose: 'first_login',
    code: '654321',
  }), { valid: false, reason: 'expired' });
});
