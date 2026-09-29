const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Op } = require('sequelize');
const { sequelize, User, Notification, NotificationDelivery, AuditLog, Config } = require('../models');
const { createEventNotification, defaultEventRules } = require('../services/notificationService');

const enabled = process.env.MAINTENANCE_INTEGRATION_DB === '1';

test('all 12 persisted notification event types remain deduplicated after replay', { skip: !enabled }, async () => {
  assert.notEqual(process.env.NODE_ENV, 'production', 'notification integration test is disabled in production');
  await sequelize.authenticate();
  const recipient = await User.findOne({ where: { active: true, role: 'maintenance' }, attributes: ['id'] });
  assert.ok(recipient, 'an active maintenance user is required');

  const prefix = `qa-maintenance-notification:${randomUUID()}`;
  const eventKeys = Object.keys(defaultEventRules).map((event) => `${prefix}:${event}`);
  const originalConfigFindByPk = Config.findByPk;
  const originalAuditCreate = AuditLog.create;
  Config.findByPk = async (key) => key === 'settings:notifications'
    ? { value: JSON.stringify({ enabled: true, inAppEnabled: true, emailEnabled: false }) }
    : null;
  AuditLog.create = async () => {};

  const sendEvents = async () => {
    for (const [index, event] of Object.keys(defaultEventRules).entries()) {
      await createEventNotification({
        event,
        eventKey: eventKeys[index],
        entityId: index + 1,
        userIds: [recipient.id],
        senderId: null,
        type: 'maintenance',
        title: `QA notification ${event}`,
        message: `Persistence dedupe check for ${event}`,
      });
    }
  };

  try {
    await sendEvents();
    const initialRows = await Notification.findAll({ where: { eventKey: { [Op.in]: eventKeys } }, attributes: ['id', 'eventKey', 'userId'] });
    assert.equal(initialRows.length, 12);
    assert.ok(initialRows.every((row) => row.userId === recipient.id));

    await sendEvents();
    const replayRows = await Notification.findAll({ where: { eventKey: { [Op.in]: eventKeys } }, attributes: ['id', 'eventKey', 'userId'] });
    assert.equal(replayRows.length, 12);
    assert.equal(new Set(replayRows.map((row) => row.eventKey)).size, 12);
  } finally {
    Config.findByPk = originalConfigFindByPk;
    AuditLog.create = originalAuditCreate;
    const rows = await Notification.findAll({ where: { eventKey: { [Op.in]: eventKeys } }, attributes: ['id'] });
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      await NotificationDelivery.destroy({ where: { notificationId: { [Op.in]: ids } } });
      await Notification.destroy({ where: { id: { [Op.in]: ids } } });
    }
    await sequelize.close();
  }
});
