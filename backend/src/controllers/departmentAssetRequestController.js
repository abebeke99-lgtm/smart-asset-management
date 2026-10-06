const { Op } = require('sequelize');
const {
  sequelize,
  DepartmentAssetRequest,
  DepartmentAssetRequestHistory,
  AssetDocument,
  AuditLog,
  Asset,
  Department,
  User,
} = require('../models');
const { createDepartmentEventNotification, createEventNotification } = require('../services/notificationService');

const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Changes Requested', 'Escalated', 'Completed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const getDepartmentId = (req) => {
  const departmentId = Number(req.organizationScope?.departmentId);
  return Number.isSafeInteger(departmentId) && departmentId > 0 ? departmentId : null;
};

const getApprovalRequestId = (req) => {
  const rawId = String(req.params.id || '');
  if (!/^\d+$/.test(rawId)) return null;
  const requestId = Number(rawId);
  return Number.isSafeInteger(requestId) && requestId > 0 ? requestId : null;
};

const requestCode = () => `AR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const requestIncludes = () => [
  { model: Department, as: 'DepartmentRecord', attributes: ['id', 'name', 'code'], required: false },
  { model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'], required: false },
  {
    model: Asset,
    as: 'AssetRecord',
    attributes: ['id', 'name', 'assetCode', 'category'],
    required: false,
    include: [{ model: AssetDocument, attributes: ['id', 'originalName', 'filePath', 'mimeType', 'description', 'createdAt'], where: { status: 'active' }, required: false }],
  },
  {
    model: DepartmentAssetRequestHistory,
    as: 'History',
    separate: true,
    order: [['createdAt', 'ASC']],
    include: [{ model: User, as: 'ChangedBy', attributes: ['id', 'username', 'fullName'], required: false }],
  },
];

const serializeRequest = (record) => {
  const value = record.toJSON();
  return {
    ...value,
    requestNumber: value.requestCode,
    requester: value.Requester ? { id: value.Requester.id, name: value.Requester.fullName || value.Requester.username } : null,
    department: value.DepartmentRecord ? { id: value.DepartmentRecord.id, name: value.DepartmentRecord.name, code: value.DepartmentRecord.code } : null,
    asset: value.AssetRecord ? { id: value.AssetRecord.id, name: value.AssetRecord.name, assetCode: value.AssetRecord.assetCode, category: value.AssetRecord.category } : null,
    supportingDocuments: (value.AssetRecord?.AssetDocuments || []).map((document) => ({
      id: document.id,
      name: document.originalName,
      filePath: document.filePath,
      mimeType: document.mimeType,
      description: document.description,
      createdAt: document.createdAt,
    })),
    history: (value.History || []).map((entry) => ({
      ...entry,
      changedByName: entry.ChangedBy?.fullName || entry.ChangedBy?.username || null,
    })),
  };
};

const listRequests = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const where = { departmentId };
    const status = String(req.query.status || '').trim();
    if (status) {
      const matchingStatus = STATUSES.find((value) => value.toLowerCase() === status.toLowerCase());
      if (!matchingStatus) return res.status(400).json({ success: false, message: 'Invalid request status filter' });
      where.status = matchingStatus;
    }
    if (req.query.priority) {
      const priority = String(req.query.priority).trim().toLowerCase();
      if (!PRIORITIES.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid request priority filter' });
      where.priority = priority;
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      const text = `%${search}%`;
      where[Op.or] = [
        { requestCode: { [Op.like]: text } },
        { requestedItem: { [Op.like]: text } },
        { category: { [Op.like]: text } },
        { justification: { [Op.like]: text } },
        { description: { [Op.like]: text } },
      ];
    }

    const [result, existingStatuses] = await Promise.all([
      DepartmentAssetRequest.findAndCountAll({
        where,
        include: requestIncludes(),
        distinct: true,
        order: [['createdAt', 'DESC']],
        limit,
        offset: (page - 1) * limit,
      }),
      DepartmentAssetRequest.findAll({ where: { departmentId }, attributes: ['status'], raw: true }),
    ]);
    const summary = { total: existingStatuses.length };
    for (const value of STATUSES) summary[value] = 0;
    for (const request of existingStatuses) {
      if (Object.prototype.hasOwnProperty.call(summary, request.status)) summary[request.status] += 1;
    }
    const data = result.rows.map(serializeRequest);
    return res.json({
      success: true,
      data,
      total: result.count,
      pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
      summary,
      statuses: STATUSES,
    });
  } catch (error) {
    return next(error);
  }
};

const getRequest = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const record = await DepartmentAssetRequest.findOne({
      where: { id: req.params.id, departmentId },
      include: requestIncludes(),
    });
    if (!record) return res.status(404).json({ success: false, message: 'Asset request not found in your department' });
    return res.json({ success: true, data: serializeRequest(record) });
  } catch (error) {
    return next(error);
  }
};

const createRequest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }

    const requestedItem = String(req.body.requestedItem || req.body.item || '').trim();
    const justification = String(req.body.justification || '').trim();
    if (!requestedItem) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Requested item is required' });
    }
    if (!justification) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Justification is required' });
    }

    const quantity = Number(req.body.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Quantity must be a positive whole number' });
    }
    const priority = String(req.body.priority || 'medium').trim().toLowerCase();
    if (!PRIORITIES.includes(priority)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid request priority' });
    }
    const requestedStatus = String(req.body.status || 'Submitted').trim().toLowerCase();
    if (!['draft', 'submitted'].includes(requestedStatus)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'New requests can only be saved as Draft or Submitted' });
    }
    const estimatedValue = req.body.estimatedValue === '' || req.body.estimatedValue == null
      ? null
      : Number(req.body.estimatedValue);
    if (estimatedValue !== null && (!Number.isFinite(estimatedValue) || estimatedValue < 0)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Estimated value must be zero or greater' });
    }

    let assetId = null;
    if (req.body.assetId) {
      const scope = req.organizationScope;
      const assetWhere = { id: req.body.assetId, departmentId };
      if (scope.collegeId) assetWhere.collegeId = scope.collegeId;
      const asset = await Asset.findOne({ where: assetWhere, transaction });
      if (!asset) {
        await transaction.rollback();
        return res.status(403).json({ success: false, message: 'Selected asset is outside your department scope' });
      }
      assetId = asset.id;
    }

    const status = requestedStatus === 'draft' ? 'Draft' : 'Submitted';
    const record = await DepartmentAssetRequest.create({
      requestCode: requestCode(),
      departmentId,
      requestedBy: req.user.id,
      assetId,
      requestedItem,
      category: String(req.body.category || '').trim() || null,
      quantity,
      unit: String(req.body.unit || 'unit').trim() || 'unit',
      priority,
      status,
      justification,
      description: String(req.body.description || '').trim() || null,
      estimatedValue,
      neededBy: req.body.neededBy || null,
    }, { transaction });
    await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus: null,
      newStatus: status,
      changedBy: req.user.id,
      comment: status === 'Draft' ? 'Draft created' : 'Request submitted',
    }, { transaction });
    await transaction.commit();

    if (status === 'Submitted') {
      try {
        await createDepartmentEventNotification({
          event: 'department_request_submitted',
          eventKey: `department_request_submitted:${record.id}`,
          departmentId,
          senderId: req.user.id,
          entityType: 'department_asset_request',
          entityId: record.id,
          actionUrl: `/department-head/asset-requests`,
          type: 'approval',
          title: 'New department asset request',
          message: `Request ${record.requestCode} for ${record.requestedItem} requires review.`,
        });
      } catch (notificationError) {
        console.error('Department request notification failed:', notificationError.stack || notificationError);
      }
    }
    const populated = await DepartmentAssetRequest.findOne({ where: { id: record.id, departmentId }, include: requestIncludes() });
    return res.status(201).json({ success: true, message: 'Asset request created', data: serializeRequest(populated) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const submitDraft = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const record = await DepartmentAssetRequest.findOne({
      where: { id: req.params.id, departmentId, status: { [Op.in]: ['Draft', 'Changes Requested'] } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Draft or changes-requested asset request not found in your department' });
    }
    const previousStatus = record.status;
    await record.update({ status: 'Submitted' }, { transaction });
    const historyEntry = await DepartmentAssetRequestHistory.create({
      requestId: record.id,
      previousStatus,
      newStatus: 'Submitted',
      changedBy: req.user.id,
      comment: String(req.body.comment || (previousStatus === 'Draft' ? 'Draft submitted' : 'Request resubmitted')).trim(),
    }, { transaction });
    await transaction.commit();

    try {
      await createDepartmentEventNotification({
        event: 'department_request_submitted',
        eventKey: `department_request_submitted:${record.id}:${historyEntry?.id || record.updatedAt?.getTime?.() || Date.now()}`,
        departmentId,
        senderId: req.user.id,
        entityType: 'department_asset_request',
        entityId: record.id,
        actionUrl: '/department-head/asset-requests',
        type: 'approval',
        title: 'Department asset request submitted',
        message: `Request ${record.requestCode} for ${record.requestedItem} is ready for review.`,
      });
    } catch (notificationError) {
      console.error('Department request notification failed:', notificationError.stack || notificationError);
    }
    const populated = await DepartmentAssetRequest.findOne({ where: { id: record.id, departmentId }, include: requestIncludes() });
    return res.json({ success: true, data: serializeRequest(populated) });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    return next(error);
  }
};

const listApprovalQueue = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const rows = await DepartmentAssetRequest.findAll({
      where: { departmentId, status: { [Op.in]: ['Submitted', 'Under Review'] } },
      include: requestIncludes(),
      distinct: true,
      order: [['createdAt', 'ASC']],
    });
    await AuditLog.create({
      userId: req.user.id,
      action: 'APPROVAL_QUEUE_VIEWED',
      entity: `department:${departmentId}:approval-queue`,
      details: JSON.stringify({ departmentId, resultCount: rows.length }),
    });
    return res.json({ success: true, data: rows.map(serializeRequest), total: rows.length });
  } catch (error) {
    return next(error);
  }
};

const getApprovalReview = async (req, res, next) => {
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const requestId = getApprovalRequestId(req);
    if (!requestId) return res.status(400).json({ success: false, message: 'Invalid approval request ID' });
    const record = await DepartmentAssetRequest.findOne({
      where: { id: requestId, departmentId },
      include: requestIncludes(),
    });
    if (!record) return res.status(404).json({ success: false, message: 'Approval request not found in your department' });
    await AuditLog.create({
      userId: req.user.id,
      action: 'APPROVAL_REQUEST_VIEWED',
      entity: `department_asset_request:${record.id}`,
      details: JSON.stringify({ requestId: record.id, departmentId }),
    });
    return res.json({ success: true, data: serializeRequest(record) });
  } catch (error) {
    return next(error);
  }
};

const decideApproval = async (req, res, next) => {
  let transaction;
  try {
    const departmentId = getDepartmentId(req);
    if (!departmentId) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    const requestId = getApprovalRequestId(req);
    if (!requestId) return res.status(400).json({ success: false, message: 'Invalid approval request ID' });
    const decision = req.approvalDecision;
    const transitions = {
      approve: { status: 'Approved', action: 'APPROVAL_REQUEST_APPROVED' },
      reject: { status: 'Rejected', action: 'APPROVAL_REQUEST_REJECTED' },
      'request-changes': { status: 'Changes Requested', action: 'APPROVAL_CHANGES_REQUESTED' },
      escalate: { status: 'Escalated', action: 'APPROVAL_ESCALATED_TO_COLLEGE' },
    };
    const transition = transitions[decision];
    if (!transition) return res.status(400).json({ success: false, message: 'Invalid approval action' });
    const body = req.body || {};
    const comment = String(body.reason || body.comment || '').trim();
    if (['reject', 'request-changes', 'escalate'].includes(decision) && !comment) {
      return res.status(400).json({ success: false, message: 'A reason is required for this action' });
    }

    transaction = await sequelize.transaction();
    const record = await DepartmentAssetRequest.findOne({
      where: { id: requestId, departmentId, status: { [Op.in]: ['Submitted', 'Under Review'] } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!record) {
      await transaction.rollback();
      transaction = null;
      return res.status(404).json({ success: false, message: 'Pending approval request not found in your department' });
    }
    if (Number(record.requestedBy) === Number(req.user.id)) {
      await transaction.rollback();
      transaction = null;
      return res.status(403).json({ success: false, message: 'A requester cannot review their own request' });
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
      details: JSON.stringify({ requestId: record.id, departmentId, beforeStatus: previousStatus, afterStatus: transition.status, comment }),
    }, { transaction });
    const updated = await DepartmentAssetRequest.findOne({
      where: { id: record.id, departmentId },
      include: requestIncludes(),
      transaction,
    });
    await transaction.commit();
    transaction = null;
    const requestEvents = {
      approve: 'department_request_approved',
      reject: 'department_request_rejected',
      'request-changes': 'department_request_changes_requested',
    };
    if (requestEvents[decision]) {
      try {
        await createEventNotification({
          event: requestEvents[decision],
          eventKey: `${requestEvents[decision]}:${record.id}:${updated.updatedAt?.getTime?.() || Date.now()}`,
          userIds: [record.requestedBy],
          senderId: req.user.id,
          departmentId,
          entityType: 'department_asset_request',
          entityId: record.id,
          actionUrl: '/department-head/asset-requests',
          type: 'approval',
          title: `Department asset request ${transition.status.toLowerCase()}`,
          message: `Request ${record.requestCode} was ${transition.status.toLowerCase()}.${comment ? ` ${comment}` : ''}`,
        });
      } catch (notificationError) {
        console.error('Department request decision notification failed:', notificationError.message);
      }
    }
    return res.json({ success: true, message: 'Approval action recorded', data: serializeRequest(updated) });
  } catch (error) {
    if (transaction) await transaction.rollback();
    return next(error);
  }
};

module.exports = { listRequests, getRequest, createRequest, submitDraft, listApprovalQueue, getApprovalReview, decideApproval, STATUSES };
