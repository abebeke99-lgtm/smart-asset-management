const passport = require('../config/passport');
const { Role } = require('../models');
const { DEFAULT_ROLE_PERMISSIONS, getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { normalizeRoleForStorage } = require('../constants/rolePermissions');
const { isAccountActive } = require('../utils/accountStatus');
const { getDatabasePermissionKeys } = require('./authorize');

const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;

const normalizeRoleValue = normalizeRoleForStorage;

const normalizePermissionValue = (permission) => String(permission || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '.')
  .replace(/[_-]+/g, '.')
  .replace(/\.+/g, '.')
  .replace(/^\.|\.$/g, '');
const isHighRiskPermission = (permission) => ['delete', 'approve', 'transfer', 'configure']
  .includes(normalizePermissionValue(permission).split('.').pop());

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
  return passport.authenticate('jwt', { session: false }, async (error, user) => {
    if (error) {
      return next(error);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    req.user = user;
    try {
      const normalizedRole = normalizeRoleValue(req.user.role);
      req.user.role = normalizedRole;
      const primaryRole = typeof req.user.setDataValue === 'function'
        ? await Role.findOne({ where: { name: normalizedRole } })
        : null;
      if (primaryRole && !primaryRole.active) {
        return res.status(403).json({ success: false, message: 'This role is inactive. Contact an administrator.' });
      }
      const configuredPermissions = await getConfiguredRolePermissions(normalizedRole);
      if (configuredPermissions !== null) req.user.rolePermissions = configuredPermissions;
      req.user.permissions = resolveUserPermissions(req.user);
      const databasePermissions = typeof req.user.setDataValue === 'function'
        ? await getDatabasePermissionKeys(req.user)
        : [];
      req.user.permissions = [...new Set([...req.user.permissions, ...databasePermissions])];
      if (typeof req.user.setDataValue === 'function') {
        req.user.setDataValue('permissions', req.user.permissions);
      }

      if (!isAccountActive(req.user.active) || ['disabled', 'suspended', 'blocked'].includes(String(req.user.status || '').toLowerCase())) {
        return res.status(403).json({ success: false, message: 'This account is not active.' });
      }

      return next();
    } catch (authorizationError) {
      return next(authorizationError);
    }
  })(req, res, next);
};

const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const isActive = isAccountActive(req.user.active) && !['disabled', 'suspended', 'blocked'].includes(String(req.user.status || '').toLowerCase());
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
  const missingPermission = requiredPermissions.find((permission) => (
    !permissionSet.has(permission)
    && (isHighRiskPermission(permission) || !permissionSet.has('*'))
  ));

  if (missingPermission) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  }

  return next();
};

const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const permissionSet = new Set(resolveUserPermissions(req.user).map(normalizePermissionValue));
  const requiredPermissions = permissions.map(normalizePermissionValue).filter(Boolean);
  if (!requiredPermissions.some((permission) => (
    permissionSet.has(permission) || (!isHighRiskPermission(permission) && permissionSet.has('*'))
  ))) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  }

  return next();
};

module.exports = { requireAuth, requireActiveAccount, requireRole, requirePermission, requireAnyPermission, normalizeRoleValue, normalizePermissionValue, resolveUserPermissions };
