const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope, requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const workflow = require('../controllers/returnWorkflowController');

router.get('/college/returns', ...requireCollegeManager, resolveCollegeScope, auth.requirePermission('college.returns.view'), workflow.listReturns);
router.get('/college/returns/:id', ...requireCollegeManager, resolveCollegeScope, auth.requirePermission('college.returns.view'), workflow.getReturn);
router.post('/college/returns/:id/approve', ...requireCollegeManager, resolveCollegeScope, auth.requirePermission('college.returns.manage'), workflow.approveReturn);
router.post('/college/returns/:id/reject', ...requireCollegeManager, resolveCollegeScope, auth.requirePermission('college.returns.manage'), workflow.rejectReturn);
router.get('/department/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.listReturns);
router.post('/department/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.createReturn);
router.get('/department/returns/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getReturn);
router.post('/department/returns/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelReturn);
router.get('/department-head/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.listReturns);
router.post('/department-head/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.createReturn);
router.get('/department-head/returns/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getReturn);
router.post('/department-head/returns/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelReturn);
router.get('/store/returns', auth.requireAuth, auth.requireRole('store_manager'), resolveCollegeScope, workflow.listReturns);
router.post('/store/returns', auth.requireAuth, auth.requireRole('store_manager'), resolveCollegeScope, workflow.processStoreReturn);
router.post('/store/returns/:id/receive', auth.requireAuth, auth.requireRole('store_manager'), resolveCollegeScope, workflow.receiveReturn);
router.post('/store/returns/:id/inspect', auth.requireAuth, auth.requireRole('store_manager'), resolveCollegeScope, workflow.inspectReturn);

module.exports = router;
