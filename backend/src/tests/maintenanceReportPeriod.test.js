const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Asset, Maintenance, MaintenanceRepair, MaintenanceWorkOrder, PreventiveMaintenance, MaintenanceHistory, MaintenanceInspection, MaintenanceCost, User } = require('../models');
const { dashboard, getRepairHistory, summarizeMaintenanceCosts } = require('../controllers/maintenanceController');

test('maintenance dashboard summarizes persisted Asset status and condition', async () => {
  const originalAssetFindAll = Asset.findAll;
  const originalMaintenanceFindAll = Maintenance.findAll;
  const originalRepairFindAll = MaintenanceRepair.findAll;
  const originalWorkOrderFindAll = MaintenanceWorkOrder.findAll;
  const originalPreventiveFindAll = PreventiveMaintenance.findAll;
  const originalHistoryFindAll = MaintenanceHistory.findAll;
  const originalInspectionFindAll = MaintenanceInspection.findAll;
  const originalCostFindAll = MaintenanceCost.findAll;
  const originalUserFindAll = User.findAll;
  Asset.findAll = async () => [
    { status: 'available', condition: 'good' },
    { status: 'under-maintenance', condition: 'damaged' },
  ];
  Maintenance.findAll = async () => [{ status: 'completed' }];
  MaintenanceRepair.findAll = async () => [];
  MaintenanceWorkOrder.findAll = async () => [];
  PreventiveMaintenance.findAll = async () => [];
  MaintenanceHistory.findAll = async () => [];
  MaintenanceInspection.findAll = async () => [];
  MaintenanceCost.findAll = async () => [];
  User.findAll = async () => [];
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
    assert.equal(responseBody.data.summary.totalRequests, 1);
    assert.equal(responseBody.data.summary.completedRepairs, 1);
    assert.equal(responseBody.data.summary.technicianEfficiency, null);
    assert.deepEqual(responseBody.data.statusDistribution, [{ status: 'completed', label: 'Completed', count: 1 }]);
    assert.equal(responseBody.data.summary.hasRecords, true);
  } finally {
    Asset.findAll = originalAssetFindAll;
    Maintenance.findAll = originalMaintenanceFindAll;
    MaintenanceRepair.findAll = originalRepairFindAll;
    MaintenanceWorkOrder.findAll = originalWorkOrderFindAll;
    PreventiveMaintenance.findAll = originalPreventiveFindAll;
    MaintenanceHistory.findAll = originalHistoryFindAll;
    MaintenanceInspection.findAll = originalInspectionFindAll;
    MaintenanceCost.findAll = originalCostFindAll;
    User.findAll = originalUserFindAll;
  }
});

