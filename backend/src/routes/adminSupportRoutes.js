const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Asset, User, Assignment, Maintenance, RFIDLog, Category, Department, Notification, AuditLog, AuditLogArchive, Config, SettingsVersion, MfaSetting, Transfer, Inventory, InventoryTransaction, Approval, FinancialRecord, sequelize } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Op } = require('sequelize');
const speakeasy = require('speakeasy');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const mfaCipherKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'smart_asset_secret_key_2026').digest();
const encryptMfaSecret = (secret) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', mfaCipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};
const decryptMfaSecret = (payload) => {
  const [ivHex, tagHex, encryptedHex] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', mfaCipherKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};
const generateBackupCodes = () => Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
const hashBackupCodes = async (codes) => Promise.all(codes.map((code) => require('bcryptjs').hash(code, 10)));
const backupDirectory = path.join(__dirname, '../../backups');
const backupFilePattern = /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/;
const backupModels = { users: User, assets: Asset, assignments: Assignment, transfers: Transfer, maintenance: Maintenance, rfidLogs: RFIDLog, categories: Category, departments: Department, notifications: Notification, inventory: Inventory, inventoryTransactions: InventoryTransaction, approvals: Approval, financialRecords: FinancialRecord };
const safeJson = (record) => {
  const value = record.toJSON ? record.toJSON() : record;
  if (value.password !== undefined) delete value.password;
  return value;
};
const resolveBackupPath = (filename) => {
  if (!backupFilePattern.test(filename)) return null;
  const resolved = path.resolve(backupDirectory, filename);
  return resolved.startsWith(`${path.resolve(backupDirectory)}${path.sep}`) ? resolved : null;
};

const normalizeDepartment = async (department) => {
  const value = department.toJSON ? department.toJSON() : department;
  const [userCount, assetCount] = await Promise.all([
    User.count({ where: { department: value.name } }),
    Asset.count({ where: { department: value.name } }),
  ]);
  return {
    ...value,
    created_at: value.createdAt || null,
    updated_at: value.updatedAt || null,
    user_count: userCount,
    asset_count: assetCount,
  };
};

const validateDepartment = async (body, id = null) => {
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim().toUpperCase();
  if (name.length < 2 || name.length > 255) return { error: 'Department name must be between 2 and 255 characters' };
  if (code.length < 2 || code.length > 100) return { error: 'Department code must be between 2 and 100 characters' };
  const duplicateWhere = { [Op.or]: [{ name }, { code }] };
  if (id !== null) duplicateWhere.id = { [Op.ne]: id };
  if (await Department.findOne({ where: duplicateWhere })) return { error: 'Department name or code already exists' };
  if (body.headId !== undefined && body.headId !== null && body.headId !== '') {
    if (!await User.findByPk(body.headId)) return { error: 'Department head user not found' };
  }
  return { value: { name, code, description: String(body.description || '').trim(), headId: body.headId || null } };
};

router.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const records = await Department.findAll({ order: [['name', 'ASC']] });
    const departments = await Promise.all(records.map(normalizeDepartment));
    res.json({ success: true, data: departments, departments });
  } catch (error) { next(error); }
});

router.post('/departments', ...requireAdmin, async (req, res, next) => {
  try {
    const validation = await validateDepartment(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const department = await Department.create(validation.value);
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_CREATED', entity: `department:${department.id}`, details: JSON.stringify({ name: department.name, code: department.code }) });
    res.status(201).json({ success: true, data: await normalizeDepartment(department) });
  } catch (error) { next(error); }
});

router.put('/departments/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    const validation = await validateDepartment(req.body, req.params.id);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const previous = department.toJSON();
    await department.update(validation.value);
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_UPDATED', entity: `department:${department.id}`, details: JSON.stringify({ previous: { name: previous.name, code: previous.code, headId: previous.headId }, next: { name: department.name, code: department.code, headId: department.headId } }) });
    res.json({ success: true, data: await normalizeDepartment(department) });
  } catch (error) { next(error); }
});

router.delete('/departments/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    const [userCount, assetCount] = await Promise.all([
      User.count({ where: { department: department.name } }),
      Asset.count({ where: { department: department.name } }),
    ]);
    if (userCount || assetCount) return res.status(409).json({ success: false, message: 'Department has users or assets and cannot be deleted', userCount, assetCount });
    await department.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_DELETED', entity: `department:${department.id}`, details: JSON.stringify({ name: department.name, code: department.code }) });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.get('/categories', requireAuth, async (req, res) => {
  const categories = await Category.findAll({ order: [['name', 'ASC']] });
  res.json({ success: true, data: categories, categories });
});

router.get('/locations', requireAuth, async (req, res) => {
  res.json({ success: true, data: [] });
});

router.get('/notifications', requireAuth, async (req, res) => {
  const notifications = await Notification.findAll({
    where: { [require('sequelize').Op.or]: [{ userId: null }, { userId: req.user.id }] },
    order: [['createdAt', 'DESC']],
  });
  const normalized = notifications.map((notification) => ({
    ...notification.toJSON(),
    is_read: notification.read,
    created_at: notification.createdAt,
  }));
  res.json({ success: true, data: normalized, notifications: normalized });
});

router.put('/notifications/:id/read', requireAuth, async (req, res) => {
  const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
  if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
  await notification.update({ read: true });
  res.json({ success: true });
});

