const express = require('express');
const { requireAuth, requireActiveAccount, requireRole, requirePermission } = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope } = require('../middlewares/organizationScope');
const { getCollegeDashboard, getCollegeProfile, updateCollegeProfile, listCollegeDepartments, getCollegeDepartmentOverview, getCollegeDepartmentPerformance, getCollegeDepartmentReports, listCollegeAssets, getCollegeInventory, getCollegeAssetRegistrationOptions, getCollegeAsset, listCollegeLocations, getCollegeLocation, createCollegeLocation, updateCollegeLocation, deleteCollegeLocation, createCollegeDepartment, updateCollegeDepartment, updateCollegeDepartmentStatus, deleteCollegeDepartment, getCollegeDepartmentDetails, listCollegeDepartmentStaff, listCollegeDepartmentAssets, listCollegeAssignments, getCollegeAssignmentOptions, listCollegeMaintenance, getCollegeMaintenance, listCollegeVerification, getCollegeReports, getCollegeAssetAnalytics, listCollegeRFIDTracking, lookupCollegeTrackingCode, recordCollegeTrackingScan, assignCollegeTrackingTags, regenerateCollegeQr } = require('../controllers/collegeController');
const { listRequests, getRequest, decideRequest, listCollegeRequests, getCollegeRequest, listCollegeDepartmentRequests } = require('../controllers/workspaceRequestController');
const verification = require('../controllers/verificationController');
const { getAssetHistory, createAsset, updateAsset } = require('../controllers/assetController');
const { Asset } = require('../models');
const { listAssetDocuments, uploadAssetDocument, deleteAssetDocument, downloadAssetDocument, createAssetCustody, endCustody } = require('../controllers/assetExtendedController');
const collegeAssetRequests = require('../controllers/collegeAssetRequestController');
const collegeStaff = require('../controllers/collegeStaffController');

const router = express.Router();
const { Op } = require('sequelize');
const { Notification, NotificationDelivery, sequelize } = require('../models');
const { createAuditLog } = require('../services/auditLogService');
const { normalizeRoleForStorage } = require('../constants/rolePermissions');

const normalizeNotification = (notification) => {
  const value = notification && typeof notification.toJSON === 'function' ? notification.toJSON() : notification || {};
  return {
    id: value.id,
    title: value.title || 'Notification',
    message: value.message || '',
    type: value.type || 'system',
    priority: value.priority || 'medium',
    status: value.status || (value.read ? 'read' : 'sent'),
    read: Boolean(value.read),
    isRead: Boolean(value.read),
    createdAt: value.createdAt || value.created_at || null,
    readAt: value.readAt || value.read_at || null,
    referenceId: value.referenceId ?? value.reference_id ?? null,
    referenceType: value.referenceType ?? value.reference_type ?? null,
    actionUrl: value.actionUrl ?? value.action_url ?? null,
  };
};

const buildCollegeNotificationScope = (req) => ({
  [Op.or]: [
    { userId: req.user.id },
    { recipientId: req.user.id },
    { scope: 'GLOBAL' },
    { scope: 'COLLEGE', collegeId: req.organizationScope.collegeId },
    { scope: 'ROLE', role: normalizeRoleForStorage(req.user.role) },
    {
      userId: null,
      recipientId: null,
      collegeId: { [Op.or]: [null, req.organizationScope.collegeId] },
    },
  ],
});

const requireCollegeAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ where: { id: req.params.id, collegeId: req.organizationScope.collegeId }, attributes: ['id'] });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your college' });
    return next();
  } catch (error) {
    return next(error);
  }
};

