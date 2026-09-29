const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Asset, User, Maintenance, MaintenanceWorkOrder, MaintenanceRepair, MaintenanceCost, MaintenanceHistory, AuditLog } = require('../models');
const { createRepair, updateRepair, normalizeRepair } = require('../controllers/maintenanceController');

const withCreateRepairStubs = async (workOrder, run) => {
  const originals = {
    transaction: sequelize.transaction,
    assetFindOne: Asset.findOne,
    userFindOne: User.findOne,
    maintenanceCreate: Maintenance.create,
    maintenanceFindByPk: Maintenance.findByPk,
    maintenanceFindOne: Maintenance.findOne,
    workOrderFindByPk: MaintenanceWorkOrder.findByPk,
    repairCreate: MaintenanceRepair.create,
    costFindAll: MaintenanceCost.findAll,
    costCreate: MaintenanceCost.create,
    historyCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} };
  let repairPayload;
  const costEntries = [];
  let maintenanceCreates = 0;
  const linkedMaintenance = { id: 71, assetId: 39, status: 'in-progress', priority: 'high', async update(values) { Object.assign(this, values); } };

  sequelize.transaction = async () => transaction;
  Asset.findOne = async () => ({ id: 39 });
  User.findOne = async () => ({ id: 11, role: 'maintenance', active: true });
  Maintenance.create = async () => { maintenanceCreates += 1; throw new Error('Unexpected duplicate maintenance request'); };
  Maintenance.findByPk = async () => linkedMaintenance;
  Maintenance.findOne = async () => ({
    toJSON: () => ({
      id: linkedMaintenance.id,
      assetId: 39,
      status: linkedMaintenance.status,
      assignedTo: 11,
      Asset: { id: 39, name: 'QA Maintenance Asset', assetCode: 'QA-MAINT-2026-001' },
      Technician: { id: 11, fullName: 'QA Maintenance Technician' },
      MaintenanceRepairs: [{ id: 91, workOrderId: workOrder?.id || null, technicianId: 11, totalCost: '350.50', status: 'in-progress' }],
    }),
  });
  MaintenanceWorkOrder.findByPk = async () => workOrder;
  MaintenanceRepair.create = async (payload) => { repairPayload = payload; return { id: 91 }; };
  MaintenanceCost.findAll = async () => [];
  MaintenanceCost.create = async (payload) => { costEntries.push(payload); return { id: costEntries.length, ...payload }; };
  MaintenanceHistory.create = async () => {};
  AuditLog.create = async () => {};

  try {
    return await run({ transaction, linkedMaintenance, getRepairPayload: () => repairPayload, getCostEntries: () => costEntries, getMaintenanceCreates: () => maintenanceCreates });
  } finally {
    sequelize.transaction = originals.transaction;
    Asset.findOne = originals.assetFindOne;
    User.findOne = originals.userFindOne;
    Maintenance.create = originals.maintenanceCreate;
    Maintenance.findByPk = originals.maintenanceFindByPk;
    Maintenance.findOne = originals.maintenanceFindOne;
    MaintenanceWorkOrder.findByPk = originals.workOrderFindByPk;
    MaintenanceRepair.create = originals.repairCreate;
    MaintenanceCost.findAll = originals.costFindAll;
    MaintenanceCost.create = originals.costCreate;
    MaintenanceHistory.create = originals.historyCreate;
    AuditLog.create = originals.auditCreate;
  }
};

const invokeCreateRepair = async (body) => {
  let statusCode;
  let responseBody;
  let forwardedError;
  await createRepair({ body, user: { id: 6, role: 'maintenance', collegeId: null } }, {
    status(code) { statusCode = code; return this; },
    json(payload) { responseBody = payload; return this; },
  }, (error) => { forwardedError = error; });
  if (forwardedError) throw forwardedError;
  return { statusCode, responseBody };
};

