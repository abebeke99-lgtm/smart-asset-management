const test = require('node:test');
const assert = require('node:assert/strict');
const {
  Asset,
  Assignment,
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
      { id: 21, roomId: null, specifications: { laboratoryId: '11' }, status: 'available', condition: 'Good' },
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
  assert.equal(roomQuery.where.roomType[require('sequelize').Op.like], '%lab%');
  assert.equal(assetQuery.where.departmentId, 3);
  assert.deepEqual(assetQuery.where[require('sequelize').Op.or][0], { roomId: { [require('sequelize').Op.in]: [11] } });
  assert.deepEqual(assetQuery.where[require('sequelize').Op.or].slice(1), [
    { 'specifications.laboratoryId': 11 },
    { 'specifications.laboratoryId': '11' },
  ]);
  assert.deepEqual(roomQuery.include, [
    { model: Building, attributes: ['id', 'buildingName', 'buildingCode'], required: false },
    { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
    { model: User, as: 'ResponsibleStaff', attributes: ['id', 'fullName', 'username'], where: { departmentId: 3 }, required: false },
  ]);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.summary, {
    total: 1,
    active: 1,
    temporarilyClosed: 0,
    underMaintenance: 0,
    restricted: 0,
    inactive: 0,
    assets: 2,
  });
  assert.equal(res.payload.data[0].responsibleStaff, 'Aster Lecturer');
  assert.equal(res.payload.data[0].room, 'PHY-LAB');
  assert.equal(res.payload.data[0].capacity, 24);
  assert.equal(res.payload.data[0].department, 'Physics');
  assert.equal(res.payload.data[0].assetCount, 2);
});

test('department laboratory summary counts all supported statuses from scoped records', async (t) => {
  const originals = {
    departmentFindByPk: Department.findByPk,
    roomFindAll: Room.findAll,
    assetFindAll: Asset.findAll,
  };
  Department.findByPk = async () => ({ id: 3, name: 'Physics', code: 'PHY' });
  Room.findAll = async () => [
    roomRecord({ id: 11, status: 'Active' }),
    roomRecord({ id: 12, status: 'Temporarily Closed' }),
    roomRecord({ id: 13, status: 'Under Maintenance' }),
    roomRecord({ id: 14, status: 'Restricted' }),
    roomRecord({ id: 15, status: 'Inactive' }),
  ];
  Asset.findAll = async () => [11, 12, 13, 14, 15].map((roomId, index) => ({ id: 20 + index, roomId }));
  t.after(() => {
    Department.findByPk = originals.departmentFindByPk;
    Room.findAll = originals.roomFindAll;
    Asset.findAll = originals.assetFindAll;
  });

  const res = makeResponse();
  await listLaboratories({ organizationScope: { departmentId: 3 } }, res, (error) => { throw error; });

  assert.deepEqual(res.payload.summary, {
    total: 5,
    active: 1,
    temporarilyClosed: 1,
    underMaintenance: 1,
    restricted: 1,
    inactive: 1,
    assets: 5,
  });
});

test('laboratory detail includes scoped inventory, dashboard counts and recent records', async (t) => {
  const originals = {
    roomFindOne: Room.findOne,
    assetFindAll: Asset.findAll,
    assignmentFindAll: Assignment.findAll,
    serviceRequestFindAll: ServiceRequest.findAll,
    maintenanceFindAll: Maintenance.findAll,
    transferFindAll: Transfer.findAll,
  };
  let roomQuery;
  let assetQuery;
  let requestQuery;
  let maintenanceQuery;
  let transferQuery;
  let assignmentQuery;
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
      { id: 34, roomId: null, specifications: { laboratoryId: 11 }, name: 'Cabinet', status: 'available', condition: 'Good' },
    ];
  };
  Assignment.findAll = async (options) => {
    assignmentQuery = options;
    return [{ assetId: 30, User: { id: 99, fullName: 'Department Staff' } }];
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
    Assignment.findAll = originals.assignmentFindAll;
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
  assert.deepEqual(assignmentQuery.where, { status: 'active', assetId: { [require('sequelize').Op.in]: [30, 31, 32, 33, 34] } });
  assert.deepEqual(assignmentQuery.include[0].where, { departmentId: 3 });
  assert.deepEqual(requestQuery.where.assetId, { [require('sequelize').Op.in]: [30, 31, 32, 33, 34] });
  assert.deepEqual(maintenanceQuery.where.assetId, { [require('sequelize').Op.in]: [30, 31, 32, 33, 34] });
  assert.equal(transferQuery.where[require('sequelize').Op.or][0].sourceRoomId, 11);
  assert.deepEqual(transferQuery.where.assetId, { [require('sequelize').Op.in]: [30, 31, 32, 33, 34] });
  assert.deepEqual(res.payload.summary, {
    totalAssets: 5,
    functionalAssets: 2,
    damagedAssets: 1,
    assetsUnderMaintenance: 1,
    openServiceRequests: 1,
  });
  assert.equal(res.payload.inventory.length, 5);
  assert.equal(res.payload.inventory[0].assignedUser, 'Department Staff');
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

test('laboratory list rejects missing department scope without querying records', async (t) => {
  const originalRoomFindAll = Room.findAll;
  Room.findAll = async () => assert.fail('A missing department scope must not query laboratories');
  t.after(() => { Room.findAll = originalRoomFindAll; });

  const res = makeResponse();
  await listLaboratories({ query: { departmentId: 3 } }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /department scope/i);
});

test('anonymous and non-department-head users are rejected by the laboratory role guard', () => {
  const requireRoleForDepartmentHead = requireDepartmentHead[1];
  const anonymousResponse = makeResponse();
  requireRoleForDepartmentHead({ user: null }, anonymousResponse, () => assert.fail('Anonymous users must be rejected'));
  assert.equal(anonymousResponse.statusCode, 401);

  const unauthorizedResponse = makeResponse();
  requireRoleForDepartmentHead({ user: { role: 'staff' } }, unauthorizedResponse, () => assert.fail('Other roles must be rejected'));
  assert.equal(unauthorizedResponse.statusCode, 403);
});

test('laboratory endpoints are registered behind department-head authentication and scope', () => {
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
  }
  for (const routePath of ['/laboratories', '/laboratories/:id']) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.route?.path === routePath && layer.route.methods.get));
  }
});
