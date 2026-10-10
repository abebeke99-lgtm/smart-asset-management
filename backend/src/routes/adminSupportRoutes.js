const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Asset, User, Assignment, Maintenance, MaintenanceCost, RFIDLog, RfidDevice, Category, College, Department, Campus, Notification, NotificationDelivery, AuditLog, AuditLogArchive, Config, SettingsVersion, MfaSetting, Transfer, Inventory, InventoryTransaction, Approval, FinancialRecord, DisposalRequest, sequelize } = require('../models');
const { requireAuth, requireRole, requirePermission, requireAnyPermission } = require('../middlewares/auth');
const { Op, Sequelize } = require('sequelize');
const speakeasy = require('speakeasy');
const maintenanceController = require('../controllers/maintenanceController');
const backupService = require('../services/backupService');
const { getDashboardAnalytics } = require('../services/dashboardService');
const { getJwtSecret } = require('../config/jwt');
const { createAuditLog } = require('../services/auditLogService');
const { buildNotificationVisibilityWhere } = require('../services/notificationService');
const { ROLE_NAMES, normalizeRoleForStorage } = require('../constants/rolePermissions');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];
const getMfaCipherKey = () => crypto.createHash('sha256').update(getJwtSecret()).digest();
const encryptMfaSecret = (secret) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getMfaCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`;
};
const decryptMfaSecret = (payload) => {
  const [ivHex, tagHex, encryptedHex] = String(payload).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMfaCipherKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8');
};
const generateBackupCodes = () => Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex').toUpperCase());
const hashBackupCodes = async (codes) => Promise.all(codes.map((code) => require('bcryptjs').hash(code, 10)));
const backupDirectory = path.join(__dirname, '../../backups');
const backupFilePattern = /^backup_[0-9]{8}T[0-9]{6}_[a-f0-9]{8}\.json$/;
const backupModels = { users: User, assets: Asset, assignments: Assignment, transfers: Transfer, maintenance: Maintenance, rfidLogs: RFIDLog, categories: Category, departments: Department, notifications: Notification, inventory: Inventory, inventoryTransactions: InventoryTransaction, approvals: Approval, financialRecords: FinancialRecord, disposalRequests: DisposalRequest };
const safeJson = (record) => {
  const value = record.toJSON ? record.toJSON() : record;
  if (value.password !== undefined) delete value.password;
  return value;
};
const resolveBackupPath = (filename) => {
  if (!backupFilePattern.test(filename)) return null;
  const resolved = path.resolve(backupDirectory, filename);
  return resolved.startsWith(`${path.resolve(backupDirectory)}${path.sep}`) ? resolved : null;
};

const normalizeUser = (user) => {
  const value = user.toJSON ? user.toJSON() : user;
  const safe = {
    ...value,
    password: undefined,
    id: value.id,
    username: value.username || '',
    fullName: value.fullName || value.full_name || '',
    email: value.email || '',
    phone: value.phone || '',
    role: value.role || 'staff',
    department: value.department || '',
    departmentId: value.departmentId || null,
    collegeId: value.collegeId || null,
    status: value.active === false ? 'inactive' : (value.active ? 'active' : 'inactive'),
    active: value.active ?? true,
    created_at: value.createdAt || null,
    updated_at: value.updatedAt || null,
  };
  return safe;
};

const normalizeDepartment = async (department) => {
  const value = department.toJSON ? department.toJSON() : department;
  const [userCount, assetCount] = await Promise.all([
    User.count({ where: { department: value.name } }),
    Asset.count({ where: { department: value.name } }),
  ]);
  return {
    ...value,
    created_at: value.createdAt || null,
    updated_at: value.updatedAt || null,
    user_count: userCount,
    asset_count: assetCount,
  };
};

const validateDepartment = async (body, id = null) => {
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim().toUpperCase();
  if (name.length < 2 || name.length > 255) return { error: 'Department name must be between 2 and 255 characters' };
  if (code.length < 2 || code.length > 100) return { error: 'Department code must be between 2 and 100 characters' };
  const duplicateWhere = { [Op.or]: [{ name }, { code }] };
  if (id !== null) duplicateWhere.id = { [Op.ne]: id };
  if (await Department.findOne({ where: duplicateWhere })) return { error: 'Department name or code already exists' };
  if (body.headId !== undefined && body.headId !== null && body.headId !== '') {
    if (!await User.findByPk(body.headId)) return { error: 'Department head user not found' };
  }
  return { value: { name, code, description: String(body.description || '').trim(), headId: body.headId || null } };
};

const normalizeMaintenanceCost = (row) => {
  const data = row && row.toJSON ? row.toJSON() : (row || {});
  const maintenance = data.Maintenance || data.maintenance || null;
  const asset = data.Asset || data.asset || null;
  const approvedByUser = data.ApprovedByUser || data.approvedByUser || null;
  const toNumber = (value) => (value === null || value === undefined ? 0 : Number(value));
  return {
    ...data,
    maintenance_id: data.maintenanceId ?? null,
    repair_id: data.repairId ?? null,
    work_order_id: data.workOrderId ?? null,
    asset_id: data.assetId ?? null,
    cost_category: data.costCategory || 'other',
    cost_date: data.costDate || null,
    unit_cost: toNumber(data.unitCost),
    approved_by: data.approvedBy ?? null,
    total_cost: toNumber(data.amount),
    maintenance: maintenance ? { id: maintenance.id, title: maintenance.title, status: maintenance.status, priority: maintenance.priority } : null,
    asset: asset ? { id: asset.id, name: asset.name, assetCode: asset.assetCode, category: asset.category, department: asset.department, location: asset.location } : null,
    approved_by_user: approvedByUser ? { id: approvedByUser.id, username: approvedByUser.username, fullName: approvedByUser.fullName } : null,
  };
};

const normalizeDisposalRequest = (row) => {
  const data = row.toJSON ? row.toJSON() : row;
  return {
    ...data,
    disposal_number: data.disposalNumber,
    asset_id: data.assetId,
    college_id: data.collegeId,
    department_id: data.departmentId,
    location_id: data.locationId,
    requested_by: data.requestedBy,
    reviewed_by: data.reviewedBy,
    approved_by: data.approvedBy,
    executed_by: data.executedBy,
    type: data.type || 'Disposal',
    status: data.status || 'Requested',
    condition: data.condition || 'Poor',
    request_number: data.disposalNumber,
  };
};

const serializeRfidScan = (row) => {
  const data = row.toJSON ? row.toJSON() : row;
  return {
    ...data,
    id: data.id,
    asset_id: data.assetId,
    rfid_tag: data.tag,
    tag_code: data.tag,
    reader_id: data.readerId || null,
    reader_location: data.location || '',
    new_location: data.location || '',
    location: data.location || '',
    timestamp: data.createdAt,
    created_at: data.createdAt,
    asset_name: data.Asset?.name || data.asset_name || '',
    asset_code: data.Asset?.assetCode || data.asset_code || '',
    isAnomaly: false,
  };
};

router.get('/users', requireAuth, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const where = {};
    const search = String(req.query.search || req.query.q || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { fullName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (role) where.role = role;
    if (status) {
      const active = String(status).toLowerCase() === 'active' || String(status).toLowerCase() === 'inactive';
      if (active) where.active = status.toLowerCase() === 'active';
    }
    const { count, rows } = await User.findAndCountAll({ where, attributes: { exclude: ['password'] }, limit, offset, order: [['id', 'DESC']] });
    const users = rows.map(normalizeUser);
    return res.json({ success: true, data: users, users, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
});

router.get('/users/stats', requireAuth, async (req, res, next) => {
  try {
    const [totalUsers, activeUsers, inactiveUsers, adminUsers, roles] = await Promise.all([
      User.count(),
      User.count({ where: { active: true } }),
      User.count({ where: { active: false } }),
      User.count({ where: { role: 'admin' } }),
      User.findAll({ attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['role'], raw: true }),
    ]);

    const roleCounts = Object.fromEntries(roles.map((row) => [row.role, Number(row.count || 0)]));
    return res.json({
      success: true,
      data: {
        total: totalUsers,
        totalUsers,
        active: activeUsers,
        activeUsers,
        inactive: inactiveUsers,
        inactiveUsers,
        admins: adminUsers,
        adminCount: adminUsers,
        roleCounts,
      },
    });
  } catch (error) { next(error); }
});

router.get('/users/:id', requireAuth, requireRole('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'), async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.post('/users', ...requireAdmin, async (req, res, next) => {
  try {
    const { isValidEmail } = require('../utils/validators');
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim();
    const fullName = String(req.body.fullName || req.body.full_name || '').trim();
    const phone = String(req.body.phone || '').trim();
    const role = normalizeRoleForStorage(req.body.role || 'staff');
    const allowedRoles = ROLE_NAMES;
    const exists = await User.findOne({ where: { username } });
    if (exists) return res.status(409).json({ success: false, message: 'Username already exists' });
    if (!username || !fullName) return res.status(400).json({ success: false, message: 'Username and full name are required' });
    if (!allowedRoles.includes(role)) return res.status(422).json({ success: false, message: 'Invalid user role' });
    if (email && !isValidEmail(email)) return res.status(422).json({ success: false, message: 'Valid email is required' });
    const password = String(req.body.password || '').trim();
    if (password.length < 12) return res.status(422).json({ success: false, message: 'Password must be at least 12 characters' });
    const user = await User.create({ username, email, fullName, phone, role, department: String(req.body.department || ''), collegeId: req.body.collegeId || null, departmentId: req.body.departmentId || null, active: req.body.active !== false, password: await bcrypt.hash(password, 10), forcePasswordChange: Boolean(req.body.forcePasswordChange || req.body.force_password_change || false) });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_USER', entity: `user:${user.id}`, entityId: user.id, newValue: normalizeUser(user), details: { username, role, collegeId: user.collegeId, departmentId: user.departmentId, legacyAction: 'USER_CREATED' } });
    return res.status(201).json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.put('/users/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const { isValidEmail } = require('../utils/validators');
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousValue = normalizeUser(user);
    const allowedRoles = ROLE_NAMES;
    const nextRole = normalizeRoleForStorage(req.body.role || user.role || 'staff');
    if (!allowedRoles.includes(nextRole)) return res.status(422).json({ success: false, message: 'Invalid user role' });
    const nextEmail = String(req.body.email || user.email || '').trim();
    if (nextEmail && !isValidEmail(nextEmail)) return res.status(422).json({ success: false, message: 'Valid email is required' });
    user.fullName = String(req.body.fullName || req.body.full_name || user.fullName || '').trim().slice(0, 120);
    user.email = nextEmail;
    user.phone = String(req.body.phone || user.phone || '').trim().slice(0, 30);
    user.role = nextRole;
    user.department = String(req.body.department || user.department || '').trim().slice(0, 120);
    user.collegeId = req.body.collegeId ?? user.collegeId ?? null;
    user.departmentId = req.body.departmentId ?? user.departmentId ?? null;
    user.active = req.body.active ?? user.active;
    await user.save();
    const roleChanged = previousValue.role !== user.role;
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: roleChanged ? 'CHANGE_ROLE' : 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: previousValue, newValue: normalizeUser(user), details: { username: user.username, legacyAction: 'USER_UPDATED' } });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.patch('/users/:id/status', ...requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousValue = normalizeUser(user);
    const nextState = String(req.body.status || req.body.active || 'active').toLowerCase();
    user.active = nextState === 'active' || nextState === 'true' || nextState === 'enabled';
    await user.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: previousValue, newValue: normalizeUser(user), details: { operation: user.active ? 'activate' : 'deactivate', legacyAction: user.active ? 'USER_ACTIVATED' : 'USER_DEACTIVATED' } });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.post('/users/:id/lock', ...requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousValue = normalizeUser(user);
    user.active = false;
    await user.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: previousValue, newValue: normalizeUser(user), details: { operation: 'lock', legacyAction: 'USER_LOCKED' } });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.post('/users/:id/unlock', ...requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousValue = normalizeUser(user);
    user.active = true;
    await user.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: previousValue, newValue: normalizeUser(user), details: { operation: 'unlock', legacyAction: 'USER_UNLOCKED' } });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.post('/users/:id/reset-password', ...requireAdmin, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const previousValue = normalizeUser(user);
    user.forcePasswordChange = true;
    const password = String(req.body.password || '').trim();
    if (password.length < 12) return res.status(422).json({ success: false, message: 'A new password of at least 12 characters is required' });
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_USER', entity: `user:${user.id}`, entityId: user.id, oldValue: previousValue, newValue: normalizeUser(user), details: { operation: 'password_reset', legacyAction: 'PASSWORD_RESET' } });
    return res.json({ success: true, data: normalizeUser(user), user: normalizeUser(user) });
  } catch (error) { next(error); }
});

router.get('/users/:id/activity', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const logs = await AuditLog.findAll({ where: { userId: req.params.id }, order: [['createdAt', 'DESC']], limit: 80 });
    return res.json({ success: true, data: logs, logs, total: logs.length });
  } catch (error) { next(error); }
});

const collegeManagerWhere = { role: 'college', active: true };
const collegeIdFromRequest = (body) => body.managerId ?? body.college_manager_id ?? body.collegeManagerId ?? null;
const collegePayload = (body, existing = {}) => ({
  collegeCode: String(body.collegeCode || body.code || existing.collegeCode || '').trim().toUpperCase(),
  collegeName: String(body.collegeName || body.name || existing.collegeName || '').trim(),
  campusId: body.campusId !== undefined || body.campus_id !== undefined ? (Number(body.campusId ?? body.campus_id) || null) : (existing.campusId ?? null),
  description: String(body.description ?? existing.description ?? '').trim(),
  managerId: collegeIdFromRequest(body) ?? existing.managerId ?? null,
  location: String(body.location ?? existing.location ?? '').trim(),
  address: String(body.address ?? existing.address ?? '').trim(),
  phone: String(body.phone ?? existing.phone ?? '').trim(),
  email: String(body.email ?? existing.email ?? '').trim(),
  establishedDate: body.establishedDate ?? body.established_date ?? existing.establishedDate ?? null,
  status: String(body.status || existing.status || 'active').toLowerCase(),
});

const validateCollegeManager = async (managerId, collegeId = null) => {
  if (managerId === null || managerId === '' || managerId === undefined) return { user: null };
  const user = await User.findOne({ where: { id: managerId, ...collegeManagerWhere }, attributes: { exclude: ['password'] } });
  if (!user) return { error: 'College Manager must be an active user with role college' };
  const assignedElsewhere = await College.findOne({ where: { managerId: user.id, status: 'active', ...(collegeId ? { id: { [Op.ne]: collegeId } } : {}) } });
  if (assignedElsewhere) return { error: 'This College Manager already manages another active college' };
  return { user };
};

const validateCollegeCampus = async (campusId) => {
  if (campusId === null || campusId === '' || campusId === undefined) return { campus: null };
  const campus = await Campus.findOne({ where: { id: campusId, status: 'active' } });
  return campus ? { campus } : { error: 'College campus must be an active campus.' };
};

const collegeLocations = async (collegeId) => {
  const rows = await Asset.findAll({ where: { collegeId, location: { [Op.ne]: '' } }, attributes: ['location'], group: ['location'], order: [['location', 'ASC']], raw: true });
  return rows.map((row, index) => ({ id: `${collegeId}-${index + 1}`, name: row.location, status: 'active' }));
};

const collegeStatistics = async (collegeId) => {
  const [totalDepartments, activeDepartments, totalStaff, activeStaff, totalAssets, availableAssets, assignedAssets, maintenanceAssets, missingAssets, damagedAssets, locations, pendingRequests, pendingApprovals] = await Promise.all([
    Department.count({ where: { collegeId } }),
    Department.count({ where: { collegeId, status: 'active' } }),
    User.count({ where: { collegeId } }),
    User.count({ where: { collegeId, active: true } }),
    Asset.count({ where: { collegeId } }),
    Asset.count({ where: { collegeId, status: 'available' } }),
    Asset.count({ where: { collegeId, status: { [Op.in]: ['assigned', 'in-use', 'In-Use', 'Assigned'] } } }),
    Asset.count({ where: { collegeId, status: { [Op.in]: ['maintenance', 'under maintenance', 'in_maintenance'] } } }),
    Asset.count({ where: { collegeId, status: 'missing' } }),
    Asset.count({ where: { collegeId, status: 'damaged' } }),
    collegeLocations(collegeId),
    Maintenance.count({ include: [{ model: Asset, required: true, where: { collegeId }, attributes: [] }], where: { status: 'pending' } }),
    Approval.count({ where: { status: 'pending' }, include: [{ model: Department, required: true, where: { collegeId }, attributes: [] }] }),
  ]);
  return { totalDepartments, activeDepartments, totalStaff, activeStaff, totalAssets, availableAssets, assignedAssets, maintenanceAssets, missingAssets, damagedAssets, totalLocations: locations.length, pendingRequests, pendingApprovals };
};

const serializeCollege = async (college) => {
  const value = college.toJSON ? college.toJSON() : college;
  const [manager, departmentCount, staffCount, assetCount, locations] = await Promise.all([
    value.managerId ? User.findByPk(value.managerId, { attributes: ['id', 'fullName', 'username', 'email', 'role', 'active'] }) : null,
    Department.count({ where: { collegeId: value.id } }),
    User.count({ where: { collegeId: value.id } }),
    Asset.count({ where: { collegeId: value.id } }),
    collegeLocations(value.id),
  ]);
  return { ...value, name: value.collegeName, code: value.collegeCode, manager: manager ? { id: manager.id, name: manager.fullName || manager.username, username: manager.username, email: manager.email, role: manager.role, active: manager.active } : null, departmentCount, staffCount, assetCount, locationCount: locations.length, locations };
};

router.get('/colleges/manager-candidates', ...requireAdmin, async (req, res, next) => {
  try {
    const rows = await User.findAll({ where: collegeManagerWhere, attributes: ['id', 'fullName', 'username', 'email', 'role'], order: [['fullName', 'ASC']] });
    return res.json({ success: true, data: rows.map((user) => ({ id: user.id, name: user.fullName || user.username, fullName: user.fullName, username: user.username, email: user.email, role: user.role })), total: rows.length });
  } catch (error) { next(error); }
});

router.get('/colleges', ...requireAdmin, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const search = String(req.query.search || req.query.q || '').trim();
    const where = {};
    if (search) where[Op.or] = [{ collegeName: { [Op.like]: `%${search}%` } }, { collegeCode: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }, { location: { [Op.like]: `%${search}%` } }];
    if (['active', 'inactive'].includes(String(req.query.status || '').toLowerCase())) where.status = String(req.query.status).toLowerCase();
    const sortMap = { name: 'collegeName', code: 'collegeCode', status: 'status', createdAt: 'createdAt', updatedAt: 'updatedAt' };
    const sortBy = sortMap[String(req.query.sortBy || 'name')] || 'collegeName';
    const sortOrder = String(req.query.sortOrder || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const { count, rows } = await College.findAndCountAll({ where, order: [[sortBy, sortOrder]], limit, offset: (page - 1) * limit });
    const data = await Promise.all(rows.map(serializeCollege));
    const [activeCount, inactiveCount, totalDepartments] = await Promise.all([
      College.count({ where: { ...where, status: 'active' } }),
      College.count({ where: { ...where, status: 'inactive' } }),
      Department.count(),
    ]);
    return res.json({ success: true, data, colleges: data, total: count, summary: { totalColleges: count, activeColleges: activeCount, inactiveColleges: inactiveCount, totalDepartments }, pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)), pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
});

router.get('/colleges/export', ...requireAdmin, async (req, res, next) => {
  try {
    const search = String(req.query.search || req.query.q || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();
    const where = {};
    if (search) where[Op.or] = [{ collegeName: { [Op.like]: `%${search}%` } }, { collegeCode: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }, { location: { [Op.like]: `%${search}%` } }];
    if (['active', 'inactive'].includes(status)) where.status = status;
    const rows = await College.findAll({ where, order: [['collegeName', 'ASC']] });
    const records = await Promise.all(rows.map(async (college) => {
      const manager = college.managerId ? await User.findByPk(college.managerId, { attributes: ['fullName', 'username', 'email'] }) : null;
      const [departmentCount, staffCount, assetCount] = await Promise.all([
        Department.count({ where: { collegeId: college.id } }),
        User.count({ where: { collegeId: college.id } }),
        Asset.count({ where: { collegeId: college.id } }),
      ]);
      return {
        collegeName: college.collegeName,
        collegeCode: college.collegeCode,
        manager: manager ? (manager.fullName || manager.username || manager.email || 'Unassigned') : 'Unassigned',
        departmentCount,
        staffCount,
        assetCount,
        status: college.status,
        createdAt: college.createdAt ? new Date(college.createdAt).toISOString() : '',
      };
    }));
    const csvHeaders = ['College Name', 'College Code', 'Manager', 'Department Count', 'Staff Count', 'Asset Count', 'Status', 'Created Date'];
    const lines = [csvHeaders.map((header) => `"${String(header || '').replace(/"/g, '""')}"`).join(',')];
    records.forEach((record) => {
      lines.push([
        record.collegeName,
        record.collegeCode,
        record.manager,
        record.departmentCount,
        record.staffCount,
        record.assetCount,
        record.status,
        record.createdAt,
      ].map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','));
    });
    const filename = `colleges-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(lines.join('\n'));
  } catch (error) { next(error); }
});

router.get('/colleges/:id/dashboard', ...requireAdmin, async (req, res, next) => {
  try {
    const college = await College.findByPk(req.params.id);
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    const [departments, activeDepartments, staff, activeStaff, assets, availableAssets, assignedAssets, maintenanceAssets, missingAssets, damagedAssets, locations, pendingRequests, pendingApprovals, recentActivity] = await Promise.all([
      Department.count({ where: { collegeId: college.id } }), Department.count({ where: { collegeId: college.id, status: 'active' } }), User.count({ where: { collegeId: college.id } }), User.count({ where: { collegeId: college.id, active: true } }), Asset.count({ where: { collegeId: college.id } }), Asset.count({ where: { collegeId: college.id, status: 'available' } }), Asset.count({ where: { collegeId: college.id, status: { [Op.in]: ['assigned', 'in-use', 'In-Use', 'Assigned'] } } }), Asset.count({ where: { collegeId: college.id, status: { [Op.in]: ['maintenance', 'under maintenance', 'in_maintenance'] } } }), Asset.count({ where: { collegeId: college.id, status: 'missing' } }), Asset.count({ where: { collegeId: college.id, status: 'damaged' } }), collegeLocations(college.id), Maintenance.count({ include: [{ model: Asset, required: true, where: { collegeId: college.id }, attributes: [] }], where: { status: 'pending' } }), Approval.count({ where: { status: 'pending' }, include: [{ model: Department, required: true, where: { collegeId: college.id }, attributes: [] }] }), AuditLog.findAll({ where: { entity: { [Op.like]: `college:${college.id}%` } }, order: [['createdAt', 'DESC']], limit: 20, raw: true }),
    ]);
    return res.json({ success: true, data: { college: await serializeCollege(college), statistics: { totalDepartments: departments, activeDepartments, totalStaff: staff, activeStaff, totalAssets: assets, availableAssets, assignedAssets, maintenanceAssets, missingAssets, damagedAssets, totalLocations: locations.length, pendingRequests, pendingApprovals }, departments: await Department.findAll({ where: { collegeId: college.id }, order: [['name', 'ASC']] }), recentActivity } });
  } catch (error) { next(error); }
});

router.get('/colleges/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const college = await College.findByPk(req.params.id);
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    const [data, statistics, departmentRows, staff, assets, locations, activity] = await Promise.all([
      serializeCollege(college),
      collegeStatistics(college.id),
      Department.findAll({ where: { collegeId: college.id }, include: [{ model: User, as: 'Head', attributes: ['id', 'fullName', 'username', 'role'] }], order: [['name', 'ASC']] }),
      User.findAll({ where: { collegeId: college.id }, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']] }),
      Asset.findAll({ where: { collegeId: college.id }, order: [['updatedAt', 'DESC']], limit: 100 }),
      collegeLocations(college.id),
      AuditLog.findAll({ where: { entity: { [Op.like]: `college:${college.id}%` } }, order: [['createdAt', 'DESC']], limit: 100, raw: true }),
    ]);
    const departments = await Promise.all(departmentRows.map(async (department) => {
      const [staffCount, assetCount] = await Promise.all([
        User.count({ where: { departmentId: department.id } }),
        Asset.count({ where: { departmentId: department.id, collegeId: college.id } }),
      ]);
      return { ...department.toJSON(), staffCount, assetCount };
    }));
    return res.json({ success: true, data: { ...data, statistics, departments, staff, assets, locations, activity }, college: data });
  } catch (error) { next(error); }
});

router.post('/colleges', ...requireAdmin, async (req, res, next) => {
  try {
    const payload = collegePayload(req.body);
    if (!payload.collegeCode || !payload.collegeName) return res.status(400).json({ success: false, message: 'College code and name are required' });
    if (!['active', 'inactive'].includes(payload.status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    if (await College.findOne({ where: { collegeCode: payload.collegeCode } })) return res.status(409).json({ success: false, message: 'College code already exists' });
    const managerValidation = await validateCollegeManager(payload.managerId);
    if (managerValidation.error) return res.status(400).json({ success: false, message: managerValidation.error });
    const campusValidation = await validateCollegeCampus(payload.campusId);
    if (campusValidation.error) return res.status(400).json({ success: false, message: campusValidation.error });
    const college = await College.create(payload);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_COLLEGE', entity: `college:${college.id}`, entityId: college.id, newValue: college.toJSON(), details: { legacyAction: 'COLLEGE_CREATED' } });
    if (college.managerId) await AuditLog.create({ userId: req.user.id, action: 'COLLEGE_MANAGER_ASSIGNED', entity: `college:${college.id}`, details: JSON.stringify({ managerId: college.managerId }) });
    const data = await serializeCollege(college);
    return res.status(201).json({ success: true, data, college: data });
  } catch (error) { next(error); }
});

router.put('/colleges/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const college = await College.findByPk(req.params.id);
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    const previousValue = college.toJSON();
    const payload = collegePayload(req.body, college.toJSON());
    if (!payload.collegeCode || !payload.collegeName) return res.status(400).json({ success: false, message: 'College code and name are required' });
    if (!['active', 'inactive'].includes(payload.status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    if (await College.findOne({ where: { collegeCode: payload.collegeCode, id: { [Op.ne]: college.id } } })) return res.status(409).json({ success: false, message: 'College code already exists' });
    const managerValidation = await validateCollegeManager(payload.managerId, college.id);
    if (managerValidation.error) return res.status(400).json({ success: false, message: managerValidation.error });
    const campusValidation = await validateCollegeCampus(payload.campusId);
    if (campusValidation.error) return res.status(400).json({ success: false, message: campusValidation.error });
    const previousManagerId = college.managerId;
    await college.update(payload);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_COLLEGE', entity: `college:${college.id}`, entityId: college.id, oldValue: previousValue, newValue: college.toJSON(), details: { legacyAction: 'COLLEGE_UPDATED' } });
    if (previousManagerId !== college.managerId) await AuditLog.create({ userId: req.user.id, action: college.managerId ? 'COLLEGE_MANAGER_ASSIGNED' : 'COLLEGE_MANAGER_CHANGED', entity: `college:${college.id}`, details: JSON.stringify({ previousManagerId, managerId: college.managerId }) });
    const data = await serializeCollege(college);
    return res.json({ success: true, data, college: data });
  } catch (error) { next(error); }
});

router.patch('/colleges/:id/status', ...requireAdmin, async (req, res, next) => {
  try {
    const college = await College.findByPk(req.params.id);
    if (!college) return res.status(404).json({ success: false, message: 'College not found' });
    const previousValue = college.toJSON();
    const status = String(req.body.status || '').toLowerCase();
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    const previousStatus = college.status;
    await college.update({ status });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_COLLEGE', entity: `college:${college.id}`, entityId: college.id, oldValue: previousValue, newValue: college.toJSON(), details: { legacyAction: status === 'active' ? 'COLLEGE_ACTIVATED' : 'COLLEGE_DEACTIVATED' } });
    const data = await serializeCollege(college);
    return res.json({ success: true, data, college: data });
  } catch (error) { next(error); }
});

const adminMaintenanceReadAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'college')];
const adminMaintenanceWriteAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance')];

router.get('/maintenance', ...adminMaintenanceReadAccess, maintenanceController.getAllMaintenance);
router.get('/maintenance/scheduled', ...adminMaintenanceReadAccess, maintenanceController.getAllMaintenance);
router.get('/maintenance/history', ...adminMaintenanceReadAccess, maintenanceController.getAllMaintenance);
router.get('/maintenance/dashboard', ...adminMaintenanceReadAccess, maintenanceController.dashboard);

router.post('/maintenance', ...adminMaintenanceReadAccess, maintenanceController.createMaintenance);
router.put('/maintenance/:id', ...adminMaintenanceWriteAccess, maintenanceController.updateMaintenance);
router.patch('/maintenance/:id/status', ...adminMaintenanceWriteAccess, maintenanceController.setStatus);
router.patch('/maintenance/:id/approve', ...adminMaintenanceWriteAccess, maintenanceController.approve);
router.patch('/maintenance/:id/reject', ...adminMaintenanceWriteAccess, maintenanceController.reject);
router.patch('/maintenance/:id/start', ...adminMaintenanceWriteAccess, maintenanceController.start);
router.post('/maintenance/:id/complete', ...adminMaintenanceWriteAccess, maintenanceController.complete);
router.post('/maintenance/:id/reassign', ...adminMaintenanceWriteAccess, maintenanceController.assign);
router.delete('/maintenance/:id', ...adminMaintenanceWriteAccess, maintenanceController.removeMaintenance);

router.get('/maintenance/costs', ...adminMaintenanceReadAccess, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const where = {};
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const category = String(req.query.category || req.query.costCategory || '').trim();
    if (search) where[Op.or] = [{ description: { [Op.like]: `%${search}%` } }, { notes: { [Op.like]: `%${search}%` } }];
    if (status) where.status = status;
    if (category) where.costCategory = category;
    const { count, rows } = await MaintenanceCost.findAndCountAll({ where, include: [
      { model: Maintenance, attributes: ['id', 'title', 'status', 'priority'] },
      { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location'] },
      { model: User, as: 'ApprovedByUser', attributes: ['id', 'username', 'fullName'] }
    ], order: [['costDate', 'DESC']], limit, offset });
    const data = rows.map((row) => normalizeMaintenanceCost(row));
    return res.json({ success: true, data, costs: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
});

router.get('/maintenance/costs/:id', ...adminMaintenanceReadAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceCost.findByPk(req.params.id, { include: [
      { model: Maintenance, attributes: ['id', 'title', 'status', 'priority'] },
      { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location'] },
      { model: User, as: 'ApprovedByUser', attributes: ['id', 'username', 'fullName'] }
    ] });
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance cost record not found' });
    return res.json({ success: true, data: normalizeMaintenanceCost(item), cost: normalizeMaintenanceCost(item) });
  } catch (error) { next(error); }
});

router.post('/maintenance/costs', ...adminMaintenanceWriteAccess, async (req, res, next) => {
  try {
    const maintenanceId = Number(req.body.maintenance_id || req.body.maintenanceId || req.body.maintenance || 0);
    const assetId = Number(req.body.asset_id || req.body.assetId);
    const costCategory = String(req.body.cost_category || req.body.costCategory || 'other').trim();
    const description = String(req.body.description || '').trim();
    const amount = Number(req.body.amount || req.body.total_cost || req.body.totalCost || 0);
    const quantity = Number(req.body.quantity || 1);
    const unitCost = Number(req.body.unit_cost || req.body.unitCost || amount || 0);
    const approvedBy = req.user.id;
    if (!assetId) return res.status(400).json({ success: false, message: 'Asset is required' });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
    if (!Number.isFinite(unitCost) || unitCost < 0) return res.status(400).json({ success: false, message: 'Unit cost must be a non-negative number' });
    const costDateRaw = req.body.cost_date || req.body.costDate;
    if (costDateRaw && Number.isNaN(Date.parse(costDateRaw))) return res.status(400).json({ success: false, message: 'Invalid cost date' });
    const assetRow = await Asset.findByPk(assetId);
    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (maintenanceId) {
      const maintenanceRow = await Maintenance.findByPk(maintenanceId);
      if (!maintenanceRow) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    }
    const item = await MaintenanceCost.create({ maintenanceId: maintenanceId || null, repairId: req.body.repair_id || req.body.repairId || null, workOrderId: req.body.work_order_id || req.body.workOrderId || null, assetId, costCategory, description, amount, quantity, unitCost, costDate: costDateRaw ? new Date(costDateRaw) : new Date(), approvedBy, status: String(req.body.status || 'pending'), notes: String(req.body.notes || '') });
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_COST_CREATED', entity: `maintenance_cost:${item.id}`, details: JSON.stringify({ assetId, amount, costCategory }) });
    return res.status(201).json({ success: true, data: normalizeMaintenanceCost(item), cost: normalizeMaintenanceCost(item) });
  } catch (error) { next(error); }
});

router.put('/maintenance/costs/:id', ...adminMaintenanceWriteAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceCost.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance cost record not found' });
    const nextAssetId = Number(req.body.asset_id || req.body.assetId || item.assetId);
    const nextQuantity = Number(req.body.quantity || item.quantity || 1);
    const nextUnitCost = Number(req.body.unit_cost || req.body.unitCost || item.unitCost || 0);
    const nextAmount = Number(req.body.amount || req.body.total_cost || req.body.totalCost || item.amount || 0);
    const costDateRaw = req.body.cost_date || req.body.costDate;
    if (!Number.isFinite(nextAmount) || nextAmount < 0) return res.status(400).json({ success: false, message: 'Amount must be a non-negative number' });
    if (!Number.isFinite(nextQuantity) || nextQuantity < 0) return res.status(400).json({ success: false, message: 'Quantity must be a non-negative number' });
    if (!Number.isFinite(nextUnitCost) || nextUnitCost < 0) return res.status(400).json({ success: false, message: 'Unit cost must be a non-negative number' });
    if (costDateRaw && Number.isNaN(Date.parse(costDateRaw))) return res.status(400).json({ success: false, message: 'Invalid cost date' });
    if (nextAssetId) {
      const assetRow = await Asset.findByPk(nextAssetId);
      if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    item.maintenanceId = Number(req.body.maintenance_id || req.body.maintenanceId || item.maintenanceId || 0) || null;
    item.repairId = Number(req.body.repair_id || req.body.repairId || item.repairId || 0) || null;
    item.workOrderId = Number(req.body.work_order_id || req.body.workOrderId || item.workOrderId || 0) || null;
    item.assetId = nextAssetId;
    item.costCategory = String(req.body.cost_category || req.body.costCategory || item.costCategory || 'other');
    item.description = String(req.body.description || item.description || '');
    item.amount = nextAmount;
    item.quantity = nextQuantity;
    item.unitCost = nextUnitCost;
    item.costDate = costDateRaw ? new Date(costDateRaw) : item.costDate || new Date();
    item.status = String(req.body.status || item.status || 'pending');
    item.notes = String(req.body.notes || item.notes || '');
    await item.save();
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_COST_UPDATED', entity: `maintenance_cost:${item.id}`, details: JSON.stringify({ assetId: item.assetId, amount: item.amount, costCategory: item.costCategory }) });
    return res.json({ success: true, data: normalizeMaintenanceCost(item), cost: normalizeMaintenanceCost(item) });
  } catch (error) { next(error); }
});

router.patch('/maintenance/costs/:id', ...adminMaintenanceWriteAccess, async (req, res, next) => {
  try {
    return router.handle({ method: 'PUT', path: req.path, body: req.body, params: req.params, query: req.query, user: req.user }, res, next);
  } catch (error) { next(error); }
});

router.delete('/maintenance/costs/:id', ...adminMaintenanceWriteAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceCost.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance cost record not found' });
    await item.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_COST_DELETED', entity: `maintenance_cost:${req.params.id}`, details: JSON.stringify({ assetId: item.assetId, amount: item.amount }) });
    return res.json({ success: true, message: 'Maintenance cost record deleted' });
  } catch (error) { next(error); }
});

router.get('/maintenance/:id', ...adminMaintenanceReadAccess, async (req, res, next) => {
  try {
    const item = await Maintenance.findByPk(req.params.id, {
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'warrantyExpiry'] },
        { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'department'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }
      ]
    });
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance request not found' });
    return res.json({ success: true, data: item.toJSON(), maintenance: item.toJSON() });
  } catch (error) { next(error); }
});

const buildDisposalWhere = (req) => {
  const where = {};
  const search = String(req.query.search || req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const collegeId = Number(req.query.collegeId || req.query.college_id || 0) || null;
  const departmentId = Number(req.query.departmentId || req.query.department_id || 0) || null;
  const categoryId = Number(req.query.categoryId || req.query.category_id || 0) || null;
  const locationId = Number(req.query.locationId || req.query.location_id || 0) || null;
  const disposalType = String(req.query.disposalType || req.query.type || '').trim();
  const condition = String(req.query.condition || '').trim();
  const dateFrom = String(req.query.dateFrom || req.query.date_from || '').trim();
  const dateTo = String(req.query.dateTo || req.query.date_to || '').trim();

  if (status) where.status = status;
  if (collegeId) where.collegeId = collegeId;
  if (departmentId) where.departmentId = departmentId;
  if (locationId) where.locationId = locationId;
  if (disposalType) where.type = disposalType;
  if (condition) where.condition = condition;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (search) {
    where[Op.or] = [
      { disposalNumber: { [Op.like]: `%${search}%` } },
      { reason: { [Op.like]: `%${search}%` } },
    ];
  }
  return where;
};

router.get('/rfid/scans', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 100));
    const where = {};
    if (req.query.asset_id) where.assetId = req.query.asset_id;
    if (req.query.tag || req.query.rfid_tag) where.tag = req.query.tag || req.query.rfid_tag;
    if (req.query.location || req.query.reader_location) where.location = req.query.location || req.query.reader_location;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) where[Op.or] = [
        { tag: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { action: { [Op.like]: `%${search}%` } }
      ];
    }

    const rows = await RFIDLog.findAll({
      where,
      include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'rfidTag'] }],
      order: [['createdAt', 'DESC']],
      limit,
    });

    const logs = rows.map((row) => serializeRfidScan(row));
    return res.json({ success: true, data: logs, logs, total: logs.length, pagination: { page: 1, limit, total: logs.length, pages: 1 } });
  } catch (error) { next(error); }
});

router.get('/rfid/assets', requireAuth, async (req, res, next) => {
  try {
    const assets = await Asset.findAll({
      where: { rfidTag: { [Op.ne]: '' } },
      order: [['updatedAt', 'DESC']],
      limit: Math.min(500, Math.max(1, Number(req.query.limit) || 100)),
      attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'department', 'location', 'status', 'condition', 'rfidTag', 'createdAt', 'updatedAt'],
    });
    const data = assets.map((asset) => ({
      id: asset.id,
      asset_id: asset.id,
      asset_name: asset.name,
      asset_code: asset.assetCode,
      rfid_tag: asset.rfidTag,
      location: asset.location,
      department: asset.department,
      category: asset.category,
      status: asset.status,
      tag_status: asset.rfidTag ? 'ACTIVE' : 'UNREGISTERED',
      timestamp: asset.updatedAt,
    }));
    return res.json({ success: true, data, assets: data, total: data.length, pagination: { page: 1, limit: data.length, total: data.length, pages: 1 } });
  } catch (error) { next(error); }
});

router.post('/rfid/tags', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), async (req, res, next) => {
  try {
    const assetId = Number(req.body.asset_id || req.body.assetId);
    const tag = String(req.body.rfid_tag || req.body.tag || '').trim();
    if (!assetId || !tag) return res.status(400).json({ success: false, message: 'Asset and RFID tag are required' });
    const asset = await Asset.findByPk(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (asset.rfidTag === tag) return res.status(409).json({ success: false, message: 'This RFID tag is already registered.' });
    const duplicate = await Asset.findOne({ where: { rfidTag: tag, id: { [Op.ne]: asset.id } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'This RFID tag is already registered.' });
    if (!asset.rfidTag || asset.rfidTag === '') {
      await asset.update({ rfidTag: tag });
    } else if (asset.rfidTag !== tag) {
      return res.status(409).json({ success: false, message: 'RFID tag is already registered to this asset' });
    }
    await RFIDLog.create({ assetId: asset.id, tag, action: 'register', location: req.body.location || asset.location || '', notes: req.body.notes || 'RFID tag registered' });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_TAG_REGISTERED', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, tag, location: req.body.location || asset.location || '' }) });
    return res.status(201).json({ success: true, data: { id: asset.id, asset_id: asset.id, rfid_tag: tag, asset_code: asset.assetCode, asset_name: asset.name }, asset: { id: asset.id, assetCode: asset.assetCode, name: asset.name, rfidTag: tag } });
  } catch (error) { next(error); }
});

router.get('/procurement', ...requireAdmin, async (req, res, next) => {
  try {
    const { PurchaseOrder, PurchaseOrderItem, Department, User } = require('../models');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 500));
    const where = {};
    const search = String(req.query.search || '').trim();
    if (search) where[Op.or] = [{ poNumber: { [Op.like]: `%${search}%` } }, { supplierName: { [Op.like]: `%${search}%` } }];
    const status = String(req.query.status || '').trim();
    if (status) where.status = status;
    const departmentId = Number(req.query.department_id || req.query.departmentId);
    if (departmentId) where.departmentId = departmentId;
    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where,
      order: [['orderDate', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      include: [
        { model: PurchaseOrderItem, as: 'items', attributes: ['id', 'itemName', 'quantity', 'unitPrice', 'lineTotal'] },
        { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name'] },
        { model: User, as: 'Creator', attributes: ['id', 'username', 'fullName'] },
      ],
    });
    const data = rows.map((order) => ({
      id: order.id,
      po_number: order.poNumber,
      order_no: order.poNumber,
      supplier: order.supplierName,
      supplier_name: order.supplierName,
      department: order.DepartmentRecord?.name || '',
      department_name: order.DepartmentRecord?.name || '',
      status: order.status,
      order_date: order.orderDate,
      expected_delivery: order.expectedDeliveryDate,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      tax: Number(order.taxAmount),
      discount: Number(order.discountAmount),
      total_cost: Number(order.totalAmount),
      totalCost: Number(order.totalAmount),
      amount: Number(order.totalAmount),
      items: (order.items || []).length,
      items_count: (order.items || []).length,
      created_by: order.Creator?.fullName || order.Creator?.username || '',
      created_at: order.createdAt,
    }));
    return res.json({ success: true, data, procurement: data, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
});

router.get('/analytics', ...requireAdmin, async (req, res, next) => {
  try {
    const { getAssetAnalytics } = require('../services/analyticsService');
    const { Assignment, Transfer, Maintenance } = require('../models');
    const reportCategory = String(req.query.report || req.query.reportCategory || 'overview');
    const analytics = await getAssetAnalytics(req.query);
    const [assignmentCount, transferCount, maintenanceCount] = await Promise.all([
      Assignment.count(),
      Transfer.count(),
      Maintenance.count(),
    ]);
    const kpiRows = Object.entries(analytics.kpis || {}).map(([metric, value]) => ({ metric, value, label: metric.replace(/([A-Z])/g, ' $1') }));
    let rows;
    if (reportCategory === 'asset_trend') {
      rows = (analytics.categories || []).map((row) => ({ category: row.category || 'Uncategorised', assets: row.count, value: row.value }));
    } else if (reportCategory === 'assignment_trend') {
      rows = [...(analytics.trends?.assignments || []).map((row) => ({ period: row.period, assignments: row.count })), { period: 'Total', assignments: assignmentCount }];
    } else if (reportCategory === 'maintenance_trend') {
      rows = [...(analytics.trends?.maintenance || []).map((row) => ({ period: row.period, maintenance: row.count })), { period: 'Total', maintenance: maintenanceCount }];
    } else if (reportCategory === 'transfer_trend') {
      rows = [...(analytics.trends?.transfers || []).map((row) => ({ period: row.period, transfers: row.count })), { period: 'Total', transfers: transferCount }];
    } else if (reportCategory === 'procurement_trend') {
      const { PurchaseOrder } = require('../models');
      const statuses = await PurchaseOrder.findAll({ attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']], group: ['status'], order: [['status', 'ASC']], raw: true });
      rows = [...statuses.map((row) => ({ status: row.status || 'Unknown', count: Number(row.count) })), { status: 'Total', count: statuses.reduce((sum, row) => sum + Number(row.count), 0) }];
    } else if (reportCategory === 'financial_trend') {
      rows = Object.entries(analytics.kpis || {}).filter(([metric]) => /value/i.test(metric)).map(([metric, value]) => ({ metric, value }));
    } else if (reportCategory === 'department_performance') {
      rows = (analytics.organizations?.departmentPerformance || []).map((row) => ({ department: row.name || 'Unassigned', assets: row.count, value: row.value }));
    } else {
      rows = kpiRows;
    }
    const list = Array.isArray(rows) ? rows : [];
    return res.json({ success: true, data: list, analytics: list, total: list.length });
  } catch (error) { next(error); }
});

const DISPOSAL_SORT_FIELDS = ['createdAt', 'updatedAt', 'id', 'status', 'type', 'condition', 'disposalNumber', 'scheduledDate', 'completedDate', 'purchaseValue', 'bookValue', 'netBookValue', 'estimatedDisposalValue', 'disposalCost'];
const disposalAccess = [requireAuth, requireRole('admin', 'store_manager', 'ict_officer', 'finance')];

router.get('/disposals', ...disposalAccess, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const requestedSort = String(req.query.sortBy || req.query.sort_by || 'createdAt');
    const sortBy = DISPOSAL_SORT_FIELDS.includes(requestedSort) ? requestedSort : 'createdAt';
    const sortOrder = String(req.query.sortOrder || req.query.sort_order || 'DESC').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const where = buildDisposalWhere(req);

    const rows = await DisposalRequest.findAndCountAll({
      where,
      order: [[sortBy, sortOrder]],
      limit,
      offset: (page - 1) * limit,
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'condition', 'location', 'department', 'collegeId', 'departmentId'] },
        { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Approver', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Executor', attributes: ['id', 'username', 'fullName'] },
      ],
    });

    const data = rows.rows.map((row) => normalizeDisposalRequest(row));
    res.json({
      success: true,
      data,
      disposals: data,
      summary: {
        total: rows.count,
        totalRequests: rows.count,
        totalPages: Math.ceil(rows.count / limit),
      },
      pagination: {
        page,
        limit,
        total: rows.count,
        totalPages: Math.ceil(rows.count / limit),
        pages: Math.ceil(rows.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/disposals/:id', ...disposalAccess, async (req, res, next) => {
  try {
    const row = await DisposalRequest.findByPk(req.params.id, {
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'condition', 'location', 'department', 'collegeId', 'departmentId'] },
        { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Approver', attributes: ['id', 'username', 'fullName'] },
        { model: User, as: 'Executor', attributes: ['id', 'username', 'fullName'] },
      ],
    });
    if (!row) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    return res.json({ success: true, data: normalizeDisposalRequest(row), disposal: normalizeDisposalRequest(row) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals', ...disposalAccess, async (req, res, next) => {
  try {
    const { assetId, type = 'Disposal', condition = 'Poor', reason } = req.body;
    if (!assetId || !String(reason || '').trim()) return res.status(400).json({ success: false, message: 'Asset and reason are required' });
    const asset = await Asset.findByPk(assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const year = new Date().getFullYear();
    const serial = await DisposalRequest.count({}) || 0;
    const disposalNumber = `DSP-${year}-${String(serial + 1).padStart(6, '0')}`;

    const request = await DisposalRequest.create({
      disposalNumber,
      assetId: asset.id,
      collegeId: asset.collegeId || null,
      departmentId: asset.departmentId || null,
      locationId: null,
      type,
      status: 'Requested',
      condition,
      reason: String(reason).trim(),
      technicalAssessment: String(req.body.technicalAssessment || '').trim(),
      requestedBy: req.user.id,
      purchaseValue: Number(asset.purchaseCost || asset.purchaseValue || 0),
      bookValue: Number(asset.currentValue || asset.bookValue || 0),
      accumulatedDepreciation: 0,
      netBookValue: Number(asset.currentValue || asset.bookValue || 0),
      estimatedDisposalValue: 0,
      recoveryValue: 0,
      disposalCost: 0,
    });

    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: null, newValue: request.toJSON(), details: { assetId: asset.id, operation: 'request', legacyAction: 'DISPOSAL_REQUEST_CREATED' } });
    return res.status(201).json({ success: true, data: normalizeDisposalRequest(request), disposal: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/review', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const previousValue = request.toJSON();
    request.reviewedBy = req.user.id;
    request.status = 'Under Review';
    await request.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: previousValue, newValue: request.toJSON(), details: { operation: 'review', legacyAction: 'DISPOSAL_REVIEW_STARTED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/approve', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    if (String(request.requestedBy) === String(req.user.id)) return res.status(409).json({ success: false, message: 'Self-approval is not allowed' });
    const previousValue = request.toJSON();
    request.approvedBy = req.user.id;
    request.status = 'Approved';
    await request.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: previousValue, newValue: request.toJSON(), details: { operation: 'approve', legacyAction: 'DISPOSAL_APPROVED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/reject', ...disposalAccess, async (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const previousValue = request.toJSON();
    request.status = 'Rejected';
    request.rejectionReason = reason;
    await request.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: previousValue, newValue: request.toJSON(), details: { operation: 'reject', reason, legacyAction: 'DISPOSAL_REJECTED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/schedule', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const previousValue = request.toJSON();
    request.status = 'Scheduled';
    request.scheduledDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : new Date();
    request.notes = String(req.body.notes || request.notes || '');
    await request.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: previousValue, newValue: request.toJSON(), details: { operation: 'schedule', legacyAction: 'DISPOSAL_SCHEDULED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/retire', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const asset = await Asset.findByPk(request.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const previousValue = { asset: asset.toJSON(), disposal: request.toJSON() };
    request.status = 'Retired';
    await request.save();
    asset.status = 'retired';
    await asset.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: { asset: asset.toJSON(), disposal: request.toJSON() }, details: { disposalId: request.id, disposalNumber: request.disposalNumber, operation: 'retire', legacyAction: 'ASSET_RETIRED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/execute', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const asset = await Asset.findByPk(request.assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    const previousValue = { asset: asset.toJSON(), disposal: request.toJSON() };
    request.status = 'Disposed';
    request.executedBy = req.user.id;
    request.completedDate = new Date();
    await request.save();
    asset.status = 'disposed';
    await asset.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: { asset: asset.toJSON(), disposal: request.toJSON() }, details: { disposalId: request.id, disposalNumber: request.disposalNumber, operation: 'dispose', legacyAction: 'ASSET_DISPOSED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.post('/disposals/:id/cancel', ...disposalAccess, async (req, res, next) => {
  try {
    const reason = String(req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    const previousValue = request.toJSON();
    request.status = 'Cancelled';
    request.cancellationReason = reason;
    await request.save();
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'DISPOSE_ASSET', entity: `disposal:${request.id}`, entityId: request.id, oldValue: previousValue, newValue: request.toJSON(), details: { operation: 'cancel', reason, legacyAction: 'DISPOSAL_CANCELLED' } });
    return res.json({ success: true, data: normalizeDisposalRequest(request) });
  } catch (error) {
    next(error);
  }
});

router.get('/disposals/:id/history', ...disposalAccess, async (req, res, next) => {
  try {
    const request = await DisposalRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Disposal request not found' });
    return res.json({ success: true, data: [{ action: request.status, ts: request.updatedAt || request.createdAt, details: request.reason }], history: [{ action: request.status, ts: request.updatedAt || request.createdAt, details: request.reason }] });
  } catch (error) {
    next(error);
  }
});

router.get('/departments', requireAuth, async (req, res, next) => {
  try {
    const records = await Department.findAll({ order: [['name', 'ASC']] });
    const departments = await Promise.all(records.map(normalizeDepartment));
    res.json({ success: true, data: departments, departments });
  } catch (error) { next(error); }
});

router.post('/departments', ...requireAdmin, async (req, res, next) => {
  try {
    const validation = await validateDepartment(req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const department = await Department.create(validation.value);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'CREATE_DEPARTMENT', entity: `department:${department.id}`, entityId: department.id, newValue: department.toJSON(), details: { name: department.name, code: department.code, legacyAction: 'DEPARTMENT_CREATED' } });
    res.status(201).json({ success: true, data: await normalizeDepartment(department) });
  } catch (error) { next(error); }
});

router.put('/departments/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    const validation = await validateDepartment(req.body, req.params.id);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });
    const previous = department.toJSON();
    await department.update(validation.value);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'UPDATE_DEPARTMENT', entity: `department:${department.id}`, entityId: department.id, oldValue: previous, newValue: department.toJSON(), details: { legacyAction: 'DEPARTMENT_UPDATED' } });
    res.json({ success: true, data: await normalizeDepartment(department) });
  } catch (error) { next(error); }
});

router.delete('/departments/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const department = await Department.findByPk(req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found' });
    const [userCount, assetCount] = await Promise.all([
      User.count({ where: { department: department.name } }),
      Asset.count({ where: { department: department.name } }),
    ]);
    if (userCount || assetCount) return res.status(409).json({ success: false, message: 'Department has users or assets and cannot be deleted', userCount, assetCount });
    await department.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_DELETED', entity: `department:${department.id}`, details: JSON.stringify({ name: department.name, code: department.code }) });
    res.json({ success: true });
  } catch (error) { next(error); }
});

const normalizeCategoryItem = async (category) => {
  const categoryData = category.toJSON ? category.toJSON() : { ...category };
  const [assetCount, activeAssetCount] = await Promise.all([
    Asset.count({ where: { category: categoryData.name } }),
    Asset.count({
      where: {
        category: categoryData.name,
        [Op.or]: [
          { status: { [Op.notIn]: ['retired', 'disposed', 'decommissioned'] } },
          { status: { [Op.is]: null } },
        ],
      },
    }),
  ]);
  return {
    ...categoryData,
    id: categoryData.id,
    name: categoryData.name,
    code: categoryData.code || '',
    description: categoryData.description || '',
    icon: categoryData.icon || 'layers',
    status: categoryData.status || 'active',
    assetCount,
    activeAssetCount,
    created_at: categoryData.createdAt || categoryData.created_at || null,
    updated_at: categoryData.updatedAt || categoryData.updated_at || null,
    createdAt: categoryData.createdAt || categoryData.created_at || null,
    updatedAt: categoryData.updatedAt || categoryData.updated_at || null,
  };
};

const findCategoryDuplicate = (field, value, exceptId) => Category.findOne({
  where: {
    [Op.and]: [
      Sequelize.where(Sequelize.fn('LOWER', Sequelize.col(field)), value.toLowerCase()),
      ...(exceptId ? [{ id: { [Op.ne]: exceptId } }] : []),
    ],
  },
});

const categoryAuditValue = (category) => ({
  id: category.id,
  name: category.name,
  code: category.code || '',
  description: category.description || '',
  icon: category.icon || 'package',
  status: category.status,
});

const buildCategoryWhere = (req) => {
  const where = {};
  const search = String(req.query.search || req.query.q || '').trim();
  const status = String(req.query.status || '').trim();

  if (status) {
    where.status = String(status).toLowerCase() === 'active' ? 'active' : 'inactive';
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { code: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  return where;
};

router.get(['/categories', '/asset-categories'], requireAuth, requirePermission('assets.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const sortBy = String(req.query.sortBy || req.query.sort_by || 'name');
    const sortOrder = String(req.query.sortOrder || req.query.sort_order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const where = buildCategoryWhere(req);

    const orderFieldMap = {
      name: 'name',
      code: 'code',
      status: 'status',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      assets: 'name',
    };

    const orderField = orderFieldMap[sortBy] || 'name';
    const { count, rows } = await Category.findAndCountAll({
      where,
      order: [[orderField, sortOrder]],
      limit,
      offset: (page - 1) * limit,
      raw: true,
    });

    const items = await Promise.all(rows.map((category) => normalizeCategoryItem(category)));
    const activeCount = await Category.count({ where: { status: 'active' } });
    const inactiveCount = await Category.count({ where: { status: 'inactive' } });
    const categorizedAssets = await Asset.count({ where: { category: { [Op.ne]: '' } } });

    const response = {
      success: true,
      items,
      data: items,
      categories: items,
      summary: {
        total: count,
        active: activeCount,
        inactive: inactiveCount,
        categorizedAssets,
      },
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
        pages: Math.max(1, Math.ceil(count / limit)),
      },
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.get(['/categories/:id', '/asset-categories/:id'], requireAuth, requirePermission('assets.view'), async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    const item = await normalizeCategoryItem(category);
    return res.json({ success: true, data: item, category: item });
  } catch (error) {
    return next(error);
  }
});

router.post(['/categories', '/asset-categories'], ...requireAdmin, requirePermission('assets.create'), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code || '').trim().toUpperCase() || null;
    const description = String(req.body.description || '').trim();
    const icon = String(req.body.icon || req.body.iconName || 'package').trim().toLowerCase();
    const status = String(req.body.status || 'active').trim().toLowerCase();

    if (!name) return res.status(400).json({ success: false, message: 'Category name is required' });
    if (name.length < 2 || name.length > 120) return res.status(400).json({ success: false, message: 'Category name must be between 2 and 120 characters' });
    if (code && (code.length > 80 || !/^[A-Z0-9-]+$/.test(code))) return res.status(400).json({ success: false, message: 'Category code may contain only uppercase letters, numbers, and hyphens' });
    if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'A valid category status is required' });
    if (await findCategoryDuplicate('name', name)) return res.status(409).json({ success: false, message: 'Category name already exists' });
    if (code && await findCategoryDuplicate('code', code)) return res.status(409).json({ success: false, message: 'Category code already exists' });

    const transaction = await sequelize.transaction();
    try {
      const category = await Category.create({ name, code, description, icon, status }, { transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'ASSET_CATEGORY_CREATED',
        entity: `category:${category.id}`,
        entityId: category.id,
        newValue: categoryAuditValue(category),
        transaction,
      });
      await transaction.commit();
      const item = await normalizeCategoryItem(category);
      return res.status(201).json({ success: true, data: item, category: item });
    } catch (error) {
      await transaction.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Category name or code already exists' });
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

const updateCategory = async (req, res, next) => {
  try {
    const transaction = await sequelize.transaction();
    try {
      const category = await Category.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!category) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      const previousValue = categoryAuditValue(category);
      const name = String(req.body.name ?? category.name).trim();
      const code = String(req.body.code ?? category.code ?? '').trim().toUpperCase() || null;
      const description = String(req.body.description ?? category.description ?? '').trim();
      const icon = String(req.body.icon ?? req.body.iconName ?? category.icon ?? 'package').trim().toLowerCase();
      const status = String(req.body.status ?? category.status ?? 'active').trim().toLowerCase();

      if (!name) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      if (name.length < 2 || name.length > 120) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Category name must be between 2 and 120 characters' });
      }
      if (code && (code.length > 80 || !/^[A-Z0-9-]+$/.test(code))) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Category code may contain only uppercase letters, numbers, and hyphens' });
      }
      if (!['active', 'inactive'].includes(status)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'A valid category status is required' });
      }
      if (await findCategoryDuplicate('name', name, category.id)) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: 'Category name already exists' });
      }
      if (code && await findCategoryDuplicate('code', code, category.id)) {
        await transaction.rollback();
        return res.status(409).json({ success: false, message: 'Category code already exists' });
      }

      await category.update({ name, code, description, icon, status }, { transaction });
      if (previousValue.name !== name) {
        await Asset.update(
          { category: name },
          { where: { category: previousValue.name }, transaction },
        );
      }

      const action = previousValue.status === status
        ? 'ASSET_CATEGORY_UPDATED'
        : status === 'active' ? 'ASSET_CATEGORY_ACTIVATED' : 'ASSET_CATEGORY_DEACTIVATED';
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action,
        entity: `category:${category.id}`,
        entityId: category.id,
        oldValue: previousValue,
        newValue: categoryAuditValue(category),
        transaction,
      });
      await transaction.commit();
      const item = await normalizeCategoryItem(category);
      return res.json({ success: true, data: item, category: item });
    } catch (error) {
      await transaction.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ success: false, message: 'Category name or code already exists' });
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};

router.put(['/categories/:id', '/asset-categories/:id'], ...requireAdmin, requirePermission('assets.update'), updateCategory);
router.patch(['/categories/:id', '/asset-categories/:id'], ...requireAdmin, requirePermission('assets.update'), updateCategory);

router.delete(['/categories/:id', '/asset-categories/:id'], ...requireAdmin, requirePermission('assets.delete'), async (req, res, next) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    const assetCount = await Asset.count({ where: { category: category.name } });
    if (assetCount > 0) {
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'ASSET_CATEGORY_DELETE_BLOCKED',
        entity: `category:${category.id}`,
        entityId: category.id,
        oldValue: categoryAuditValue(category),
        details: { assetCount, outcome: 'blocked' },
      });
      return res.status(409).json({ success: false, message: `This category is currently used by ${assetCount} assets. Deactivate the category instead of deleting it.` });
    }

    const previousValue = categoryAuditValue(category);
    const transaction = await sequelize.transaction();
    try {
      await category.destroy({ transaction });
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'ASSET_CATEGORY_DELETED',
        entity: `category:${category.id}`,
        entityId: category.id,
        oldValue: previousValue,
        newValue: null,
        transaction,
      });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    return next(error);
  }
});

const notificationReadAccess = [requireAuth, requireAnyPermission('notifications.view', 'notifications.manage')];
const notificationDeleteAccess = [requireAuth, requireAnyPermission('notifications.delete', 'notifications.manage')];
const parseNotificationId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const serializeNotification = (notification) => {
  const value = notification.toJSON();
  return {
    id: value.id,
    title: value.title,
    message: value.message,
    type: value.type,
    priority: value.priority,
    status: value.status,
    read: Boolean(value.read),
    is_read: Boolean(value.read),
    createdAt: value.createdAt,
    created_at: value.createdAt,
    readAt: value.readAt,
    read_at: value.readAt,
    actionUrl: value.actionUrl,
    action_url: value.actionUrl,
  };
};

router.get('/notifications', ...notificationReadAccess, async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: buildNotificationVisibilityWhere(req.user),
      order: [['createdAt', 'DESC']],
    });
    const normalized = notifications.map(serializeNotification);
    res.json({ success: true, data: normalized, notifications: normalized });
  } catch (error) { next(error); }
});

router.put('/notifications/:id/read', ...notificationReadAccess, async (req, res, next) => {
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user)] },
    });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    await notification.update({ read: true, readAt: new Date() });
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.put('/notifications/read-all', ...notificationReadAccess, async (req, res, next) => {
  try {
    await Notification.update(
      { read: true, readAt: new Date() },
      { where: { [Op.and]: [buildNotificationVisibilityWhere(req.user), { read: false }] } },
    );
    res.json({ success: true });
  } catch (error) { next(error); }
});

router.delete('/notifications/all', requireAuth, requireRole('admin'), async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const where = { [Op.or]: [{ userId: null }, { userId: req.user.id }] };
    const notifications = await Notification.findAll({ where, attributes: ['id'], transaction });
    const ids = notifications.map((notification) => notification.id);
    const deliveryRecordsDeleted = ids.length
      ? await NotificationDelivery.destroy({ where: { notificationId: { [Op.in]: ids } }, transaction })
      : 0;
    const deletedCount = ids.length
      ? await Notification.destroy({ where: { id: { [Op.in]: ids } }, transaction })
      : 0;
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'NOTIFICATIONS_BULK_DELETED',
      entity: 'notifications:all',
      details: { deletedCount, deliveryRecordsDeleted },
      transaction,
    });
    await transaction.commit();
    res.json({ success: true });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
});

router.delete('/notifications/:id', ...notificationDeleteAccess, async (req, res, next) => {
  let transaction;
  try {
    const id = parseNotificationId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    transaction = await sequelize.transaction();
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildNotificationVisibilityWhere(req.user)] },
      transaction,
    });
    if (!notification) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Notification not found or not authorized' });
    }
    const deliveryRecordsDeleted = await NotificationDelivery.destroy({ where: { notificationId: id }, transaction });
    await notification.destroy({ transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'NOTIFICATION_DELETED',
      entity: `notification:${id}`,
      entityId: id,
      oldValue: { title: notification.title, type: notification.type, priority: notification.priority, scope: notification.scope },
      details: { deliveryRecordsDeleted },
      transaction,
    });
    await transaction.commit();
    res.json({ success: true });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
});

const normalizeAuditDetails = (details) => {
  try {
    const parsed = typeof details === 'string' ? JSON.parse(details) : details;
    const removeSecrets = (value) => {
      if (!value || typeof value !== 'object') return value;
      if (Array.isArray(value)) return value.map(removeSecrets);
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => !/password|token|secret|api.?key/i.test(key))
        .map(([key, value]) => [key, removeSecrets(value)]));
    };
    return removeSecrets(parsed || {});
  } catch (error) {
    return {};
  }
};

const normalizeAuditLog = (log) => {
  const value = log.toJSON ? log.toJSON() : log;
  const associatedUser = value.user || value.User || null;
  const { User, user: ignoredUser, ...auditValue } = value;
  const [resourceType = '', resourceId = ''] = String(value.entity || '').split(':');
  const details = normalizeAuditDetails(value.details);
  return {
    ...auditValue,
    user: associatedUser,
    userRole: associatedUser?.role || null,
    module: resourceType || 'system',
    resourceType: resourceType || 'system',
    resourceId: resourceId || null,
    description: details.reason || details.comment || value.action,
    result: details.result || 'Success',
    ipAddress: details.ipAddress || details.ip || null,
    timestamp: value.createdAt,
    created_at: value.createdAt,
    details: JSON.stringify(details),
  };
};

const getAuditWhere = (query) => {
  const { search = '', action = '', module = '', user = '', dateFrom = '', dateTo = '' } = query;
  const where = {};
  const normalizedSearch = String(search).trim();
  if (action) where.action = action;
  if (module) where.entity = { [Op.like]: `%${String(module).trim()}%` };
  if (user && Number.isInteger(Number(user))) where.userId = Number(user);
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo) where.createdAt[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (normalizedSearch) {
    where[Op.or] = [
      { action: { [Op.like]: `%${normalizedSearch}%` } },
      { entity: { [Op.like]: `%${normalizedSearch}%` } },
      { details: { [Op.like]: `%${normalizedSearch}%` } },
    ];
  }
  return where;
};

const auditInclude = [{ model: User, attributes: ['id', 'username', 'fullName', 'role'] }];

router.get(['/audit', '/audit-logs'], ...requireAdmin, async (req, res, next) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
    const { count, rows } = await AuditLog.findAndCountAll({
      where: getAuditWhere(req.query),
      include: auditInclude,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });
    const logs = rows.map(normalizeAuditLog);
    const pagination = { page: currentPage, limit: pageSize, total: count, pages: Math.max(1, Math.ceil(count / pageSize)) };
    res.json({ success: true, data: logs, logs, total: count, pagination });
  } catch (error) { next(error); }
});

const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

router.get(['/audit/export', '/audit-logs/export'], ...requireAdmin, async (req, res, next) => {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    if (!['json', 'csv'].includes(format)) return res.status(400).json({ success: false, message: 'Export format must be json or csv' });
    const rows = await AuditLog.findAll({ where: getAuditWhere(req.query), include: auditInclude, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
    const logs = rows.map(normalizeAuditLog);
    const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (format === 'json') return res.json({ success: true, total: logs.length, logs });
    const headers = ['Timestamp', 'User', 'Role', 'Action', 'Module', 'Resource Type', 'Resource ID', 'Result', 'IP Address', 'Details'];
    const lines = [headers.map(csvValue).join(',')];
    logs.forEach((log) => lines.push([
      log.timestamp, log.user?.username, log.userRole, log.action, log.module,
      log.resourceType, log.resourceId, log.result, log.ipAddress, log.details,
    ].map(csvValue).join(',')));
    res.type('text/csv').send(lines.join('\n'));
  } catch (error) { next(error); }
});

router.get('/audit/retention', ...requireAdmin, async (req, res, next) => {
  try {
    const days = 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const pending = await AuditLog.count({ where: { createdAt: { [Op.lt]: cutoff } } });
    const archived = await AuditLogArchive.count();
    res.json({ success: true, policy: { archiveAfterDays: days }, cutoff, pending, archived });
  } catch (error) { next(error); }
});

router.post('/audit/archive', ...requireAdmin, async (req, res, next) => {
  try {
    const days = Number.isFinite(Number(req.body.days)) ? Math.max(1, Number(req.body.days)) : 90;
    const cutoff = req.body.before ? new Date(req.body.before) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (Number.isNaN(cutoff.getTime())) return res.status(400).json({ success: false, message: 'A valid archive cutoff date is required' });
    const candidates = await AuditLog.findAll({ where: { createdAt: { [Op.lt]: cutoff } }, order: [['id', 'ASC']] });
    if (req.body.dryRun !== false) return res.json({ success: true, dryRun: true, cutoff, eligible: candidates.length });
    if (req.body.confirm !== true) return res.status(400).json({ success: false, message: 'Explicit confirmation is required to archive audit logs' });
    const transaction = await sequelize.transaction();
    try {
      await AuditLogArchive.bulkCreate(candidates.map((log) => ({
        originalId: log.id,
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        details: normalizeAuditLog(log).details,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
        archivedAt: new Date(),
      })), { ignoreDuplicates: true, transaction });
      const archivedCount = await AuditLog.destroy({
        where: { id: candidates.map((log) => log.id) },
        transaction,
        auditRetentionArchive: true,
      });
      await AuditLog.create({ userId: req.user.id, action: 'AUDIT_LOGS_ARCHIVED', entity: 'audit_logs', details: JSON.stringify({ cutoff, archivedCount }) }, { transaction });
      await transaction.commit();
      res.json({ success: true, dryRun: false, cutoff, archived: archivedCount });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) { next(error); }
});

router.get('/audit/stream', ...requireAdmin, async (req, res, next) => {
  try {
    let cursor = Number.parseInt(req.query.since, 10);
    if (!Number.isInteger(cursor)) cursor = (await AuditLog.max('id')) || 0;
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.flushHeaders();
    res.write(`event: ready\ndata: ${JSON.stringify({ since: cursor })}\n\n`);
    const timer = setInterval(async () => {
      try {
        const rows = await AuditLog.findAll({ where: { id: { [Op.gt]: cursor } }, include: auditInclude, order: [['id', 'ASC']], limit: 50 });
        rows.forEach((row) => { cursor = row.id; res.write(`event: audit\ndata: ${JSON.stringify(normalizeAuditLog(row))}\n\n`); });
        if (rows.length === 0) res.write(': keep-alive\n\n');
      } catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'Audit stream unavailable' })}\n\n`);
      }
    }, 2000);
    req.on('close', () => clearInterval(timer));
  } catch (error) { next(error); }
});

