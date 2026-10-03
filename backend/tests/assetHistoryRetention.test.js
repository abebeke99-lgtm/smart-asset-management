const test = require('node:test');
const after = require('node:test').after;
const assert = require('node:assert/strict');
const models = require('../src/models');
const { getAssetHistory, createAsset } = require('../src/controllers/assetController');

const originals = {
  transaction: models.sequelize.transaction,
  assetFindByPk: models.Asset.findByPk,
  assignmentFindAll: models.Assignment.findAll,
  transferFindAll: models.Transfer.findAll,
  maintenanceFindAll: models.Maintenance.findAll,
  rfidFindAll: models.RFIDLog.findAll,
  auditFindAll: models.AuditLog.findAll,
};

after(() => {
  models.sequelize.transaction = originals.transaction;
  models.Asset.findByPk = originals.assetFindByPk;
  models.Assignment.findAll = originals.assignmentFindAll;
  models.Transfer.findAll = originals.transferFindAll;
  models.Maintenance.findAll = originals.maintenanceFindAll;
  models.RFIDLog.findAll = originals.rfidFindAll;
  models.AuditLog.findAll = originals.auditFindAll;
});

const createResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

test('asset history includes soft-deleted assets and audit before/after values', async () => {
  let lookupOptions;
  models.Asset.findByPk = async (_id, options) => {
    lookupOptions = options;
    return { id: 9, department: 'Science', collegeId: 2 };
  };
  models.Assignment.findAll = async () => [];
  models.Transfer.findAll = async () => [];
  models.Maintenance.findAll = async () => [];
  models.RFIDLog.findAll = async () => [];
  models.AuditLog.findAll = async () => [{
    action: 'CREATE_ASSET',
    entity: 'asset:9',
    userId: 3,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    details: JSON.stringify({ previousValue: null, newValue: { name: 'Microscope' } }),
  }];

  const response = createResponse();
  await getAssetHistory({ params: { id: '9' }, user: { id: 3, role: 'admin' } }, response);

  assert.equal(lookupOptions.paranoid, false);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.history[0].action, 'CREATE_ASSET');
  assert.equal(response.payload.history[0].previousValue, null);
  assert.deepEqual(response.payload.history[0].newValue, { name: 'Microscope' });
});

test('asset registration rejects missing required fields before writing', async () => {
  let rolledBack = false;
  models.sequelize.transaction = async () => ({
    rollback: async () => { rolledBack = true; },
    commit: async () => {},
  });

  const response = createResponse();
  await createAsset({ body: {}, user: { id: 3, role: 'admin' } }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.payload.message, /name is required/i);
  assert.equal(rolledBack, true);
});
