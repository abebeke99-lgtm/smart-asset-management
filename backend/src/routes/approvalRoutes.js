const express = require('express');
const { listApprovals, createApproval, decideApproval } = require('../controllers/approvalController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.get('/', requireAuth, listApprovals);
router.post('/', requireAuth, createApproval);
router.patch('/:id', requireAuth, decideApproval);
router.put('/:id', requireAuth, decideApproval);

module.exports = router;
