const express = require('express');
const bcrypt = require('bcryptjs');
const { sequelize, Config, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { defaultEventRules } = require('../services/notificationService');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const defaultAdminPermissions = ['settings.view', 'settings.manage'];
const requireSettingsPermission = (permission) => [requireAuth, async (req, res, next) => {
  try {
    const record = await Config.findByPk('role_permissions');
    let permissions = req.user.role === 'admin' ? defaultAdminPermissions : [];
    if (record?.value) {
      const matrix = JSON.parse(record.value);
      permissions = Array.isArray(matrix?.[req.user.role]) ? matrix[req.user.role] : permissions;
    }
    if (!permissions.includes(permission) && !(permission === 'settings.view' && permissions.includes('settings.manage'))) {
      return res.status(403).json({ success: false, message: 'Missing required settings permission' });
    }
    return next();
  } catch (error) { return next(error); }
}];
const requireSettingsView = requireSettingsPermission('settings.view');
const requireSettingsUpdate = requireSettingsPermission('settings.manage');
const sections = ['organization', 'account', 'security', 'roles', 'notifications', 'localization', 'assets', 'workflow', 'rfid', 'maintenance', 'financial', 'reports', 'audit', 'monitoring', 'integrations', 'backup', 'maintenance_sys'];
const sensitiveKeys = /password|secret|token|api.?key|private.?key|credential/i;
const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKeys.test(key) ? '[configured]' : redact(item)]));
};
const parseValue = (record) => { try { return record ? JSON.parse(record.value || '{}') : {}; } catch { return {}; } };
const configKey = (section) => `settings:${section}`;
const defaultNotificationSettings = { enabled: true, inAppEnabled: true, emailEnabled: false, events: defaultEventRules };
const defaultAssetSettings = {
  enabled: true,
  prefix: 'MAU',
  categoryCode: 'GEN',
  year: new Date().getFullYear(),
  sequenceLength: 6,
  startNumber: 1,
  separator: '-',
  format: '{PREFIX}-{CATEGORY}-{YEAR}-{SEQUENCE}',
};

const normalizeOrganizationSettings = (data = {}) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};

  const normalized = {};
  const aliases = {
    university_name: data.university_name ?? data.orgName ?? data.organizationName ?? data.university ?? '',
    institution_name: data.institution_name ?? data.instName ?? data.institutionName ?? data.institution ?? data.university_name ?? data.orgName ?? '',
    organization_code: data.organization_code ?? data.orgCode ?? data.organizationCode ?? '',
    logo_url: data.logo_url ?? data.logo ?? data.logoUrl ?? '',
    website: data.website ?? '',
    contact_email: data.contact_email ?? data.email ?? '',
    contact_phone: data.contact_phone ?? data.phone ?? '',
    address: data.address ?? ''
  };

  for (const [key, value] of Object.entries(aliases)) {
    if (value !== undefined && value !== null) {
      normalized[key] = String(value).trim();
    }
  }

  return normalized;
};

const resolveOrganizationSettings = (data = {}) => {
  const normalized = normalizeOrganizationSettings(data || {});
  return {
    orgName: normalized.university_name || '',
    instName: normalized.institution_name || normalized.university_name || '',
    orgCode: normalized.organization_code || '',
    logo: normalized.logo_url || '',
    website: normalized.website || '',
    email: normalized.contact_email || '',
    phone: normalized.contact_phone || '',
    address: normalized.address || ''
  };
};

const getSection = async (section) => {
  if (section === 'organization') {
    const record = await Config.findByPk(configKey(section));
    const configured = record ? parseValue(record) : parseValue(await Config.findByPk('system'));
    return resolveOrganizationSettings(configured);
  }

  const record = await Config.findByPk(configKey(section));
  if (section === 'notifications' && !record) return defaultNotificationSettings;
  if (section === 'assets' && !record) return defaultAssetSettings;
  if (record) return parseValue(record);
  if (section === 'security') return parseValue(await Config.findByPk('security'));
  return {};
};