router.use(requireAuth, requireActiveAccount, requireRole('college_manager', 'college'), resolveCollegeScope);
router.get('/dashboard', requirePermission('college.dashboard.view'), getCollegeDashboard);
router.get('/profile', requirePermission('college.profile.view'), getCollegeProfile);
router.put('/profile', requirePermission('college.profile.update'), updateCollegeProfile);
router.get('/departments', requirePermission('college.departments.view'), listCollegeDepartments);
router.post('/departments', requirePermission('college.departments.manage'), createCollegeDepartment);
router.get('/department-overview', requirePermission('college.departments.view'), getCollegeDepartmentOverview);
router.get('/department-performance', requirePermission('college.departments.view'), getCollegeDepartmentPerformance);
router.get('/analytics/departments', requirePermission('college.departments.view'), getCollegeDepartmentReports);
router.get('/department-assets', requirePermission('college.departments.view'), listCollegeDepartmentAssets);
router.get('/departments/:id/staff', requirePermission('college.staff.view'), listCollegeDepartmentStaff);
router.get('/departments/:id/assets', requirePermission('college.departments.view'), listCollegeDepartmentAssets);
router.get('/departments/:id', requirePermission('college.departments.view'), getCollegeDepartmentDetails);
router.put('/departments/:id', requirePermission('college.departments.manage'), updateCollegeDepartment);
router.patch('/departments/:id/status', requirePermission('college.departments.manage'), updateCollegeDepartmentStatus);
router.delete('/departments/:id', requirePermission('college.departments.manage'), deleteCollegeDepartment);
router.get('/requests', requirePermission('college.requests.view'), collegeAssetRequests.list);
router.get('/requests/options', requireRole('college_manager'), requirePermission('college.requests.create'), collegeAssetRequests.options);
router.post('/requests', requireRole('college_manager'), requirePermission('college.requests.create'), collegeAssetRequests.create);
router.get('/requests/:id', requirePermission('college.requests.view'), collegeAssetRequests.detail);
router.put('/requests/:id', requireRole('college_manager'), requirePermission('college.requests.update'), collegeAssetRequests.update);
router.post('/requests/:id/cancel', requireRole('college_manager'), requirePermission('college.requests.cancel'), collegeAssetRequests.cancel);
router.post('/requests/:id/approve', requireRole('college_manager'), requirePermission('college.approvals.approve'), collegeAssetRequests.decide('approve'));
router.post('/requests/:id/reject', requireRole('college_manager'), requirePermission('college.approvals.reject'), collegeAssetRequests.decide('reject'));
router.post('/requests/:id/request-changes', requireRole('college_manager'), requirePermission('college.approvals.request_changes'), collegeAssetRequests.decide('requestChanges'));
router.get('/department-requests', requirePermission('college.requests.view'), listCollegeDepartmentRequests);
router.get('/approvals', requirePermission('college.approvals.view'), listCollegeRequests);
router.get('/approvals/:id', requirePermission('college.approvals.view'), getCollegeRequest);
router.get('/assignments', requirePermission('college.assignments.view'), listCollegeAssignments);
router.get('/assignment-options', requireRole('college_manager'), requirePermission('college.assignments.manage'), getCollegeAssignmentOptions);
router.get('/rfid', requirePermission('college.rfid.view'), listCollegeRFIDTracking);
router.get('/rfid/lookup/:code', requirePermission('college.rfid.view'), lookupCollegeTrackingCode);
router.post('/rfid/scan', requireRole('college_manager'), requirePermission('college.rfid.view'), recordCollegeTrackingScan);
router.post('/rfid/assets/:id/tags', requireRole('college_manager'), requirePermission('college.assets.update'), assignCollegeTrackingTags);
router.post('/rfid/assets/:id/qr/regenerate', requireRole('college_manager'), requirePermission('college.assets.update'), regenerateCollegeQr);
router.post('/approvals/:id/approve', requirePermission('college.approvals.approve'), (req, res, next) => { req.body.decision = 'approved'; return decideRequest(req, res, next); });
router.post('/approvals/:id/reject', requirePermission('college.approvals.reject'), (req, res, next) => { req.body.decision = 'rejected'; return decideRequest(req, res, next); });
router.post('/approvals/:id/request-changes', requirePermission('college.approvals.request_changes'), (req, res, next) => { req.body.decision = 'changes_requested'; return decideRequest(req, res, next); });
router.get('/verification', requirePermission('college.verification.view'), listCollegeVerification);
router.post('/verification', requirePermission('college.verification.manage'), verification.createSession);
router.get('/verification/:id', requirePermission('college.verification.view'), verification.getSession);
router.post('/verification/:id/items', requirePermission('college.verification.manage'), verification.addItem);
router.post('/verification/:id/submit', requirePermission('college.verification.manage'), verification.submitSession);
router.post('/verification/:id/finalize', requirePermission('college.verification.manage'), verification.finalizeSession);
router.get('/maintenance', requirePermission('college.maintenance.view'), listCollegeMaintenance);
router.get('/maintenance/:id', requirePermission('college.maintenance.view'), getCollegeMaintenance);
router.get('/notifications', requirePermission('college.notifications.view'), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || '').trim();
    const readParam = String(req.query.read || '').trim().toLowerCase();
    const status = String(req.query.status || '').trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateToRaw = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const dateTo = dateToRaw ? new Date(dateToRaw.getTime() + (23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999)) : null;
    const filters = [buildCollegeNotificationScope(req)];

    if (search) {
      filters.push({ [Op.or]: [{ title: { [Op.like]: `%${search}%` } }, { message: { [Op.like]: `%${search}%` } }, { type: { [Op.like]: `%${search}%` } }] });
    }

    if (type) {
      filters.push({ type: { [Op.like]: `%${type}%` } });
    }

    if (readParam === 'read') {
      filters.push({ read: true });
    }

    if (readParam === 'unread') {
      filters.push({ read: false });
    }

    if (status) {
      filters.push({ status: { [Op.like]: `%${status}%` } });
    }

    if (dateFrom) {
      filters.push({ createdAt: { [Op.gte]: dateFrom } });
    }

    if (dateTo) {
      filters.push({ createdAt: { [Op.lte]: dateTo } });
    }

    const where = filters.length > 1 ? { [Op.and]: filters } : filters[0];
    const { count, rows } = await Notification.findAndCountAll({ where, order: [['createdAt', 'DESC']], limit, offset: (page - 1) * limit });
    const normalized = rows.map(normalizeNotification);
    const summary = {
      total: count,
      unread: await Notification.count({ where: { ...where, read: false } }),
      read: await Notification.count({ where: { ...where, read: true } }),
    };
    return res.json({ success: true, data: normalized, notifications: normalized, summary, pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/notifications/:id/read', requirePermission('college.notifications.view'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    }
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildCollegeNotificationScope(req)] },
    });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found or not authorized for this college.' });
    }
    await notification.update({ read: true, readAt: new Date() });
    const payload = normalizeNotification(notification);
    return res.json({ success: true, data: payload, notification: payload });
  } catch (error) {
    return next(error);
  }
});