router.put('/notifications/read-all', requireAuth, async (req, res) => {
  await Notification.update({ read: true }, {
    where: { [require('sequelize').Op.or]: [{ userId: null }, { userId: req.user.id }] },
  });
  res.json({ success: true });
});

router.delete('/notifications/:id', requireAuth, async (req, res) => {
  const deleted = await Notification.destroy({ where: { id: req.params.id, userId: req.user.id } });
  if (!deleted) return res.status(404).json({ success: false, message: 'Notification not found' });
  res.json({ success: true });
});

router.delete('/notifications/all', requireAuth, requireRole('admin'), async (req, res) => {
  await Notification.destroy({ where: {} });
  res.json({ success: true });
});

const normalizeAuditDetails = (details) => {
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    const removeSecrets = (value) => {
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(removeSecrets);
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !/password|token|secret|api.?key/i.test(key))
        .map(([key, value]) => [key, removeSecrets(value)]));
    };
    return removeSecrets(parsed || {});
  } catch (error) {
    return {};
  }
};

const normalizeAuditLog = (log) => {
  const value = log.toJSON ? log.toJSON() : log;
  const associatedUser = value.user || value.User || null;
  const { User, user: ignoredUser, ...auditValue } = value;
  const [resourceType = '', resourceId = ''] = String(value.entity || '').split(':');
  const details = normalizeAuditDetails(value.details);
  return {
    ...auditValue,
    user: associatedUser,
    userRole: associatedUser?.role || null,
    module: resourceType || 'system',
    resourceType: resourceType || 'system',
    resourceId: resourceId || null,
    description: details.reason || details.comment || value.action,
    result: details.result || 'Success',
    ipAddress: details.ipAddress || details.ip || null,
    timestamp: value.createdAt,
    created_at: value.createdAt,
    details: JSON.stringify(details),
  };
};

const getAuditWhere = (query) => {
  const { search = '', action = '', module = '', user = '', dateFrom = '', dateTo = '' } = query;
  const where = {};
  const normalizedSearch = String(search).trim();
  if (action) where.action = action;
  if (module) where.entity = { [Op.like]: `%${String(module).trim()}%` };
  if (user && Number.isInteger(Number(user))) where.userId = Number(user);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (normalizedSearch) {
    where[Op.or] = [
      { action: { [Op.like]: `%${normalizedSearch}%` } },
      { entity: { [Op.like]: `%${normalizedSearch}%` } },
      { details: { [Op.like]: `%${normalizedSearch}%` } },
    ];
  }
  return where;
};

const auditInclude = [{ model: User, attributes: ['id', 'username', 'fullName', 'role'] }];

router.get('/audit', ...requireAdmin, async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const { count, rows } = await AuditLog.findAndCountAll({
      where: getAuditWhere(req.query),
      include: auditInclude,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });
    const logs = rows.map(normalizeAuditLog);
    const pagination = { page: currentPage, limit: pageSize, total: count, pages: Math.max(1, Math.ceil(count / pageSize)) };
    res.json({ success: true, data: logs, logs, total: count, pagination });
  } catch (error) { next(error); }
});

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

router.get('/audit/export', ...requireAdmin, async (req, res, next) => {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) return res.status(400).json({ success: false, message: 'Export format must be json or csv' });
    const rows = await AuditLog.findAll({ where: getAuditWhere(req.query), include: auditInclude, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const logs = rows.map(normalizeAuditLog);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (format === 'json') return res.json({ success: true, total: logs.length, logs });
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Resource Type', 'Resource ID', 'Result', 'IP Address', 'Details'];
    const lines = [headers.map(csvValue).join(',')];
    logs.forEach((log) => lines.push([
      log.timestamp, log.user?.username, log.userRole, log.action, log.module,
      log.resourceType, log.resourceId, log.result, log.ipAddress, log.details,
    ].map(csvValue).join(',')));
    res.type('text/csv').send(lines.join('\n'));
  } catch (error) { next(error); }
});

router.get('/audit/retention', ...requireAdmin, async (req, res, next) => {
  try {
    const days = 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const pending = await AuditLog.count({ where: { createdAt: { [Op.lt]: cutoff } } });
    const archived = await AuditLogArchive.count();
    res.json({ success: true, policy: { archiveAfterDays: days }, cutoff, pending, archived });
  } catch (error) { next(error); }
});

