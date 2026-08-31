const { Op } = require('sequelize');
const { User, Department, AuditLog } = require('../models');
const bcrypt = require('bcryptjs');

const roles = ['admin', 'ict_officer', 'department_head', 'finance', 'store_manager', 'maintenance', 'staff', 'student'];
const safeUser = (user) => {
  const data = user.toJSON ? user.toJSON() : { ...user };
  delete data.password;
  return data;
};

const validateUserInput = async (input, { requirePassword = false } = {}) => {
  if (!input.username || !String(input.username).trim()) return 'Username is required';
  if (requirePassword && (!input.password || String(input.password).length < 6)) return 'Password must be at least 6 characters';
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
    if (req.user.role === 'department_head' && req.query.department && req.query.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    if (req.user.role === 'department_head') where.department = req.user.department;
    else if (req.query.department) where.department = req.query.department;
    if (req.query.role) where.role = req.query.role;
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.search) {
      const search = `%${String(req.query.search).trim()}%`;
      where[Op.or] = [{ username: { [Op.like]: search } }, { fullName: { [Op.like]: search } }, { email: { [Op.like]: search } }, { phone: { [Op.like]: search } }];
    }
    const users = await User.findAll({ where, attributes: { exclude: ['password'] }, order: [['id', 'ASC']] });
    const safeUsers = users.map(safeUser);
    res.json({ success: true, data: safeUsers, users: safeUsers, total: safeUsers.length, roles });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (req.user.role === 'department_head' && user.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    res.json({ success: true, data: safeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    await AuditLog.create({ userId: req.user.id, action: 'CREATE_USER', entity: `user:${user.id}`, details: JSON.stringify({ userId: user.id, username: user.username, role: user.role }) });
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      if (String(input.password).length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      updates.password = await bcrypt.hash(input.password, 10);
    }
    if (updates.username !== user.username || updates.email !== user.email) {
      const duplicate = await User.findOne({ where: { [Op.or]: [{ username: updates.username || user.username }, ...(updates.email ? [{ email: updates.email }] : [])], id: { [Op.ne]: user.id } } });
      if (duplicate) return res.status(409).json({ success: false, message: 'Username or email is already in use' });
    }
    const before = safeUser(user);
    await user.update(updates);
    await AuditLog.create({ userId: req.user.id, action: 'UPDATE_USER', entity: `user:${user.id}`, details: JSON.stringify({ before: { role: before.role, department: before.department, active: before.active }, after: { role: user.role, department: user.department, active: user.active } }) });
    res.json({ success: true, data: safeUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const updates = {};
    if (req.body.full_name !== undefined) updates.fullName = String(req.body.full_name).trim();
    if (req.body.email !== undefined) {
      if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(req.body.email))) return res.status(400).json({ success: false, message: 'Invalid email address' });
      updates.email = req.body.email || null;
    }
    if (req.body.phone !== undefined) updates.phone = String(req.body.phone).trim();
    await user.update(updates);
    await AuditLog.create({ userId: user.id, action: 'PROFILE_UPDATED', entity: `user:${user.id}`, details: JSON.stringify({ fields: Object.keys(updates) }) });
    res.json({ success: true, user: safeUser(user) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = { getAllUsers, getUserById, createUser, updateUser, deleteUser, updateProfile };
