const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app startup initializes the backup service dependency required for server boot', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const backupService = require\('\.\/services\/backupService'\);/);
});

test('app startup verifies and synchronizes the database before listening', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  const startup = source.slice(source.indexOf('async function startServer()'));
  assert.ok(startup.indexOf('testConnection()') < startup.indexOf("app.listen(PORT"));
  assert.ok(startup.indexOf('syncDatabase()') < startup.indexOf("app.listen(PORT"));
});
