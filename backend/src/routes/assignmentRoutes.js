const express = require('express');
const { sequelize, Assignment, Asset, User, Department, Inventory, InventoryTransaction, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const canManageAssignments = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager')];

const toAssignmentResponse = (assignment) => {
  const data = assignment.toJSON();
  return {
    ...data,
    asset_id: data.assetId,
    assigned_to: data.assignedTo,
    assigned_by: data.assignedBy,
    assigned_date: data.createdAt,
    returned_at: data.status === 'returned' ? data.updatedAt : null,
    asset_tag: assignment.Asset?.assetCode,
    asset_name: assignment.Asset?.name,
    assigned_to_name: assignment.User?.fullName || assignment.User?.username,
  };
};

const assignmentInclude = [
  { model: Asset, attributes: ['assetCode', 'name'] },
  { model: User, attributes: ['username', 'fullName'] },
];

router.get('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'department_head'), async (req, res, next) => {
  try {
    const where = req.query.assigned_to ? { assignedTo: req.query.assigned_to } : undefined;
    const include = req.user.role === 'department_head'
      ? [{ model: Asset, attributes: ['assetCode', 'name', 'department'], where: { department: req.user.department }, required: true }, { model: User, attributes: ['username', 'fullName'] }]
      : assignmentInclude;
    const assignments = await Assignment.findAll({ where, include, order: [['createdAt', 'DESC']] });
    res.json({ success: true, assignments: assignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.get('/history', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'department_head'), async (req, res, next) => {
  try {
    const include = req.user.role === 'department_head'
      ? [{ model: Asset, attributes: ['assetCode', 'name', 'department'], where: { department: req.user.department }, required: true }, { model: User, attributes: ['username', 'fullName'] }]
      : assignmentInclude;
    const assignments = await Assignment.findAll({ include, order: [['createdAt', 'DESC']] });
    res.json({ success: true, history: assignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.get('/history/:assetId', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'department_head'), async (req, res, next) => {
  try {
    if (req.user.role === 'department_head') {
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
    if (!inventory) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const assignee = await User.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!assignee) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'User not found' }); }
    if (!assignee.active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Cannot assign an asset to an inactive user' }); }
    if (department_id) {
      const department = await Department.findByPk(Number(department_id), { transaction });
      if (!department) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Department not found' }); }
    }
    const activeAssignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (activeAssignment) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is already assigned' }); }
    const currentStatus = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
    if (['under-maintenance', 'lost', 'retired', 'assigned'].includes(currentStatus)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is ${asset.status}` });
    }
    if (inventory.availableQuantity < 1) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not available in inventory' }); }
    const previousStatus = asset.status;
    const assignmentNotes = JSON.stringify({ notes: notes || remarks || '', departmentId: department_id || null, location: location || '', assignedDate: assigned_date || new Date(), expectedReturnDate: expected_return_date || null, condition: condition_at_assignment || '', purpose: purpose || '' });
    await inventory.update({ availableQuantity: inventory.availableQuantity - 1 }, { transaction });
    await asset.update({ status: 'assigned' }, { transaction });
    const assignment = await Assignment.create({
      assetId,
      assignedTo: userId,
      assignedBy: req.user.id,
      notes: assignmentNotes,
      status: 'active',
    }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId, userId: req.user.id, type: 'issue', quantity: 1, reason: 'Asset assignment', notes: notes || remarks || '' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'ASSIGN_ASSET', entity: `asset:${assetId}`, details: JSON.stringify({ assignmentId: assignment.id, assetId, previousStatus, newStatus: 'assigned', assignedTo: userId, departmentId: department_id || null, location: location || '', assignedDate: assigned_date || new Date(), expectedReturnDate: expected_return_date || null, condition: condition_at_assignment || '', purpose: purpose || '', notes: notes || remarks || '' }) }, { transaction });
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
    if (!assignment) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Assignment not found' }); }
    const inventory = await Inventory.findOne({ where: { assetId: assignment.assetId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const asset = await Asset.findByPk(assignment.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
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
