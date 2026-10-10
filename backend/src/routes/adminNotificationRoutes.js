const express = require('express');
const { Op } = require('sequelize');
const { Notification, NotificationDelivery, User, AuditLog, sequelize } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { createBulkNotification, deliver, normalizeChannels } = require('../services/notificationService');
const { createAuditLog } = require('../services/auditLogService');
const { ROLE_NAMES } = require('../constants/rolePermissions');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const serialize = (row) => ({ ...row.toJSON(), is_read: Boolean(row.read), read_at: row.readAt || row.read_at || null, created_at: row.createdAt, updated_at: row.updatedAt });
const sendError = (res, next, error) => { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message, error: 'VALIDATION_ERROR' }); return next(error); };
const parseNotificationId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const applyDateFilter = (where, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return;
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    throw Object.assign(new Error('Notification date filter is invalid'), { statusCode: 400 });
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(String(dateTo))) to.setUTCHours(23, 59, 59, 999);
  if (from && to && from > to) {
    throw Object.assign(new Error('Date from must be before date to'), { statusCode: 400 });
  }
  where.createdAt = {
    ...(from ? { [Op.gte]: from } : {}),
    ...(to ? { [Op.lte]: to } : {})
  };
};

const buildWhere = (req) => {
  const where = {};
  const search = String(req.query.search || req.query.q || '').trim();
  const role = String(req.query.role || req.query.module || '').trim();
  const type = String(req.query.type || '').trim();
  const priority = String(req.query.priority || '').trim();
  const status = String(req.query.status || '').trim();
  const readValue = String(req.query.read || '').trim().toLowerCase();
  const dateFrom = req.query.dateFrom || req.query.from || '';
  const dateTo = req.query.dateTo || req.query.to || '';

  if (search.length > 200 || role.length > 120 || type.length > 100 || priority.length > 30 || status.length > 30) {
    throw Object.assign(new Error('Notification filter value is too long'), { statusCode: 400 });
  }
  if (readValue && !['read', 'unread'].includes(readValue)) {
    throw Object.assign(new Error('Read filter must be read or unread'), { statusCode: 400 });
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.like]: `%${search}%` } },
      { message: { [Op.like]: `%${search}%` } },
      { type: { [Op.like]: `%${search}%` } },
      { '$Recipient.fullName$': { [Op.like]: `%${search}%` } },
      { '$Recipient.username$': { [Op.like]: `%${search}%` } },
      { '$Recipient.email$': { [Op.like]: `%${search}%` } },
    ];
  }

  if (role) where['$Recipient.role$'] = String(role).trim();
  if (type) where.type = String(type).toLowerCase();
  if (priority) where.priority = String(priority).toLowerCase();
  if (status) where.status = String(status).toLowerCase();
  if (readValue === 'read') where.read = true;
  if (readValue === 'unread') where.read = false;
  applyDateFilter(where, dateFrom, dateTo);

  return where;
};

router.get('/notifications/recipients', ...requireAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    if (search.length > 200) return res.status(400).json({ success: false, message: 'Recipient search is too long' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const where = { active: true };
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id', 'fullName', 'username', 'email', 'role'],
      order: [['fullName', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({
      success: true,
      data: rows,
      roles: ROLE_NAMES,
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) { return sendError(res, next, error); }
});

router.get('/notifications', ...requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = buildWhere(req);
    const include = [{ model: User, as: 'Recipient', attributes: ['id', 'fullName', 'username', 'email', 'role'], required: false }];

    const { count, rows } = await Notification.findAndCountAll({
      where,
      include,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    const [unread, read, highPriority, today] = await Promise.all([
      Notification.count({ where: { ...where, read: false }, include }),
      Notification.count({ where: { ...where, read: true }, include }),
      Notification.count({ where: { ...where, priority: { [Op.in]: ['high', 'urgent'] } }, include }),
      Notification.count({ where: { ...where, createdAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) } }, include }),
    ]);

    return res.json({
      success: true,
      data: rows.map(serialize),
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) },
      summary: { total: count, unread, read, highPriority, today },
    });
  } catch (error) { return sendError(res, next, error); }
});

router.post('/notifications/bulk', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await createBulkNotification(req.body, req.user.id, req.user.role);
    return res.status(201).json({ success: true, data: { ...result, notifications: result.notifications.map(serialize) } });
  } catch (error) { return sendError(res, next, error); }
});

router.post('/notifications', ...requireAdmin, async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const payload = { ...body, recipientType: body.recipientType || 'users', userIds: body.userIds || [body.userId || body.recipient_id] };
    const result = await createBulkNotification(payload, req.user.id, req.user.role);
    return res.status(201).json({ success: true, data: serialize(result.notifications[0]), notification: serialize(result.notifications[0]), delivery: result });
  } catch (error) { return sendError(res, next, error); }
});

