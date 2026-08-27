const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Notification, User } = require('../models');

const notificationAccess = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'department_head', 'finance', 'maintenance', 'student')];

const serialize = (notification) => ({
  ...notification.toJSON(),
  is_read: notification.read,
  created_at: notification.createdAt,
});

router.get('/notifications', ...notificationAccess, async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 200,
    });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, notifications: notifications.map(serialize), unreadCount });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/:id/read', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: true });
    res.json({ success: true, notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

router.put('/notifications/read-all', ...notificationAccess, async (req, res, next) => {
  try {
    await Notification.update({ read: true }, { where: { userId: req.user.id, read: false } });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, read: false } });
    res.json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
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
    });
    res.status(201).json({ success: true, notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
