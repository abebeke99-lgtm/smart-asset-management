const test = require('node:test');
const assert = require('node:assert/strict');

const { Asset, Inventory, Notification, User } = require('../models');
const { getAlertSeverity, reconcileInventoryStockAlert } = require('../services/inventoryStockAlertService');
const notificationService = require('../services/notificationService');

test('quantity alerts use the system threshold for zero item thresholds and exclude serialized or unusable assets', () => {
  assert.equal(getAlertSeverity({ availableQuantity: 5, minimumQuantity: 0, Asset: { collegeId: 4, status: 'available' } }), 'LOW_STOCK');
  assert.equal(getAlertSeverity({ availableQuantity: 0, minimumQuantity: 2, Asset: { collegeId: 4, status: 'available' } }), 'OUT_OF_STOCK');
  assert.equal(getAlertSeverity({ availableQuantity: 2, minimumQuantity: 5, Asset: { collegeId: 4, status: 'available', serialNumber: 'SER-1' } }), null);
  assert.equal(getAlertSeverity({ availableQuantity: 2, minimumQuantity: 5, Asset: { collegeId: 4, status: 'under_maintenance' } }), null);
  assert.equal(getAlertSeverity({ availableQuantity: 2, minimumQuantity: 5, Asset: { collegeId: 4, status: 'available', condition: 'damaged' } }), null);
});

test('stock alert notifications deduplicate state updates, reopen transitions, and resolve when replenished', async () => {
  const originals = {
    inventory: Inventory.findByPk,
    notifications: Notification.findAll,
    users: User.findAll,
    createEventNotification: notificationService.createEventNotification,
  };
  const inventory = {
    id: 8, assetId: 81, availableQuantity: 1, minimumQuantity: 4,
    Asset: { id: 81, collegeId: 4, departmentId: 6, name: 'Gloves', assetCode: 'G-81', status: 'available', condition: 'Good' },
  };
  const notifications = [];
  let createCount = 0;
  Inventory.findByPk = async () => inventory;
  Notification.findAll = async () => notifications;
  notificationService.createEventNotification = async (payload) => {
    if (notifications.some((notification) => notification.eventKey === payload.eventKey && notification.userId === 21)) return { skipped: true };
    createCount += 1;
    const notification = { id: createCount, ...payload, userId: 21, recipientId: 21, async update(nextValues) { Object.assign(this, nextValues); } };
    notifications.push(notification);
    return { notifications: [notification] };
  };
  User.findAll = async (query) => {
    assert.equal(query.where.collegeId, 4);
    assert.equal(query.where.active, true);
    assert.deepEqual(query.where.role, ['store_manager', 'admin']);
    return [{ id: 21, role: 'store_manager' }];
  };
  try {
    await reconcileInventoryStockAlert(8);
    assert.equal(createCount, 1);
    assert.equal(notifications[0].metadata.alertState, 'active');
    assert.equal(notifications[0].metadata.severity, 'LOW_STOCK');
    assert.equal(notifications[0].eventKey, 'inventory-stock-alert:8:21:1');

    notifications[0].read = true;
    await reconcileInventoryStockAlert(8);
    assert.equal(createCount, 1);
    assert.equal(notifications[0].read, true);

    inventory.availableQuantity = 0;
    await reconcileInventoryStockAlert(8);
    assert.equal(createCount, 2);
    const outOfStockNotification = notifications.find((notification) => notification.metadata.severity === 'OUT_OF_STOCK');
    assert.equal(outOfStockNotification.title, 'Inventory out of stock');

    inventory.availableQuantity = 6;
    await reconcileInventoryStockAlert(8);
    assert.ok(notifications.every((notification) => notification.metadata.alertState === 'resolved'));

    inventory.availableQuantity = 2;
    await reconcileInventoryStockAlert(8);
    assert.equal(createCount, 3);
    assert.equal(notifications.at(-1).metadata.alertState, 'active');
  } finally {
    Inventory.findByPk = originals.inventory;
    Notification.findAll = originals.notifications;
    User.findAll = originals.users;
    notificationService.createEventNotification = originals.createEventNotification;
  }
});
