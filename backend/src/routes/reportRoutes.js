const express = require('express');
const { getDashboardStats, generateReport, exportReport } = require('../controllers/reportController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdminReports = [requireAuth, requireRole('admin')];

router.get('/', ...requireAdminReports, generateReport);
router.get('/dashboard', ...requireAdminReports, getDashboardStats);
router.get('/export', ...requireAdminReports, exportReport);

module.exports = router;
