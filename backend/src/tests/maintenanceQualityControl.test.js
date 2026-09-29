const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, MaintenanceQualityControl, MaintenanceTest, Maintenance, Asset, MaintenanceHistory, AuditLog } = require('../models');
const maintenanceRoutes = require('../routes/maintenanceRoutes');
const notificationService = require('../services/notificationService');
const { validateQcDecision, isTestEligibleForQualityControl, resolveQcStatusForDecision } = require('../utils/maintenanceQualityControl');

test('approved QC requires a passed technical test', () => {
  const testRecord = { maintenanceId: 10, assetId: 7, status: 'completed', overallResult: 'Passed' };
  assert.equal(isTestEligibleForQualityControl(testRecord), true);
  assert.equal(validateQcDecision('approved', { checklist: [{ requirement: 'Power works', result: 'pass' }] }, testRecord).message, '');
  assert.match(validateQcDecision('approved', { checklist: [{ requirement: 'Power works', result: 'fail' }] }, testRecord).message, /must pass/i);
});

test('rejected QC requires reason and corrective action', () => {
  const testRecord = { maintenanceId: 10, assetId: 7, status: 'completed', overallResult: 'Passed' };
  const invalid = validateQcDecision('rejected', { checklist: [{ requirement: 'Power works', result: 'pass' }] }, testRecord);
  assert.match(invalid.message, /Provide a rejection reason/i);

  const valid = validateQcDecision('rejected', {
    checklist: [{ requirement: 'Power works', result: 'pass' }],
    rejectionReason: 'Safety hazard',
    failedRequirement: 'Power switch',
    correctiveAction: 'Repair wiring',
  }, testRecord);
  assert.equal(valid.message, '');
});

test('QC review status follows its decision unless an explicit review status is supplied', () => {
  assert.equal(resolveQcStatusForDecision('approved'), 'approved');
  assert.equal(resolveQcStatusForDecision('rejected'), 'rejected');
  assert.equal(resolveQcStatusForDecision('approved', 'in-review'), 'in-review');
});

