const { Op } = require('sequelize');
const {
  sequelize,
  Category,
  College,
  Department,
  DepartmentAssetRequest,
  DepartmentAssetRequestHistory,
  AuditLog,
  User,
} = require('../models');
const { createBulkNotification } = require('../services/notificationService');

const statuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Changes Requested', 'Escalated', 'Completed', 'Cancelled'];
const activeReviewStatuses = ['Submitted', 'Under Review', 'Escalated'];
const validPriorities = ['low', 'medium', 'high', 'urgent', 'critical'];
const includes = [
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName', 'role'], required: false },
  {
    model: DepartmentAssetRequestHistory,
    as: 'History',
    separate: true,
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'ChangedBy', attributes: ['id', 'username', 'fullName', 'role'], required: false }],
  },
];

const parseDate = (value) => {
  if (!value) return null;
  const text = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? undefined : date;
};

const getCollegeId = (req) => {
  const id = Number(req.organizationScope?.collegeId);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const encodeCollegeDetails = ({ title, preferredLocation, description }) => JSON.stringify({
  collegeRequest: true,
  title: String(title || '').trim(),
  preferredLocation: String(preferredLocation || '').trim(),
  description: String(description || '').trim(),
});

const decodeCollegeDetails = (value) => {
  try {
    const details = JSON.parse(String(value || ''));
    if (details?.collegeRequest === true) return details;
  } catch {}
  return null;
};

const serialize = (record) => {
  const value = record.toJSON();
  const details = decodeCollegeDetails(value.description);
  return {
    ...value,
    requestNumber: value.requestCode,
    requestTitle: details?.title || value.requestedItem,
    preferredLocation: details?.preferredLocation || '',
    description: details?.description || value.description || '',
    requester: value.Requester ? {
      id: value.Requester.id,
      name: value.Requester.fullName || value.Requester.username,
      username: value.Requester.username,
      role: value.Requester.role,
    } : null,
    department: value.DepartmentRecord ? {
      id: value.DepartmentRecord.id,
      name: value.DepartmentRecord.name,
      code: value.DepartmentRecord.code,
    } : null,
    history: (value.History || []).map((entry) => ({
      ...entry,
      changedByName: entry.ChangedBy?.fullName || entry.ChangedBy?.username || null,
      changedByRole: entry.ChangedBy?.role || null,
    })),
  };
};

const requestCode = () => `CM-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const validateRequest = async (req, transaction, existing = null) => {
  const body = req.body || {};
  const departmentId = Number(body.departmentId ?? existing?.departmentId);
  const department = Number.isSafeInteger(departmentId)
    ? await Department.findOne({ where: { id: departmentId, collegeId: getCollegeId(req), status: 'active' }, attributes: ['id', 'name'], transaction })
    : null;
  if (!department) return { error: 'Select a department in your college', status: 422 };

  const requestedItem = String(body.requestedItem ?? body.item ?? existing?.requestedItem ?? '').trim();
  const requestTitle = String(body.requestTitle ?? existing?.requestTitle ?? requestedItem).trim();
  const justification = String(body.justification ?? existing?.justification ?? '').trim();
  const category = String(body.category ?? existing?.category ?? '').trim();
  const quantity = Number(body.quantity ?? existing?.quantity ?? 1);
  const unit = String(body.unit ?? existing?.unit ?? 'unit').trim();
  const priority = String(body.priority ?? existing?.priority ?? 'medium').trim().toLowerCase();
  const estimatedValueInput = Object.prototype.hasOwnProperty.call(body, 'estimatedValue')
    ? body.estimatedValue
    : existing?.estimatedValue;
  const estimatedValue = estimatedValueInput === '' || estimatedValueInput == null ? null : Number(estimatedValueInput);
  const preferredLocation = String(body.preferredLocation ?? existing?.preferredLocation ?? '').trim();
  const description = String(body.description ?? existing?.description ?? '').trim();
  const neededByValue = body.neededBy ?? existing?.neededBy ?? null;
  const neededBy = parseDate(neededByValue);

  if (!requestTitle || requestTitle.length > 255) return { error: 'A request title of 1 to 255 characters is required', status: 422 };
  if (!requestedItem || requestedItem.length > 255) return { error: 'An item name of 1 to 255 characters is required', status: 422 };
  if (preferredLocation.length > 255) return { error: 'Preferred location cannot exceed 255 characters', status: 422 };
  if (description.length > 5000) return { error: 'Description cannot exceed 5000 characters', status: 422 };
  if (!category || category.length > 120) return { error: 'An asset category is required', status: 422 };
  const activeCategory = await Category.findOne({ where: { name: category, status: 'active' }, attributes: ['id'], transaction });
  if (!activeCategory) return { error: 'Select an active asset category', status: 422 };
  if (!justification) return { error: 'Business justification is required', status: 422 };
  if (justification.length > 5000) return { error: 'Business justification cannot exceed 5000 characters', status: 422 };
  if (!Number.isSafeInteger(quantity) || quantity < 1) return { error: 'Quantity must be a positive whole number', status: 422 };
  if (!unit || unit.length > 50) return { error: 'Unit of measurement is required', status: 422 };
  if (!validPriorities.includes(priority)) return { error: 'Select a valid priority', status: 422 };
  if (estimatedValue !== null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) return { error: 'Estimated cost must be zero or greater', status: 422 };
  if (neededBy === undefined) return { error: 'Requested delivery date must be a valid YYYY-MM-DD date', status: 422 };
  if (neededBy && neededBy < new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)) return { error: 'Requested delivery date cannot be in the past', status: 422 };

  return {
    value: {
      departmentId: department.id,
      requestedItem,
      category,
      quantity,
      unit,
      priority,
      justification,
      description: encodeCollegeDetails({
        title: requestTitle,
        preferredLocation,
        description,
      }),
      estimatedValue,
      neededBy: neededBy ? neededBy.toISOString().slice(0, 10) : null,
    },
  };
};

const notifyUsers = async (req, userIds, title, message, eventKey, entityId) => {
  const recipients = [...new Set((userIds || []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!recipients.length) return;
  try {
    await createBulkNotification({
      recipientType: 'users',
      userIds: recipients,
      title,
      message,
      type: 'approval',
      priority: 'medium',
      channel: 'in_app',
      eventKey,
      entityType: 'department_asset_request',
      entityId,
      actionUrl: '/college/requests',
    }, req.user.id, req.user.role);
  } catch (error) {
    console.error('College asset request notification failed:', error.message);
  }
};

const notifyCollegeReviewers = async (req, collegeId, requestId, requestCodeValue, resubmitted = false) => {
  try {
    const reviewers = await User.findAll({
      where: { collegeId, active: true, role: { [Op.in]: ['college_manager', 'college manager', 'College Manager'] }, id: { [Op.ne]: req.user.id } },
      attributes: ['id'],
      raw: true,
    });
    const action = resubmitted ? 'resubmitted' : 'submitted';
    await notifyUsers(
      req,
      reviewers.map(({ id }) => id),
      resubmitted ? 'College asset request updated' : 'College asset request submitted',
      resubmitted
        ? `Request ${requestCodeValue} was updated and resubmitted for review.`
        : `Request ${requestCodeValue} is awaiting College Manager review.`,
      resubmitted
        ? `college-asset-request:${requestId}:${action}:${Date.now()}`
        : `college-asset-request:${requestId}:${action}`,
      requestId,
    );
  } catch (error) {
    console.error('College asset request reviewer notification lookup failed:', error.message);
  }
};

const list = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const departments = await Department.findAll({ where: { collegeId }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] });
    const departmentIds = departments.map((department) => Number(department.id));
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = { departmentId: { [Op.in]: departmentIds.length ? departmentIds : [-1] }, status: { [Op.ne]: 'Draft' } };

    if (req.query.status) {
      const status = statuses.find((value) => value.toLowerCase() === String(req.query.status).trim().toLowerCase());
      if (!status) return res.status(400).json({ success: false, message: 'Invalid request status filter' });
      where.status = status;
    }
    if (req.query.priority) {
      const priority = String(req.query.priority).trim().toLowerCase();
      if (!validPriorities.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid request priority filter' });
      where.priority = priority;
    }
    if (req.query.departmentId) {
      const departmentId = Number(req.query.departmentId);
      if (!departmentIds.includes(departmentId)) return res.status(400).json({ success: false, message: 'Department is not part of your college' });
      where.departmentId = departmentId;
    }
    if (req.query.requestType) where.category = String(req.query.requestType).trim();
    const createdAt = {};
    const from = parseDate(req.query.dateFrom);
    const to = parseDate(req.query.dateTo);
    if (from === undefined || to === undefined || (from && to && from > to)) return res.status(400).json({ success: false, message: 'Request date range is invalid' });
    if (from) createdAt[Op.gte] = from;
    if (to) createdAt[Op.lt] = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    if (Object.keys(createdAt).length) where.createdAt = createdAt;

    const search = String(req.query.search || '').trim();
    if (search) {
      const term = `%${search}%`;
      where[Op.or] = [
        { requestCode: { [Op.like]: term } },
        { requestedItem: { [Op.like]: term } },
        { category: { [Op.like]: term } },
        { justification: { [Op.like]: term } },
        { description: { [Op.like]: term } },
        { '$Requester.fullName$': { [Op.like]: term } },
        { '$Requester.username$': { [Op.like]: term } },
        { '$DepartmentRecord.name$': { [Op.like]: term } },
      ];
    }
    const sortFields = new Set(['requestCode', 'createdAt', 'updatedAt', 'status', 'priority']);
    const sortBy = sortFields.has(String(req.query.sortBy)) ? String(req.query.sortBy) : 'createdAt';
    const sortOrder = String(req.query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const order = sortBy === 'priority'
      ? [[sequelize.literal("CASE priority WHEN 'critical' THEN 5 WHEN 'urgent' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END"), sortOrder]]
      : [[sortBy, sortOrder]];

    const scope = { departmentId: { [Op.in]: departmentIds.length ? departmentIds : [-1] }, status: { [Op.ne]: 'Draft' } };
    const [result, statusRows, categories] = await Promise.all([
      DepartmentAssetRequest.findAndCountAll({
        where,
        include: includes,
        distinct: true,
        order,
        limit,
        offset: (page - 1) * limit,
      }),
      DepartmentAssetRequest.findAll({ where: scope, attributes: ['status'], raw: true }),
      DepartmentAssetRequest.findAll({ where: scope, attributes: ['category'], group: ['category'], raw: true }),
    ]);
    const summary = { total: statusRows.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    statusRows.forEach(({ status }) => {
      if (activeReviewStatuses.includes(status)) summary.pending += 1;
      if (status === 'Approved') summary.approved += 1;
      if (status === 'Rejected') summary.rejected += 1;
      if (status === 'Cancelled') summary.cancelled += 1;
    });
    const college = await College.findByPk(collegeId, { attributes: ['id', 'collegeName'] });
    return res.json({
      success: true,
      data: {
        requests: result.rows.map(serialize),
        summary,
        filters: {
          departments,
          statuses: statuses.filter((value) => value !== 'Draft'),
          priorities: validPriorities,
          types: categories.map((value) => value.category).filter(Boolean).sort(),
        },
        pagination: {
          page,
          limit,
          total: result.count,
          totalPages: Math.ceil(result.count / limit),
          pages: Math.ceil(result.count / limit) || 1,
        },
        college: college ? { id: college.id, name: college.collegeName } : null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const options = async (req, res, next) => {
  try {
    const collegeId = getCollegeId(req);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    const [college, categories, departments] = await Promise.all([
      College.findByPk(collegeId, { attributes: ['id', 'collegeName'] }),
      Category.findAll({ where: { status: 'active' }, attributes: ['id', 'name'], order: [['name', 'ASC']] }),
      Department.findAll({ where: { collegeId, status: 'active' }, attributes: ['id', 'name', 'code'], order: [['name', 'ASC']] }),
    ]);
    return res.json({
      success: true,
      data: {
        college: college ? { id: college.id, name: college.collegeName } : null,
        categories,
        departments,
        statuses: statuses.filter((value) => value !== 'Draft'),
        priorities: validPriorities,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  let transaction;
  try {
    const collegeId = getCollegeId(req);
    if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
    transaction = await sequelize.transaction();
    const validated = await validateRequest(req, transaction);
    if (validated.error) {
      await transaction.rollback();
      return res.status(validated.status).json({ success: false, message: validated.error });
    }
    const record = await DepartmentAssetRequest.create({
      ...validated.value,
      requestCode: requestCode(),
      requestedBy: req.user.id,
      status: 'Submitted',
    }, { transaction });
    await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus: null,
      newStatus: 'Submitted',
      changedBy: req.user.id,
      comment: 'Request submitted to the College Manager approval queue',
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'COLLEGE_ASSET_REQUEST_SUBMITTED',
      entity: `department_asset_request:${record.id}`,
      entityId: record.id,
      details: { requestCode: record.requestCode, collegeId, departmentId: record.departmentId },
    }, { transaction });
    await transaction.commit();
    transaction = null;

    await notifyCollegeReviewers(req, collegeId, record.id, record.requestCode);
    const saved = await DepartmentAssetRequest.findOne({ where: { id: record.id }, include: includes });
    return res.status(201).json({ success: true, message: 'Asset request submitted', data: serialize(saved) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const getRecord = async (req, transaction = null) => {
  const collegeId = getCollegeId(req);
  if (!collegeId) return null;
  const departments = await Department.findAll({ where: { collegeId }, attributes: ['id'], raw: true });
  const departmentIds = departments.map(({ id }) => id);
  if (!departmentIds.length) return null;
  return DepartmentAssetRequest.findOne({
    where: { id: req.params.id, departmentId: { [Op.in]: departmentIds } },
    include: includes,
    ...(transaction ? { transaction, lock: transaction.LOCK?.UPDATE || true } : {}),
  });
};

const detail = async (req, res, next) => {
  try {
    const record = await getRecord(req);
    if (!record) return res.status(404).json({ success: false, message: 'Asset request not found in your college' });
    return res.json({ success: true, data: serialize(record) });
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const record = await getRecord(req, transaction);
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset request not found in your college' });
    }
    if (Number(record.requestedBy) !== Number(req.user.id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only the request owner may edit this request' });
    }
    if (!['Draft', 'Changes Requested'].includes(record.status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only draft or returned requests can be edited' });
    }
    const previousStatus = record.status;
    const previousValue = record.toJSON();
    const validated = await validateRequest(req, transaction, serialize(record));
    if (validated.error) {
      await transaction.rollback();
      return res.status(validated.status).json({ success: false, message: validated.error });
    }
    const nextStatus = previousStatus === 'Changes Requested' ? 'Submitted' : previousStatus;
    await record.update({ ...validated.value, status: nextStatus }, { transaction });
    await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus,
      newStatus: nextStatus,
      changedBy: req.user.id,
      comment: nextStatus === 'Submitted' ? 'Updated request resubmitted to the College Manager approval queue' : 'Request details updated',
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'COLLEGE_ASSET_REQUEST_UPDATED',
      entity: `department_asset_request:${record.id}`,
      entityId: record.id,
      oldValue: previousValue,
      newValue: record.toJSON(),
    }, { transaction });
    await transaction.commit();
    transaction = null;
    if (nextStatus === 'Submitted') await notifyCollegeReviewers(req, getCollegeId(req), record.id, record.requestCode, true);
    const saved = await DepartmentAssetRequest.findOne({ where: { id: record.id }, include: includes });
    return res.json({ success: true, data: serialize(saved) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const cancel = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const record = await getRecord(req, transaction);
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset request not found in your college' });
    }
    if (Number(record.requestedBy) !== Number(req.user.id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Only the request owner may cancel this request' });
    }
    if (!['Draft', 'Submitted', 'Under Review', 'Changes Requested', 'Escalated'].includes(record.status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'This request can no longer be cancelled' });
    }
    const previousStatus = record.status;
    await record.update({ status: 'Cancelled' }, { transaction });
    await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus,
      newStatus: 'Cancelled',
      changedBy: req.user.id,
      comment: String(req.body?.reason || 'Cancelled by requester').trim().slice(0, 1000),
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'COLLEGE_ASSET_REQUEST_CANCELLED',
      entity: `department_asset_request:${record.id}`,
      entityId: record.id,
      details: { previousStatus },
    }, { transaction });
    await transaction.commit();
    transaction = null;
    const saved = await DepartmentAssetRequest.findOne({ where: { id: record.id }, include: includes });
    return res.json({ success: true, data: serialize(saved) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const decide = (decision) => async (req, res, next) => {
  let transaction;
  try {
    const transitions = {
      approve: { status: 'Approved', action: 'COLLEGE_ASSET_REQUEST_APPROVED' },
      reject: { status: 'Rejected', action: 'COLLEGE_ASSET_REQUEST_REJECTED' },
      requestChanges: { status: 'Changes Requested', action: 'COLLEGE_ASSET_REQUEST_CHANGES_REQUESTED' },
    };
    const transition = transitions[decision];
    if (!transition) return res.status(400).json({ success: false, message: 'Invalid request decision' });
    const comment = String(req.body?.reason || req.body?.comment || '').trim();
    if (['reject', 'requestChanges'].includes(decision) && !comment) return res.status(400).json({ success: false, message: 'A reason is required for this decision' });
    if (comment.length > 1000) return res.status(422).json({ success: false, message: 'The decision reason cannot exceed 1000 characters' });
    transaction = await sequelize.transaction();
    const record = await getRecord(req, transaction);
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset request not found in your college' });
    }
    if (Number(record.requestedBy) === Number(req.user.id)) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'A requester cannot review their own request' });
    }
    if (!activeReviewStatuses.includes(record.status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Only requests awaiting College Manager review can be processed' });
    }
    const previousStatus = record.status;
    await record.update({ status: transition.status }, { transaction });
    await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus,
      newStatus: transition.status,
      changedBy: req.user.id,
      comment,
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: transition.action,
      entity: `department_asset_request:${record.id}`,
      entityId: record.id,
      details: { previousStatus, newStatus: transition.status, comment },
    }, { transaction });
    const requestId = record.id;
    const requesterId = record.requestedBy;
    const requestCodeValue = record.requestCode;
    await transaction.commit();
    transaction = null;
    await notifyUsers(req, [requesterId], `College asset request ${transition.status.toLowerCase()}`, `Request ${requestCodeValue} was ${transition.status.toLowerCase()}.${comment ? ` ${comment}` : ''}`, `college-asset-request:${requestId}:${transition.status.toLowerCase()}:${Date.now()}`, requestId);
    const saved = await DepartmentAssetRequest.findOne({ where: { id: requestId }, include: includes });
    return res.json({ success: true, data: serialize(saved) });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    return next(error);
  }
};

module.exports = { list, options, create, detail, update, cancel, decide };
