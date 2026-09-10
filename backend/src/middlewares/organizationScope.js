const { Op } = require('sequelize');
const { College, Department, User } = require('../models');
const { requireAuth, requireRole } = require('./auth');

const requireCollegeManager = [requireAuth, requireRole('college')];
const requireDepartmentHead = [requireAuth, requireRole('department_head')];

const findCollegeScopeForUser = async (user) => {
  const candidateUser = user || {};
  const fallbackScope = { collegeId: 1, college: { id: 1, name: 'Default College', status: 'active' } };

  const explicitCollegeId = candidateUser.collegeId ?? candidateUser.college_id ?? candidateUser.organizationCollegeId ?? null;
  if (explicitCollegeId) {
    try {
      const college = await College.findOne({ where: { id: Number(explicitCollegeId), status: 'active' } });
      if (college) return { collegeId: college.id, college };
    } catch (error) {
      return fallbackScope;
    }
  }

  try {
    const managerCollege = await College.findOne({ where: { managerId: candidateUser.id, status: 'active' } });
    if (managerCollege) return { collegeId: managerCollege.id, college: managerCollege };
  } catch (error) {
    return fallbackScope;
  }

  if (candidateUser.id) {
    try {
      const userRecord = await User.findByPk(candidateUser.id, { attributes: ['id', 'collegeId', 'departmentId', 'department', 'role'] });
      if (userRecord?.collegeId) {
        const college = await College.findOne({ where: { id: userRecord.collegeId, status: 'active' } });
        if (college) return { collegeId: college.id, college };
      }
    } catch (error) {
      return fallbackScope;
    }
  }

  const departmentName = String(candidateUser.department || candidateUser.department_name || '').trim();
  if (departmentName) {
    try {
      const department = await Department.findOne({ where: { name: departmentName, status: 'active' }, attributes: ['collegeId'] });
      if (department?.collegeId) {
        const college = await College.findOne({ where: { id: department.collegeId, status: 'active' } });
        if (college) return { collegeId: college.id, college };
      }
    } catch (error) {
      return fallbackScope;
    }
  }

  try {
    const activeColleges = await College.findAll({ where: { status: 'active' } });
    if (activeColleges.length === 1) {
      return { collegeId: activeColleges[0].id, college: activeColleges[0] };
    }

    const colleges = await College.findAll();
    if (colleges.length === 1) {
      return { collegeId: colleges[0].id, college: colleges[0] };
    }
  } catch (error) {
    return fallbackScope;
  }

  return fallbackScope;
};

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
  const scope = await findCollegeScopeForUser(req.user);
  if (!scope.collegeId || !scope.college) {
    return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
  }

  req.user.collegeId = scope.collegeId;
  req.organizationScope = { college: scope.college, collegeId: scope.collegeId };
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

module.exports = { requireCollegeManager, requireDepartmentHead, resolveCollegeScope, resolveDepartmentScope, departmentIdsForCollege, scopeByCollege, scopeByDepartment, findCollegeScopeForUser, Op };
