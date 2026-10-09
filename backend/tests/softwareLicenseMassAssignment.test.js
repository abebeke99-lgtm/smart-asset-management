const test = require('node:test');
const assert = require('node:assert/strict');
const { SoftwareLicense, AuditLog } = require('../src/models');
const controller = require('../src/controllers/softwareLicenseController');

const makeRes = () => {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return res;
};

const baseBody = (overrides = {}) => ({
  softwareName: 'Matlab',
  vendor: 'MathWorks',
  licenseType: 'Per User',
  startDate: '2024-01-01',
  expiryDate: '2999-01-01',
  quantity: 5,
  purchaseCost: 100,
  renewalCost: 0,
  ...overrides,
});

test('software license create ignores privileged fields and honors the whitelist', async (t) => {
  const originalCreate = SoftwareLicense.create;
  const originalAudit = AuditLog.create;
  let captured;
  SoftwareLicense.create = async (payload) => {
    captured = payload;
    return { id: 1, toJSON: () => ({ id: 1, ...payload }) };
  };
  AuditLog.create = async () => ({});
  t.after(() => { SoftwareLicense.create = originalCreate; AuditLog.create = originalAudit; });

  const req = {
    user: { id: 42, role: 'ict_officer' },
    organizationScope: { collegeId: 3 },
    body: baseBody({
      version: '1.2',
      notes: 'keep me',
      usedQuantity: 999,
      createdBy: 7,
      updatedBy: 7,
      id: 4242,
      archivedAt: '2020-01-01T00:00:00.000Z',
      collegeId: 99,
    }),
  };
  const res = makeRes();
  await controller.create(req, res, (error) => { throw error; });

  assert.equal(res.statusCode, 201);
  assert.equal(captured.version, '1.2');
  assert.equal(captured.notes, 'keep me');
  assert.equal(captured.usedQuantity, 0);
  assert.equal(captured.createdBy, 42);
  assert.equal(captured.updatedBy, 42);
  assert.equal(captured.collegeId, 3);
  assert.equal(captured.status, 'Active');
  assert.equal('id' in captured, false);
  assert.equal('archivedAt' in captured, false);
});

test('software license update ignores privileged fields and honors the whitelist', async (t) => {
  const originalFindOne = SoftwareLicense.findOne;
  const originalAudit = AuditLog.create;
  let capturedUpdate;
  const license = {
    id: 5,
    softwareName: 'Matlab',
    vendor: 'MathWorks',
    licenseType: 'Per User',
    startDate: '2024-01-01',
    expiryDate: '2999-01-01',
    quantity: 10,
    usedQuantity: 2,
    purchaseCost: 100,
    renewalCost: 0,
    renewalType: 'manual',
    licenseNumber: null,
    status: 'Active',
    toJSON() { return { id: this.id, softwareName: this.softwareName, expiryDate: this.expiryDate, status: this.status }; },
    async update(payload) { capturedUpdate = payload; Object.assign(this, payload); },
  };
  SoftwareLicense.findOne = async () => license;
  AuditLog.create = async () => ({});
  t.after(() => { SoftwareLicense.findOne = originalFindOne; AuditLog.create = originalAudit; });

  const req = {
    user: { id: 1, role: 'admin' },
    params: { id: '5' },
    query: {},
    body: baseBody({
      version: '2.0',
      usedQuantity: 999,
      collegeId: 77,
      archivedAt: '2020-01-01T00:00:00.000Z',
      id: 4242,
      createdBy: 7,
    }),
  };
  const res = makeRes();
  await controller.update(req, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(capturedUpdate.version, '2.0');
  assert.equal(capturedUpdate.updatedBy, 1);
  assert.equal('usedQuantity' in capturedUpdate, false);
  assert.equal('collegeId' in capturedUpdate, false);
  assert.equal('archivedAt' in capturedUpdate, false);
  assert.equal('id' in capturedUpdate, false);
});
