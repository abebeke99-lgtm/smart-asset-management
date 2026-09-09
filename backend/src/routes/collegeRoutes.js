const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope } = require('../middlewares/organizationScope');
const { getCollegeDashboard, getCollegeProfile, listCollegeDepartments, listCollegeStaff, listCollegeAssets, createCollegeDepartment, updateCollegeDepartment, updateCollegeDepartmentStatus, getCollegeDepartmentDetails, listCollegeDepartmentStaff, listCollegeDepartmentAssets } = require('../controllers/collegeController');
const { listRequests, getRequest, decideRequest } = require('../controllers/workspaceRequestController');
const verification = require('../controllers/verificationController');
const maintenance = require('../controllers/maintenanceRequestWorkflowController');

const router = express.Router();

router.use(...requireCollegeManager, resolveCollegeScope);
router.get('/dashboard', getCollegeDashboard);
router.get('/profile', getCollegeProfile);
router.get('/departments', listCollegeDepartments);
router.post('/departments', createCollegeDepartment);
router.get('/departments/:id/staff', listCollegeDepartmentStaff);
router.get('/departments/:id/assets', listCollegeDepartmentAssets);
router.get('/departments/:id', getCollegeDepartmentDetails);
router.put('/departments/:id', updateCollegeDepartment);
router.patch('/departments/:id/status', updateCollegeDepartmentStatus);
router.get('/approvals', listRequests);
router.get('/approvals/:id', getRequest);
router.post('/approvals/:id/approve', (req, res, next) => { req.body.decision = 'approved'; return decideRequest(req, res, next); });
router.post('/approvals/:id/reject', (req, res, next) => { req.body.decision = 'rejected'; return decideRequest(req, res, next); });
router.post('/approvals/:id/request-changes', (req, res, next) => { req.body.decision = 'changes_requested'; return decideRequest(req, res, next); });
router.get('/verification', verification.listSessions);
router.post('/verification', verification.createSession);
router.get('/verification/:id', verification.getSession);
router.post('/verification/:id/items', verification.addItem);
router.post('/verification/:id/submit', verification.submitSession);
router.post('/verification/:id/finalize', verification.finalizeSession);
router.get('/maintenance', maintenance.listRequests);
router.get('/maintenance/:id', maintenance.getRequest);
router.get('/staff', listCollegeStaff);
router.get('/assets', listCollegeAssets);

module.exports = router;
