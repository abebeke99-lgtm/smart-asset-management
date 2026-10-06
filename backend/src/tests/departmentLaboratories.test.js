const test = require('node:test');
const assert = require('node:assert/strict');
const {
  Asset,
  Building,
  Department,
  Maintenance,
  Room,
  ServiceRequest,
  Transfer,
  User,
} = require('../models');
const { requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');
const { listLaboratories, getLaboratoryDashboard } = require('../controllers/departmentLaboratoryController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.payload = payload;
    return this;
  },
});

const roomRecord = (overrides = {}) => ({
  id: 11,
  departmentId: 3,
  roomName: 'Physics Laboratory',
  roomCode: 'PHY-LAB',
  capacity: 24,
  condition: 'Good',
  status: 'Active',
  Building: { buildingName: 'Science Hall', buildingCode: 'SCI' },
  DepartmentRecord: { id: 3, name: 'Physics', code: 'PHY' },
  ResponsibleStaff: { fullName: 'Aster Lecturer' },
  ...overrides,
});

test('department laboratory list scopes records and assets to the authorized department', async (t) => {
  const originals = {
    departmentFindByPk: Department.findByPk,
    roomFindAll: Room.findAll,
    assetFindAll: Asset.findAll,
  };
  let roomQuery;
  let assetQuery;
  Department.findByPk = async () => ({ id: 3, name: 'Physics', code: 'PHY' });
  Room.findAll = async (options) => {
    roomQuery = options;
    return [roomRecord()];
  };
  Asset.findAll = async (options) => {
    assetQuery = options;
    return [
      { id: 20, roomId: 11, status: 'available', condition: 'Good' },
    ];
  };
  t.after(() => {
    Department.findByPk = originals.departmentFindByPk;
    Room.findAll = originals.roomFindAll;
    Asset.findAll = originals.assetFindAll;
  });

  const res = makeResponse();
  await listLaboratories({
    organizationScope: { departmentId: 3 },
    query: { departmentId: 999 },
  }, res, (error) => { throw error; });

  assert.equal(roomQuery.where.departmentId, 3);
  assert.deepEqual(assetQuery.where, { departmentId: 3, roomId: { [require('sequelize').Op.in]: [11] } });
  assert.deepEqual(roomQuery.include, [
    { model: Building, attributes: ['id', 'buildingName', 'buildingCode'], required: false },
    { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
    { model: User, as: 'ResponsibleStaff', attributes: ['id', 'fullName', 'username'], where: { departmentId: 3 }, required: false },
  ]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.summary, { total: 1, active: 1, inactive: 0, assets: 1 });
  assert.equal(res.payload.data[0].responsibleStaff, 'Aster Lecturer');
  assert.equal(res.payload.data[0].assetCount, 1);
});

test('laboratory detail includes scoped inventory, dashboard counts and recent records', async (t) => {
  const originals = {
    roomFindOne: Room.findOne,
    assetFindAll: Asset.findAll,
    serviceRequestFindAll: ServiceRequest.findAll,
    maintenanceFindAll: Maintenance.findAll,
    transferFindAll: Transfer.findAll,
  };
  let roomQuery;
  let assetQuery;
  let requestQuery;
  let maintenanceQuery;
  let transferQuery;
  Room.findOne = async (options) => {
    roomQuery = options;
    return roomRecord();
  };
  Asset.findAll = async (options) => {
    assetQuery = options;
    return [
      { id: 30, roomId: 11, name: 'Microscope', status: 'available', condition: 'Good' },
      { id: 31, roomId: 11, name: 'Balance', status: 'damaged', condition: 'Damaged' },
      { id: 32, roomId: 11, name: 'Centrifuge', status: 'under maintenance', condition: 'Fair' },
      { id: 33, roomId: 11, name: 'Retired scope', status: 'retired', condition: 'Poor' },
    ];
  };
  ServiceRequest.findAll = async (options) => {
    requestQuery = options;
    return [{ id: 1, status: 'submitted' }, { id: 2, status: 'completed' }];
  };
  Maintenance.findAll = async (options) => {
    maintenanceQuery = options;
    return [{ id: 5, title: 'Calibration', status: 'completed', Asset: { name: 'Microscope' } }];
  };
  Transfer.findAll = async (options) => {
    transferQuery = options;
    return [{ id: 6, sourceRoomId: 11, destinationRoomId: 19, transferNumber: 'TR-6', status: 'Completed' }];
  };
  t.after(() => {
    Room.findOne = originals.roomFindOne;
    Asset.findAll = originals.assetFindAll;
    ServiceRequest.findAll = originals.serviceRequestFindAll;
    Maintenance.findAll = originals.maintenanceFindAll;
    Transfer.findAll = originals.transferFindAll;
  });

  const res = makeResponse();
  await getLaboratoryDashboard({
    organizationScope: { departmentId: 3 },
    params: { id: '11' },
  }, res, (error) => { throw error; });

  assert.equal(roomQuery.where.id, 11);
  assert.equal(roomQuery.where.departmentId, 3);
  assert.equal(assetQuery.where.departmentId, 3);
  assert.deepEqual(requestQuery.where.assetId, { [require('sequelize').Op.in]: [30, 31, 32, 33] });
  assert.deepEqual(maintenanceQuery.where.assetId, { [require('sequelize').Op.in]: [30, 31, 32, 33] });
  assert.equal(transferQuery.where[require('sequelize').Op.or][0].sourceRoomId, 11);
  assert.deepEqual(res.payload.summary, {
    totalAssets: 4,
    functionalAssets: 1,
    damagedAssets: 1,
    assetsUnderMaintenance: 1,
    openServiceRequests: 1,
  });
  assert.equal(res.payload.inventory.length, 4);
  assert.equal(res.payload.recentMaintenance[0].title, 'Calibration');
  assert.equal(res.payload.recentTransfers[0].direction, 'outgoing');
});

test('laboratory detail does not reveal a laboratory outside the authorized department', async (t) => {
  const original = Room.findOne;
  let query;
  Room.findOne = async (options) => {
    query = options;
    return null;
  };
  t.after(() => { Room.findOne = original; });

  const res = makeResponse();
  await getLaboratoryDashboard({
    organizationScope: { departmentId: 3 },
    params: { id: '999' },
  }, res, (error) => { throw error; });

  assert.equal(query.where.id, 999);
  assert.equal(query.where.departmentId, 3);
  assert.equal(res.statusCode, 404);
  assert.equal(res.payload.message, 'Laboratory not found.');
});

test('laboratory endpoints are registered behind department-head authentication and scope', () => {
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
  }
  for (const routePath of ['/laboratories', '/laboratories/:id']) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.route?.path === routePath && layer.route.methods.get));
  }
});