test('maintenance dashboard returns scoped requests, work orders, due alerts and technician workload', async () => {
  const originals = {
    assets: Asset.findAll,
    maintenance: Maintenance.findAll,
    repairs: MaintenanceRepair.findAll,
    workOrders: MaintenanceWorkOrder.findAll,
    preventive: PreventiveMaintenance.findAll,
    history: MaintenanceHistory.findAll,
    inspections: MaintenanceInspection.findAll,
    costs: MaintenanceCost.findAll,
    users: User.findAll,
  };
  const createdAt = new Date('2026-09-28T10:00:00.000Z');
  const pastDue = new Date('2026-09-20T10:00:00.000Z');
  const maintenanceRow = {
    id: 12,
    assetId: 3,
    assignedTo: 8,
    title: 'Repair projector',
    status: 'in-progress',
    priority: 'high',
    createdAt,
    updatedAt: createdAt,
    Asset: { name: 'Lecture Hall Projector', assetCode: 'AV-003' },
    Technician: { fullName: 'Aster Technician' },
  };
  const workOrderRow = {
    id: 21,
    maintenanceId: 12,
    workOrderNumber: 'WO-021',
    technicianId: 8,
    status: 'in-progress',
    expectedCompletionDate: pastDue,
    startDate: createdAt,
    createdAt,
    Asset: { name: 'Lecture Hall Projector' },
    Technician: { fullName: 'Aster Technician' },
  };
  let maintenanceOptions;
  Asset.findAll = async () => [{ id: 3, status: 'Under Maintenance', condition: 'Poor' }];
  Maintenance.findAll = async (options) => { maintenanceOptions = options; return [maintenanceRow]; };
  MaintenanceRepair.findAll = async () => [{ id: 44, maintenanceId: 12, status: 'completed' }];
  MaintenanceWorkOrder.findAll = async () => [workOrderRow];
  PreventiveMaintenance.findAll = async () => [];
  MaintenanceHistory.findAll = async () => [{ maintenanceId: 99, actionDate: createdAt, actionType: 'completed', newStatus: 'completed' }];
  MaintenanceInspection.findAll = async () => [];
  MaintenanceCost.findAll = async () => [];
  User.findAll = async () => [{ id: 8, username: 'aster', fullName: 'Aster Technician' }];

  try {
    let responseBody;
    await dashboard(
      { query: { period: '7days' }, user: { role: 'maintenance' } },
      { json(body) { responseBody = body; } },
      (error) => { throw error; }
    );

    assert.ok(maintenanceOptions.where.createdAt[Op.gte] instanceof Date);
    assert.equal(responseBody.data.summary.totalRequests, 1);
    assert.equal(responseBody.data.summary.completedRepairs, 2);
    assert.equal(responseBody.data.summary.inProgress, 1);
    assert.equal(responseBody.data.summary.overdueWorkOrders, 1);
    assert.equal(responseBody.data.summary.assetsUnderMaintenance, 1);
    assert.equal(responseBody.data.summary.criticalAlerts, 2);
    assert.equal(responseBody.data.summary.technicianEfficiency, 0);
    assert.equal(responseBody.data.recentRequests[0].asset, 'Lecture Hall Projector');
    assert.equal(responseBody.data.recentWorkOrders[0].technician, 'Aster Technician');
    assert.deepEqual(responseBody.data.monthlyTrend, [{ period: '2026-09-28', requests: 1, completed: 1 }]);
    assert.deepEqual(responseBody.data.technicianWorkload[0], {
      technicianId: 8,
      name: 'Aster Technician',
      assigned: 1,
      inProgress: 1,
      completed: 0,
    });
  } finally {
    Asset.findAll = originals.assets;
    Maintenance.findAll = originals.maintenance;
    MaintenanceRepair.findAll = originals.repairs;
    MaintenanceWorkOrder.findAll = originals.workOrders;
    PreventiveMaintenance.findAll = originals.preventive;
    MaintenanceHistory.findAll = originals.history;
    MaintenanceInspection.findAll = originals.inspections;
    MaintenanceCost.findAll = originals.costs;
    User.findAll = originals.users;
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

test('maintenance cost totals use persisted categories and round to cents', () => {
  assert.deepEqual(summarizeMaintenanceCosts({ costRows: [
    { costCategory: 'labor', amount: '10.125' },
    { costCategory: 'parts', amount: '4.25' },
    { costCategory: 'materials', amount: '2.10' },
    { costCategory: 'service', amount: '3.50' },
  ] }), { laborCost: 10.13, partsCost: 4.25, materialsCost: 2.1, otherCost: 3.5, totalCost: 19.98 });
});

test('repair and standalone work-order totals avoid linked record double counting', () => {
  assert.deepEqual(summarizeMaintenanceCosts({
    repairRows: [{ workOrderId: 4, laborCost: '30.00', partsCost: '50.00', serviceCost: '10.00', totalCost: '100.00' }],
    workOrderRows: [
      { id: 4, actualCost: '100.00', estimatedCost: '120.00' },
      { id: 5, actualCost: '20.00', estimatedCost: '25.00' },
    ],
  }), { laborCost: 30, partsCost: 50, materialsCost: 0, otherCost: 40, totalCost: 120 });
});

test('partial persisted cost rows do not hide unrelated repair and work-order totals', () => {
  assert.deepEqual(summarizeMaintenanceCosts({
    costRows: [
      { maintenanceId: 10, repairId: 1, costCategory: 'labor', amount: '5.00' },
      { maintenanceId: 10, repairId: 1, costCategory: 'materials', amount: '3.00' },
      { maintenanceId: 20, workOrderId: 6, costCategory: 'other', amount: '2.00' },
    ],
    repairRows: [
      { id: 1, maintenanceId: 10, workOrderId: 4, laborCost: '90.00', totalCost: '100.00' },
      { id: 2, maintenanceId: 11, workOrderId: 5, laborCost: '10.00', partsCost: '10.00', materialsCost: '5.00', totalCost: '50.00' },
    ],
    workOrderRows: [
      { id: 4, maintenanceId: 10, actualCost: '100.00' },
      { id: 5, maintenanceId: 11, actualCost: '50.00' },
      { id: 6, maintenanceId: 20, actualCost: '20.00' },
      { id: 7, maintenanceId: 21, actualCost: '9.00' },
    ],
  }), { laborCost: 15, partsCost: 10, materialsCost: 8, otherCost: 36, totalCost: 69 });
});