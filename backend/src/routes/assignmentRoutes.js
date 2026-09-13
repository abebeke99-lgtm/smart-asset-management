const express = require('express');
const { sequelize, Assignment, Asset, User, Department, Inventory, InventoryTransaction, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Op } = require('sequelize');

const router = express.Router();
const canManageAssignments = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager')];

const parseAssignmentNotes = (input) => {
  if (!input) return {};
  if (typeof input === 'object') return input;
  try {
    return JSON.parse(input);
  } catch (error) {
    return {};
  }
};

const toAssignmentResponse = (assignment) => {
  const data = assignment.toJSON();
  const notes = parseAssignmentNotes(data.notes);

  return {
    ...data,
    id: data.id,
    asset_id: data.assetId,
    assigned_to: data.assignedTo,
    assigned_by: data.assignedBy,
    assigned_date: data.assignedDate || data.createdAt,
    expected_return_date: notes.expectedReturnDate || notes.expected_return_date || null,
    department_id: notes.departmentId || notes.department_id || null,
    location: notes.location || data.location || assignment.Asset?.location || '',
    notes: notes.notes || notes.remarks || data.notes || '',
    asset_tag: assignment.Asset?.assetCode || '',
    asset_name: assignment.Asset?.name || '',
    asset_category: assignment.Asset?.category || '',
    asset_serial: assignment.Asset?.serialNumber || '',
    assigned_to_name: assignment.User?.fullName || assignment.User?.username || '',
    department_name: assignment.Asset?.department || assignment.User?.department || notes.departmentName || '',
    status: data.status || 'active',
    returned_at: data.status === 'returned' ? data.updatedAt : null,
  };
};

const assignmentInclude = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'serialNumber', 'department', 'location', 'collegeId', 'departmentId'] },
  { model: User, attributes: ['id', 'username', 'fullName', 'email', 'department', 'role', 'active'] },
];

