const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const {
  sequelize,
  Asset,
  AssetCustody,
  Assignment,
  Department,
  User,
  UserActivityLog,
} = require('../models');
const { isValidUsername } = require('../utils/validators');
const { createAuditLog } = require('../services/auditLogService');

const safeUserAttributes = ['id', 'username', 'email', 'fullName', 'role', 'department', 'collegeId', 'departmentId', 'phone', 'active', 'status', 'forcePasswordChange', 'lastLoginAt', 'createdAt', 'updatedAt'];
const activeAssignmentStatuses = ['active', 'assigned', 'in_use', 'in-use', 'issued'];
const staffIncludes = [{ model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false }];

const getCollegeId = (req) => {
  const collegeId = Number(req.organizationScope?.collegeId);
  return Number.isSafeInteger(collegeId) && collegeId > 0 ? collegeId : null;
};

const pagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
};

const mapStaff = (user, assignedAssetsCount = 0) => {
  const value = user.toJSON();
  const { password, resetTokenHash, resetTokenExpiresAt, resetTokenUsedAt, resetOtpHash, resetOtpExpiresAt, resetOtpUsedAt, ...safe } = value;
  return {
    ...safe,
    staffId: safe.username,
    assignedAssetsCount,
    departmentRecord: safe.DepartmentRecord || null,
  };
};

const generateTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let generated = '';
  let hasNumber = false;
  let hasLetter = false;
  while (generated.length < 16 || !hasNumber || !hasLetter) {
    const character = alphabet[crypto.randomInt(alphabet.length)];
    generated += character;
    hasNumber ||= /\d/.test(character);
    hasLetter ||= /[A-Za-z]/.test(character);
  }
  return generated.slice(0, 16);
};

