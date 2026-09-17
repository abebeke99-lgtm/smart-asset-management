const express = require('express');
const { Op } = require('sequelize');
const { Notification, NotificationDelivery, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { createBulkNotification, deliver, normalizeChannels } = require('../services/notificationService');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const serialize = (row) => ({ ...row.toJSON(), is_read: Boolean(row.read), read_at: row.readAt || row.read_at || null, created_at: row.createdAt, updated_at: row.updatedAt });
const sendError = (res, next, error) => { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message, error: 'VALIDATION_ERROR' }); return next(error); };

const applyDateFilter = (where, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return;
  where.createdAt = {
    ...(dateFrom ? { [Op.gte]: new Date(dateFrom) } : {}),
    ...(dateTo ? { [Op.lte]: new Date(dateTo) } : {})
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
  } catch (error) { next(error); }
});

router.post('/notifications/bulk', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await createBulkNotification(req.body, req.user.id);
    return res.status(201).json({ success: true, data: { ...result, notifications: result.notifications.map(serialize) } });
  } catch (error) { return sendError(res, next, error); }
});

router.post('/notifications', ...requireAdmin, async (req, res, next) => {
  try {
    const payload = { ...req.body, recipientType: req.body.recipientType || 'users', userIds: req.body.userIds || [req.body.userId || req.body.recipient_id] };
    const result = await createBulkNotification(payload, req.user.id);
    return res.status(201).json({ success: true, data: serialize(result.notifications[0]), notification: serialize(result.notifications[0]), delivery: result });
  } catch (error) { return sendError(res, next, error); }
});

router.get('/notifications/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id, { include: [{ model: NotificationDelivery, include: [{ model: User, as: 'DeliveryRecipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }] }, { model: User, as: 'Recipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }] });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    return res.json({ success: true, data: serialize(notification), deliveries: notification.NotificationDeliveries || [] });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/read', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: true, readAt: new Date() });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_MARKED_READ', entity: `notification:${notification.id}`, details: JSON.stringify({ read: true }) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/unread', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
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

router.put('/notifications/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (!['draft', 'scheduled'].includes(notification.status)) return res.status(409).json({ success: false, message: 'Sent notification content cannot be edited' });
    await notification.update({ title: String(req.body.title || notification.title).trim(), message: String(req.body.message || notification.message), priority: req.body.priority || notification.priority, type: req.body.type || notification.type, channel: normalizeChannels(req.body.channels || req.body.channel).join(',') });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_UPDATED', entity: `notification:${notification.id}`, details: JSON.stringify({ status: notification.status }) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.post('/notifications/:id/retry', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    const recipient = await User.findByPk(notification.recipientId || notification.userId, { attributes: { exclude: ['password'] } });
    if (!recipient) return res.status(404).json({ success: false, message: 'Notification recipient not found' });
    const failed = await NotificationDelivery.findAll({ where: { notificationId: notification.id, status: 'failed' } });
    const result = await deliver(notification, recipient, failed.map((delivery) => delivery.channel));
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_RETRIED', entity: `notification:${notification.id}`, details: JSON.stringify({ channels: failed.map((delivery) => delivery.channel) }) });
    return res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

router.post('/notifications/:id/archive', ...requireAdmin, async (req, res, next) => {
  try {
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ archivedAt: new Date(), archivedBy: req.user.id, status: 'archived' });
    await AuditLog.create({ userId: req.user.id, action: 'NOTIFICATION_ARCHIVED', entity: `notification:${notification.id}`, details: JSON.stringify({}) });
    return res.json({ success: true, data: serialize(notification) });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/archive', ...requireAdmin, async (req, res, next) => {
  return router.stack.find((layer) => layer.route && layer.route.path === '/notifications/:id/archive' && layer.route.methods.post)?.route?.handler
    ? router.stack.find((layer) => layer.route && layer.route.path === '/notifications/:id/archive' && layer.route.methods.post).route.stack[0].handle(req, res, next)
    : res.status(405).json({ success: false, message: 'Archive action is not available' });
});

module.exports = router;
