const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const { resolveLoginAliases, normalizeLoginIdentity, generateToken } = require('../src/controllers/authController');
const { findCollegeScopeForUser } = require('../src/middlewares/organizationScope');

test('normalizes canonical college role and legacy department assignments', () => {
  assert.deepEqual(normalizeLoginIdentity('college'), 'college');
  assert.deepEqual(normalizeLoginIdentity('Department Head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('department_head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('dept_head'), 'college');
  assert.deepEqual(normalizeLoginIdentity('ict officer'), 'ict_officer');
  assert.deepEqual(normalizeLoginIdentity('store manager'), 'store_manager');
});

test('resolves legacy login aliases while preserving the college role', () => {
  assert.deepEqual(resolveLoginAliases('department'), ['department', 'college', 'department_head', 'dept_head', 'department head']);
  assert.deepEqual(resolveLoginAliases('store manager'), ['store manager', 'store_manager', 'store-manager']);
  assert.deepEqual(resolveLoginAliases('ICT Officer'), ['ict officer', 'ict_officer', 'ict-officer', 'ict']);
});

test('uses a local SQLite database in development when no MySQL config is provided', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDbHost = process.env.DB_HOST;
  const previousDbName = process.env.DB_NAME;
  const previousDbUser = process.env.DB_USER;
  const previousDbPassword = process.env.DB_PASSWORD;
  const previousDbPort = process.env.DB_PORT;

  process.env.NODE_ENV = 'development';
  delete process.env.DB_HOST;
  delete process.env.DB_NAME;
  delete process.env.DB_USER;
  delete process.env.DB_PASSWORD;
  delete process.env.DB_PORT;

  delete require.cache[require.resolve('../src/config/database')];

  try {
    const { getDatabaseConfig, isSqliteEnabled } = require('../src/config/database');
    const config = getDatabaseConfig();
    assert.equal(isSqliteEnabled, true);
    assert.equal(config.dialect, 'sqlite');
    assert.match(config.storage, /smart_asset_dev\.sqlite$/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDbHost === undefined) delete process.env.DB_HOST; else process.env.DB_HOST = previousDbHost;
    if (previousDbName === undefined) delete process.env.DB_NAME; else process.env.DB_NAME = previousDbName;
    if (previousDbUser === undefined) delete process.env.DB_USER; else process.env.DB_USER = previousDbUser;
    if (previousDbPassword === undefined) delete process.env.DB_PASSWORD; else process.env.DB_PASSWORD = previousDbPassword;
    if (previousDbPort === undefined) delete process.env.DB_PORT; else process.env.DB_PORT = previousDbPort;
    delete require.cache[require.resolve('../src/config/database')];
  }
});

test('accepts infrastructure as a canonical login identity', () => {
  assert.equal(normalizeLoginIdentity('infrastructure'), 'infrastructure');
  assert.equal(normalizeLoginIdentity('Infrastructure Directorate'), 'infrastructure');
  assert.deepEqual(resolveLoginAliases('infrastructure'), ['infrastructure', 'infrastructure_directorate', 'infra', 'infrastructure directorate']);
});

test('admin support router keeps college governance status-based instead of exposing destructive delete', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSupportRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.patch\('\/colleges\/\:id\/status'/);
  assert.doesNotMatch(routeSource, /router\.delete\('\/colleges\/\:id'/);
});