router.post('/audit/archive', ...requireAdmin, async (req, res, next) => {
  try {
    const days = Number.isFinite(Number(req.body.days)) ? Math.max(1, Number(req.body.days)) : 90;
    const cutoff = req.body.before ? new Date(req.body.before) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (Number.isNaN(cutoff.getTime())) return res.status(400).json({ success: false, message: 'A valid archive cutoff date is required' });
    const candidates = await AuditLog.findAll({ where: { createdAt: { [Op.lt]: cutoff } }, order: [['id', 'ASC']] });
    if (req.body.dryRun !== false) return res.json({ success: true, dryRun: true, cutoff, eligible: candidates.length });
    if (req.body.confirm !== true) return res.status(400).json({ success: false, message: 'Explicit confirmation is required to archive audit logs' });
    const transaction = await sequelize.transaction();
    try {
      await AuditLogArchive.bulkCreate(candidates.map((log) => ({
        originalId: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        details: normalizeAuditLog(log).details,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        archivedAt: new Date(),
      })), { ignoreDuplicates: true, transaction });
      const archivedCount = await AuditLog.destroy({ where: { id: candidates.map((log) => log.id) }, transaction });
      await AuditLog.create({ userId: req.user.id, action: 'AUDIT_LOGS_ARCHIVED', entity: 'audit_logs', details: JSON.stringify({ cutoff, archivedCount }) }, { transaction });
      await transaction.commit();
      res.json({ success: true, dryRun: false, cutoff, archived: archivedCount });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) { next(error); }
});

router.get('/audit/stream', ...requireAdmin, async (req, res, next) => {
  try {
    let cursor = Number.parseInt(req.query.since, 10);
    if (!Number.isInteger(cursor)) cursor = (await AuditLog.max('id')) || 0;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ since: cursor })}\n\n`);
    const timer = setInterval(async () => {
      try {
        const rows = await AuditLog.findAll({ where: { id: { [Op.gt]: cursor } }, include: auditInclude, order: [['id', 'ASC']], limit: 50 });
        rows.forEach((row) => { cursor = row.id; res.write(`event: audit\ndata: ${JSON.stringify(normalizeAuditLog(row))}\n\n`); });
        if (rows.length === 0) res.write(': keep-alive\n\n');
      } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Audit stream unavailable' })}\n\n`);
      }
    }, 2000);
    req.on('close', () => clearInterval(timer));
  } catch (error) { next(error); }
});

const SETTINGS_FIELDS = ['university_name', 'institution_name', 'website', 'logo_url', 'favicon_url', 'address', 'contact_phone', 'contact_email', 'organization_code', 'description', 'asset_code_format', 'default_currency', 'date_format', 'time_format', 'number_format', 'language', 'timezone', 'theme', 'sidebar_behavior', 'dashboard_layout', 'maintenance_alerts', 'rfid_alerts', 'missing_asset_alerts', 'warranty_alerts', 'financial_alerts', 'assignment_alerts', 'transfer_alerts', 'security_alerts', 'asset_statuses', 'condition_types', 'warranty_default_months', 'useful_life_default_years', 'rfid_enabled', 'rfid_format', 'rfid_scan_interval', 'rfid_location_tracking', 'rfid_missing_detection', 'rfid_alert_threshold', 'maintenance_default_priority', 'maintenance_reminder_days', 'maintenance_overdue_days', 'fiscal_year', 'tax_rate', 'depreciation_method', 'financial_approval_threshold', 'budget_warning_threshold', 'report_default_format', 'report_default_date_range', 'report_page_size', 'report_footer', 'workflow_asset_request', 'workflow_assignment', 'workflow_transfer', 'workflow_return', 'workflow_maintenance', 'workflow_purchase', 'workflow_financial_approval', 'workflow_retirement', 'smtp_host', 'smtp_port', 'smtp_sender_name', 'smtp_sender_email', 'smtp_encryption', 'audit_login', 'audit_logout', 'audit_crud', 'audit_operations', 'audit_financial', 'audit_settings', 'monitoring_refresh_seconds', 'error_monitoring_enabled', 'cleanup_enabled', 'archive_after_days', 'notification_enabled', 'notification_email', 'notification_sms'];
const SECURITY_FIELDS = ['password_min_length', 'password_require_uppercase', 'password_require_lowercase', 'password_require_numbers', 'password_require_special', 'session_timeout', 'max_login_attempts', 'account_lockout_duration', 'two_factor_auth', 'jwt_expiry', 'ip_whitelist', 'enable_audit_log'];
const DEFAULT_SECURITY_SETTINGS = { password_min_length: 8, password_require_uppercase: true, password_require_lowercase: true, password_require_numbers: true, password_require_special: true, session_timeout: 60, max_login_attempts: 5, account_lockout_duration: 30, two_factor_auth: false, jwt_expiry: 7, ip_whitelist: '', enable_audit_log: true };

router.get('/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const record = await Config.findByPk('system');
    const settings = record ? JSON.parse(record.value) : {};
    res.json({ success: true, settings });
  } catch (error) { next(error); }
});

router.put('/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = Object.fromEntries(SETTINGS_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    if (settings.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.contact_email))) return res.status(400).json({ success: false, message: 'Invalid contact email' });
    if (settings.website) {
      try {
        const website = new URL(String(settings.website));
        if (!['http:', 'https:'].includes(website.protocol)) throw new Error('Unsupported protocol');
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Website must be a valid HTTP or HTTPS URL' });
      }
    }
    const record = await Config.findByPk('system');
    const previous = record ? JSON.parse(record.value) : {};
    const nextSettings = { ...previous, ...settings };
    const versionNumber = (await SettingsVersion.max('versionNumber', { where: { settingsType: 'system' } }) || 0) + 1;
    await SettingsVersion.create({ settingsType: 'system', versionNumber, settingsJson: JSON.stringify(previous), changedBy: req.user.id, changeReason: String(req.body.change_reason || 'System settings updated').slice(0, 255) });
    if (record) await record.update({ value: JSON.stringify(nextSettings) });
    else await Config.create({ key: 'system', value: JSON.stringify(nextSettings) });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_CHANGED', entity: 'settings:system', details: JSON.stringify({ changed: Object.keys(settings), previous, next: nextSettings }) });
    res.json({ success: true, settings: nextSettings });
  } catch (error) { next(error); }
});

