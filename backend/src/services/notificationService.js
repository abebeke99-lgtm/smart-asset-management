const { Op } = require('sequelize');
const { sequelize, Notification, NotificationDelivery, User, AuditLog } = require('../models');
const { sendNotificationEmail } = require('./emailService');
const { sendSMS } = require('./smsService');

const allowedTypes = new Set(['system', 'maintenance', 'assignment', 'transfer', 'missing_asset', 'warranty', 'rfid', 'security', 'alert', 'report', 'reminder', 'approval', 'inventory', 'procurement', 'financial', 'verification', 'disposal', 'custom']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const allowedChannels = new Set(['in_app', 'email', 'sms']);

const normalizeChannels = (channels) => {
  const values = Array.isArray(channels) ? channels : [channels || 'in_app'];
  return [...new Set(values.map((value) => String(value).toLowerCase()).flatMap((value) => value === 'multi_channel' ? ['in_app', 'email', 'sms'] : value === 'in-app' ? ['in_app'] : [value]).filter((value) => allowedChannels.has(value)))];
};

const resolveRecipients = async (payload) => {
  const type = String(payload.recipientType || payload.recipient_type || (payload.userId || payload.recipient_id ? 'users' : '')).toLowerCase();
  const where = { active: true };
  if (type === 'users' || type === 'user') where.id = { [Op.in]: (payload.userIds || payload.user_ids || [payload.userId || payload.recipient_id]).map(Number).filter(Number.isInteger) };
  else if (type === 'role') where.role = { [Op.in]: (payload.roles || []).map(String) };
  else if (type === 'college') {
    const collegeId = Number(payload.collegeId || payload.college_id);
    if (!Number.isInteger(collegeId) || collegeId < 1) throw Object.assign(new Error('A valid college is required'), { statusCode: 400 });
    where.collegeId = collegeId;
  } else if (type === 'department') {
    const departmentId = Number(payload.departmentId || payload.department_id);
    if (!Number.isInteger(departmentId) || departmentId < 1) throw Object.assign(new Error('A valid department is required'), { statusCode: 400 });
    where.departmentId = departmentId;
  }
  else if (type === 'all_users') delete where.active;
  else if (type === 'all_active_users') return User.findAll({ where, attributes: { exclude: ['password'] } });
  else return [];
  return User.findAll({ where, attributes: { exclude: ['password'] } });
};

const buildNotification = (payload, senderId, recipient, status) => ({
  title: String(payload.title || '').trim(),
  message: String(payload.message || '').trim(),
  type: allowedTypes.has(String(payload.type || '').toLowerCase()) ? String(payload.type).toLowerCase() : 'custom',
  priority: allowedPriorities.has(String(payload.priority || '').toLowerCase()) ? String(payload.priority).toLowerCase() : 'medium',
  channel: normalizeChannels(payload.channels || payload.channel).join(','),
  status,
  senderId,
  userId: recipient.id,
  recipientId: recipient.id,
  collegeId: recipient.collegeId || null,
  departmentId: recipient.departmentId || null,
  scheduledAt: payload.scheduledAt || payload.scheduled_at || null,
  expiresAt: payload.expiresAt || payload.expires_at || null,
  sentAt: status === 'sent' ? new Date() : null,
});

const deliver = async (notification, recipient, channels, transaction) => {
  const results = [];
  for (const channel of channels) {
    const delivery = await NotificationDelivery.create({ notificationId: notification.id, recipientId: recipient.id, channel, status: 'pending' }, { transaction });
    let result;
    try {
      if (channel === 'in_app') result = { status: 'delivered', provider: 'database' };
      else if (channel === 'email') result = await sendNotificationEmail({ recipient, notification });
      else result = await sendSMS(recipient.phone, notification.message);
    } catch (error) {
      result = { status: 'failed', reason: error.message || 'Delivery provider error' };
    }
    const update = { status: result.status, provider: result.provider || null, providerMessageId: result.providerMessageId || null, errorMessage: result.reason || null, sentAt: ['sent', 'delivered'].includes(result.status) ? new Date() : null, deliveredAt: result.status === 'delivered' ? new Date() : null, failedAt: result.status === 'failed' ? new Date() : null };
    await delivery.update(update, { transaction });
    results.push({ channel, ...result });
  }
  return results;
};

const createBulkNotification = async (payload, senderId) => {
  if (!payload.title || !payload.message) throw Object.assign(new Error('Notification title and message are required'), { statusCode: 400 });
  const channels = normalizeChannels(payload.channels || payload.channel);
  if (!channels.length) throw Object.assign(new Error('At least one valid delivery channel is required'), { statusCode: 400 });
  const recipients = await resolveRecipients(payload);
  if (!recipients.length) throw Object.assign(new Error('No active recipients match the selected audience'), { statusCode: 400 });
  const scheduled = payload.scheduledAt || payload.scheduled_at;
  const status = scheduled && new Date(scheduled) > new Date() ? 'scheduled' : 'sent';
  const transaction = await sequelize.transaction();
  try {
    const created = [];
    for (const recipient of recipients) {
      const notification = await Notification.create(buildNotification(payload, senderId, recipient, status), { transaction });
      const deliveries = status === 'scheduled' ? channels.map((channel) => ({ channel, status: 'pending' })) : await deliver(notification, recipient, channels, transaction);
      created.push({ notification, recipient, deliveries });
    }
    await transaction.commit();
    await AuditLog.create({ userId: senderId, action: recipients.length > 1 ? 'BULK_NOTIFICATION_SENT' : 'NOTIFICATION_CREATED', entity: `notification:${created[0].notification.id}`, details: JSON.stringify({ recipientCount: recipients.length, channels, type: payload.type, priority: payload.priority, status }) });
    return { notifications: created.map((item) => item.notification), recipientCount: recipients.length, channels, status };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = { allowedTypes, allowedPriorities, allowedChannels, normalizeChannels, resolveRecipients, createBulkNotification, deliver };
