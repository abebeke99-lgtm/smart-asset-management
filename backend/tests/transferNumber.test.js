const test = require('node:test');
const assert = require('node:assert/strict');
const transferRoutes = require('../src/routes/transferRoutes');

const { generateTransferNumber } = transferRoutes;

test('generateTransferNumber creates a unique transfer reference in the project format', () => {
  const reference = generateTransferNumber();

  assert.match(reference, /^TRF-\d{4}-\d{4,}$/);
  assert.notEqual(reference, generateTransferNumber());
});
