const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Notification, User } = require('../models');

const notificationAccess = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college', 'finance', 'maintenance', 'student')];

const serialize = (notification) => {
  const payload = notification && notification.toJSON ? notification.toJSON() : (notification || {});
  return {
    ...payload,
    id: payload.id,
    is_read: Boolean(payload.read ?? payload.is_read ?? false),
    read: Boolean(payload.read ?? payload.is_read ?? false),
    created_at: payload.createdAt || payload.created_at || null,
    read_at: payload.readAt || payload.read_at || null,
    updated_at: payload.updatedAt || payload.updated_at || null,
  };
};

router.get('/notifications', ...notificationAccess, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * limit;
    const where = { userId: req.user.id };

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      }),
      Notification.count({ where: { ...where, read: false } }),
      Notification.count({ where }),
    ]);

    res.json({
      success: true,
      notifications: notifications.map(serialize),
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

router.get('/notifications/unread-count', ...notificationAccess, async (req, res, next) => {
  try {
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/read', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: true, readAt: new Date() });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, notification: serialize(notification), unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/unread', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: false, readAt: null });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, notification: serialize(notification), unreadCount });
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
    await Notification.update({ read: true, readAt: new Date() }, { where: { userId: req.user.id, read: false } });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/read-all', ...notificationAccess, async (req, res, next) => {
  req.method = 'PATCH';
  return router.handle(req, res, next);
});

router.delete('/notifications/:id', ...notificationAccess, async (req, res, next) => {
  try {
    const deleted = await Notification.destroy({ where: { id: req.params.id, userId: req.user.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/notifications', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const userId = req.body.userId || req.body.user_id;
    if (!userId) return res.status(400).json({ success: false, message: 'A recipient user is required' });
    const recipient = await User.findOne({ where: { id: userId, active: true } });
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient user not found or inactive' });
    if (!req.body.title || !String(req.body.title).trim()) return res.status(400).json({ success: false, message: 'Notification title is required' });

    const notification = await Notification.create({
      userId: recipient.id,
      title: String(req.body.title).trim(),
      message: req.body.message || '',
      type: req.body.type || 'info',
      priority: req.body.priority || 'normal',
      read: false,
    });

    res.status(201).json({ success: true, notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
