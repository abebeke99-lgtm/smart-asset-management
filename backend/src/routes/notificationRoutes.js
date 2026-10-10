const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { requireAuth, requireRole, requireAnyPermission } = require('../middlewares/auth');
const { Notification, NotificationDelivery, User, Config, sequelize } = require('../models');
const { buildNotificationVisibilityWhere, normalizeNotificationScope } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');

const notificationAccess = [requireAuth, requireAnyPermission('notifications.view', 'notifications.manage')];
const notificationPreferenceAccess = [requireAuth];
const notificationId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const serialize = (notification, includePrivateFields = false) => {
  const payload = notification && notification.toJSON ? notification.toJSON() : (notification || {});
  if (!includePrivateFields) {
    delete payload.userId;
    delete payload.recipientId;
    delete payload.senderId;
    delete payload.collegeId;
    delete payload.departmentId;
    delete payload.organizationId;
    delete payload.metadata;
    delete payload.Recipient;
  }
  return {
    ...payload,
    id: payload.id,
    is_read: Boolean(payload.read ?? payload.is_read ?? false),
    read: Boolean(payload.read ?? payload.is_read ?? false),
    created_at: payload.createdAt || payload.created_at || null,
    read_at: payload.readAt || payload.read_at || null,
    updated_at: payload.updatedAt || payload.updated_at || null,
    action_url: payload.actionUrl || payload.action_url || null,
    scope: payload.scope || 'USER',
  };
};

const buildNotificationFilters = (req) => {
  const visibilityClause = buildNotificationVisibilityWhere(req.user || {});
  const filters = [visibilityClause];
  const search = String(req.query.search || req.query.q || '').trim();
  const type = String(req.query.type || '').trim();
  const category = String(req.query.category || '').trim();
  const priority = String(req.query.priority || '').trim();
  const status = String(req.query.status || '').trim();
  const scope = String(req.query.scope || '').trim();
  const readValue = String(req.query.read || '').trim().toLowerCase();
  const dateFrom = req.query.dateFrom || req.query.from || '';
  const dateTo = req.query.dateTo || req.query.to || '';

  if (search) {
    filters.push({
      [Op.or]: [
        { title: { [Op.like]: `%${search}%` } },
        { message: { [Op.like]: `%${search}%` } },
        { type: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } },
      ],
    });
  }

  if (type) filters.push({ type: { [Op.like]: `%${type}%` } });
  if (category) filters.push({ category: { [Op.like]: `%${category}%` } });
  if (priority) filters.push({ priority: { [Op.like]: `%${priority}%` } });
  if (status) filters.push({ status: { [Op.like]: `%${status}%` } });
  if (scope) filters.push({ scope: normalizeNotificationScope(scope) });
  if (readValue === 'read') filters.push({ read: true });
  if (readValue === 'unread') filters.push({ read: false });
  if (dateFrom) filters.push({ createdAt: { [Op.gte]: new Date(dateFrom) } });
  if (dateTo) {
    const endOfDay = new Date(dateTo);
    endOfDay.setHours(23, 59, 59, 999);
    filters.push({ createdAt: { [Op.lte]: endOfDay } });
  }

  return filters.length === 1 ? filters[0] : { [Op.and]: filters };
};

const getUserNotificationSettings = async (userId) => {
  const record = await Config.findByPk(`notification-settings:${userId}`);
  let preferences = {};
  if (record) {
    try {
      preferences = JSON.parse(record.value || '{}');
    } catch (error) {
      preferences = {};
    }
  }

  return {
    emailNotifications: preferences.emailNotifications ?? true,
    inAppNotifications: preferences.inAppNotifications ?? true,
    securityAlerts: preferences.securityAlerts ?? true,
    assetAlerts: preferences.assetAlerts ?? true,
    maintenanceAlerts: preferences.maintenanceAlerts ?? true,
    approvalAlerts: preferences.approvalAlerts ?? true,
    financeAlerts: preferences.financeAlerts ?? true,
    storeAlerts: preferences.storeAlerts ?? true,
    systemAlerts: preferences.systemAlerts ?? true,
    criticalSecurityNotifications: true,
  };
};

