const express = require('express');
const { getInventory, getTransactions, getStoreDashboard, createTransaction } = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');

const router = express.Router();
const inventoryWriteAccess = [requireAuth, requireRole('admin', 'store_manager', 'ict_officer')];
const inventoryReadAccess = [requireAuth, requireRole('admin', 'store_manager', 'ict_officer'), (req, res, next) => req.user.role === 'ict_officer' ? resolveCollegeScope(req, res, next) : next()];
router.get('/', ...inventoryReadAccess, getInventory);
router.get('/dashboard', requireAuth, requireRole('admin', 'store_manager'), getStoreDashboard);
router.get('/transactions', requireAuth, getTransactions);
router.get('/movements', requireAuth, getTransactions);
router.post('/:assetId/movement', ...inventoryWriteAccess, (req, res, next) => {
  req.body.asset_id = req.params.assetId;
  next();
}, createTransaction);
router.post('/transactions', ...inventoryWriteAccess, createTransaction);

module.exports = router;
