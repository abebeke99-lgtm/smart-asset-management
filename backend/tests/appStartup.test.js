const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app startup initializes the backup service dependency required for server boot', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const backupService = require\('\.\/services\/backupService'\);/);
});

test('app startup completes database initialization before listening', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const startup = source.slice(source.indexOf('async function startServer()'));
  assert.ok(startup.indexOf('await initializeDatabase()') < startup.indexOf("app.listen(PORT, '0.0.0.0'"));
});

test('health endpoint checks database connectivity without querying users', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const healthHandlerStart = source.indexOf('const healthHandler =');
  const healthHandlerEnd = source.indexOf("app.get('/health', healthHandler)", healthHandlerStart);
  const healthHandler = source.slice(healthHandlerStart, healthHandlerEnd);
  assert.ok(healthHandlerStart >= 0);
  assert.ok(healthHandlerEnd > healthHandlerStart);
  assert.match(source, /await sequelize\.query\('SELECT 1'\)/);
  assert.match(source, /res\.status\(200\)\.json\(\{ status: 'ok', database: 'connected' \}\)/);
  assert.match(source, /res\.status\(503\)\.json\(\{ status: 'error', database: 'unavailable' \}\)/);
  assert.doesNotMatch(healthHandler, /User\.find/);
  assert.match(source, /app\.get\('\/health', healthHandler\)/);
});

test('production CORS accepts configured comma-separated origins without a wildcard', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /process\.env\.CORS_ORIGINS/);
  assert.match(source, /\.flatMap\(\(value\) => value\.split\(','\)\)/);
  assert.match(source, /\.map\(\(value\) => value\.trim\(\)\)/);
  assert.doesNotMatch(source, /productionFallbackOrigins/);
  assert.doesNotMatch(source, /origin:\s*['"]\*['"]/);
});

test('models are loaded before database synchronization is initialized', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.ok(source.indexOf("require('./models')") < source.indexOf("require('./config/sync')"));
});

test('admin user-management role options route is mounted under /api', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const userManagementOptionsRoutes = require\('\.\/routes\/userManagementOptionsRoutes'\);/);
  assert.match(source, /app\.use\('\/api', userManagementOptionsRoutes\);/);
});

test('administrator RFID tracking routes are mounted under their frontend API namespace', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const adminRfidRoutes = require\('\.\/routes\/adminRfidRoutes'\);/);
  assert.match(source, /app\.use\('\/api\/admin\/rfid', adminRfidRoutes\);/);
});

test('database schema sync runs in production and fails startup when initialization fails', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /schemaReady = await syncDatabase\(\)/);
  assert.match(source, /throw new Error\('Database initialization failed after retry limit\.'\)/);
  assert.match(source, /console\.log\('Database initialization completed\.'\)/);
});

test('asset QR schema repair runs even when general schema synchronization is skipped', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const skipSync = source.indexOf('if (skipSync)');
  const qrRepair = source.indexOf('if (schemaReady) await ensureQrCodeColumn();');
  const databaseReady = source.indexOf('if (databaseConnected && schemaReady)');
  assert.ok(skipSync >= 0);
  assert.ok(qrRepair > skipSync);
  assert.ok(databaseReady > qrRepair);
});

test('test startup does not bootstrap an admin with the local environment password', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /process\.env\.NODE_ENV !== 'test' && process\.env\.INITIAL_ADMIN_PASSWORD/);
});

test('schema initialization rejects startup if any registered model table is missing', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/config/sync.js'), 'utf8');
  assert.match(source, /const unresolvedTables = \[\]/);
  assert.match(source, /if \(unresolvedTables\.length > 0\) \{/);
  assert.match(source, /Database schema initialization could not create required table/);
});

test('duplicate-index repair query groups non-aggregated columns for MySQL strict mode', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/config/sync.js'), 'utf8');
  assert.match(source, /GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE/);
});

test('root production start and Railway deployment target the backend', () => {
  const rootPackage = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
  const railwayConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../railway.json'), 'utf8'));
  assert.equal(rootPackage.scripts.start, 'npm --prefix backend start');
  assert.equal(railwayConfig.deploy.startCommand, 'npm start');
  assert.equal(railwayConfig.deploy.healthcheckPath, '/health');
});
