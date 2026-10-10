const { Op } = require('sequelize');
const { sequelize, Notification, NotificationDelivery, User, Config } = require('../models');
const { sendNotificationEmail, validateEmailConfiguration } = require('./emailService');
const { sendSMS } = require('./smsService');
const { createAuditLog } = require('./auditLogService');
const { normalizeRoleForStorage } = require('../constants/rolePermissions');

const allowedTypes = new Set(['system', 'maintenance', 'assignment', 'transfer', 'missing_asset', 'warranty', 'rfid', 'security', 'alert', 'report', 'reminder', 'approval', 'inventory', 'procurement', 'financial', 'verification', 'disposal', 'custom']);
const allowedPriorities = new Set(['low', 'medium', 'high', 'urgent']);
const allowedChannels = new Set(['in_app', 'email', 'sms']);
const defaultEventRules = {
  assignment_created: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
  assignment_returned: { enabled: true, inApp: true, email: false, recipientRule: 'Assigned User', priority: 'normal' },
  department_request_submitted: { enabled: true, inApp: true, email: false, recipientRule: 'Department Heads', priority: 'normal' },
  department_request_approved: { enabled: true, inApp: true, email: false, recipientRule: 'Requester', priority: 'normal' },
  department_request_rejected: { enabled: true, inApp: true, email: false, recipientRule: 'Requester', priority: 'high' },
  department_request_changes_requested: { enabled: true, inApp: true, email: false, recipientRule: 'Requester', priority: 'normal' },
  department_asset_assigned: { enabled: true, inApp: true, email: false, recipientRule: 'Department Heads', priority: 'normal' },
  department_asset_transferred: { enabled: true, inApp: true, email: false, recipientRule: 'Source and Destination Department Heads', priority: 'normal' },
  department_asset_returned: { enabled: true, inApp: true, email: false, recipientRule: 'Department Heads', priority: 'normal' },
  department_maintenance_updated: { enabled: true, inApp: true, email: false, recipientRule: 'Department Heads', priority: 'normal' },
  department_technician_assigned: { enabled: true, inApp: true, email: false, recipientRule: 'Department Heads', priority: 'normal' },
  maintenance_created: { enabled: true, inApp: true, email: false, recipientRule: 'Maintenance Staff', priority: 'normal' },
  maintenance_status_changed: { enabled: true, inApp: true, email: false, recipientRule: 'Requestor and Maintenance Staff', priority: 'normal' },
  maintenance_completed: { enabled: true, inApp: true, email: false, recipientRule: 'Requestor and Maintenance Staff', priority: 'normal' },
  maintenance_test_sent_to_qc: { enabled: true, inApp: true, email: false, recipientRule: 'Quality Control Reviewers', priority: 'high' },
  maintenance_qc_decision: { enabled: true, inApp: true, email: false, recipientRule: 'Requestor and Maintenance Staff', priority: 'high' },
  service_request_escalated: { enabled: true, inApp: true, email: false, recipientRule: 'Department Head, College Manager, and Assigned Owner', priority: 'high' },
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
  const clauses = [];
  if (user.id != null) clauses.push({ userId: user.id }, { recipientId: user.id });
  clauses.push({ scope: 'GLOBAL' });
  const role = user.role ? normalizeRoleForStorage(user.role) : '';
  const collegeId = Number(user.collegeId ?? user.college_id ?? 0);
  const departmentId = Number(user.departmentId ?? user.department_id ?? 0);
  const organizationId = Number(user.organizationId ?? user.organization_id ?? 0);

  if (organizationId) {
    clauses.push({ scope: 'ORGANIZATION', organizationId });
  }
  if (collegeId) {
    clauses.push({ scope: 'COLLEGE', collegeId });
  }
  if (departmentId) {
    clauses.push({ scope: 'DEPARTMENT', departmentId });
  }
  if (role) {
    clauses.push({ scope: 'ROLE', role });
  }

  return { [Op.or]: clauses };
};

const normalizeChannels = (channels) => {
  const values = Array.isArray(channels) ? channels : [channels || 'in_app'];
  return [...new Set(values.map((value) => String(value).toLowerCase()).flatMap((value) => value === 'multi_channel' ? ['in_app', 'email', 'sms'] : value === 'in-app' ? ['in_app'] : [value]).filter((value) => allowedChannels.has(value)))];
};

