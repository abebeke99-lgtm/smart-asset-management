const express = require('express');
const { getDashboard, getInventory, getLowStock, getAvailableAssets } = require('../controllers/storeController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('store_manager', 'admin'), getDashboard);
router.get('/inventory', requireAuth, requireRole('store_manager', 'admin'), getInventory);
router.get('/available-assets', requireAuth, requireRole('store_manager', 'admin'), getAvailableAssets);
router.get('/low-stock', requireAuth, requireRole('store_manager', 'admin'), getLowStock);

module.exports = router;
