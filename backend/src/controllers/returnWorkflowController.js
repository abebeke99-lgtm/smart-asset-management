const crypto = require('crypto');
const { sequelize, AssetReturn, Asset, Assignment, AssetMovement, AuditLog, Inventory, InventoryTransaction } = require('../models');
const { Op } = require('sequelize');

const transitions = { Requested: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Ready for Return', 'Cancelled'], 'Ready for Return': ['Received'], Received: ['Inspected'], Inspected: [] };
const number = () => `RET-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const scopeWhere = (req) => {
  if (req.organizationScope) return req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
  const collegeId = req.user?.collegeId ?? req.user?.college_id;
  return collegeId ? { collegeId: Number(collegeId) } : {};
};
const normalize = (item) => ({ ...item.toJSON(), return_number: item.returnNumber, asset_id: item.assetId });

const listReturns = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.pageSize || req.query.limit, 10) || 25));
    const where = scopeWhere(req);
    if (req.query.status) where.status = String(req.query.status);
    const search = String(req.query.search || '').trim();
    const include = [{ model: Asset, attributes: ['id', 'assetCode', 'name', 'serialNumber'], required: Boolean(search), ...(search ? { where: { [Op.or]: [{ assetCode: { [Op.like]: `%${search}%` } }, { name: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }] } } : {}) }];
    const result = await AssetReturn.findAndCountAll({ where, include, order: [['createdAt', 'DESC']], limit: pageSize, offset: (page - 1) * pageSize, distinct: true });
    const rows = result.rows.map(normalize);
    res.json({ success: true, data: rows, returns: rows, pagination: { page, pageSize, total: result.count, totalPages: Math.ceil(result.count / pageSize) } });
  } catch (error) { next(error); }
};
const getReturn = async (req, res, next) => { try { const row = await AssetReturn.findOne({ where: { id: req.params.id, ...scopeWhere(req) } }); if (!row) return res.status(404).json({ success: false, message: 'Return not found in your scope' }); res.json({ success: true, data: normalize(row) }); } catch (error) { next(error); } };

const createReturn = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { asset_id: assetId, reason, condition = 'Good', notes = '' } = req.body;
    const validReasons = ['End of Assignment', 'Replacement', 'Damage', 'Maintenance', 'Employee Transfer', 'Employee Separation', 'Department Transfer', 'Temporary Return', 'Inventory Verification', 'Other'];
    if (!assetId || !validReasons.includes(reason)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset and valid return reason are required' }); }
    if (['Damage', 'Other'].includes(reason) && String(notes).trim().length < 5) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Additional explanation is required for this return reason' }); }
    const asset = await Asset.findOne({ where: { id: assetId, ...(req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId }) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' }); }
    if (['disposed', 'missing'].includes(String(asset.status).toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot be returned in its current state' }); }
    const assignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset has no active assignment to return' }); }
    const row = await AssetReturn.create({ returnNumber: number(), assetId, collegeId: asset.collegeId, departmentId: asset.departmentId, sourceUserId: assignment.assignedTo, requestedBy: req.user.id, reason, condition, notes: String(notes).trim(), status: 'Requested' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'RETURN_CREATED', entity: `return:${row.id}`, details: JSON.stringify({ assetId, beforeStatus: asset.status, afterStatus: asset.status }) }, { transaction });
    await transaction.commit(); res.status(201).json({ success: true, message: 'Return request created', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const processStoreReturn = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const assetId = Number(req.body.asset_id);
    const condition = String(req.body.condition || 'Good').trim();
    const reason = String(req.body.reason || 'End of Assignment').trim();
    const location = String(req.body.location || '').trim();
    const notes = String(req.body.notes || '').trim();
    if (!Number.isInteger(assetId) || assetId <= 0 || !location) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid assigned asset and return location are required' }); }
    const collegeId = req.user?.collegeId ?? req.user?.college_id;
    const asset = await Asset.findOne({ where: { id: assetId, ...(collegeId ? { collegeId: Number(collegeId) } : {}) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found in your store scope' }); }
    const assignment = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
    if (!assignment) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This asset is not currently assigned or has already been returned' }); }
    const inventory = await Inventory.findOne({ where: { assetId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!inventory) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Inventory record not found' }); }
    const damaged = ['damaged', 'heavily damaged', 'missing parts', 'non-functional'].includes(condition.toLowerCase());
    const row = await AssetReturn.create({ returnNumber: number(), assetId, collegeId: asset.collegeId, departmentId: asset.departmentId, sourceUserId: assignment.assignedTo, requestedBy: req.user.id, receivedBy: req.user.id, receivedAt: new Date(), reason, condition, notes, status: 'Received', outcome: damaged ? 'Maintenance Required' : 'Accepted' }, { transaction });
    await assignment.update({ status: 'returned' }, { transaction });
    await inventory.update({ availableQuantity: damaged ? inventory.availableQuantity : inventory.availableQuantity + 1, damagedQuantity: damaged ? inventory.damagedQuantity + 1 : inventory.damagedQuantity, location }, { transaction });
    await asset.update({ status: damaged ? 'damaged' : 'available', condition, location }, { transaction });
    await InventoryTransaction.create({ inventoryId: inventory.id, assetId, userId: req.user.id, type: 'return', quantity: 1, toLocation: location, reason, notes }, { transaction });
    await AssetMovement.create({ assetId, movementType: 'return', sourceType: 'user', sourceId: assignment.assignedTo, destinationType: 'store', destinationId: null, referenceType: 'return', referenceId: row.id, performedBy: req.user.id, notes }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'STORE_ASSET_RETURNED', entity: `return:${row.id}`, details: JSON.stringify({ assetId, assignmentId: assignment.id, returnNumber: row.returnNumber, previousStatus: asset._previousDataValues.status || asset.status, newStatus: damaged ? 'damaged' : 'available', condition, location, reason }) }, { transaction });
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
    if (target === 'Received') { const asset = await Asset.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE }); await Assignment.update({ status: 'returned' }, { where: { assetId: asset.id, status: 'active' }, transaction }); await asset.update({ status: 'available', location: asset.location }, { transaction }); await AssetMovement.create({ assetId: asset.id, movementType: 'return', sourceType: 'user', sourceId: row.sourceUserId, destinationType: 'store', destinationId: null, referenceType: 'return', referenceId: row.id, performedBy: req.user.id, notes: String(req.body.notes || '').trim() }, { transaction }); }
    await AuditLog.create({ userId: req.user.id, action: `RETURN_${target.replace(/ /g, '_').toUpperCase()}`, entity: `return:${row.id}`, details: JSON.stringify({ beforeStatus: row._previousDataValues.status, afterStatus: target, reason: req.body.reason || '' }) }, { transaction });
    await transaction.commit(); res.json({ success: true, message: 'Return status updated', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listReturns, getReturn, createReturn, processStoreReturn, approveReturn: changeReturn('Approved', ['college', 'admin']), rejectReturn: changeReturn('Rejected', ['college', 'admin']), cancelReturn: changeReturn('Cancelled', ['department_head', 'college', 'admin']), receiveReturn: changeReturn('Received', ['store_manager']), inspectReturn: changeReturn('Inspected', ['store_manager', 'maintenance']) };