const SETTINGS_FIELDS = ['university_name', 'institution_name', 'website', 'logo_url', 'favicon_url', 'address', 'contact_phone', 'contact_email', 'organization_code', 'description', 'asset_code_format', 'default_currency', 'date_format', 'time_format', 'number_format', 'language', 'timezone', 'theme', 'sidebar_behavior', 'dashboard_layout', 'maintenance_alerts', 'rfid_alerts', 'missing_asset_alerts', 'warranty_alerts', 'financial_alerts', 'assignment_alerts', 'transfer_alerts', 'security_alerts', 'asset_statuses', 'condition_types', 'warranty_default_months', 'useful_life_default_years', 'rfid_enabled', 'rfid_format', 'rfid_scan_interval', 'rfid_location_tracking', 'rfid_missing_detection', 'rfid_alert_threshold', 'maintenance_default_priority', 'maintenance_reminder_days', 'maintenance_overdue_days', 'fiscal_year', 'tax_rate', 'depreciation_method', 'financial_approval_threshold', 'budget_warning_threshold', 'report_default_format', 'report_default_date_range', 'report_page_size', 'report_footer', 'workflow_asset_request', 'workflow_assignment', 'workflow_transfer', 'workflow_return', 'workflow_maintenance', 'workflow_purchase', 'workflow_financial_approval', 'workflow_retirement', 'smtp_host', 'smtp_port', 'smtp_sender_name', 'smtp_sender_email', 'smtp_encryption', 'audit_login', 'audit_logout', 'audit_crud', 'audit_operations', 'audit_financial', 'audit_settings', 'monitoring_refresh_seconds', 'error_monitoring_enabled', 'cleanup_enabled', 'archive_after_days', 'notification_enabled', 'notification_email', 'notification_sms'];
const SECURITY_FIELDS = ['password_min_length', 'password_require_uppercase', 'password_require_lowercase', 'password_require_numbers', 'password_require_special', 'session_timeout', 'max_login_attempts', 'account_lockout_duration', 'two_factor_auth', 'jwt_expiry', 'ip_whitelist', 'enable_audit_log'];
const DEFAULT_SECURITY_SETTINGS = { password_min_length: 8, password_require_uppercase: true, password_require_lowercase: true, password_require_numbers: true, password_require_special: true, session_timeout: 60, max_login_attempts: 5, account_lockout_duration: 30, two_factor_auth: false, jwt_expiry: 7, ip_whitelist: '', enable_audit_log: true };

