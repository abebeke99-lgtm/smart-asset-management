const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const verification = require('../src/controllers/verificationController');

const originals = {
  transaction: models.sequelize.transaction,
  sessionFindAll: models.VerificationSession.findAll,
  sessionFindOne: models.VerificationSession.findOne,
  sessionCreate: models.VerificationSession.create,
  itemFindOrCreate: models.VerificationItem.findOrCreate,
  itemBulkCreate: models.VerificationItem.bulkCreate,
  assetFindOne: models.Asset.findOne,
  assetFindAll: models.Asset.findAll,
  auditCreate: models.AuditLog.create,
  departmentFindOne: models.Department.findOne,
};

const restoreModels = () => {
  models.sequelize.transaction = originals.transaction;
  models.VerificationSession.findAll = originals.sessionFindAll;
  models.VerificationSession.findOne = originals.sessionFindOne;
  models.VerificationSession.create = originals.sessionCreate;
  models.VerificationItem.findOrCreate = originals.itemFindOrCreate;
  models.VerificationItem.bulkCreate = originals.itemBulkCreate;
  models.Asset.findOne = originals.assetFindOne;
  models.Asset.findAll = originals.assetFindAll;
  models.AuditLog.create = originals.auditCreate;
  models.Department.findOne = originals.departmentFindOne;
};

const mockTransaction = () => {
  const transaction = {
    finished: false,
    LOCK: { UPDATE: 'UPDATE' },
    async commit() { this.finished = 'commit'; },
    async rollback() { this.finished = 'rollback'; },
  };
  models.sequelize.transaction = async () => transaction;
  return transaction;
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
  mockTransaction();
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
    user: { id: 5 },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 403);
  assert.deepEqual(assetQuery.where, { id: 88, collegeId: 22 });
});

test('verification results record the authenticated verifier and observed location transactionally', async (t) => {
  const transaction = mockTransaction();
  const recorded = {};
  let assetQuery;
  let audit;
  models.VerificationSession.findOne = async (options) => {
    assert.equal(options.transaction, transaction);
    return { id: 12, status: 'in_progress', departmentId: 17 };
  };
  models.Asset.findOne = async (options) => {
    assetQuery = options;
    return { id: 34 };
  };
  models.VerificationItem.findOrCreate = async (options) => {
    assert.equal(options.transaction, transaction);
    return [{
      state: 'pending',
      async update(values, updateOptions) {
        Object.assign(recorded, values);
        assert.equal(updateOptions.transaction, transaction);
      },
    }, false];
  };
  models.AuditLog.create = async (values, options) => { audit = { values, options }; };
  t.after(restoreModels);

  const res = response();
  await verification.addItem({
    params: { id: '12' },
    body: { asset_id: '34', state: 'wrong_location', observed_location: 'Storage room', notes: 'Moved without update' },
    user: { id: 5 },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(assetQuery.where, { id: 34, collegeId: 22, departmentId: 17 });
  assert.deepEqual(recorded, {
    state: 'wrong_location',
    notes: 'Moved without update',
    observedLocation: 'Storage room',
    verifiedBy: 5,
  });
  assert.equal(audit.values.userId, 5);
  assert.equal(audit.options.transaction, transaction);
  assert.equal(transaction.finished, 'commit');
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

test('verification session creation transactionally snapshots authorized assets as pending', async (t) => {
  const transaction = mockTransaction();
  let sessionCreate;
  let pendingItems;
  let audit;
  models.Department.findOne = async (options) => {
    assert.deepEqual(options.where, { id: 17, collegeId: 22 });
    return { id: 17 };
  };
  models.Asset.findAll = async (options) => {
    assert.deepEqual(options.where, { collegeId: 22, departmentId: 17 });
    return [{ id: 34 }, { id: 35 }];
  };
  models.VerificationSession.create = async (values, options) => {
    sessionCreate = { values, options };
    return { id: 12, ...values };
  };
  models.VerificationItem.bulkCreate = async (rows, options) => { pendingItems = { rows, options }; };
  models.AuditLog.create = async (values, options) => { audit = { values, options }; };
  t.after(restoreModels);

  const res = response();
  await verification.createSession({
    body: { name: 'Annual verification', department_id: 17 },
    user: { id: 5 },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(sessionCreate.values.status, 'in_progress');
  assert.equal(sessionCreate.values.startedBy, 5);
  assert.equal(sessionCreate.options.transaction, transaction);
  assert.deepEqual(pendingItems.rows, [
    { sessionId: 12, assetId: 34, state: 'pending', notes: '' },
    { sessionId: 12, assetId: 35, state: 'pending', notes: '' },
  ]);
  assert.equal(pendingItems.options.transaction, transaction);
  assert.equal(audit.options.transaction, transaction);
  assert.equal(transaction.finished, 'commit');
});

test('verification session creation refuses an empty authorized asset scope', async (t) => {
  let sessionWrites = 0;
  models.Asset.findAll = async () => [];
  models.VerificationSession.create = async () => { sessionWrites += 1; };
  t.after(restoreModels);

  const res = response();
  await verification.createSession({
    body: { name: 'Empty scope verification' },
    user: { id: 5 },
    organizationScope: { collegeId: 22 },
  }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /No registered assets/);
  assert.equal(sessionWrites, 0);
});
