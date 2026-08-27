const express = require('express');
const { getInventory, getTransactions, createTransaction } = require('../controllers/inventoryController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.get('/', requireAuth, getInventory);
router.get('/transactions', requireAuth, getTransactions);
router.post('/:assetId/movement', requireAuth, (req, res, next) => {
  req.body.asset_id = req.params.assetId;
  next();
}, createTransaction);
router.post('/transactions', requireAuth, createTransaction);

module.exports = router;
