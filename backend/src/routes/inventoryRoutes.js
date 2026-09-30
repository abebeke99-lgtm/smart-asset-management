const express = require('express');
const { getInventory, getTransactions, getStoreDashboard, createTransaction } = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope, isCollegeScopedRole } = require('../middlewares/organizationScope');

const router = express.Router();
const resolveScopedInventoryCollegeScope = (req, res, next) => isCollegeScopedRole(req.user?.role) ? resolveCollegeScope(req, res, next) : next();
const resolveInventoryReadCollegeScope = (req, res, next) => isCollegeScopedRole(req.user?.role) || req.user?.role === 'ict_officer' ? resolveCollegeScope(req, res, next) : next();
const inventoryWriteAccess = [requireAuth, requireRole('admin', 'store_manager', 'ict_officer'), resolveScopedInventoryCollegeScope];
const inventoryReadAccess = [requireAuth, requireRole('admin', 'store_manager', 'college_manager', 'ict_officer'), resolveInventoryReadCollegeScope];
router.get('/', ...inventoryReadAccess, getInventory);
router.get('/dashboard', requireAuth, requireRole('admin', 'store_manager', 'college_manager'), resolveScopedInventoryCollegeScope, getStoreDashboard);
router.get('/transactions', requireAuth, resolveScopedInventoryCollegeScope, getTransactions);
router.get('/movements', requireAuth, resolveScopedInventoryCollegeScope, getTransactions);
router.post('/:assetId/movement', ...inventoryWriteAccess, (req, res, next) => {
  req.body.asset_id = req.params.assetId;
  next();
}, createTransaction);
router.post('/transactions', ...inventoryWriteAccess, createTransaction);

module.exports = router;
