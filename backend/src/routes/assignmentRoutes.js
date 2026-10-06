const express = require('express');
const { sequelize, Assignment, Asset, User, Department, Room, Inventory, InventoryTransaction } = require('../models');
const { requireAuth, requireRole, requirePermission } = require('../middlewares/auth');
const { createDepartmentEventNotification, createEventNotification } = require('../services/notificationService');
const { Op } = require('sequelize');
const { resolveCollegeScope, resolveDepartmentScope } = require('../middlewares/organizationScope');
const { createAuditLog } = require('../services/auditLogService');

const router = express.Router();
const canManageAssignments = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'department_head')];
const requireDepartmentPermission = (permission) => (req, res, next) => (
  req.user?.role === 'department_head'
    ? requirePermission(permission)(req, res, next)
    : next()
);
const resolveAssignmentOrganizationScope = (req, res, next) => ['ict_officer', 'store_manager', 'college_manager'].includes(req.user.role)
  ? resolveCollegeScope(req, res, next)
  : req.user.role === 'department_head'
    ? resolveDepartmentScope(req, res, next)
  : next();

const getDepartmentScopeId = (req) => {
  if (!req || !req.user) return null;
  const departmentScope = (req.organizationScope && req.organizationScope.departmentId) || req.user.departmentId || req.user.department_id || req.user.department || null;
  if (!departmentScope) return null;
  const numericDepartmentId = Number(departmentScope);
  return Number.isFinite(numericDepartmentId) && numericDepartmentId > 0 ? numericDepartmentId : null;
};

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
  const assignedToType = String(data.assignedToType || 'user').toLowerCase();
  const assignedToName = assignedToType === 'department'
    ? assignment.AssignedDepartment?.name || ''
    : assignedToType === 'laboratory'
      ? assignment.AssignedLaboratory?.roomName || ''
      : assignment.User?.fullName || assignment.User?.username || '';

  return {
    ...data,
    id: data.id,
    asset_id: data.assetId,
    assigned_to: data.assignedToId || data.assignedTo,
    assigned_to_type: assignedToType,
    assigned_to_id: data.assignedToId || data.assignedTo,
    assigned_by: data.assignedBy,
    assigned_by_name: assignment.AssignedByUser?.fullName || assignment.AssignedByUser?.username || '',
    assigned_date: data.assignedDate || data.createdAt,
    condition: data.conditionAtAssignment || notes.condition || '',
    workflow_status: data.workflowStatus || (data.status === 'returned' ? 'returned' : 'assigned'),
    returned_at: data.returnedAt || (data.status === 'returned' ? data.updatedAt : null),
    expected_return_date: data.expectedReturnDate || notes.expectedReturnDate || notes.expected_return_date || null,
    department_id: data.departmentId || notes.departmentId || notes.department_id || null,
    location: data.location || notes.location || assignment.Asset?.location || '',
    notes: notes.notes || notes.remarks || data.notes || '',
    asset_tag: assignment.Asset?.assetCode || '',
    asset_name: assignment.Asset?.name || '',
    asset_college_id: assignment.Asset?.collegeId || null,
    asset_category: assignment.Asset?.category || '',
    asset_serial: assignment.Asset?.serialNumber || '',
    assigned_to_name: assignedToName,
    department_name: assignment.AssignedDepartment?.name || assignment.Asset?.department || assignment.User?.department || notes.departmentName || '',
    laboratory_name: assignment.AssignedLaboratory?.roomName || '',
    status: data.status || 'active',
  };
};

const assignmentInclude = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'serialNumber', 'department', 'location', 'collegeId', 'departmentId'] },
  { model: User, attributes: ['id', 'username', 'fullName', 'email', 'department', 'role', 'active'] },
  { model: Department, as: 'AssignedDepartment', attributes: ['id', 'name', 'collegeId'], required: false },
  { model: Room, as: 'AssignedLaboratory', attributes: ['id', 'roomName', 'roomCode', 'roomType', 'buildingId', 'campusId'], required: false },
  { model: User, as: 'AssignedByUser', attributes: ['id', 'username', 'fullName'], required: false },
];