router.get('/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const record = await Config.findByPk('system');
    const settings = record ? JSON.parse(record.value) : {};
    res.json({ success: true, settings });
  } catch (error) { next(error); }
});

router.put('/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = Object.fromEntries(SETTINGS_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    if (settings.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.contact_email))) return res.status(400).json({ success: false, message: 'Invalid contact email' });
    if (settings.website) {
      try {
        const website = new URL(String(settings.website));
        if (!['http:', 'https:'].includes(website.protocol)) throw new Error('Unsupported protocol');
      } catch (error) {
        return res.status(400).json({ success: false, message: 'Website must be a valid HTTP or HTTPS URL' });
      }
    }
    const record = await Config.findByPk('system');
    const previous = record ? JSON.parse(record.value) : {};
    const nextSettings = { ...previous, ...settings };
    const versionNumber = (await SettingsVersion.max('versionNumber', { where: { settingsType: 'system' } }) || 0) + 1;
    await SettingsVersion.create({ settingsType: 'system', versionNumber, settingsJson: JSON.stringify(previous), changedBy: req.user.id, changeReason: String(req.body.change_reason || 'System settings updated').slice(0, 255) });
    if (record) await record.update({ value: JSON.stringify(nextSettings) });
    else await Config.create({ key: 'system', value: JSON.stringify(nextSettings) });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_CHANGED', entity: 'settings:system', details: JSON.stringify({ changed: Object.keys(settings), previous, next: nextSettings }) });
    res.json({ success: true, settings: nextSettings });
  } catch (error) { next(error); }
});

