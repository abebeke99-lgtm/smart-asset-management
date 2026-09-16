const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope } = require('../middlewares/organizationScope');
const { getCollegeDashboard, getCollegeProfile, updateCollegeProfile, listCollegeDepartments, getCollegeDepartmentOverview, getCollegeDepartmentPerformance, getCollegeDepartmentReports, listCollegeStaff, listCollegeAssets, getCollegeInventory, getCollegeAsset, listCollegeLocations, createCollegeDepartment, updateCollegeDepartment, updateCollegeDepartmentStatus, deleteCollegeDepartment, getCollegeDepartmentDetails, listCollegeDepartmentStaff, listCollegeDepartmentAssets, listCollegeAssignments, listCollegeMaintenance, getCollegeMaintenance, listCollegeVerification, getCollegeReports, getCollegeAssetAnalytics, listCollegeRFIDTracking } = require('../controllers/collegeController');
const { listRequests, getRequest, decideRequest, listCollegeRequests, getCollegeRequest, listCollegeDepartmentRequests } = require('../controllers/workspaceRequestController');
const verification = require('../controllers/verificationController');

const router = express.Router();
const { Op } = require('sequelize');
const { Notification } = require('../models');

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
    userId: value.userId ?? null,
    collegeId: value.collegeId ?? null,
    departmentId: value.departmentId ?? null,
    referenceId: value.referenceId ?? value.reference_id ?? null,
    referenceType: value.referenceType ?? value.reference_type ?? null,
    actionUrl: value.actionUrl ?? value.action_url ?? null,
  };
};

const buildCollegeNotificationScope = (req) => ({
  [Op.or]: [
    { userId: req.user.id },
    { collegeId: req.organizationScope.collegeId },
    { userId: null, collegeId: { [Op.or]: [null, req.organizationScope.collegeId] } },
  ],
});

router.use(...requireCollegeManager, resolveCollegeScope);
router.get('/dashboard', getCollegeDashboard);
router.get('/profile', getCollegeProfile);
router.put('/profile', updateCollegeProfile);
router.get('/departments', listCollegeDepartments);
router.post('/departments', createCollegeDepartment);
router.get('/department-overview', getCollegeDepartmentOverview);
router.get('/department-performance', getCollegeDepartmentPerformance);
router.get('/analytics/departments', getCollegeDepartmentReports);
router.get('/department-assets', listCollegeDepartmentAssets);
router.get('/departments/:id/staff', listCollegeDepartmentStaff);
router.get('/departments/:id/assets', listCollegeDepartmentAssets);
router.get('/departments/:id', getCollegeDepartmentDetails);
router.put('/departments/:id', updateCollegeDepartment);
router.patch('/departments/:id/status', updateCollegeDepartmentStatus);
router.delete('/departments/:id', deleteCollegeDepartment);
router.get('/requests', listCollegeRequests);
router.get('/requests/:id', getCollegeRequest);
router.get('/department-requests', listCollegeDepartmentRequests);
router.get('/approvals', listCollegeRequests);
router.get('/approvals/:id', getCollegeRequest);
router.get('/assignments', listCollegeAssignments);
router.post('/approvals/:id/approve', (req, res, next) => { req.body.decision = 'approved'; return decideRequest(req, res, next); });
router.post('/approvals/:id/reject', (req, res, next) => { req.body.decision = 'rejected'; return decideRequest(req, res, next); });
router.post('/approvals/:id/request-changes', (req, res, next) => { req.body.decision = 'changes_requested'; return decideRequest(req, res, next); });
router.get('/verification', listCollegeVerification);
router.post('/verification', verification.createSession);
router.get('/verification/:id', verification.getSession);
router.post('/verification/:id/items', verification.addItem);
router.post('/verification/:id/submit', verification.submitSession);
router.post('/verification/:id/finalize', verification.finalizeSession);
router.get('/maintenance', listCollegeMaintenance);
router.get('/maintenance/:id', getCollegeMaintenance);
router.get('/notifications', async (req, res, next) => {
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

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { userId: req.user.id },
          { collegeId: req.organizationScope.collegeId },
          { userId: null, collegeId: { [Op.or]: [null, req.organizationScope.collegeId] } },
        ],
      },
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

router.patch('/notifications/read-all', async (req, res, next) => {
  try {
    const where = {
      read: false,
      [Op.or]: [
        { userId: req.user.id },
        { collegeId: req.organizationScope.collegeId },
        { userId: null, collegeId: { [Op.or]: [null, req.organizationScope.collegeId] } },
      ],
    };
    const result = await Notification.update({ read: true, readAt: new Date() }, { where });
    return res.json({ success: true, updated: result[0] || 0 });
  } catch (error) {
    return next(error);
  }
});

router.delete('/notifications/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      where: {
        id: req.params.id,
        [Op.or]: [
          { userId: req.user.id },
          { collegeId: req.organizationScope.collegeId },
          { userId: null, collegeId: { [Op.or]: [null, req.organizationScope.collegeId] } },
        ],
      },
    });
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found or not authorized for this college.' });
    }
    await notification.destroy();
    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    return next(error);
  }
});
router.get('/reports', getCollegeReports);
router.get('/analytics/assets', getCollegeAssetAnalytics);
router.get('/staff', listCollegeStaff);
router.get('/assets', listCollegeAssets);
router.get('/inventory', getCollegeInventory);
router.get('/rfid', listCollegeRFIDTracking);
router.get('/assets/:id', getCollegeAsset);
router.get('/locations', listCollegeLocations);

module.exports = router;
