const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { getCollegeDashboard } = require('../controllers/collegeController');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('college'), getCollegeDashboard);

module.exports = router;
