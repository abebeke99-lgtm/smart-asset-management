const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  sequelize,
  Asset,
  User,
  Maintenance,
  MaintenanceWorkOrder,
  MaintenanceRepair,
  MaintenanceQualityControl,
  AuditLog,
  MaintenanceHistory,
} = require('../models');
const { createMaintenanceWorkOrder, createRepair } = require('../controllers/maintenanceController');
const maintenanceRoutes = require('../routes/maintenanceRoutes');

const enabled = process.env.MAINTENANCE_INTEGRATION_DB === '1';
const invoke = (handler, request) => new Promise((resolve) => handler(request, {
  status(code) { this.statusCode = code; return this; },
  json(payload) { resolve({ statusCode: this.statusCode || 200, payload }); return this; },
}, (error) => resolve({ error })));

const withRollbackFixture = async (run) => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'write/rollback integration tests are disabled in production');
  await sequelize.authenticate();
  const actor = await User.findOne({ where: { role: 'maintenance', active: true }, attributes: ['id'] });
  assert.ok(actor, 'an active maintenance user fixture is required');

  const transaction = await sequelize.transaction();
  const originalTransaction = sequelize.transaction;
  sequelize.transaction = async () => transaction;
  try {
    const marker = randomUUID();
    const asset = await Asset.create({
      name: `QA rollback asset ${marker}`,
      assetCode: `QA-TX-ASSET-${marker}`,
      digitalId: `QA-TX-${marker}`,
      category: 'QA Test Fixture',
      status: 'available',
      createdBy: actor.id,
    }, { transaction });
    await run({ asset, actor, transaction, marker });
    assert.equal(transaction.finished, 'rollback');
  } finally {
    sequelize.transaction = originalTransaction;
    if (!transaction.finished) await transaction.rollback();
  }
};

test('work-order creation rolls back its work order and history after a mid-flow audit failure', { skip: !enabled }, async () => {
  const originalAuditCreate = AuditLog.create;
  await withRollbackFixture(async ({ asset, actor, transaction, marker }) => {
    const maintenance = await Maintenance.create({
      assetId: asset.id,
      requestedBy: actor.id,
      title: `QA rollback work order ${marker}`,
      description: 'transaction rollback integration fixture',
      priority: 'medium',
      status: 'pending',
    }, { transaction });
    const workOrderNumber = `QA-TX-WO-${marker}`;
    AuditLog.create = async () => { throw new Error('Injected work-order audit failure'); };
    const result = await invoke(createMaintenanceWorkOrder, {
      body: { assetId: asset.id, maintenanceId: maintenance.id, workOrderNumber, priority: 'medium' },
      user: { id: actor.id, role: 'maintenance' },
    });
    assert.match(result.error?.message || '', /Injected work-order audit failure/);
    assert.equal(await Maintenance.findByPk(maintenance.id), null);
    assert.equal(await MaintenanceWorkOrder.findOne({ where: { workOrderNumber } }), null);
    assert.equal(await MaintenanceHistory.count({ where: { maintenanceId: maintenance.id, actionType: 'work_order_created' } }), 0);
  }).finally(() => { AuditLog.create = originalAuditCreate; });
});

test('repair creation rolls back the repair after a mid-flow history failure', { skip: !enabled }, async () => {
  const originalHistoryCreate = MaintenanceHistory.create;
  await withRollbackFixture(async ({ asset, actor, transaction, marker }) => {
    const maintenance = await Maintenance.create({
      assetId: asset.id,
      requestedBy: actor.id,
      title: `QA rollback repair ${marker}`,
      description: 'transaction rollback integration fixture',
      priority: 'medium',
      status: 'pending',
    }, { transaction });
    const workOrder = await MaintenanceWorkOrder.create({
      maintenanceId: maintenance.id,
      assetId: asset.id,
      workOrderNumber: `QA-TX-REP-${marker}`,
      priority: 'medium',
      status: 'open',
    }, { transaction });
    MaintenanceHistory.create = async () => { throw new Error('Injected repair history failure'); };
    const result = await invoke(createRepair, {
      body: { asset_id: asset.id, work_order_id: workOrder.id, problem: 'QA rollback repair', priority: 'medium', status: 'open' },
      user: { id: actor.id, role: 'maintenance', collegeId: null },
    });
    assert.match(result.error?.message || '', /Injected repair history failure/);
    assert.equal(await MaintenanceRepair.count({ where: { workOrderId: workOrder.id } }), 0);
    assert.equal(await MaintenanceWorkOrder.findByPk(workOrder.id), null);
    assert.equal(await Maintenance.findByPk(maintenance.id), null);
  }).finally(() => { MaintenanceHistory.create = originalHistoryCreate; });
});

test('QC rejection rolls back review, maintenance, asset, and history updates after a mid-flow audit failure', { skip: !enabled }, async () => {
  const originalAuditCreate = AuditLog.create;
  const rejectHandler = maintenanceRoutes.stack
    .find((layer) => layer.route?.path === '/quality-control/:id/reject')
    .route.stack.at(-1).handle;
  await withRollbackFixture(async ({ asset, actor, transaction, marker }) => {
    const maintenance = await Maintenance.create({
      assetId: asset.id,
      requestedBy: actor.id,
      assignedTo: actor.id,
      title: `QA rollback QC ${marker}`,
      description: 'transaction rollback integration fixture',
      priority: 'medium',
      status: 'testing',
    }, { transaction });
    const review = await MaintenanceQualityControl.create({
      maintenanceId: maintenance.id,
      assetId: asset.id,
      technicianId: actor.id,
      testerId: actor.id,
      status: 'in-review',
      decision: 'pending',
    }, { transaction });
    AuditLog.create = async () => { throw new Error('Injected QC audit failure'); };
    const result = await invoke(rejectHandler, {
      params: { id: String(review.id) },
      body: {
        rejectionReason: 'Injected rollback check',
        failedRequirement: 'Safety',
        correctiveAction: 'Repair before service',
        checklist: [{ requirement: 'Safety', result: 'pass' }],
      },
      user: { id: actor.id, role: 'quality_control_reviewer' },
    });
    assert.match(result.error?.message || '', /Injected QC audit failure/);
    assert.equal(await MaintenanceQualityControl.findByPk(review.id), null);
    assert.equal(await Maintenance.findByPk(maintenance.id), null);
    assert.equal(await Asset.findByPk(asset.id), null);
    assert.equal(await MaintenanceHistory.count({ where: { maintenanceId: maintenance.id, actionType: 'qc_failed' } }), 0);
  }).finally(() => { AuditLog.create = originalAuditCreate; });
});
