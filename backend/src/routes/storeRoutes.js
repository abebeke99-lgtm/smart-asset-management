const express = require('express');
const { getDashboard, getInventory, getLowStock, getAvailableAssets } = require('../controllers/storeController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('store_manager'), getDashboard);
router.get('/inventory', requireAuth, requireRole('store_manager'), getInventory);
router.get('/available-assets', requireAuth, requireRole('store_manager'), getAvailableAssets);
router.get('/low-stock', requireAuth, requireRole('store_manager'), getLowStock);

module.exports = router;
