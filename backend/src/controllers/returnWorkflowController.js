const crypto = require('crypto');
const { sequelize, AssetReturn, Asset, Assignment, AssetCustody, AssetMovement, AuditLog, Inventory, InventoryTransaction, Maintenance, MaintenanceHistory, User } = require('../models');
const { Op } = require('sequelize');

const transitions = { Requested: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Ready for Return', 'Cancelled'], 'Ready for Return': ['In Transit'], 'In Transit': ['Received'], Received: ['Inspected'], Inspected: ['Completed'], Completed: [] };
const number = () => `RET-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const validConditions = ['Good', 'Fair', 'Damaged', 'Heavily damaged', 'Missing parts', 'Non-functional'];
const damagedConditions = new Set(['damaged', 'heavily damaged', 'missing parts', 'non-functional']);
const openMaintenanceStatuses = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing'];
const reservingReturnStatuses = ['Requested', 'Approved', 'Ready for Return', 'In Transit'];
const returnStatuses = ['Requested', 'Approved', 'Ready for Return', 'In Transit', 'Received', 'Inspected', 'Completed', 'Rejected', 'Cancelled'];
const currentDate = () => new Date().toISOString().slice(0, 10);
const parseDateOnly = (value) => {
  const date = String(value || currentDate()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) return null;
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date ? date : null;
};
const isDamagedCondition = (condition) => damagedConditions.has(String(condition || '').trim().toLowerCase());
const scopeWhere = (req) => {
  if (req.organizationScope) {
    const scopeId = Number(req.organizationScope.departmentId || req.organizationScope.collegeId);
    if (!Number.isSafeInteger(scopeId) || scopeId <= 0) return null;
    return req.organizationScope.departmentId ? { departmentId: scopeId } : { collegeId: scopeId };
  }
  const collegeId = req.user?.collegeId ?? req.user?.college_id;
  const parsedCollegeId = Number(collegeId);
  return Number.isSafeInteger(parsedCollegeId) && parsedCollegeId > 0 ? { collegeId: parsedCollegeId } : null;
};
const returnInclude = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'serialNumber'] },
  { model: User, as: 'ReturningPerson', attributes: ['id', 'fullName', 'username'] },
];
const normalize = (item) => {
  const data = item.toJSON();
  const personValue = data.ReturningPerson || item.ReturningPerson || null;
  const returningPerson = personValue?.toJSON ? personValue.toJSON() : personValue;
  return {
    ...data,
    return_number: data.returnNumber,
    asset_id: data.assetId,
    asset_name: data.Asset?.name || null,
    returning_person_name: returningPerson?.fullName || returningPerson?.username || null,
    returning_person: returningPerson,
    return_date: data.returnDate || null,
    evidence_url: data.evidenceUrl || null,
  };
};

const notifyReturn = async (req, row, event, userIds) => {
  try {
    const { createEventNotification } = require('../services/notificationService');
    await createEventNotification({
      event,
      eventKey: `asset-return:${row.id}:${row.status}`,
      userIds: [...new Set(userIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))],
      senderId: req.user?.id || null,
      title: `Asset return ${String(row.status || '').toLowerCase()}`,
      message: `${row.returnNumber || `Return #${row.id}`} is now ${row.status}.`,
      type: 'approval',
      priority: 'medium',
      entityType: 'asset_return',
      entityId: row.id,
      assetId: row.assetId,
    });
  } catch (error) {
    console.error('Asset return notification failed:', {
      requestId: req.requestId || null,
      operation: 'notify asset return workflow',
      errorCategory: error.name || 'Error',
      code: error.code || error.original?.code || error.parent?.code,
    });
  }
};

const createDamageMaintenance = async ({ asset, returnRecord, userId, transaction }) => {
  const existing = await Maintenance.findOne({
    where: { assetId: asset.id, status: { [Op.in]: openMaintenanceStatuses } },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (existing) return existing;

  const notes = String(returnRecord.notes || '').trim();
  const item = await Maintenance.create({
    assetId: asset.id,
    requestedBy: userId,
    title: `Damaged asset return - ${asset.name || asset.assetCode || asset.id}`.slice(0, 255),
    description: [`Return ${returnRecord.returnNumber} reported condition: ${returnRecord.condition}.`, notes].filter(Boolean).join('\n'),
    priority: 'high',
    status: 'pending',
  }, { transaction });
  await MaintenanceHistory.create({
    assetId: asset.id,
    maintenanceId: item.id,
    userId,
    actionType: 'created',
    actionDate: new Date(),
    newStatus: item.status,
    description: 'Maintenance request created from a damaged asset return.',
    details: { returnId: returnRecord.id, returnNumber: returnRecord.returnNumber },
  }, { transaction });
  await AuditLog.create({
    userId,
    action: 'DAMAGED_RETURN_MAINTENANCE_CREATED',
    entity: `maintenance:${item.id}`,
    details: JSON.stringify({ maintenanceId: item.id, returnId: returnRecord.id, assetId: asset.id }),
  }, { transaction });
  return item;
};

const listReturns = async (req, res, next) => {
  try {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const pageSizeValue = req.query.pageSize ?? req.query.limit;
    const pageSize = pageSizeValue === undefined ? 25 : Number(pageSizeValue);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return res.status(400).json({ success: false, message: 'Page and page size must be positive integers; page size cannot exceed 100.' });
    }
    const scope = scopeWhere(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Return scope is not configured for this account' });
    const status = String(req.query.status || '').trim();
    if (status && !returnStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Return status filter is invalid.' });
    }
    const where = { ...scope };
    if (status) where.status = status;
    const search = String(req.query.search || '').trim();
    if (search.length > 255) return res.status(400).json({ success: false, message: 'Search text is too long.' });
    const include = returnInclude.map((entry) => entry.model === Asset
      ? {
        ...entry,
        required: true,
        where: {
          ...(req.organizationScope?.collegeId ? { collegeId: Number(req.organizationScope.collegeId) } : {}),
          ...(req.organizationScope?.departmentId ? { departmentId: Number(req.organizationScope.departmentId) } : {}),
          ...(search ? { [Op.or]: [{ assetCode: { [Op.like]: `%${search}%` } }, { name: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }] } : {}),
        },
      }
      : entry);
    const result = await AssetReturn.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const rows = result.rows.map(normalize);
    const statusRows = await AssetReturn.findAll({
      where: scope,
      attributes: ['status'],
      raw: true,
    });
    const statusTotals = statusRows.reduce((totals, row) => {
      totals[row.status] = (totals[row.status] || 0) + 1;
      return totals;
    }, {});
    res.json({
      success: true,
      data: rows,
      returns: rows,
      summary: { total: statusRows.length, byStatus: statusTotals },
      pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) },
    });
  } catch (error) {
    console.error('Failed to list asset returns:', {
      requestId: req.requestId || null,
      operation: `${req.method || 'GET'} ${req.path || '/api/college/returns'}`,
      errorCategory: error.name || 'Error',
      code: error.original?.code || error.parent?.code || error.code,
      sqlMessage: error.original?.sqlMessage || error.parent?.sqlMessage,
    });
    return next(error);
  }
};
const getReturn = async (req, res, next) => {
  try {
    const scope = scopeWhere(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Return scope is not configured for this account' });
    const row = await AssetReturn.findOne({ where: { id: req.params.id, ...scope }, include: returnInclude });
    if (!row) return res.status(404).json({ success: false, message: 'Return not found in your scope' });
    return res.json({ success: true, data: normalize(row) });
  } catch (error) { return next(error); }
};

const listEligibleReturnAssets = async (req, res, next) => {
  try {
    const scope = scopeWhere(req);
    if (!scope || !req.organizationScope?.collegeId) {
      return res.status(403).json({ success: false, message: 'College return scope is not configured for this account' });
    }
    const collegeId = Number(req.organizationScope.collegeId);
    const [assignments, custodies, openReturns] = await Promise.all([
      Assignment.findAll({
        where: { status: 'active' },
        attributes: ['assetId', 'assignedTo', 'quantity'],
        include: [
          { model: Asset, required: true, where: { collegeId }, attributes: ['id', 'assetCode', 'name', 'serialNumber', 'collegeId', 'departmentId', 'department', 'location', 'status', 'condition'] },
          { model: User, required: false, attributes: ['id', 'fullName', 'username'] },
        ],
      }),
      AssetCustody.findAll({
        where: { status: 'active' },
        attributes: ['assetId', 'custodianId'],
        include: [
          { model: Asset, required: true, where: { collegeId }, attributes: ['id', 'assetCode', 'name', 'serialNumber', 'collegeId', 'departmentId', 'department', 'location', 'status', 'condition'] },
          { model: User, as: 'Custodian', required: true, attributes: ['id', 'fullName', 'username'] },
        ],
      }),
      AssetReturn.findAll({
        where: { collegeId, status: { [Op.in]: reservingReturnStatuses } },
        attributes: ['assetId', 'sourceUserId', 'quantity'],
        raw: true,
      }),
    ]);

    const reserved = new Map();
    for (const row of openReturns) {
      const key = `${row.assetId}:${row.sourceUserId || ''}`;
      reserved.set(key, (reserved.get(key) || 0) + Number(row.quantity || 1));
    }
    const options = new Map();
    for (const assignment of assignments) {
      const asset = assignment.Asset;
      const quantity = Number(assignment.quantity || 1);
      const sourceUserId = Number(assignment.assignedTo);
      const remainingQuantity = quantity - (reserved.get(`${asset.id}:${sourceUserId}`) || 0);
      if (!Number.isSafeInteger(sourceUserId) || sourceUserId < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || remainingQuantity < 1) continue;
      options.set(Number(asset.id), {
        id: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        serialNumber: asset.serialNumber,
        departmentId: asset.departmentId,
        department: asset.department,
        location: asset.location,
        status: asset.status,
        condition: asset.condition,
        custodian: assignment.User || null,
        sourceUserId,
        availableQuantity: remainingQuantity,
      });
    }
    for (const custody of custodies) {
      const asset = custody.Asset;
      const sourceUserId = Number(custody.custodianId);
      const remainingQuantity = 1 - (reserved.get(`${asset.id}:${sourceUserId}`) || 0);
      if (remainingQuantity < 1 || options.has(Number(asset.id))) continue;
      const custodian = custody.Custodian;
      options.set(Number(asset.id), {
        id: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        serialNumber: asset.serialNumber,
        departmentId: asset.departmentId,
        department: asset.department,
        location: asset.location,
        status: asset.status,
        condition: asset.condition,
        custodian: custodian ? { id: custodian.id, name: custodian.fullName || custodian.username } : null,
        sourceUserId,
        availableQuantity: remainingQuantity,
      });
    }
    return res.json({ success: true, data: [...options.values()] });
  } catch (error) {
    console.error('Failed to load eligible return assets:', {
      requestId: req.requestId || null,
      operation: `${req.method || 'GET'} ${req.path || '/api/college/returns/options'}`,
      errorCategory: error.name || 'Error',
      code: error.original?.code || error.parent?.code || error.code,
      sqlMessage: error.original?.sqlMessage || error.parent?.sqlMessage,
    });
    return next(error);
  }
};

const createReturn = async (req, res, next) => {
  const assetId = Number(req.body.asset_id ?? req.body.assetId);
  const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);
  const reason = String(req.body.reason || 'End of Assignment').trim();
  const condition = String(req.body.condition || 'Good').trim();
  const notes = String(req.body.notes || '').trim();
  const returnDate = parseDateOnly(req.body.return_date ?? req.body.returnDate);
  const evidenceUrl = String(req.body.evidence_url || '').trim();
  const validReasons = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];
  if (!Number.isSafeInteger(assetId) || assetId < 1 || !validReasons.includes(reason)) return res.status(400).json({ success: false, message: 'Asset and valid return reason are required' });
  if (!Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ success: false, message: 'Return quantity must be a positive whole number' });
  if (!validConditions.includes(condition)) return res.status(400).json({ success: false, message: 'A valid returned asset condition is required' });
  if (!returnDate) return res.status(400).json({ success: false, message: 'A valid return date is required' });
  if (evidenceUrl && (!evidenceUrl.startsWith('/uploads/') || evidenceUrl.length > 1000)) return res.status(400).json({ success: false, message: 'Return evidence must be an uploaded file' });
  if (['Damage', 'Other'].includes(reason) && notes.length < 5) return res.status(400).json({ success: false, message: 'Additional explanation is required for this return reason' });

  let transaction;
  try {
    transaction = await sequelize.transaction();
    const organizationScope = req.organizationScope || {};
    const scope = scopeWhere(req);
    if (!scope) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Return scope is not configured for this account' }); }
    const asset = await Asset.findOne({ where: { id: assetId, ...(organizationScope.departmentId ? { departmentId: organizationScope.departmentId } : { collegeId: organizationScope.collegeId }) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' }); }
    if (['disposed', 'missing'].includes(String(asset.status).toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot be returned in its current state' }); }
    const assignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    const custody = assignment ? null : await AssetCustody.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment && !custody) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset has no active assignment or custody to return' }); }
    const sourceUserId = Number(assignment?.assignedTo ?? custody?.custodianId);
    if (!Number.isSafeInteger(sourceUserId) || sourceUserId < 1) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The asset has no valid current custodian' }); }
    const assignedQuantity = Number(assignment?.quantity || 1);
    if (!Number.isSafeInteger(assignedQuantity) || assignedQuantity < 1 || quantity > assignedQuantity) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Return quantity exceeds the assigned or held quantity' });
    }
    const reservedReturns = await AssetReturn.findAll({
      where: { assetId, sourceUserId, status: { [Op.in]: reservingReturnStatuses } },
      attributes: ['quantity'],
      transaction,
      raw: true,
    });
    const reservedQuantity = reservedReturns.reduce((total, row) => total + Number(row.quantity || 1), 0);
    if (quantity + reservedQuantity > assignedQuantity) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'This return would exceed the quantity not already included in another open return' });
    }
    const returningPerson = await User.findByPk(sourceUserId, { attributes: ['id', 'fullName', 'username'], transaction });
    if (!returningPerson) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The person assigned to this asset could not be found' }); }
    const row = await AssetReturn.create({
      returnNumber: number(),
      assetId,
      quantity,
      collegeId: asset.collegeId,
      departmentId: asset.departmentId,
      sourceUserId,
      requestedBy: req.user.id,
      reason,
      condition,
      notes,
      returnDate,
      evidenceUrl: evidenceUrl || null,
      outcome: isDamagedCondition(condition) ? 'Maintenance Required' : null,
      status: 'Requested',
    }, { transaction });
    if (isDamagedCondition(condition)) await createDamageMaintenance({ asset, returnRecord: row, userId: req.user.id, transaction });
    await AuditLog.create({ userId: req.user.id, action: 'RETURN_CREATED', entity: `return:${row.id}`, details: JSON.stringify({ assetId, quantity, beforeStatus: asset.status, afterStatus: asset.status }) }, { transaction });
    row.ReturningPerson = returningPerson;
    await transaction.commit();
    let collegeManagers = [];
    try {
      collegeManagers = await User.findAll({ where: { collegeId: asset.collegeId, role: 'college_manager', active: true }, attributes: ['id'], raw: true });
    } catch (error) {
      console.error('Asset return notification recipient lookup failed:', {
        requestId: req.requestId || null,
        operation: 'find college managers for return notification',
        errorCategory: error.name || 'Error',
        code: error.original?.code || error.parent?.code || error.code,
      });
    }
    await notifyReturn(req, row, 'asset_return_submitted', [sourceUserId, ...collegeManagers.map((user) => user.id)]);
    return res.status(201).json({ success: true, message: 'Return request created', data: normalize(row) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const processStoreReturn = async (req, res, next) => {
  const assetId = Number(req.body.asset_id);
  const condition = String(req.body.condition || 'Good').trim();
  const reason = String(req.body.reason || 'End of Assignment').trim();
  const location = String(req.body.location || '').trim();
  const notes = String(req.body.notes || '').trim();
  const returnDate = parseDateOnly(req.body.return_date ?? req.body.returnDate);
  const evidenceUrl = String(req.body.evidence_url || '').trim();
  const validReasons = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];
  if (!Number.isInteger(assetId) || assetId <= 0 || !location) return res.status(400).json({ success: false, message: 'A valid assigned asset and return location are required' });
  if (!validConditions.includes(condition)) return res.status(400).json({ success: false, message: 'A valid returned asset condition is required' });
  if (!validReasons.includes(reason)) return res.status(400).json({ success: false, message: 'A valid return reason is required' });
  if (!returnDate) return res.status(400).json({ success: false, message: 'A valid return date is required' });
  if (evidenceUrl && (!evidenceUrl.startsWith('/uploads/') || evidenceUrl.length > 1000)) return res.status(400).json({ success: false, message: 'Return evidence must be an uploaded file' });
  if (['Damage', 'Other'].includes(reason) && notes.length < 5) return res.status(400).json({ success: false, message: 'Additional explanation is required for this return reason' });
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const collegeId = req.organizationScope?.collegeId ?? req.user?.collegeId ?? req.user?.college_id;
    if (!Number.isSafeInteger(Number(collegeId)) || Number(collegeId) <= 0) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Store Manager college scope is not configured' }); }
    const asset = await Asset.findOne({ where: { id: assetId, collegeId: Number(collegeId) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found in your store scope' }); }
    const assignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This asset is not currently assigned or has already been returned' }); }
    const quantity = Number(assignment.quantity || 1);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The assigned quantity is invalid and cannot be returned safely' }); }
    const inventory = await Inventory.findOne({ where: { assetId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const damaged = isDamagedCondition(condition);
    const row = await AssetReturn.create({ returnNumber: number(), assetId, quantity, collegeId: asset.collegeId, departmentId: asset.departmentId, sourceUserId: assignment.assignedTo, requestedBy: req.user.id, receivedBy: req.user.id, receivedAt: new Date(), returnDate, evidenceUrl: evidenceUrl || null, reason, condition, notes, status: 'Received', outcome: damaged ? 'Maintenance Required' : 'Accepted' }, { transaction });
    if (damaged) await createDamageMaintenance({ asset, returnRecord: row, userId: req.user.id, transaction });
    await assignment.update({ status: 'returned' }, { transaction });
    await inventory.update({ availableQuantity: damaged ? inventory.availableQuantity : inventory.availableQuantity + quantity, damagedQuantity: damaged ? inventory.damagedQuantity + quantity : inventory.damagedQuantity, location }, { transaction });
    await asset.update({ status: damaged ? 'damaged' : inventory.availableQuantity + quantity > 0 ? 'available' : 'assigned', condition, location }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId, userId: req.user.id, type: 'return', quantity, toLocation: location, reason, notes }, { transaction });
    await AssetMovement.create({ assetId, movementType: 'return', sourceType: 'user', sourceId: assignment.assignedTo, destinationType: 'store', destinationId: null, referenceType: 'return', referenceId: row.id, performedBy: req.user.id, notes }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'STORE_ASSET_RETURNED', entity: `return:${row.id}`, details: JSON.stringify({ assetId, assignmentId: assignment.id, returnNumber: row.returnNumber, quantity, previousStatus: asset._previousDataValues.status || asset.status, newStatus: damaged ? 'damaged' : 'available', condition, location, reason }) }, { transaction });
    await transaction.commit();
    return res.status(201).json({ success: true, message: 'Asset returned successfully', data: normalize(row) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const changeReturn = (target, roles) => async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const scope = scopeWhere(req);
    if (!scope) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Return scope is not configured for this account' }); }
    const row = await AssetReturn.findOne({ where: { id: req.params.id, ...scope }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Return not found in your scope' }); }
    if (!roles.includes(req.user.role)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Return action is not authorized' }); }
    if (!transitions[row.status]?.includes(target)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid return transition from ${row.status} to ${target}` }); }
    if (target === 'Approved' && row.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own return' }); }
    if (target === 'Rejected' && !String(req.body.reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A rejection reason is required' }); }
    const updates = { status: target };
    if (target === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvedAt: new Date() });
    if (target === 'Received') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() });
    if (target === 'Inspected') {
      const condition = req.body.condition === undefined ? row.condition : String(req.body.condition).trim();
      if (!validConditions.includes(condition)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid inspected asset condition is required' }); }
      const inspectionNotes = String(req.body.inspection_notes || '').trim();
      if (inspectionNotes.length > 5000) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Inspection notes are too long' }); }
      Object.assign(updates, { inspectedBy: req.user.id, inspectedAt: new Date(), condition, outcome: String(req.body.outcome || (isDamagedCondition(condition) ? 'Maintenance Required' : 'Accepted')).trim(), inspectionNotes });
    }
    await row.update(updates, { transaction });
    if (target === 'Received') {
      const asset = await Asset.findOne({ where: { id: row.assetId, ...scope }, transaction, lock: transaction.LOCK.UPDATE });
      if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset for this return no longer exists' }); }
      const quantity = Number(row.quantity || 1);
      if (!Number.isSafeInteger(quantity) || quantity < 1) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Return quantity is invalid' }); }
      const assignment = await Assignment.findOne({
        where: { assetId: asset.id, assignedTo: row.sourceUserId, status: 'active' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const custody = assignment ? null : await AssetCustody.findOne({
        where: { assetId: asset.id, custodianId: row.sourceUserId, status: 'active' },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!assignment && !custody) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The return no longer matches an active assignment or custody record' }); }
      if (assignment && quantity > Number(assignment.quantity || 1)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Return quantity exceeds the remaining active assignment quantity' }); }
      const inventory = await Inventory.findOne({ where: { assetId: asset.id }, transaction, lock: transaction.LOCK.UPDATE });
      if (!inventory) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Inventory record is required before receiving this return' }); }
      const damaged = isDamagedCondition(row.condition);
      const assignmentRemains = Boolean(assignment && Number(assignment.quantity || 1) > quantity);
      if (assignment) {
        const remainingQuantity = Number(assignment.quantity || 1) - quantity;
        if (remainingQuantity === 0) {
          await assignment.update({ status: 'returned', workflowStatus: 'returned', returnedAt: new Date() }, { transaction });
        } else {
          await assignment.update({ quantity: remainingQuantity }, { transaction });
        }
      } else {
        await custody.update({ status: 'returned', returnedDate: new Date() }, { transaction });
      }
      await inventory.update({
        availableQuantity: damaged ? Number(inventory.availableQuantity || 0) : Number(inventory.availableQuantity || 0) + quantity,
        damagedQuantity: damaged ? Number(inventory.damagedQuantity || 0) + quantity : Number(inventory.damagedQuantity || 0),
      }, { transaction });
      await asset.update({ status: damaged ? 'damaged' : assignmentRemains ? 'assigned' : 'available', condition: row.condition }, { transaction });
      if (damaged) await createDamageMaintenance({ asset, returnRecord: row, userId: req.user.id, transaction });
      await InventoryTransaction.create({
        inventoryId: inventory.id,
        assetId: asset.id,
        userId: req.user.id,
        departmentId: row.departmentId,
        type: damaged ? 'damage' : 'return',
        quantity,
        fromLocation: asset.location || '',
        toLocation: inventory.location || asset.location || '',
        reason: row.reason,
        notes: row.notes || '',
      }, { transaction });
      await AssetMovement.create({ assetId: asset.id, movementType: 'return', sourceType: 'user', sourceId: row.sourceUserId, destinationType: 'store', destinationId: null, referenceType: 'return', referenceId: row.id, performedBy: req.user.id, notes: String(req.body.notes || '').trim() }, { transaction });
    }
    if (target === 'In Transit') {
      await AssetMovement.create({
        assetId: row.assetId,
        movementType: 'return_dispatch',
        sourceType: 'user',
        sourceId: row.sourceUserId,
        destinationType: 'store',
        destinationId: null,
        referenceType: 'return',
        referenceId: row.id,
        performedBy: req.user.id,
        notes: String(req.body.notes || '').trim(),
      }, { transaction });
    }
    await AuditLog.create({ userId: req.user.id, action: `RETURN_${target.replace(/ /g, '_').toUpperCase()}`, entity: `return:${row.id}`, details: JSON.stringify({ beforeStatus: row._previousDataValues.status, afterStatus: target, reason: req.body.reason || '' }) }, { transaction });
    await transaction.commit();
    await notifyReturn(req, row, 'asset_return_status_changed', [row.requestedBy, row.sourceUserId]);
    return res.json({ success: true, message: 'Return status updated', data: normalize(row) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

module.exports = {
  listReturns,
  listEligibleReturnAssets,
  getReturn,
  createReturn,
  processStoreReturn,
  approveReturn: changeReturn('Approved', ['college_manager', 'college', 'admin']),
  rejectReturn: changeReturn('Rejected', ['college_manager', 'college', 'admin']),
  cancelReturn: changeReturn('Cancelled', ['department_head', 'college_manager', 'college', 'admin']),
  readyReturn: changeReturn('Ready for Return', ['store_manager']),
  dispatchReturn: changeReturn('In Transit', ['store_manager']),
  receiveReturn: changeReturn('Received', ['store_manager']),
  inspectReturn: changeReturn('Inspected', ['store_manager', 'maintenance']),
  completeReturn: changeReturn('Completed', ['store_manager']),
};
