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
router.use(requirePermission('assets.view'));
router.get('/profile', requirePermission('department.profile.view'), getDepartmentProfile);
router.put('/profile', requirePermission('department.profile.update'), updateDepartmentProfile);
router.get('/dashboard', getDepartmentDashboard);
router.get('/dashboard/kpis', getDepartmentDashboardSection('kpis'));
router.get('/dashboard/asset-status', getDepartmentDashboardSection('assetByStatus'));
router.get('/dashboard/asset-categories', getDepartmentDashboardSection('assetByCategory'));
router.get('/dashboard/service-status', getDepartmentDashboardSection('serviceRequestStatus'));
router.get('/dashboard/request-status', getDepartmentDashboardSection('acquisitionRequestStatus'));
router.get('/dashboard/recent-activities', getDepartmentDashboardSection('recentActivities'));
router.get('/assets', listDepartmentAssets);
router.get('/staff', listDepartmentStaff);
router.get('/locations', (req, res, next) => {
  if (String(req.query.export || '').toLowerCase() !== 'true') return next();
  return requirePermission('reports.export')(req, res, next);
}, listDepartmentLocations);
router.get('/locations/:recordType/:locationId/assets', listDepartmentLocationAssets);
router.get('/laboratories', laboratories.listLaboratories);
router.get('/laboratories/:id', laboratories.getLaboratoryDashboard);
router.get('/reports', requirePermission('department_head.reports.view'), getDepartmentReports);
router.get('/reports/assets', requirePermission('department_head.reports.view'), reportFor('assets'));
router.get('/reports/maintenance', requirePermission('department_head.reports.view'), reportFor('maintenance'));
router.get('/reports/inventory', requirePermission('department_head.reports.view'), analytics.getReport('inventory'));
router.get('/reports/assignments', requirePermission('department_head.reports.view'), analytics.getReport('assignments'));
router.get('/reports/transfers', requirePermission('department_head.reports.view'), analytics.getReport('transfers'));
router.get('/reports/verification', requirePermission('department_head.reports.view'), analytics.getReport('verification'));
router.get('/reports/escalations', requirePermission('department_head.reports.view'), analytics.getReport('escalations'));
router.get('/analytics', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/analytics/assets', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/analytics/inventory', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/analytics/approvals', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/analytics/service', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/analytics/ticket-aging', requirePermission('department_head.analytics.view'), analytics.getAnalytics);
router.get('/history', requirePermission('department_head.history.view'), departmentHistory.getDepartmentHistory);
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
router.get('/maintenance', requirePermission('department_head.maintenance.view'), maintenance.getOversightList);
router.post('/maintenance', requirePermission('department_head.maintenance.view'), maintenance.createRequest);
router.get('/maintenance/:id', requirePermission('department_head.maintenance.view'), maintenance.getOversightDetail);
router.post('/maintenance/:id/cancel', requirePermission('department_head.maintenance.view'), maintenance.cancelRequest);
router.get('/maintenance-requests', maintenance.listRequests);
router.post('/maintenance-requests', maintenance.createRequest);
router.get('/transfers', requirePermission('assets.view'), transferWorkflow.listTransfers);
router.post('/transfers', requirePermission('assets.transfer'), transferWorkflow.createTransfer);
router.get('/transfers/:id', requirePermission('assets.view'), transferWorkflow.getTransfer);
router.post('/transfers/:id/cancel', requirePermission('assets.transfer'), transferWorkflow.cancelTransfer);
router.post('/transfers/:id/receive', requirePermission('assets.transfer'), transferWorkflow.receiveTransfer);
router.get('/returns', requirePermission('department_head.returns.view'), returnWorkflow.listReturns);
router.post('/returns', requirePermission('department_head.returns.manage'), returnWorkflow.createReturn);
router.get('/returns/:id', requirePermission('department_head.returns.view'), returnWorkflow.getReturn);
router.post('/returns/:id/cancel', requirePermission('department_head.returns.manage'), returnWorkflow.cancelReturn);
router.get('/tracking/scan/:identifier', requirePermission('assets.view'), lookupByQr);
router.get('/tracking/:id/location', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getLocation);
router.post('/tracking/:id/verify-location', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.verifyLocation);
router.get('/tracking/:id/assignments', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getAssignments);
router.post('/tracking/:id/verify-assignment', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.verifyAssignment);
router.get('/tracking/:id/transfers', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getTransfers);
router.get('/tracking/:id/maintenance', requirePermission('assets.view'), requireScopedTrackingAsset, assetTracking.getMaintenance);
router.use('/service-requests', serviceRequestRoutes);
router.get('/tickets', requirePermission('department_head.tickets.view'), tickets.listTickets);
router.get('/escalated-tickets', requirePermission('department_head.tickets.view'), tickets.listEscalatedTickets);
router.get('/tickets/escalated', requirePermission('department_head.tickets.view'), tickets.listEscalatedTickets);
router.post('/tickets/:id/follow-up', requirePermission('department_head.tickets.follow_up'), tickets.addTicketFollowUp);
router.get('/tickets/:id', requirePermission('department_head.tickets.view'), tickets.getTicket);
router.use('/assignments', requirePermission('assets.view'), assignmentRoutes);
router.post('/notifications', requirePermission('department_head.notifications.create'), departmentNotifications.createDepartmentNotification);
router.use(notificationRoutes);

module.exports = router;
