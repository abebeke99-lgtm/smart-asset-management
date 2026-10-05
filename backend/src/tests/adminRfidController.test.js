const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const controller = require('../controllers/adminRfidController');
const adminRfidRoutes = require('../routes/adminRfidRoutes');
const { requireRole } = require('../middlewares/auth');

const originals = {};
originals['sequelize.query'] = models.sequelize.query;
for (const name of ['findAll', 'findByPk', 'findOne']) {
  originals[`Asset.${name}`] = models.Asset[name];
}
for (const name of ['findAll', 'findOne']) {
  originals[`Assignment.${name}`] = models.Assignment[name];
  originals[`Transfer.${name}`] = models.Transfer[name];
  originals[`Maintenance.${name}`] = models.Maintenance[name];
  originals[`MaintenanceWorkOrder.${name}`] = models.MaintenanceWorkOrder[name];
  originals[`MaintenanceRepair.${name}`] = models.MaintenanceRepair[name];
  originals[`PreventiveMaintenance.${name}`] = models.PreventiveMaintenance[name];
  originals[`MaintenanceCost.${name}`] = models.MaintenanceCost[name];
  originals[`AssetMovement.${name}`] = models.AssetMovement[name];
}

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('tracking summary uses one database query and returns consistent dynamic counts', async () => {
  const queries = [];
  models.sequelize.query = async (sql, options) => {
    queries.push({ sql, options });
    return [{ totalAssets: '23', rfidAssigned: '14', qrAssigned: '18', fullyTracked: '11' }];
  };
  const res = createResponse();
  await controller.summary({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.data, {
    totalAssets: 23,
    rfidAssigned: 14,
    qrAssigned: 18,
    fullyTracked: 11,
    notFullyTracked: 12,
  });
  assert.equal(queries.length, 1);
  assert.equal(queries[0].options.type, require('sequelize').QueryTypes.SELECT);
  assert.match(queries[0].sql, /FROM assets\s+WHERE deleted_at IS NULL/i);
  assert.match(queries[0].sql, /rfid_tag REGEXP '\[\^\[:space:\]\]'/);
  assert.match(queries[0].sql, /qr_code REGEXP '\[\^\[:space:\]\]'/);
  assert.equal(res.body.data.fullyTracked + res.body.data.notFullyTracked, res.body.data.totalAssets);
});

test('tracking summary reports a database failure as an explicit 500 response', async () => {
  const databaseError = new Error('Unknown column qr_code');
  const originalError = console.error;
  const logged = [];
  models.sequelize.query = async () => { throw databaseError; };
  console.error = (...args) => logged.push(args);
  try {
    const res = createResponse();
    await controller.summary({}, res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
      success: false,
      data: null,
      message: 'Unable to load tracking summary.',
    });
    assert.equal(logged.length, 1);
    assert.equal(logged[0][1], databaseError);
  } finally {
    console.error = originalError;
  }
});

