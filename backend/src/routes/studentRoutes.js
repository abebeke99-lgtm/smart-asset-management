const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { getStudentDashboard } = require('../controllers/studentDashboardController');

const router = express.Router();

router.get('/dashboard', requireAuth, requireRole('student'), getStudentDashboard);

module.exports = router;