router.get('/security/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const record = await Config.findByPk('security');
    const security = { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
    res.json({ success: true, settings: security });
  } catch (error) { next(error); }
});

router.put('/security/settings', ...requireAdmin, async (req, res, next) => {
  try {
    const settings = Object.fromEntries(SECURITY_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body, field)).map((field) => [field, req.body[field]]));
    const numericFields = ['password_min_length', 'session_timeout', 'max_login_attempts', 'account_lockout_duration', 'jwt_expiry'];
    for (const field of numericFields) {
      if (Object.prototype.hasOwnProperty.call(settings, field)) {
        if (!Number.isInteger(Number(settings[field])) || Number(settings[field]) <= 0) return res.status(400).json({ success: false, message: `${field} must be a positive integer` });
        settings[field] = Number(settings[field]);
      }
    }
    if (settings.password_min_length < 6 || settings.password_min_length > 32) return res.status(400).json({ success: false, message: 'Password minimum length must be between 6 and 32' });
    const record = await Config.findByPk('security');
    const previous = { ...DEFAULT_SECURITY_SETTINGS, ...(record ? JSON.parse(record.value) : {}) };
    const nextSettings = { ...previous, ...settings };
    const versionNumber = (await SettingsVersion.max('versionNumber', { where: { settingsType: 'security' } }) || 0) + 1;
    await SettingsVersion.create({ settingsType: 'security', versionNumber, settingsJson: JSON.stringify(previous), changedBy: req.user.id, changeReason: String(req.body.change_reason || 'Security settings updated').slice(0, 255) });
    if (record) await record.update({ value: JSON.stringify(nextSettings) });
    else await Config.create({ key: 'security', value: JSON.stringify(nextSettings) });
    await AuditLog.create({ userId: req.user.id, action: 'SECURITY_SETTINGS_CHANGED', entity: 'settings:security', details: JSON.stringify({ changed: Object.keys(settings), previous: { ...previous, ip_whitelist: previous.ip_whitelist ? '[configured]' : '' }, next: { ...nextSettings, ip_whitelist: nextSettings.ip_whitelist ? '[configured]' : '' } }) });
    res.json({ success: true, settings: nextSettings });
  } catch (error) { next(error); }
});

