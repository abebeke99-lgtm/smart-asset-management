const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { User, Department, College, AuditLog, Role, UserActivityLog } = require('../models');
const bcrypt = require('bcryptjs');
const { findCollegeScopeForUser } = require('../middlewares/organizationScope');
const { saveProfilePhoto, validateProfilePhoto, buildPublicFileUrl } = require('../utils/uploadUtils');
const { createAuditLog } = require('../services/auditLogService');
const { getUserReferenceCounts } = require('../services/userReferenceService');
const { getConfiguredRolePermissions } = require('../services/rolePermissionService');
const { ROLE_NAMES, normalizeRoleForStorage } = require('../constants/rolePermissions');

const roles = ROLE_NAMES;
const normalizeLookupValue = (value) => String(value ?? '').trim().toLowerCase();
const isValidPhone = (value) => {
  const phone = String(value || '').trim();
  const digits = phone.replace(/\D/g, '');
  return !phone || (/^\+?[\d\s().-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15);
};

const findDuplicateUser = async ({ username = '', email = '', excludeUserId = null } = {}) => {
  const normalizedUsername = normalizeLookupValue(username);
  const normalizedEmail = normalizeLookupValue(email);
  if (!normalizedUsername && !normalizedEmail) return null;

  const where = {
    [Op.or]: [
      ...(normalizedUsername ? [{ username: { [Op.like]: `%${normalizedUsername}%` } }] : []),
      ...(normalizedEmail ? [{ email: { [Op.like]: `%${normalizedEmail}%` } }] : []),
    ],
  };
  if (excludeUserId) where.id = { [Op.ne]: excludeUserId };

  const matches = await User.findAll({ where });
  return matches.find((candidate) => {
    const candidateUsername = normalizeLookupValue(candidate.username);
    const candidateEmail = normalizeLookupValue(candidate.email ?? '');
    return (normalizedUsername && candidateUsername === normalizedUsername) || (normalizedEmail && candidateEmail === normalizedEmail);
  }) || null;
};

const safeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password;
  delete data.passwordHash;
  delete data.password_hash;
  return data;
};

const validateUserInput = async (input, { requirePassword = false } = {}) => {
  if (input.fullName !== undefined && !String(input.fullName || '').trim()) return 'Full name is required';
  if (!input.username || !String(input.username).trim()) return 'Username is required';
  if (requirePassword) {
    const pwd = typeof input.password === 'string' ? input.password : '';
    if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters';
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) return 'Invalid email address';
  if (input.role && !roles.includes(input.role)) return 'Invalid user role';
  if (!isValidPhone(input.phone)) return 'Invalid phone number';
  if (input.department) {
    const department = await Department.findOne({ where: { name: input.department } });
    if (!department) return 'Department not found';
  }
  return null;
};

const recordUserActivity = (req, userId, action) => UserActivityLog.create({
  userId,
  action,
  ip: req.ip || req.socket?.remoteAddress || null,
  createdAt: new Date(),
});

const userIncludes = [
  { model: College, attributes: ['id', 'collegeCode', 'collegeName'], required: false },
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
];

