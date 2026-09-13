const express = require('express');
const { getTransactions, createTransaction } = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const issueWriteAccess = [requireAuth, requireRole('admin', 'store_manager', 'ict_officer')];

router.get('/', ...issueWriteAccess, getTransactions);
router.post('/', ...issueWriteAccess, createTransaction);

module.exports = router;
