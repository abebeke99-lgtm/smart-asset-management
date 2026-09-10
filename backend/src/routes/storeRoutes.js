const express = require('express');
const { getDashboard, getHistory, getInventory, getLowStock, getAvailableAssets, getStockAdjustments, getReceipts } = require('../controllers/storeController');
const { createStockAdjustment, createReceipt } = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('store_manager'), getDashboard);
router.get('/history', requireAuth, requireRole('store_manager'), getHistory);
router.get('/inventory', requireAuth, requireRole('store_manager'), getInventory);
router.get('/available-assets', requireAuth, requireRole('store_manager'), getAvailableAssets);
router.get('/low-stock', requireAuth, requireRole('store_manager'), getLowStock);
router.get('/stock-adjustments', requireAuth, requireRole('store_manager'), getStockAdjustments);
router.post('/stock-adjustments', requireAuth, requireRole('store_manager'), createStockAdjustment);
router.get('/receive', requireAuth, requireRole('store_manager'), getReceipts);
router.post('/receive', requireAuth, requireRole('store_manager'), createReceipt);

module.exports = router;