const getAssignmentInclude = (req) => {
  if (['ict_officer', 'store_manager', 'college_manager'].includes(req.user?.role)) {
    return assignmentInclude.map((entry) => entry.model === Asset ? { ...entry, where: { collegeId: req.organizationScope.collegeId }, required: true } : entry);
  }
  if (req.user?.role === 'department_head') {
    return assignmentInclude.map((entry) => entry.model === Asset ? {
      ...entry,
      where: {
        departmentId: req.organizationScope.departmentId,
        ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
      },
      required: true,
    } : entry);
  }
  return assignmentInclude;
};

router.get('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college', 'department_head'), requireDepartmentPermission('assets.view'), resolveAssignmentOrganizationScope, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const assignedToType = String(req.query.type || req.query.assignedToType || '').trim().toLowerCase();
    const assignedToFilter = Number(req.query.assigned_to || req.query.assignedTo || 0);
    const department = String(req.query.department || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const expectedFrom = String(req.query.expectedFrom || '').trim();
    const expectedTo = String(req.query.expectedTo || '').trim();
    const location = String(req.query.location || '').trim();
    const category = String(req.query.category || '').trim();
    const sortBy = String(req.query.sortBy || 'createdAt').trim();
    const sortOrder = String(req.query.sortOrder || 'DESC').trim().toUpperCase();
    const departmentScope = getDepartmentScopeId(req);

    const andClauses = [];
    if (departmentScope && ['department_head'].includes(String(req.user.role || '').toLowerCase())) {
      andClauses.push({ '$Asset.departmentId$': departmentScope });
    }
    const now = new Date();
    if (status === 'active') {
      andClauses.push({ status: 'active' });
    } else if (status === 'returned') {
      andClauses.push({ status: 'returned' });
    } else if (status === 'due-soon') {
      andClauses.push({ status: 'active', expectedReturnDate: { [Op.gte]: now, [Op.lte]: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } });
    } else if (status === 'overdue') {
      andClauses.push({ status: 'active', expectedReturnDate: { [Op.lt]: now } });
    } else if (status) {
      andClauses.push({ status });
    }
    if (assignedToType) {
      andClauses.push({ assignedToType });
    }
    if (assignedToFilter) {
      andClauses.push({ assignedToId: assignedToFilter });
    }
    if ([dateFrom, dateTo, expectedFrom, expectedTo].some((value) => value && Number.isNaN(Date.parse(value)))) {
      return res.status(400).json({ success: false, message: 'Date filters must be valid dates.' });
    }
    if (dateFrom || dateTo) {
      const assignedDateFilter = {};
      if (dateFrom) assignedDateFilter[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        assignedDateFilter[Op.lte] = to;
      }
      andClauses.push({ assignedDate: assignedDateFilter });
    }
    if (expectedFrom || expectedTo) {
      const expectedDateFilter = {};
      if (expectedFrom) expectedDateFilter[Op.gte] = new Date(expectedFrom);
      if (expectedTo) {
        const to = new Date(expectedTo);
        to.setHours(23, 59, 59, 999);
        expectedDateFilter[Op.lte] = to;
      }
      andClauses.push({ expectedReturnDate: expectedDateFilter });
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
          sequelize.where(sequelize.col('AssignedDepartment.name'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('AssignedLaboratory.roomName'), 'LIKE', `%${search}%`),
          sequelize.where(sequelize.col('Asset.department'), 'LIKE', `%${search}%`),
          { notes: { [Op.like]: `%${search}%` } },
        ],
      });
    }
    if (department) {
      const numericDepartment = Number(department);
      andClauses.push(Number.isInteger(numericDepartment) && numericDepartment > 0
        ? { departmentId: numericDepartment }
        : {
        [Op.or]: [
          sequelize.where(sequelize.col('Asset.department'), 'LIKE', `%${department}%`),
          sequelize.where(sequelize.col('User.department'), 'LIKE', `%${department}%`),
          sequelize.where(sequelize.col('AssignedDepartment.name'), 'LIKE', `%${department}%`),
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
      include: getAssignmentInclude(req),
      limit,
      offset,
      order: [[orderField, sortOrder === 'ASC' ? 'ASC' : 'DESC']],
    });

    const assignments = rows.map(toAssignmentResponse);

    res.json({
      success: true,
      assignments,
      data: assignments,
      total: count,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.max(1, Math.ceil(count / limit)),
      },
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

router.get('/history', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college', 'department_head'), requireDepartmentPermission('assets.view'), resolveAssignmentOrganizationScope, async (req, res, next) => {
  try {
    const departmentScope = getDepartmentScopeId(req);
    const baseInclude = getAssignmentInclude(req);
    const assignments = await Assignment.findAll({ include: baseInclude, order: [['createdAt', 'DESC']] });
    const scopedAssignments = req.user.role === 'department_head' && departmentScope
      ? assignments.filter((assignment) => Number(assignment?.Asset?.departmentId || assignment?.Asset?.department_id || 0) === Number(departmentScope))
      : assignments;
    res.json({ success: true, history: scopedAssignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.get('/history/:assetId', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college', 'department_head'), requireDepartmentPermission('assets.view'), resolveAssignmentOrganizationScope, async (req, res, next) => {
  try {
    const departmentScope = getDepartmentScopeId(req);
    if (req.user.role === 'college_manager') {
      const asset = await Asset.findByPk(req.params.assetId, { attributes: ['collegeId'] });
      if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
      if (Number(asset.collegeId) !== Number(req.organizationScope.collegeId)) return res.status(403).json({ success: false, message: 'College access denied' });
    }
    if (req.user.role === 'department_head' && departmentScope) {
      const asset = await Asset.findByPk(req.params.assetId, { attributes: ['departmentId', 'department'] });
      if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
      if (Number(asset.departmentId) !== Number(departmentScope)) return res.status(403).json({ success: false, message: 'Department access denied' });
    }
    const assignments = await Assignment.findAll({
      where: { assetId: req.params.assetId },
      include: getAssignmentInclude(req),
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, history: assignments.map(toAssignmentResponse) });
  } catch (error) {
    next(error);
  }
});

router.post('/', ...canManageAssignments, requireDepartmentPermission('assets.assign'), resolveAssignmentOrganizationScope, async (req, res, next) => {
  const {
    asset_id,
    assigned_to,
    assigned_to_type,
    assigned_to_id,
    notes,
    remarks,
    department_id,
    college_id,
    laboratory_id,
    location,
    expected_return_date,
    condition_at_assignment,
    purpose,
    assigned_date,
    assignedDate: assignedDateInput,
    expectedReturnDate: expectedReturnDateInput,
  } = req.body;
  const assetId = Number(asset_id);
  const assignedToType = String(assigned_to_type || req.body.assignedToType || 'user').trim().toLowerCase();
  const assignedToId = Number(assigned_to_id ?? assigned_to ?? req.body.assignedToId);
  const departmentId = Number(department_id || (assignedToType === 'department' ? assignedToId : 0)) || null;
  const laboratoryId = Number(laboratory_id || (assignedToType === 'laboratory' ? assignedToId : 0)) || null;
  const allowedRecipientTypes = new Set(['user', 'department', 'laboratory']);
  const allowedConditions = new Set(['excellent', 'good', 'fair', 'poor', 'damaged']);
  const actorId = req.user?.id || req.user?.userId;
  const requestedAssignedDate = assigned_date ?? assignedDateInput;
  const assignedDate = requestedAssignedDate ? new Date(requestedAssignedDate) : new Date();
  const requestedExpectedReturnDate = expected_return_date ?? expectedReturnDateInput;

  if (!Number.isInteger(assetId) || assetId <= 0) return res.status(400).json({ success: false, message: 'A valid asset ID is required' });
  if (!allowedRecipientTypes.has(assignedToType)) return res.status(400).json({ success: false, message: 'Assigned To type must be User, Department or Laboratory.' });
  if (!Number.isInteger(assignedToId) || assignedToId <= 0) return res.status(400).json({ success: false, message: 'Select a valid Assigned To record.' });
  if (assignedToType === 'laboratory' && !departmentId) return res.status(400).json({ success: false, message: 'Select the parent department for this laboratory.' });
  if (requestedAssignedDate && Number.isNaN(assignedDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid assignment date.' });
  if (assignedDate > new Date()) return res.status(400).json({ success: false, message: 'Assignment date cannot be in the future.' });
  if (requestedExpectedReturnDate && Number.isNaN(Date.parse(requestedExpectedReturnDate))) return res.status(400).json({ success: false, message: 'Invalid expected return date' });
  if (requestedExpectedReturnDate && new Date(requestedExpectedReturnDate) < assignedDate) return res.status(400).json({ success: false, message: 'Expected return date cannot be before the assignment date.' });
  if (condition_at_assignment && !allowedConditions.has(String(condition_at_assignment).trim().toLowerCase())) return res.status(400).json({ success: false, message: 'Condition must be Excellent, Good, Fair, Poor or Damaged.' });
  if (location && String(location).trim().length > 255) return res.status(400).json({ success: false, message: 'Location must be 255 characters or fewer.' });
  if (notes && String(notes).length > 5000) return res.status(400).json({ success: false, message: 'Notes must be 5000 characters or fewer.' });

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

    const assignee = assignedToType === 'user'
      ? await User.findByPk(assignedToId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    const assignedDepartment = assignedToType === 'department'
      ? await Department.findByPk(assignedToId, { transaction, lock: transaction.LOCK.UPDATE })
      : departmentId ? await Department.findByPk(departmentId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const laboratory = assignedToType === 'laboratory'
      ? await Room.findByPk(laboratoryId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;

    if (assignedToType === 'user' && !assignee) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (assignedToType === 'user' && !assignee.active) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Cannot assign an asset to an inactive user.' });
    }
    if (assignedToType === 'department' && (!assignedDepartment || assignedDepartment.status !== 'active')) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Active department not found.' });
    }
    if (assignedToType === 'laboratory' && (!laboratory || laboratory.status !== 'active' || !String(laboratory.roomType || '').toLowerCase().includes('lab'))) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Active laboratory not found.' });
    }
    if (assignedToType === 'laboratory' && String(req.user.role || '').toLowerCase() === 'department_head'
      && Number(laboratory.departmentId) !== Number(getDepartmentScopeId(req))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Laboratory is outside your department scope.' });
    }
    if (departmentId && !assignedDepartment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    if (assignedToType === 'user' && departmentId && assignee.departmentId && Number(assignee.departmentId) !== departmentId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected user does not belong to the selected department.' });
    }
    if (college_id && assignedToType === 'user' && Number(assignee.collegeId) !== Number(college_id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected user does not belong to the selected college.' });
    }
    if (college_id && assignedToType !== 'user' && Number(assignedDepartment?.collegeId) !== Number(college_id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected department does not belong to the selected college.' });
    }

    const departmentScope = getDepartmentScopeId(req);
    if (String(req.user.role || '').toLowerCase() === 'department_head' && !departmentScope) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    if (String(req.user.role || '').toLowerCase() === 'department_head') {
      if (department_id && Number(department_id) !== Number(departmentScope)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'You can only assign assets within your department' });
      }
      if (Number(asset.departmentId) !== Number(departmentScope)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
      }
      if (assignedToType === 'user' && Number(assignee?.departmentId) !== Number(departmentScope)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Recipient is outside your department scope' });
      }
      if (departmentId && Number(departmentId) !== Number(departmentScope)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Recipient department is outside your department scope' });
      }
    }

    const userCollegeId = ['ict_officer', 'store_manager'].includes(req.user?.role)
      ? req.organizationScope.collegeId
      : req.user?.collegeId ?? req.user?.college_id;
    if (userCollegeId && Number(asset.collegeId) !== Number(userCollegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' });
    }
    const recipientCollegeId = assignedToType === 'user' ? assignee?.collegeId : assignedDepartment?.collegeId;
    if (userCollegeId && (req.user?.role === 'store_manager'
      ? Number(recipientCollegeId) !== Number(userCollegeId)
      : recipientCollegeId && Number(recipientCollegeId) !== Number(userCollegeId))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Recipient is outside your organization scope' });
    }
    if (userCollegeId && (req.user?.role === 'store_manager'
      ? Number(assignedDepartment?.collegeId) !== Number(userCollegeId)
      : assignedDepartment?.collegeId && Number(assignedDepartment.collegeId) !== Number(userCollegeId))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department is outside your organization scope' });
    }

    const activeAssignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (activeAssignment) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is already assigned' });
    }

    const currentStatus = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
    if (currentStatus !== 'available') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is ${asset.status}` });
    }

    if (inventory.availableQuantity < 1) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is not available in inventory' });
    }

    const effectiveDepartmentId = departmentId || (assignedToType === 'user' ? assignee?.departmentId || null : null);
    const effectiveDepartment = assignedDepartment || (effectiveDepartmentId ? await Department.findByPk(effectiveDepartmentId, { transaction }) : null);
    const departmentName = effectiveDepartment?.name || '';
    const assignmentLocation = String(location || laboratory?.roomName || asset.location || '').trim();
    const assignmentNotes = JSON.stringify({
      notes: notes || remarks || '',
      departmentId: effectiveDepartmentId,
      departmentName,
      location: assignmentLocation,
      expectedReturnDate: requestedExpectedReturnDate || null,
      condition: condition_at_assignment || asset.condition || 'Good',
      purpose: purpose || '',
    });

    await inventory.update({ availableQuantity: inventory.availableQuantity - 1 }, { transaction });
    await asset.update({
      status: 'assigned',
      ...(assignmentLocation ? { location: assignmentLocation } : {}),
      ...(effectiveDepartmentId ? { departmentId: effectiveDepartmentId } : {}),
      ...(laboratory ? { roomId: laboratory.id } : {}),
    }, { transaction });

    const assignment = await Assignment.create({
      assetId,
      assignedTo: assignedToType === 'user' ? assignedToId : null,
      assignedToType,
      assignedToId,
      assignedBy: actorId,
      workflowStatus: 'assigned',
      assignedDate,
      expectedReturnDate: requestedExpectedReturnDate || null,
      departmentId: effectiveDepartmentId,
      location: assignmentLocation,
      conditionAtAssignment: condition_at_assignment || asset.condition || 'Good',
      notes: assignmentNotes,
      status: 'active',
    }, { transaction });

    await InventoryTransaction.create({
      inventoryId: inventory.id,
      assetId,
      userId: actorId,
      type: 'issue',
      quantity: 1,
      reason: 'Asset assignment',
      notes: notes || remarks || '',
    }, { transaction });

    await createAuditLog({
      userId: actorId,
      role: req.user.role,
      action: 'ASSIGN_ASSET',
      entity: `asset:${assetId}`,
      entityId: assetId,
      oldValue: { status: currentStatus, holder: null },
      newValue: { status: 'assigned', assignment: assignment.toJSON() },
      details: {
        assignmentId: assignment.id,
        assetId,
        ip: req.ip,
        sessionId: req.sessionID || null,
        previousStatus: currentStatus,
        newStatus: 'assigned',
        assignedTo: { type: assignedToType, id: assignedToId },
        departmentId: effectiveDepartmentId,
        location: assignmentLocation,
        assignedDate: assignedDate.toISOString(),
        expectedReturnDate: requestedExpectedReturnDate || null,
        condition: condition_at_assignment || asset.condition || 'Good',
        notes: notes || remarks || '',
      },
      transaction,
    });

    await transaction.commit();
    if (assignedToType === 'user') {
      try {
        await createEventNotification({ event: 'assignment_created', eventKey: `assignment_created:${assignment.id}:user:${assignedToId}`, entityId: assignment.id, userIds: [assignedToId], senderId: actorId, assetId, type: 'assignment', title: 'Asset assigned to you', message: `${asset.name || asset.assetCode} has been assigned to you.` });
      } catch (notificationError) { console.error('Assignment notification failed:', notificationError.message); }
    }
    try {
      await createDepartmentEventNotification({
        event: 'department_asset_assigned',
        eventKey: `department_asset_assigned:${assignment.id}`,
        departmentId: asset.departmentId,
        senderId: actorId,
        entityType: 'assignment',
        entityId: assignment.id,
        assetId,
        actionUrl: '/department-head/assignments',
        type: 'assignment',
        title: 'Asset assigned',
        message: `${asset.name || asset.assetCode} was assigned within your department.`,
      });
    } catch (notificationError) { console.error('Department assignment notification failed:', notificationError.message); }
    const populatedAssignment = await Assignment.findByPk(assignment.id, { include: assignmentInclude });
    const assignmentResponse = toAssignmentResponse(populatedAssignment);
    res.status(201).json({ success: true, message: 'Asset assigned successfully', data: assignmentResponse, assignment: assignmentResponse });
  } catch (error) {
    console.error('Assignment creation failed:', error);
    if (!transaction.finished) await transaction.rollback();
    res.status(500).json({ success: false, message: 'Unable to save assignment. Please verify the selected asset and user.' });
  }
});

router.post('/:id/return', ...canManageAssignments, resolveAssignmentOrganizationScope, async (req, res, next) => {
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
    if (['ict_officer', 'store_manager', 'college_manager'].includes(req.user.role)
      && Number(asset.collegeId) !== Number(req.organizationScope.collegeId)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' });
    }
    if (req.user.role === 'department_head' && Number(asset.departmentId) !== Number(getDepartmentScopeId(req))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
    }
    if (assignment.status !== 'active') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only an active assignment can be returned.' });
    }
    const returnedAt = new Date();
    const previousValue = assignment.toJSON();
    await assignment.update({ status: 'returned', workflowStatus: 'returned', returnedAt }, { transaction });
    await inventory.update({ availableQuantity: inventory.availableQuantity + 1 }, { transaction });
    await asset.update({ status: 'available' }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId: assignment.assetId, userId: req.user.id, type: 'return', quantity: 1, reason: 'Asset returned', notes: req.body.notes || '' }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'RETURN_ASSET',
      entity: `assignment:${assignment.id}`,
      entityId: assignment.id,
      oldValue: previousValue,
      newValue: { ...assignment.toJSON(), assetStatus: 'available' },
      details: { assetId: assignment.assetId, ip: req.ip, sessionId: req.sessionID || null },
      transaction,
    });
    await transaction.commit();
    if (assignment.assignedToType === 'user' && assignment.assignedToId) {
      try {
        await createEventNotification({ event: 'assignment_returned', eventKey: `assignment_returned:${assignment.id}:user:${assignment.assignedToId}`, entityId: assignment.id, userIds: [assignment.assignedToId], senderId: req.user.id, assetId: assignment.assetId, type: 'assignment', title: 'Asset returned', message: 'An asset assigned to you has been returned.' });
      } catch (notificationError) { console.error('Assignment return notification failed:', notificationError.message); }
    }
    try {
      const asset = await Asset.findByPk(assignment.assetId, { attributes: ['id', 'name', 'assetCode', 'departmentId'] });
      if (asset) {
        await createDepartmentEventNotification({
          event: 'department_asset_returned',
          eventKey: `department_asset_returned:${assignment.id}`,
          departmentId: asset.departmentId,
          senderId: req.user.id,
          entityType: 'assignment',
          entityId: assignment.id,
          assetId: assignment.assetId,
          actionUrl: '/department-head/returns',
          type: 'assignment',
          title: 'Asset returned',
          message: `${asset.name || asset.assetCode} was returned to your department.`,
        });
      }
    } catch (notificationError) { console.error('Department asset return notification failed:', notificationError.message); }
    const populated = await Assignment.findByPk(assignment.id, { include: assignmentInclude });
    res.json({ success: true, assignment: toAssignmentResponse(populated) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.post('/:id/transfer', ...canManageAssignments, resolveAssignmentOrganizationScope, async (req, res, next) => {
  const assignedToType = String(req.body.assigned_to_type || req.body.assignedToType || 'user').trim().toLowerCase();
  const assignedToId = Number(req.body.assigned_to_id || req.body.assignedToId || req.body.new_user_id || req.body.newUserId);
  if (!['user', 'department', 'laboratory'].includes(assignedToType)) return res.status(400).json({ success: false, message: 'Assigned To type must be User, Department or Laboratory.' });
  if (!Number.isInteger(assignedToId) || assignedToId <= 0) return res.status(400).json({ success: false, message: 'Select a valid Assigned To record.' });
  const allowedConditions = new Set(['excellent', 'good', 'fair', 'poor', 'damaged']);
  const requestedCondition = req.body.condition_at_assignment || req.body.condition;
  if (requestedCondition && !allowedConditions.has(String(requestedCondition).trim().toLowerCase())) return res.status(400).json({ success: false, message: 'Condition must be Excellent, Good, Fair, Poor or Damaged.' });
  const requestedExpectedReturnDate = req.body.expected_return_date || req.body.expectedReturnDate;
  if (requestedExpectedReturnDate && Number.isNaN(Date.parse(requestedExpectedReturnDate))) return res.status(400).json({ success: false, message: 'Invalid expected return date.' });
  if (requestedExpectedReturnDate && new Date(requestedExpectedReturnDate) < new Date()) return res.status(400).json({ success: false, message: 'Expected return date cannot be in the past.' });
  if (req.body.location && String(req.body.location).trim().length > 255) return res.status(400).json({ success: false, message: 'Location must be 255 characters or fewer.' });
  if (req.body.notes && String(req.body.notes).length > 5000) return res.status(400).json({ success: false, message: 'Notes must be 5000 characters or fewer.' });
  const transaction = await sequelize.transaction();
  try {
    const assignment = await Assignment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE }) || await Assignment.findOne({
      where: { assetId: req.params.id, status: 'active' },
      order: [['createdAt', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!assignment) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    if (assignment.status !== 'active') {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only an active assignment can be reassigned.' });
    }
    const asset = await Asset.findByPk(assignment.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    if (['ict_officer', 'store_manager', 'college_manager'].includes(req.user.role)) {
      if (Number(asset.collegeId) !== Number(req.organizationScope.collegeId)) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' });
      }
    }
    if (req.user.role === 'department_head' && Number(asset.departmentId) !== Number(getDepartmentScopeId(req))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
    }
    const assignee = assignedToType === 'user' ? await User.findByPk(assignedToId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const departmentId = Number(req.body.department_id || req.body.departmentId || (assignedToType === 'department' ? assignedToId : assignment.departmentId)) || null;
    const department = assignedToType === 'department'
      ? await Department.findByPk(assignedToId, { transaction, lock: transaction.LOCK.UPDATE })
      : departmentId ? await Department.findByPk(departmentId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const laboratoryId = Number(req.body.laboratory_id || req.body.laboratoryId || (assignedToType === 'laboratory' ? assignedToId : 0)) || null;
    const laboratory = assignedToType === 'laboratory'
      ? await Room.findByPk(laboratoryId, { transaction, lock: transaction.LOCK.UPDATE })
      : null;
    if (assignedToType === 'user' && (!assignee || !assignee.active)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Select an active user to receive this asset.' });
    }
    if (assignedToType === 'department' && (!department || department.status !== 'active')) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Active department not found.' });
    }
    if (assignedToType === 'laboratory' && (!laboratory || laboratory.status !== 'active' || !String(laboratory.roomType || '').toLowerCase().includes('lab') || !department)) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Select a valid active laboratory and its department.' });
    }
    if (assignedToType === 'user' && departmentId && assignee.departmentId && Number(assignee.departmentId) !== departmentId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected user does not belong to the selected department.' });
    }
    if (req.body.college_id && assignedToType === 'user' && Number(assignee.collegeId) !== Number(req.body.college_id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected user does not belong to the selected college.' });
    }
    if (req.body.college_id && assignedToType !== 'user' && Number(department?.collegeId) !== Number(req.body.college_id)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'The selected department does not belong to the selected college.' });
    }
    const recipientCollegeId = assignedToType === 'user' ? assignee?.collegeId : department?.collegeId;
    const managerCollegeId = ['ict_officer', 'store_manager'].includes(req.user.role)
      ? req.organizationScope?.collegeId
      : null;
    if (managerCollegeId && (req.user.role === 'store_manager'
      ? Number(recipientCollegeId) !== Number(managerCollegeId)
      : recipientCollegeId && Number(recipientCollegeId) !== Number(managerCollegeId))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Recipient is outside your organization scope.' });
    }
    if (managerCollegeId && (req.user.role === 'store_manager'
      ? Number(department?.collegeId) !== Number(managerCollegeId)
      : department?.collegeId && Number(department.collegeId) !== Number(managerCollegeId))) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department is outside your organization scope.' });
    }
    if (req.user.role === 'department_head' && departmentId && departmentId !== getDepartmentScopeId(req)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Recipient department is outside your department scope.' });
    }
    const previousValue = assignment.toJSON();
    const assignedDate = new Date();
    const nextLocation = String(req.body.location || laboratory?.roomName || assignment.location || asset.location || '').trim();
    const nextCondition = String(req.body.condition_at_assignment || req.body.condition || assignment.conditionAtAssignment || asset.condition || 'Good');
    const nextNotes = String(req.body.notes || '').trim();
    const previousNotes = parseAssignmentNotes(assignment.notes);
    await assignment.update({ status: 'closed', workflowStatus: 'reassigned' }, { transaction });
    const nextAssignment = await Assignment.create({
      assetId: assignment.assetId,
      assignedTo: assignedToType === 'user' ? assignedToId : null,
      assignedToType,
      assignedToId,
      assignedBy: req.user.id,
      status: 'active',
      workflowStatus: 'assigned',
      assignedDate,
      expectedReturnDate: requestedExpectedReturnDate || assignment.expectedReturnDate,
      departmentId: departmentId || assignee?.departmentId || null,
      location: nextLocation,
      conditionAtAssignment: nextCondition,
      notes: JSON.stringify({
        ...previousNotes,
        notes: nextNotes || previousNotes.notes || '',
        departmentId: departmentId || assignee?.departmentId || null,
        departmentName: department?.name || previousNotes.departmentName || '',
        location: nextLocation,
        condition: nextCondition,
      }),
    }, { transaction });
    await asset.update({
      status: 'assigned',
      ...(nextLocation ? { location: nextLocation } : {}),
      ...(departmentId || assignee?.departmentId ? { departmentId: departmentId || assignee.departmentId } : {}),
      ...(laboratory ? { roomId: laboratory.id } : {}),
    }, { transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'REASSIGN_ASSET',
      entity: `assignment:${nextAssignment.id}`,
      entityId: nextAssignment.id,
      oldValue: previousValue,
      newValue: nextAssignment.toJSON(),
      details: { previousAssignmentId: assignment.id, assetId: assignment.assetId, ip: req.ip, sessionId: req.sessionID || null },
      transaction,
    });
    await transaction.commit();
    const populated = await Assignment.findByPk(nextAssignment.id, { include: assignmentInclude });
    res.json({ success: true, message: 'Asset reassigned successfully.', assignment: toAssignmentResponse(populated) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});

router.delete('/:id', ...canManageAssignments, (req, res) => {
  res.status(405).json({ success: false, message: 'Assignment history is retained and cannot be deleted. Use the return action to close an active assignment.' });
});

module.exports = router;
