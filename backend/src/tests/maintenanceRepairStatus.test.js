const test = require('node:test');
const assert = require('node:assert/strict');
const { buildRepairSummary } = require('../controllers/maintenanceController');

test('buildRepairSummary counts repair workflow states', () => {
  const rows = [
    { status: 'open' },
    { status: 'assigned' },
    { status: 'diagnosing' },
    { status: 'in-progress' },
    { status: 'waiting-for-parts' },
    { status: 'testing' },
    { status: 'completed' },
    { status: 'failed' },
    { status: 'rework' },
    { status: 'cancelled' },
  ];

  const summary = buildRepairSummary(rows);

  assert.equal(summary.totalRepairs, 10);
  assert.equal(summary.open, 1);
  assert.equal(summary.assigned, 1);
  assert.equal(summary.diagnosing, 1);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.waitingForParts, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.rework, 1);
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.totalOpen, 3);
});
