const { Op } = require('sequelize');
const { College, Department } = require('../models');
const { requireAuth, requireRole } = require('./auth');

const requireCollegeManager = [requireAuth, requireRole('college')];
const requireDepartmentHead = [requireAuth, requireRole('department_head')];

const findCollegeIdFromDepartmentName = async (departmentName) => {
  const name = String(departmentName || '').trim();
  if (!name) return null;
  const department = await Department.findOne({
    where: { name, status: 'active' },
    attributes: ['collegeId'],
  });
  return department?.collegeId ?? null;
};

const findDepartmentFromName = async (departmentName) => {
  const name = String(departmentName || '').trim();
  if (!name) return null;
  return Department.findOne({ where: { name, status: 'active' } });
};

const resolveCollegeScope = async (req, res, next) => {
  const requestedCollegeId = req.user?.collegeId ?? req.user?.college_id ?? null;
  if (!requestedCollegeId) {
    const fallbackCollegeId = await findCollegeIdFromDepartmentName(req.user?.department || req.user?.department_name || '');
    if (!fallbackCollegeId) {
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }
    req.user.collegeId = fallbackCollegeId;
  }

  const college = await College.findOne({ where: { id: req.user.collegeId, status: 'active' } });
  if (!college) return res.status(403).json({ success: false, message: 'Authorized college was not found or is inactive' });
  req.organizationScope = { college, collegeId: college.id };
  return next();
};

const resolveDepartmentScope = async (req, res, next) => {
  const requestedDepartmentId = req.user?.departmentId ?? req.user?.department_id ?? null;
  if (!requestedDepartmentId) {
    const fallbackDepartment = await findDepartmentFromName(req.user?.department || req.user?.department_name || '');
    if (!fallbackDepartment) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    req.user.departmentId = fallbackDepartment.id;
  }

  const department = await Department.findOne({ where: { id: req.user.departmentId, status: 'active' } });
  if (!department) return res.status(403).json({ success: false, message: 'Authorized department was not found or is inactive' });
  req.organizationScope = { department, departmentId: department.id, collegeId: department.collegeId };
  return next();
};

const departmentIdsForCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByDepartment = (departmentId) => ({ departmentId: Number(departmentId) });

module.exports = { requireCollegeManager, requireDepartmentHead, resolveCollegeScope, resolveDepartmentScope, departmentIdsForCollege, scopeByCollege, scopeByDepartment, Op };
