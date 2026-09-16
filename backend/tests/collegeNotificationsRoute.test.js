const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const collegeRoutesSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/collegeRoutes.js'), 'utf8');

test('college routes expose a scoped notifications endpoint for college managers', () => {
  assert.match(collegeRoutesSource, /router\.get\(['"]\/notifications['"]/i);
  assert.match(collegeRoutesSource, /req\.organizationScope\.collegeId/i);
  assert.match(collegeRoutesSource, /findAndCountAll|count\s*\(/i);
  assert.match(collegeRoutesSource, /readAll|mark all as read|\/read-all/i);
});
