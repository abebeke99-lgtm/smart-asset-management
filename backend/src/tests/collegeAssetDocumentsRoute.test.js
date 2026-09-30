const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('college asset document routes use college ownership checks and document permissions', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../routes/collegeRoutes.js'), 'utf8');
  assert.match(source, /requireCollegeAsset, listAssetDocuments/);
  assert.match(source, /requirePermission\('college\.documents\.manage'\), requireCollegeAsset, uploadAssetDocument/);
  assert.match(source, /requirePermission\('college\.documents\.manage'\), requireCollegeAsset, deleteAssetDocument/);
  assert.match(source, /requireCollegeAsset, downloadAssetDocument/);
});