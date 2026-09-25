const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerSource = fs.readFileSync(path.resolve(__dirname, '../src/controllers/departmentController.js'), 'utf8');
const routeSource = fs.readFileSync(path.resolve(__dirname, '../src/routes/departmentWorkspaceRoutes.js'), 'utf8');

test('department locations use authenticated department scope and expose the location contract', () => {
  assert.match(routeSource, /router\.use\(\.\.\.requireDepartmentHead, resolveDepartmentScope\)/);
  assert.match(controllerSource, /const \{ departmentId \} = req\.organizationScope/);
  assert.match(controllerSource, /Asset\.findAll\(\{ where: \{ departmentId \}/);
  assert.match(controllerSource, /pagination: \{ page, limit, total/);
  assert.match(controllerSource, /summary = \{/);
  assert.doesNotMatch(controllerSource, /req\.query\.department[_-]?id/);
});
