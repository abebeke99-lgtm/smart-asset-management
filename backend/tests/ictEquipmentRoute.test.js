const test = require('node:test');
const assert = require('node:assert/strict');
const controller = require('../src/controllers/ictAssetController');
const { Asset } = require('../src/models');

const originalFindAndCountAll = Asset.findAndCountAll;
const originalFindAll = Asset.findAll;

const buildReq = (overrides = {}) => ({
  user: { id: 1, role: 'admin' },
  query: {},
  ...overrides,
});

test('ICT equipment list returns normalized database summary totals for all dashboard cards', async () => {
  Asset.findAndCountAll = async () => ({
    count: 4,
    rows: [
      { id: 1, name: 'Laptop 01', status: 'available', condition: 'Good', category: 'Laptop', department: 'IT', location: 'Lab' },
      { id: 2, name: 'Desktop 01', status: 'assigned', condition: 'Good', category: 'Computer', department: 'IT', location: 'Office' },
      { id: 3, name: 'Printer 01', status: 'maintenance', condition: 'Fair', category: 'Printer', department: 'IT', location: 'Office' },
      { id: 4, name: 'Monitor 01', status: 'damaged', condition: 'Poor', category: 'Monitor', department: 'IT', location: 'Store' },
    ],
  });

  Asset.findAll = async ({ attributes } = {}) => {
    if (Array.isArray(attributes) && attributes.includes('status')) {
      return [
        { status: 'available' },
        { status: 'assigned' },
        { status: 'maintenance' },
        { status: 'damaged' },
      ];
    }
    return [];
  };

  const req = buildReq();
  const res = {
    json(payload) {
      this.payload = payload;
      return payload;
    },
  };

  await controller.listIctEquipment(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.ok(res.payload.summary, 'expected summary payload');
  assert.equal(res.payload.summary.total, 4);
  assert.equal(res.payload.summary.available, 1);
  assert.equal(res.payload.summary.assigned, 1);
  assert.equal(res.payload.summary.maintenance, 1);
  assert.equal(res.payload.summary.repair, 1);
  assert.equal(res.payload.summary.retired, 0);
  assert.equal(res.payload.equipment.length, 4);
});

test.afterEach(() => {
  Asset.findAndCountAll = originalFindAndCountAll;
  Asset.findAll = originalFindAll;
});
