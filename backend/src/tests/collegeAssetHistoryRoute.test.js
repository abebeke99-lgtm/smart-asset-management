const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('college asset history route requires history permission and uses the shared history controller', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');
  assert.match(source, /router\.get\('\/assets\/:id\/history', requirePermission\('college\.history\.view'\), getAssetHistory\)/);
});

test('shared asset history enforces collegeId for canonical college managers', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../controllers/assetController.js'), 'utf8');
  assert.match(source, /req\.user\.role === 'college_manager'/);
  assert.match(source, /asset\.collegeId.*authorizedCollegeId/);
});