const validateSection = (section, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Settings data must be an object';
  if (section === 'organization') {
    const normalized = normalizeOrganizationSettings(data);
    if (normalized.contact_email && !/^\S+@\S+\.\S+$/.test(String(normalized.contact_email))) return 'Invalid organization email';
    if (normalized.website) { try { const parsed = new URL(String(normalized.website)); if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported protocol'); } catch { return 'Invalid organization website URL'; } }
    if (normalized.organization_code && String(normalized.organization_code).length > 32) return 'Organization code must be 32 characters or fewer';
    return null;
  }
  if (section === 'security') {
    const minimum = Number(data.minPass ?? data.password_min_length ?? 8);
    const attempts = Number(data.maxAttempts ?? data.max_login_attempts ?? 5);
    if (!Number.isInteger(minimum) || minimum < 6 || minimum > 64) return 'Minimum password length must be between 6 and 64';
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) return 'Maximum login attempts must be between 1 and 20';
  }
  if (section === 'notifications') {
    if (typeof data.enabled !== 'boolean' || typeof data.inAppEnabled !== 'boolean' || typeof data.emailEnabled !== 'boolean') return 'Notification enablement values must be boolean';
    if (data.events !== undefined && (typeof data.events !== 'object' || Array.isArray(data.events))) return 'Notification events must be an object';
    for (const [event, rule] of Object.entries(data.events || {})) {
      if (!defaultEventRules[event]) return `Unsupported notification event: ${event}`;
      if (!rule || typeof rule !== 'object' || typeof rule.enabled !== 'boolean' || typeof rule.inApp !== 'boolean' || typeof rule.email !== 'boolean') return `Invalid configuration for notification event: ${event}`;
    }
  }
  if (section === 'assets') {
    const prefix = String(data.prefix || defaultAssetSettings.prefix).trim();
    const categoryCode = String(data.categoryCode || data.category || defaultAssetSettings.categoryCode).trim();
    const sequenceLength = Number(data.sequenceLength ?? data.sequence_length ?? defaultAssetSettings.sequenceLength);
    const startNumber = Number(data.startNumber ?? data.start_number ?? defaultAssetSettings.startNumber);
    if (!prefix || prefix.length > 12) return 'Asset prefix must be a non-empty value up to 12 characters';
    if (!categoryCode || categoryCode.length > 12) return 'Asset category code must be a non-empty value up to 12 characters';
    if (!Number.isInteger(sequenceLength) || sequenceLength < 3 || sequenceLength > 12) return 'Asset sequence length must be an integer between 3 and 12';
    if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber > 999999) return 'Asset starting number must be an integer between 1 and 999999';
  }
  return null;
};

router.get('/settings', ...requireSettingsView, async (req, res, next) => {
  try {
    const values = await Promise.all(sections.map(async (section) => [section, await getSection(section)]));
    const settings = Object.fromEntries(values);
    if (settings.notifications) settings.notifications = { ...defaultNotificationSettings, ...settings.notifications, events: { ...defaultEventRules, ...(settings.notifications.events || {}) }, emailStatus: require('../services/emailService').validateEmailConfiguration() };
    return res.json({ success: true, data: settings, settings });
  } catch (error) { next(error); }
});

router.get('/settings/profile', ...requireSettingsView, async (req, res, next) => {
  try { const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } }); return res.json({ success: true, data: user }); } catch (error) { next(error); }
});

router.put('/settings/profile', ...requireSettingsUpdate, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'Administrator profile not found' });
    const updates = {};
    for (const field of ['fullName', 'email', 'phone']) if (req.body[field] !== undefined) updates[field] = String(req.body[field]).trim();
    if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email)) return res.status(400).json({ success: false, message: 'Invalid email address' });
    await user.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'ADMIN_PROFILE_UPDATED', entity: `user:${user.id}`, details: JSON.stringify({ changed: Object.keys(updates) }) });
    const safe = await User.findByPk(user.id, { attributes: { exclude: ['password'] } });
    return res.json({ success: true, data: safe });
  } catch (error) { next(error); }
});

router.post('/settings/profile/change-password', ...requireSettingsUpdate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user || !currentPassword || !newPassword || !(await bcrypt.compare(currentPassword, user.password))) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    if (String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    await user.update({ password: await bcrypt.hash(newPassword, 10), sessionVersion: (user.sessionVersion || 0) + 1, forcePasswordChange: false });
    await AuditLog.create({ userId: req.user.id, action: 'ADMIN_PASSWORD_CHANGED', entity: `user:${user.id}`, details: JSON.stringify({ sessionInvalidated: true }) });
    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) { next(error); }
});