const validateStaffInput = async (req, transaction, existing = null) => {
  const body = req.body || {};
  const fullName = String(body.fullName ?? existing?.fullName ?? '').trim();
  const username = String(body.staffId ?? body.employeeNumber ?? body.username ?? existing?.username ?? '').trim();
  const email = String(body.email ?? existing?.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? existing?.phone ?? '').trim();
  const rawDepartmentId = body.departmentId ?? existing?.departmentId;
  const departmentId = rawDepartmentId === '' || rawDepartmentId == null ? null : Number(rawDepartmentId);

  if (!fullName || fullName.length > 255) return { error: 'Full name is required and must be 255 characters or fewer', status: 400 };
  if (!username || username.length > 100 || !isValidUsername(username)) return { error: 'Staff ID must be a valid username of 3 to 100 characters', status: 400 };
  if (email && (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return { error: 'Enter a valid email address', status: 400 };
  if (phone.length > 50 || (phone && !/^[+\d][\d\s().-]{5,49}$/.test(phone))) return { error: 'Enter a valid phone number of at most 50 characters', status: 400 };
  if (rawDepartmentId && (!Number.isSafeInteger(departmentId) || departmentId < 1)) return { error: 'Select a valid department', status: 400 };

  let department = null;
  if (departmentId) {
    department = await Department.findOne({
      where: { id: departmentId, collegeId: getCollegeId(req), status: 'active' },
      attributes: ['id', 'name'],
      transaction,
    });
    if (!department) return { error: 'Department is not active in your college', status: 400 };
  }

  const duplicateWhere = [{ username }];
  if (email) duplicateWhere.push({ email });
  const duplicate = await User.findOne({
    where: { collegeId: getCollegeId(req), role: 'staff', [Op.or]: duplicateWhere, ...(existing ? { id: { [Op.ne]: existing.id } } : {}) },
    attributes: ['id', 'username', 'email'],
    transaction,
  });
  if (duplicate) return { error: 'A staff account with this Staff ID or email already exists in your college', status: 409 };

  return {
    value: {
      fullName,
      username,
      email: email || null,
      phone,
      role: 'staff',
      collegeId: getCollegeId(req),
      departmentId: department?.id || null,
      department: department?.name || '',
    },
  };
};

const list = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const { page, limit, offset } = pagination(req.query);
    const where = { collegeId, role: 'staff' };
    if (req.query.departmentId) {
      const departmentId = Number(req.query.departmentId);
      const department = Number.isSafeInteger(departmentId)
        ? await Department.findOne({ where: { id: departmentId, collegeId }, attributes: ['id'] })
        : null;
      if (!department) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      where.departmentId = departmentId;
    }
    if (req.query.status) {
      const status = String(req.query.status).trim().toLowerCase();
      if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Status filter must be active or inactive' });
      where.active = status === 'active';
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      const term = { [Op.like]: `%${search}%` };
      where[Op.or] = [{ username: term }, { fullName: term }, { email: term }, { phone: term }];
    }
    const sortFields = new Set(['fullName', 'createdAt', 'department']);
    const sortBy = sortFields.has(String(req.query.sortBy)) ? String(req.query.sortBy) : 'fullName';
    const sortOrder = String(req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const order = sortBy === 'department'
      ? [[{ model: Department, as: 'DepartmentRecord' }, 'name', sortOrder], ['fullName', 'ASC']]
      : [[sortBy, sortOrder]];

    const [result, total, active, assignmentRows] = await Promise.all([
      User.findAndCountAll({ where, attributes: safeUserAttributes, include: staffIncludes, distinct: true, order, limit, offset }),
      User.count({ where: { collegeId, role: 'staff' } }),
      User.count({ where: { collegeId, role: 'staff', active: true } }),
      AssetCustody.findAll({
        where: { status: 'active' },
        attributes: ['custodianId'],
        include: [{ model: Asset, attributes: [], where: { collegeId }, required: true }],
        raw: true,
      }),
    ]);
    const activeAssignments = new Map();
    assignmentRows.forEach((row) => activeAssignments.set(Number(row.custodianId), (activeAssignments.get(Number(row.custodianId)) || 0) + 1));
    const data = result.rows.map((user) => mapStaff(user, activeAssignments.get(Number(user.id)) || 0));
    return res.json({
      success: true,
      data,
      summary: {
        total,
        active,
        inactive: total - active,
        activeAssetAssignments: assignmentRows.length,
        withAssignedAssets: activeAssignments.size,
      },
      filters: {
        departments: await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
        statuses: ['active', 'inactive'],
      },
      pagination: { page, limit, total: result.count, pages: Math.max(1, Math.ceil(result.count / limit)), totalPages: Math.max(1, Math.ceil(result.count / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const options = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    return res.json({
      success: true,
      data: {
        departments: await Department.findAll({ where: { collegeId, status: 'active' }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const detail = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    const staff = await User.findOne({
      where: { id: req.params.id, collegeId, role: 'staff' },
      attributes: safeUserAttributes,
      include: staffIncludes,
    });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found in this college' });
    const [custodyRows, activities] = await Promise.all([
      AssetCustody.findAll({
        where: { custodianId: staff.id },
        include: [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'condition', 'collegeId'], where: { collegeId }, required: true }],
        order: [['receivedDate', 'DESC']],
      }),
      UserActivityLog.findAll({ where: { userId: staff.id }, attributes: ['id', 'action', 'createdAt'], order: [['createdAt', 'DESC']], limit: 10 }),
    ]);
    const assignedAssets = custodyRows.map((row) => {
      const value = row.toJSON();
      return {
        id: value.id,
        status: value.status,
        assignmentDate: value.receivedDate,
        returnDate: value.returnedDate,
        notes: value.notes,
        asset: value.Asset ? { id: value.Asset.id, assetCode: value.Asset.assetCode, name: value.Asset.name, condition: value.Asset.condition } : null,
      };
    });
    const activeAssignments = assignedAssets.filter((row) => row.status === 'active').length;
    return res.json({
      success: true,
      data: {
        ...mapStaff(staff, activeAssignments),
        assignedAssets,
        activity: [
          ...assignedAssets.map((row) => ({
            type: row.status === 'active' ? 'Asset assigned' : 'Asset returned',
            description: `${row.asset?.assetCode || ''} ${row.asset?.name || ''}`.trim(),
            createdAt: row.returnDate || row.assignmentDate,
          })),
          ...activities.map((row) => ({ type: row.action, createdAt: row.createdAt })),
        ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 20),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const collegeId = getCollegeId(req);
    if (!collegeId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    }
    const validated = await validateStaffInput(req, transaction);
    if (validated.error) {
      await transaction.rollback();
      return res.status(validated.status).json({ success: false, message: validated.error });
    }
    const temporaryPassword = generateTemporaryPassword();
    const staff = await User.create({
      ...validated.value,
      active: true,
      status: 'active',
      forcePasswordChange: true,
      password: await bcrypt.hash(temporaryPassword, 10),
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'COLLEGE_STAFF_CREATED',
      entity: `user:${staff.id}`,
      entityId: staff.id,
      details: { collegeId, departmentId: staff.departmentId, staffId: staff.username, staffRole: staff.role },
      transaction,
    });
    await transaction.commit();
    return res.status(201).json({
      success: true,
      message: 'Staff account created. Share the temporary password securely; it will not be shown again.',
      data: mapStaff(staff),
      temporaryPassword,
    });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Staff ID or email is already in use' });
    return next(error);
  }
};

const update = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const collegeId = getCollegeId(req);
    const staff = await User.findOne({ where: { id: req.params.id, collegeId, role: 'staff' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!staff) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Staff member not found in this college' });
    }
    const validated = await validateStaffInput(req, transaction, staff);
    if (validated.error) {
      await transaction.rollback();
      return res.status(validated.status).json({ success: false, message: validated.error });
    }
    const oldValue = { fullName: staff.fullName, username: staff.username, email: staff.email, phone: staff.phone, departmentId: staff.departmentId, department: staff.department };
    await staff.update(validated.value, { transaction });
    const newValue = { fullName: staff.fullName, username: staff.username, email: staff.email, phone: staff.phone, departmentId: staff.departmentId, department: staff.department };
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'COLLEGE_STAFF_UPDATED',
      entity: `user:${staff.id}`,
      entityId: staff.id,
      oldValue,
      newValue,
      details: { collegeId, departmentId: staff.departmentId, staffId: staff.username },
      transaction,
    });
    await transaction.commit();
    const refreshed = await User.findOne({ where: { id: staff.id, collegeId, role: 'staff' }, attributes: safeUserAttributes, include: staffIncludes });
    return res.json({ success: true, data: mapStaff(refreshed) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Staff ID or email is already in use' });
    return next(error);
  }
};

const setStatus = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const collegeId = getCollegeId(req);
    const staff = await User.findOne({ where: { id: req.params.id, collegeId, role: 'staff' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!staff) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Staff member not found in this college' });
    }
    const active = req.body?.status === 'active' || req.body?.active === true;
    if (!active && req.body?.status !== 'inactive' && req.body?.active !== false) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    }
    const previousStatus = staff.status;
    await staff.update({
      active,
      status: active ? 'active' : 'inactive',
      ...(active ? {} : { sessionVersion: Number(staff.sessionVersion || 0) + 1 }),
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: active ? 'COLLEGE_STAFF_ACTIVATED' : 'COLLEGE_STAFF_DEACTIVATED',
      entity: `user:${staff.id}`,
      entityId: staff.id,
      details: { previousStatus, status: staff.status, sessionsRevoked: !active },
      transaction,
    });
    await transaction.commit();
    return res.json({ success: true, data: { id: staff.id, active: staff.active, status: staff.status, sessionVersion: staff.sessionVersion } });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const assignmentOptions = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    const staff = await User.findOne({
      where: { id: req.params.id, collegeId, role: 'staff', active: true },
      attributes: ['id', 'departmentId'],
    });
    if (!staff) return res.status(404).json({ success: false, message: 'Active staff member not found in this college' });
    const [custody, assignments] = await Promise.all([
      AssetCustody.findAll({ where: { status: 'active' }, attributes: ['assetId'], include: [{ model: Asset, attributes: [], where: { collegeId }, required: true }], raw: true }),
      Assignment.findAll({ where: { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } }, attributes: ['assetId'], include: [{ model: Asset, attributes: [], where: { collegeId }, required: true }], raw: true }),
    ]);
    const unavailable = new Set([...custody, ...assignments].map((row) => Number(row.assetId)));
    const where = { collegeId, status: { [Op.in]: ['available', 'active', 'ready', 'idle'] } };
    if (staff.departmentId) where.departmentId = staff.departmentId;
    const assets = await Asset.findAll({ where, attributes: ['id', 'assetCode', 'name', 'condition', 'departmentId'], order: [['name', 'ASC']] });
    return res.json({ success: true, data: assets.filter((asset) => !unavailable.has(Number(asset.id))) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { list, options, detail, create, update, setStatus, assignmentOptions };
