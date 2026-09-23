const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('app startup initializes the backup service dependency required for server boot', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app.js'), 'utf8');
  assert.match(source, /const backupService = require\('\.\/services\/backupService'\);/);
});