router.get('/notifications/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findByPk(id, { include: [{ model: NotificationDelivery, include: [{ model: User, as: 'DeliveryRecipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }] }, { model: User, as: 'Recipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }] });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.json({ success: true, data: serialize(notification), deliveries: notification.NotificationDeliveries || [] });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/read', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: true, readAt: new Date() });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_MARKED_READ', entity: `notification:${notification.id}`, details: JSON.stringify({ read: true }) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/unread', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: false, readAt: null });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_MARKED_UNREAD', entity: `notification:${notification.id}`, details: JSON.stringify({ read: false }) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.patch('/notifications/read-all', ...requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const [updatedCount] = await Notification.update({ read: true, readAt: now }, { where: { read: false } });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_MARK_ALL_READ', entity: 'notifications:all', details: JSON.stringify({ updatedCount }) });
    return res.json({ success: true, updatedCount, data: { updatedCount } });
  } catch (error) { next(error); }
});

router.delete('/notifications/all', ...requireAdmin, async (req, res, next) => {
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

router.put('/notifications/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (!['draft', 'scheduled'].includes(notification.status)) return res.status(409).json({ success: false, message: 'Sent notification content cannot be edited' });
    const updates = {};
    if (Object.hasOwn(body, 'title')) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title || title.length > 255) return res.status(400).json({ success: false, message: 'Title must contain 1 to 255 characters' });
      updates.title = title;
    }
    if (Object.hasOwn(body, 'message')) {
      if (typeof body.message !== 'string') return res.status(400).json({ success: false, message: 'Message must be text' });
      updates.message = body.message.trim();
    }
    if (Object.hasOwn(body, 'priority')) {
      const priority = String(body.priority).trim().toLowerCase();
      if (!['low', 'medium', 'normal', 'high', 'urgent', 'critical'].includes(priority)) {
        return res.status(400).json({ success: false, message: 'Priority is invalid' });
      }
      updates.priority = priority;
    }
    if (Object.hasOwn(body, 'type')) {
      const type = String(body.type).trim().toLowerCase();
      if (!['system', 'maintenance', 'assignment', 'transfer', 'missing_asset', 'warranty', 'rfid', 'security', 'alert', 'report', 'reminder', 'approval', 'inventory', 'procurement', 'financial', 'verification', 'disposal', 'custom'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Notification type is invalid' });
      }
      updates.type = type;
    }
    if (Object.hasOwn(body, 'channels') || Object.hasOwn(body, 'channel')) {
      const channels = normalizeChannels(body.channels || body.channel);
      if (!channels.length) return res.status(400).json({ success: false, message: 'At least one valid delivery channel is required' });
      updates.channel = channels.join(',');
    }
    if (Object.hasOwn(body, 'userIds') || Object.hasOwn(body, 'roles') || Object.hasOwn(body, 'recipientType') || Object.hasOwn(body, 'status')) {
      return res.status(400).json({ success: false, message: 'Recipients and status cannot be changed after a notification is created' });
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: 'At least one editable notification field is required' });

    const transaction = await sequelize.transaction();
    try {
      const oldValue = { title: notification.title, message: notification.message, type: notification.type, priority: notification.priority, channel: notification.channel };
      await notification.update(updates, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NOTIFICATION_UPDATED',
        entity: `notification:${notification.id}`,
        entityId: notification.id,
        oldValue,
        newValue: updates,
        details: { status: notification.status },
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.delete('/notifications/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const transaction = await sequelize.transaction();
    try {
      const notification = await Notification.findByPk(id, { transaction });
      if (!notification) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      const oldValue = { title: notification.title, type: notification.type, priority: notification.priority, scope: notification.scope, status: notification.status };
      const deliveryRecordsDeleted = await NotificationDelivery.destroy({ where: { notificationId: id }, transaction });
      await notification.destroy({ transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'NOTIFICATION_DELETED',
        entity: `notification:${id}`,
        entityId: id,
        oldValue,
        details: { deliveryRecordsDeleted },
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return res.json({ success: true, message: 'Notification deleted' });
  } catch (error) { next(error); }
});

router.post('/notifications/:id/retry', ...requireAdmin, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    const recipient = await User.findByPk(notification.recipientId || notification.userId, { attributes: { exclude: ['password'] } });
    if (!recipient) return res.status(404).json({ success: false, message: 'Notification recipient not found' });
    const failed = await NotificationDelivery.findAll({ where: { notificationId: notification.id, status: 'failed' } });
    const result = await deliver(notification, recipient, failed.map((delivery) => delivery.channel));
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_RETRIED', entity: `notification:${notification.id}`, details: JSON.stringify({ channels: failed.map((delivery) => delivery.channel) }) });
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

const archiveNotification = async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findByPk(id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ archivedAt: new Date(), archivedBy: req.user.id, status: 'archived' });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_ARCHIVED', entity: `notification:${notification.id}`, details: JSON.stringify({}) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { return next(error); }
};

router.post('/notifications/:id/archive', ...requireAdmin, archiveNotification);
router.patch('/notifications/:id/archive', ...requireAdmin, archiveNotification);

module.exports = router;
