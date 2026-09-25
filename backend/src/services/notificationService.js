const { Op } = require('sequelize');
const { sequelize, Notification, NotificationDelivery, User, AuditLog, Config } = require('../models');
const { sendNotificationEmail, validateEmailConfiguration } = require('./emailService');
const { sendSMS } = require('./smsService');

const allowedTypes = new Set(['system', 'maintenance', 'assignment', 'transfer', 'missing_asset', 'warranty', 'rfid', 'security', 'alert', 'report', 'reminder', 'approval', 'inventory', 'procurement', 'financial', 'verification', 'disposal', 'custom']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const allowedChannels = new Set(['in_app', 'email', 'sms']);
const defaultEventRules = {
  assignment_created: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
  assignment_returned: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
  maintenance_created: { enabled: true, inApp: true, email: false, recipientRule: 'Maintenance Staff', priority: 'normal' },
  maintenance_status_changed: { enabled: true, inApp: true, email: false, recipientRule: 'Requestor and Maintenance Staff', priority: 'normal' },
  finance_purchase_request_submitted: { enabled: true, inApp: true, email: false, recipientRule: 'Finance', priority: 'normal' },
  finance_invoice_registered: { enabled: true, inApp: true, email: false, recipientRule: 'Finance', priority: 'normal' },
  finance_payment_submitted: { enabled: true, inApp: true, email: false, recipientRule: 'Finance', priority: 'high' },
  finance_transaction_failed: { enabled: true, inApp: true, email: false, recipientRule: 'Finance', priority: 'urgent' },
  finance_invoice_overdue: { enabled: true, inApp: true, email: false, recipientRule: 'Finance', priority: 'high' },
};

const normalizeNotificationScope = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return ['GLOBAL', 'ORGANIZATION', 'COLLEGE', 'DEPARTMENT', 'ROLE', 'USER'].includes(normalized) ? normalized : 'USER';
};

const buildNotificationVisibilityWhere = (user = {}) => {
  const clauses = [{ userId: user.id }, { recipientId: user.id }, { scope: 'GLOBAL' }];
  const role = user.role ? String(user.role).trim().toLowerCase() : '';
  const collegeId = Number(user.collegeId ?? user.college_id ?? 0);
  const departmentId = Number(user.departmentId ?? user.department_id ?? 0);
  const organizationId = Number(user.organizationId ?? user.organization_id ?? 0);

  if (organizationId) {
    clauses.push({ organizationId }, { scope: 'ORGANIZATION', organizationId });
  }
  if (collegeId) {
    clauses.push({ collegeId }, { scope: 'COLLEGE', collegeId });
  }
  if (departmentId) {
    clauses.push({ departmentId }, { scope: 'DEPARTMENT', departmentId });
  }
  if (role) {
    clauses.push({ role }, { scope: 'ROLE', role });
  }

  return { [Op.or]: clauses.filter((clause) => {
    if (clause && clause.scope === 'GLOBAL') return true;
    if (clause && 'userId' in clause && clause.userId === undefined) return false;
    if (clause && 'recipientId' in clause && clause.recipientId === undefined) return false;
    return true;
  }) };
};

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
  assetId: payload.assetId || payload.asset_id || null,
  eventKey: payload.eventKey || payload.event_key || null,
  scheduledAt: payload.scheduledAt || payload.scheduled_at || null,
  expiresAt: payload.expiresAt || payload.expires_at || null,
  sentAt: status === 'sent' ? new Date() : null,
});

const getNotificationSettings = async () => {
  const record = await Config.findByPk('settings:notifications');
  let configured = {};
  try { configured = record ? JSON.parse(record.value || '{}') : {}; } catch { configured = {}; }
  return {
    enabled: configured.enabled !== false,
    inAppEnabled: configured.inAppEnabled !== false,
    emailEnabled: configured.emailEnabled === true,
    events: { ...defaultEventRules, ...(configured.events || {}) },
  };
};

const createEventNotification = async (payload = {}) => {
  const settings = await getNotificationSettings();
  const rule = settings.events[payload.event] || defaultEventRules[payload.event];
  if (!settings.enabled || !rule?.enabled) return { skipped: true, reason: 'disabled' };
  const channels = [];
  if (rule.inApp && settings.inAppEnabled) channels.push('in_app');
  if (rule.email && settings.emailEnabled && validateEmailConfiguration().valid) channels.push('email');
  if (!channels.length) return { skipped: true, reason: 'no_enabled_channel' };
  const recipients = [...new Set((payload.userIds || []).map(Number).filter(Number.isInteger))];
  if (!recipients.length) return { skipped: true, reason: 'no_recipients' };
  const notifications = [];
  for (const userId of recipients) {
    const eventKey = payload.eventKey || `${payload.event}:${payload.entityId || ''}:${userId}`;
    const duplicate = await Notification.findOne({ where: { userId, eventKey } });
    if (duplicate) continue;
    const result = await createBulkNotification({ ...payload, userIds: [userId], recipientType: 'users', channels, priority: rule.priority === 'normal' ? 'medium' : rule.priority, eventKey }, payload.senderId || null);
    notifications.push(...result.notifications);
  }
  return { skipped: false, notifications };
};

const createFinanceNotification = async (payload = {}) => {
  const recipients = await resolveRecipients({ recipientType: 'role', roles: ['finance', 'admin'] });
  return createEventNotification({ ...payload, userIds: recipients.map((recipient) => recipient.id) });
};

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

module.exports = {
  allowedTypes,
  allowedPriorities,
  allowedChannels,
  normalizeChannels,
  resolveRecipients,
  createBulkNotification,
  createEventNotification,
  createFinanceNotification,
  deliver,
  getNotificationSettings,
  defaultEventRules,
  normalizeNotificationScope,
  buildNotificationVisibilityWhere,
};
