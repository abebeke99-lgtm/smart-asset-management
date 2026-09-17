const { Op } = require('sequelize');
const { Approval, Department, Asset, User } = require('../models');

const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];
const REQUEST_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const include = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'category'], required: false },
  { model: Department, attributes: ['id', 'name', 'code'], required: false },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'], required: false },
  { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName'], required: false },
];

const normalize = (record) => {
  const value = record.toJSON();
  return {
    id: value.id,
    requestNumber: `REQ-${String(value.id).padStart(6, '0')}`,
    requestedBy: value.requestedBy,
    requester: value.Requester ? {
      id: value.Requester.id,
      name: value.Requester.fullName || value.Requester.username,
      username: value.Requester.username,
    } : null,
    department: value.Department ? {
      id: value.Department.id,
      name: value.Department.name,
      code: value.Department.code,
    } : null,
    departmentId: value.departmentId,
    type: value.type,
    item: value.item,
    quantity: value.quantity,
    priority: value.priority,
    status: value.status,
    reason: value.reason,
    comment: value.comment,
    reviewedBy: value.reviewedBy,
    reviewer: value.Reviewer ? {
      id: value.Reviewer.id,
      name: value.Reviewer.fullName || value.Reviewer.username,
      username: value.Reviewer.username,
    } : null,
    asset: value.Asset || null,
    requestedDate: value.createdAt,
    updatedDate: value.updatedAt,
  };
};

const buildWhere = (query) => {
  const filters = [];
  const search = String(query.search || '').trim();
  const status = String(query.status || '').trim().toLowerCase();
  const priority = String(query.priority || '').trim().toLowerCase();
  const departmentId = query.departmentId ? Number(query.departmentId) : null;

  if (REQUEST_STATUSES.includes(status)) filters.push({ status });
  if (REQUEST_PRIORITIES.includes(priority)) filters.push({ priority });
  if (Number.isInteger(departmentId) && departmentId > 0) filters.push({ departmentId });
  if (query.dateFrom) filters.push({ createdAt: { [Op.gte]: new Date(query.dateFrom) } });
  if (query.dateTo) {
    const dateTo = new Date(query.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    filters.push({ createdAt: { [Op.lte]: dateTo } });
  }

  if (search) {
    const searchLike = `%${search}%`;
    const numericId = Number(search);
    filters.push({
      [Op.or]: [
        ...(Number.isInteger(numericId) ? [{ id: numericId }] : []),
        { item: { [Op.like]: searchLike } },
        { reason: { [Op.like]: searchLike } },
        { type: { [Op.like]: searchLike } },
        { '$Requester.fullName$': { [Op.like]: searchLike } },
        { '$Requester.username$': { [Op.like]: searchLike } },
        { '$Department.name$': { [Op.like]: searchLike } },
      ],
    });
  }

  return filters.length ? { [Op.and]: filters } : {};
};

const listFinancePurchaseRequests = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = buildWhere(req.query);
    const offset = (page - 1) * limit;
    const [result, total, statusCounts, departments] = await Promise.all([
      Approval.findAndCountAll({ where, include, distinct: true, limit, offset, order: [['createdAt', 'DESC']] }),
      Approval.count({ where }),
      Promise.all(REQUEST_STATUSES.map(async (status) => [status, await Approval.count({ where: { ...where, status } })])),
      Department.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
    ]);

    res.json({
      success: true,
      data: {
        requests: result.rows.map(normalize),
        summary: { total, ...Object.fromEntries(statusCounts) },
        filters: { departments, statuses: REQUEST_STATUSES, priorities: REQUEST_PRIORITIES },
      },
      pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit), pages: Math.ceil(result.count / limit) || 1 },
    });
  } catch (error) {
    next(error);
  }
};

const getFinancePurchaseRequest = async (req, res, next) => {
  try {
    const record = await Approval.findByPk(req.params.id, { include });
    if (!record) return res.status(404).json({ success: false, message: 'Purchase request not found' });
    return res.json({ success: true, data: normalize(record) });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listFinancePurchaseRequests, getFinancePurchaseRequest };
