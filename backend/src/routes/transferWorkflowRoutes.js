const router = require('express').Router();
const { requirePermission } = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope, requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const workflow = require('../controllers/transferWorkflowController');

const college = router;
college.get('/college/transfers', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.view'), workflow.listTransfers);
college.get('/college/transfers/:id', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.view'), workflow.getTransfer);
college.post('/college/transfers/:id/approve', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.manage'), workflow.approveTransfer);
college.post('/college/transfers/:id/reject', ...requireCollegeManager, resolveCollegeScope, requirePermission('college.transfers.manage'), workflow.rejectTransfer);
college.get('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.listTransfers);
college.post('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.createTransfer);
college.get('/department/transfers/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getTransfer);
college.post('/department/transfers/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelTransfer);
college.get('/department-head/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.listTransfers);
college.post('/department-head/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.createTransfer);
college.get('/department-head/transfers/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getTransfer);
college.post('/department-head/transfers/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelTransfer);
college.get('/store/transfers', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), resolveCollegeScope, workflow.listTransfers);
college.post('/store/transfers/:id/ready', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), resolveCollegeScope, workflow.readyTransfer);
college.post('/store/transfers/:id/dispatch', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), resolveCollegeScope, workflow.dispatchTransfer);
college.post('/store/transfers/:id/receive', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), resolveCollegeScope, workflow.receiveTransfer);

module.exports = college;