router.get('/security/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const record = await Config.findByPk('security');
    const security = { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
    res.json({ success: true, settings: security });
  } catch (error) { next(error); }
});

router.put('/security/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = Object.fromEntries(SECURITY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    const numericFields = ['password_min_length', 'session_timeout', 'max_login_attempts', 'account_lockout_duration', 'jwt_expiry'];
    for (const field of numericFields) {
      if (Object.prototype.hasOwnProperty.call(settings, field)) {
        if (!Number.isInteger(Number(settings[field])) || Number(settings[field]) <= 0) return res.status(400).json({ success: false, message: `${field} must be a positive integer` });
        settings[field] = Number(settings[field]);
      }
    }
    if (settings.password_min_length < 6 || settings.password_min_length > 32) return res.status(400).json({ success: false, message: 'Password minimum length must be between 6 and 32' });
    const record = await Config.findByPk('security');
    const previous = { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
    const nextSettings = { ...previous, ...settings };
    const versionNumber = (await SettingsVersion.max('versionNumber', { where: { settingsType: 'security' } }) || 0) + 1;
    await SettingsVersion.create({ settingsType: 'security', versionNumber, settingsJson: JSON.stringify(previous), changedBy: req.user.id, changeReason: String(req.body.change_reason || 'Security settings updated').slice(0, 255) });
    if (record) await record.update({ value: JSON.stringify(nextSettings) });
    else await Config.create({ key: 'security', value: JSON.stringify(nextSettings) });
    await AuditLog.create({ userId: req.user.id, action: 'SECURITY_SETTINGS_CHANGED', entity: 'settings:security', details: JSON.stringify({ changed: Object.keys(settings), previous: { ...previous, ip_whitelist: previous.ip_whitelist ? '[configured]' : '' }, next: { ...nextSettings, ip_whitelist: nextSettings.ip_whitelist ? '[configured]' : '' } }) });
    res.json({ success: true, settings: nextSettings });
  } catch (error) { next(error); }
});

router.post('/settings/reset', ...requireAdmin, async (req, res, next) => {
  try {
    const key = req.body?.section === 'security' ? 'security' : 'system';
    const defaults = key === 'security' ? DEFAULT_SECURITY_SETTINGS : {};
    const record = await Config.findByPk(key);
    const previous = record ? JSON.parse(record.value) : {};
    if (record) await record.update({ value: JSON.stringify(defaults) });
    else await Config.create({ key, value: JSON.stringify(defaults) });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_RESET', entity: `settings:${key}`, details: JSON.stringify({ section: key, changed: Object.keys(defaults), previous: { ...previous, ip_whitelist: previous.ip_whitelist ? '[configured]' : undefined } }) });
    res.json({ success: true, settings: defaults });
  } catch (error) { next(error); }
});

router.get('/mfa/status', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    res.json({ success: true, status: { enabled: Boolean(setting?.enabled), verifiedAt: setting?.verifiedAt || null, backupCodesRemaining: setting ? JSON.parse(setting.backupCodesHash || '[]').length : 0 } });
  } catch (error) { next(error); }
});

router.post('/mfa/setup', ...requireAdmin, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ length: 20, name: `Smart Asset Management:${req.user.username}`, issuer: 'Smart Asset Management' });
    const backupCodes = generateBackupCodes();
    const hashes = await hashBackupCodes(backupCodes);
    const [setting, created] = await MfaSetting.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id, enabled: false, secretEncrypted: encryptMfaSecret(secret.base32), backupCodesHash: JSON.stringify(hashes) } });
    if (!created) await setting.update({ enabled: false, secretEncrypted: encryptMfaSecret(secret.base32), backupCodesHash: JSON.stringify(hashes), verifiedAt: null });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_SETUP_STARTED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: false }) });
    res.json({ success: true, setup: { otpauthUrl: secret.otpauth_url, backupCodes } });
  } catch (error) { next(error); }
});

router.post('/mfa/verify', ...requireAdmin, async (req, res, next) => {
  try {
    const token = String(req.body.token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return res.status(400).json({ success: false, message: 'A six-digit verification code is required' });
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting) return res.status(400).json({ success: false, message: 'MFA setup has not been started' });
    const verified = speakeasy.totp.verify({ secret: decryptMfaSecret(setting.secretEncrypted), encoding: 'base32', token, window: 1 });
    if (!verified) return res.status(400).json({ success: false, message: 'Invalid verification code' });
    await setting.update({ enabled: true, verifiedAt: new Date() });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_ENABLED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: true }) });
    res.json({ success: true, status: { enabled: true, verifiedAt: setting.verifiedAt } });
  } catch (error) { next(error); }
});

router.post('/mfa/disable', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting) return res.json({ success: true, status: { enabled: false } });
    await setting.update({ enabled: false, verifiedAt: null });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_DISABLED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: false }) });
    res.json({ success: true, status: { enabled: false } });
  } catch (error) { next(error); }
});

