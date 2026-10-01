const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');
const frontendRoutesSource = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/constants/routes.js'), 'utf8');
const { Chemical } = require('../models');
const { listQuarantine } = require('../controllers/chemicalController');

test('admin inventory quarantine route is exposed through the admin API and frontend route constants', () => {
  assert.match(appSource, /app\.use\(['"]\/api\/admin\/inventory['"],\s*requireAuth,\s*requireRole\(['"]admin['"]\),\s*chemicalRoutes\)/, 'expected the admin inventory mount to require JWT authentication and the admin role');
  assert.match(frontendRoutesSource, /ADMIN_INVENTORY_QUARANTINE\s*:\s*['"]\/admin\/inventory\/quarantine['"]/, 'expected the admin inventory quarantine route constant in the frontend route map');
  assert.match(frontendRoutesSource, /['"]\/admin\/inventory\/quarantine['"]/, 'expected the frontend route map to include the quarantine route path');
  assert.match(fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/App.jsx'), 'utf8'), /path="inventory\/quarantine"\s+element=\{<AdminChemicalQuarantine\s*\/>\}/, 'expected the route to render the chemical quarantine page');
});

test('chemical quarantine release records the operation with old and new values', () => {
  const controllerSource = fs.readFileSync(path.resolve(__dirname, '../controllers/chemicalController.js'), 'utf8');

  assert.match(controllerSource, /action:\s*quarantineChanged\s*\?\s*'QUARANTINE_OPERATION'/, 'expected quarantine changes to use the quarantine audit action');
  assert.match(controllerSource, /operation:\s*req\.body\.remove_quarantine\s*===\s*true\s*\?\s*'release'/, 'expected release actions to be identified in audit details');
  assert.match(controllerSource, /oldValue:\s*previousValue,[\s\S]*newValue:\s*chemical\.toJSON\(\)/, 'expected quarantine audit entries to retain old and new values');
  assert.match(controllerSource, /if \(req\.body\.storageLocation !== undefined\) updates\.storageLocation = String\(req\.body\.storageLocation \|\| ''\)\.trim\(\)/, 'expected the existing chemical storage location column to persist quarantine location');
  const quarantinePage = fs.readFileSync(path.resolve(__dirname, '../../../frontend/src/components/admin/AdminChemicalQuarantine.jsx'), 'utf8');
  assert.match(quarantinePage, /const CHEMICALS_API = "\/api\/admin\/inventory"/);
  assert.match(quarantinePage, /const QUARANTINE_API = `\$\{CHEMICALS_API\}\/quarantine`/);
  assert.doesNotMatch(quarantinePage, /\/chemical-quarantine|\/release|\/cancel/);
});

test('chemical quarantine search is applied in the database query', async () => {
  const originalFindAndCountAll = Chemical.findAndCountAll;
  let query;
  Chemical.findAndCountAll = async (options) => { query = options; return { count: 0, rows: [] }; };

  try {
    let response;
    await listQuarantine(
      { query: { search: 'CAS-42', page: '2', limit: '10' } },
      { json(body) { response = body; } },
      (error) => { throw error; }
    );
    assert.equal(query.where.quarantine, true);
    assert.equal(query.where[require('sequelize').Op.or].length, 4);
    assert.equal(query.offset, 10);
    assert.equal(response.pagination.page, 2);
  } finally {
    Chemical.findAndCountAll = originalFindAndCountAll;
  }
});