const withUpdateRepairStubs = async (run) => {
  const originals = {
    transaction: sequelize.transaction,
    maintenanceFindOne: Maintenance.findOne,
    userFindOne: User.findOne,
    workOrderFindByPk: MaintenanceWorkOrder.findByPk,
    assetFindByPk: Asset.findByPk,
    costFindAll: MaintenanceCost.findAll,
    costCreate: MaintenanceCost.create,
    repairHistoryCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
  };
  let committed = false;
  let rolledBack = false;
  let historyEntry;
  let auditEntry;
  const costEntries = [];
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => { committed = true; },
    rollback: async () => { rolledBack = true; },
  };
  const repair = {
    id: 91,
    workOrderId: 8,
    technicianId: 11,
    status: 'in-progress',
    totalCost: '350.50',
    completionDate: null,
    diagnosis: 'Fan bearing worn',
    repairAction: 'Replace fan assembly',
    partsUsed: '',
    notes: 'QA repair',
    async update(values) { Object.assign(this, values); },
  };
  const maintenance = {
    id: 71,
    assetId: 39,
    status: 'in-progress',
    priority: 'high',
    title: 'QA maintenance request',
    description: 'Cooling fan failure',
    assignedTo: 11,
    MaintenanceRepairs: [repair],
    async update(values) { Object.assign(this, values); },
  };
  let findOneCount = 0;

  sequelize.transaction = async () => transaction;
  Maintenance.findOne = async () => {
    findOneCount += 1;
    if (findOneCount === 1) return maintenance;
    return {
      toJSON: () => ({
        id: maintenance.id,
        assetId: maintenance.assetId,
        status: maintenance.status,
        priority: maintenance.priority,
        assignedTo: maintenance.assignedTo,
        Asset: { id: 39, name: 'QA Maintenance Asset', assetCode: 'QA-MAINT-2026-001' },
        Technician: { id: 11, fullName: 'QA Maintenance Technician' },
        MaintenanceRepairs: [{ ...repair, MaintenanceWorkOrder: { id: 8, workOrderNumber: 'QA-WO-2026-001', status: 'completed', priority: 'high' } }],
      }),
    };
  };
  User.findOne = async () => ({ id: 11, role: 'maintenance', active: true });
  MaintenanceWorkOrder.findByPk = async () => ({ id: 8, maintenanceId: 71, assetId: 39, status: 'completed' });
  Asset.findByPk = async () => ({ id: 39, async update() {} });
  MaintenanceCost.findAll = async () => [];
  MaintenanceCost.create = async (entry) => { costEntries.push(entry); return entry; };
  MaintenanceHistory.create = async (entry) => { historyEntry = entry; };
  AuditLog.create = async (entry) => { auditEntry = entry; };

  try {
    return await run({ transaction, maintenance, repair, get committed() { return committed; }, get rolledBack() { return rolledBack; }, get historyEntry() { return historyEntry; }, get auditEntry() { return auditEntry; }, get costEntries() { return costEntries; } });
  } finally {
    sequelize.transaction = originals.transaction;
    Maintenance.findOne = originals.maintenanceFindOne;
    User.findOne = originals.userFindOne;
    MaintenanceWorkOrder.findByPk = originals.workOrderFindByPk;
    Asset.findByPk = originals.assetFindByPk;
    MaintenanceCost.findAll = originals.costFindAll;
    MaintenanceCost.create = originals.costCreate;
    MaintenanceHistory.create = originals.repairHistoryCreate;
    AuditLog.create = originals.auditCreate;
  }
};

const invokeUpdateRepair = async (body) => {
  let statusCode;
  let responseBody;
  let forwardedError;
  await updateRepair({ params: { id: 71 }, body, user: { id: 6, role: 'maintenance', collegeId: null } }, {
    status(code) { statusCode = code; return this; },
    json(payload) { responseBody = payload; return this; },
  }, (error) => { forwardedError = error; });
  if (forwardedError) throw forwardedError;
  return { statusCode, responseBody };
};

test('repair normalization displays the repair status and linked work-order priority', () => {
  const result = normalizeRepair({
    toJSON: () => ({
      id: 71,
      status: 'assigned',
      priority: 'medium',
      MaintenanceRepairs: [{
        id: 91,
        workOrderId: 8,
        status: 'in-progress',
        totalCost: '350.50',
        MaintenanceWorkOrder: { id: 8, status: 'in-progress', priority: 'high' },
      }],
    }),
  });

  assert.equal(result.status, 'In Progress');
  assert.equal(result.statusRaw, 'in-progress');
  assert.equal(result.priority, 'high');
});

test('repair creation reuses the work order maintenance request instead of creating a duplicate', async () => {
  await withCreateRepairStubs({ id: 8, assetId: 39, maintenanceId: 71, priority: 'high' }, async ({ getRepairPayload, getMaintenanceCreates }) => {
    const result = await invokeCreateRepair({
      asset_id: 39,
      work_order_id: 8,
      problem: 'QA linked repair',
      status: 'in-progress',
      priority: 'high',
      technician_id: 11,
      cost: 350.5,
    });

    assert.equal(result.statusCode, 201);
    assert.equal(getMaintenanceCreates(), 0);
    assert.equal(getRepairPayload().maintenanceId, 71);
    assert.equal(getRepairPayload().workOrderId, 8);
  });
});

