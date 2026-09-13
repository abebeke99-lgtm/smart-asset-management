const express = require('express');
const { getDashboard, getHistory, getInventory, getLowStock, getAvailableAssets, getStockAdjustments, getReceipts } = require('../controllers/storeController');
const { createStockAdjustment, createReceipt } = require('../controllers/inventoryController');
const verification = require('../controllers/verificationController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

const ensureStoreScope = (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  const collegeId = Number(req.user.collegeId ?? req.user.college_id ?? 1);
  req.organizationScope = {
    collegeId,
    college: { id: collegeId, name: 'Store College' },
    departmentId: null,
    department: null,
  };
  return next();
};

router.get('/dashboard', requireAuth, requireRole('store_manager'), getDashboard);
router.get('/history', requireAuth, requireRole('store_manager'), getHistory);
router.get('/inventory', requireAuth, requireRole('store_manager'), getInventory);
router.get('/available-assets', requireAuth, requireRole('store_manager'), getAvailableAssets);
router.get('/low-stock', requireAuth, requireRole('store_manager'), getLowStock);
router.get('/stock-adjustments', requireAuth, requireRole('store_manager'), getStockAdjustments);
router.post('/stock-adjustments', requireAuth, requireRole('store_manager'), createStockAdjustment);
router.get('/receive', requireAuth, requireRole('store_manager'), getReceipts);
router.post('/receive', requireAuth, requireRole('store_manager'), createReceipt);
router.get('/verification', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.listSessions);
router.post('/verification', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.createSession);
router.get('/verification/:id', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.getSession);
router.post('/verification/:id/items', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.addItem);
router.post('/verification/:id/submit', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.submitSession);
router.post('/verification/:id/finalize', requireAuth, requireRole('store_manager'), ensureStoreScope, verification.finalizeSession);

module.exports = router;
