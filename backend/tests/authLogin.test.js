const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const { resolveLoginAliases, normalizeLoginIdentity, generateToken } = require('../src/controllers/authController');
const { findCollegeScopeForUser } = require('../src/middlewares/organizationScope');
const { normalizeOrganizationSettings, resolveOrganizationSettings } = require('../src/routes/adminSettingsRoutes');

test('normalizes canonical college and department-head roles without collapsing them together', () => {
  assert.deepEqual(normalizeLoginIdentity('college'), 'college');
  assert.deepEqual(normalizeLoginIdentity('Department Head'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('department_head'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('dept_head'), 'department_head');
  assert.deepEqual(normalizeLoginIdentity('ict officer'), 'ict_officer');
  assert.deepEqual(normalizeLoginIdentity('store manager'), 'store_manager');
});

test('resolves legacy login aliases while preserving the department_head role', () => {
  assert.deepEqual(resolveLoginAliases('department'), ['department', 'department_head', 'dept_head', 'department head']);
  assert.deepEqual(resolveLoginAliases('store manager'), ['store manager', 'store_manager', 'store-manager']);
  assert.deepEqual(resolveLoginAliases('ICT Officer'), ['ict officer', 'ict_officer', 'ict-officer', 'ict']);
});

test('always uses a MySQL database in development even when no MySQL config is provided', async () => {
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
    const { sequelize, getDatabaseConfig } = require('../src/config/database');
    const config = getDatabaseConfig();
    assert.equal(config.dialect, undefined);
    assert.equal(config.database, 'smart_asset_db');
    assert.equal(config.host, 'localhost');
    assert.equal(config.port, 3306);
    assert.equal(config.username, 'root');
    assert.equal(sequelize.getDialect(), 'mysql');
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

test('organization settings normalize legacy admin form keys to the canonical system config fields', () => {
  const normalized = normalizeOrganizationSettings({
    orgName: 'Mekdela Amba University',
    instName: 'Mekdela Amba University',
    orgCode: 'MAU',
    logo: 'https://example.edu.et/logo.png',
    website: 'https://example.edu.et',
    email: 'info@example.edu.et',
    phone: '+251911000000',
    address: 'Tulu Awliya, Ethiopia'
  });

  assert.deepEqual(normalized, {
    university_name: 'Mekdela Amba University',
    institution_name: 'Mekdela Amba University',
    organization_code: 'MAU',
    logo_url: 'https://example.edu.et/logo.png',
    website: 'https://example.edu.et',
    contact_email: 'info@example.edu.et',
    contact_phone: '+251911000000',
    address: 'Tulu Awliya, Ethiopia'
  });

  assert.deepEqual(resolveOrganizationSettings({
    university_name: 'Mekdela Amba University',
    institution_name: 'Mekdela Amba University',
    organization_code: 'MAU',
    logo_url: 'https://example.edu.et/logo.png',
    website: 'https://example.edu.et',
    contact_email: 'info@example.edu.et',
    contact_phone: '+251911000000',
    address: 'Tulu Awliya, Ethiopia'
  }), {
    orgName: 'Mekdela Amba University',
    instName: 'Mekdela Amba University',
    orgCode: 'MAU',
    logo: 'https://example.edu.et/logo.png',
    website: 'https://example.edu.et',
    email: 'info@example.edu.et',
    phone: '+251911000000',
    address: 'Tulu Awliya, Ethiopia'
  });
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
  const middlewareSource = fs.readFileSync(path.resolve(__dirname, '../src/middlewares/requestMetrics.js'), 'utf8');
  assert.match(routeSource, /requireRole\('admin'\)/);
  assert.match(routeSource, /router\.get\('\/overview'/);
  assert.match(routeSource, /router\.get\('\/performance'/);
  assert.match(routeSource, /router\.post\('\/alerts\/:id\/acknowledge'/);
  assert.match(routeSource, /router\.post\('\/alerts\/:id\/resolve'/);
  assert.match(middlewareSource, /process\.hrtime\.bigint/);
});

test('system health overview includes real application, database, API, server and storage statuses', async () => {
  const { getOverview } = require('../src/services/systemMonitoringService');
  const overview = await getOverview();
  assert.ok(overview);
  assert.ok(overview.application && typeof overview.application.status === 'string');
  assert.ok(overview.database && typeof overview.database.status === 'string');
  assert.ok(overview.api && typeof overview.api.status === 'string');
  assert.ok(overview.server && typeof overview.server.status === 'string');
  assert.ok(overview.storage && typeof overview.storage.status === 'string');
  assert.ok(['healthy', 'warning', 'degraded', 'critical', 'unknown'].includes(overview.overall.status));
  assert.ok(overview.application.startedAt || overview.application.uptimeSeconds !== undefined);
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

test('store manager routes expose a real verification workflow using the existing session model', () => {
  const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/storeRoutes.js'), 'utf8');
  assert.match(routeSource, /router\.get\('\/verification'/);
  assert.match(routeSource, /router\.post\('\/verification'/);
  assert.match(routeSource, /router\.get\('\/verification\/:id'/);
  assert.match(routeSource, /router\.post\('\/verification\/:id\/items'/);
  assert.match(routeSource, /router\.post\('\/verification\/:id\/submit'/);
  assert.match(routeSource, /router\.post\('\/verification\/:id\/finalize'/);
});

test('college verification routes enforce college-scoped pagination, filters, and ownership checks', () => {
  const collegeRoutes = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
  const collegeController = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');
  assert.match(collegeRoutes, /router\.get\('\/verification'/);
  assert.match(collegeRoutes, /router\.post\('\/verification'/);
  assert.match(collegeRoutes, /router\.get\('\/verification\/:id'/);
  assert.match(collegeRoutes, /router\.post\('\/verification\/:id\/items'/);
  assert.match(collegeController, /listCollegeVerification/);
  assert.match(collegeController, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/);
  assert.match(collegeController, /page.*limit.*totalPages|totalPages/);
  assert.match(collegeController, /departmentId[\s\S]*assetStatus[\s\S]*location/);
});
