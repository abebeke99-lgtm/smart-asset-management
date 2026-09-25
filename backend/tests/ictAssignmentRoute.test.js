const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../src/routes/assignmentRoutes.js'), 'utf8');

test('assignment routes support server-side pagination and search filtering for ICT assignment workflows', () => {
  assert.match(source, /findAndCountAll/);
  assert.match(source, /page\s*=\s*Math\.max\(1,\s*Number\(req\.query\.page\)/);
  assert.match(source, /limit\s*=\s*Math\.min\(100,\s*Math\.max\(1,\s*Number\(req\.query\.limit\)/);
  assert.match(source, /search\s*=\s*String\(req\.query\.search\s*\|\|\s*''\)/);
  assert.match(source, /status\s*=\s*String\(req\.query\.status\s*\|\|\s*''\)/);
  assert.match(source, /pagination\s*:\s*\{\s*page,\s*limit,\s*total:\s*count,\s*pages/);
});

test('department-scoped assignment access includes department heads and filters by department scope', () => {
  assert.match(source, /department_head/);
  assert.match(source, /req\.organizationScope\.?departmentId|req\.user\.departmentId|req\.user\.department_id/);
  assert.match(source, /const numericDepartmentId = Number\(departmentScope\)/);
  assert.match(source, /andClauses\.push\(\{\s*['"]\$Asset\.departmentId\$['"]\s*:\s*departmentScope\s*\}\)/);
});
