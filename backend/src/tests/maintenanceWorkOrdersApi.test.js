const test = require('node:test');
const assert = require('node:assert/strict');
const { Asset, Maintenance, MaintenanceWorkOrder, User, AuditLog, MaintenanceHistory, sequelize } = require('../models');
const { normalizeMaintenanceWorkOrder, getMaintenanceWorkOrderSummary, getMaintenanceWorkOrderOptions, createMaintenanceWorkOrder, updateMaintenanceWorkOrder, rollbackIfPending } = require('../controllers/maintenanceController');

test('maintenance transaction rollback is skipped after commit and used while open', async () => {
  let rollbackCount = 0;
  await rollbackIfPending({ finished: 'commit', rollback: async () => { rollbackCount += 1; } });
  assert.equal(rollbackCount, 0);

  await rollbackIfPending({ finished: undefined, rollback: async () => { rollbackCount += 1; } });
  assert.equal(rollbackCount, 1);
});

test('maintenance work-order normalizer exposes real work-order fields', () => {
  const result = normalizeMaintenanceWorkOrder({
    toJSON() {
      return {
        id: 8,
        workOrderNumber: 'WO-008',
        status: 'in-progress',
        priority: 'high',
        maintenanceId: 2,
        assetId: 3,
        technicianId: 5,
        problemDescription: 'Cooling fan noisy',
        requiredWork: 'Inspect and replace fan',
        estimatedCost: '1250.00',
        createdAt: '2026-09-20T00:00:00Z',
      };
    },
    Asset: { id: 3, name: 'Server Rack', assetCode: 'SR-04', serialNumber: 'ABC-101', category: 'IT', location: 'Server Room', status: 'under-maintenance' },
    Maintenance: { id: 2, title: 'Cooling fan inspection' },
    Technician: { id: 5, fullName: 'Jane Technician', department: 'ICT' },
  });

  assert.equal(result.workOrderNumber, 'WO-008');
  assert.equal(result.assetName, 'Server Rack');
  assert.equal(result.assetCode, 'SR-04');
  assert.equal(result.status, 'In Progress');
  assert.equal(result.priority, 'High');
  assert.equal(result.technician, 'Jane Technician');
  assert.equal(result.progress, 50);
});

test('maintenance work-order summary computes totals from a real list', () => {
  const summary = getMaintenanceWorkOrderSummary([
    { status: 'draft' },
    { status: 'open' },
    { status: 'in-progress' },
    { status: 'on-hold' },
    { status: 'completed' },
    { status: 'completed' },
    { status: 'cancelled' },
  ]);

  assert.equal(summary.total, 7);
  assert.equal(summary.open, 2);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.onHold, 1);
  assert.equal(summary.completed, 2);
  assert.equal(summary.overdue, 0);
});

test('work-order options include active maintenance requests with their linked asset', async () => {
  const originals = { assets: Asset.findAll, users: User.findAll, maintenance: Maintenance.findAll };
  Asset.findAll = async () => [];
  User.findAll = async () => [];
  Maintenance.findAll = async () => [{
    toJSON: () => ({ id: 14, assetId: 3, title: 'Repair projector', status: 'pending', priority: 'high', Asset: { id: 3, name: 'Hall Projector', assetCode: 'AV-3' } }),
  }];

  try {
    let response;
    await getMaintenanceWorkOrderOptions(
      { user: { role: 'maintenance', collegeId: null } },
      { json(body) { response = body; } },
      (error) => { throw error; }
    );

    assert.equal(response.success, true);
    assert.equal(response.data.maintenanceRequests[0].id, 14);
    assert.equal(response.data.maintenanceRequests[0].asset.name, 'Hall Projector');
  } finally {
    Asset.findAll = originals.assets;
    User.findAll = originals.users;
    Maintenance.findAll = originals.maintenance;
  }
});

test('work-order creation rejects a missing maintenance request before writing', async () => {
  const originalTransaction = sequelize.transaction;
  let rolledBack = false;
  sequelize.transaction = async () => ({ rollback: async () => { rolledBack = true; } });

  try {
    let statusCode;
    let response;
    await createMaintenanceWorkOrder(
      { body: { assetId: 3 }, user: { id: 8, role: 'maintenance' } },
      { status(code) { statusCode = code; return this; }, json(body) { response = body; } },
      (error) => { throw error; }
    );

    assert.equal(statusCode, 422);
    assert.equal(response.message, 'A maintenance request is required');
    assert.equal(rolledBack, true);
  } finally {
    sequelize.transaction = originalTransaction;
  }
});

