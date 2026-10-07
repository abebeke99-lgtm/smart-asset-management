const { Op } = require('sequelize');
const { sequelize, Asset, User, Department, Location, College, Building, Campus, Approval, Assignment, Transfer, AssetReturn, Maintenance, VerificationSession, VerificationItem, ServiceRequest, AuditLog, AssetMovement, Room } = require('../models');
const { normalizeRoleValue } = require('../middlewares/auth');
const { createAuditLog } = require('../services/auditLogService');

const pageValues = (query) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  return { page, limit, offset: (page - 1) * limit };
};

const normalizeStatusText = (value) => String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, ' ');

const groupCategoryLabel = (categoryName) => {
  const category = normalizeStatusText(categoryName);
  if (['computer', 'computing', 'desktop', 'laptop', 'workstation', 'server'].some((keyword) => category.includes(keyword))) return 'Computing';
  if (['laboratory', 'lab', 'microscope', 'centrifuge', 'spectrometer'].some((keyword) => category.includes(keyword))) return 'Laboratory Equipment';
  if (['agriculture', 'farm', 'tractor', 'irrigation', 'soil'].some((keyword) => category.includes(keyword))) return 'Agriculture Equipment';
  if (['furniture', 'desk', 'chair', 'cabinet', 'table'].some((keyword) => category.includes(keyword))) return 'Furniture';
  if (['ict', 'printer', 'projector', 'router', 'network', 'presentation', 'telecom'].some((keyword) => category.includes(keyword))) return 'ICT Equipment';
  if (['electrical', 'generator', 'power', 'lighting', 'motor'].some((keyword) => category.includes(keyword))) return 'Electrical';
  return 'Other';
};

const normalizeAssetStatus = (status, condition, expiryDate) => {
  const normalizedStatus = normalizeStatusText(status);
  const normalizedCondition = normalizeStatusText(condition);
  const expiryValue = expiryDate ? new Date(expiryDate) : null;
  const today = new Date();
  if (['disposed', 'retired'].includes(normalizedStatus)) return 'Disposed';
  if (['expired'].includes(normalizedStatus) || (expiryValue && expiryValue < today)) return 'Expired';
  if (['damaged', 'broken', 'faulty'].includes(normalizedStatus) || ['damaged', 'broken', 'faulty'].includes(normalizedCondition)) return 'Damaged';
  if (['replaced'].includes(normalizedStatus) || ['replaced'].includes(normalizedCondition)) return 'Replaced';
  if (['maintenance', 'under maintenance', 'in maintenance', 'in repair', 'repair'].includes(normalizedStatus)) return 'Under Maintenance';
  return 'Active';
};

const normalizeRequestStatus = (status, escalated) => {
  const value = normalizeStatusText(status);
  if (escalated || value === 'escalated') return 'Escalated';
  if (['submitted', 'pending', 'open', 'new'].includes(value)) return 'Submitted';
  if (value === 'acknowledged') return 'Acknowledged';
  if (value === 'scheduled') return 'Scheduled';
  if (['in progress', 'assigned', 'started'].includes(value)) return 'In Progress';
  if (value === 'completed') return 'Completed';
  return null;
};

const normalizeAcquisitionStatus = (status) => {
  const value = normalizeStatusText(status);
  if (value === 'draft') return 'Draft';
  if (value === 'submitted') return 'Submitted';
  if (value === 'under review' || value === 'pending') return 'Under Review';
  if (value === 'approved') return 'Approved';
  if (value === 'rejected') return 'Rejected';
  if (value === 'changes requested' || value === 'changes_requested') return 'Changes Requested';
  if (value === 'escalated') return 'Escalated';
  if (value === 'completed') return 'Completed';
  return null;
};

const toChartSeries = (entries, total) => entries
  .filter((entry) => Number(entry.count || 0) > 0)
  .map((entry) => ({
    label: entry.label,
    count: Number(entry.count || 0),
    value: Number(entry.count || 0),
    percentage: total ? Number(((Number(entry.count || 0) / total) * 100).toFixed(1)) : 0,
  }));

const chartSeries = (labels, counts, total) => (total
  ? labels.map((label) => ({
    label,
    count: counts[label] || 0,
    value: counts[label] || 0,
    percentage: Number((((counts[label] || 0) / total) * 100).toFixed(1)),
  }))
  : []);

const departmentAssetStatuses = ['Active', 'Damaged', 'Under Maintenance', 'Replaced', 'Expired', 'Disposed'];
const departmentAssetCategories = ['Computing', 'Laboratory Equipment', 'Agriculture Equipment', 'Furniture', 'ICT Equipment', 'Electrical', 'Other'];
const serviceRequestStatuses = ['Submitted', 'Acknowledged', 'Scheduled', 'In Progress', 'Completed', 'Escalated'];
const acquisitionRequestStatuses = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Changes Requested', 'Escalated', 'Completed'];

const isAcquisitionApproval = (approval) => /acquisition|purchase|asset request/i.test(`${approval.type || ''} ${approval.item || ''}`);
const isOpenStatus = (status) => !['completed', 'cancelled', 'closed', 'rejected'].includes(normalizeStatusText(status));
const isPendingAcquisitionStatus = (status) => ['draft', 'submitted', 'pending', 'under review', 'changes requested', 'escalated'].includes(normalizeStatusText(status));
const userName = (user) => user && (user.fullName || user.username);
const assetName = (asset) => asset && [asset.name, asset.assetCode].filter(Boolean).join(' - ');

const sanitizeProfileText = (value) => value
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim();

