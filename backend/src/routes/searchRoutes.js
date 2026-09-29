const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope, resolveDepartmentScope } = require('../middlewares/organizationScope');
const College = require('../models/College');
const { globalSearch } = require('../controllers/globalSearchController');

const router = express.Router();
const allowedRoles = ['admin', 'college', 'department_head', 'store_manager', 'ict_officer', 'maintenance', 'infrastructure', 'finance'];

const resolveSearchScope = async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (req.user.role === 'college' || req.user.role === 'ict_officer') return resolveCollegeScope(req, res, next);
  if (req.user.role === 'department_head') return resolveDepartmentScope(req, res, next);
  if (req.user.role === 'store_manager') {
    try {
      let collegeId = Number(req.user.collegeId ?? req.user.college_id);
      if (!collegeId) {
        const colleges = await College.findAll({ attributes: ['id'], order: [['id', 'ASC']], limit: 2 });
        if (colleges.length !== 1) return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
        collegeId = Number(colleges[0].id);
      }
      if (!Number.isSafeInteger(collegeId) || collegeId < 1) return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' });
      req.organizationScope = { collegeId, departmentId: null };
      return next();
    } catch (error) {
      return next(error);
    }
  }
  req.organizationScope = {
    collegeId: req.user.collegeId ?? req.user.college_id ?? null,
    departmentId: req.user.departmentId ?? req.user.department_id ?? null,
  };
  return next();
};

router.get('/', requireAuth, requireRole(...allowedRoles), resolveSearchScope, globalSearch);

module.exports = router;