router.post('/settings/reset', ...requireAdmin, async (req, res, next) => {
  try {
    const key = req.body?.section === 'security' ? 'security' : 'system';
    const defaults = key === 'security' ? DEFAULT_SECURITY_SETTINGS : {};
    const record = await Config.findByPk(key);
    const previous = record ? JSON.parse(record.value) : {};
    if (record) await record.update({ value: JSON.stringify(defaults) });
    else await Config.create({ key, value: JSON.stringify(defaults) });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_RESET', entity: `settings:${key}`, details: JSON.stringify({ section: key, changed: Object.keys(defaults), previous: { ...previous, ip_whitelist: previous.ip_whitelist ? '[configured]' : undefined } }) });
    res.json({ success: true, settings: defaults });
  } catch (error) { next(error); }
});

router.get('/mfa/status', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    res.json({ success: true, status: { enabled: Boolean(setting?.enabled), verifiedAt: setting?.verifiedAt || null, backupCodesRemaining: setting ? JSON.parse(setting.backupCodesHash || '[]').length : 0 } });
  } catch (error) { next(error); }
});

router.post('/mfa/setup', ...requireAdmin, async (req, res, next) => {
  try {
    const secret = speakeasy.generateSecret({ length: 20, name: `University Asset Management System:${req.user.username}`, issuer: 'University Asset Management System' });
    const backupCodes = generateBackupCodes();
    const hashes = await hashBackupCodes(backupCodes);
    const [setting, created] = await MfaSetting.findOrCreate({ where: { userId: req.user.id }, defaults: { userId: req.user.id, enabled: false, secretEncrypted: encryptMfaSecret(secret.base32), backupCodesHash: JSON.stringify(hashes) } });
    if (!created) await setting.update({ enabled: false, secretEncrypted: encryptMfaSecret(secret.base32), backupCodesHash: JSON.stringify(hashes), verifiedAt: null });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_SETUP_STARTED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: false }) });
    res.json({ success: true, setup: { otpauthUrl: secret.otpauth_url, backupCodes } });
  } catch (error) { next(error); }
});

