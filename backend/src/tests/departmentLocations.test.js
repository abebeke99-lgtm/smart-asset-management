const test = require('node:test');
const assert = require('node:assert/strict');
const { Asset, Building, Campus, Department, Location, Room } = require('../models');
const { requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const departmentWorkspaceRoutes = require('../routes/departmentWorkspaceRoutes');
const { listDepartmentLocations } = require('../controllers/departmentController');

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

test('department locations query authorized department rooms and assets only', async (t) => {
  const originals = {
    departmentFindByPk: Department.findByPk,
    roomFindAll: Room.findAll,
    assetFindAll: Asset.findAll,
    locationFindAll: Location.findAll,
  };
  let roomQuery;
  let assetQuery;
  let globalLocationLookupCount = 0;
  Department.findByPk = async () => ({
    id: 3,
    name: 'Engineering',
    code: 'ENG',
    collegeId: 2,
    LocationRecord: { id: 50, name: 'Engineering Office', status: 'active', code: 'ENG-OFF', description: 'Department office' },
    College: { id: 2, collegeName: 'Engineering College', collegeCode: 'ENG-C' },
  });
  Room.findAll = async (options) => {
    roomQuery = options;
    return [{
      id: 11,
      roomCode: 'LAB-11',
      roomName: 'Physics Lab',
      roomType: 'laboratory',
      departmentId: 3,
      buildingId: 8,
      description: 'Physics teaching laboratory',
      floor: 2,
      status: 'active',
      Building: { buildingName: 'Science Hall', buildingCode: 'SCI' },
    }];
  };
  Asset.findAll = async (options) => {
    assetQuery = options;
    return [
      { id: 100, roomId: 11, location: 'Physics Lab' },
      { id: 101, roomId: 900, location: 'Other Department Lab' },
      { id: 102, roomId: null, location: 'Engineering Office' },
    ];
  };
  Location.findAll = async () => {
    globalLocationLookupCount += 1;
    return [{ id: 900, name: 'Other Department Lab', status: 'active' }];
  };
  t.after(() => {
    Department.findByPk = originals.departmentFindByPk;
    Room.findAll = originals.roomFindAll;
    Asset.findAll = originals.assetFindAll;
    Location.findAll = originals.locationFindAll;
  });

  const res = makeResponse();
  await listDepartmentLocations({
    organizationScope: { departmentId: 3 },
    query: { departmentId: 999, status: 'active', type: 'laboratory', search: 'physics' },
  }, res, (error) => { throw error; });

  assert.equal(roomQuery.where.departmentId, 3);
  assert.equal(assetQuery.where.departmentId, 3);
  assert.deepEqual(roomQuery.include, [
    { model: Building, attributes: ['id', 'buildingName', 'buildingCode'], required: false },
    { model: Campus, attributes: ['id', 'campusName', 'campusCode'], required: false },
  ]);
  assert.equal(globalLocationLookupCount, 0);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.filters.types, ['department_location', 'laboratory']);
  assert.deepEqual(res.payload.filters.campuses, []);
  assert.deepEqual(res.payload.summary, { total: 2, active: 2, inactive: 0, locationsWithAssets: 2 });
  assert.equal(res.payload.data.length, 1);
  assert.equal(res.payload.data[0].id, 11);
  assert.equal(res.payload.data[0].building, 'Science Hall');
  assert.equal(res.payload.data[0].room, 'Physics Lab');
  assert.equal(res.payload.data[0].department, 'Engineering');
  assert.equal(res.payload.data[0].assetCount, 1);
});

test('department location handler rejects a missing resolved scope', async () => {
  const res = makeResponse();
  await listDepartmentLocations({ organizationScope: {}, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 403);
  assert.match(res.payload.message, /Department scope is not configured/);
});

test('department locations are behind authentication and scope middleware; export requires reports.export', () => {
  for (const middleware of [...requireDepartmentHead, resolveDepartmentScope]) {
    assert.ok(departmentWorkspaceRoutes.stack.some((layer) => layer.handle === middleware));
  }
  const locationsRoute = departmentWorkspaceRoutes.stack.find(
    (layer) => layer.route?.path === '/locations' && layer.route.methods.get,
  ).route;
  assert.equal(locationsRoute.stack.length, 2);

  const exportGuard = locationsRoute.stack[0].handle;
  let nextCalled = false;
  const forbidden = makeResponse();
  exportGuard({ query: { export: 'true' }, user: { role: 'department_head', permissions: [] } }, forbidden, () => { nextCalled = true; });
  assert.equal(forbidden.statusCode, 403);
  assert.equal(nextCalled, false);

  nextCalled = false;
  const allowed = makeResponse();
  exportGuard({ query: { export: 'true' }, user: { role: 'department_head', permissions: ['reports.export'] } }, allowed, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
