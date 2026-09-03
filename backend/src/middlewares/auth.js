const passport = require('../config/passport');

const normalizeRoleValue = (role) => {
  if (!role) return '';
  const value = String(role).trim().toLowerCase();
  if (['department_head', 'department head', 'dept_head', 'department-head', 'department'].includes(value)) {
    return 'college';
  }
  return value;
};

const requireAuth = passport.authenticate('jwt', { session: false });

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
  return next();
};

module.exports = { requireAuth, requireRole };
