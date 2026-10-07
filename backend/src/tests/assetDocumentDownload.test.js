const test = require('node:test');
const assert = require('node:assert/strict');
const { AssetDocument } = require('../models');
const { downloadAssetDocument } = require('../controllers/assetExtendedController');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  sendFile() { throw new Error('Removed documents must not be served'); },
});

test('asset document download only finds active documents linked to the requested asset', async (t) => {
  const originalFindOne = AssetDocument.findOne;
  let query;
  AssetDocument.findOne = async (options) => {
    query = options;
    return null;
  };
  t.after(() => { AssetDocument.findOne = originalFindOne; });

  const response = makeResponse();
  await downloadAssetDocument({
    params: { id: '51', documentId: '3' },
    user: { role: 'department_head' },
  }, response, (error) => { throw error; });

  assert.deepEqual(query.where, { id: '3', assetId: '51', status: 'active' });
  assert.equal(response.statusCode, 404);
  assert.equal(response.body.message, 'Document not found');
});
