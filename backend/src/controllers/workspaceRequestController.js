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

const collegeApprovalScope = async (req) => {
  const collegeId = Number(req.organizationScope?.collegeId);
  const [departments, assets] = await Promise.all([
    Department.findAll({ where: { collegeId }, attributes: ['id'], raw: true }),
    Asset.findAll({ where: { collegeId }, attributes: ['id'], raw: true }),
  ]);
  return { [Op.or]: [
    { departmentId: { [Op.in]: departments.length ? departments.map((department) => department.id) : [-1] } },
    { assetId: { [Op.in]: assets.length ? assets.map((asset) => asset.id) : [-1] } },
  ] };
};

const collegeRequestInclude = [
  { model: Asset, attributes: ['id', 'assetCode', 'name', 'category', 'collegeId'] },
  { model: Department, attributes: ['id', 'name', 'code', 'collegeId'], required: false },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'role', 'departmentId'], required: false },
  { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName', 'role'], required: false },
];

const normalizeCollegeRequest = (record) => {
  const data = record.toJSON();
  return {
    ...data,
    requestNumber: `REQ-${String(record.id).padStart(6, '0')}`,
    requester: record.Requester ? { id: record.Requester.id, name: record.Requester.fullName || record.Requester.username, username: record.Requester.username } : null,
    department: record.Department ? { id: record.Department.id, name: record.Department.name, code: record.Department.code } : null,
    asset: record.Asset ? { id: record.Asset.id, name: record.Asset.name, assetCode: record.Asset.assetCode, category: record.Asset.category } : null,
    reviewer: record.Reviewer ? { id: record.Reviewer.id, name: record.Reviewer.fullName || record.Reviewer.username, username: record.Reviewer.username } : null,
  };
};

const listCollegeDepartmentRequests = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
    const status = String(req.query.status || '').trim().toLowerCase();
    const priority = String(req.query.priority || '').trim().toLowerCase();

    const departments = await Department.findAll({
      where: { collegeId },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
    });
    const departmentIds = departments.map((department) => department.id);
    const assetIds = await Asset.findAll({ where: { collegeId }, attributes: ['id'], raw: true });
    const validDepartmentIds = departmentIds.length ? departmentIds : [-1];
    const validAssetIds = assetIds.length ? assetIds.map((asset) => asset.id) : [-1];

    if (departmentId && !departmentIds.includes(departmentId)) {
      return res.status(400).json({ success: false, message: 'Department is not part of your college' });
    }

    const scopeWhere = {
      [Op.or]: [
        { departmentId: { [Op.in]: validDepartmentIds } },
        { assetId: { [Op.in]: validAssetIds } },
      ],
    };

    const where = { [Op.and]: [scopeWhere] };

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (departmentId) where[Op.and].push({ departmentId });

    if (search) {
      const normalizedSearch = `%${search}%`;
      const idValue = Number(search);
      where[Op.and].push({
        [Op.or]: [
          ...(Number.isInteger(idValue) ? [{ id: idValue }] : []),
          { item: { [Op.like]: normalizedSearch } },
          { reason: { [Op.like]: normalizedSearch } },
          { '$Requester.fullName$': { [Op.like]: normalizedSearch } },
          { '$Requester.username$': { [Op.like]: normalizedSearch } },
          { '$Department.name$': { [Op.like]: normalizedSearch } },
          { '$Asset.name$': { [Op.like]: normalizedSearch } },
          { '$Asset.assetCode$': { [Op.like]: normalizedSearch } },
        ],
      });
    }

    const allowedSortBy = ['id', 'createdAt', 'updatedAt', 'status', 'priority'];
    const sortBy = allowedSortBy.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [result, counts] = await Promise.all([
      Approval.findAndCountAll({
        where,
        include: collegeRequestInclude,
        distinct: true,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
      }),
      Promise.all([
        ['pending', Approval.count({ where: { [Op.and]: [scopeWhere, { status: 'pending' }] } })],
        ['approved', Approval.count({ where: { [Op.and]: [scopeWhere, { status: 'approved' }] } })],
        ['rejected', Approval.count({ where: { [Op.and]: [scopeWhere, { status: 'rejected' }] } })],
        ['cancelled', Approval.count({ where: { [Op.and]: [scopeWhere, { status: 'cancelled' }] } })],
      ]),
    ]);

    const summary = {
      total: await Approval.count({ where: scopeWhere }),
      pending: counts[0][1],
      approved: counts[1][1],
      rejected: counts[2][1],
      cancelled: counts[3][1],
    };

    const payload = result.rows.map(normalizeCollegeRequest);
    res.json({
      success: true,
      data: payload,
      pagination: {
        page,
        limit,
        total: result.count,
        totalPages: Math.ceil(result.count / limit),
        pages: Math.ceil(result.count / limit) || 1,
      },
      summary,
      filters: {
        departments,
        statuses: ['pending', 'approved', 'rejected', 'cancelled'],
        priorities: ['low', 'medium', 'high', 'critical'],
      },
    });
  } catch (error) {
    next(error);
  }
};

