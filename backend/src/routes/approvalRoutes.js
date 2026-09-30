const express = require('express');
const { listApprovals, getApprovalById, createApproval, decideApproval } = require('../controllers/approvalController');
const { requireAuth } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');

const router = express.Router();
const resolveStoreManagerCollegeScope = (req, res, next) => req.user?.role === 'store_manager' ? resolveCollegeScope(req, res, next) : next();
router.get('/', requireAuth, resolveStoreManagerCollegeScope, listApprovals);
router.post('/', requireAuth, createApproval);
router.get('/:id', requireAuth, resolveStoreManagerCollegeScope, getApprovalById);
router.patch('/:id', requireAuth, resolveStoreManagerCollegeScope, decideApproval);
router.put('/:id', requireAuth, resolveStoreManagerCollegeScope, decideApproval);

module.exports = router;
