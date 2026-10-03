const test = require('node:test');
const assert = require('node:assert/strict');
const transferRoutes = require('../src/routes/transferRoutes');

test('legacy transfer statuses normalize to the staged transfer workflow', () => {
  assert.equal(transferRoutes.normalizeTransferStatus('Pending'), 'Requested');
  assert.equal(transferRoutes.normalizeTransferStatus('Ready'), 'Approved');
  assert.equal(transferRoutes.normalizeTransferStatus('In Progress'), 'In Transit');
  assert.equal(transferRoutes.normalizeTransferStatus('Completed'), 'Received');
});

test('transfer eligibility blocks terminal, maintenance, lost, and in-transit assets', () => {
  for (const status of ['retired', 'disposed', 'under-maintenance', 'in-maintenance', 'lost', 'missing', 'in-transfer']) {
    assert.equal(transferRoutes.assetIsTransferable({ status }).ok, false, status);
  }
  assert.equal(transferRoutes.assetIsTransferable({ status: 'available' }).ok, true);
  assert.equal(transferRoutes.assetIsTransferable({ status: 'assigned' }).ok, true);
});

test('approval and physical transfer actions require distinct permissions', () => {
  const invoke = (status, permissions) => {
    const result = { status: null, nextCalled: false };
    transferRoutes.requireTransferActionPermission(
      { body: { status }, user: { role: 'admin', permissions } },
      { status(code) { result.status = code; return this; }, json() {} },
      () => { result.nextCalled = true; }
    );
    return result;
  };

  assert.deepEqual(invoke('Approved', ['assets.transfer']), { status: 403, nextCalled: false });
  assert.deepEqual(invoke('In Transit', ['assets.transfer.approve']), { status: 403, nextCalled: false });
  assert.deepEqual(invoke('Approved', ['assets.transfer.approve']), { status: null, nextCalled: true });
  assert.deepEqual(invoke('Received', ['assets.transfer']), { status: null, nextCalled: true });
});
