const test = require('node:test');
const assert = require('node:assert/strict');
const { Asset, Maintenance, MaintenanceWorkOrder, User, sequelize } = require('../models');
const { normalizeMaintenanceWorkOrder, getMaintenanceWorkOrderSummary, getMaintenanceWorkOrderOptions, createMaintenanceWorkOrder } = require('../controllers/maintenanceController');

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
