const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app startup initializes the backup service dependency required for server boot', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const backupService = require\('\.\/services\/backupService'\);/);
});

test('app startup listens before attempting database initialization', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const startup = source.slice(source.indexOf('async function startServer()'));
  assert.ok(startup.indexOf("app.listen(PORT, '0.0.0.0'") < startup.indexOf('initializeDatabase().catch'));
});

test('liveness endpoint always returns HTTP 200 without checking database state', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const healthHandler = \(_req, res\) => res\.status\(200\)\.json\(\{ status: 'ok' \}\)/);
  assert.match(source, /app\.get\('\/health', healthHandler\)/);
});

test('production CORS allows the configured deployed frontend origin without a wildcard', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /https:\/\/smart-asset-management-six\.vercel\.app/);
  assert.doesNotMatch(source, /origin:\s*['"]\*['"]/);
});

test('root production start and Railway deployment target the backend', () => {
  const rootPackage = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
  const railwayConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../railway.json'), 'utf8'));
  assert.equal(rootPackage.scripts.start, 'npm --prefix backend start');
  assert.equal(railwayConfig.deploy.startCommand, 'npm start');
  assert.equal(railwayConfig.deploy.healthcheckPath, '/health');
});
