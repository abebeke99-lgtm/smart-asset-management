const { sequelize, Approval, Asset, Department, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const include = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'departmentId', 'collegeId'] },
  { model: Department, attributes: ['id', 'name', 'code', 'collegeId'] },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'role', 'departmentId'] },
];
const normalize = (record) => ({ ...record.toJSON(), requestNumber: `REQ-${String(record.id).padStart(6, '0')}`, requester: record.Requester?.fullName || record.Requester?.username || null });
const scopedWhere = (req) => req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { '$Department.college_id$': req.organizationScope.collegeId };
const isCollegeScope = (req) => Boolean(req.organizationScope.collegeId && !req.organizationScope.departmentId);

const listRequests = async (req, res, next) => {
  try {
    const where = { ...scopedWhere(req) };
    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.search) where[Op.or] = [{ item: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { reason: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const rows = await Approval.findAll({ where, include, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rows.map(normalize), pagination: { page: 1, limit: rows.length, total: rows.length, pages: rows.length ? 1 : 0 } });
  } catch (error) { next(error); }
};

const getRequest = async (req, res, next) => {
  try {
    const record = await Approval.findOne({ where: { id: req.params.id, ...scopedWhere(req) }, include });
    if (!record) return res.status(404).json({ success: false, message: 'Request not found in your scope' });
    res.json({ success: true, data: normalize(record) });
  } catch (error) { next(error); }
};

const createRequest = async (req, res, next) => {
  try {
    const { type, asset_id: assetId, item, quantity = 1, priority = 'medium', reason, estimated_value: estimatedValue = 0 } = req.body;
    if (!['new_asset', 'asset_issue', 'replacement', 'transfer', 'return', 'maintenance', 'other'].includes(String(type || '').toLowerCase())) return res.status(400).json({ success: false, message: 'Invalid request type' });
    if (!String(reason || '').trim() || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) return res.status(400).json({ success: false, message: 'Reason and positive quantity are required' });
    const asset = assetId ? await Asset.findByPk(assetId) : null;
    if (assetId && (!asset || asset.departmentId !== req.organizationScope.departmentId)) return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
    const record = await Approval.create({ type: String(type).toLowerCase(), assetId: asset?.id || null, requestedBy: req.user.id, departmentId: req.organizationScope.departmentId, item: String(item || '').trim(), quantity: Number(quantity), priority: String(priority || 'medium').toLowerCase(), reason: String(reason).trim(), comment: JSON.stringify({ estimatedValue: Number(estimatedValue) || 0 }), status: 'pending' });
    await AuditLog.create({ userId: req.user.id, action: 'REQUEST_SUBMITTED', entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, departmentId: record.departmentId, type: record.type }) });
    const populated = await Approval.findByPk(record.id, { include });
    res.status(201).json({ success: true, message: 'Request submitted successfully', data: normalize(populated) });
  } catch (error) { next(error); }
};

const decideRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const decision = String(req.body.decision || '').toLowerCase();
    const comment = String(req.body.reason || req.body.comment || '').trim();
    if (!['approved', 'rejected', 'changes_requested'].includes(decision)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid approval decision' }); }
    if (['rejected', 'changes_requested'].includes(decision) && !comment) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A reason is required for this decision' }); }
    const record = await Approval.findOne({ where: { id: req.params.id, status: 'pending', ...scopedWhere(req) }, include, transaction, lock: transaction.LOCK.UPDATE });
    if (!record) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Pending request not found in your scope' }); }
    if (record.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own request' }); }
    const beforeStatus = record.status;
    const nextStatus = decision === 'changes_requested' ? 'cancelled' : decision;
    await record.update({ status: nextStatus, reviewedBy: req.user.id, comment }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: decision === 'approved' ? 'REQUEST_APPROVED' : decision === 'rejected' ? 'REQUEST_REJECTED' : 'REQUEST_CHANGES_REQUESTED', entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, reason: comment, beforeStatus, afterStatus: nextStatus }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Request decision recorded', data: normalize(record) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listRequests, getRequest, createRequest, decideRequest, isCollegeScope };
