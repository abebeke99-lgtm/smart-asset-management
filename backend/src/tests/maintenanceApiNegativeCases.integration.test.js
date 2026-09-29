const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { sequelize, User, Asset, Maintenance, MaintenanceWorkOrder } = require('../models');
const { getJwtSecret } = require('../config/jwt');
const { requireRole } = require('../middlewares/auth');
const maintenanceRoutes = require('../routes/maintenanceRoutes');

const enabled = process.env.MAINTENANCE_API_INTEGRATION === '1';

test('maintenance API rejects unauthenticated, forbidden, missing, invalid, and unknown requests without 500s', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'API integration test is disabled in production');
  await sequelize.authenticate();
  const user = await User.findOne({ where: { role: 'maintenance', active: true } });
  assert.ok(user, 'an active maintenance user is required to sign a local test token');

  const app = express();
  app.use(express.json());
  app.get('/__test/forbidden', (req, res, next) => { req.user = { role: 'student' }; next(); }, requireRole('maintenance'), (req, res) => res.sendStatus(204));
  app.use('/api/maintenance', maintenanceRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: user.id, sessionVersion: user.sessionVersion }, getJwtSecret(), { expiresIn: '2m' });
  const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.auth ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  try {
    const unauthorized = await request('/api/maintenance/work-orders');
    const forbidden = await request('/__test/forbidden');
    const missing = await request('/api/maintenance', { method: 'POST', auth: true, body: {} });
    const unknown = await request('/api/maintenance/work-orders/2147483647', { auth: true });
    const invalid = await request('/api/maintenance/work-orders', { method: 'POST', auth: true, body: { assetId: 'not-an-id' } });
    const invalidCost = await request('/api/maintenance/repairs', {
      method: 'POST', auth: true, body: { asset_id: 1, problem: 'Malformed cost', labor_cost: 'not-money' },
    });

    const duplicateTransaction = await sequelize.transaction();
    const originalTransaction = sequelize.transaction;
    let fixtureAsset;
    let fixtureMaintenance;
    let fixtureWorkOrder;
    try {
      const marker = `QA-API-${Date.now()}`;
      fixtureAsset = await Asset.create({ name: marker, assetCode: marker, digitalId: marker, createdBy: user.id }, { transaction: duplicateTransaction });
      fixtureMaintenance = await Maintenance.create({ assetId: fixtureAsset.id, requestedBy: user.id, title: marker, description: marker, priority: 'medium' }, { transaction: duplicateTransaction });
      fixtureWorkOrder = await MaintenanceWorkOrder.create({ maintenanceId: fixtureMaintenance.id, assetId: fixtureAsset.id, workOrderNumber: marker, priority: 'medium' }, { transaction: duplicateTransaction });
      sequelize.transaction = async () => duplicateTransaction;
      const duplicate = await request('/api/maintenance/work-orders', {
        method: 'POST', auth: true, body: { assetId: fixtureAsset.id, maintenanceId: fixtureMaintenance.id },
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicateTransaction.finished, 'rollback');
    } finally {
      sequelize.transaction = originalTransaction;
      if (!duplicateTransaction.finished) await duplicateTransaction.rollback();
    }

    assert.equal(unauthorized.status, 401);
    assert.equal(forbidden.status, 403);
    assert.equal(missing.status, 400);
    assert.equal(unknown.status, 404);
    assert.equal(invalid.status, 422);
    assert.equal(invalidCost.status, 422);
    assert.equal(await Asset.findByPk(fixtureAsset.id), null);
    assert.equal(await Maintenance.findByPk(fixtureMaintenance.id), null);
    assert.equal(await MaintenanceWorkOrder.findByPk(fixtureWorkOrder.id), null);
    assert.ok([unauthorized, forbidden, missing, unknown, invalid, invalidCost].every((response) => response.status < 500));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await sequelize.close();
  }
});
