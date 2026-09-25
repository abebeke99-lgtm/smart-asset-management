const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Department, User, Asset, AuditLog, College, Location } = require('../models');
const { Op } = require('sequelize');

const requireAdmin = [requireAuth, requireRole('admin')];

const departmentIncludes = [
  { model: College, attributes: ['id', 'collegeCode', 'collegeName'], required: false },
  { model: User, as: 'Head', attributes: ['id', 'fullName', 'username', 'email'], required: false },
  { model: Location, as: 'LocationRecord', attributes: ['id', 'name', 'code'], required: false },
];

const buildScope = (req) => {
  const scope = {};
  const organizationScope = req.organizationScope || {};
  const role = req.user?.role;
  const collegeId = organizationScope.collegeId || req.user?.collegeId;
  const departmentId = organizationScope.departmentId || req.user?.departmentId;

  if (role === 'college' && collegeId) scope.collegeId = collegeId;
  if (role === 'department_head' && departmentId) scope.id = departmentId;
  return scope;
};

const buildWhere = (req) => {
  const where = { ...buildScope(req) };
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim().toLowerCase();
  const collegeId = Number(req.query.collegeId);

  if (status === 'active' || status === 'inactive') where.status = status;
  if (Number.isInteger(collegeId) && collegeId > 0 && req.user?.role === 'admin') where.collegeId = collegeId;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { code: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
      { '$Head.fullName$': { [Op.like]: `%${search}%` } },
      { '$Head.username$': { [Op.like]: `%${search}%` } },
      { '$College.collegeName$': { [Op.like]: `%${search}%` } },
      { '$LocationRecord.name$': { [Op.like]: `%${search}%` } },
    ];
  }
  return where;
};

const serializeDepartment = (department, counts = {}) => ({
  ...department.toJSON(),
  userCount: Number(counts.userCount ?? department.userCount ?? 0),
  assetCount: Number(counts.assetCount ?? department.assetCount ?? 0),
  college: department.College || null,
  head: department.Head || null,
  locationRecord: department.LocationRecord || null,
});

// Get department statistics from the same scoped, relationship-backed data.
router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const where = buildWhere(req);
    const departments = await Department.findAll({ where, attributes: ['id', 'headId', 'locationId', 'status'] });
    const departmentIds = departments.map((department) => department.id);
    const [departmentUsers, departmentAssets, validHeads] = departmentIds.length
      ? await Promise.all([
        User.count({ where: { departmentId: { [Op.in]: departmentIds } } }),
        Asset.count({ where: { departmentId: { [Op.in]: departmentIds } } }),
        User.findAll({ where: { id: { [Op.in]: departments.map((department) => department.headId).filter(Boolean) } }, attributes: ['id'], raw: true }),
      ])
      : [0, 0, []];
    const validHeadIds = new Set(validHeads.map((user) => String(user.id)));

    res.json({
      success: true,
      data: {
        total: departments.length,
        heads: departments.filter((department) => validHeadIds.has(String(department.headId))).length,
        departmentUsers,
        departmentAssets,
        locations: new Set(departments.map((department) => department.locationId).filter(Boolean)).size,
        inactive: departments.filter((department) => department.status === 'inactive').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get all departments
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search = '', page = '1', limit = '25' } = req.query;
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    
    const where = buildWhere({ ...req, query: { ...req.query, search } });
    
    const { count, rows } = await Department.findAndCountAll({
      where,
      include: departmentIncludes,
      order: [['name', 'ASC']],
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
      distinct: true,
    });

    // Enrich with user and asset counts
    const enriched = await Promise.all(rows.map(async (dept) => {
      const [userCount, assetCount] = await Promise.all([
        User.count({ where: { departmentId: dept.id } }),
        Asset.count({ where: { departmentId: dept.id } }),
      ]);
      return serializeDepartment(dept, { userCount, assetCount });
    }));

    const pagination = { page: currentPage, limit: pageSize, total: count, pages: Math.max(1, Math.ceil(count / pageSize)) };
    res.json({ success: true, data: enriched, pagination });
  } catch (error) {
    next(error);
  }
});

