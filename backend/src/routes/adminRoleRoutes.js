const express = require('express');
const { Config, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const CORE_ROLES = ['admin', 'ict_officer', 'college', 'department_head', 'finance', 'store_manager', 'maintenance', 'infrastructure', 'staff', 'student'];
const PERMISSIONS = [
  'users.view', 'users.create', 'users.update', 'users.activate', 'users.deactivate', 'users.lock', 'users.unlock',
  'roles.view', 'roles.manage', 'permissions.view', 'permissions.manage',
  'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'assets.dispose',
  'colleges.view', 'colleges.manage', 'departments.view', 'departments.manage', 'locations.view', 'locations.manage',
  'notifications.view', 'notifications.manage', 'reports.view', 'reports.export', 'audit.view', 'audit.export',
  'settings.view', 'settings.manage', 'system.monitor', 'backup.manage', 'financial.view', 'maintenance.view', 'rfid.view',
];
const defaultPermissions = { admin: PERMISSIONS, ict_officer: ['users.view', 'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'rfid.view', 'maintenance.view', 'reports.view'], college: ['assets.view', 'assets.assign', 'departments.view', 'users.view', 'reports.view'], department_head: ['assets.view', 'assets.assign', 'users.view', 'reports.view'], finance: ['assets.view', 'financial.view', 'reports.view'], store_manager: ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'reports.view'], maintenance: ['assets.view', 'maintenance.view', 'reports.view'], infrastructure: ['assets.view', 'reports.view'], staff: ['assets.view'], student: ['assets.view'] };
const readMatrix = async () => { const record = await Config.findByPk('role_permissions'); try { return { ...defaultPermissions, ...(record ? JSON.parse(record.value || '{}') : {}) }; } catch { return defaultPermissions; } };

router.get('/roles', ...requireAdmin, async (req, res, next) => {
  try {
    const matrix = await readMatrix();
    const roles = await Promise.all(CORE_ROLES.map(async (role) => ({ id: role, name: role, displayName: role.replace(/_/g, ' '), system: true, status: 'active', permissions: matrix[role] || [], users: await User.count({ where: { role } }) })));
    return res.json({ success: true, data: roles, roles, total: roles.length });
  } catch (error) { next(error); }
});

router.get('/permissions', ...requireAdmin, async (req, res, next) => {
  try { return res.json({ success: true, data: PERMISSIONS.map((name) => ({ name, module: name.split('.')[0], action: name.split('.')[1], status: 'active' })), permissions: PERMISSIONS, total: PERMISSIONS.length }); } catch (error) { next(error); }
});

router.get('/roles/:role/users', ...requireAdmin, async (req, res, next) => {
  try { if (!CORE_ROLES.includes(req.params.role)) return res.status(404).json({ success: false, message: 'Core role not found' }); const users = await User.findAll({ where: { role: req.params.role }, attributes: ['id', 'username', 'fullName', 'email', 'active', 'collegeId', 'departmentId'], order: [['fullName', 'ASC']] }); return res.json({ success: true, data: users }); } catch (error) { next(error); }
});

router.put('/roles/:role/permissions', ...requireAdmin, async (req, res, next) => {
  try {
    const role = String(req.params.role).toLowerCase();
    if (!CORE_ROLES.includes(role)) return res.status(404).json({ success: false, message: 'Core role not found' });
    const permissions = [...new Set((req.body.permissions || []).map(String))];
    const invalid = permissions.filter((permission) => !PERMISSIONS.includes(permission));
    if (invalid.length) return res.status(400).json({ success: false, message: 'Unknown permissions supplied', errors: invalid });
    if (role === 'admin' && (!permissions.includes('roles.manage') || !permissions.includes('permissions.manage') || !permissions.includes('settings.manage'))) return res.status(400).json({ success: false, message: 'The administrator role must retain governance permissions' });
    const previous = await readMatrix();
    const next = { ...previous, [role]: permissions };
    const [record] = await Config.findOrCreate({ where: { key: 'role_permissions' }, defaults: { key: 'role_permissions', value: JSON.stringify(next) } });
    if (record.value !== JSON.stringify(next)) await record.update({ value: JSON.stringify(next) });
    await AuditLog.create({ userId: req.user.id, action: 'ROLE_PERMISSIONS_UPDATED', entity: `role:${role}`, details: JSON.stringify({ role, previous: previous[role] || [], next: permissions }) });
    return res.json({ success: true, data: { role, permissions } });
  } catch (error) { next(error); }
});

module.exports = router;
