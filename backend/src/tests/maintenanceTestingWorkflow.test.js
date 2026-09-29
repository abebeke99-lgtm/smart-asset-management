const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Maintenance, MaintenanceTest, MaintenanceQualityControl, MaintenanceHistory, Asset, User, AuditLog } = require('../models');
const notificationService = require('../services/notificationService');
const { sendMaintenanceTestToQuality } = require('../controllers/maintenanceTestingController');

test('sending a passed test to QC persists a linked review and notifies reviewers', async () => {
  const originals = {
    transaction: sequelize.transaction,
    testFindByPk: MaintenanceTest.findByPk,
    maintenanceFindByPk: Maintenance.findByPk,
    reviewFindOne: MaintenanceQualityControl.findOne,
    reviewCreate: MaintenanceQualityControl.create,
    assetFindByPk: Asset.findByPk,
    userFindAll: User.findAll,
    historyCreate: MaintenanceHistory.create,
    auditCreate: AuditLog.create,
    notify: notificationService.createEventNotification,
  };
  let reviewPayload;
  let noticePayload;
  const transaction = { LOCK: { UPDATE: 'UPDATE' }, commit: async () => {}, rollback: async () => {} };
  const testRecord = {
    id: 5,
    maintenanceId: 12,
    workOrderId: 8,
    assetId: 39,
    testerId: 6,
    status: 'passed',
    overallResult: 'Passed',
    qualityStatus: 'not-reviewed',
    actualResult: 'All checks passed',
    notes: 'QA test notes',
    async update(values) { Object.assign(this, values); },
  };

  sequelize.transaction = async () => transaction;
  MaintenanceTest.findByPk = async () => testRecord;
  Maintenance.findByPk = async () => ({ id: 12, assignedTo: 11, requestedBy: 6 });
  MaintenanceQualityControl.findOne = async () => null;
  MaintenanceQualityControl.create = async (payload) => { reviewPayload = payload; return { id: 19, ...payload }; };
  Asset.findByPk = async () => ({ async update() {} });
  User.findAll = async () => [{ id: 6 }, { id: 11 }, { id: 20 }];
  MaintenanceHistory.create = async () => {};
  AuditLog.create = async () => {};
  notificationService.createEventNotification = async (payload) => { noticePayload = payload; };

  try {
    let statusCode;
    let response;
    await sendMaintenanceTestToQuality({ params: { id: 5 }, user: { id: 6, role: 'maintenance' } }, {
      status(code) { statusCode = code; return this; },
      json(payload) { response = payload; return this; },
    }, (error) => { throw error; });

    assert.equal(response.success, true);
    assert.equal(statusCode || 200, 200);
    assert.equal(testRecord.qualityStatus, 'pending-qc');
    assert.equal(reviewPayload.testId, 5);
    assert.equal(reviewPayload.maintenanceId, 12);
    assert.equal(reviewPayload.workOrderId, 8);
    assert.equal(reviewPayload.assetId, 39);
    assert.equal(response.qualityControl.id, 19);
    assert.equal(noticePayload.event, 'maintenance_test_sent_to_qc');
    assert.deepEqual(noticePayload.userIds.sort((left, right) => left - right), [6, 11, 20]);
  } finally {
    sequelize.transaction = originals.transaction;
    MaintenanceTest.findByPk = originals.testFindByPk;
    Maintenance.findByPk = originals.maintenanceFindByPk;
    MaintenanceQualityControl.findOne = originals.reviewFindOne;
    MaintenanceQualityControl.create = originals.reviewCreate;
    Asset.findByPk = originals.assetFindByPk;
    User.findAll = originals.userFindAll;
    MaintenanceHistory.create = originals.historyCreate;
    AuditLog.create = originals.auditCreate;
    notificationService.createEventNotification = originals.notify;
  }
});