router.post('/mfa/regenerate-backup-codes', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting?.enabled) return res.status(400).json({ success: false, message: 'MFA must be enabled before regenerating backup codes' });
    const backupCodes = generateBackupCodes();
    await setting.update({ backupCodesHash: JSON.stringify(await hashBackupCodes(backupCodes)) });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_BACKUP_CODES_REGENERATED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ count: backupCodes.length }) });
    res.json({ success: true, backupCodes });
  } catch (error) { next(error); }
});

router.get('/settings/versions', ...requireAdmin, async (req, res, next) => {
  try {
    const versions = await SettingsVersion.findAll({ order: [['createdAt', 'DESC']], limit: 100, attributes: { exclude: ['settingsJson'] } });
    res.json({ success: true, versions });
  } catch (error) { next(error); }
});

router.get('/settings/versions/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const version = await SettingsVersion.findByPk(req.params.id);
    if (!version) return res.status(404).json({ success: false, message: 'Settings version not found' });
    res.json({ success: true, version: { ...version.toJSON(), settings: JSON.parse(version.settingsJson) } });
  } catch (error) { next(error); }
});

router.post('/settings/versions/:id/restore', ...requireAdmin, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const version = await SettingsVersion.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!version) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Settings version not found' }); }
    const settings = JSON.parse(version.settingsJson);
    const current = await Config.findByPk(version.settingsType, { transaction, lock: transaction.LOCK.UPDATE });
    const nextVersion = (await SettingsVersion.max('versionNumber', { where: { settingsType: version.settingsType }, transaction }) || 0) + 1;
    await SettingsVersion.create({ settingsType: version.settingsType, versionNumber: nextVersion, settingsJson: current?.value || '{}', changedBy: req.user.id, changeReason: `Restored version ${version.versionNumber}` }, { transaction });
    if (current) await current.update({ value: JSON.stringify(settings) }, { transaction });
    else await Config.create({ key: version.settingsType, value: JSON.stringify(settings) }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_VERSION_RESTORED', entity: `settings:${version.settingsType}`, details: JSON.stringify({ versionId: version.id, versionNumber: version.versionNumber }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, settings });
  } catch (error) { await transaction.rollback(); next(error); }
});

router.get('/backups', ...requireAdmin, async (req, res, next) => {
  try {
    await fs.promises.mkdir(backupDirectory, { recursive: true });
    const { search = '', status = '', type = '', page = '1', limit = '25' } = req.query;
    const normalizedSearch = String(search).trim().toLowerCase();
    const normalizedStatus = String(status).trim().toLowerCase();
    const normalizedType = String(type).trim().toLowerCase();
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    const entries = await fs.promises.readdir(backupDirectory, { withFileTypes: true });
    const backups = (await Promise.all(entries.filter((entry) => entry.isFile() && backupFilePattern.test(entry.name)).map(async (entry) => {
      const filename = entry.name;
      const filePath = resolveBackupPath(filename);
      const stats = await fs.promises.stat(filePath);
      let metadata = {};
      if (stats.size > 0) {
        try {
          metadata = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        } catch (error) {
          metadata = {};
        }
      }
      const backupType = metadata.type || 'JSON';
      const createdBy = metadata.createdBy || '';
      const backupStatus = stats.size > 0 && metadata.format === 'smart-asset-management-backup' && metadata.version === 1
        ? 'Completed'
        : 'Invalid';
      return { filename, size: stats.size, createdAt: metadata.createdAt || stats.birthtime.toISOString(), status: backupStatus, type: backupType, createdBy };
    }))).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    const filtered = backups.filter((backup) => {
      const matchesSearch = !normalizedSearch || [backup.filename, backup.createdBy, backup.type].some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesStatus = !normalizedStatus || backup.status.toLowerCase() === normalizedStatus;
      const matchesType = !normalizedType || backup.type.toLowerCase() === normalizedType;
      return matchesSearch && matchesStatus && matchesType;
    });
    const total = filtered.length;
    const start = (currentPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);
    const pagination = { page: currentPage, limit: pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) };
    res.json({ success: true, data: paged, backups: paged, pagination });
  } catch (error) { next(error); }
});

router.post('/backups', ...requireAdmin, async (req, res, next) => {
  try {
    await fs.promises.mkdir(backupDirectory, { recursive: true });
    const data = {};
    for (const [key, Model] of Object.entries(backupModels)) data[key] = (await Model.findAll()).map(safeJson);
    const payload = { format: 'smart-asset-management-backup', version: 1, type: 'JSON', createdAt: new Date().toISOString(), createdBy: req.user.username, counts: Object.fromEntries(Object.entries(data).map(([key, records]) => [key, records.length])), data };
    const timestamp = payload.createdAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', 'T');
    const filename = `backup_${timestamp}_${crypto.randomBytes(4).toString('hex')}.json`;
    const filePath = resolveBackupPath(filename);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', flag: 'wx' });
    const stats = await fs.promises.stat(filePath);
    if (stats.size <= 0) throw new Error('Backup artifact is empty');
    const checksum = crypto.createHash('sha256').update(await fs.promises.readFile(filePath)).digest('hex');
    await AuditLog.create({ userId: req.user.id, action: 'BACKUP_CREATED', entity: `backup:${filename}`, details: JSON.stringify({ filename, size: stats.size, checksum, counts: payload.counts }) });
    res.status(201).json({ success: true, data: { filename, size: stats.size, checksum, createdAt: payload.createdAt, createdBy: payload.createdBy, type: payload.type, status: 'Completed' } });
  } catch (error) { next(error); }
});

