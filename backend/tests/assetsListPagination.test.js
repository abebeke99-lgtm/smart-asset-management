const test = require('node:test');
const after = require('node:test').after;
const assert = require('node:assert/strict');
const { Asset, Assignment } = require('../src/models');
const { getAllAssets } = require('../src/controllers/assetController');

const originals = {
  findAndCountAll: Asset.findAndCountAll,
  findAll: Asset.findAll,
  assignmentFindAll: Assignment.findAll,
};

after(() => {
  Asset.findAndCountAll = originals.findAndCountAll;
  Asset.findAll = originals.findAll;
  Assignment.findAll = originals.assignmentFindAll;
});

const createResponse = () => ({
  statusCode: 200,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return payload; },
});

test('GET /api/assets accepts the maximum supported page size and returns paginated assets', async () => {
  let query;
  const row = { id: 51, name: 'Laptop 51', assetCode: 'AST-051', status: 'available' };
  Asset.findAndCountAll = async (options) => { query = options; return { count: 51, rows: [row] }; };
  Asset.findAll = async () => [{ status: 'available' }];
  Assignment.findAll = async () => [];

  const response = createResponse();
  await getAllAssets({ user: { id: 1, role: 'ict_officer' }, query: { page: '2', limit: '50' } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(query.limit, 50);
  assert.equal(query.offset, 50);
  assert.equal(response.payload.assets.length, 1);
  assert.equal(response.payload.assets[0].asset_tag, 'AST-051');
  assert.equal(response.payload.assets[0].name, row.name);
  assert.deepEqual(response.payload.data, response.payload.assets);
  assert.deepEqual(response.payload.pagination, { page: 2, limit: 50, total: 51, pages: 2 });
});

test('GET /api/assets rejects limit=1000 with the documented validation message', async () => {
  Asset.findAndCountAll = async () => { throw new Error('Should not query for an unsupported limit'); };

  const response = createResponse();
  await getAllAssets({ user: { id: 1, role: 'ict_officer' }, query: { limit: '1000' } }, response);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.payload, { success: false, message: 'limit must be 10, 25, or 50' });
});