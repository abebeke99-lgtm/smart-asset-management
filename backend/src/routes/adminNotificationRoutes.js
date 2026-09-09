const express = require('express');
const { Op } = require('sequelize');
const { Notification, NotificationDelivery, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { createBulkNotification, deliver, normalizeChannels } = require('../services/notificationService');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const serialize = (row) => ({ ...row.toJSON(), is_read: row.read, created_at: row.createdAt, updated_at: row.updatedAt });
const sendError = (res, next, error) => { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message, error: 'VALIDATION_ERROR' }); return next(error); };

router.get('/notifications', ...requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = {};
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { message: { [Op.like]: `%${search}%` } }];
    if (req.query.type) where.type = String(req.query.type).toLowerCase();
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (req.query.channel) where.channel = { [Op.like]: `%${String(req.query.channel).toLowerCase()}%` };
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (String(req.query.read || '').toLowerCase() === 'unread') where.read = false;
    if (String(req.query.read || '').toLowerCase() === 'read') where.read = true;
    if (req.query.from || req.query.to) where.createdAt = { ...(req.query.from ? { [Op.gte]: new Date(req.query.from) } : {}), ...(req.query.to ? { [Op.lte]: new Date(req.query.to) } : {}) };
    const { count, rows } = await Notification.findAndCountAll({ where, include: [{ model: User, as: 'Recipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }], order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    const [unread, read, sent, failed] = await Promise.all([
      Notification.count({ where: { ...where, read: false } }), Notification.count({ where: { ...where, read: true } }), Notification.count({ where: { ...where, status: { [Op.in]: ['sent', 'delivered'] } } }), Notification.count({ where: { ...where, status: 'failed' } }),
    ]);
    return res.json({ success: true, data: rows.map(serialize), pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) }, summary: { total: count, unread, read, sent, failed } });
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

module.exports = router;