router.post('/mfa/verify', ...requireAdmin, async (req, res, next) => {
  try {
    const token = String(req.body.token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(token)) return res.status(400).json({ success: false, message: 'A six-digit verification code is required' });
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting) return res.status(400).json({ success: false, message: 'MFA setup has not been started' });
    const verified = speakeasy.totp.verify({ secret: decryptMfaSecret(setting.secretEncrypted), encoding: 'base32', token, window: 1 });
    if (!verified) return res.status(400).json({ success: false, message: 'Invalid verification code' });
    await setting.update({ enabled: true, verifiedAt: new Date() });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_ENABLED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: true }) });
    res.json({ success: true, status: { enabled: true, verifiedAt: setting.verifiedAt } });
  } catch (error) { next(error); }
});

router.post('/mfa/disable', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting) return res.json({ success: true, status: { enabled: false } });
    await setting.update({ enabled: false, verifiedAt: null });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_DISABLED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ enabled: false }) });
    res.json({ success: true, status: { enabled: false } });
  } catch (error) { next(error); }
});

router.post('/mfa/regenerate-backup-codes', ...requireAdmin, async (req, res, next) => {
  try {
    const setting = await MfaSetting.findOne({ where: { userId: req.user.id } });
    if (!setting?.enabled) return res.status(400).json({ success: false, message: 'MFA must be enabled before regenerating backup codes' });
    const backupCodes = generateBackupCodes();
    await setting.update({ backupCodesHash: JSON.stringify(await hashBackupCodes(backupCodes)) });
    await AuditLog.create({ userId: req.user.id, action: 'MFA_BACKUP_CODES_REGENERATED', entity: `mfa:${req.user.id}`, details: JSON.stringify({ count: backupCodes.length }) });
    res.json({ success: true, backupCodes });
  } catch (error) { next(error); }
});