router.get('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const department = String(req.query.department || '').trim();
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const sortBy = String(req.query.sortBy || 'createdAt').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').trim().toUpperCase();

    const andClauses = [];
    if (status) {
      andClauses.push({ status });
    }
    if (search) {
      andClauses.push({
        [Op.or]: [
          sequelize.where(sequelize.col('Asset.assetCode'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('Asset.name'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('Asset.serialNumber'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('User.fullName'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('User.username'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('User.email'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('Asset.department'), 'LIKE', `%${search}%`),
          { notes: { [Op.like]: `%${search}%` } },
        ],
      });
    }
    if (department) {
      andClauses.push({
        [Op.or]: [
          sequelize.where(sequelize.col('Asset.department'), 'LIKE', `%${department}%`),
          sequelize.where(sequelize.col('User.department'), 'LIKE', `%${department}%`),
        ],
      });
    }
    if (location) {
      andClauses.push({
        [Op.or]: [
          sequelize.where(sequelize.col('Asset.location'), 'LIKE', `%${location}%`),
          { notes: { [Op.like]: `%${location}%` } },
        ],
      });
    }
    if (category) {
      andClauses.push({
        [Op.or]: [
          sequelize.where(sequelize.col('Asset.category'), 'LIKE', `%${category}%`),
          { '$Asset.category$': { [Op.like]: `%${category}%` } },
        ],
      });
    }

    const where = andClauses.length ? { [Op.and]: andClauses } : {};
    const allowedSort = ['id', 'assetId', 'assignedTo', 'assignedBy', 'status', 'createdAt', 'updatedAt'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const { count, rows } = await Assignment.findAndCountAll({
      where,
      include: assignmentInclude,
      limit,
      offset,
      order: [[orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC']],
    });

    const assignments = rows.map(toAssignmentResponse);
    const pagination = {
      page,
      limit,
      total: count,
      pages: Math.max(1, Math.ceil(count / limit)),
    };

    res.json({
      success: true,
      assignments,
      data: assignments,
      total: count,
      pagination,
      summary: {
        total: count,
        active: assignments.filter((item) => String(item.status).toLowerCase() === 'active').length,
        returned: assignments.filter((item) => String(item.status).toLowerCase() === 'returned').length,
        pending: assignments.filter((item) => String(item.status).toLowerCase() === 'pending').length,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college'), async (req, res, next) => {
  try {
    const include = req.user.role === 'college'
      ? [{ model: Asset, attributes: ['assetCode', 'name', 'department'], where: { department: req.user.department }, required: true }, { model: User, attributes: ['username', 'fullName'] }]
      : assignmentInclude;
    const assignments = await Assignment.findAll({ include, order: [['createdAt', 'DESC']] });
    res.json({ success: true, history: assignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.get('/history/:assetId', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college'), async (req, res, next) => {
  try {
    if (req.user.role === 'college') {
      const asset = await Asset.findByPk(req.params.assetId, { attributes: ['department'] });
      if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
      if (asset.department !== req.user.department) return res.status(403).json({ success: false, message: 'Department access denied' });
    }
    const assignments = await Assignment.findAll({
      where: { assetId: req.params.assetId },
      include: assignmentInclude,
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, history: assignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.post('/', ...canManageAssignments, async (req, res, next) => {
  const { asset_id, assigned_to, notes, remarks, department_id, location, assigned_date, expected_return_date, condition_at_assignment, purpose } = req.body;
  const assetId = Number(asset_id);
  const userId = Number(assigned_to);

  if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ success: false, message: 'A valid asset ID is required' });
  if (!Number.isInteger(userId) || userId <= 0) return res.status(400).json({ success: false, message: 'A valid assignee ID is required' });
  if (assigned_date && Number.isNaN(Date.parse(assigned_date))) return res.status(400).json({ success: false, message: 'Invalid assignment date' });
  if (expected_return_date && Number.isNaN(Date.parse(expected_return_date))) return res.status(400).json({ success: false, message: 'Invalid expected return date' });
  if (assigned_date && expected_return_date && new Date(expected_return_date) < new Date(assigned_date)) return res.status(400).json({ success: false, message: 'Expected return date cannot precede assignment date' });

  const transaction = await sequelize.transaction();
  try {
    const inventory = await Inventory.findOne({ where: { assetId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }

    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const assignee = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!assignee) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!assignee.active) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Cannot assign an asset to an inactive user' });
    }

    const userCollegeId = req.user?.collegeId ?? req.user?.college_id;
    if (userCollegeId && Number(asset.collegeId) !== Number(userCollegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' });
    }
    if (userCollegeId && assignee.collegeId && Number(assignee.collegeId) !== Number(userCollegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Recipient is outside your organization scope' });
    }
    if (department_id) {
      const department = await Department.findByPk(Number(department_id), { transaction });
      if (!department) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Department not found' });
      }
      if (userCollegeId && department.collegeId && Number(department.collegeId) !== Number(userCollegeId)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Department is outside your organization scope' });
      }
    }

    const activeAssignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (activeAssignment) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is already assigned' });
    }

    const currentStatus = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
    if (['under-maintenance', 'lost', 'retired', 'assigned', 'disposed'].includes(currentStatus)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is ${asset.status}` });
    }

    if (inventory.availableQuantity < 1) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is not available in inventory' });
    }

    const departmentName = department_id ? (await Department.findByPk(Number(department_id), { transaction }))?.name || '' : '';
    const isAssignedTo = req.user?.id || req.user?.userId;
    const assignmentNotes = JSON.stringify({
      notes: notes || remarks || '',
      departmentId: department_id || null,
      departmentName,
      location: location || asset.location || '',
      assignedDate: assigned_date || new Date().toISOString(),
      expectedReturnDate: expected_return_date || null,
      condition: condition_at_assignment || asset.condition || 'Good',
      purpose: purpose || '',
    });

    await inventory.update({ availableQuantity: inventory.availableQuantity - 1 }, { transaction });
    await asset.update({ status: 'assigned', ...(location ? { location } : {}), ...(department_id ? { departmentId: Number(department_id) } : {}) }, { transaction });

    const assignment = await Assignment.create({
      assetId,
      assignedTo: userId,
      assignedBy: isAssignedTo,
      notes: assignmentNotes,
      status: 'active',
    }, { transaction });

    await InventoryTransaction.create({
      inventoryId: inventory.id,
      assetId,
      userId: isAssignedTo,
      type: 'issue',
      quantity: 1,
      reason: 'Asset assignment',
      notes: notes || remarks || '',
    }, { transaction });

    await AuditLog.create({
      userId: isAssignedTo,
      action: 'ASSIGN_ASSET',
      entity: `asset:${assetId}`,
      details: JSON.stringify({
        assignmentId: assignment.id,
        assetId,
        previousStatus: asset.status,
        newStatus: 'assigned',
        assignedTo: userId,
        departmentId: department_id || null,
        location: location || asset.location || '',
        assignedDate: assigned_date || new Date().toISOString(),
        expectedReturnDate: expected_return_date || null,
        condition: condition_at_assignment || asset.condition || 'Good',
        notes: notes || remarks || '',
      }),
    }, { transaction });

    await transaction.commit();
    const populatedAssignment = await Assignment.findByPk(assignment.id, { include: assignmentInclude });
    const assignmentResponse = toAssignmentResponse(populatedAssignment);
    res.status(201).json({ success: true, message: 'Asset assigned successfully', data: assignmentResponse, assignment: assignmentResponse });
  } catch (error) {
    console.error('Assignment creation failed:', error);
    await transaction.rollback();
    res.status(500).json({ success: false, message: 'Unable to save assignment. Please verify the selected asset and user.' });
  }
});

router.post('/:id/return', ...canManageAssignments, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assignment = await Assignment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    const inventory = await Inventory.findOne({ where: { assetId: assignment.assetId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Inventory record not found' });
    }
    const asset = await Asset.findByPk(assignment.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    await assignment.update({ status: 'returned' }, { transaction });
    await inventory.update({ availableQuantity: inventory.availableQuantity + 1 }, { transaction });
    await asset.update({ status: 'available' }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId: assignment.assetId, userId: req.user.id, type: 'return', quantity: 1, reason: 'Asset returned', notes: req.body.notes || '' }, { transaction });
    await transaction.commit();
    res.json({ success: true, assignment: toAssignmentResponse(assignment) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

router.post('/:id/transfer', ...canManageAssignments, async (req, res, next) => {
  try {
    const assignment = await Assignment.findByPk(req.params.id) || await Assignment.findOne({
      where: { assetId: req.params.id, status: 'active' },
      order: [['createdAt', 'DESC']],
    });
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });
    await assignment.update({ assignedTo: req.body.new_user_id, assignedBy: req.user.id, status: 'active' });
    res.json({ success: true, assignment: toAssignmentResponse(assignment) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