// Get single department
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const dept = await Department.findOne({ where: { id: req.params.id, ...buildScope(req) }, include: departmentIncludes });
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    
    const [userCount, assetCount] = await Promise.all([
      User.count({ where: { departmentId: dept.id } }),
      Asset.count({ where: { departmentId: dept.id } }),
    ]);
    
    res.json({
      success: true,
      data: {
        ...serializeDepartment(dept, { userCount, assetCount }),
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create department (admin only)
router.post('/', ...requireAdmin, async (req, res, next) => {
  try {
    const { name, code = '', description = '', headId = null, collegeId = null, locationId = null, status = 'active' } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
    }
    if (name.trim().length > 255 || String(code || '').trim().length > 100) {
      return res.status(422).json({ success: false, message: 'Department name or code exceeds the allowed length' });
    }
    if (code && !/^[A-Za-z0-9._-]{1,100}$/.test(String(code).trim())) {
      return res.status(422).json({ success: false, message: 'Department code contains unsupported characters' });
    }
    if (headId) {
      const head = await User.findByPk(headId);
      if (!head) return res.status(404).json({ success: false, message: 'Department head not found' });
    }
    if (collegeId && !await College.findByPk(collegeId)) {
      return res.status(404).json({ success: false, message: 'College not found' });
    }
    if (locationId && !await Location.findByPk(locationId)) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    if (!['active', 'inactive'].includes(status)) {
      return res.status(422).json({ success: false, message: 'Invalid department status' });
    }
    
    const existing = await Department.findOne({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Department already exists' });
    }
    
    const dept = await Department.create({
      name: name.trim(),
      code: code || '',
      description: description || '',
      headId: headId || null,
      collegeId: collegeId || null,
      locationId: locationId || null,
      status,
    });
    
    await AuditLog.create({
      userId: req.user.id,
      action: 'CREATE_DEPARTMENT',
      entity: `department:${dept.id}`,
      details: JSON.stringify({ name: dept.name, code: dept.code, description: dept.description })
    });
    
    res.status(201).json({ success: true, data: dept.toJSON() });
  } catch (error) {
    next(error);
  }
});

// Update department (admin only)
router.put('/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    
    const { name, code, description, headId, collegeId, locationId, status } = req.body;
    const previousValue = dept.toJSON();
    
    if (name !== undefined && name && name.trim().length > 255) {
      return res.status(422).json({ success: false, message: 'Department name exceeds the allowed length' });
    }
    if (code !== undefined && String(code || '').trim().length > 100) {
      return res.status(422).json({ success: false, message: 'Department code exceeds the allowed length' });
    }
    if (code !== undefined && code && !/^[A-Za-z0-9._-]{1,100}$/.test(String(code).trim())) {
      return res.status(422).json({ success: false, message: 'Department code contains unsupported characters' });
    }
    if (headId !== undefined && headId) {
      const head = await User.findByPk(headId);
      if (!head) return res.status(404).json({ success: false, message: 'Department head not found' });
    }
    if (collegeId !== undefined && collegeId && !await College.findByPk(collegeId)) {
      return res.status(404).json({ success: false, message: 'College not found' });
    }
    if (locationId !== undefined && locationId && !await Location.findByPk(locationId)) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    if (status !== undefined && !['active', 'inactive'].includes(status)) {
      return res.status(422).json({ success: false, message: 'Invalid department status' });
    }
    
    if (name && name.trim() && name !== dept.name) {
      const existing = await Department.findOne({ where: { name: name.trim() } });
      if (existing) return res.status(409).json({ success: false, message: 'Department name already exists' });
    }
    
    const updates = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (code !== undefined) updates.code = code || '';
    if (description !== undefined) updates.description = description || '';
    if (headId !== undefined) updates.headId = headId || null;
    if (collegeId !== undefined) updates.collegeId = collegeId || null;
    if (locationId !== undefined) updates.locationId = locationId || null;
    if (status !== undefined) updates.status = status;
    
    await dept.update(updates);
    
    await AuditLog.create({
      userId: req.user.id,
      action: 'UPDATE_DEPARTMENT',
      entity: `department:${dept.id}`,
      details: JSON.stringify({ previousValue, newValue: dept.toJSON() })
    });
    
    res.json({ success: true, data: dept.toJSON() });
  } catch (error) {
    next(error);
  }
});

// Delete department (admin only)
router.delete('/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    
    // Check if department has users or assets
    const [userCount, assetCount] = await Promise.all([
      User.count({ where: { departmentId: dept.id } }),
      Asset.count({ where: { departmentId: dept.id } }),
    ]);
    
    if (userCount > 0 || assetCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete department with ${userCount} users and ${assetCount} assets. Please reassign them first.`,
        details: { userCount, assetCount }
      });
    }
    
    await AuditLog.create({
      userId: req.user.id,
      action: 'DELETE_DEPARTMENT',
      entity: `department:${dept.id}`,
      details: JSON.stringify({ name: dept.name, code: dept.code })
    });
    
    await dept.destroy();
    
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
