const express = require('express');
const bcrypt = require('bcryptjs');
const { Config, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const sections = ['organization', 'account', 'security', 'roles', 'notifications', 'localization', 'assets', 'workflow', 'rfid', 'maintenance', 'financial', 'reports', 'audit', 'monitoring', 'integrations', 'backup', 'maintenance_sys'];
const sensitiveKeys = /password|secret|token|api.?key|private.?key|credential/i;
const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitiveKeys.test(key) ? '[configured]' : redact(item)]));
};
const parseValue = (record) => { try { return record ? JSON.parse(record.value || '{}') : {}; } catch { return {}; } };
const configKey = (section) => `settings:${section}`;

const getSection = async (section) => {
  const record = await Config.findByPk(configKey(section));
  if (record) return parseValue(record);
  if (section === 'organization') return parseValue(await Config.findByPk('system'));
  if (section === 'security') return parseValue(await Config.findByPk('security'));
  return {};
};

const validateSection = (section, data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'Settings data must be an object';
  if (section === 'organization' && data.email && !/^\S+@\S+\.\S+$/.test(String(data.email))) return 'Invalid organization email';
  if (section === 'organization' && data.website) { try { new URL(String(data.website)); } catch { return 'Invalid organization website URL'; } }
  if (section === 'security') {
    const minimum = Number(data.minPass ?? data.password_min_length ?? 8);
    const attempts = Number(data.maxAttempts ?? data.max_login_attempts ?? 5);
    if (!Number.isInteger(minimum) || minimum < 6 || minimum > 64) return 'Minimum password length must be between 6 and 64';
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 20) return 'Maximum login attempts must be between 1 and 20';
  }
  return null;
};

router.get('/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const values = await Promise.all(sections.map(async (section) => [section, await getSection(section)]));
    return res.json({ success: true, data: Object.fromEntries(values), settings: Object.fromEntries(values) });
  } catch (error) { next(error); }
});

router.get('/settings/profile', ...requireAdmin, async (req, res, next) => {
  try { const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } }); return res.json({ success: true, data: user }); } catch (error) { next(error); }
});

router.put('/settings/profile', ...requireAdmin, async (req, res, next) => {
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

router.post('/settings/profile/change-password', ...requireAdmin, async (req, res, next) => {
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

router.get('/system/health', ...requireAdmin, async (req, res, next) => {
  try {
    const startedAt = Date.now();
    let database = 'unavailable';
    try { await require('../models').sequelize.authenticate(); database = 'connected'; } catch (error) { database = 'unavailable'; }
    return res.json({ success: true, data: { api: { status: 'request_succeeded', checkedAt: new Date().toISOString(), responseTimeMs: Date.now() - startedAt }, database: { status: database, checkedAt: new Date().toISOString() }, storage: { status: 'not_measured', reason: 'Storage telemetry is not configured' }, uptime: { status: 'not_measured', reason: 'Historical uptime telemetry is not configured' } } });
  } catch (error) { next(error); }
});

router.get('/system/integrity', ...requireAdmin, async (req, res, next) => {
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

router.get('/settings/:section', ...requireAdmin, async (req, res, next) => {
  try {
    if (!sections.includes(req.params.section)) return res.status(404).json({ success: false, message: 'Settings section not found' });
    const settings = await getSection(req.params.section);
    return res.json({ success: true, data: settings, settings });
  } catch (error) { next(error); }
});

router.put('/settings/:section', ...requireAdmin, async (req, res, next) => {
  try {
    const section = req.params.section;
    if (!sections.includes(section)) return res.status(404).json({ success: false, message: 'Settings section not found' });
    const data = req.body.data && typeof req.body.data === 'object' ? req.body.data : req.body;
    const validationError = validateSection(section, data);
    if (validationError) return res.status(400).json({ success: false, message: validationError, errors: [validationError] });
    const previous = await getSection(section);
    const nextSettings = { ...previous, ...data };
    const [record] = await Config.findOrCreate({ where: { key: configKey(section) }, defaults: { key: configKey(section), value: JSON.stringify(nextSettings) } });
    if (record.value !== JSON.stringify(nextSettings)) await record.update({ value: JSON.stringify(nextSettings) });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_SECTION_UPDATED', entity: `settings:${section}`, details: JSON.stringify({ changed: Object.keys(data), previous: redact(previous), next: redact(nextSettings) }) });
    return res.json({ success: true, message: 'Settings updated successfully', data: nextSettings, settings: nextSettings });
  } catch (error) { next(error); }
});

router.get('/settings/profile', ...requireAdmin, async (req, res, next) => {
  try { const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password'] } }); return res.json({ success: true, data: user }); } catch (error) { next(error); }
});

router.put('/settings/profile', ...requireAdmin, async (req, res, next) => {
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

router.post('/settings/profile/change-password', ...requireAdmin, async (req, res, next) => {
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

module.exports = router;
