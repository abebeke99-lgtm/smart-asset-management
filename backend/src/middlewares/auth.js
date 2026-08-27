const passport = require('../config/passport');

const requireAuth = passport.authenticate('jwt', { session: false });

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  if (roles.length && !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Access denied for this role' });
  }

  return next();
};

module.exports = { requireAuth, requireRole };
