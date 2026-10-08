const test = require('node:test');
const assert = require('node:assert/strict');
const { getAssetStatusStatistics } = require('../services/dashboardService');

test('asset status statistics cover every database-grouped status without double counting', () => {
  const statistics = getAssetStatusStatistics([
    { status: 'available', count: 7 },
    { status: 'IN_USE', count: 2 },
    { status: 'under-maintenance', count: 3 },
    { status: 'Damaged', count: 1 },
    { status: 'replaced', count: 1 },
    { status: 'expired', count: 1 },
    { status: 'retired', count: 1 },
    { status: 'pending-disposal', count: 2 },
  ]);
  const covered = statistics.active
    + statistics.underMaintenance
    + statistics.damaged
    + statistics.replaced
    + statistics.expired
    + statistics.retired
    + statistics.otherStatuses.reduce((total, item) => total + item.count, 0);

  assert.equal(statistics.total, 18);
  assert.equal(covered, statistics.total);
  assert.deepEqual(statistics.otherStatuses, [{ status: 'pending-disposal', count: 2 }]);
});

test('asset status statistics combine case and separator variants', () => {
  const statistics = getAssetStatusStatistics([
    { status: 'Under Maintenance', count: 2 },
    { status: 'under_maintenance', count: 3 },
    { status: 'DISPOSED', count: 1 },
  ]);

  assert.equal(statistics.underMaintenance, 5);
  assert.equal(statistics.retired, 1);
  assert.equal(statistics.total, 6);
});