test('work-order audit snapshot records old and new persisted values', async () => {
  const originals = {
    transaction: sequelize.transaction,
    workOrderFindByPk: MaintenanceWorkOrder.findByPk,
    userFindOne: User.findOne,
    historyCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  const workOrder = {
    id: 17,
    workOrderNumber: 'WO-017',
    maintenanceId: 12,
    assetId: 3,
    technicianId: 8,
    priority: 'medium',
    status: 'open',
    startDate: new Date('2026-09-20T10:00:00.000Z'),
    expectedCompletionDate: null,
    estimatedCost: '25.00',
    actualCost: '5.00',
    progress: 0,
    Asset: { id: 3, name: 'QA Asset', assetCode: 'QA-003' },
    Maintenance: { id: 12, title: 'Repair projector' },
    Technician: { id: 8, fullName: 'QA Technician' },
    async update(values) { Object.assign(this, values); },
    toJSON() { return { id: this.id, workOrderNumber: this.workOrderNumber, maintenanceId: this.maintenanceId, assetId: this.assetId, technicianId: this.technicianId, priority: this.priority, status: this.status, startDate: this.startDate, expectedCompletionDate: this.expectedCompletionDate, estimatedCost: this.estimatedCost, actualCost: this.actualCost, progress: this.progress }; },
  };
  let auditEntry;
  sequelize.transaction = async () => transaction;
  MaintenanceWorkOrder.findByPk = async () => workOrder;
  User.findOne = async () => ({ id: 8, role: 'maintenance', active: true });
  MaintenanceHistory.create = async () => {};
  AuditLog.create = async (entry) => { auditEntry = entry; };

  try {
    let response;
    await updateMaintenanceWorkOrder({ params: { id: '17' }, body: { status: 'in-progress', estimatedCost: 40, actualCost: 20 }, user: { id: 6, role: 'maintenance' } }, {
      json(payload) { response = payload; return this; },
    }, (error) => { throw error; });

    assert.equal(response.success, true);
    assert.equal(transaction.finished, 'commit');
    const snapshot = JSON.parse(auditEntry.details);
    assert.deepEqual(snapshot.oldValue, {
      workOrderNumber: 'WO-017', maintenanceId: 12, assetId: 3, technicianId: 8, priority: 'medium', status: 'open',
      startDate: workOrder.startDate.toISOString(), expectedCompletionDate: null, estimatedCost: 25, actualCost: 5,
    });
    assert.deepEqual(snapshot.newValue, {
      ...snapshot.oldValue, status: 'in-progress', estimatedCost: 40, actualCost: 20, actualCompletionDate: null, progress: 0,
    });
  } finally {
    sequelize.transaction = originals.transaction;
    MaintenanceWorkOrder.findByPk = originals.workOrderFindByPk;
    User.findOne = originals.userFindOne;
    MaintenanceHistory.create = originals.historyCreate;
    AuditLog.create = originals.auditCreate;
  }
});

test('maintenance technician directory calculates real workload metrics from assigned maintenance data', async () => {
  const { getTechnicianDirectory } = require('../controllers/maintenanceController');
  const originalFindAllUsers = User.findAll;
  const originalFindAllMaintenance = Maintenance.findAll;
  const originalFindAllWorkOrders = MaintenanceWorkOrder.findAll;

  User.findAll = async () => [{
    id: 7,
    username: 'techone',
    fullName: 'Aster Technician',
    email: 'aster@example.com',
    phone: '0912345678',
    department: 'ICT',
    active: true,
  }];
  Maintenance.findAll = async () => [{
    id: 101,
    assignedTo: 7,
    status: 'assigned',
    createdAt: '2026-09-10T00:00:00Z',
  }, {
    id: 102,
    assignedTo: 7,
    status: 'in-progress',
    createdAt: '2026-09-11T00:00:00Z',
  }, {
    id: 103,
    assignedTo: 7,
    status: 'completed',
    createdAt: '2026-09-12T00:00:00Z',
  }];
  MaintenanceWorkOrder.findAll = async () => [{
    id: 200,
    technicianId: 7,
    status: 'open',
    priority: 'high',
    createdAt: '2026-09-13T00:00:00Z',
  }, {
    id: 201,
    technicianId: 7,
    status: 'completed',
    priority: 'low',
    createdAt: '2026-09-14T00:00:00Z',
  }];

  try {
    let responseBody;
    await getTechnicianDirectory({ query: {}, user: { role: 'maintenance', collegeId: null } }, {
      json(payload) { responseBody = payload; },
      status(code) { this.statusCode = code; return this; },
    });

    assert.equal(responseBody.success, true);
    assert.equal(responseBody.summary.totalTechnicians, 1);
    assert.equal(responseBody.summary.available, 0);
    assert.equal(responseBody.summary.assigned, 1);
    assert.equal(responseBody.summary.activeWorkOrders, 1);
    assert.equal(responseBody.data[0].workloadLevel, 'Normal');
    assert.equal(responseBody.data[0].availability, 'Busy');
  } finally {
    User.findAll = originalFindAllUsers;
    Maintenance.findAll = originalFindAllMaintenance;
    MaintenanceWorkOrder.findAll = originalFindAllWorkOrders;
  }
});