const getUserStats = async (_req, res, next) => {
  try {
    const [counts, rolesByCount] = await Promise.all([User.findAll({
      attributes: ['status', [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true,
    }), User.findAll({
      attributes: ['role', [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count']],
      group: ['role'],
      raw: true,
    })]);
    const byStatus = Object.fromEntries(counts.map(({ status, count }) => [status, Number(count)]));
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    const roleCounts = Object.fromEntries(rolesByCount.map(({ role, count }) => [role, Number(count)]));
    return res.json({
      success: true,
      data: {
        total,
        totalUsers: total,
        active: byStatus.active || 0,
        activeUsers: byStatus.active || 0,
        inactive: byStatus.inactive || 0,
        inactiveUsers: byStatus.inactive || 0,
        suspended: byStatus.suspended || 0,
        admins: roleCounts.admin || 0,
        adminCount: roleCounts.admin || 0,
        roleCounts,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const where = {};
    const storeManagerRoleName = 'store_manager';
    if (req.user.role === 'college' && req.query.department && req.query.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    if (req.user.role === 'college') where.department = req.user.department;
    if (req.user.role === storeManagerRoleName) {
      const configuredCollegeId = req.organizationScope?.collegeId ?? req.user.collegeId ?? req.user.college_id;
      const scope = configuredCollegeId == null ? await findCollegeScopeForUser(req.user) : null;
      const collegeId = Number(configuredCollegeId ?? scope?.collegeId);
      if (!Number.isSafeInteger(collegeId) || collegeId <= 0) {
        return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
      }
      where.collegeId = collegeId;
    }
    else if (req.query.department) where.department = req.query.department;
    if (req.query.role && req.query.role !== 'All') where.role = normalizeRoleForStorage(req.query.role);
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status && !['all', 'active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be active, inactive, or suspended' });
    }
    if (['active', 'inactive', 'suspended'].includes(status)) where.status = status;
    else if (req.query.active !== undefined) where.active = req.query.active === 'true';
    const collegeId = String(req.query.collegeId || '').trim();
    if (collegeId) {
      if (!/^\d+$/.test(collegeId)) return res.status(400).json({ success: false, message: 'College ID must be a positive integer' });
      if (req.user.role !== 'admin' && where.collegeId && Number(where.collegeId) !== Number(collegeId)) {
        return res.status(403).json({ success: false, message: 'College access denied' });
      }
      if (req.user.role === 'admin' || !where.collegeId) where.collegeId = Number(collegeId);
    }
    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [
        { username: { [Op.like]: search } },
        { fullName: { [Op.like]: search } },
        { email: { [Op.like]: search } },
        { phone: { [Op.like]: search } },
        { role: { [Op.like]: search } },
        { '$College.collegeName$': { [Op.like]: search } },
      ];
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: userIncludes,
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const safeUsers = users.map((user) => {
      const data = safeUser(user);
      data.collegeName = user.College?.collegeName || '';
      data.departmentName = user.DepartmentRecord?.name || '';
      return data;
    });
    res.json({ success: true, message: 'Users retrieved successfully', data: safeUsers, users: safeUsers, total: count, roles, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('User list request failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load users.' });
  }
};

const getRoles = async (_req, res, next) => {
  try {
    const roleRows = await Role.findAll({ where: { active: true }, order: [['displayName', 'ASC']] });
    return res.json({ success: true, data: roleRows, roles: roleRows });
  } catch (error) {
    return next(error);
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'college' && user.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    if (req.user.role === 'store_manager') {
      const scope = await findCollegeScopeForUser(req.user);
      if (!scope?.collegeId || Number(user.collegeId) !== Number(scope.collegeId)) return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User retrieved successfully', data: safeUser(user) });
  } catch (error) {
    console.error('User detail request failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load user.' });
  }
};

const createUser = async (req, res) => {
  try {
    const body = req.body || {};
    if (typeof body.password !== 'string' || !body.password) return res.status(400).json({ success: false, message: 'Password is required' });
    if (typeof body.confirmPassword !== 'string' || !body.confirmPassword) return res.status(400).json({ success: false, message: 'Confirm Password is required' });
    if (body.password !== body.confirmPassword) return res.status(400).json({ success: false, message: 'Password and Confirm Password must match' });
    const { full_name, phone_number, is_active, ...input } = body;
    const username = String(input.username || '').trim();
    const email = String(input.email || '').trim();
    const role = normalizeRoleForStorage(input.role || input.roleId);
    if (!role) return res.status(400).json({ success: false, message: 'Role is required' });
    if (!roles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid user role' });
    const departmentRecord = input.departmentId ? await Department.findByPk(input.departmentId) : null;
    if (input.departmentId && !departmentRecord) return res.status(400).json({ success: false, message: 'Department not found' });
    if (departmentRecord && input.collegeId && Number(departmentRecord.collegeId) !== Number(input.collegeId)) {
      return res.status(400).json({ success: false, message: 'Selected department does not belong to the selected college' });
    }
    if (input.collegeId && !(await College.findByPk(input.collegeId))) return res.status(400).json({ success: false, message: 'College not found' });
    const department = departmentRecord?.name || input.department || '';
    const status = String(input.status || 'active').toLowerCase();
    if (!['active', 'inactive', 'suspended'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active, inactive, or suspended' });
    if (typeof body.confirmPassword !== 'string' || body.password !== body.confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and Confirm Password must match' });
    }
    const fullName = String(body.fullName || body.name || full_name || '').trim();
    const validationError = await validateUserInput({ ...input, fullName, username, email, role, department, phone: body.phone ?? phone_number ?? '' }, { requirePassword: true });
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const existing = await findDuplicateUser({ username, email });
    if (existing) return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    const user = await User.create({
      username,
      email: email || null,
      role: role || 'staff',
      department,
      collegeId: input.collegeId || null,
      departmentId: input.departmentId || null,
      fullName,
      phone: String(body.phone ?? phone_number ?? '').trim(),
      active: status === 'active',
      status,
      password: await bcrypt.hash(input.password, 10),
    });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_USER', entity: `user:${user.id}`, entityId: user.id, newValue: safeUser(user), details: { username: user.username } });
    await recordUserActivity(req, user.id, `User account created by administrator ${req.user.username}`);
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    console.error('User creation failed:', error);
    res.status(500).json({ success: false, message: 'Unable to create user.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const body = req.body || {};
    const { full_name, phone_number, is_active, ...input } = body;
    const requestedRole = input.role || input.roleId;
    const role = requestedRole ? normalizeRoleForStorage(requestedRole) : requestedRole;
    if (requestedRole && !roles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid user role' });
    const departmentRecord = input.departmentId ? await Department.findByPk(input.departmentId) : null;
    if (input.departmentId && !departmentRecord) return res.status(400).json({ success: false, message: 'Department not found' });
    if (departmentRecord && (input.collegeId ?? user.collegeId) && Number(departmentRecord.collegeId) !== Number(input.collegeId ?? user.collegeId)) {
      return res.status(400).json({ success: false, message: 'Selected department does not belong to the selected college' });
    }
    if (input.collegeId && !(await College.findByPk(input.collegeId))) return res.status(400).json({ success: false, message: 'College not found' });
    const department = departmentRecord?.name || input.department;
    const fullName = input.fullName ?? input.name ?? full_name;
    if (Object.prototype.hasOwnProperty.call(input, 'username') && !String(input.username || '').trim()) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }
    const validationError = await validateUserInput({ ...input, fullName, role, department, username: input.username || user.username }, { requirePassword: false });
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const nextStatus = input.status === undefined ? undefined : String(input.status).toLowerCase();
    if (nextStatus !== undefined && !['active', 'inactive', 'suspended'].includes(nextStatus)) {
      return res.status(400).json({ success: false, message: 'Status must be active, inactive, or suspended' });
    }
    const requestedActive = input.active ?? is_active;
    if ((input.status !== undefined && nextStatus !== 'active') || (requestedActive !== undefined && !requestedActive)) {
      if (user.id === req.user.id) return res.status(400).json({ success: false, message: 'Administrators cannot deactivate or suspend their own account' });
    }
    if (input.password && input.password !== input.confirmPassword) {
      return res.status(400).json({ success: false, message: 'Password and Confirm Password must match' });
    }
    const updates = {
      ...(input.username ? { username: input.username } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(role ? { role } : {}),
      ...(input.departmentId !== undefined ? { departmentId: input.departmentId || null, department: department || '' } : input.department !== undefined ? { department: input.department || '' } : {}),
      ...(input.collegeId !== undefined ? { collegeId: input.collegeId || null } : {}),
      ...(fullName !== undefined ? { fullName: String(fullName).trim() } : {}),
      ...(input.phone !== undefined || phone_number !== undefined ? { phone: input.phone ?? phone_number ?? '' } : {}),
      ...(nextStatus !== undefined ? { status: nextStatus, active: nextStatus === 'active' } : input.active !== undefined || is_active !== undefined ? { active: input.active ?? is_active, status: (input.active ?? is_active) ? 'active' : 'inactive' } : {})
    };
    if (input.password) {
      if (String(input.password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      updates.password = await bcrypt.hash(input.password, 10);
    }
    if (updates.username !== user.username || updates.email !== user.email) {
      const duplicate = await findDuplicateUser({ username: updates.username || user.username, email: updates.email !== undefined ? updates.email : user.email, excludeUserId: user.id });
      if (duplicate) return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    }
    const before = safeUser(user);
    await user.update(updates);
    const roleChanged = before.role !== user.role;
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: roleChanged ? 'CHANGE_ROLE' : 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: before, newValue: safeUser(user), details: { operation: updates.active !== undefined && updates.active !== before.active ? (updates.active ? 'activate' : 'deactivate') : 'update' } });
    await recordUserActivity(req, user.id, `User account updated by administrator ${req.user.username}`);
    res.json({ success: true, message: 'User updated successfully', data: safeUser(user) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    console.error('User update failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update user.' });
  }
};

const updateUserStatus = async (req, res) => {
  const status = String(req.body?.status || '').toLowerCase();
  if (!['active', 'inactive', 'suspended'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Status must be active, inactive, or suspended' });
  }
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.id === req.user.id && status !== 'active') {
    return res.status(400).json({ success: false, message: 'Administrators cannot deactivate or suspend their own account' });
  }
  await user.update({ status, active: status === 'active' });
  await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_USER_STATUS', entity: `user:${user.id}`, entityId: user.id, details: { status } });
  await recordUserActivity(req, user.id, `Account status changed to ${status} by administrator ${req.user.username}`);
  return res.json({ success: true, message: `User ${status} successfully`, data: safeUser(user) });
};

const getUserActivity = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isSafeInteger(userId) || userId < 1) return res.status(400).json({ success: false, message: 'User ID must be a positive integer' });
    const user = await User.findByPk(userId, { attributes: ['id'] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const { count, rows } = await UserActivityLog.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });
    return res.json({ success: true, data: rows, logs: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    return next(error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.id === req.user.id) return res.status(400).json({ success: false, message: 'Administrators cannot delete their own account' });
    const references = await getUserReferenceCounts(user.id);
    if (references.length > 0) {
      return res.status(409).json({ success: false, message: 'This user is linked to existing records and cannot be deleted' });
    }
    await recordUserActivity(req, user.id, `User account deleted by administrator ${req.user.username}`);
    await user.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_USER', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id, username: user.username }) });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    if (error.name === 'SequelizeForeignKeyConstraintError') return res.status(409).json({ success: false, message: 'This user is linked to existing records and cannot be deleted' });
    console.error('User deletion failed:', error);
    res.status(500).json({ success: false, message: 'Unable to delete user.' });
  }
};

const getCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const data = safeUser(user);
    const permissions = await getConfiguredRolePermissions(user.role);
    if (permissions !== null) data.permissions = permissions;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('User profile request failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load profile.' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const updates = {};
    const hasFullName = req.body.fullName !== undefined || req.body.full_name !== undefined;
    if (hasFullName) {
      const nextFullName = req.body.fullName ?? req.body.full_name;
      updates.fullName = String(nextFullName ?? '').trim();
    }
    if (req.body.email !== undefined) {
      if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(req.body.email))) return res.status(400).json({ success: false, message: 'Invalid email address' });
      updates.email = req.body.email || null;
    }
    if (req.body.phone !== undefined) updates.phone = String(req.body.phone ?? '').trim();

    if (!Object.keys(updates).length) {
      return res.json({ success: true, message: 'No profile changes to save.', user: safeUser(user), data: safeUser(user) });
    }

    await user.update(updates);
    await AuditLog.create({ userId: user.id, action: 'PROFILE_UPDATED', entity: `user:${user.id}`, details: JSON.stringify({ fields: Object.keys(updates) }) });
    const payload = safeUser(user);
    return res.json({ success: true, user: payload, data: payload, message: 'Profile updated successfully.' });
  } catch (error) { console.error('Profile update failed:', error); res.status(500).json({ success: false, message: 'Unable to update profile.' }); }
};

const getServerPhotoPath = (profilePhoto) => {
  if (!profilePhoto) return null;
  const relative = String(profilePhoto).trim().replace(/\\/g, '/');
  const normalized = relative.startsWith('/') ? relative.slice(1) : relative;
  const relativePath = normalized.replace(/^uploads\//, '');
  return path.resolve(process.cwd(), 'uploads', relativePath);
};

const updateCurrentUserProfilePhoto = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No image selected.' });

    const validation = validateProfilePhoto(req.file, { maxSize: 5 * 1024 * 1024 });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const previousPhoto = user.profilePhoto;
    const saved = saveProfilePhoto({
      buffer: Buffer.from(req.file.buffer),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    }, user.id);

    if (previousPhoto && previousPhoto !== saved.filePath) {
      const previousPath = getServerPhotoPath(previousPhoto);
      if (previousPath && fs.existsSync(previousPath)) {
        try {
          fs.unlinkSync(previousPath);
        } catch (unlinkError) {
          console.warn('Failed to remove previous profile photo:', unlinkError.message);
        }
      }
    }

    await user.update({ profilePhoto: saved.filePath });
    const refreshedUser = await User.findByPk(user.id);
    await AuditLog.create({ userId: user.id, action: 'PROFILE_PHOTO_UPDATED', entity: `user:${user.id}`, details: JSON.stringify({ profilePhoto: saved.filePath }) });
    return res.json({ success: true, message: 'Profile photo updated successfully.', user: safeUser(refreshedUser), data: safeUser(refreshedUser) });
  } catch (error) {
    console.error('Profile photo update failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update profile photo. Please try again.' });
  }
};

const removeCurrentUserProfilePhoto = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.profilePhoto) {
      return res.json({ success: true, message: 'No profile photo to remove.', user: safeUser(user), data: safeUser(user) });
    }

    const previousPath = getServerPhotoPath(user.profilePhoto);
    await user.update({ profilePhoto: null });
    if (previousPath && fs.existsSync(previousPath)) {
      try {
        fs.unlinkSync(previousPath);
      } catch (unlinkError) {
        console.warn('Failed to delete profile photo file:', unlinkError.message);
      }
    }
    const refreshedUser = await User.findByPk(user.id);
    await AuditLog.create({ userId: user.id, action: 'PROFILE_PHOTO_REMOVED', entity: `user:${user.id}`, details: JSON.stringify({ profilePhoto: null }) });
    return res.json({ success: true, message: 'Profile photo removed.', user: safeUser(refreshedUser), data: safeUser(refreshedUser) });
  } catch (error) {
    console.error('Profile photo removal failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to remove profile photo. Please try again.' });
  }
};

const setUserSecurityState = async (req, res, state) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  if (user.id === req.user.id && state === 'lock') return res.status(400).json({ success: false, message: 'You cannot lock your own account' });
  const updates = state === 'unlock' ? { lockoutUntil: null, failedLoginAttempts: 0 } : { lockoutUntil: new Date('2099-12-31T23:59:59.999Z'), failedLoginAttempts: 0 };
  await user.update(updates);
  await AuditLog.create({ userId: req.user.id, action: state === 'unlock' ? 'UNLOCK_USER' : 'LOCK_USER', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
  return res.json({ success: true, message: `User ${state}ed successfully`, data: safeUser(user) });
};

const resetUserPassword = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  const temporaryPassword = String(req.body.password || '').trim();
  if (temporaryPassword && temporaryPassword.length < 8) return res.status(400).json({ success: false, message: 'Temporary password must be at least 8 characters' });
  if (req.body.confirmPassword && temporaryPassword !== req.body.confirmPassword) return res.status(400).json({ success: false, message: 'Password and Confirm Password must match' });
  await user.update({ password: await bcrypt.hash(temporaryPassword || require('crypto').randomBytes(18).toString('base64url'), 10), forcePasswordChange: true, sessionVersion: (user.sessionVersion || 0) + 1 });
  await AuditLog.create({ userId: req.user.id, action: 'RESET_USER_PASSWORD', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id, forcePasswordChange: true }) });
  await recordUserActivity(req, user.id, `Password reset by administrator ${req.user.username}`);
  return res.json({ success: true, message: 'Password reset successfully; the user must change it at next login' });
};

const forcePasswordChange = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  await user.update({ forcePasswordChange: true });
  await AuditLog.create({ userId: req.user.id, action: 'FORCE_PASSWORD_CHANGE', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
  return res.json({ success: true, message: 'Password change required at next login', data: safeUser(user) });
};

const terminateUserSession = async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  await user.update({ sessionVersion: (user.sessionVersion || 0) + 1 });
  await AuditLog.create({ userId: req.user.id, action: 'TERMINATE_USER_SESSION', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id }) });
  return res.json({ success: true, message: 'User sessions terminated' });
};

module.exports = { getAllUsers, getUserStats, getRoles, getUserById, createUser, updateUser, updateUserStatus, getUserActivity, deleteUser, getCurrentUserProfile, updateProfile, updateCurrentUserProfilePhoto, removeCurrentUserProfilePhoto, setUserSecurityState, resetUserPassword, forcePasswordChange, terminateUserSession, recordUserActivity };
