const { Op } = require('sequelize');
const { College, Department, User } = require('../models');
const { requireAuth, requireRole } = require('./auth');

const requireCollegeManager = [requireAuth, requireRole('college')];
const requireDepartmentHead = [requireAuth, requireRole('department_head')];

const ensureDefaultCollegeForUser = async (candidateUser) => {
  if (!candidateUser || !candidateUser.id || candidateUser.role !== 'college') {
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
    const activeColleges = await College.findAll({ where: { status: 'active' } });
    if (activeColleges.length === 1) {
      return { collegeId: activeColleges[0].id, college: activeColleges[0] };
    }

    const colleges = await College.findAll();
    if (colleges.length === 1) {
      return { collegeId: colleges[0].id, college: colleges[0] };
    }
  } catch (error) { return null; }

  if (candidateUser.role === 'college') {
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

const findDepartmentFromName = async (departmentName) => {
  const name = String(departmentName || '').trim();
  if (!name) return null;
  return Department.findOne({ where: { name, status: 'active' } });
};

const ensureDepartmentScopeForUser = async (user) => {
  if (!user || String(user.role).trim().toLowerCase() !== 'department_head') {
    return null;
  }

  const departmentName = String(user.department || user.department_name || 'Engineering').trim() || 'Engineering';
  let department = await findDepartmentFromName(departmentName);
  if (department) {
    return department;
  }

  const collegeScope = await findCollegeScopeForUser(user);
  const collegeId = collegeScope?.collegeId ?? null;
  const departmentCode = String(departmentName).slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEPT';

  try {
    department = await Department.create({
      name: departmentName,
      code: departmentCode,
      description: `Auto-created department scope for ${user.fullName || user.username || 'department head'}`,
      headId: user.id,
      collegeId,
      status: 'active',
    });
  } catch (error) {
    department = await findDepartmentFromName(departmentName);
    if (!department) throw error;
  }

  await User.update({ departmentId: department.id, collegeId: collegeId || null }, { where: { id: user.id } });
  return department;
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
  let department = requestedDepartmentId
    ? await Department.findOne({ where: { id: requestedDepartmentId, status: 'active' } })
    : null;

  if (!department) {
    department = await ensureDepartmentScopeForUser(req.user);
  }

  if (!department) {
    return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
  }

  req.user.departmentId = department.id;
  req.organizationScope = { department, departmentId: department.id, collegeId: department.collegeId };
  return next();
};

const departmentIdsForCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByCollege = (collegeId) => ({ collegeId: Number(collegeId) });
const scopeByDepartment = (departmentId) => ({ departmentId: Number(departmentId) });

module.exports = { requireCollegeManager, requireDepartmentHead, resolveCollegeScope, resolveDepartmentScope, departmentIdsForCollege, scopeByCollege, scopeByDepartment, findCollegeScopeForUser, Op };