router.get('/backups/verify/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const filePath = resolveBackupPath(req.params.filename);
    if (!filePath) return res.status(400).json({ success: false, message: 'Invalid backup filename' });
    const content = await fs.promises.readFile(filePath, 'utf8');
    const backup = JSON.parse(content);
    const valid = Boolean(content.length > 0 && backup.format === 'smart-asset-management-backup' && backup.version === 1 && backup.data && backup.counts);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    await AuditLog.create({ userId: req.user.id, action: 'BACKUP_VERIFIED', entity: `backup:${req.params.filename}`, details: JSON.stringify({ filename: req.params.filename, valid, checksum }) });
    res.json({ success: true, valid, checksum, size: Buffer.byteLength(content), message: valid ? 'Backup is valid' : 'Backup metadata is invalid' });
  } catch (error) { if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' }); next(error); }
});

router.get('/backups/download/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const filePath = resolveBackupPath(req.params.filename);
    if (!filePath) return res.status(400).json({ success: false, message: 'Invalid backup filename' });
    await fs.promises.access(filePath, fs.constants.R_OK);
    await AuditLog.create({ userId: req.user.id, action: 'BACKUP_DOWNLOADED', entity: `backup:${req.params.filename}`, details: JSON.stringify({ filename: req.params.filename }) });
    res.download(filePath, req.params.filename);
  } catch (error) { if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' }); next(error); }
});

router.delete('/backups/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const filePath = resolveBackupPath(req.params.filename);
    if (!filePath) return res.status(400).json({ success: false, message: 'Invalid backup filename' });
    await fs.promises.unlink(filePath);
    await AuditLog.create({ userId: req.user.id, action: 'BACKUP_DELETED', entity: `backup:${req.params.filename}`, details: JSON.stringify({ filename: req.params.filename }) });
    res.json({ success: true });
  } catch (error) { if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' }); next(error); }
});

