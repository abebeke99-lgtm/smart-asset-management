const { after, test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { buildCollegeAssetScope } = require('../services/collegeAssetScope');
const { summarizeCollegeAssets } = require('../controllers/collegeController');

after(() => sequelize.close());

test('college asset scope includes direct college ownership and legacy college departments only', () => {
  const scope = buildCollegeAssetScope(4, [7, 9, 7, null, 'invalid']);

  assert.deepEqual(scope[Op.or], [
    { collegeId: 4 },
    { collegeId: null, departmentId: { [Op.in]: [7, 9] } },
  ]);
});

test('college asset scope never widens to department-linked records when the college has no departments', () => {
  const scope = buildCollegeAssetScope(4);

  assert.deepEqual(scope[Op.or], [{ collegeId: 4 }]);
});

test('inventory summary classifies status, assignment, condition, and maintenance without double counting', () => {
  const summary = summarizeCollegeAssets([
    { status: 'active', condition: 'Good' },
    { status: 'available', Assignments: [{ status: 'active' }] },
    { status: 'available' },
    { status: 'in use' },
    { status: 'available', condition: 'under maintenance' },
    { status: 'Under Maintenance' },
    { status: 'available', condition: 'Damaged' },
    { status: 'missing' },
    { status: 'available', Assignments: [{ status: 'returned' }] },
  ]);

  assert.deepEqual(summary, {
    total: 9,
    active: 1,
    assigned: 2,
    available: 2,
    maintenance: 2,
    damagedMissing: 2,
  });
});
