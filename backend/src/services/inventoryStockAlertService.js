const { DEFAULT_REORDER_LEVEL, effectiveReorderLevel } = require('../utils/inventoryStock');

const ineligibleStatuses = new Set(['disposed', 'deleted', 'archived', 'missing', 'lost', 'retired', 'inactive', 'damaged', 'quarantined', 'expired', 'under maintenance', 'maintenance']);
const ineligibleConditions = new Set(['damaged', 'broken', 'unusable', 'heavily damaged', 'non-functional', 'quarantined']);

const getAlertSeverity = (inventory) => {
  const asset = inventory.Asset;
  if (!asset || !asset.collegeId || String(asset.serialNumber || '').trim()) return null;
  if (ineligibleStatuses.has(String(asset.status || '').toLowerCase().replace(/[-_]+/g, ' '))) return null;
  if (ineligibleConditions.has(String(asset.condition || '').toLowerCase())) return null;
  if (asset.expiryDate && new Date(asset.expiryDate).getTime() < new Date().setHours(0, 0, 0, 0)) return null;

  const available = Number(inventory.availableQuantity);
  if (!Number.isFinite(available)) return null;
  if (available <= 0) return 'OUT_OF_STOCK';
  return available <= effectiveReorderLevel(inventory) ? 'LOW_STOCK' : null;
};

const notificationMetadata = (notification) => {
  const value = notification.metadata;
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return {};
};

const reconcileInventoryStockAlert = async (inventoryId) => {
  const { Asset, Inventory, Notification, User } = require('../models');
  const inventory = await Inventory.findByPk(inventoryId, {
    include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'collegeId', 'departmentId', 'serialNumber', 'status', 'condition', 'expiryDate'] }],
  });
  if (!inventory?.Asset?.collegeId) return;

  const collegeId = Number(inventory.Asset.collegeId);
  const severity = getAlertSeverity(inventory);
  const existing = await Notification.findAll({
    where: { collegeId, entityType: 'inventory_stock_alert', entityId: inventory.id },
    order: [['createdAt', 'DESC']],
  });
  if (!severity) {
    await Promise.all(existing.filter((notification) => notificationMetadata(notification).alertState === 'active').map((notification) => (
      notification.update({
        metadata: { ...notificationMetadata(notification), alertState: 'resolved', resolvedAt: new Date().toISOString() },
      })
    )));
    return;
  }

  const { createEventNotification } = require('./notificationService');
  const recipients = await User.findAll({
    where: { collegeId, role: ['store_manager', 'admin'], active: true },
    attributes: ['id', 'role'],
  });
  const available = Number(inventory.availableQuantity);
  const reorderLevel = effectiveReorderLevel(inventory);
  const title = severity === 'OUT_OF_STOCK' ? 'Inventory out of stock' : 'Low stock alert';
  const message = `${inventory.Asset.name || inventory.Asset.assetCode || 'Inventory item'} has ${available} available; reorder level is ${reorderLevel}.`;
  const now = new Date();

  for (const recipient of recipients) {
    const recipientNotifications = existing.filter((notification) => Number(notification.userId || notification.recipientId) === Number(recipient.id));
    const current = recipientNotifications.find((notification) => notificationMetadata(notification).alertState === 'active')
      || recipientNotifications.sort((first, second) => new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt))[0];
    const metadata = notificationMetadata(current || {});
    const reopened = metadata.alertState !== 'active';
    const changedSeverity = metadata.severity !== severity;
    const values = {
      title,
      message,
      type: 'inventory',
      category: 'low_stock',
      scope: 'USER',
      role: recipient.role,
      collegeId,
      departmentId: inventory.Asset.departmentId || null,
      assetId: inventory.assetId,
      eventKey: `inventory-stock-alert:${inventory.id}:${recipient.id}`,
      entityType: 'inventory_stock_alert',
      entityId: inventory.id,
      actionUrl: '/store/low-stock',
      metadata: { alertState: 'active', severity, inventoryId: inventory.id, assetId: inventory.assetId, availableQuantity: available, reorderLevel, openedAt: reopened ? now.toISOString() : metadata.openedAt || now.toISOString() },
      priority: severity === 'OUT_OF_STOCK' ? 'high' : 'medium',
      status: 'sent',
      read: reopened || changedSeverity ? false : Boolean(current?.read),
      readAt: reopened || changedSeverity ? null : current?.readAt || null,
      sentAt: now,
    };
    const eventKey = `${values.eventKey}:${recipientNotifications.length + 1}`;
    if (current && !reopened) {
      await current.update(values);
      if (changedSeverity) {
        await createEventNotification({
          event: 'inventory_stock_alert',
          eventKey,
          entityType: values.entityType,
          entityId: values.entityId,
          assetId: values.assetId,
          userIds: [recipient.id],
          recipientType: 'users',
          title,
          message,
          type: 'inventory',
          category: 'low_stock',
          scope: 'USER',
          actionUrl: values.actionUrl,
          metadata: values.metadata,
          priority: values.priority,
        });
      }
      await Promise.all(recipientNotifications.filter((notification) => notification.id !== current.id && notificationMetadata(notification).alertState === 'active').map((notification) => (
        notification.update({ metadata: { ...notificationMetadata(notification), alertState: 'resolved', resolvedAt: now.toISOString() } })
      )));
    } else {
      await createEventNotification({
        event: 'inventory_stock_alert',
        eventKey,
        entityType: values.entityType,
        entityId: values.entityId,
        assetId: values.assetId,
        userIds: [recipient.id],
        recipientType: 'users',
        title,
        message,
        type: 'inventory',
        category: 'low_stock',
        scope: 'USER',
        actionUrl: values.actionUrl,
        metadata: values.metadata,
        priority: values.priority,
      });
    }
  }

  if (!recipients.length) {
    await Promise.all(existing.filter((notification) => notificationMetadata(notification).alertState === 'active').map((notification) => (
      notification.update({ metadata: { ...notificationMetadata(notification), alertState: 'resolved', resolvedAt: now.toISOString() } })
    )));
  }
};

const reconcileInventoryStockAlertForAsset = async (assetId) => {
  const { Inventory } = require('../models');
  const inventory = await Inventory.findOne({ where: { assetId }, attributes: ['id'] });
  if (inventory) await reconcileInventoryStockAlert(inventory.id);
};

module.exports = { DEFAULT_REORDER_LEVEL, getAlertSeverity, reconcileInventoryStockAlert, reconcileInventoryStockAlertForAsset };