const listCollegeRequests = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const [departments, collegeAssets] = await Promise.all([
      Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
      Asset.findAll({ where: { collegeId }, attributes: ['id'], raw: true }),
    ]);
    const departmentIds = departments.map((department) => department.id);
    const scopeWhere = { [Op.or]: [{ departmentId: { [Op.in]: departmentIds.length ? departmentIds : [-1] } }, { assetId: { [Op.in]: collegeAssets.length ? collegeAssets.map((asset) => asset.id) : [-1] } }] };
    const where = { [Op.and]: [scopeWhere] };
    const status = String(req.query.status || '').trim().toLowerCase();
    const type = String(req.query.requestType || req.query.type || '').trim();
    const priority = String(req.query.priority || '').trim().toLowerCase();
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (req.query.departmentId) {
      const departmentId = Number(req.query.departmentId);
      if (!departmentIds.includes(departmentId)) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      where[Op.and].push({ departmentId });
    }
    const search = String(req.query.search || '').trim();
    if (search) where[Op.and].push({ [Op.or]: [
      { item: { [Op.like]: `%${search}%` } },
      { reason: { [Op.like]: `%${search}%` } },
      { '$Requester.fullName$': { [Op.like]: `%${search}%` } },
      { '$Requester.username$': { [Op.like]: `%${search}%` } },
      { '$Department.name$': { [Op.like]: `%${search}%` } },
      { '$Asset.name$': { [Op.like]: `%${search}%` } },
      { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
      ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
    ] });
    const allowedSorts = { requestId: 'id', createdAt: 'createdAt', updatedAt: 'updatedAt', status: 'status', priority: 'priority' };
    const sortBy = allowedSorts[String(req.query.sortBy || '')] || 'createdAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const [result, total, statusCounts, filterValues] = await Promise.all([
      Approval.findAndCountAll({ where, include: collegeRequestInclude, distinct: true, order: [[sortBy, sortOrder]], limit, offset }),
      Approval.count({ where: scopeWhere }),
      Promise.all(['pending', 'approved', 'rejected', 'cancelled'].map(async (value) => [value, await Approval.count({ where: { ...scopeWhere, status: value } })])),
      Approval.findAll({ where: scopeWhere, attributes: ['type', 'priority'], raw: true }),
    ]);
    const counts = Object.fromEntries(statusCounts);
    res.json({ success: true, data: { summary: { total, ...counts }, requests: result.rows.map(normalizeCollegeRequest), pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit), pages: Math.ceil(result.count / limit) }, filters: { departments, statuses: ['pending', 'approved', 'rejected', 'cancelled'], types: [...new Set(filterValues.map((value) => value.type).filter(Boolean))].sort(), priorities: [...new Set(filterValues.map((value) => value.priority).filter(Boolean))].sort() } } });
  } catch (error) { next(error); }
};

const getCollegeRequest = async (req, res, next) => {
  try {
    const collegeId = Number(req.organizationScope?.collegeId);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const scopeWhere = await collegeApprovalScope(req);
    const record = await Approval.findOne({ where: { [Op.and]: [{ id: req.params.id }, scopeWhere] }, include: collegeRequestInclude });
    if (!record) return res.status(404).json({ success: false, message: 'Request not found in your college' });
    res.json({ success: true, data: normalizeCollegeRequest(record) });
  } catch (error) { next(error); }
};

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
    const scopeWhere = req.organizationScope?.departmentId ? scopedWhere(req) : await collegeApprovalScope(req);
    const record = await Approval.findOne({ where: { [Op.and]: [{ id: req.params.id, status: 'pending' }, scopeWhere] }, include: collegeRequestInclude, transaction, lock: transaction.LOCK.UPDATE });
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

module.exports = {
  listRequests,
  getRequest,
  createRequest,
  decideRequest,
  isCollegeScope,
  listCollegeRequests,
  getCollegeRequest,
  listCollegeDepartmentRequests,
};
