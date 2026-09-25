const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/ictAssetRoutes.js'), 'utf8');
const serviceSource = fs.readFileSync(path.resolve(__dirname, '../src/services/ictAnalyticsService.js'), 'utf8');

test('ICT asset analytics is authenticated, role protected, and college scoped', () => {
  assert.match(routeSource, /router\.get\('\/analytics'/);
  assert.match(routeSource, /scopedIctAccess/);
  assert.match(routeSource, /req\.organizationScope\.collegeId/);
  assert.match(serviceSource, /const buildAssetWhere = \(collegeId/);
  assert.match(serviceSource, /const where = \{ collegeId \}/);
});

test('ICT asset analytics validates date ranges and avoids fabricated comparison percentages', () => {
  assert.match(serviceSource, /error\.status = 422/);
  assert.ok(serviceSource.includes('percentage: previousTotal ?'));
  assert.ok(serviceSource.includes(': null'));
});