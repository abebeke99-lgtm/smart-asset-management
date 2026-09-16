const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const collegeRoutesSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');
const collegeControllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/collegeController.js'), 'utf8');

test('college asset analytics route is protected and scoped to the authenticated college', () => {
  assert.match(collegeRoutesSource, /router\.get\('\/analytics\/assets'/);
  assert.match(collegeControllerSource, /getCollegeAssetAnalytics/i);
  assert.match(collegeControllerSource, /req\.organizationScope\?\.collegeId|req\.organizationScope\.collegeId/i);
});
