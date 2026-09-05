const express = require('express');
const { getInventory, getTransactions, getStoreDashboard, createTransaction } = require('../controllers/inventoryController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.get('/', requireAuth, getInventory);
router.get('/dashboard', requireAuth, requireRole('admin', 'store_manager'), getStoreDashboard);
router.get('/transactions', requireAuth, getTransactions);
router.post('/:assetId/movement', requireAuth, (req, res, next) => {
  req.body.asset_id = req.params.assetId;
  next();
}, createTransaction);
router.post('/transactions', requireAuth, createTransaction);

module.exports = router;
