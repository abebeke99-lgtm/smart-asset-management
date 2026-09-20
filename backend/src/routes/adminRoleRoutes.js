const express = require('express');
const { Config, User, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const CORE_ROLES = ['admin', 'ict_officer', 'college', 'department_head', 'finance', 'store_manager', 'maintenance', 'infrastructure', 'staff', 'student'];
const PERMISSIONS = [
  'users.view', 'users.create', 'users.update', 'users.delete', 'users.activate', 'users.deactivate', 'users.lock', 'users.unlock',
  'roles.view', 'roles.manage', 'permissions.view', 'permissions.manage',
  'assets.view', 'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.transfer', 'assets.return', 'assets.dispose',
  'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement',
  'colleges.view', 'colleges.manage', 'departments.view', 'departments.manage', 'locations.view', 'locations.manage',
  'notifications.view', 'notifications.manage', 'reports.view', 'reports.generate', 'reports.export', 'reports.print',
  'audit.view', 'audit.export',
  'settings.view', 'settings.manage', 'system.monitor', 'backup.manage', 'backup.restore',
  'financial.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'rfid.view',
];
const PERMISSION_ALIASES = {
  ...Object.fromEntries(PERMISSIONS.flatMap((permission) => {
    const [module, action] = permission.split('.');
    const dotted = `${module}.${action}`;
    return dotted === permission ? [[`${module}_${action}`, permission]] : [];
  })),
  view_assets: 'assets.view',
  create_asset: 'assets.create',
  edit_asset: 'assets.update',
  delete_asset: 'assets.delete',
  assign_asset: 'assets.assign',
  transfer_asset: 'assets.transfer',
  return_asset: 'assets.return',
  view_inventory: 'inventory.view',
  stock_in: 'inventory.stock_in',
  stock_out: 'inventory.stock_out',
  stock_movement: 'inventory.stock_movement',
  view_requests: 'maintenance.view',
  create_request: 'maintenance.request.create',
  assign_technician: 'maintenance.technician.assign',
  update_maintenance: 'maintenance.update',
  complete_maintenance: 'maintenance.complete',
  view_users: 'users.view',
  create_user: 'users.create',
  edit_user: 'users.update',
  delete_user: 'users.delete',
  activate_deactivate: 'users.activate',
  manage_roles: 'roles.manage',
  manage_permissions: 'permissions.manage',
  view_reports: 'reports.view',
  generate_reports: 'reports.generate',
  export_reports: 'reports.export',
  print_reports: 'reports.print',
  settings: 'settings.manage',
  backup: 'backup.manage',
  restore: 'backup.restore',
  audit_logs: 'audit.view',
};
const defaultPermissions = { admin: PERMISSIONS, ict_officer: ['users.view', 'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'inventory.view', 'maintenance.view', 'maintenance.update', 'reports.view', 'reports.generate', 'rfid.view'], college: ['assets.view', 'assets.assign', 'departments.view', 'users.view', 'reports.view'], department_head: ['assets.view', 'assets.assign', 'users.view', 'reports.view'], finance: ['assets.view', 'financial.view', 'reports.view', 'reports.generate', 'reports.export', 'reports.print'], store_manager: ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement', 'rfid.view', 'reports.view'], maintenance: ['assets.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'reports.view'], infrastructure: ['assets.view', 'reports.view'], staff: ['assets.view'], student: ['assets.view'] };
const readMatrix = async () => { const record = await Config.findByPk('role_permissions'); try { return { ...defaultPermissions, ...(record ? JSON.parse(record.value || '{}') : {}) }; } catch { return defaultPermissions; } };
const normalizePermission = (permission) => PERMISSION_ALIASES[permission] || permission;

router.get('/roles', ...requireAdmin, async (req, res, next) => {
  try {
    const matrix = await readMatrix();
    const roles = await Promise.all(CORE_ROLES.map(async (role) => ({ id: role, name: role, displayName: role.replace(/_/g, ' '), system: true, status: 'active', permissions: (matrix[role] || []).map(normalizePermission), users: await User.count({ where: { role } }) })));
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
    const permissions = [...new Set((req.body.permissions || []).map(String).map(normalizePermission))];
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