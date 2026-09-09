const router = require('express').Router();
const { requireCollegeManager, resolveCollegeScope, requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const workflow = require('../controllers/transferWorkflowController');

const college = router;
college.get('/college/transfers', ...requireCollegeManager, resolveCollegeScope, workflow.listTransfers);
college.get('/college/transfers/:id', ...requireCollegeManager, resolveCollegeScope, workflow.getTransfer);
college.post('/college/transfers/:id/approve', ...requireCollegeManager, resolveCollegeScope, workflow.approveTransfer);
college.post('/college/transfers/:id/reject', ...requireCollegeManager, resolveCollegeScope, workflow.rejectTransfer);
college.get('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.listTransfers);
college.post('/department/transfers', ...requireDepartmentHead, resolveDepartmentScope, workflow.createTransfer);
college.get('/department/transfers/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getTransfer);
college.post('/department/transfers/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelTransfer);
college.get('/store/transfers', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), workflow.listTransfers);
college.post('/store/transfers/:id/ready', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), workflow.readyTransfer);
college.post('/store/transfers/:id/dispatch', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), workflow.dispatchTransfer);
college.post('/store/transfers/:id/receive', require('../middlewares/auth').requireAuth, require('../middlewares/auth').requireRole('store_manager'), workflow.receiveTransfer);

module.exports = college;
