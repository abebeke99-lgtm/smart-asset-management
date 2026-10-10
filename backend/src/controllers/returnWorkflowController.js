const crypto = require('crypto');
const { sequelize, AssetReturn, Asset, Assignment, AssetMovement, AuditLog, Inventory, InventoryTransaction, Maintenance, MaintenanceHistory, User } = require('../models');
const { Op } = require('sequelize');

const transitions = { Requested: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Ready for Return', 'Cancelled'], 'Ready for Return': ['Received'], Received: ['Inspected'], Inspected: [] };
const number = () => `RET-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const validConditions = ['Good', 'Fair', 'Damaged', 'Heavily damaged', 'Missing parts', 'Non-functional'];
const damagedConditions = new Set(['damaged', 'heavily damaged', 'missing parts', 'non-functional']);
const openMaintenanceStatuses = ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing'];
const currentDate = () => new Date().toISOString().slice(0, 10);
const parseDateOnly = (value) => {
  const date = String(value || currentDate()).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))) return null;
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date ? date : null;
};
const isDamagedCondition = (condition) => damagedConditions.has(String(condition || '').trim().toLowerCase());
const scopeWhere = (req) => {
  if (req.organizationScope) return req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
  const collegeId = req.user?.collegeId ?? req.user?.college_id;
  return collegeId ? { collegeId: Number(collegeId) } : {};
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
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const where = scopeWhere(req);
    if (req.query.status) where.status = String(req.query.status);
    const search = String(req.query.search || '').trim();
    const include = returnInclude.map((entry) => entry.model === Asset
      ? { ...entry, required: Boolean(search), ...(search ? { where: { [Op.or]: [{ assetCode: { [Op.like]: `%${search}%` } }, { name: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }] } } : {}) }
      : entry);
    const result = await AssetReturn.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const rows = result.rows.map(normalize);
    res.json({ success: true, data: rows, returns: rows, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } });
  } catch (error) { next(error); }
};
const getReturn = async (req, res, next) => { try { const row = await AssetReturn.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, include: returnInclude }); if (!row) return res.status(404).json({ success: false, message: 'Return not found in your scope' }); res.json({ success: true, data: normalize(row) }); } catch (error) { next(error); } };

const createReturn = async (req, res, next) => {
  const assetId = Number(req.body.asset_id);
  const reason = String(req.body.reason || 'End of Assignment').trim();
  const condition = String(req.body.condition || 'Good').trim();
  const notes = String(req.body.notes || '').trim();
  const returnDate = parseDateOnly(req.body.return_date ?? req.body.returnDate);
  const evidenceUrl = String(req.body.evidence_url || '').trim();
  const validReasons = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];
  if (!Number.isSafeInteger(assetId) || assetId < 1 || !validReasons.includes(reason)) return res.status(400).json({ success: false, message: 'Asset and valid return reason are required' });
  if (!validConditions.includes(condition)) return res.status(400).json({ success: false, message: 'A valid returned asset condition is required' });
  if (!returnDate) return res.status(400).json({ success: false, message: 'A valid return date is required' });
  if (evidenceUrl && (!evidenceUrl.startsWith('/uploads/') || evidenceUrl.length > 1000)) return res.status(400).json({ success: false, message: 'Return evidence must be an uploaded file' });
  if (['Damage', 'Other'].includes(reason) && notes.length < 5) return res.status(400).json({ success: false, message: 'Additional explanation is required for this return reason' });

  const transaction = await sequelize.transaction();
  try {
    const organizationScope = req.organizationScope || {};
    const asset = await Asset.findOne({ where: { id: assetId, ...(organizationScope.departmentId ? { departmentId: organizationScope.departmentId } : { collegeId: organizationScope.collegeId }) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' }); }
    if (['disposed', 'missing'].includes(String(asset.status).toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot be returned in its current state' }); }
    const assignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset has no active assignment to return' }); }
    if (!Number.isSafeInteger(Number(assignment.assignedTo))) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The active assignment has no person returning the asset' }); }
    const returningPerson = await User.findByPk(assignment.assignedTo, { attributes: ['id', 'fullName', 'username'], transaction });
    if (!returningPerson) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'The person assigned to this asset could not be found' }); }
    const row = await AssetReturn.create({
      returnNumber: number(),
      assetId,
      collegeId: asset.collegeId,
      departmentId: asset.departmentId,
      sourceUserId: assignment.assignedTo,
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
    await AuditLog.create({ userId: req.user.id, action: 'RETURN_CREATED', entity: `return:${row.id}`, details: JSON.stringify({ assetId, beforeStatus: asset.status, afterStatus: asset.status }) }, { transaction });
    row.ReturningPerson = returningPerson;
    await transaction.commit(); res.status(201).json({ success: true, message: 'Return request created', data: normalize(row) });
  } catch (error) { if (!transaction.finished) await transaction.rollback(); next(error); }
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
  const transaction = await sequelize.transaction();
  try {
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
  } catch (error) { await transaction.rollback(); return next(error); }
};

const changeReturn = (target, roles) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await AssetReturn.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Return not found in your scope' }); }
    if (!roles.includes(req.user.role)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Return action is not authorized' }); }
    if (!transitions[row.status]?.includes(target)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid return transition from ${row.status} to ${target}` }); }
    if (target === 'Approved' && row.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own return' }); }
    if (target === 'Rejected' && !String(req.body.reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A rejection reason is required' }); }
    const updates = { status: target }; if (target === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvedAt: new Date() }); if (target === 'Received') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() }); if (target === 'Inspected') Object.assign(updates, { inspectedBy: req.user.id, inspectedAt: new Date(), outcome: req.body.outcome || 'Inspection Required', inspectionNotes: String(req.body.inspection_notes || '').trim() });
    await row.update(updates, { transaction });
    if (target === 'Received') {
      const asset = await Asset.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset for this return no longer exists' }); }
      const damaged = isDamagedCondition(row.condition);
      await Assignment.update({ status: 'returned', returnedAt: new Date() }, { where: { assetId: asset.id, status: 'active' }, transaction });
      await asset.update({ status: damaged ? 'damaged' : 'available', condition: row.condition }, { transaction });
      if (damaged) await createDamageMaintenance({ asset, returnRecord: row, userId: req.user.id, transaction });
      await AssetMovement.create({ assetId: asset.id, movementType: 'return', sourceType: 'user', sourceId: row.sourceUserId, destinationType: 'store', destinationId: null, referenceType: 'return', referenceId: row.id, performedBy: req.user.id, notes: String(req.body.notes || '').trim() }, { transaction });
    }
    await AuditLog.create({ userId: req.user.id, action: `RETURN_${target.replace(/ /g, '_').toUpperCase()}`, entity: `return:${row.id}`, details: JSON.stringify({ beforeStatus: row._previousDataValues.status, afterStatus: target, reason: req.body.reason || '' }) }, { transaction });
    await transaction.commit(); res.json({ success: true, message: 'Return status updated', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listReturns, getReturn, createReturn, processStoreReturn, approveReturn: changeReturn('Approved', ['college', 'admin']), rejectReturn: changeReturn('Rejected', ['college', 'admin']), cancelReturn: changeReturn('Cancelled', ['department_head', 'college', 'admin']), receiveReturn: changeReturn('Received', ['store_manager']), inspectReturn: changeReturn('Inspected', ['store_manager', 'maintenance']) };
