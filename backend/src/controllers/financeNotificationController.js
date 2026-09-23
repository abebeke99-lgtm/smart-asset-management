const { Op } = require('sequelize');
const { Invoice, Notification } = require('../models');
const { createFinanceNotification } = require('../services/notificationService');

const normalizePriority = (value) => {
  const priority = String(value || '').toLowerCase();
  if (priority === 'urgent') return 'critical';
  if (priority === 'medium') return 'normal';
  return priority || 'normal';
};

const serialize = (notification) => {
  const value = notification.toJSON ? notification.toJSON() : notification;
  return {
    ...value,
    priority: normalizePriority(value.priority),
    is_read: Boolean(value.read),
    created_at: value.createdAt || null,
    read_at: value.readAt || null,
  };
};

const listFinanceNotifications = async (req, res, next) => {
  try {
    const overdueInvoices = await Invoice.findAll({
      where: {
        dueDate: { [Op.lt]: new Date() },
        status: { [Op.ne]: 'Cancelled' },
        paidAmount: { [Op.lt]: Invoice.sequelize.col('total_amount') },
      },
      attributes: ['id', 'invoiceNumber', 'supplierName'],
    });
    await Promise.all(overdueInvoices.map((invoice) => createFinanceNotification({
      event: 'finance_invoice_overdue',
      eventKey: `finance_invoice_overdue:${invoice.id}`,
      entityId: invoice.id,
      type: 'financial',
      title: 'Overdue invoice',
      message: `Invoice ${invoice.invoiceNumber} from ${invoice.supplierName} is overdue and not fully paid.`,
    })));

    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 100));
    const where = { userId: req.user.id };
    const status = String(req.query.status || '').toLowerCase();
    const type = String(req.query.type || '').trim();
    const priority = String(req.query.priority || '').toLowerCase();

    if (status === 'read') where.read = true;
    if (status === 'unread') where.read = false;
    if (type) where.type = { [Op.like]: `%${type}%` };
    if (priority) where.priority = priority === 'critical' ? { [Op.in]: ['critical', 'urgent'] } : priority === 'normal' ? { [Op.in]: ['normal', 'medium'] } : priority;

    const [notifications, total, unread, highPriority, critical] = await Promise.all([
      Notification.findAll({ where, order: [['createdAt', 'DESC']], limit }),
      Notification.count({ where }),
      Notification.count({ where: { userId: req.user.id, read: false } }),
      Notification.count({ where: { userId: req.user.id, priority: { [Op.in]: ['high', 'urgent', 'critical'] } } }),
      Notification.count({ where: { userId: req.user.id, priority: { [Op.in]: ['urgent', 'critical'] } } }),
    ]);

    return res.json({
      success: true,
      notifications: notifications.map(serialize),
      summary: { total, unread, read: total - unread, highPriority, critical },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listFinanceNotifications };