test('analytics routes expose protected asset and system aggregation contracts', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/analyticsRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/analytics\/assets'/);
  assert.match(routeSource, /router\.get\('\/analytics\/system'/);
  assert.match(routeSource, /requireRole\('admin'\)/);
  assert.match(routeSource, /router\.get\('\/analytics\/export'/);
});

test('admin college routes expose manager candidates, detail dashboard, pagination, and governance validation', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSupportRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/colleges\/manager-candidates'/);
  assert.match(routeSource, /role: 'college', active: true/);
  assert.match(routeSource, /router\.get\('\/colleges\/:id\/dashboard'/);
  assert.match(routeSource, /totalPages/);
  assert.match(routeSource, /COLLEGE_MANAGER_ASSIGNED/);
  assert.match(routeSource, /College Manager must be an active user with role college/);
});

test('admin notification architecture uses a separate protected route and delivery tracking', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminNotificationRoutes.js'), 'utf8');
  const modelSource = fs.readFileSync(path.resolve(__dirname, '../src/models/NotificationDelivery.js'), 'utf8');
  assert.match(routeSource, /requireRole\('admin'\)/);
  assert.match(routeSource, /router\.get\('\/notifications'/);
  assert.match(routeSource, /router\.post\('\/notifications\/bulk'/);
  assert.match(routeSource, /router\.post\('\/notifications\/:id\/retry'/);
  assert.match(modelSource, /providerMessageId/);
  assert.match(modelSource, /failedAt/);
});

test('email and SMS providers report unavailable configuration instead of fake success', async () => {
  const { validateEmailConfiguration } = require('../src/services/emailService');
  const { sendSMS } = require('../src/services/smsService');
  const previousEmailHost = process.env.EMAIL_HOST;
  const previousSmtpHost = process.env.SMTP_HOST;
  const previousSmsProvider = process.env.SMS_PROVIDER;
  delete process.env.EMAIL_HOST;
  delete process.env.SMTP_HOST;
  delete process.env.SMS_PROVIDER;
  assert.equal(validateEmailConfiguration().valid, false);
  assert.equal((await sendSMS('0912345678', 'test')).status, 'failed');
  if (previousEmailHost === undefined) delete process.env.EMAIL_HOST; else process.env.EMAIL_HOST = previousEmailHost;
  if (previousSmtpHost === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = previousSmtpHost;
  if (previousSmsProvider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = previousSmsProvider;
});

test('admin settings exposes section persistence, profile security, health, and integrity contracts', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminSettingsRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/settings'/);
  assert.match(routeSource, /router\.put\('\/settings\/\:section'/);
  assert.match(routeSource, /router\.post\('\/settings\/profile\/change-password'/);
  assert.match(routeSource, /router\.get\('\/system\/health'/);
  assert.match(routeSource, /router\.get\('\/system\/integrity'/);
  assert.match(routeSource, /SETTINGS_SECTION_UPDATED/);
});

test('admin role governance persists permission matrices and protects core administrator access', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminRoleRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/roles'/);
  assert.match(routeSource, /router\.get\('\/permissions'/);
  assert.match(routeSource, /router\.put\('\/roles\/\:role\/permissions'/);
  assert.match(routeSource, /role_permissions/);
  assert.match(routeSource, /administrator role must retain governance permissions/);
});

test('system monitoring exposes admin-only health, performance, resources, history, and alert workflows', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/systemMonitoringRoutes.js'), 'utf8');
  const middlewareSource = fs.readFileSync(path.resolve(__dirname, '../src/middleware/requestMetrics.js'), 'utf8');
  assert.match(routeSource, /requireRole\('admin'\)/);
  assert.match(routeSource, /router\.get\('\/overview'/);
  assert.match(routeSource, /router\.get\('\/performance'/);
  assert.match(routeSource, /router\.post\('\/alerts\/:id\/acknowledge'/);
  assert.match(routeSource, /router\.post\('\/alerts\/:id\/resolve'/);
  assert.match(middlewareSource, /process\.hrtime\.bigint/);
});

test('generateToken carries organization scope fields needed by the protected college flow', async () => {
  const token = await generateToken({
    id: 42,
    role: 'college',
    email: 'college@example.com',
    sessionVersion: 0,
    collegeId: 7,
    departmentId: 11,
  });
  const payload = jwt.decode(token);
  assert.equal(payload.collegeId, 7);
  assert.equal(payload.departmentId, 11);
});

test('college scope lookup resolves the only available college for a college manager when no assignment is present', async () => {
  assert.equal(typeof findCollegeScopeForUser, 'function');
  const scope = await findCollegeScopeForUser({
    id: 99,
    role: 'college',
    department: 'Engineering',
    collegeId: null,
  });
  assert.ok(scope && Number.isInteger(scope.collegeId));
  assert.equal(scope.collegeId, scope.college.id);
  assert.ok(scope.college);
});
