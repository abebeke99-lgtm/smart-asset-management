const { Op } = require('sequelize');
const { sequelize, Approval, Asset, Department, User, AuditLog } = require('../models');

const REQUEST_TYPES = ['new_asset', 'asset_issue', 'replacement', 'transfer', 'return', 'maintenance', 'other'];
const STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const include = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'departmentId', 'collegeId'], required: false },
  { model: Department, attributes: ['id', 'name', 'code', 'collegeId'], required: false },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'role', 'departmentId'], required: false },
  { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName', 'role'], required: false },
];

const normalize = (record) => {
  const data = record.toJSON();
  return {
    ...data,
    requestNumber: `REQ-${String(record.id).padStart(6, '0')}`,
    requester: record.Requester ? { id: record.Requester.id, name: record.Requester.fullName || record.Requester.username, username: record.Requester.username } : null,
    reviewer: record.Reviewer ? { id: record.Reviewer.id, name: record.Reviewer.fullName || record.Reviewer.username, username: record.Reviewer.username } : null,
    department: record.Department ? { id: record.Department.id, name: record.Department.name, code: record.Department.code } : null,
    asset: record.Asset ? { id: record.Asset.id, name: record.Asset.name, assetCode: record.Asset.assetCode, category: record.Asset.category } : null,
  };
};

const listInfrastructureRequests = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim();
    const where = {};

    if (req.query.status) where.status = String(req.query.status).toLowerCase();
    if (req.query.type) where.type = String(req.query.type).toLowerCase();
    if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
    if (search) {
      const pattern = `%${search}%`;
      where[Op.or] = [
        { item: { [Op.like]: pattern } },
        { reason: { [Op.like]: pattern } },
        { '$Requester.fullName$': { [Op.like]: pattern } },
        { '$Requester.username$': { [Op.like]: pattern } },
        { '$Department.name$': { [Op.like]: pattern } },
        { '$Asset.name$': { [Op.like]: pattern } },
        { '$Asset.assetCode$': { [Op.like]: pattern } },
      ];
    }

    const [result, statusCounts, total] = await Promise.all([
      Approval.findAndCountAll({ where, include, distinct: true, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit }),
      Promise.all(STATUSES.map(async (status) => [status, await Approval.count({ where: { ...where, status } })])),
      Approval.count(),
    ]);

    const counts = Object.fromEntries(statusCounts);
    res.json({
      success: true,
      data: result.rows.map(normalize),
      pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) || 1 },
      summary: { total, ...counts },
      filters: {
        types: REQUEST_TYPES,
        priorities: PRIORITIES,
        statuses: STATUSES,
      },
    });
  } catch (error) {
    next(error);
  }
};

const createInfrastructureRequest = async (req, res, next) => {
  try {
    const type = String(req.body.type || '').toLowerCase();
    const priority = String(req.body.priority || 'medium').toLowerCase();
    const quantity = Number(req.body.quantity || 1);
    const reason = String(req.body.reason || '').trim();
    const item = String(req.body.item || '').trim();
    if (!REQUEST_TYPES.includes(type) || !PRIORITIES.includes(priority) || !item || !reason || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Type, item, reason, priority, and a positive quantity are required' });
    }

    const asset = req.body.asset_id ? await Asset.findByPk(req.body.asset_id) : null;
    if (req.body.asset_id && !asset) return res.status(404).json({ success: false, message: 'Asset not found' });

    const record = await Approval.create({
      type,
      assetId: asset?.id || null,
      requestedBy: req.user.id,
      departmentId: asset?.departmentId || req.user.departmentId || req.user.department_id || null,
      item,
      quantity,
      priority,
      reason,
      status: 'pending',
    });
    await AuditLog.create({ userId: req.user.id, action: 'REQUEST_SUBMITTED', entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, type }) });
    const populated = await Approval.findByPk(record.id, { include });
    res.status(201).json({ success: true, data: normalize(populated) });
  } catch (error) {
    next(error);
  }
};

const decideInfrastructureRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const decision = String(req.body.decision || '').toLowerCase();
    const comment = String(req.body.comment || req.body.reason || '').trim();
    if (!['approved', 'rejected'].includes(decision)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid approval decision' }); }
    if (decision === 'rejected' && !comment) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A reason is required when rejecting a request' }); }

    const record = await Approval.findOne({ where: { id: req.params.id, status: 'pending' }, include, transaction, lock: transaction.LOCK.UPDATE });
    if (!record) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Pending request not found' }); }
    if (record.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own request' }); }

    await record.update({ status: decision, reviewedBy: req.user.id, comment }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: decision === 'approved' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED', entity: `approval:${record.id}`, details: JSON.stringify({ requestId: record.id, comment }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, data: normalize(record) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

module.exports = { listInfrastructureRequests, createInfrastructureRequest, decideInfrastructureRequest };