router.get('/settings/versions', ...requireAdmin, async (req, res, next) => {
  try {
    const versions = await SettingsVersion.findAll({ order: [['createdAt', 'DESC']], limit: 100, attributes: { exclude: ['settingsJson'] } });
    res.json({ success: true, versions });
  } catch (error) { next(error); }
});

router.get('/settings/versions/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const version = await SettingsVersion.findByPk(req.params.id);
    if (!version) return res.status(404).json({ success: false, message: 'Settings version not found' });
    res.json({ success: true, version: { ...version.toJSON(), settings: JSON.parse(version.settingsJson) } });
  } catch (error) { next(error); }
});

router.post('/settings/versions/:id/restore', ...requireAdmin, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const version = await SettingsVersion.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!version) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Settings version not found' }); }
    const settings = JSON.parse(version.settingsJson);
    const current = await Config.findByPk(version.settingsType, { transaction, lock: transaction.LOCK.UPDATE });
    const nextVersion = (await SettingsVersion.max('versionNumber', { where: { settingsType: version.settingsType }, transaction }) || 0) + 1;
    await SettingsVersion.create({ settingsType: version.settingsType, versionNumber: nextVersion, settingsJson: current?.value || '{}', changedBy: req.user.id, changeReason: `Restored version ${version.versionNumber}` }, { transaction });
    if (current) await current.update({ value: JSON.stringify(settings) }, { transaction });
    else await Config.create({ key: version.settingsType, value: JSON.stringify(settings) }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'SETTINGS_VERSION_RESTORED', entity: `settings:${version.settingsType}`, details: JSON.stringify({ versionId: version.id, versionNumber: version.versionNumber }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, settings });
  } catch (error) { await transaction.rollback(); next(error); }
});