router.patch('/notifications/read-all', requirePermission('college.notifications.view'), async (req, res, next) => {
  try {
    const where = {
      [Op.and]: [{ read: false }, buildCollegeNotificationScope(req)],
    };
    const result = await Notification.update({ read: true, readAt: new Date() }, { where });
    return res.json({ success: true, updated: result[0] || 0 });
  } catch (error) {
    return next(error);
  }
});

router.delete('/notifications/:id', requirePermission('notifications.delete'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Notification ID must be a positive integer' });
    }
    const transaction = await sequelize.transaction();
    try {
    const notification = await Notification.findOne({
      where: { [Op.and]: [{ id }, buildCollegeNotificationScope(req)] },
      transaction,
    });
    if (!notification) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Notification not found or not authorized for this college.' });
    }
    const oldValue = { title: notification.title, type: notification.type, scope: notification.scope };
    const deliveryRecordsDeleted = await NotificationDelivery.destroy({ where: { notificationId: id }, transaction });
    await notification.destroy({ transaction });
    await createAuditLog({
      userId: req.user.id,
      role: req.user.role,
      action: 'NOTIFICATION_DELETED',
      entity: `notification:${id}`,
      entityId: id,
      oldValue,
      details: { deliveryRecordsDeleted },
      transaction,
    });
    await transaction.commit();
    return res.json({ success: true, message: 'Notification deleted.' });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});
router.get('/reports', requirePermission('college.reports.view'), getCollegeReports);
router.get('/analytics/assets', requirePermission('college.analytics.view'), getCollegeAssetAnalytics);
router.get('/staff', requirePermission('college.staff.view'), collegeStaff.list);
router.get('/staff/options', requirePermission('college.staff.view'), collegeStaff.options);
router.get('/staff/:id/assignment-options', requireRole('college_manager'), requirePermission('college.assignments.manage'), collegeStaff.assignmentOptions);
router.get('/staff/:id', requirePermission('college.staff.view'), collegeStaff.detail);
router.post('/staff', requireRole('college_manager'), requirePermission('college.staff.manage'), collegeStaff.create);
router.put('/staff/:id', requireRole('college_manager'), requirePermission('college.staff.manage'), collegeStaff.update);
router.patch('/staff/:id/status', requireRole('college_manager'), requirePermission('college.staff.manage'), collegeStaff.setStatus);
router.get('/assets', requirePermission('college.assets.view'), listCollegeAssets);
router.get('/assets/registration-options', requirePermission('college.assets.view'), getCollegeAssetRegistrationOptions);
router.post('/assets', requireRole('college_manager'), requirePermission('college.assets.create'), createAsset);
router.put('/assets/:id', requireRole('college_manager'), requirePermission('college.assets.update'), updateAsset);
router.post('/assets/:id/custody', requireRole('college_manager'), requirePermission('college.assignments.manage'), requireCollegeAsset, createAssetCustody);
router.post('/assets/:id/custody/:custodyId/end', requireRole('college_manager'), requirePermission('college.assignments.manage'), requireCollegeAsset, endCustody);
router.get('/inventory', requirePermission('college.inventory.view'), getCollegeInventory);
router.get('/assets/:id/history', requirePermission('college.history.view'), getAssetHistory);
router.get('/assets/:id/documents', requirePermission('college.assets.view'), requireCollegeAsset, listAssetDocuments);
router.post('/assets/:id/documents', requirePermission('college.documents.manage'), requireCollegeAsset, uploadAssetDocument);
router.delete('/assets/:id/documents/:documentId', requirePermission('college.documents.manage'), requireCollegeAsset, deleteAssetDocument);
router.get('/assets/:id/documents/:documentId/file', requirePermission('college.assets.view'), requireCollegeAsset, downloadAssetDocument);
router.get('/assets/:id', requirePermission('college.assets.view'), getCollegeAsset);
router.get('/locations', requirePermission('college.locations.view'), listCollegeLocations);
router.get('/locations/:id', requirePermission('college.locations.view'), getCollegeLocation);
router.post('/locations', requirePermission('college.locations.manage'), createCollegeLocation);
router.put('/locations/:id', requirePermission('college.locations.manage'), updateCollegeLocation);
router.delete('/locations/:id', requirePermission('college.locations.manage'), deleteCollegeLocation);

module.exports = router;
