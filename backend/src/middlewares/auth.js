const passport = require('../config/passport');
const { DEFAULT_ROLE_PERMISSIONS, getConfiguredRolePermissions } = require('../services/rolePermissionService');

const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

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
  const basePermissions = Array.isArray(user.permissions) ? explicitPermissions : rolePermissions;
  const merged = [...new Set(basePermissions.map(normalizePermissionValue).filter(Boolean))];
  return merged;
};

const requireAuth = (req, res, next) => {
  return passport.authenticate('jwt', { session: false })(req, res, async () => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const normalizedRole = normalizeRoleValue(req.user.role);
    req.user.role = normalizedRole;
    const configuredPermissions = await getConfiguredRolePermissions(normalizedRole);
    if (configuredPermissions !== null) req.user.rolePermissions = configuredPermissions;
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