const resolveRecipients = async (payload) => {
  const type = String(payload.recipientType || payload.recipient_type || (payload.userId || payload.recipient_id ? 'users' : '')).toLowerCase();
  const where = { active: true };
  if (type === 'users' || type === 'user') {
    const userIds = payload.userIds || payload.user_ids || [payload.userId || payload.recipient_id];
    if (!Array.isArray(userIds) || !userIds.length || userIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) {
      throw Object.assign(new Error('Select one or more valid user recipients'), { statusCode: 400 });
    }
    where.id = { [Op.in]: [...new Set(userIds.map(Number))] };
  }
  else if (type === 'role') {
    if (!Array.isArray(payload.roles) || !payload.roles.length || payload.roles.some((role) => typeof role !== 'string' || !role.trim())) {
      throw Object.assign(new Error('Select one or more valid role recipients'), { statusCode: 400 });
    }
    where.role = { [Op.in]: [...new Set(payload.roles.map((role) => role.trim().toLowerCase()))] };
  }
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
  title: payload.title.trim(),
  message: payload.message.trim(),
  type: String(payload.type || 'system').toLowerCase(),
  priority: String(payload.priority || 'medium').toLowerCase(),
  channel: normalizeChannels(payload.channels || payload.channel).join(','),
  status,
  senderId,
  userId: recipient.id,
  recipientId: recipient.id,
  scope: normalizeNotificationScope(payload.scope || 'USER'),
  collegeId: recipient.collegeId || null,
  departmentId: recipient.departmentId || null,
  organizationId: recipient.organizationId || null,
  assetId: payload.assetId || payload.asset_id || null,
  eventKey: payload.eventKey || payload.event_key || null,
  category: payload.category || null,
  entityType: payload.entityType || payload.entity_type || null,
  entityId: payload.entityId || payload.entity_id || null,
  actionUrl: payload.actionUrl || payload.action_url || null,
  metadata: payload.metadata || null,
  read: false,
  readAt: null,
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

const getDepartmentHeadRecipients = async (departmentId) => User.findAll({
  where: { departmentId, role: 'department_head', active: true },
  attributes: ['id', 'departmentId', 'collegeId', 'organizationId'],
});

const createDepartmentEventNotification = async (payload = {}) => {
  const departmentId = Number(payload.departmentId || payload.department_id);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
    throw Object.assign(new Error('A valid department is required for a department notification'), { statusCode: 400 });
  }
  const recipients = await getDepartmentHeadRecipients(departmentId);
  const userIds = recipients
    .map((recipient) => Number(recipient.id))
    .filter((id) => Number.isSafeInteger(id) && id > 0 && id !== Number(payload.senderId));
  if (!userIds.length) return { skipped: true, reason: 'no_recipients' };
  return createEventNotification({ ...payload, departmentId, userIds });
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

const createBulkNotification = async (payload, senderId, senderRole = null) => {
  if (!payload || typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 255) {
    throw Object.assign(new Error('Title must contain 1 to 255 characters'), { statusCode: 400 });
  }
  if (typeof payload.message !== 'string' || !payload.message.trim()) {
    throw Object.assign(new Error('Notification message is required'), { statusCode: 400 });
  }
  const type = String(payload.type || 'system').trim().toLowerCase();
  if (!allowedTypes.has(type)) throw Object.assign(new Error('Notification type is invalid'), { statusCode: 400 });
  const priority = String(payload.priority || 'medium').trim().toLowerCase();
  if (!allowedPriorities.has(priority)) throw Object.assign(new Error('Notification priority is invalid'), { statusCode: 400 });
  const channels = normalizeChannels(payload.channels || payload.channel);
  if (!channels.length) throw Object.assign(new Error('At least one valid delivery channel is required'), { statusCode: 400 });
  const recipients = await resolveRecipients(payload);
  if (!recipients.length) throw Object.assign(new Error('No active recipients match the selected audience'), { statusCode: 400 });
  const scheduled = payload.scheduledAt || payload.scheduled_at;
  if (scheduled && Number.isNaN(new Date(scheduled).getTime())) {
    throw Object.assign(new Error('Scheduled date is invalid'), { statusCode: 400 });
  }
  const status = scheduled && new Date(scheduled) > new Date() ? 'scheduled' : 'sent';
  const sender = senderRole || !senderId
    ? null
    : await User.findByPk(senderId, { attributes: ['id', 'role'] });
  const transaction = await sequelize.transaction();
  try {
    const created = [];
    for (const recipient of recipients) {
      const notification = await Notification.create(buildNotification(payload, senderId, recipient, status), { transaction });
      const deliveries = status === 'scheduled' ? channels.map((channel) => ({ channel, status: 'pending' })) : await deliver(notification, recipient, channels, transaction);
      created.push({ notification, recipient, deliveries });
    }
    await createAuditLog({
      userId: senderId,
      role: senderRole || sender?.role,
      action: 'CREATE_NOTIFICATION',
      entity: `notification:${created[0].notification.id}`,
      entityId: created[0].notification.id,
      oldValue: null,
      newValue: { title: created[0].notification.title, type: created[0].notification.type, priority: created[0].notification.priority, status },
      details: { recipientCount: recipients.length, channels, legacyAction: recipients.length > 1 ? 'BULK_NOTIFICATION_SENT' : 'NOTIFICATION_CREATED' },
      transaction,
    });
    await transaction.commit();
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
  createDepartmentEventNotification,
  getDepartmentHeadRecipients,
  buildNotification,
  deliver,
  getNotificationSettings,
  defaultEventRules,
  normalizeNotificationScope,
  buildNotificationVisibilityWhere,
};
