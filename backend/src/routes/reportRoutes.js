const express = require('express');
const { getDashboardStats } = require('../controllers/reportController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, getDashboardStats);
router.get('/dashboard', requireAuth, getDashboardStats);

module.exports = router;