router.get('/notifications', ...notificationAccess, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const where = buildNotificationFilters(req);

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      }),
      Notification.count({ where: { [Op.and]: [where, { read: false }] } }),
      Notification.count({ where }),
    ]);

    res.json({
      success: true,
      notifications: notifications.map((notification) => serialize(notification, req.user.role === 'admin')),
      data: notifications.map((notification) => serialize(notification, req.user.role === 'admin')),
      unreadCount,
      total,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary: {
        total,
        unread: unreadCount,
        read: total - unreadCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/count', ...notificationAccess, async (req, res, next) => {
  try {
    const where = buildNotificationFilters(req);
    const total = await Notification.count({ where });
    res.json({ success: true, count: total, total });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/unread-count', ...notificationAccess, async (req, res, next) => {
  try {
    const where = buildNotificationFilters(req);
    const unreadCount = await Notification.count({ where: { [Op.and]: [where, { read: false }] } });
    res.json({ success: true, unreadCount, count: unreadCount });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/unread/count', ...notificationAccess, async (req, res, next) => {
  try {
    const where = buildNotificationFilters(req);
    const unreadCount = await Notification.count({ where: { [Op.and]: [where, { read: false }] } });
    res.json({ success: true, unreadCount, count: unreadCount });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/settings', ...notificationPreferenceAccess, async (req, res, next) => {
  try {
    const settings = await getUserNotificationSettings(req.user.id);
    res.json({ success: true, settings, data: settings });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/:id', ...notificationAccess, async (req, res, next) => {
  try {
    const id = notificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user || {})] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
    const payload = serialize(notification, req.user.role === 'admin');
    res.json({ success: true, data: payload, notification: payload });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/read', ...notificationAccess, async (req, res, next) => {
  try {
    const id = notificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user || {})] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: true, readAt: new Date() });
    const unreadCount = await Notification.count({ where: { [Op.and]: [buildNotificationVisibilityWhere(req.user || {}), { read: false }] } });
    res.json({ success: true, notification: serialize(notification, req.user.role === 'admin'), unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/unread', ...notificationAccess, async (req, res, next) => {
  try {
    const id = notificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user || {})] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: false, readAt: null });
    const unreadCount = await Notification.count({ where: { [Op.and]: [buildNotificationVisibilityWhere(req.user || {}), { read: false }] } });
    res.json({ success: true, notification: serialize(notification, req.user.role === 'admin'), unreadCount });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/:id/read', ...notificationAccess, async (req, res, next) => {
  req.method = 'PATCH';
  return router.handle(req, res, next);
});

router.patch('/notifications/read-all', ...notificationAccess, async (req, res, next) => {
  try {
    const visibilityClause = buildNotificationVisibilityWhere(req.user || {});
    const [updatedCount] = await Notification.update(
      { read: true, readAt: new Date() },
      { where: { [Op.and]: [visibilityClause, { read: false }] } },
    );
    const unreadCount = await Notification.count({ where: { [Op.and]: [visibilityClause, { read: false }] } });
    res.json({ success: true, unreadCount, updatedCount });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/read-all', ...notificationAccess, async (req, res, next) => {
  req.method = 'PATCH';
  return router.handle(req, res, next);
});

router.delete('/notifications/all', requireAuth, requireRole('admin'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const where = {
      [Op.or]: [
        { userId: req.user.id },
        { recipientId: req.user.id },
        { userId: null, recipientId: null },
      ],
    };
    const records = await Notification.findAll({ where, attributes: ['id'], transaction });
    const ids = records.map((notification) => notification.id);
    const deliveryRecordsDeleted = ids.length
      ? await NotificationDelivery.destroy({ where: { notificationId: { [Op.in]: ids } }, transaction })
      : 0;
    const deletedCount = ids.length
      ? await Notification.destroy({ where: { id: { [Op.in]: ids } }, transaction })
      : 0;
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'NOTIFICATIONS_BULK_DELETED',
      entity: 'notifications:all',
      details: { deletedCount, deliveryRecordsDeleted },
      transaction,
    });
    await transaction.commit();
    return res.json({ success: true, deletedCount });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return next(error);
  }
});