router.get('/admin/dashboard', ...requireAdmin, async (req, res, next) => {
  try {
    const [assets, users, assignments, maintenance, rfidLogs, departments, auditLogs, transfers, inventory] = await Promise.all([
      Asset.findAll({ order: [['updatedAt', 'DESC']] }),
      User.findAll({ attributes: ['id', 'username', 'fullName', 'role', 'active', 'createdAt', 'updatedAt'] }),
      Assignment.findAll({ order: [['createdAt', 'DESC']] }),
      Maintenance.findAll({ order: [['updatedAt', 'DESC']] }),
      RFIDLog.findAll({ order: [['createdAt', 'DESC']], limit: 20 }),
      Department.findAll({ attributes: ['id', 'name', 'createdAt', 'updatedAt'], order: [['name', 'ASC']] }),
      AuditLog.findAll({ order: [['createdAt', 'DESC']], limit: 20 }),
      Transfer.findAll({ order: [['createdAt', 'DESC']], limit: 20 }),
      Inventory.findAll({ attributes: ['assetId', 'quantity', 'availableQuantity', 'minimumQuantity', 'status'], raw: true }),
    ]);

    const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
    const displayStatus = (status) => {
      const normalized = normalizeStatus(status).replace(/[_-]/g, ' ');
      const labels = {
        available: 'Available',
        active: 'Active',
        assigned: 'Assigned',
        'in use': 'Assigned',
        maintenance: 'Maintenance',
        'under maintenance': 'Maintenance',
        'under-maintenance': 'Maintenance',
        damaged: 'Damaged',
        missing: 'Missing',
        lost: 'Missing',
        retired: 'Retired',
        disposed: 'Retired',
      };
      return labels[normalized] || 'Other';
    };
    const statusCounts = assets.reduce((counts, asset) => {
      const status = displayStatus(asset.status);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const departmentCounts = assets.reduce((counts, asset) => {
      const department = asset.department || 'Unassigned';
      counts[department] = (counts[department] || 0) + 1;
      return counts;
    }, {});
    const categoryCounts = assets.reduce((counts, asset) => {
      const category = asset.category || 'Uncategorized';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
    departments.forEach((department) => {
      if (departmentCounts[department.name] === undefined) departmentCounts[department.name] = 0;
    });
    const maintenanceCounts = maintenance.reduce((counts, item) => {
      const status = normalizeStatus(item.status);
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    }, {});
    const roleCounts = users.reduce((counts, account) => {
      const role = account.role || 'unknown';
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {});
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const isWithinLastWeek = (value) => value && new Date(value).getTime() >= weekAgo;
    const parseAssignmentNotes = (assignment) => {
      try {
        return JSON.parse(assignment.notes || '{}');
      } catch (error) {
        return {};
      }
    };
    const overdueReturns = assignments.filter((assignment) => {
      if (assignment.status !== 'active') return false;
      const expectedReturnDate = parseAssignmentNotes(assignment).expectedReturnDate;
      return expectedReturnDate && new Date(expectedReturnDate).getTime() < now;
    }).length;
    const weeklySummary = {
      newAssets: assets.filter((asset) => isWithinLastWeek(asset.createdAt)).length,
      assignments: assignments.filter((assignment) => isWithinLastWeek(assignment.createdAt)).length,
      maintenanceRequests: maintenance.filter((item) => isWithinLastWeek(item.createdAt)).length,
      completedMaintenance: maintenance.filter((item) => item.status === 'completed' && isWithinLastWeek(item.updatedAt)).length,
      rfidActivity: rfidLogs.filter((log) => isWithinLastWeek(log.createdAt)).length,
    };
    const recentActivities = [
      ...auditLogs.map((log) => ({
        module: 'System',
        action: log.action,
        description: log.entity || log.details || '',
        title: `${log.action}${log.entity ? ` - ${log.entity}` : ''}`,
        time: log.createdAt,
        icon: 'audit',
      })),
      ...assets.slice(0, 5).map((asset) => ({
        module: 'Asset',
        action: asset.status,
        description: asset.name,
        type: 'asset',
        title: `${asset.name} - ${asset.status}`,
        time: asset.updatedAt,
        icon: 'asset',
      })),
      ...maintenance.slice(0, 5).map((item) => ({
        module: 'Maintenance',
        action: item.status,
        description: item.title,
        type: 'maintenance',
        title: `${item.title} - ${item.status}`,
        time: item.updatedAt,
        icon: 'maintenance',
      })),
      ...users.slice(0, 5).map((account) => ({
        module: 'User', action: 'created', description: account.fullName || account.username,
        title: `User created - ${account.username}`, time: account.createdAt, responsibleUser: account.username, icon: 'user',
      })),
      ...departments.slice(0, 5).map((department) => ({
        module: 'Department', action: 'created', description: department.name,
        title: `Department created - ${department.name}`, time: department.createdAt, icon: 'department',
      })),
      ...transfers.slice(0, 5).map((transfer) => ({
        module: 'Transfer', action: transfer.status, description: `Asset ${transfer.assetId}: ${transfer.sourceDepartment} to ${transfer.destinationDepartment}`,
        title: `Asset transfer - ${transfer.assetId}`, time: transfer.createdAt, icon: 'transfer',
      })),
    ].sort((left, right) => new Date(right.time) - new Date(left.time)).slice(0, 10);

    const today = new Date();
    const expiredWarranties = assets.filter((asset) => asset.warrantyExpiry && new Date(asset.warrantyExpiry) < today);
    const lowStockAssets = inventory.filter((item) => Number(item.availableQuantity) <= Number(item.minimumQuantity));
    const overdueMaintenance = maintenance.filter((item) => {
      const status = normalizeStatus(item.status);
      return !['completed', 'cancelled', 'rejected'].includes(status) && item.updatedAt && new Date(item.updatedAt).getTime() < weekAgo;
    });

    const data = {
      totalAssets: assets.length,
      activeAssets: assets.filter((asset) => normalizeStatus(asset.status) === 'available').length,
      availableAssets: assets.filter((asset) => normalizeStatus(asset.status) === 'available').length,
      retiredAssets: assets.filter((asset) => ['retired', 'disposed'].includes(normalizeStatus(asset.status))).length,
      missingAssets: assets.filter((asset) => normalizeStatus(asset.status) === 'missing').length,
      damagedAssets: assets.filter((asset) => normalizeStatus(asset.status) === 'damaged').length,
      underMaintenance: assets.filter((asset) => ['under-maintenance', 'under maintenance'].includes(normalizeStatus(asset.status))).length,
      totalDepartments: departments.length,
      totalUsers: users.length,
      pendingMaintenance: maintenanceCounts.pending || 0,
      rfidActivity: rfidLogs.length,
      totalValue: assets.reduce((total, asset) => total + Number(asset.currentValue || 0), 0),
      assignedAssets: assets.filter((asset) => displayStatus(asset.status) === 'Assigned').length,
      overdueReturns,
      assetByStatus: Object.entries(statusCounts).map(([label, value]) => ({ label, value })),
      assetByDepartment: Object.entries(departmentCounts).map(([label, value]) => ({ label, value })),
      assetByCategory: Object.entries(categoryCounts).map(([label, value]) => ({ label, value })),
      assetsPurchasedOverTime: Object.entries(assets.reduce((counts, asset) => {
        if (asset.purchaseDate) {
          const year = new Date(asset.purchaseDate).getFullYear();
          counts[year] = (counts[year] || 0) + 1;
        }
        return counts;
      }, {})).sort(([left], [right]) => Number(left) - Number(right)).map(([label, value]) => ({ label, value })),
      maintenanceTrend: (() => {
        const periods = [];
        for (let offset = 5; offset >= 0; offset -= 1) {
          const date = new Date();
          date.setMonth(date.getMonth() - offset, 1);
          const nextMonth = new Date(date);
          nextMonth.setMonth(date.getMonth() + 1);
          const monthItems = maintenance.filter((item) => item.createdAt >= date && item.createdAt < nextMonth);
          periods.push({
            month: date.toLocaleString('en', { month: 'short' }),
            pending: monthItems.filter((item) => normalizeStatus(item.status) === 'pending').length,
            inProgress: monthItems.filter((item) => ['in progress', 'in-progress', 'assigned'].includes(normalizeStatus(item.status))).length,
            completed: monthItems.filter((item) => normalizeStatus(item.status) === 'completed').length,
            cancelled: monthItems.filter((item) => ['cancelled', 'rejected'].includes(normalizeStatus(item.status))).length,
            count: monthItems.length,
          });
        }
        return periods;
      })(),
      rfidActivityLog: rfidLogs.map((log) => ({
        id: log.id,
        asset: assets.find((asset) => asset.id === log.assetId)?.name || `Asset ${log.assetId}`,
        location: log.location || 'Unknown',
        timestamp: log.createdAt,
      })),
      rfidMetrics: {
        detectedTags: rfidLogs.length,
        uniqueTags: new Set(rfidLogs.map((log) => log.tag)).size,
        latestActivity: rfidLogs[0]?.createdAt || null,
        totalDevices: new Set(rfidLogs.map((log) => log.location).filter(Boolean)).size,
        onlineDevices: rfidLogs.length ? 1 : 0,
        offlineDevices: rfidLogs.length ? 0 : 0,
        unknownAlerts: rfidLogs.filter((log) => !assets.some((asset) => asset.id === log.assetId)).length,
      },
      maintenanceSummary: {
        open: maintenance.filter((item) => ['pending', 'approved'].includes(normalizeStatus(item.status))).length,
        inProgress: maintenance.filter((item) => ['assigned', 'in-progress', 'in progress'].includes(normalizeStatus(item.status))).length,
        completed: maintenance.filter((item) => normalizeStatus(item.status) === 'completed').length,
        overdue: overdueMaintenance.length,
        scheduled: maintenance.filter((item) => normalizeStatus(item.status) === 'scheduled').length,
      },
      userSummary: { active: users.filter((account) => account.active !== false).length, inactive: users.filter((account) => account.active === false).length, byRole: roleCounts },
      departmentSummary: { mostAssets: Object.entries(departmentCounts).sort((left, right) => right[1] - left[1])[0]?.[0] || null, attention: departments.filter((department) => !departmentCounts[department.name]).map((department) => department.name) },
      recentAssets: assets.slice(0, 10).map((asset) => ({ id: asset.id, name: asset.name, category: asset.category, department: asset.department, status: displayStatus(asset.status), rfid: asset.rfidTag, updatedAt: asset.updatedAt })),
      searchCatalog: {
        assets: assets.map((asset) => ({ id: asset.id, name: asset.name, category: asset.category, department: asset.department, rfid: asset.rfidTag, status: displayStatus(asset.status) })),
        users: users.map((account) => ({ id: account.id, username: account.username, name: account.fullName, role: account.role })),
        departments: departments.map((department) => ({ id: department.id, name: department.name })),
      },
      alerts: [
        ...(overdueMaintenance.length ? [{ type: 'danger', category: 'maintenance', count: overdueMaintenance.length, message: `${overdueMaintenance.length} maintenance request(s) are overdue.` }] : []),
        ...(expiredWarranties.length ? [{ type: 'warning', category: 'warranty', count: expiredWarranties.length, message: `${expiredWarranties.length} asset warranty(ies) have expired.` }] : []),
        ...(lowStockAssets.length ? [{ type: 'warning', category: 'inventory', count: lowStockAssets.length, message: `${lowStockAssets.length} inventory item(s) are low on stock.` }] : []),
        ...(assets.filter((asset) => ['missing', 'lost'].includes(normalizeStatus(asset.status))).length ? [{ type: 'danger', category: 'asset', count: assets.filter((asset) => ['missing', 'lost'].includes(normalizeStatus(asset.status))).length, message: 'Assets are marked missing or lost.' }] : []),
        ...(assets.filter((asset) => normalizeStatus(asset.condition) === 'damaged').length ? [{ type: 'warning', category: 'asset', count: assets.filter((asset) => normalizeStatus(asset.condition) === 'damaged').length, message: 'Assets require damage review.' }] : []),
        ...(rfidLogs.filter((log) => !assets.some((asset) => asset.id === log.assetId)).length ? [{ type: 'danger', category: 'rfid', count: rfidLogs.filter((log) => !assets.some((asset) => asset.id === log.assetId)).length, message: 'Unknown RFID activity detected.' }] : []),
      ],
      weeklySummary,
      recentActivities,
      alerts: [
        ...(assets.filter((asset) => normalizeStatus(asset.status) === 'missing').length > 0
          ? [{ type: 'danger', message: 'One or more assets are marked as missing.' }]
          : []),
        ...(maintenanceCounts.pending > 3
          ? [{ type: 'warning', message: `${maintenanceCounts.pending} maintenance requests are pending.` }]
          : []),
      ],
      quickActions: [
        { icon: '➕', label: 'Create Asset', path: '/admin/assets/create' },
        { icon: '📋', label: 'Assign Asset', path: '/admin/assets/assign' },
        { icon: '🔄', label: 'Transfer Asset', path: '/admin/assets/transfer' },
        { icon: '🔧', label: 'Maintenance', path: '/admin/maintenance' },
        { icon: '📡', label: 'RFID Tracking', path: '/admin/rfid' },
        { icon: '👥', label: 'Manage Users', path: '/admin/users' },
        { icon: '🏛️', label: 'Departments', path: '/admin/departments' },
        { icon: '📊', label: 'Reports', path: '/admin/reports' },
        { icon: '📋', label: 'Audit Logs', path: '/admin/audit-logs' },
      ],
    };

    return res.json({ success: true, data, ...data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