test('exact tracking lookup returns 404 when no QR or RFID matches', async () => {
  models.Asset.findAll = async () => [];
  const res = createResponse();
  await controller.lookupCode({ params: { code: 'unknown' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.data, null);
});

test('exact tracking lookup returns 409 if legacy duplicate tags are found', async () => {
  models.Asset.findAll = async () => [{ id: 1 }, { id: 2 }];
  const res = createResponse();
  await controller.lookupCode({ params: { code: 'DUPLICATE' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /more than one asset/i);
});

test('tracking details include the asset, current location, current assignment, and histories', async () => {
  models.Asset.findByPk = async () => ({
    id: 12,
    assetCode: 'ASSET-12',
    name: 'Laptop',
    category: 'Computers',
    serialNumber: 'SER-12',
    status: 'in-use',
    condition: 'Good',
    qrCode: 'QR-12',
    rfidTag: 'RFID-12',
    purchaseDate: '2025-01-01',
    department: 'ICT',
    updatedAt: '2026-01-01',
    College: { collegeName: 'Engineering' },
    DepartmentRecord: { name: 'ICT' },
    BuildingRecord: { buildingName: 'Science' },
    RoomRecord: { roomName: '204', floor: 2 },
  });
  models.Assignment.findAll = async () => [{
    id: 4, assignedToType: 'user', assignedDate: '2026-01-02', status: 'active',
    User: { fullName: 'Aster' }, AssignedByUser: { fullName: 'Admin' }, location: 'Room 204',
  }];
  models.Transfer.findAll = async () => [{
    id: 5, currentLocation: 'Room 100', newLocation: 'Room 204',
    sourceDepartment: 'Store', destinationDepartment: 'ICT',
    transferDate: '2026-01-03', transferReason: 'Deployment', status: 'Approved',
    Approver: { fullName: 'Approver' },
  }];
  models.Maintenance.findAll = async () => [{
    id: 6, title: 'Screen repair', description: 'Repair', status: 'completed',
    createdAt: '2026-01-04', updatedAt: '2026-01-05', Technician: { fullName: 'Tech' },
  }];
  models.PreventiveMaintenance.findAll = async () => [];
  models.MaintenanceWorkOrder.findAll = async () => [{
    id: 7, maintenanceId: 6, workOrderNumber: 'WO-7', actualCost: '25.00',
    status: 'completed', diagnosis: 'Replaced screen', Technician: { fullName: 'Tech' },
  }];
  models.MaintenanceRepair.findAll = async () => [];
  models.MaintenanceCost.findAll = async () => [];
  models.AssetMovement.findOne = async () => ({ createdAt: '2026-01-06', User: { fullName: 'Mover' } });
  const res = createResponse();
  await controller.getTracking({ params: { id: '12' } }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.asset.qrCode, 'QR-12');
  assert.equal(res.body.data.currentLocation.college, 'Engineering');
  assert.equal(res.body.data.currentLocation.updatedBy, 'Mover');
  assert.equal(res.body.data.currentAssignment.assignedTo, 'Aster');
  assert.equal(res.body.data.assignmentHistory[0].assignedBy, 'Admin');
  assert.equal(res.body.data.transferHistory[0].approvedBy, 'Approver');
  assert.equal(res.body.data.maintenanceHistory[0].workOrderId, 'WO-7');
});

test('registers all tracking endpoints behind authentication and the admin role guard', () => {
  const endpoints = adminRfidRoutes.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods).find((method) => layer.route.methods[method]),
      handlers: layer.route.stack.length,
    }));
  assert.deepEqual(endpoints.map(({ method, path }) => `${method.toUpperCase()} ${path}`), [
    'GET /summary',
    'GET /assets',
    'GET /lookup/asset-id/:assetId',
    'GET /lookup/code/:code',
    'GET /assets/:id/tracking',
    'POST /scan-log',
    'POST /assets/:id/tags',
    'POST /assets/:id/qr/regenerate',
  ]);
  assert.ok(endpoints.every((endpoint) => endpoint.handlers >= 4));
});

test('admin role guard rejects unauthenticated and non-admin users', () => {
  const adminGuard = requireRole('admin');
  const invoke = (user) => {
    const res = createResponse();
    let calledNext = false;
    adminGuard({ user }, res, () => { calledNext = true; });
    return { res, calledNext };
  };
  const unauthenticated = invoke(undefined);
  assert.equal(unauthenticated.res.statusCode, 401);
  assert.equal(unauthenticated.calledNext, false);
  const forbidden = invoke({ role: 'staff' });
  assert.equal(forbidden.res.statusCode, 403);
  assert.equal(forbidden.calledNext, false);
  const admin = invoke({ role: 'admin' });
  assert.equal(admin.res.statusCode, 200);
  assert.equal(admin.calledNext, true);
});

test('creates a unique QR value for an asset created without a legacy digital ID', async () => {
  const asset = models.Asset.build({ name: 'Generated QR fixture' });
  await asset.validate();
  assert.match(asset.qrCode, /^QR-[A-F0-9]{32}$/);
  assert.equal(asset.digitalId, asset.qrCode);
  assert.equal(asset.rfidTag, null);
});

test.after(() => {
  for (const [key, value] of Object.entries(originals)) {
    const [model, method] = key.split('.');
    models[model][method] = value;
  }
});