test('repair creation rejects a work order linked to a different asset', async () => {
  await withCreateRepairStubs({ id: 8, assetId: 40, maintenanceId: 72 }, async ({ getRepairPayload, getMaintenanceCreates }) => {
    const result = await invokeCreateRepair({ asset_id: 39, work_order_id: 8, problem: 'Invalid linkage' });

    assert.equal(result.statusCode, 422);
    assert.match(result.responseBody.message, /work order must belong to the selected asset/i);
    assert.equal(getMaintenanceCreates(), 0);
    assert.equal(getRepairPayload(), undefined);
  });
});

test('repair completion records its timestamp without closing maintenance before QC', async () => {
  await withUpdateRepairStubs(async (state) => {
    const result = await invokeUpdateRepair({ status: 'completed' });

    assert.equal(result.statusCode || 200, 200);
    assert.equal(state.committed, true);
    assert.equal(state.repair.status, 'completed');
    assert.ok(state.repair.completionDate instanceof Date);
    assert.equal(state.maintenance.status, 'in-progress');
    assert.equal(result.responseBody.data.status, 'Completed');
    assert.equal(state.historyEntry.previousStatus, 'in-progress');
    assert.equal(state.historyEntry.newStatus, 'completed');
    const audit = JSON.parse(state.auditEntry.details);
    assert.equal(audit.actorRole, 'maintenance');
    assert.equal(audit.previousValue.status, 'in-progress');
    assert.equal(audit.newValue.status, 'completed');
  });
});

test('repair update rejects an invalid status jump without mutation', async () => {
  await withUpdateRepairStubs(async (state) => {
    const result = await invokeUpdateRepair({ status: 'open' });

    assert.equal(result.statusCode, 409);
    assert.equal(state.rolledBack, true);
    assert.equal(state.committed, false);
    assert.equal(state.repair.status, 'in-progress');
    assert.equal(state.historyEntry, undefined);
  });
});

test('repair cost breakdown persists Labor, Parts, Materials, and Other with a backend-computed total', async () => {
  await withCreateRepairStubs({ id: 8, assetId: 39, maintenanceId: 71, priority: 'high' }, async ({ getRepairPayload, getCostEntries }) => {
    const result = await invokeCreateRepair({
      asset_id: 39,
      work_order_id: 8,
      problem: 'QA categorized repair',
      status: 'open',
      priority: 'high',
      labor_cost: 1.25,
      parts_cost: 2.5,
      materials_cost: 3.75,
      other_cost: 4.5,
    });

    assert.equal(result.statusCode, 201);
    assert.equal(getRepairPayload().totalCost, 12);
    assert.equal(getRepairPayload().laborCost, 1.25);
    assert.equal(getRepairPayload().partsCost, 2.5);
    assert.equal(getRepairPayload().materialsCost, 3.75);
    assert.equal(getRepairPayload().serviceCost, 4.5);
    assert.deepEqual(getCostEntries().map(({ costCategory, amount }) => [costCategory, amount]), [
      ['labor', 1.25], ['parts', 2.5], ['materials', 3.75], ['other', 4.5],
    ]);
    assert.ok(getCostEntries().every((entry) => entry.repairId === 91 && entry.maintenanceId === 71 && entry.assetId === 39));
  });
});

test('repair update persists the complete categorized cost breakdown and audit snapshot', async () => {
  await withUpdateRepairStubs(async (state) => {
    const result = await invokeUpdateRepair({
      status: 'in-progress',
      labor_cost: 20,
      parts_cost: 30,
      materials_cost: 15.5,
      other_cost: 4.5,
    });

    assert.equal(result.statusCode || 200, 200);
    assert.equal(state.repair.totalCost, 70);
    assert.equal(state.repair.laborCost, 20);
    assert.equal(state.repair.partsCost, 30);
    assert.equal(state.repair.materialsCost, 15.5);
    assert.equal(state.repair.serviceCost, 4.5);
    assert.deepEqual(state.costEntries.map(({ costCategory, amount }) => [costCategory, amount]), [
      ['labor', 20], ['parts', 30], ['materials', 15.5], ['other', 4.5],
    ]);
    const audit = JSON.parse(state.auditEntry.details);
    assert.deepEqual(audit.newValue, {
      status: 'in-progress', totalCost: 70, laborCost: 20, partsCost: 30, materialsCost: 15.5,
      otherCost: 4.5, technicianId: 11, workOrderId: 8, completionDate: null,
    });
  });
});