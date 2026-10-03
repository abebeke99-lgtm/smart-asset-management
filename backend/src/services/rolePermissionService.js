const { Config } = require('../models');

const PERMISSIONS = [
  'users.view', 'users.create', 'users.update', 'users.delete', 'users.activate', 'users.deactivate', 'users.lock', 'users.unlock',
  'roles.view', 'roles.manage', 'permissions.view', 'permissions.manage',
  'assets.view', 'assets.create', 'assets.update', 'assets.delete', 'assets.assign', 'assets.transfer', 'assets.transfer.approve', 'assets.return', 'assets.dispose',
  'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement',
  'colleges.view', 'colleges.manage', 'departments.view', 'departments.manage', 'locations.view', 'locations.manage',
  'notifications.view', 'notifications.manage', 'reports.view', 'reports.generate', 'reports.export', 'reports.print',
  'audit.view', 'audit.export',
  'settings.view', 'settings.manage', 'system.monitor', 'backup.manage', 'backup.restore',
  'financial.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'rfid.view',
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: PERMISSIONS,
  ict_officer: ['users.view', 'assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'inventory.view', 'maintenance.view', 'maintenance.update', 'reports.view', 'reports.generate', 'rfid.view'],
  college: ['assets.view', 'assets.assign', 'assets.transfer', 'departments.view', 'users.view', 'reports.view'],
  college_manager: ['college.dashboard.view', 'college.profile.view', 'college.profile.update', 'college.staff.view', 'college.locations.view', 'college.locations.manage', 'college.departments.view', 'college.assets.view', 'college.assets.create', 'college.assets.update', 'college.assets.export', 'college.assets.delete', 'college.assets.restore', 'college.documents.manage', 'college.history.view', 'college.grants.view', 'college.inventory.view', 'college.chemicals.view', 'college.requests.view', 'college.requests.review', 'college.approvals.view', 'college.approvals.approve', 'college.approvals.reject', 'college.approvals.request_changes', 'college.approvals.escalate', 'college.assignments.view', 'college.assignments.manage', 'college.transfers.view', 'college.transfers.manage', 'assets.transfer', 'assets.transfer.approve', 'college.returns.view', 'college.returns.manage', 'college.maintenance.view', 'college.service.view', 'college.rfid.view', 'college.verification.view', 'college.verification.manage', 'college.reports.view', 'college.reports.export', 'college.analytics.view', 'college.notifications.view'],
  department_head: ['assets.view', 'assets.assign', 'assets.transfer', 'users.view', 'reports.view'],
  finance: ['assets.view', 'financial.view', 'reports.view', 'reports.generate', 'reports.export', 'reports.print'],
  store_manager: ['assets.view', 'assets.create', 'assets.update', 'assets.assign', 'assets.transfer', 'inventory.view', 'inventory.stock_in', 'inventory.stock_out', 'inventory.stock_movement', 'rfid.view', 'reports.view'],
  maintenance: ['assets.view', 'maintenance.view', 'maintenance.request.create', 'maintenance.technician.assign', 'maintenance.update', 'maintenance.complete', 'reports.view'],
  infrastructure: ['assets.view', 'reports.view'],
  staff: ['assets.view'],
  student: ['assets.view'],
};

const normalizeRoleName = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (['college', 'college manager', 'college-manager'].includes(normalized)) return 'college_manager';
  return normalized.replace(/[\s-]+/g, '_');
};

const getRolePermissionMatrix = async () => {
  try {
    const record = await Config.findByPk('role_permissions');
    if (!record?.value) return { ...DEFAULT_ROLE_PERMISSIONS };

    const matrix = JSON.parse(record.value);
    if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return { ...DEFAULT_ROLE_PERMISSIONS };
    return { ...DEFAULT_ROLE_PERMISSIONS, ...matrix };
  } catch {
    return { ...DEFAULT_ROLE_PERMISSIONS };
  }
};

const getConfiguredRolePermissions = async (role) => {
  const normalizedRole = normalizeRoleName(role);
  if (normalizedRole === 'admin') return ['*'];
  const matrix = await getRolePermissionMatrix();
  const permissions = matrix[normalizedRole];
  return Array.isArray(permissions) ? [...new Set(permissions.map(String))] : [];
};

module.exports = { DEFAULT_ROLE_PERMISSIONS, getConfiguredRolePermissions, getRolePermissionMatrix };