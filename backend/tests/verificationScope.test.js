const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const verification = require('../src/controllers/verificationController');

const originals = {
  sessionFindAll: models.VerificationSession.findAll,
  sessionFindOne: models.VerificationSession.findOne,
  sessionCreate: models.VerificationSession.create,
  itemFindOrCreate: models.VerificationItem.findOrCreate,
  assetFindOne: models.Asset.findOne,
  auditCreate: models.AuditLog.create,
  departmentFindOne: models.Department.findOne,
};

const restoreModels = () => {
  models.VerificationSession.findAll = originals.sessionFindAll;
  models.VerificationSession.findOne = originals.sessionFindOne;
  models.VerificationSession.create = originals.sessionCreate;
  models.VerificationItem.findOrCreate = originals.itemFindOrCreate;
  models.Asset.findOne = originals.assetFindOne;
  models.AuditLog.create = originals.auditCreate;
  models.Department.findOne = originals.departmentFindOne;
};

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('verification session list requires a college scope and queries only that college', async (t) => {
  let query;
  models.VerificationSession.findAll = async (options) => { query = options; return []; };
  t.after(restoreModels);

  const missingScope = response();
  await verification.listSessions({ organizationScope: {} }, missingScope, (error) => { throw error; });
  assert.equal(missingScope.statusCode, 403);

  const scoped = response();
  await verification.listSessions({ organizationScope: { collegeId: 22 } }, scoped, (error) => { throw error; });
  assert.deepEqual(query.where, { collegeId: 22 });
});

test('verification detail constrains both its session and included asset to the authorized scope', async (t) => {
  let query;
  models.VerificationSession.findOne = async (options) => { query = options; return null; };
  t.after(restoreModels);

  const res = response();
  await verification.getSession({
    params: { id: '12' },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 404);
  assert.deepEqual(query.where, { id: '12', collegeId: 22 });
  const itemInclude = query.include.find((include) => include.model === models.VerificationItem);
  const assetInclude = itemInclude.include.find((include) => include.model === models.Asset);
  assert.deepEqual(assetInclude.where, { collegeId: 22 });
  assert.equal(assetInclude.required, true);
});

test('verification item writes reject assets outside the college before persisting or auditing', async (t) => {
  let assetQuery;
  models.VerificationSession.findOne = async () => ({ id: 12, status: 'in_progress' });
  models.Asset.findOne = async (options) => { assetQuery = options; return null; };
  models.VerificationItem.findOrCreate = async () => { throw new Error('Out-of-scope asset must not be persisted'); };
  models.AuditLog.create = async () => { throw new Error('Out-of-scope asset must not be audited as a successful write'); };
  t.after(restoreModels);

  const res = response();
  await verification.addItem({
    params: { id: '12' },
    body: { asset_id: '88', state: 'verified' },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(assetQuery.where, { id: '88', collegeId: 22 });
});

test('verification session creation rejects a department outside the authenticated college', async (t) => {
  let sessionWrites = 0;
  models.Department.findOne = async (options) => {
    assert.deepEqual(options.where, { id: 99, collegeId: 22 });
    return null;
  };
  models.VerificationSession.create = async () => { sessionWrites += 1; };
  t.after(restoreModels);

  const res = response();
  await verification.createSession({
    body: { name: 'Annual verification', department_id: '99' },
    user: { id: 5 },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.equal(sessionWrites, 0);
});
