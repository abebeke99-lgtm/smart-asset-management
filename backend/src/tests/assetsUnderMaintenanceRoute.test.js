const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAssetMaintenanceSummary, validateAssetMaintenanceTransition } = require('../controllers/maintenanceController');

test('maintenance summary counts active lifecycle states from real asset records', () => {
  const summary = buildAssetMaintenanceSummary([
    { status: 'awaiting-inspection', isOverdue: false },
    { status: 'in-repair', isOverdue: false },
    { status: 'waiting-for-parts', isOverdue: false },
    { status: 'testing', isOverdue: false },
    { status: 'ready-for-return', isOverdue: false },
    { status: 'in-repair', isOverdue: true },
  ]);

  assert.equal(summary.totalUnderMaintenance, 6);
  assert.equal(summary.awaitingInspection, 1);
  assert.equal(summary.inRepair, 2);
  assert.equal(summary.waitingForParts, 1);
  assert.equal(summary.testingQualityControl, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.readyForReturn, 1);
});

test('status validation blocks invalid lifecycle transitions before they reach the database', () => {
  const allowed = validateAssetMaintenanceTransition('awaiting-inspection', 'in-repair');
  const blocked = validateAssetMaintenanceTransition('awaiting-inspection', 'completed');

  assert.equal(allowed, true);
  assert.equal(blocked, false);
});