router.get('/system/health', ...requireSettingsView, async (req, res, next) => {
  try {
    const startedAt = Date.now();
    let database = 'unavailable';
    try { await require('../models').sequelize.authenticate(); database = 'connected'; } catch (error) { database = 'unavailable'; }
    let storage = { status: 'not_measured', reason: 'Storage telemetry is not configured' };
    try {
      const stat = await require('fs').promises.statfs(require('path').join(__dirname, '..'));
      storage = {
        status: 'measured',
        freeBytes: stat.bavail * stat.bsize,
        totalBytes: stat.blocks * stat.bsize,
        freeSpace: Math.round(((stat.bavail * stat.bsize) / (1024 * 1024 * 1024)) * 10) / 10,
        totalSpace: Math.round(((stat.blocks * stat.bsize) / (1024 * 1024 * 1024)) * 10) / 10,
      };
    } catch (error) {
      storage = { status: 'not_measured', reason: 'Disk telemetry unavailable' };
    }
    return res.json({ success: true, data: { api: { status: 'request_succeeded', checkedAt: new Date().toISOString(), responseTimeMs: Date.now() - startedAt }, database: { status: database, checkedAt: new Date().toISOString() }, storage, uptime: { status: 'online', seconds: Math.floor(process.uptime()), checkedAt: new Date().toISOString() } } });
  } catch (error) { next(error); }
});

router.get('/system/integrity', ...requireSettingsView, async (req, res, next) => {
  try {
    const { Asset, User, Department } = require('../models');
    const [orphanUsers, orphanAssets, unassignedDepartments] = await Promise.all([
      User.count({ where: { departmentId: null } }),
      Asset.count({ where: { departmentId: null } }),
      Department.count({ where: { collegeId: null } }),
    ]);
    return res.json({ success: true, data: { checks: [{ issue: 'Users without department', count: orphanUsers }, { issue: 'Assets without department', count: orphanAssets }, { issue: 'Departments without college', count: unassignedDepartments }], checkedAt: new Date().toISOString() } });
  } catch (error) { next(error); }
});

router.get('/settings/:section', ...requireSettingsView, async (req, res, next) => {
  try {
    if (!sections.includes(req.params.section)) return res.status(404).json({ success: false, message: 'Settings section not found' });
    const settings = await getSection(req.params.section);
    const response = req.params.section === 'notifications' ? { ...defaultNotificationSettings, ...settings, events: { ...defaultEventRules, ...(settings.events || {}) }, emailStatus: require('../services/emailService').validateEmailConfiguration() } : settings;
    return res.json({ success: true, data: response, settings: response });
  } catch (error) { next(error); }
});

router.put('/settings/:section', ...requireSettingsUpdate, async (req, res, next) => {
  try {
    const section = req.params.section;
    if (!sections.includes(section)) return res.status(404).json({ success: false, message: 'Settings section not found' });
    const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : req.body;
    const validationError = validateSection(section, data);
    if (validationError) return res.status(400).json({ success: false, message: validationError, errors: [validationError] });

    const previous = await getSection(section);
    const nextSettings = section === 'organization'
      ? resolveOrganizationSettings({ ...normalizeOrganizationSettings(previous), ...normalizeOrganizationSettings(data) })
      : section === 'notifications'
        ? { ...defaultNotificationSettings, ...previous, ...data, events: { ...defaultEventRules, ...(previous.events || {}), ...(data.events || {}) } }
      : { ...previous, ...data };

    const persisted = section === 'organization'
      ? normalizeOrganizationSettings(nextSettings)
      : nextSettings;

    await sequelize.transaction(async (transaction) => {
      const [record] = await Config.findOrCreate({ where: { key: configKey(section) }, defaults: { key: configKey(section), value: JSON.stringify(persisted) }, transaction });
      if (record.value !== JSON.stringify(persisted)) await record.update({ value: JSON.stringify(persisted) }, { transaction });
      await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_SECTION_UPDATED', entity: `settings:${section}`, details: JSON.stringify({ changed: Object.keys(data), previous: redact(previous), next: redact(nextSettings) }) }, { transaction });
    });
    return res.json({ success: true, message: 'Settings updated successfully', data: nextSettings, settings: nextSettings });
  } catch (error) { next(error); }
});

module.exports = router;
module.exports.normalizeOrganizationSettings = normalizeOrganizationSettings;
module.exports.resolveOrganizationSettings = resolveOrganizationSettings;
