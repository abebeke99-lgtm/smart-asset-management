const express = require('express');
const { Op } = require('sequelize');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Notification, User, Config } = require('../models');
const { buildNotificationVisibilityWhere, normalizeNotificationScope } = require('../services/notificationService');

const notificationAccess = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college', 'finance', 'maintenance', 'department_head', 'infrastructure', 'staff', 'student')];

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
      notifications: notifications.map(serialize),
      data: notifications.map(serialize),
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

router.get('/notifications/:id', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id: req.params.id }, buildNotificationVisibilityWhere(req.user || {})] },
      include: [{ model: User, as: 'Recipient', attributes: ['id', 'fullName', 'username', 'email', 'role'] }],
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
    res.json({ success: true, data: serialize(notification), notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/read', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id: req.params.id }, buildNotificationVisibilityWhere(req.user || {})] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: true, readAt: new Date() });
    const unreadCount = await Notification.count({ where: { [Op.and]: [buildNotificationVisibilityWhere(req.user || {}), { read: false }] } });
    res.json({ success: true, notification: serialize(notification), unreadCount });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/:id/unread', ...notificationAccess, async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id: req.params.id }, buildNotificationVisibilityWhere(req.user || {})] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    await notification.update({ read: false, readAt: null });
    const unreadCount = await Notification.count({ where: { [Op.and]: [buildNotificationVisibilityWhere(req.user || {}), { read: false }] } });
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
    const visibilityClause = buildNotificationVisibilityWhere(req.user || {});
    await Notification.update({ read: true, readAt: new Date() }, { where: { [Op.and]: [visibilityClause, { read: false }] } });
    const unreadCount = await Notification.count({ where: { [Op.and]: [visibilityClause, { read: false }] } });
    res.json({ success: true, unreadCount, updatedCount: unreadCount });
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
    const notification = await Notification.findOne({ where: { [Op.and]: [{ id: req.params.id }, buildNotificationVisibilityWhere(req.user || {})] } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.destroy();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/notifications/settings', ...notificationAccess, async (req, res, next) => {
  try {
    const settings = await getUserNotificationSettings(req.user.id);
    res.json({ success: true, settings, data: settings });
  } catch (error) {
    next(error);
  }
});

router.patch('/notifications/settings', ...notificationAccess, async (req, res, next) => {
  try {
    const previous = await getUserNotificationSettings(req.user.id);
    const next = { ...previous, ...req.body };
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
    const userId = req.body.userId || req.body.user_id;
    if (!userId) return res.status(400).json({ success: false, message: 'A recipient user is required' });
    const recipient = await User.findOne({ where: { id: userId, active: true } });
    if (!recipient) return res.status(404).json({ success: false, message: 'Recipient user not found or inactive' });
    if (!req.body.title || !String(req.body.title).trim()) return res.status(400).json({ success: false, message: 'Notification title is required' });

    const notification = await Notification.create({
      userId: recipient.id,
      recipientId: recipient.id,
      title: String(req.body.title).trim(),
      message: req.body.message || '',
      type: req.body.type || 'info',
      priority: req.body.priority || 'normal',
      scope: normalizeNotificationScope(req.body.scope || 'USER'),
      role: recipient.role || null,
      collegeId: recipient.collegeId || null,
      departmentId: recipient.departmentId || null,
      organizationId: recipient.organizationId || null,
      actionUrl: req.body.actionUrl || req.body.action_url || null,
      metadata: req.body.metadata || null,
      read: false,
    });

    res.status(201).json({ success: true, notification: serialize(notification) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
