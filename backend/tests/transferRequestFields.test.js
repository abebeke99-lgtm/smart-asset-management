const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const auditLogService = require('../src/services/auditLogService');

const makeTransaction = () => ({
  LOCK: { UPDATE: 'UPDATE' },
  finished: undefined,
  async commit() { this.finished = 'commit'; },
  async rollback() { this.finished = 'rollback'; },
});

test('transfer request stores the entered reference, dates, serial, and notes', async (t) => {
  const transaction = makeTransaction();
  const asset = {
    id: 15,
    assetCode: 'AS-0015',
    serialNumber: 'SN-015',
    status: 'available',
    campusId: 1,
    collegeId: 1,
    departmentId: 7,
    department: 'Source Department',
    buildingId: 1,
    roomId: 10,
    location: 'Source Lab',
  };
  let createdValues;
  const createdTransfer = {
    id: 81,
    toJSON() { return { id: this.id, ...createdValues }; },
  };
  const originals = {
    transaction: models.sequelize.transaction,
    assetFindByPk: models.Asset.findByPk,
    departmentFindOne: models.Department.findOne,
    collegeFindOne: models.College.findOne,
    campusFindOne: models.Campus.findOne,
    buildingFindOne: models.Building.findOne,
    roomFindOne: models.Room.findOne,
    roomFindByPk: models.Room.findByPk,
    transferFindOne: models.Transfer.findOne,
    transferFindByPk: models.Transfer.findByPk,
    transferCreate: models.Transfer.create,
    userFindAll: models.User.findAll,
    auditCreate: auditLogService.createAuditLog,
  };

  models.sequelize.transaction = async () => transaction;
  models.Asset.findByPk = async () => asset;
  models.Department.findOne = async ({ where }) => ({ id: where.id, collegeId: 2, name: 'Destination Department' });
  models.College.findOne = async ({ where }) => ({ id: where.id, campusId: 2 });
  models.Campus.findOne = async ({ where }) => ({ id: where.id });
  models.Building.findOne = async ({ where }) => ({ id: where.id, campusId: 2 });
  models.Room.findOne = async ({ where }) => ({
    id: where.id,
    roomType: 'laboratory',
    buildingId: 3,
    campusId: 2,
    departmentId: 8,
    floor: 1,
  });
  models.Room.findByPk = async () => ({ floor: 0 });
  models.Transfer.findOne = async () => null;
  models.Transfer.create = async (values) => {
    createdValues = values;
    return createdTransfer;
  };
  models.Transfer.findByPk = async () => createdTransfer;
  models.User.findAll = async () => [];
  auditLogService.createAuditLog = async () => {};
  t.after(() => {
    models.sequelize.transaction = originals.transaction;
    models.Asset.findByPk = originals.assetFindByPk;
    models.Department.findOne = originals.departmentFindOne;
    models.College.findOne = originals.collegeFindOne;
    models.Campus.findOne = originals.campusFindOne;
    models.Building.findOne = originals.buildingFindOne;
    models.Room.findOne = originals.roomFindOne;
    models.Room.findByPk = originals.roomFindByPk;
    models.Transfer.findOne = originals.transferFindOne;
    models.Transfer.findByPk = originals.transferFindByPk;
    models.Transfer.create = originals.transferCreate;
    models.User.findAll = originals.userFindAll;
    auditLogService.createAuditLog = originals.auditCreate;
    delete require.cache[require.resolve('../src/routes/transferRoutes')];
  });

  delete require.cache[require.resolve('../src/routes/transferRoutes')];
  const transferRoutes = require('../src/routes/transferRoutes');
  const postRoute = transferRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post);
  const handler = postRoute.route.stack[postRoute.route.stack.length - 1].handle;
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  await handler({
    body: {
      assetId: 15,
      serialNumber: 'SN-015',
      transferNumber: 'TR-2026-15',
      sourceCampusId: 1,
      sourceCollegeId: 1,
      sourceDepartmentId: 7,
      destinationCampusId: 2,
      destinationCollegeId: 2,
      destinationDepartmentId: 8,
      destinationBuildingId: 3,
      destinationFloor: 1,
      destinationRoomId: 11,
      newLocation: 'Destination Campus / Destination College / Destination Department / Destination Building / Floor 1 / Destination Lab',
      transferDate: '2026-10-09',
      expectedReturnDate: '2026-10-20',
      conditionAtTransfer: 'Good',
      reason: 'Relocation',
      notes: 'Handle with care',
    },
    user: { id: 7, role: 'admin' },
    headers: {},
  }, response, (error) => { throw error; });

  assert.equal(response.statusCode, 201);
  assert.equal(transaction.finished, 'commit');
  assert.equal(createdValues.transferNumber, 'TR-2026-15');
  assert.equal(createdValues.expectedReturnDate.toISOString().slice(0, 10), '2026-10-20');
  assert.equal(createdValues.transferDate.toISOString().slice(0, 10), '2026-10-09');
  assert.equal(createdValues.notes, 'Handle with care');
});