router.delete('/notifications/:id', requireAuth, requireAnyPermission('notifications.delete', 'notifications.manage'), async (req, res, next) => {
  try {
    const id = notificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const transaction = await sequelize.transaction();
    try {
      const notification = await Notification.findOne({
        where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user || {})] },
        transaction,
      });
      if (!notification) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
      }
      const oldValue = {
        title: notification.title,
        type: notification.type,
        scope: notification.scope,
        status: notification.status,
      };
      const deletedDeliveries = await NotificationDelivery.destroy({ where: { notificationId: id }, transaction });
      await notification.destroy({ transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NOTIFICATION_DELETED',
        entity: `notification:${id}`,
        entityId: id,
        oldValue,
        details: { deliveryRecordsDeleted: deletedDeliveries },
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/settings', ...notificationPreferenceAccess, async (req, res, next) => {
  try {
    const previous = await getUserNotificationSettings(req.user.id);
    const allowedSettings = [
      'emailNotifications',
      'inAppNotifications',
      'securityAlerts',
      'assetAlerts',
      'maintenanceAlerts',
      'approvalAlerts',
      'financeAlerts',
      'storeAlerts',
      'systemAlerts',
    ];
    const requestedSettings = req.body || {};
    const invalidKey = Object.keys(requestedSettings).find((key) => (
      !allowedSettings.includes(key) || typeof requestedSettings[key] !== 'boolean'
    ));
    if (invalidKey) {
      return res.status(400).json({ success: false, message: 'Notification settings must contain only supported boolean preferences' });
    }
    const next = { ...previous, ...requestedSettings, criticalSecurityNotifications: true };
    const key = `notification-settings:${req.user.id}`;
    const existing = await Config.findByPk(key);
    if (existing) {
      await existing.update({ value: JSON.stringify(next) });
    } else {
      await Config.create({ key, value: JSON.stringify(next) });
    }
    res.json({ success: true, settings: next, data: next });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const userId = Number(body.userId || body.user_id);
    if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ success: false, message: 'A valid recipient user is required' });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title || title.length > 255) return res.status(400).json({ success: false, message: 'Title must contain 1 to 255 characters' });
    if (body.message !== undefined && typeof body.message !== 'string') return res.status(400).json({ success: false, message: 'Message must be text' });
    if (body.metadata !== undefined && body.metadata !== null && (typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
      return res.status(400).json({ success: false, message: 'Metadata must be an object or null' });
    }
    const recipient = await User.findOne({ where: { id: userId, active: true } });
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient user not found or inactive' });
    const rawScope = String(body.scope || 'USER').trim().toUpperCase();
    if (!['GLOBAL', 'ORGANIZATION', 'COLLEGE', 'DEPARTMENT', 'ROLE', 'USER'].includes(rawScope)) {
      return res.status(400).json({ success: false, message: 'Notification scope is invalid' });
    }
    const notificationType = String(body.type || 'info').trim();
    if (!notificationType || notificationType.length > 100) return res.status(400).json({ success: false, message: 'Notification type is invalid' });
    const priority = String(body.priority || 'normal').trim().toLowerCase();
    if (!['low', 'normal', 'medium', 'high', 'urgent', 'critical'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Notification priority is invalid' });
    }
    const actionUrl = body.actionUrl || body.action_url || null;
    if (actionUrl !== null && (typeof actionUrl !== 'string' || actionUrl.length > 500)) {
      return res.status(400).json({ success: false, message: 'Notification action URL is invalid' });
    }

    const transaction = await sequelize.transaction();
    try {
      const notification = await Notification.create({
        userId: recipient.id,
        recipientId: recipient.id,
        title,
        message: (body.message || '').trim(),
        type: notificationType,
        priority,
        scope: normalizeNotificationScope(rawScope),
        role: recipient.role || null,
        collegeId: recipient.collegeId || null,
        departmentId: recipient.departmentId || null,
        organizationId: recipient.organizationId || null,
        actionUrl,
        metadata: body.metadata || null,
        read: false,
      }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'CREATE_NOTIFICATION',
        entity: `notification:${notification.id}`,
        entityId: notification.id,
        newValue: { title: notification.title, type: notification.type, priority: notification.priority },
        details: { recipientCount: 1, legacyAction: 'NOTIFICATION_CREATED' },
        transaction,
      });
      await transaction.commit();
      res.status(201).json({ success: true, notification: serialize(notification, true) });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