test('QC rejection atomically returns maintenance and asset to rework and records audit evidence', async () => {
  const route = maintenanceRoutes.stack.find((layer) => layer.route?.path === '/quality-control/:id/reject');
  const rejectHandler = route.route.stack[route.route.stack.length - 1].handle;
  const originals = {
    transaction: sequelize.transaction,
    reviewFindByPk: MaintenanceQualityControl.findByPk,
    testFindByPk: MaintenanceTest.findByPk,
    maintenanceFindByPk: Maintenance.findByPk,
    assetFindByPk: Asset.findByPk,
    historyCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
    notify: notificationService.createEventNotification,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  const review = {
    id: 31, maintenanceId: 14, assetId: 9, testId: 22, technicianId: 5, testerId: 6,
    status: 'in-review', decision: 'pending', readyForReturn: false,
    async update(values) { Object.assign(this, values); },
    toJSON() { return { ...this }; },
  };
  const testRecord = { id: 22, maintenanceId: 14, assetId: 9, status: 'completed', overallResult: 'Passed', async update(values) { Object.assign(this, values); } };
  const maintenance = { id: 14, assetId: 9, requestedBy: 7, status: 'testing', async update(values) { Object.assign(this, values); } };
  const asset = { id: 9, status: 'testing', async update(values) { Object.assign(this, values); } };
  let historyPayload;
  let auditPayload;
  let notificationPayload;
  sequelize.transaction = async () => transaction;
  MaintenanceQualityControl.findByPk = async () => review;
  MaintenanceTest.findByPk = async () => testRecord;
  Maintenance.findByPk = async () => maintenance;
  Asset.findByPk = async () => asset;
  MaintenanceHistory.create = async (payload) => { historyPayload = payload; };
  AuditLog.create = async (payload) => { auditPayload = payload; };
  notificationService.createEventNotification = async (payload) => { notificationPayload = payload; };

  try {
    let response;
    await rejectHandler({
      params: { id: '31' },
      body: { rejectionReason: 'Power instability', failedRequirement: 'Power-on test', correctiveAction: 'Repair the power supply', checklist: [{ requirement: 'Safety', result: 'pass' }] },
      user: { id: 8, role: 'quality_control_reviewer' },
    }, {
      status() { return this; },
      json(payload) { response = payload; return this; },
    }, (error) => { throw error; });

    assert.equal(response.success, true);
    assert.equal(review.decision, 'rejected');
    assert.equal(review.rejectionReason, 'Power instability');
    assert.equal(maintenance.status, 'in-progress');
    assert.equal(asset.status, 'under-maintenance');
    assert.equal(historyPayload.actionType, 'qc_failed');
    assert.equal(historyPayload.previousStatus, 'testing');
    assert.equal(historyPayload.newStatus, 'in-progress');
    assert.match(auditPayload.details, /Power instability/);
    assert.equal(notificationPayload.eventKey, 'maintenance_qc_decision:31:rejected');

    let duplicateStatus;
    await rejectHandler({ params: { id: '31' }, body: { rejectionReason: 'Again' }, user: { id: 8, role: 'quality_control_reviewer' } }, {
      status(code) { duplicateStatus = code; return this; },
      json() {},
    }, (error) => { throw error; });
    assert.equal(duplicateStatus, 409);
  } finally {
    sequelize.transaction = originals.transaction;
    MaintenanceQualityControl.findByPk = originals.reviewFindByPk;
    MaintenanceTest.findByPk = originals.testFindByPk;
    Maintenance.findByPk = originals.maintenanceFindByPk;
    Asset.findByPk = originals.assetFindByPk;
    MaintenanceHistory.create = originals.historyCreate;
    AuditLog.create = originals.auditCreate;
    notificationService.createEventNotification = originals.notify;
  }
});

test('approved QC return-to-service completes the request and restores the asset exactly once', async () => {
  const route = maintenanceRoutes.stack.find((layer) => layer.route?.path === '/quality-control/:id/return-to-service');
  const handler = route.route.stack[route.route.stack.length - 1].handle;
  const originals = {
    transaction: sequelize.transaction,
    reviewFindByPk: MaintenanceQualityControl.findByPk,
    maintenanceFindByPk: Maintenance.findByPk,
    assetFindByPk: Asset.findByPk,
    historyCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
    notify: notificationService.createEventNotification,
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, finished: undefined, async commit() { this.finished = 'commit'; }, async rollback() { this.finished = 'rollback'; } };
  const review = { id: 41, maintenanceId: 14, assetId: 9, technicianId: 5, decision: 'approved', readyForReturn: false, toJSON() { return { ...this }; }, async update(values) { Object.assign(this, values); } };
  const maintenance = { id: 14, assetId: 9, requestedBy: 7, assignedTo: 5, status: 'testing', async update(values) { Object.assign(this, values); } };
  const asset = { id: 9, status: 'quality-control', async update(values) { Object.assign(this, values); } };
  let auditPayload;
  let notificationPayload;
  let historyPayload;
  sequelize.transaction = async () => transaction;
  MaintenanceQualityControl.findByPk = async () => review;
  Maintenance.findByPk = async () => maintenance;
  Asset.findByPk = async () => asset;
  MaintenanceHistory.create = async (payload) => { historyPayload = payload; };
  AuditLog.create = async (payload) => { auditPayload = payload; };
  notificationService.createEventNotification = async (payload) => { notificationPayload = payload; };

  try {
    let response;
    await handler({ params: { id: '41' }, user: { id: 8, role: 'quality_control_reviewer' } }, {
      status() { return this; },
      json(payload) { response = payload; return this; },
    }, (error) => { throw error; });

    assert.equal(response.success, true);
    assert.equal(maintenance.status, 'completed');
    assert.equal(asset.status, 'available');
    assert.equal(review.readyForReturn, true);
    assert.equal(historyPayload.actionType, 'returned_to_service');
    assert.equal(auditPayload.action, 'MAINTENANCE_RETURNED_TO_SERVICE');
    assert.equal(notificationPayload.eventKey, 'maintenance_completed:14');
    assert.deepEqual(notificationPayload.userIds, [7, 5]);

    let duplicateStatus;
    await handler({ params: { id: '41' }, user: { id: 8, role: 'quality_control_reviewer' } }, {
      status(code) { duplicateStatus = code; return this; },
      json() {},
    }, (error) => { throw error; });
    assert.equal(duplicateStatus, 409);
  } finally {
    sequelize.transaction = originals.transaction;
    MaintenanceQualityControl.findByPk = originals.reviewFindByPk;
    Maintenance.findByPk = originals.maintenanceFindByPk;
    Asset.findByPk = originals.assetFindByPk;
    MaintenanceHistory.create = originals.historyCreate;
    AuditLog.create = originals.auditCreate;
    notificationService.createEventNotification = originals.notify;
  }
});
