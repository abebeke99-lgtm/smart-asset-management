const { Op } = require('sequelize');
const { Notification, NotificationDelivery, sequelize } = require('../models');
const { createAuditLog } = require('../services/auditLogService');
const { buildNotificationVisibilityWhere } = require('../services/notificationService');

const notificationScope = (req) => buildNotificationVisibilityWhere(req.user || {});

const normalizeNotification = (notification) => {
  const value = notification.toJSON ? notification.toJSON() : notification;
  return {
    id: value.id,
    title: value.title,
    message: value.message,
    type: value.type,
    priority: value.priority,
    status: value.read ? 'read' : 'unread',
    isRead: Boolean(value.read),
    read: Boolean(value.read),
    scope: value.scope || 'USER',
    createdAt: value.createdAt || value.created_at || null,
    readAt: value.readAt || value.read_at || null,
  };
};

const getNotificationId = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    return null;
  }
  return id;
};

const findScopedNotification = (req, id) => Notification.findOne({
  where: { [Op.and]: [{ id }, notificationScope(req)] },
});

const listInfrastructureNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filters = [notificationScope(req)];
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const priority = String(req.query.priority || '').trim();

    if (search) filters.push({ [Op.or]: [
      { title: { [Op.like]: `%${search}%` } },
      { message: { [Op.like]: `%${search}%` } },
      { type: { [Op.like]: `%${search}%` } },
    ] });
    if (type) filters.push({ type: { [Op.like]: `%${type}%` } });
    if (priority) filters.push({ priority: { [Op.like]: `%${priority}%` } });
    if (status === 'read') filters.push({ read: true });
    if (status === 'unread') filters.push({ read: false });

    const where = { [Op.and]: filters };
    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    const summary = {
      total: count,
      unread: await Notification.count({ where: { [Op.and]: [notificationScope(req), { read: false }] } }),
      read: await Notification.count({ where: { [Op.and]: [notificationScope(req), { read: true }] } }),
      critical: await Notification.count({ where: { [Op.and]: [where, { priority: 'critical' }] } }),
      high: await Notification.count({ where: { [Op.and]: [where, { priority: 'high' }] } }),
    };

    return res.json({ success: true, data: rows.map(normalizeNotification), summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) {
    return next(error);
  }
};

const markInfrastructureNotificationRead = async (req, res, next) => {
  try {
    const id = getNotificationId(req, res);
    if (!id) return;
    const notification = await findScopedNotification(req, id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: true, readAt: new Date() });
    return res.json({ success: true, data: normalizeNotification(notification) });
  } catch (error) { return next(error); }
};

const markInfrastructureNotificationUnread = async (req, res, next) => {
  try {
    const id = getNotificationId(req, res);
    if (!id) return;
    const notification = await findScopedNotification(req, id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: false, readAt: null });
    return res.json({ success: true, data: normalizeNotification(notification) });
  } catch (error) { return next(error); }
};

const markAllInfrastructureNotificationsRead = async (req, res, next) => {
  try {
    const [updated] = await Notification.update(
      { read: true, readAt: new Date() },
      { where: { [Op.and]: [notificationScope(req), { read: false }] } },
    );
    return res.json({ success: true, updated });
  } catch (error) { return next(error); }
};

const deleteInfrastructureNotification = async (req, res, next) => {
  try {
    const id = getNotificationId(req, res);
    if (!id) return;
    const transaction = await sequelize.transaction();
    try {
      const notification = await Notification.findOne({
        where: { [Op.and]: [{ id }, notificationScope(req)] },
        transaction,
      });
      if (!notification) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
      }
      const oldValue = { title: notification.title, type: notification.type, scope: notification.scope };
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
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

module.exports = { listInfrastructureNotifications, markInfrastructureNotificationRead, markInfrastructureNotificationUnread, markAllInfrastructureNotificationsRead, deleteInfrastructureNotification };