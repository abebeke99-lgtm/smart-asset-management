const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, Maintenance, MaintenanceRepair } = require('../models');
const { dashboard, getRepairHistory } = require('../controllers/maintenanceController');

test('maintenance dashboard summarizes persisted Asset status and condition', async () => {
  const originalAssetFindAll = Asset.findAll;
  const originalMaintenanceFindAll = Maintenance.findAll;
  Asset.findAll = async () => [
    { status: 'available', condition: 'good' },
    { status: 'under-maintenance', condition: 'damaged' },
  ];
  Maintenance.findAll = async () => [{ status: 'completed' }];
  let responseBody;

  try {
    await dashboard(
      { query: {}, user: { role: 'maintenance' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; }
    );

    assert.equal(responseBody.data.totalAssets, 2);
    assert.equal(responseBody.data.assetsUnderMaintenance, 1);
    assert.deepEqual(responseBody.data.assetStatus, { available: 1, 'under-maintenance': 1 });
    assert.deepEqual(responseBody.data.assetCondition, { good: 1, damaged: 1 });
  } finally {
    Asset.findAll = originalAssetFindAll;
    Maintenance.findAll = originalMaintenanceFindAll;
  }
});

test('repair report period filters persisted repair timestamps for rows and stats', async () => {
  const originalFindAndCountAll = Maintenance.findAndCountAll;
  const originalFindAll = Maintenance.findAll;
  let listOptions;
  let statsOptions;
  Maintenance.findAndCountAll = async (options) => { listOptions = options; return { count: 0, rows: [] }; };
  Maintenance.findAll = async (options) => { statsOptions = options; return []; };

  try {
    await getRepairHistory(
      { query: { period: '30days' }, user: { role: 'maintenance' } },
      { json() {} },
      (error) => { throw error; }
    );

    const listedRepairs = listOptions.include.find((item) => item.model === MaintenanceRepair);
    const aggregatedRepairs = statsOptions.include.find((item) => item.model === MaintenanceRepair);
    assert.ok(listedRepairs.where.createdAt[Op.gte] instanceof Date);
    assert.ok(aggregatedRepairs.where.createdAt[Op.gte] instanceof Date);
    assert.equal(listOptions.where.createdAt, undefined);
    assert.equal(statsOptions.where.createdAt, undefined);
  } finally {
    Maintenance.findAndCountAll = originalFindAndCountAll;
    Maintenance.findAll = originalFindAll;
  }
});