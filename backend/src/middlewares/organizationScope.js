const { Op } = require('sequelize');
const { College, Department, User } = require('../models');
const { requireAuth, requireRole, normalizeRoleValue } = require('./auth');

const normalizeCollegeRole = (role) => normalizeRoleValue(role);
const isCollegeScopedRole = (role) => ['college_manager', 'store_manager'].includes(normalizeRoleValue(role));
const getCollegeScopeId = (req) => {
  const collegeId = Number(req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id);
  return Number.isSafeInteger(collegeId) && collegeId > 0 ? collegeId : null;
};

const requireCollegeManager = [requireAuth, requireRole('college_manager', 'college')];
const requireDepartmentHead = [requireAuth, requireRole('department_head')];

const ensureDefaultCollegeForUser = async (candidateUser) => {
  if (!candidateUser || !candidateUser.id || normalizeCollegeRole(candidateUser.role) !== 'college_manager') {
    return null;
  }

  const baseName = String(candidateUser.department || candidateUser.department_name || 'Main College').trim() || 'Main College';
  const sanitizedName = baseName.replace(/\s+/g, ' ').trim();
  const collegeCode = `CLG-${String(sanitizedName).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'MAIN'}`;

  const existingCollege = await College.findOne({
    where: {
      [Op.or]: [
        { id: candidateUser.collegeId ?? candidateUser.college_id ?? null },
        { managerId: candidateUser.id },
        { collegeName: sanitizedName },
      ],
    },
    order: [['id', 'ASC']],
  });

  if (existingCollege) {
    if (!candidateUser.collegeId && !candidateUser.college_id) {
      await User.update({ collegeId: existingCollege.id }, { where: { id: candidateUser.id } });
    }
    return { collegeId: existingCollege.id, college: existingCollege };
  }

  const fallbackCollege = await College.create({
    collegeCode,
    collegeName: sanitizedName,
    managerId: candidateUser.id,
    description: `Auto-created college scope for ${candidateUser.fullName || candidateUser.username || 'college manager'}`,
    status: 'active',
  });

  await User.update({ collegeId: fallbackCollege.id }, { where: { id: candidateUser.id } });

  return { collegeId: fallbackCollege.id, college: fallbackCollege };
};

const findCollegeScopeForUser = async (user) => {
  const candidateUser = user || {};

  const explicitCollegeId = candidateUser.collegeId ?? candidateUser.college_id ?? candidateUser.organizationCollegeId ?? null;
  if (explicitCollegeId) {
    try {
      const college = await College.findOne({ where: { id: Number(explicitCollegeId), status: 'active' } });
      if (college) return { collegeId: college.id, college };
    } catch (error) { return null; }
  }

  try {
    const managerCollege = await College.findOne({ where: { managerId: candidateUser.id, status: 'active' } });
    if (managerCollege) return { collegeId: managerCollege.id, college: managerCollege };
  } catch (error) { return null; }

  if (candidateUser.id) {
    try {
      const userRecord = await User.findByPk(candidateUser.id, { attributes: ['id', 'collegeId', 'departmentId', 'department', 'role'] });
      if (userRecord?.collegeId) {
        const college = await College.findOne({ where: { id: userRecord.collegeId, status: 'active' } });
        if (college) return { collegeId: college.id, college };
      }
    } catch (error) { return null; }
  }

  const departmentName = String(candidateUser.department || candidateUser.department_name || '').trim();
  if (departmentName) {
    try {
      const department = await Department.findOne({ where: { name: departmentName, status: 'active' }, attributes: ['collegeId'] });
      if (department?.collegeId) {
        const college = await College.findOne({ where: { id: department.collegeId, status: 'active' } });
        if (college) return { collegeId: college.id, college };
      }
    } catch (error) { return null; }
  }

  try {
    const activeColleges = await College.findAll({ where: { status: 'active' }, order: [['id', 'ASC']] });
    if (activeColleges.length === 1) {
      return { collegeId: activeColleges[0].id, college: activeColleges[0] };
    }

    const colleges = await College.findAll({ order: [['id', 'ASC']] });
    if (colleges.length === 1) {
      return { collegeId: colleges[0].id, college: colleges[0] };
    }

    if (normalizeCollegeRole(candidateUser.role) === 'store_manager' && activeColleges.length > 0) {
      return { collegeId: activeColleges[0].id, college: activeColleges[0] };
    }
  } catch (error) { return null; }

  if (normalizeCollegeRole(candidateUser.role) === 'college_manager') {
    return ensureDefaultCollegeForUser(candidateUser);
  }

  return null;
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

const resolveCollegeScope = async (req, res, next) => {
  const scope = await findCollegeScopeForUser(req.user);
  if (!scope?.collegeId || !scope?.college) {
    return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
  }

  req.user.collegeId = scope.collegeId;
  req.organizationScope = { college: scope.college, collegeId: scope.collegeId };
  return next();
};

const resolveDepartmentScope = async (req, res, next) => {
  const requestedDepartmentId = req.user?.departmentId ?? req.user?.department_id ?? null;
  const isDepartmentProfileRequest = req.path === '/profile';
  const profileDepartmentId = Number(requestedDepartmentId);
  if (isDepartmentProfileRequest && (!Number.isSafeInteger(profileDepartmentId) || profileDepartmentId < 1)) {
    return res.status(404).json({ success: false, message: 'Department profile not found.' });
  }

  try {
    const department = isDepartmentProfileRequest
      ? await Department.findByPk(profileDepartmentId)
      : requestedDepartmentId
        ? await Department.findOne({ where: { id: requestedDepartmentId, status: 'active' } })
        : null;

    if (!department) {
      const status = isDepartmentProfileRequest ? 404 : 403;
      const message = isDepartmentProfileRequest ? 'Department profile not found.' : 'Department scope is not configured for this account';
      return res.status(status).json({ success: false, message });
    }

    req.user.departmentId = department.id;
    req.organizationScope = { department, departmentId: department.id, collegeId: department.collegeId };
    return next();
  } catch (error) {
    return next(error);
  }
};

const resolveConfiguredDepartmentScope = async (req, res, next) => {
  if (normalizeRoleValue(req.user?.role) !== 'department_head') return next();

  const departmentId = Number(req.user?.departmentId ?? req.user?.department_id);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
    return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  }

  try {
    const department = await Department.findByPk(departmentId, { attributes: ['id', 'collegeId'] });
    if (!department) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }

    req.organizationScope = {
      ...(req.organizationScope || {}),
      department,
      departmentId: department.id,
      collegeId: department.collegeId,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

const departmentIdsForCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByDepartment = (departmentId) => ({ departmentId: Number(departmentId) });

module.exports = { requireCollegeManager, requireDepartmentHead, resolveCollegeScope, resolveDepartmentScope, resolveConfiguredDepartmentScope, departmentIdsForCollege, scopeByCollege, scopeByDepartment, findCollegeScopeForUser, isCollegeScopedRole, getCollegeScopeId, Op };
