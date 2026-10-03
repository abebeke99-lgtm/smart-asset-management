const router = require('express').Router();
const { requirePermission, requireAuth, requireRole } = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope, requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const workflow = require('../controllers/transferWorkflowController');

const college = router;
college.get('/college/transfers', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.view'), workflow.listTransfers);
college.get('/college/transfers/:id', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.view'), workflow.getTransfer);
college.post('/college/transfers/:id/approve', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.manage'), requirePermission('assets.transfer.approve'), workflow.approveTransfer);
college.post('/college/transfers/:id/reject', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.manage'), requirePermission('assets.transfer.approve'), workflow.rejectTransfer);
college.get('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.view'), workflow.listTransfers);
college.post('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.transfer'), workflow.createTransfer);
college.get('/department/transfers/:id', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.view'), workflow.getTransfer);
college.post('/department/transfers/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.transfer'), workflow.cancelTransfer);
college.get('/department-head/transfers', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.view'), workflow.listTransfers);
college.post('/department-head/transfers', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.transfer'), workflow.createTransfer);
college.get('/department-head/transfers/:id', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.view'), workflow.getTransfer);
college.post('/department-head/transfers/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, requirePermission('assets.transfer'), workflow.cancelTransfer);
college.get('/store/transfers', requireAuth, requireRole('store_manager'), resolveCollegeScope, workflow.listTransfers);
college.post('/store/transfers/:id/ready', requireAuth, requireRole('store_manager'), resolveCollegeScope, workflow.readyTransfer);
college.post('/store/transfers/:id/dispatch', requireAuth, requireRole('store_manager'), resolveCollegeScope, workflow.dispatchTransfer);
college.post('/store/transfers/:id/receive', requireAuth, requireRole('store_manager'), resolveCollegeScope, workflow.receiveTransfer);

module.exports = college;
