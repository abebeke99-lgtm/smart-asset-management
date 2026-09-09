const crypto = require('crypto');
const { sequelize, AssetReturn, Asset, Assignment, AssetMovement, AuditLog } = require('../models');
const { Op } = require('sequelize');

const transitions = { Requested: ['Approved', 'Rejected', 'Cancelled'], Approved: ['Ready for Return', 'Cancelled'], 'Ready for Return': ['Received'], Received: ['Inspected'], Inspected: [] };
const number = () => `RET-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const scopeWhere = (req) => !req.organizationScope ? {} : req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
const normalize = (item) => ({ ...item.toJSON(), return_number: item.returnNumber, asset_id: item.assetId });

const listReturns = async (req, res, next) => { try { const rows = await AssetReturn.findAll({ where: scopeWhere(req), order: [['createdAt', 'DESC']] }); res.json({ success: true, data: rows.map(normalize), returns: rows.map(normalize) }); } catch (error) { next(error); } };
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

module.exports = { listReturns, getReturn, createReturn, approveReturn: changeReturn('Approved', ['college', 'admin']), rejectReturn: changeReturn('Rejected', ['college', 'admin']), cancelReturn: changeReturn('Cancelled', ['department_head', 'college', 'admin']), receiveReturn: changeReturn('Received', ['store_manager']), inspectReturn: changeReturn('Inspected', ['store_manager', 'maintenance']) };
