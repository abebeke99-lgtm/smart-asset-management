const { Op } = require('sequelize');
const { Asset, User, Department, Maintenance, Approval, Transfer, AuditLog, College } = require('../models');

const collegeScope = (req) => String(req.user?.department || '').trim();

const getCollegeDashboard = async (req, res, next) => {
  try {
    const collegeScopeValue = collegeScope(req);
    if (!collegeScopeValue && !req.organizationScope?.collegeId) return res.status(403).json({ success: false, message: 'College authorization is not configured for this user' });

    const assetWhere = req.organizationScope?.collegeId ? { collegeId: req.organizationScope.collegeId } : { department: collegeScopeValue };
    const userWhere = req.organizationScope?.collegeId ? { collegeId: req.organizationScope.collegeId } : { department: collegeScopeValue };
    const [assets, staff, departments, maintenance, approvals, transfers, audits] = await Promise.all([
      Asset.findAll({ where: assetWhere, order: [['updatedAt', 'DESC']], limit: 10 }),
      User.findAll({ where: userWhere, attributes: ['id', 'username', 'fullName', 'role', 'department'], order: [['id', 'ASC']] }),
      Department.findAll({ where: req.organizationScope?.collegeId ? { collegeId: req.organizationScope.collegeId } : { name: collegeScopeValue }, order: [['name', 'ASC']] }),
      Maintenance.findAll({ include: [{ model: Asset, where: assetWhere, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      Approval.findAll({ where: { departmentId: { [Op.ne]: null } }, include: [{ model: Department, where: { name: collegeScopeValue }, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      Transfer.findAll({ include: [{ model: Asset, where: assetWhere, required: true }], order: [['updatedAt', 'DESC']], limit: 10 }),
      AuditLog.findAll({
        include: [{ model: User, attributes: [], where: userWhere, required: true }],
        order: [['createdAt', 'DESC']],
        limit: 10,
      })
    ]);

    const assetRows = await Asset.findAll({ where: assetWhere, attributes: ['status', 'category', 'currentValue'], raw: true });
    const groupBy = (rows, key) => Object.entries(rows.reduce((counts, row) => {
      const value = String(row[key] || 'Unknown');
      counts[value] = (counts[value] || 0) + 1;
      return counts;
    }, {})).map(([label, value]) => ({ label, value }));
    const activeStatuses = ['in-use', 'assigned', 'In-Use', 'Assigned'];
    const pendingRequests = maintenance.filter((item) => ['pending', 'Pending'].includes(item.status)).length;
    const pendingApprovals = approvals.filter((item) => ['pending', 'Pending'].includes(item.status)).length;

    res.json({ success: true, data: {
      totalAssets: assetRows.length,
      activeAssets: assetRows.filter((asset) => activeStatuses.includes(asset.status)).length,
      availableAssets: assetRows.filter((asset) => String(asset.status).toLowerCase() === 'available').length,
      underMaintenance: assetRows.filter((asset) => String(asset.status).toLowerCase().includes('maintenance') || String(asset.status).toLowerCase().includes('repair')).length,
      pendingRequests,
      pendingApprovals,
      totalDepartments: departments.length,
      totalStaff: staff.length,
      totalAssetValue: assetRows.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
      recentActivities: [...assets, ...maintenance, ...transfers, ...audits].slice(0, 10),
      assetByStatus: groupBy(assetRows, 'status'),
      assetByCategory: groupBy(assetRows, 'category'),
      departmentSummary: departments.map((department) => ({ id: department.id, name: department.name, code: department.code }))
    }});
  } catch (error) {
    next(error);
  }
};

module.exports = { getCollegeDashboard };

const pagination = (query, defaultLimit = 25) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
};

const getCollegeProfile = async (req, res, next) => {
  try {
    const college = req.organizationScope.college;
    const [departments, staff, assets] = await Promise.all([
      Department.count({ where: { collegeId: college.id } }),
      User.count({ where: { collegeId: college.id } }),
      Asset.count({ where: { collegeId: college.id } }),
    ]);
    res.json({ success: true, data: { ...college.toJSON(), departments, staff, assets } });
  } catch (error) { next(error); }
};

const listCollegeDepartments = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const where = { collegeId: req.organizationScope.collegeId };
    if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { code: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    if (req.query.status) where.status = String(req.query.status);
    const { count, rows } = await Department.findAndCountAll({ where, order: [['name', 'ASC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listCollegeStaff = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const where = { collegeId: req.organizationScope.collegeId };
    if (req.query.departmentId) where.departmentId = Number(req.query.departmentId);
    if (req.query.role) where.role = String(req.query.role);
    if (req.query.active !== undefined) where.active = req.query.active === 'true';
    if (req.query.search) where[Op.or] = [{ username: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { fullName: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { email: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const { count, rows } = await User.findAndCountAll({ where, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listCollegeAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const where = { collegeId: req.organizationScope.collegeId };
    for (const field of ['departmentId', 'category', 'status', 'location', 'condition']) if (req.query[field]) where[field] = req.query[field];
    if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { assetCode: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { serialNumber: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { rfidTag: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const { count, rows } = await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const getScopedDepartment = async (req, id) => Department.findOne({ where: { id, collegeId: req.organizationScope.collegeId } });

const validateDepartmentPayload = async (req, body, currentId = null) => {
  const name = String(body.department_name || body.name || '').trim();
  const code = String(body.department_code || body.code || '').trim().toUpperCase();
  if (name.length < 2) return { error: 'Department name must be at least 2 characters' };
  if (!code) return { error: 'Department code is required' };
  const duplicate = await Department.findOne({ where: { collegeId: req.organizationScope.collegeId, code, ...(currentId ? { id: { [Op.ne]: currentId } } : {}) } });
  if (duplicate) return { error: 'Department code already exists in this college' };
  let headId = body.head_user_id ?? body.headId ?? null;
  if (headId !== null && headId !== '') {
    const head = await User.findOne({ where: { id: headId, collegeId: req.organizationScope.collegeId, role: 'department_head', active: true } });
    if (!head) return { error: 'Department Head must be an active department_head in this college' };
    headId = head.id;
  } else {
    headId = null;
  }
  return { value: { name, code, description: String(body.description || '').trim(), headId, locationId: body.location_id || body.locationId || null, phone: String(body.phone || '').trim(), email: String(body.email || '').trim(), status: body.status === 'inactive' ? 'inactive' : 'active' } };
};

const createCollegeDepartment = async (req, res, next) => {
  try {
    const validation = await validateDepartmentPayload(req, req.body);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, errors: [validation.error] });
    const department = await Department.create({ ...validation.value, collegeId: req.organizationScope.collegeId });
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_CREATED', entity: `department:${department.id}`, details: JSON.stringify({ after: department.toJSON() }) });
    res.status(201).json({ success: true, message: 'Department created successfully', data: department });
  } catch (error) { next(error); }
};

const updateCollegeDepartment = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const validation = await validateDepartmentPayload(req, req.body, department.id);
    if (validation.error) return res.status(400).json({ success: false, message: validation.error, errors: [validation.error] });
    const before = department.toJSON();
    await department.update({ ...validation.value, collegeId: department.collegeId });
    await AuditLog.create({ userId: req.user.id, action: 'DEPARTMENT_UPDATED', entity: `department:${department.id}`, details: JSON.stringify({ before, after: department.toJSON() }) });
    res.json({ success: true, message: 'Department updated successfully', data: department });
  } catch (error) { next(error); }
};

const updateCollegeDepartmentStatus = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    if (!['active', 'inactive'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive' });
    const before = department.status;
    await department.update({ status: req.body.status });
    await AuditLog.create({ userId: req.user.id, action: req.body.status === 'active' ? 'DEPARTMENT_ACTIVATED' : 'DEPARTMENT_DEACTIVATED', entity: `department:${department.id}`, details: JSON.stringify({ before, after: department.status }) });
    res.json({ success: true, message: 'Department status updated successfully', data: department });
  } catch (error) { next(error); }
};

const getCollegeDepartmentDetails = async (req, res, next) => {
  try {
    const department = await Department.findOne({ where: { id: req.params.id, collegeId: req.organizationScope.collegeId }, include: [{ model: User, as: 'Head', attributes: ['id', 'username', 'fullName', 'role'] }] });
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const [staffCount, assetCount, assetValue, statusRows] = await Promise.all([
      User.count({ where: { departmentId: department.id } }),
      Asset.count({ where: { departmentId: department.id } }),
      Asset.sum('currentValue', { where: { departmentId: department.id } }),
      Asset.findAll({ where: { departmentId: department.id }, attributes: ['status', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']], group: ['status'], raw: true }),
    ]);
    res.json({ success: true, data: { ...department.toJSON(), staffCount, assetCount, assetValue: Number(assetValue || 0), assetStatus: statusRows } });
  } catch (error) { next(error); }
};

const listCollegeDepartmentStaff = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    const { page, limit, offset } = pagination(req.query);
    const { count, rows } = await User.findAndCountAll({ where: { collegeId: req.organizationScope.collegeId, departmentId: department.id }, attributes: { exclude: ['password'] }, order: [['fullName', 'ASC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listCollegeDepartmentAssets = async (req, res, next) => {
  try {
    const department = await getScopedDepartment(req, req.params.id);
    if (!department) return res.status(404).json({ success: false, message: 'Department not found in your college' });
    req.query.departmentId = department.id;
    return listCollegeAssets(req, res, next);
  } catch (error) { next(error); }
};

module.exports = { getCollegeDashboard, getCollegeProfile, listCollegeDepartments, listCollegeStaff, listCollegeAssets, createCollegeDepartment, updateCollegeDepartment, updateCollegeDepartmentStatus, getCollegeDepartmentDetails, listCollegeDepartmentStaff, listCollegeDepartmentAssets };
