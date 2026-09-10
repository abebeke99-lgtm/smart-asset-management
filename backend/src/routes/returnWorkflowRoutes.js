const router = require('express').Router();
const auth = require('../middlewares/auth');
const { requireCollegeManager, resolveCollegeScope, requireDepartmentHead, resolveDepartmentScope } = require('../middlewares/organizationScope');
const workflow = require('../controllers/returnWorkflowController');

router.get('/college/returns', ...requireCollegeManager, resolveCollegeScope, workflow.listReturns);
router.get('/college/returns/:id', ...requireCollegeManager, resolveCollegeScope, workflow.getReturn);
router.post('/college/returns/:id/approve', ...requireCollegeManager, resolveCollegeScope, workflow.approveReturn);
router.post('/college/returns/:id/reject', ...requireCollegeManager, resolveCollegeScope, workflow.rejectReturn);
router.get('/department/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.listReturns);
router.post('/department/returns', ...requireDepartmentHead, resolveDepartmentScope, workflow.createReturn);
router.get('/department/returns/:id', ...requireDepartmentHead, resolveDepartmentScope, workflow.getReturn);
router.post('/department/returns/:id/cancel', ...requireDepartmentHead, resolveDepartmentScope, workflow.cancelReturn);
router.get('/store/returns', auth.requireAuth, auth.requireRole('store_manager'), workflow.listReturns);
router.post('/store/returns', auth.requireAuth, auth.requireRole('store_manager'), workflow.processStoreReturn);
router.post('/store/returns/:id/receive', auth.requireAuth, auth.requireRole('store_manager'), workflow.receiveReturn);
router.post('/store/returns/:id/inspect', auth.requireAuth, auth.requireRole('store_manager'), workflow.inspectReturn);

module.exports = router;
