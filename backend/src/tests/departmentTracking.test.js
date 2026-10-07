const test = require('node:test');
const assert = require('node:assert/strict');
const { Asset, Assignment } = require('../models');
const tracking = require('../controllers/assetTrackingController');

const makeResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test('asset location verification compares a supplied location with the asset location', async (t) => {
  const original = Asset.findOne;
  Asset.findOne = async () => ({ id: 7, location: 'Science Lab', RoomRecord: null });
  t.after(() => { Asset.findOne = original; });
  const response = makeResponse();

  await tracking.verifyLocation({ params: { id: 7 }, body: { actualLocation: 'science lab' } }, response, (error) => { throw error; });

  assert.equal(response.payload.data.matches, true);
  assert.equal(response.payload.data.expectedLocation, 'Science Lab');
});

test('asset location verification validates observed value and reports mismatches', async (t) => {
  const original = Asset.findOne;
  Asset.findOne = async () => ({ id: 7, location: 'Science Lab', RoomRecord: null });
  t.after(() => { Asset.findOne = original; });

  const missing = makeResponse();
  await tracking.verifyLocation({ params: { id: 7 }, body: {} }, missing, (error) => { throw error; });
  assert.equal(missing.statusCode, 400);

  const mismatch = makeResponse();
  await tracking.verifyLocation({ params: { id: 7 }, body: { actual_location: 'Store' } }, mismatch, (error) => { throw error; });
  assert.equal(mismatch.payload.data.matches, false);
});

test('assignment verification requires a department-scoped assignment and compares assigned user ID', async (t) => {
  const originals = { asset: Asset.findByPk, assignment: Assignment.findOne };
  let assignmentQuery;
  Asset.findByPk = async () => ({ id: 7 });
  Assignment.findOne = async (options) => {
    assignmentQuery = options;
    return { assignedTo: 29, User: { fullName: 'Department Staff' } };
  };
  t.after(() => {
    Asset.findByPk = originals.asset;
    Assignment.findOne = originals.assignment;
  });

  const response = makeResponse();
  await tracking.verifyAssignment({
    params: { id: 7 },
    organizationScope: { departmentId: 17 },
    body: { assignedTo: '29' },
  }, response, (error) => { throw error; });

  assert.equal(assignmentQuery.where.departmentId, 17);
  assert.equal(assignmentQuery.where.assetId, 7);
  assert.equal(response.payload.data.matches, true);
  assert.equal(response.payload.data.assignedToName, 'Department Staff');
});
