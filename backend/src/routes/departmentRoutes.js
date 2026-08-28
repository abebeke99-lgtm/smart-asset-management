const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Department, User, Asset, AuditLog } = require('../models');
const { Op } = require('sequelize');

const requireAdmin = [requireAuth, requireRole('admin')];

// Get all departments
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search = '', page = '1', limit = '25' } = req.query;
    const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
    
    const where = search ? { name: { [Op.like]: `%${search}%` } } : {};
    
    const { count, rows } = await Department.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    });

    // Enrich with user and asset counts
    const enriched = await Promise.all(rows.map(async (dept) => {
      const [userCount, assetCount] = await Promise.all([
        User.count({ where: { department: dept.name } }),
        Asset.count({ where: { department: dept.name } }),
      ]);
      return {
        ...dept.toJSON(),
        userCount,
        assetCount,
      };
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
    const dept = await Department.findByPk(req.params.id);
    if (!dept) return res.status(404).json({ success: false, message: 'Department not found' });
    
    const [userCount, assetCount] = await Promise.all([
      User.count({ where: { department: dept.name } }),
      Asset.count({ where: { department: dept.name } }),
    ]);
    
    res.json({
      success: true,
      data: {
        ...dept.toJSON(),
        userCount,
        assetCount,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create department (admin only)
router.post('/', ...requireAdmin, async (req, res, next) => {
  try {
    const { name, code = '', description = '', headId = null } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Department name is required' });
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
    
    const { name, code, description, headId } = req.body;
    const previousValue = dept.toJSON();
    
    if (name && name.trim() && name !== dept.name) {
      const existing = await Department.findOne({ where: { name: name.trim() } });
      if (existing) return res.status(409).json({ success: false, message: 'Department name already exists' });
    }
    
    const updates = {};
    if (name !== undefined && name.trim()) updates.name = name.trim();
    if (code !== undefined) updates.code = code || '';
    if (description !== undefined) updates.description = description || '';
    if (headId !== undefined) updates.headId = headId || null;
    
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
      User.count({ where: { department: dept.name } }),
      Asset.count({ where: { department: dept.name } }),
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
