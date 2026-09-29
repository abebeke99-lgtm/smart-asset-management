const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../models');
const { getAllMaintenance, normalizeMaintenanceWorkOrder } = require('../controllers/maintenanceController');

test('maintenance request search uses physical joined column names', async () => {
  const originalQuery = sequelize.query;
  const queries = [];
  sequelize.query = async (sql) => {
    queries.push(sql);
    return /count\s*\(/i.test(sql) ? [{ count: 0 }] : [];
  };

  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };

  try {
    await getAllMaintenance({ query: { search: 'QA asset' }, user: { id: 6, role: 'maintenance' } }, response, (error) => {
      throw error;
    });
  } finally {
    sequelize.query = originalQuery;
  }

  const sql = queries.join('\n');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.match(sql, /`Asset`\.`asset_code`/);
  assert.match(sql, /`Technician`\.`full_name`/);
  assert.doesNotMatch(sql, /`Asset`\.`assetCode`/);
  assert.doesNotMatch(sql, /`Technician`\.`fullName`/);
});

test('normalized work-order response does not include circular Sequelize internals', () => {
  const workOrder = {
    toJSON: () => ({ id: 12, workOrderNumber: 'QA-WO-12', status: 'open', priority: 'high' }),
    Asset: { name: 'QA Maintenance Asset', assetCode: 'QA-MAINT-2026-001' },
    Maintenance: { title: 'QA maintenance request' },
    Technician: { fullName: 'QA Maintenance Technician' },
  };
  workOrder.options = { include: [workOrder] };

  const normalized = normalizeMaintenanceWorkOrder(workOrder);

  assert.doesNotThrow(() => JSON.stringify(normalized));
  assert.equal(normalized.workOrderNumber, 'QA-WO-12');
  assert.equal(normalized.technician, 'QA Maintenance Technician');
});