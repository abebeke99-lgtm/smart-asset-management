const express = require('express');
const { getTransactions, createTransaction } = require('../controllers/inventoryController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.get('/', requireAuth, getTransactions);
router.post('/', requireAuth, createTransaction);

module.exports = router;
