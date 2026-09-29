const passport = require('../config/passport');

const COLLEGE_MANAGER_PERMISSIONS = [
  'college.dashboard.view',
  'college.profile.view',
  'college.profile.update',
  'college.staff.view',
  'college.locations.view',
  'college.locations.manage',
  'college.departments.view',
  'college.assets.view',
  'college.assets.create',
  'college.assets.update',
  'college.assets.export',
  'college.assets.delete',
  'college.assets.restore',
  'college.documents.manage',
  'college.history.view',
  'college.grants.view',
  'college.inventory.view',
  'college.chemicals.view',
  'college.requests.view',
  'college.requests.review',
  'college.approvals.view',
  'college.approvals.approve',
  'college.approvals.reject',
  'college.approvals.request_changes',
  'college.approvals.escalate',
  'college.assignments.view',
  'college.assignments.manage',
  'college.transfers.view',
  'college.transfers.manage',
  'college.returns.view',
  'college.returns.manage',
  'college.maintenance.view',
  'college.service.view',
  'college.rfid.view',
  'college.verification.view',
  'college.verification.manage',
  'college.reports.view',
  'college.reports.export',
  'college.analytics.view',
  'college.notifications.view',
];

const ROLE_PERMISSIONS = {
  admin: ['*'],
  ict_officer: ['*'],
  college_manager: [...COLLEGE_MANAGER_PERMISSIONS],
  college: [...COLLEGE_MANAGER_PERMISSIONS],
  department_head: ['*'],
  finance: ['*'],
  store_manager: ['*'],
  maintenance: ['*'],
  infrastructure: ['*'],
  staff: ['*'],
  student: ['*'],
};

const normalizeRoleValue = (role) => {
  if (!role) return '';
  const value = String(role).trim().toLowerCase();
  if (['department head', 'dept_head', 'department-head', 'department'].includes(value)) return 'department_head';
  if (['college manager', 'college-manager', 'college_manager', 'college'].includes(value)) return 'college_manager';
  if (['infrastructure director', 'infrastructure directorate', 'infrastructure_directorate', 'infrastructure-directorate', 'infra'].includes(value)) return 'infrastructure';
  return value;
};

const normalizePermissionValue = (permission) => String(permission || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '.')
  .replace(/[_-]+/g, '.')
  .replace(/\.+/g, '.')
  .replace(/^\.|\.$/g, '');

const resolveUserPermissions = (user) => {
  if (!user) return [];

  const role = normalizeRoleValue(user.role);
  const explicitPermissions = Array.isArray(user.permissions) ? user.permissions : [];
  const rolePermissions = Array.isArray(user.rolePermissions) ? user.rolePermissions : (ROLE_PERMISSIONS[role] || []);
  const basePermissions = explicitPermissions.length > 0 ? explicitPermissions : rolePermissions;
  const merged = [...new Set(basePermissions.map(normalizePermissionValue).filter(Boolean))];
  return merged;
};

const requireAuth = (req, res, next) => {
  return passport.authenticate('jwt', { session: false })(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const normalizedRole = normalizeRoleValue(req.user.role);
    req.user.role = normalizedRole;
    req.user.permissions = resolveUserPermissions(req.user);

    if (req.user.active === false || req.user.active === 0 || req.user.status === 'disabled' || req.user.status === 'suspended' || req.user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'This account is not active.' });
    }

    return next();
  });
};

const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const isActive = req.user.active !== false && req.user.active !== 0 && !['disabled', 'suspended', 'blocked'].includes(String(req.user.status || '').toLowerCase());
  if (!isActive) {
    return res.status(403).json({ success: false, message: 'This account is not active.' });
  }

  return next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const normalizedUserRole = normalizeRoleValue(req.user.role);
  const allowedRoles = new Set(roles.map(normalizeRoleValue));

  if (roles.length && !allowedRoles.has(normalizedUserRole)) {
    return res.status(403).json({ success: false, message: 'Access denied for this role' });
  }

  req.user.role = normalizedUserRole;
  req.user.permissions = resolveUserPermissions(req.user);
  return next();
};

const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const permissionSet = new Set(resolveUserPermissions(req.user).map(normalizePermissionValue));
  const requiredPermissions = permissions.map(normalizePermissionValue).filter(Boolean);
  const missingPermission = requiredPermissions.find((permission) => !permissionSet.has(permission) && !permissionSet.has('*'));

  if (missingPermission) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  }

  return next();
};

module.exports = { requireAuth, requireActiveAccount, requireRole, requirePermission, normalizeRoleValue, normalizePermissionValue, resolveUserPermissions };
