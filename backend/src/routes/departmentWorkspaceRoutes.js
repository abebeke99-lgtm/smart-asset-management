const router = require('express').Router();
const { requirePermission } = require('../middlewares/auth');
const { requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const { getDepartmentDashboard, getDepartmentDashboardSection, listDepartmentAssets, listDepartmentStaff, listDepartmentLocations, listDepartmentLocationAssets, getDepartmentReports, getDepartmentProfile, updateDepartmentProfile } = require('../controllers/departmentController');
const { listRequests, getRequest, createRequest } = require('../controllers/workspaceRequestController');
const inventory = require('../controllers/inventoryController');
const assetTracking = require('../controllers/assetTrackingController');
const { lookupByQr } = require('../controllers/assetExtendedController');
const transferWorkflow = require('../controllers/transferWorkflowController');
const returnWorkflow = require('../controllers/returnWorkflowController');
const serviceRequestRoutes = require('./serviceRequestRoutes');
const notificationRoutes = require('./notificationRoutes');
const verification = require('../controllers/verificationController');
const physicalVerification = require('../controllers/departmentVerificationController');
const maintenance = require('../controllers/maintenanceRequestWorkflowController');
const laboratories = require('../controllers/departmentLaboratoryController');
const assetRequests = require('../controllers/departmentAssetRequestController');
const departmentHistory = require('../controllers/departmentHistoryController');
const tickets = require('../controllers/departmentTicketController');
const assignmentRoutes = require('./assignmentRoutes');
const { Asset } = require('../models');
const analytics = require('../controllers/departmentAnalyticsController');
const departmentNotifications = require('../controllers/departmentNotificationController');
const approvalAction = (decision) => (req, res, next) => {
  req.approvalDecision = decision;
  return assetRequests.decideApproval(req, res, next);
};
const reportFor = (reportType) => (req, res, next) => {
  req.params.reportType = reportType;
  return getDepartmentReports(req, res, next);
};
const requireScopedTrackingAsset = async (req, res, next) => {
  try {
    const asset = await Asset.findOne({
      where: {
        id: req.params.id,
        departmentId: req.organizationScope.departmentId,
        ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
      },
      attributes: ['id'],
    });
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your department' });
    return next();
  } catch (error) {
    return next(error);
  }
};

router.use(...requireDepartmentHead, resolveDepartmentScope);
router.get('/profile', requirePermission('department.profile.view'), getDepartmentProfile);
router.put('/profile', requirePermission('department.profile.update'), updateDepartmentProfile);
router.get('/reports', getDepartmentReports);
router.get('/reports/assets', reportFor('assets'));
router.get('/reports/maintenance', reportFor('maintenance'));
router.get('/reports/inventory', analytics.getReport('inventory'));
router.get('/reports/assignments', analytics.getReport('assignments'));
router.get('/reports/transfers', analytics.getReport('transfers'));
router.get('/reports/verification', analytics.getReport('verification'));
router.get('/reports/escalations', analytics.getReport('escalations'));
router.get('/staff', requirePermission('users.view'), listDepartmentStaff);
router.get('/returns', returnWorkflow.listReturns);
router.post('/returns', returnWorkflow.createReturn);
router.get('/returns/:id', returnWorkflow.getReturn);
router.post('/returns/:id/cancel', returnWorkflow.cancelReturn);
router.get('/maintenance', maintenance.getOversightList);
router.post('/maintenance', maintenance.createRequest);
router.get('/maintenance/:id', maintenance.getOversightDetail);
router.post('/maintenance/:id/cancel', maintenance.cancelRequest);
router.get('/history', departmentHistory.getDepartmentHistory);
router.get('/analytics', analytics.getAnalytics);
router.get('/analytics/assets', analytics.getAnalytics);
router.get('/analytics/inventory', analytics.getAnalytics);
router.get('/analytics/approvals', analytics.getAnalytics);
router.get('/analytics/service', analytics.getAnalytics);
router.get('/analytics/ticket-aging', analytics.getAnalytics);
const requireAssetView = requirePermission('assets.view');
router.use(requireAssetView);
router.get('/dashboard', getDepartmentDashboard);
router.get('/dashboard/kpis', getDepartmentDashboardSection('kpis'));
router.get('/dashboard/asset-status', getDepartmentDashboardSection('assetByStatus'));
router.get('/dashboard/asset-categories', getDepartmentDashboardSection('assetByCategory'));
router.get('/dashboard/service-status', getDepartmentDashboardSection('serviceRequestStatus'));
router.get('/dashboard/request-status', getDepartmentDashboardSection('acquisitionRequestStatus'));
router.get('/dashboard/recent-activities', getDepartmentDashboardSection('recentActivities'));
router.get('/assets', listDepartmentAssets);
router.get('/locations', (req, res, next) => {
  if (String(req.query.export || '').toLowerCase() !== 'true') return next();
  return requirePermission('reports.export')(req, res, next);
}, listDepartmentLocations);
router.get('/locations/:recordType/:locationId/assets', listDepartmentLocationAssets);
router.get('/laboratories', laboratories.listLaboratories);
router.get('/laboratories/:id', laboratories.getLaboratoryDashboard);
router.get('/asset-history', requirePermission('department_head.history.view'), departmentHistory.getDepartmentAssetHistory);
router.get('/inventory', requirePermission('assets.view'), inventory.getInventory);
router.get('/requests', listRequests);
router.post('/requests', createRequest);
router.get('/requests/:id', getRequest);
router.get('/asset-requests', assetRequests.listRequests);
router.post('/asset-requests', assetRequests.createRequest);
router.get('/asset-requests/:id', assetRequests.getRequest);
router.post('/asset-requests/:id/submit', assetRequests.submitDraft);
router.get('/approvals', requirePermission('department_head.approvals.review'), assetRequests.listApprovalQueue);
router.get('/approvals/:id', requirePermission('department_head.approvals.review'), assetRequests.getApprovalReview);
router.post('/approvals/:id/approve', requirePermission('department_head.approvals.approve'), approvalAction('approve'));
router.post('/approvals/:id/reject', requirePermission('department_head.approvals.reject'), approvalAction('reject'));
router.post('/approvals/:id/request-changes', requirePermission('department_head.approvals.request_changes'), approvalAction('request-changes'));
router.post('/approvals/:id/escalate', requirePermission('department_head.approvals.escalate'), approvalAction('escalate'));
router.get('/verification/history', physicalVerification.listVerifications);
router.post('/verification/records', physicalVerification.createVerification);
router.get('/verification', verification.listSessions);
router.post('/verification', verification.createSession);
router.get('/verification/:id', verification.getSession);
router.post('/verification/:id/items', verification.addItem);
router.post('/verification/:id/submit', verification.submitSession);
router.post('/verification/:id/finalize', verification.finalizeSession);
router.get('/maintenance-requests', maintenance.listRequests);
router.post('/maintenance-requests', maintenance.createRequest);
router.get('/transfers', requirePermission('assets.view'), transferWorkflow.listTransfers);
router.post('/transfers', requirePermission('assets.transfer'), transferWorkflow.createTransfer);
router.get('/transfers/:id', requirePermission('assets.view'), transferWorkflow.getTransfer);
router.post('/transfers/:id/cancel', requirePermission('assets.transfer'), transferWorkflow.cancelTransfer);
router.post('/transfers/:id/receive', requirePermission('assets.transfer'), transferWorkflow.receiveTransfer);
router.get('/tracking/scan/:identifier', requirePermission('assets.view'), lookupByQr);
router.get('/tracking/:id/location', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getLocation);
router.post('/tracking/:id/verify-location', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.verifyLocation);
router.get('/tracking/:id/assignments', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getAssignments);
router.post('/tracking/:id/verify-assignment', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.verifyAssignment);
router.get('/tracking/:id/transfers', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getTransfers);
router.get('/tracking/:id/maintenance', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getMaintenance);
router.use('/service-requests', serviceRequestRoutes);
router.get('/tickets', tickets.listTickets);
router.get('/escalated-tickets', tickets.listEscalatedTickets);
router.get('/tickets/escalated', tickets.listEscalatedTickets);
router.post('/tickets/:id/follow-up', tickets.addTicketFollowUp);
router.get('/tickets/:id', tickets.getTicket);
router.use('/assignments', requirePermission('assets.view'), assignmentRoutes);
router.post('/notifications', requirePermission('department_head.notifications.create'), departmentNotifications.createDepartmentNotification);
router.use(notificationRoutes);

module.exports = router;