router.get('/backups', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await backupService.listBackupHistory({
      search: req.query.search || '',
      status: req.query.status || '',
      type: req.query.type || '',
      page: req.query.page || 1,
      limit: req.query.limit || 25,
    });

    res.json({
      success: true,
      data: result.items,
      backups: result.items,
      pagination: result.pagination,
      stats: await backupService.getBackupStats(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/backups/stats', ...requireAdmin, async (req, res, next) => {
  try {
    const stats = await backupService.getBackupStats();
    res.json({ success: true, data: stats, stats });
  } catch (error) {
    next(error);
  }
});

router.post('/backups', ...requireAdmin, async (req, res, next) => {
  try {
    const createdBy = req.user?.username || req.user?.fullName || 'System';
    const backup = await backupService.createManualBackup({ createdBy, type: 'Manual', source: 'database' });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${backup.filename}`, entityId: backup.filename, oldValue: null, newValue: { filename: backup.filename, size: backup.size, checksum: backup.checksum, status: backup.status, type: backup.type }, details: { operation: 'create', legacyAction: 'BACKUP_CREATED' } });
    res.status(201).json({ success: true, data: backup, message: 'Database backup created successfully.' });
  } catch (error) {
    next(error);
  }
});

router.get('/backups/verify/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await backupService.verifyBackupFile(req.params.filename, { skipPersist: false });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${req.params.filename}`, entityId: req.params.filename, oldValue: null, newValue: { valid: result.valid, checksum: result.checksum, size: result.size || 0 }, details: { operation: 'verify', filename: req.params.filename, legacyAction: 'BACKUP_VERIFIED' } });
    res.json({ success: true, valid: result.valid, checksum: result.checksum, size: result.size || 0, message: result.message, verification: result });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' });
    next(error);
  }
});

router.get('/backups/download/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const filePath = resolveBackupPath(req.params.filename);
    if (!filePath) return res.status(400).json({ success: false, message: 'Invalid backup filename' });
    await fs.promises.access(filePath, fs.constants.R_OK);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${req.params.filename}`, entityId: req.params.filename, details: { operation: 'download', filename: req.params.filename, legacyAction: 'BACKUP_DOWNLOADED' } });
    res.download(filePath, req.params.filename);
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' });
    next(error);
  }
});

router.post('/backups/restore/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await backupService.restoreBackup(req.params.filename, { requestedBy: req.user?.username || req.user?.fullName || 'System' });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${req.params.filename}`, entityId: req.params.filename, newValue: { restored: true }, details: { operation: 'restore', filename: req.params.filename, legacyAction: 'RESTORE_COMPLETED' } });
    res.json({ success: true, message: 'Backup restored successfully.', data: result });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' });
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${req.params.filename}`, entityId: req.params.filename, details: { operation: 'restore_failed', filename: req.params.filename, errorCode: error.code || null, legacyAction: 'RESTORE_FAILED' } }).catch(() => {});
    console.error('Backup restore failed:', error);
    res.status(400).json({ success: false, message: 'Backup restore failed.' });
  }
});

router.delete('/backups/:filename', ...requireAdmin, async (req, res, next) => {
  try {
    const result = await backupService.deleteBackup(req.params.filename);
    await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'BACKUP_OPERATION', entity: `backup:${req.params.filename}`, entityId: req.params.filename, oldValue: { filename: req.params.filename }, newValue: { deleted: true }, details: { operation: 'delete', result, legacyAction: 'BACKUP_DELETED' } });
    res.json({ success: true, message: 'Backup deleted successfully.', data: result });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: 'Backup file not found' });
    next(error);
  }
});

router.get('/assets', ...requireAdmin, async (req, res, next) => {
  try {
    const where = {};
    const search = String(req.query.search || req.query.q || '').trim();
    const status = String(req.query.status || req.query.assetStatus || '').trim();
    const condition = String(req.query.condition || '').trim();
    const sortBy = String(req.query.sortBy || req.query.sort_by || 'created_at');
    const sortOrder = String(req.query.sortOrder || req.query.sort_order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;

    const departmentId = req.query.departmentId || req.query.department_id || req.query.department;
    const categoryId = req.query.categoryId || req.query.category_id || req.query.category;
    const collegeId = req.query.collegeId || req.query.college_id || req.query.college;
    const locationId = req.query.locationId || req.query.location_id || req.query.location;

    if (departmentId) {
      const dept = await Department.findByPk(departmentId);
      if (dept) where.department = dept.name;
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (category) where.category = category.name;
      else where.category = String(categoryId);
    }

    if (collegeId) {
      const parsedCollegeId = Number.parseInt(collegeId, 10);
      if (Number.isFinite(parsedCollegeId)) where.collegeId = parsedCollegeId;
    }

    if (locationId) {
      const parsedLocationId = Number.parseInt(locationId, 10);
      if (Number.isFinite(parsedLocationId)) {
        where.location = { [Op.like]: `%${String(parsedLocationId)}%` };
      } else {
        where.location = { [Op.like]: `%${String(locationId)}%` };
      }
    }

    if (status) {
      const normalized = String(status).trim().toLowerCase().replace(/[_\-\s]+/g, '-');
      where.status = { [Op.in]: [status, normalized, String(status).replace(/[_\-\s]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())] };
    }

    if (condition) where.condition = { [Op.in]: [condition, String(condition).toLowerCase(), String(condition).toUpperCase()] };

    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { serialNumber: { [Op.like]: `%${search}%` } },
        { rfidTag: { [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }

    const orderFieldMap = {
      name: 'name',
      created_at: 'createdAt',
      createdAt: 'createdAt',
      current_value: 'currentValue',
      currentValue: 'currentValue',
      status: 'status',
      asset_tag: 'assetCode',
      category: 'category'
    };

    const orderField = orderFieldMap[sortBy] || 'createdAt';

    const { count, rows } = await Asset.findAndCountAll({
      where,
      order: [[orderField, sortOrder]],
      limit,
      offset,
      raw: true,
    });

    const rowsWithSerializedFields = rows.map((asset) => ({
      ...asset,
      asset_tag: asset.assetCode,
      serial_number: asset.serialNumber,
      rfid_tag: asset.rfidTag,
      condition_status: asset.condition,
      department_name: asset.department,
      purchase_date: asset.purchaseDate,
      purchase_cost: Number(asset.purchasePrice || 0),
      current_value: Number(asset.currentValue || 0),
      warranty_expiry: asset.warrantyExpiry,
      manufacturer: asset.manufacturer,
      assigned_to_name: null,
      assigned_date: null,
    }));

    const summaryRows = await Asset.findAll({ attributes: ['status'], raw: true });
    const summary = summaryRows.reduce((accumulator, asset) => {
      const statusName = String(asset.status || '').toLowerCase().replace(/[_\-\s]+/g, '-');
      if (statusName === 'in-use' || statusName === 'assigned') accumulator.assigned += 1;
      else if (statusName === 'under-maintenance' || statusName === 'maintenance') accumulator.maintenance += 1;
      else if (statusName === 'lost' || statusName === 'missing') accumulator.missing += 1;
      else if (statusName === 'disposed' || statusName === 'retired') accumulator.retired += 1;
      else if (statusName === 'damaged') accumulator.damaged += 1;
      else if (statusName === 'available') accumulator.available += 1;
      return accumulator;
    }, { total: summaryRows.length, available: 0, assigned: 0, maintenance: 0, damaged: 0, missing: 0, retired: 0 });

    const response = {
      success: true,
      data: rowsWithSerializedFields,
      assets: rowsWithSerializedFields,
      total: count,
      summary,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.max(1, Math.ceil(count / limit)),
      },
    };

    return res.json(response);
  } catch (error) {
    return next(error);
  }
});

router.get('/recovery', ...requireAdmin, async (req, res, next) => {
  try {
    const days = Number(req.query.days || 30);
    const windowMs = Math.max(1, days) * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - windowMs);
    const { count, rows } = await Asset.findAndCountAll({
      where: {
        deletedAt: { [Op.ne]: null },
        deletedAt: { [Op.gte]: cutoff },
      },
      paranoid: false,
      order: [['deletedAt', 'DESC']],
      limit: Math.min(200, Number(req.query.limit) || 50),
      offset: Math.max(0, (Number(req.query.page) || 1) - 1) * Math.min(200, Number(req.query.limit) || 50),
      raw: true,
    });
    const recoveryItems = rows.map((asset) => ({
      id: asset.id,
      entityType: 'asset',
      entityId: asset.id,
      deletedBy: asset.deletedBy || 'System',
      deletedAt: asset.deletedAt,
      recoverable: asset.deletedAt && (Date.now() - new Date(asset.deletedAt).getTime()) <= windowMs,
      name: asset.name || asset.assetCode || `Asset ${asset.id}`,
    }));
    return res.json({ success: true, data: recoveryItems, items: recoveryItems, total: count, recoveryDays: days, pagination: { total: count, page: Number(req.query.page) || 1, limit: Math.min(200, Number(req.query.limit) || 50) } });
  } catch (error) {
    return next(error);
  }
});

router.get(['/dashboard', '/admin/dashboard'], ...requireAdmin, async (req, res, next) => {
  try {
    const data = await getDashboardAnalytics();
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