const normalizeDepartmentProfileFields = async (payload = {}) => {
  const allowedKeys = new Set(['contact', 'email', 'office', 'description']);
  const errors = {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { updates: {}, errors: { _form: 'Department profile fields must be an object.' } };
  }

  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) errors[key] = 'This field cannot be updated.';
  }
  if (Object.keys(payload).length === 0) {
    errors._form = 'At least one editable department profile field is required.';
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'contact')) {
    if (typeof payload.contact !== 'string') {
      errors.contact = 'Enter a valid contact number.';
    } else {
      const contact = sanitizeProfileText(payload.contact);
      if (contact.length > 50 || (contact && (!/^[+()\d\s.-]+$/.test(contact) || contact.replace(/\D/g, '').length < 7))) {
        errors.contact = 'Enter a valid contact number.';
      } else {
        updates.phone = contact;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    if (typeof payload.email !== 'string') {
      errors.email = 'Enter a valid email address.';
    } else {
      const email = sanitizeProfileText(payload.email);
      if (email.length > 255 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        errors.email = 'Enter a valid email address.';
      } else {
        updates.email = email;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'office')) {
    if (typeof payload.office !== 'string') {
      errors.office = 'Enter a valid office.';
    } else {
      const office = sanitizeProfileText(payload.office);
      if (office.length > 255) {
        errors.office = 'Office must be 255 characters or fewer.';
      } else if (!office) {
        updates.locationId = null;
      } else {
        const location = await Location.findOne({ where: { name: office }, attributes: ['id'] });
        if (!location) {
          errors.office = 'Select an existing office location.';
        } else {
          updates.locationId = location.id;
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'description')) {
    if (typeof payload.description !== 'string') {
      errors.description = 'Enter a valid description.';
    } else {
      const description = sanitizeProfileText(payload.description);
      if (description.length > 500) {
        errors.description = 'Description must be 500 characters or fewer.';
      } else {
        updates.description = description;
      }
    }
  }

  return { updates, errors };
};

const getDepartmentProfileUserId = (req) => {
  if (!req.user) return { status: 401 };
  if (normalizeRoleValue(req.user.role) !== 'department_head') return { status: 403 };
  const departmentId = Number(req.user.departmentId ?? req.user.department_id);
  if (!Number.isSafeInteger(departmentId) || departmentId < 1) return { status: 404 };
  return { departmentId };
};

const serializeDepartmentProfile = (department, totalStaff, totalAssets) => ({
  id: department.id,
  name: department.name,
  code: department.code,
  description: department.description || '',
  contact: department.phone || '',
  phone: department.phone || '',
  email: department.email || '',
  status: department.status,
  departmentId: department.id,
  userCount: totalStaff,
  assetCount: totalAssets,
  college: department.College || null,
  head: department.Head || null,
  locationRecord: department.LocationRecord || null,
  office: department.LocationRecord?.name || null,
  summary: { totalStaff, totalAssets },
  createdAt: department.createdAt,
  updatedAt: department.updatedAt,
});

const getDepartmentProfile = async (req, res, next) => {
  try {
    const scope = getDepartmentProfileUserId(req);
    if (scope.status) {
      const message = scope.status === 401 ? 'Authentication required.' : scope.status === 403 ? 'Access denied for this role.' : 'Department profile not found.';
      return res.status(scope.status).json({ success: false, message });
    }
    const { departmentId } = scope;

    const department = await Department.findByPk(departmentId, {
      include: [
        { model: College, attributes: ['id', 'collegeName', 'collegeCode'], required: false },
        { model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false },
        { model: Location, as: 'LocationRecord', attributes: ['id', 'name', 'code'], required: false },
      ],
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department profile not found.' });
    }

    const [totalStaff, totalAssets] = await Promise.all([
      User.count({ where: { departmentId } }),
      Asset.count({ where: { departmentId } }),
    ]);

    const payload = serializeDepartmentProfile(department, totalStaff, totalAssets);

    return res.json({ success: true, data: payload, summary: payload.summary });
  } catch (error) {
    return next(error);
  }
};

const updateDepartmentProfile = async (req, res, next) => {
  try {
    const scope = getDepartmentProfileUserId(req);
    if (scope.status) {
      const message = scope.status === 401 ? 'Authentication required.' : scope.status === 403 ? 'Access denied for this role.' : 'Department profile not found.';
      return res.status(scope.status).json({ success: false, message });
    }
    const { departmentId } = scope;

    const department = await Department.findByPk(departmentId, {
      include: [
        { model: College, attributes: ['id', 'collegeName', 'collegeCode'], required: false },
        { model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false },
        { model: Location, as: 'LocationRecord', attributes: ['id', 'name', 'code'], required: false },
      ],
    });

    if (!department) {
      return res.status(404).json({ success: false, message: 'Department profile not found.' });
    }

    const { updates, errors } = await normalizeDepartmentProfileFields(req.body || {});
    if (Object.keys(errors).length) {
      return res.status(422).json({ success: false, message: 'Please correct the department profile fields.', errors });
    }
    if (Object.keys(updates).length === 0) {
      return res.status(422).json({
        success: false,
        message: 'At least one editable department profile field is required.',
        errors: { _form: 'At least one editable department profile field is required.' },
      });
    }

    if (updates.locationId !== undefined && updates.locationId !== null) {
      const location = await Location.findByPk(updates.locationId, { attributes: ['id'] });
      if (!location) {
        return res.status(404).json({ success: false, message: 'Office location not found.' });
      }
    }

    const oldValues = {
      contact: department.phone || '',
      email: department.email || '',
      office: department.LocationRecord?.name || '',
      description: department.description || '',
    };
    const refreshed = await sequelize.transaction(async (transaction) => {
      await department.update(updates, { transaction });
      const updatedDepartment = await Department.findByPk(departmentId, {
        include: [
          { model: College, attributes: ['id', 'collegeName', 'collegeCode'], required: false },
          { model: User, as: 'Head', attributes: ['id', 'fullName', 'username'], required: false },
          { model: Location, as: 'LocationRecord', attributes: ['id', 'name', 'code'], required: false },
        ],
        transaction,
      });
      if (!updatedDepartment) throw new Error('Department profile not found.');

      const newValues = {
        contact: updatedDepartment.phone || '',
        email: updatedDepartment.email || '',
        office: updatedDepartment.LocationRecord?.name || '',
        description: updatedDepartment.description || '',
      };
      const changedFields = Object.keys(newValues).filter((field) => oldValues[field] !== newValues[field]);
      const changedOldValues = Object.fromEntries(changedFields.map((field) => [field, oldValues[field]]));
      const changedNewValues = Object.fromEntries(changedFields.map((field) => [field, newValues[field]]));
      await createAuditLog({
        userId: req.user.id,
        role: req.user.role,
        action: 'UPDATE_DEPARTMENT_PROFILE',
        entity: `department:${departmentId}`,
        entityId: departmentId,
        oldValue: changedOldValues,
        newValue: changedNewValues,
        details: { departmentId, changedFields },
        transaction,
      });
      return updatedDepartment;
    });

    const [totalStaff, totalAssets] = await Promise.all([
      User.count({ where: { departmentId } }),
      Asset.count({ where: { departmentId } }),
    ]);
    const profile = serializeDepartmentProfile(refreshed, totalStaff, totalAssets);

    return res.json({ success: true, message: 'Department profile updated successfully.', data: profile, summary: profile.summary });
  } catch (error) {
    if (error.message === 'Department profile not found.') {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error('Department profile update failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to update department profile.' });
  }
};

const getDepartmentDashboard = async (req, res, next) => {
  try {
    const departmentId = Number(req.organizationScope?.departmentId);
    if (!Number.isInteger(departmentId) || departmentId < 1) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this department data.' });
    }

    const [assets, staffCount, approvals, serviceRequests, assignments, transfers, returnRecords, maintenances, verificationSessions, laboratories] = await Promise.all([
      Asset.findAll({
        where: { departmentId },
        attributes: ['id', 'name', 'assetCode', 'status', 'category', 'condition', 'location', 'currentValue', 'expiryDate'],
        raw: true,
      }),
      User.count({ where: { departmentId } }),
      Approval.findAll({
        where: { departmentId },
        attributes: ['id', 'type', 'status', 'item', 'priority', 'createdAt', 'updatedAt'],
        include: [{ model: User, as: 'Requester', attributes: ['id', 'fullName', 'username'], required: false }],
        order: [['createdAt', 'DESC']],
      }),
      ServiceRequest.findAll({
        where: { departmentId },
        attributes: ['id', 'requestCode', 'requestType', 'title', 'status', 'priority', 'escalated', 'escalatedAt', 'dueDate', 'completedAt', 'resolvedBy', 'closedBy', 'createdAt', 'updatedAt'],
        include: [
          { model: User, as: 'Reporter', attributes: ['id', 'fullName', 'username'], required: false },
          { model: User, as: 'Assignee', attributes: ['id', 'fullName', 'username'], required: false },
          { model: User, as: 'ResolvedBy', attributes: ['id', 'fullName', 'username'], required: false },
          { model: User, as: 'ClosedBy', attributes: ['id', 'fullName', 'username'], required: false },
          { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
      Assignment.findAll({
        where: { departmentId },
        attributes: ['id', 'assignedTo', 'status', 'workflowStatus', 'assignedDate', 'createdAt'],
        include: [
          { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: true },
          { model: User, attributes: ['id', 'fullName', 'username'], required: false },
          { model: User, as: 'AssignedByUser', attributes: ['id', 'fullName', 'username'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
      Transfer.findAll({
        where: { [Op.or]: [{ sourceDepartmentId: departmentId }, { destinationDepartmentId: departmentId }] },
        attributes: ['id', 'transferNumber', 'status', 'requestedAt', 'createdAt', 'requestedBy'],
        include: [
          { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: false },
          { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username'], required: false },
          { model: User, as: 'Creator', attributes: ['id', 'fullName', 'username'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
      AssetReturn.findAll({
        where: { departmentId },
        attributes: ['id', 'returnNumber', 'status', 'requestedAt', 'createdAt'],
        include: [
          { model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: true },
          { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username'], required: false },
        ],
        order: [['createdAt', 'DESC']],
      }),
      Maintenance.findAll({
        attributes: ['id', 'title', 'status', 'priority', 'createdAt', 'updatedAt', 'assignedTo'],
        include: [{ model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode'], required: true }, { model: User, as: 'Requester', attributes: ['id', 'fullName', 'username'], required: false }, { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'], required: false }],
        order: [['createdAt', 'DESC']],
      }),
      VerificationSession.findAll({
        where: { departmentId },
        attributes: ['id', 'name', 'status', 'finalizedAt', 'createdAt'],
        include: [{ model: User, as: 'Starter', attributes: ['id', 'fullName', 'username'], required: false }, { model: VerificationItem, attributes: ['id', 'assetId', 'state'], required: false, include: [{ model: Asset, where: { departmentId }, attributes: ['id', 'name', 'assetCode', 'departmentId'], required: false }] }],
        order: [['createdAt', 'DESC']],
      }),
      Room.findAll({ where: { departmentId }, attributes: ['roomType'] }),
    ]);

    const totalAssets = assets.length;
    const statusCounts = Object.fromEntries(departmentAssetStatuses.map((label) => [label, 0]));
    const categoryCounts = Object.fromEntries(departmentAssetCategories.map((label) => [label, 0]));
    const locationCounts = {};
    const conditionCounts = {};

    for (const asset of assets) {
      const normalizedStatus = normalizeAssetStatus(asset.status, asset.condition, asset.expiryDate);
      statusCounts[normalizedStatus] = (statusCounts[normalizedStatus] || 0) + 1;
      const categoryLabel = groupCategoryLabel(asset.category);
      categoryCounts[categoryLabel] = (categoryCounts[categoryLabel] || 0) + 1;
      const locationLabel = asset.location || 'Unknown';
      locationCounts[locationLabel] = (locationCounts[locationLabel] || 0) + 1;
      const conditionLabel = asset.condition || 'Unknown';
      conditionCounts[conditionLabel] = (conditionCounts[conditionLabel] || 0) + 1;
    }

    const assetByStatus = chartSeries(departmentAssetStatuses, statusCounts, totalAssets);
    const assetByCategory = chartSeries(departmentAssetCategories, categoryCounts, totalAssets);
    const assetByLocation = Object.entries(locationCounts).map(([label, count]) => ({ label, count, percentage: totalAssets ? Number(((count / totalAssets) * 100).toFixed(1)) : 0 }));
    const assetByCondition = Object.entries(conditionCounts).map(([label, count]) => ({ label, count, percentage: totalAssets ? Number(((count / totalAssets) * 100).toFixed(1)) : 0 }));

    const serviceStatusCounts = Object.fromEntries(serviceRequestStatuses.map((label) => [label, 0]));
    for (const request of serviceRequests) {
      const label = normalizeRequestStatus(request.status, request.escalated);
      if (label) serviceStatusCounts[label] += 1;
    }
    const serviceRequestStatus = chartSeries(
      serviceRequestStatuses,
      serviceStatusCounts,
      Object.values(serviceStatusCounts).reduce((sum, count) => sum + count, 0),
    );

    const acquisitionApprovals = approvals.filter(isAcquisitionApproval);
    const acquisitionStatusCounts = Object.fromEntries(acquisitionRequestStatuses.map((label) => [label, 0]));
    for (const approval of acquisitionApprovals) {
      const label = normalizeAcquisitionStatus(approval.status);
      if (label) acquisitionStatusCounts[label] += 1;
    }
    const acquisitionRequestStatus = chartSeries(
      acquisitionRequestStatuses,
      acquisitionStatusCounts,
      Object.values(acquisitionStatusCounts).reduce((sum, count) => sum + count, 0),
    );

    const activeAssets = statusCounts.Active || 0;
    const availableAssets = assets.filter((asset) => normalizeStatusText(asset.status) === 'available').length;
    const inUseAssets = assets.filter((asset) => ['assigned', 'in use', 'in-use', 'issued'].includes(normalizeStatusText(asset.status))).length;
    const underMaintenance = statusCounts['Under Maintenance'] || 0;
    const damagedAssets = statusCounts.Damaged || 0;
    const openServiceRequests = serviceRequests.filter((request) => isOpenStatus(request.status)).length;
    const pendingApprovals = approvals.filter((approval) => normalizeStatusText(approval.status) === 'pending').length;
    const pendingAcquisitionRequests = acquisitionApprovals.filter((approval) => isPendingAcquisitionStatus(approval.status)).length;
    const now = Date.now();
    const overdueTickets = serviceRequests.filter((request) => isOpenStatus(request.status) && request.dueDate && new Date(request.dueDate).getTime() < now).length;
    const escalatedTickets = serviceRequests.filter((request) => request.escalated || normalizeStatusText(request.status) === 'escalated').length;
    const laboratoryCount = laboratories.filter((room) => normalizeStatusText(room.roomType).includes('lab')).length;
    const verificationItems = verificationSessions
      .flatMap((session) => session.VerificationItems || [])
      .filter((item) => Number(item.Asset?.departmentId) === departmentId);
    const assetsRequiringVerification = verificationItems.filter((item) => item.state && item.state !== 'verified').length;
    const verifiedAssets = new Set((verificationItems.filter((item) => item.state === 'verified').map((item) => item.assetId))).size;
    const pendingTransfers = transfers.filter((transfer) => !['completed', 'cancelled', 'rejected'].includes(normalizeStatusText(transfer.status))).length;
    const pendingReturns = returnRecords.filter((returnItem) => !['received', 'completed', 'cancelled'].includes(normalizeStatusText(returnItem.status))).length;

    const recentActivities = [
      ...approvals.map((approval) => ({
        id: `approval-${approval.id}`,
        user: userName(approval.Requester),
        action: /acquisition|purchase|asset request/i.test(`${approval.type || ''} ${approval.item || ''}`) ? 'New asset request' : 'Approval submission',
        entity: approval.item || approval.type || `Approval #${approval.id}`,
        status: approval.status || 'Pending',
        date: approval.createdAt,
        type: 'approval',
      })),
      ...assignments.map((assignment) => ({
        id: `assignment-${assignment.id}`,
        user: userName(assignment.AssignedByUser),
        action: 'Asset assignment',
        entity: assetName(assignment.Asset) || `Assignment #${assignment.id}`,
        status: assignment.workflowStatus || assignment.status || 'Active',
        date: assignment.assignedDate || assignment.createdAt,
        type: 'assignment',
      })),
      ...transfers.map((transfer) => ({
        id: `transfer-${transfer.id}`,
        user: userName(transfer.Requester) || userName(transfer.Creator),
        action: 'Asset transfer',
        entity: assetName(transfer.Asset) || transfer.transferNumber || `Transfer #${transfer.id}`,
        status: transfer.status || 'Pending',
        date: transfer.requestedAt || transfer.createdAt,
        type: 'transfer',
      })),
      ...returnRecords.map((returnItem) => ({
        id: `return-${returnItem.id}`,
        user: userName(returnItem.Requester),
        action: 'Asset return',
        entity: assetName(returnItem.Asset) || returnItem.returnNumber || `Return #${returnItem.id}`,
        status: returnItem.status || 'Requested',
        date: returnItem.requestedAt || returnItem.createdAt,
        type: 'return',
      })),
      ...maintenances.flatMap((maintenance) => [
        {
        id: `maintenance-${maintenance.id}`,
        user: userName(maintenance.Requester),
        action: 'Maintenance request',
        entity: assetName(maintenance.Asset) || maintenance.title,
        status: maintenance.status || 'Pending',
        date: maintenance.createdAt,
        type: 'maintenance',
      },
        ...(maintenance.assignedTo && maintenance.Technician ? [{
          id: `technician-${maintenance.id}`,
          user: userName(maintenance.Technician),
          action: 'Technician assignment',
          entity: assetName(maintenance.Asset) || maintenance.title,
          status: maintenance.status || 'Assigned',
          date: maintenance.updatedAt || maintenance.createdAt,
          type: 'maintenance',
        }] : []),
      ]),
      ...serviceRequests.flatMap((request) => [
        ...(request.escalated ? [{
          id: `escalation-${request.id}`,
          user: 'Automated system',
          action: 'Ticket escalation',
          entity: assetName(request.Asset) || request.title || request.requestCode,
          status: request.status || 'Escalated',
          date: request.escalatedAt || request.updatedAt || request.createdAt,
          type: 'service',
        }] : []),
        ...(request.completedAt ? [{
          id: `service-completion-${request.id}`,
          user: userName(request.ResolvedBy) || userName(request.ClosedBy) || userName(request.Assignee) || userName(request.Reporter),
          action: 'Service completion',
          entity: assetName(request.Asset) || request.title || request.requestCode,
          status: request.status || 'Completed',
          date: request.completedAt,
          type: 'service',
        }] : []),
      ]),
      ...verificationSessions.map((session) => ({
        id: `verification-${session.id}`,
        user: userName(session.Starter),
        action: 'Asset verification',
        entity: session.name || `Verification #${session.id}`,
        status: session.status || 'Draft',
        date: session.createdAt,
        type: 'verification',
      })),
    ].filter((entry) => entry.user && entry.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);

    const dashboardData = {
      department: req.organizationScope.department ? {
        id: req.organizationScope.department.id,
        name: req.organizationScope.department.name,
        code: req.organizationScope.department.code,
      } : null,
      totalAssets,
      activeAssets,
      availableAssets,
      inUseAssets,
      assignedAssets: inUseAssets,
      underMaintenance,
      damagedAssets,
      replacedAssets: statusCounts.Replaced || 0,
      expiredAssets: statusCounts.Expired || 0,
      disposedAssets: statusCounts.Disposed || 0,
      totalValue: assets.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
      assetValue: assets.reduce((sum, asset) => sum + Number(asset.currentValue || 0), 0),
      utilizationRate: totalAssets ? Number(((inUseAssets / totalAssets) * 100).toFixed(1)) : 0,
      staffCount,
      pendingApprovals,
      pendingRequests: pendingApprovals,
      pendingAssetRequests: pendingAcquisitionRequests,
      pendingAcquisitionRequests,
      openServiceRequests,
      overdueTickets,
      escalatedTickets,
      laboratories: laboratoryCount,
      assetsRequiringVerification,
      assetByStatus,
      assetByCategory,
      assetByLocation,
      assetByCondition,
      serviceRequestStatus,
      acquisitionRequestStatus,
      pendingTransfers,
      pendingReturns,
      maintenanceSummary: {
        open: maintenances.filter((item) => !['completed', 'cancelled', 'closed'].includes(normalizeStatusText(item.status))).length,
        inProgress: maintenances.filter((item) => ['in progress', 'in_progress', 'assigned', 'scheduled'].includes(normalizeStatusText(item.status))).length,
        completed: maintenances.filter((item) => normalizeStatusText(item.status) === 'completed').length,
        overdue: maintenances.filter((item) => normalizeStatusText(item.status) === 'overdue').length,
      },
      verificationSummary: {
        verifiedAssets,
        pendingVerification: assetsRequiringVerification,
        verificationIssues: verificationItems.filter((item) => item.state && item.state !== 'verified').length,
      },
      recentActivities,
      recentAssignments: assignments.slice(0, 5).map((assignment) => ({
        id: assignment.id,
        name: assignment.Asset ? `${assignment.Asset.name} - ${assignment.Asset.assetCode}` : `Assignment #${assignment.id}`,
        assigned_to: assignment.User ? assignment.User.fullName || assignment.User.username : 'Unassigned',
        date: assignment.assignedDate || assignment.createdAt,
      })),
      pendingRequestItems: approvals.filter((approval) => normalizeStatusText(approval.status) === 'pending').slice(0, 10).map((approval) => ({
        id: approval.id,
        title: approval.item || approval.type || `Request #${approval.id}`,
        priority: approval.priority || 'medium',
        status: approval.status || 'pending',
      })),
      maintenanceAlerts: maintenances.filter((maintenance) => !['completed', 'cancelled'].includes(normalizeStatusText(maintenance.status))).slice(0, 10).map((maintenance) => ({
        id: maintenance.id,
        title: maintenance.title,
        priority: maintenance.priority || 'medium',
        status: maintenance.status || 'Pending',
        message: maintenance.Asset ? `${maintenance.Asset.name} - ${maintenance.Asset.assetCode}` : '',
      })),
    };

    return res.json({ success: true, data: dashboardData });
  } catch (error) {
    return next(error);
  }
};

const listDepartmentAssets = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const where = { departmentId: req.organizationScope.departmentId };
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.location) where.location = String(req.query.location);
    if (req.query.search) where[Op.or] = [{ name: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { assetCode: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { serialNumber: { [Op.like]: `%${String(req.query.search).trim()}%` } }, { rfidTag: { [Op.like]: `%${String(req.query.search).trim()}%` } }];
    const { count, rows } = await Asset.findAndCountAll({ where, order: [['updatedAt', 'DESC']], limit, offset });
    res.json({ success: true, data: rows, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { next(error); }
};

const listDepartmentStaff = async (req, res, next) => {
  try {
    const { page, limit, offset } = pageValues(req.query);
    const departmentId = Number(req.organizationScope.departmentId);
    const collegeId = req.organizationScope.collegeId;
    if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
    }
    const scope = {
      departmentId: req.organizationScope.departmentId,
      ...(collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
    };
    const where = { ...scope };
    const search = String(req.query.search || '').trim();
    if (search) {
      const searchFields = [
        { fullName: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { role: { [Op.like]: `%${search}%` } },
      ];
      if (User.rawAttributes.employeeId) searchFields.push({ employeeId: { [Op.like]: `%${search}%` } });
      if (User.rawAttributes.position) searchFields.push({ position: { [Op.like]: `%${search}%` } });
      if (/^\d+$/.test(search)) searchFields.push({ id: Number(search) });
      where[Op.or] = searchFields;
    }
    const position = String(req.query.position || '').trim();
    if (position) {
      const positionField = User.rawAttributes.position ? 'position' : 'role';
      where[positionField] = position;
    }
    const role = String(req.query.role || '').trim();
    if (role) where.role = role;
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status === 'active') {
      where.active = true;
      where.status = 'active';
    } else if (status === 'inactive') {
      where.active = false;
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ active: false }, { status: { [Op.ne]: 'active' } }] },
      ];
    } else if (status === 'suspended') {
      where.status = 'suspended';
    }

    const staffAttributes = [
      'id', 'username', 'fullName', 'email', 'role', 'department', 'departmentId',
      'phone', 'active', 'status', 'createdAt',
      ...['employeeId', 'position', 'office', 'laboratory'].filter((field) => User.rawAttributes[field]),
    ];
    const filterAttributes = User.rawAttributes.position ? ['position', 'role'] : ['role'];
    const [result, active, inactive, total] = await Promise.all([
      User.findAndCountAll({ where, attributes: staffAttributes, order: [['fullName', 'ASC']], limit, offset }),
      User.count({ where: { ...scope, active: true, status: 'active' } }),
      User.count({ where: { ...scope, [Op.or]: [{ active: false }, { status: { [Op.ne]: 'active' } }] } }),
      User.count({ where: scope }),
    ]);
    const positionRows = await User.findAll({
      where: scope,
      attributes: filterAttributes,
      group: filterAttributes,
      order: [[User.rawAttributes.position ? 'position' : 'role', 'ASC']],
      raw: true,
    });
    const positionKey = User.rawAttributes.position ? 'position' : 'role';
    const availablePositions = [...new Set(positionRows.map((row) => String(row[positionKey] || '').trim()).filter(Boolean))];
    const availableRoles = [...new Set(positionRows.map((row) => String(row.role || '').trim()).filter(Boolean))];
    res.json({
      success: true,
      data: result.rows,
      summary: { total, active, inactive },
      filters: {
        positions: availablePositions,
        positionField: User.rawAttributes.position ? 'position' : 'role',
        roles: availableRoles,
      },
      pagination: { page, limit, total: result.count, pages: Math.ceil(result.count / limit) },
    });
  } catch (error) { next(error); }
};

const listDepartmentLocations = async (req, res, next) => {
  try {
    const departmentId = Number(req.organizationScope?.departmentId);
    if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
    }
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const search = String(req.query.search || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim().toLowerCase();
    const type = String(req.query.type || '').trim().toLowerCase();
    const campus = String(req.query.campus || '').trim();
    const [department, rooms, assets] = await Promise.all([
      Department.findByPk(departmentId, {
        include: [
          { model: Location, as: 'LocationRecord', required: false, attributes: ['id', 'name', 'code', 'description', 'status'] },
          { model: College, required: false, attributes: ['id', 'collegeName', 'collegeCode'] },
        ],
      }),
      Room.findAll({
        where: { departmentId },
        attributes: ['id', 'buildingId', 'campusId', 'departmentId', 'roomCode', 'roomName', 'roomType', 'description', 'floor', 'status'],
        include: [
          { model: Building, attributes: ['id', 'buildingName', 'buildingCode'], required: false },
          { model: Campus, attributes: ['id', 'campusName', 'campusCode'], required: false },
        ],
        order: [['roomName', 'ASC']],
      }),
      Asset.findAll({ where: { departmentId }, attributes: ['id', 'location', 'roomId'], raw: true }),
    ]);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department locations were not found.' });
    }

    const departmentData = department.toJSON ? department.toJSON() : department;
    const departmentName = departmentData.name || '';
    const authorizedRoomIds = new Set(rooms.map((room) => Number(room.id)));
    const roomAssetCounts = new Map();
    const departmentLocationName = String(department.LocationRecord?.name || '').trim();
    let departmentLocationAssetCount = 0;
    assets.forEach((asset) => {
      const roomId = Number(asset.roomId);
      if (authorizedRoomIds.has(roomId)) {
        roomAssetCounts.set(roomId, (roomAssetCounts.get(roomId) || 0) + 1);
      } else if (!asset.roomId && departmentLocationName && String(asset.location || '').trim() === departmentLocationName) {
        departmentLocationAssetCount += 1;
      }
    });

    const allLocations = rooms.map((room) => {
      const roomData = room.toJSON ? room.toJSON() : room;
      return {
        id: roomData.id,
        code: roomData.roomCode,
        name: roomData.roomName,
        campus: roomData.Campus?.campusName || null,
        campusCode: roomData.Campus?.campusCode || null,
        building: roomData.Building?.buildingName || null,
        buildingCode: roomData.Building?.buildingCode || null,
        room: roomData.roomName,
        type: roomData.roomType || 'room',
        department: departmentName,
        responsibleStaff: roomData.responsibleStaff || null,
        status: roomData.status || null,
        description: roomData.description || '',
        floor: roomData.floor ?? null,
        assetCount: roomAssetCounts.get(Number(roomData.id)) || 0,
        recordType: 'room',
      };
    });
    const departmentLocation = department.LocationRecord;
    if (departmentLocation) {
      const locationData = departmentLocation.toJSON ? departmentLocation.toJSON() : departmentLocation;
      allLocations.push({
        id: locationData.id,
        code: locationData.code || null,
        name: locationData.name,
        campus: null,
        campusCode: null,
        building: null,
        buildingCode: null,
        room: null,
        type: 'department_location',
        department: departmentName,
        responsibleStaff: null,
        status: locationData.status || null,
        description: locationData.description || '',
        floor: null,
        assetCount: departmentLocationAssetCount,
        recordType: 'department_location',
      });
    }

    allLocations.sort((left, right) => left.name.localeCompare(right.name));
    const types = [...new Set(allLocations.map((location) => String(location.type || '').trim()).filter(Boolean))].sort();
    const campuses = [...new Set(allLocations.map((location) => String(location.campus || '').trim()).filter(Boolean))].sort();
    const filteredLocations = allLocations.filter((location) => {
      const matchesStatus = !status || status === 'all' || String(location.status || '').toLowerCase() === status;
      const matchesType = !type || type === 'all' || String(location.type || '').toLowerCase() === type;
      const matchesCampus = !campus || campus === 'all' || location.campus === campus;
      const searchable = [
        location.id, location.name, location.code, location.campus, location.campusCode, location.building, location.buildingCode,
        location.room, location.type, location.department, location.responsibleStaff,
        location.description, location.status,
      ].map((value) => String(value || '').toLowerCase());
      return matchesStatus && matchesType && matchesCampus && (!search || searchable.some((value) => value.includes(search)));
    });
    const total = filteredLocations.length;
    const rows = filteredLocations.slice((page - 1) * limit, page * limit);
    const summary = {
      total: allLocations.length,
      active: allLocations.filter((location) => String(location.status || '').toLowerCase() === 'active').length,
      inactive: allLocations.filter((location) => String(location.status || '').toLowerCase() === 'inactive').length,
      locationsWithAssets: allLocations.filter((location) => Number(location.assetCount || 0) > 0).length,
    };
    return res.json({
      success: true,
      data: rows,
      department: { id: departmentData.id, name: departmentName, code: departmentData.code, collegeId: departmentData.collegeId },
      college: department?.College ? { id: department.College.id, name: department.College.collegeName, code: department.College.collegeCode } : null,
      summary,
      filters: { types, campuses },
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const listDepartmentLocationAssets = async (req, res, next) => {
  try {
    const departmentId = Number(req.organizationScope?.departmentId);
    const locationId = Number(req.params.locationId);
    const recordType = String(req.params.recordType || '').trim();
    if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account.' });
    }
    if (!Number.isSafeInteger(locationId) || locationId < 1 || !['room', 'department_location'].includes(recordType)) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }

    let locationName;
    let assetWhere = { departmentId };
    if (recordType === 'room') {
      const room = await Room.findOne({ where: { id: locationId, departmentId }, attributes: ['id', 'roomName'] });
      if (!room) return res.status(404).json({ success: false, message: 'Location not found.' });
      locationName = room.roomName;
      assetWhere = { ...assetWhere, roomId: room.id };
    } else {
      const department = await Department.findByPk(departmentId, {
        include: [{ model: Location, as: 'LocationRecord', attributes: ['id', 'name'], required: false }],
      });
      if (!department?.LocationRecord || Number(department.LocationRecord.id) !== locationId) {
        return res.status(404).json({ success: false, message: 'Location not found.' });
      }
      locationName = department.LocationRecord.name;
      assetWhere = { ...assetWhere, roomId: null, location: locationName };
    }

    const assets = await Asset.findAll({
      where: assetWhere,
      attributes: ['id', 'assetCode', 'name', 'category', 'condition', 'location', 'status'],
      order: [['name', 'ASC']],
    });
    return res.json({ success: true, data: assets, location: { id: locationId, name: locationName, recordType } });
  } catch (error) {
    return next(error);
  }
};

const dashboardKpiFields = [
  'totalAssets',
  'activeAssets',
  'damagedAssets',
  'underMaintenance',
  'availableAssets',
  'assignedAssets',
  'pendingAcquisitionRequests',
  'pendingApprovals',
  'openServiceRequests',
  'overdueTickets',
  'escalatedTickets',
  'laboratories',
];

const getDepartmentDashboardSection = (section) => async (req, res, next) => {
  let statusCode = 200;
  let dashboardResponse;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      dashboardResponse = payload;
      return this;
    },
  };

  await getDepartmentDashboard(req, response, next);
  if (!dashboardResponse) return;
  if (statusCode !== 200 || !dashboardResponse.success) {
    return res.status(statusCode).json(dashboardResponse);
  }

  const dashboard = dashboardResponse.data;
  if (section === 'kpis') {
    const data = Object.fromEntries(dashboardKpiFields.map((field) => [field, dashboard[field]]));
    data.pendingRequests = dashboard.pendingAcquisitionRequests;
    data.availableInventory = dashboard.availableAssets;
    return res.json({ success: true, data });
  }

  return res.json({ success: true, data: dashboard[section] });
};

const getDepartmentReports = async (req, res, next) => {
  try {
    const departmentId = Number(req.organizationScope?.departmentId);
    if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
      return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
    }
    const departmentScope = { departmentId, ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}) };
    const reportType = String(req.params?.reportType || req.query.reportType || 'assets').trim().toLowerCase();
    const normalizedReportType = reportType === 'inventory' ? 'assets' : reportType;
    const supportedReports = ['assets', 'utilization', 'maintenance', 'staff', 'approvals', 'inventory'];
    if (!supportedReports.includes(reportType) && !supportedReports.includes(normalizedReportType)) {
      return res.status(422).json({ success: false, message: 'Unsupported department report type' });
    }
    const effectiveReportType = normalizedReportType;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) return res.status(422).json({ success: false, message: 'Date from is invalid' });
    if (dateTo && Number.isNaN(Date.parse(dateTo))) return res.status(422).json({ success: false, message: 'Date to is invalid' });
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) return res.status(422).json({ success: false, message: 'Date from must be before date to' });

    const dateWhere = (field) => {
      if (!dateFrom && !dateTo) return {};
      const value = {};
      if (dateFrom) value[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        value[Op.lte] = endDate;
      }
      return { [field]: value };
    };

    let rows;
    let total;
    let summary = {};
    if (effectiveReportType === 'assets' || effectiveReportType === 'utilization') {
      const where = { ...departmentScope, ...dateWhere('purchaseDate') };
      if (req.query.category) where.category = String(req.query.category);
      if (req.query.location) where.location = String(req.query.location);
      if (req.query.status) {
        const status = String(req.query.status).trim().toLowerCase().replace(/[_\s]+/g, '-');
        const statusGroups = {
          'in-use': ['in-use', 'assigned', 'issued'],
          available: ['available', 'ready', 'idle'],
          'under-maintenance': ['under-maintenance', 'in-maintenance', 'maintenance', 'in-repair'],
          'in-repair': ['in-repair', 'under-maintenance', 'in-maintenance'],
          disposed: ['disposed', 'retired'],
        };
        where.status = { [Op.in]: statusGroups[status] || [status] };
      }
      if (req.query.employee) {
        const employee = `%${String(req.query.employee).trim()}%`;
        const assignedAssets = await Assignment.findAll({
          where: { departmentId, status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } },
          attributes: ['assetId'],
          include: [
            { model: Asset, where: departmentScope, attributes: [], required: true },
            {
              model: User,
              attributes: [],
              required: true,
              where: {
                [Op.or]: [
                  { fullName: { [Op.like]: employee } },
                  { username: { [Op.like]: employee } },
                ],
              },
            },
          ],
          raw: true,
        });
        where.id = { [Op.in]: assignedAssets.map((assignment) => assignment.assetId) };
      }
      if (search) where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }, { assetCode: { [Op.like]: `%${search}%` } }, { serialNumber: { [Op.like]: `%${search}%` } }];
      const result = await Asset.findAndCountAll({
        where,
        include: [{
          model: Assignment,
          where: { departmentId, status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } },
          required: false,
          include: [{ model: User, required: false, attributes: ['id', 'fullName', 'username'] }],
        }],
        order: [['updatedAt', 'DESC']],
        limit,
        offset,
        distinct: true,
      });
      rows = result.rows.map((asset) => {
        const activeAssignment = asset.Assignments?.find((assignment) => !['returned', 'cancelled', 'closed'].includes(String(assignment.status || '').toLowerCase()));
        return { ...asset.toJSON(), asset_tag: asset.assetCode, category_name: asset.category, current_value: asset.currentValue, purchase_cost: asset.purchasePrice, purchase_date: asset.purchaseDate, assigned_to_name: activeAssignment?.User?.fullName || activeAssignment?.User?.username || '' };
      });
      total = result.count;
      const allAssets = await Asset.findAll({ where, attributes: ['status', 'currentValue', 'purchasePrice', 'category', 'location'], raw: true });
      const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[_-]/g, ' ');
      const usableAssets = allAssets.filter((asset) => !['disposed', 'retired'].includes(normalize(asset.status)));
      const assignedAssets = usableAssets.filter((asset) => ['assigned', 'in use', 'issued'].includes(normalize(asset.status))).length;
      summary = {
        totalAssets: allAssets.length,
        inUse: assignedAssets,
        available: allAssets.filter((asset) => ['available', 'ready', 'idle'].includes(normalize(asset.status))).length,
        underMaintenance: allAssets.filter((asset) => normalize(asset.status).includes('maintenance') || normalize(asset.status) === 'in repair').length,
        disposed: allAssets.filter((asset) => ['disposed', 'retired'].includes(normalize(asset.status))).length,
        totalValue: allAssets.reduce((sum, asset) => sum + Number(asset.currentValue || asset.purchasePrice || 0), 0),
        byCategory: allAssets.reduce((result, asset) => { const key = asset.category || 'Other'; result[key] = (result[key] || 0) + 1; return result; }, {}),
        byLocation: allAssets.reduce((result, asset) => { const key = asset.location || 'Unknown'; result[key] = (result[key] || 0) + 1; return result; }, {}),
        utilizationRate: usableAssets.length ? Number(((assignedAssets / usableAssets.length) * 100).toFixed(2)) : 0,
      };
    } else if (effectiveReportType === 'maintenance') {
      const where = { ...dateWhere('createdAt') };
      if (req.query.status) {
        const status = String(req.query.status).trim().toLowerCase().replace(/[_\s]+/g, '-');
        const statusGroups = {
          'in-progress': ['in-progress', 'in_progress', 'in progress'],
          'in-repair': ['in-repair', 'in_repair', 'in repair'],
        };
        where.status = { [Op.in]: statusGroups[status] || [status] };
      }
      if (search) where[Op.or] = [{ title: { [Op.like]: `%${search}%` } }, { description: { [Op.like]: `%${search}%` } }];
      const result = await Maintenance.findAndCountAll({ where, include: [{ model: Asset, where: departmentScope, required: true, attributes: ['name', 'assetCode', 'location'] }], order: [['createdAt', 'DESC']], limit, offset });
      rows = result.rows.map((maintenance) => ({ ...maintenance.toJSON(), request_number: maintenance.id, asset_name: maintenance.Asset?.name, created_at: maintenance.createdAt, completion_date: maintenance.completionDate }));
      total = result.count;
      summary = { totalMaintenance: total };
    } else if (effectiveReportType === 'staff') {
      const where = { departmentId };
      if (search) where[Op.or] = [{ fullName: { [Op.like]: `%${search}%` } }, { username: { [Op.like]: `%${search}%` } }, { email: { [Op.like]: `%${search}%` } }];
      const result = await User.findAndCountAll({
        where,
        attributes: ['id', 'fullName', 'username', 'email', 'role', 'active', 'departmentId', 'createdAt'],
        order: [['fullName', 'ASC']],
        limit,
        offset,
      });
      const assignments = await Assignment.findAll({ where: { status: { [Op.notIn]: ['returned', 'cancelled', 'closed'] } }, include: [{ model: Asset, where: departmentScope, required: true, attributes: [] }], attributes: ['assignedTo'], raw: true });
      const assignedCounts = assignments.reduce((counts, assignment) => { counts[assignment.assignedTo] = (counts[assignment.assignedTo] || 0) + 1; return counts; }, {});
      rows = result.rows.map((staff) => ({ ...staff.toJSON(), assigned_assets: assignedCounts[staff.id] || 0 }));
      total = result.count;
      summary = { totalStaff: total, staffWithAssets: rows.filter((staff) => staff.assigned_assets > 0).length };
    } else {
      const where = { departmentId, ...dateWhere('createdAt') };
      if (req.query.status) where.status = String(req.query.status);
      const result = await Approval.findAndCountAll({
        where,
        include: [{ model: User, as: 'Requester', attributes: ['id', 'fullName', 'username'], required: false }],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });
      rows = result.rows.map((approval) => ({
        ...approval.toJSON(),
        request_id: approval.id,
        requested_by: approval.Requester?.fullName || approval.Requester?.username || '',
        created_at: approval.createdAt,
      }));
      total = result.count;
      summary = { totalApprovals: total, pendingApprovals: rows.filter((row) => String(row.status).toLowerCase() === 'pending').length };
    }

    const payload = {
      success: true,
      reportType: effectiveReportType,
      data: rows,
      summary,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
    if (effectiveReportType === 'assets' || effectiveReportType === 'utilization') {
      payload.assets = rows;
      payload.totals = summary;
      payload.byCategory = Object.entries(summary.byCategory || {}).map(([name, count]) => ({ name, count }));
      payload.byLocation = Object.entries(summary.byLocation || {}).map(([name, count]) => ({ name, count }));
    }
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDepartmentDashboard, getDepartmentDashboardSection, getDepartmentProfile, updateDepartmentProfile, listDepartmentAssets, listDepartmentStaff, listDepartmentLocations, listDepartmentLocationAssets, getDepartmentReports };
