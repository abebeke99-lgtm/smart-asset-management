const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { User, Department, AuditLog } = require('../models');
const bcrypt = require('bcryptjs');
const { findCollegeScopeForUser } = require('../middlewares/organizationScope');
const { saveProfilePhoto, validateProfilePhoto, buildPublicFileUrl } = require('../utils/uploadUtils');
const { createAuditLog } = require('../services/auditLogService');

const roles = ['admin', 'ict_officer', 'college', 'finance', 'store_manager', 'maintenance', 'infrastructure', 'staff', 'student'];
const safeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password;
  return data;
};

const validateUserInput = async (input, { requirePassword = false } = {}) => {
  if (!input.username || !String(input.username).trim()) return 'Username is required';
  if (requirePassword) {
    const pwd = String(input.password);
    if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters';
    if (pwd.length > 16) return 'Password must be at most 16 characters';
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email))) return 'Invalid email address';
  if (input.role && !roles.includes(input.role)) return 'Invalid user role';
  if (input.department) {
    const department = await Department.findOne({ where: { name: input.department } });
    if (!department) return 'Department not found';
  }
  return null;
};

const getAllUsers = async (req, res) => {
  try {
    const where = {};
    if (req.user.role === 'college' && req.query.department && req.query.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    if (req.user.role === 'college') where.department = req.user.department;
    if (req.user.role === 'store_manager') where.collegeId = Number(req.organizationScope?.collegeId ?? req.user.collegeId ?? req.user.college_id);
    else if (req.query.department) where.department = req.query.department;
    if (req.query.role) where.role = req.query.role;
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [{ username: { [Op.like]: search } }, { fullName: { [Op.like]: search } }, { email: { [Op.like]: search } }, { phone: { [Op.like]: search } }];
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const { count, rows: users } = await User.findAndCountAll({ where, attributes: { exclude: ['password'] }, order: [['id', 'ASC']], limit, offset: (page - 1) * limit });
    const safeUsers = users.map(safeUser);
    res.json({ success: true, message: 'Users retrieved successfully', data: safeUsers, users: safeUsers, total: count, roles, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    console.error('User list request failed:', error);
    res.status(500).json({ success: false, message: 'Unable to load users.' });
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
    const { full_name, phone_number, is_active, ...input } = req.body;
    const validationError = await validateUserInput(input, { requirePassword: true });
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const existing = await User.findOne({ where: { [Op.or]: [{ username: input.username }, ...(input.email ? [{ email: input.email }] : [])] } });
    if (existing) return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    const user = await User.create({
      username: input.username,
      email: input.email || null,
      role: input.role || 'staff',
      department: input.department || '',
      fullName: req.body.fullName || full_name || req.body.username,
      phone: req.body.phone || phone_number || '',
      active: req.body.active ?? is_active ?? true,
      password: await bcrypt.hash(req.body.password, 10),
    });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_USER', entity: `user:${user.id}`, entityId: user.id, newValue: safeUser(user), details: { username: user.username } });
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (error) {
    console.error('User creation failed:', error);
    res.status(500).json({ success: false, message: 'Unable to create user.' });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const { full_name, phone_number, is_active, ...input } = req.body;
    const validationError = await validateUserInput({ ...input, username: input.username || user.username }, { requirePassword: false });
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const updates = {
      ...(input.username ? { username: input.username } : {}),
      ...(input.email !== undefined ? { email: input.email || null } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.department !== undefined ? { department: input.department || '' } : {}),
      ...(input.fullName || full_name ? { fullName: input.fullName || full_name } : {}),
      ...(input.phone || phone_number ? { phone: input.phone || phone_number } : {}),
      ...(input.active !== undefined || is_active !== undefined ? { active: input.active ?? is_active } : {})
    };
    if (input.password) {
      if (String(input.password).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
   if (String(input.password).length > 16) return res.status(400).json({ success: false, message: 'Password must be at most 16 characters' });
      updates.password = await bcrypt.hash(input.password, 10);
    }
    if (updates.username !== user.username || updates.email !== user.email) {
      const duplicate = await User.findOne({ where: { [Op.or]: [{ username: updates.username || user.username }, ...(updates.email ? [{ email: updates.email }] : [])], id: { [Op.ne]: user.id } } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    }
    const before = safeUser(user);
    await user.update(updates);
    const roleChanged = before.role !== user.role;
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: roleChanged ? 'CHANGE_ROLE' : 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: before, newValue: safeUser(user), details: { operation: updates.active !== undefined && updates.active !== before.active ? (updates.active ? 'activate' : 'deactivate') : 'update' } });
    res.json({ success: true, message: 'User updated successfully', data: safeUser(user) });
  } catch (error) {
    console.error('User update failed:', error);
    res.status(500).json({ success: false, message: 'Unable to update user.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DELETE_USER', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id, username: user.username }) });
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('User deletion failed:', error);
    res.status(500).json({ success: false, message: 'Unable to delete user.' });
  }
};

const getCurrentUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: safeUser(user) });
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
    if (temporaryPassword && temporaryPassword.length > 16) return res.status(400).json({ success: false, message: 'Temporary password must be at most 16 characters' });
  await user.update({ password: await bcrypt.hash(temporaryPassword || require('crypto').randomBytes(18).toString('base64url'), 10), forcePasswordChange: true, sessionVersion: (user.sessionVersion || 0) + 1 });
  await AuditLog.create({ userId: req.user.id, action: 'RESET_USER_PASSWORD', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id, forcePasswordChange: true }) });
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

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, getCurrentUserProfile, updateProfile, updateCurrentUserProfilePhoto, removeCurrentUserProfilePhoto, setUserSecurityState, resetUserPassword, forcePasswordChange, terminateUserSession };
