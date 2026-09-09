const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { getAssetAnalytics, getSystemAnalytics } = require('../services/analyticsService');

const router = express.Router();
const requireAdminAnalytics = [requireAuth, requireRole('admin')];

const assetAnalytics = async (req, res, next) => {
  try {
    const data = await getAssetAnalytics(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

router.get('/analytics', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/assets', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/organizations', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/maintenance', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/assignments', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/transfers', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/inventory', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/rfid', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/procurement', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/financial', ...requireAdminAnalytics, assetAnalytics);
router.get('/analytics/users', ...requireAdminAnalytics, assetAnalytics);

router.get('/analytics/export', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getAssetAnalytics(req.query);
    const rows = [
      ['Metric', 'Value'],
      ...Object.entries(data.kpis || {}),
      [],
      ['Category', 'Asset Count', 'Value'],
      ...(data.categories || []).map((row) => [row.category, row.count, row.value]),
    ];
    const csv = rows.map((row) => row.map((value) => JSON.stringify(value ?? '')).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="asset-analytics.csv"');
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getSystemAnalytics(req.query);
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system/health', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getSystemAnalytics(req.query);
    return res.json({ success: true, data: data.health });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system/authentication', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getSystemAnalytics(req.query);
    return res.json({ success: true, data: data.authentication });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system/audit', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getSystemAnalytics(req.query);
    return res.json({ success: true, data: data.audit });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system/security', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getSystemAnalytics(req.query);
    return res.json({ success: true, data: { failedLogins: data.authentication.failedLogins, lockedUsers: data.users.locked, recent: data.audit.recent } });
  } catch (error) {
    return next(error);
  }
});

router.get('/analytics/system/data-quality', ...requireAdminAnalytics, async (req, res, next) => {
  try {
    const data = await getAssetAnalytics(req.query);
    const [assetsWithoutCollege, assetsWithoutDepartment, usersWithoutDepartment, departmentsWithoutCollege] = await Promise.all([
      require('../models').Asset.count({ where: { collegeId: null } }),
      require('../models').Asset.count({ where: { departmentId: null } }),
      require('../models').User.count({ where: { departmentId: null } }),
      require('../models').Department.count({ where: { collegeId: null } }),
    ]);
    return res.json({ success: true, data: { checks: [
      { issue: 'Assets without college', count: assetsWithoutCollege, severity: assetsWithoutCollege ? 'warning' : 'ok' },
      { issue: 'Assets without department', count: assetsWithoutDepartment, severity: assetsWithoutDepartment ? 'warning' : 'ok' },
      { issue: 'Users without department', count: usersWithoutDepartment, severity: usersWithoutDepartment ? 'warning' : 'ok' },
      { issue: 'Departments without college', count: departmentsWithoutCollege, severity: departmentsWithoutCollege ? 'warning' : 'ok' },
    ], assetScope: data.filters } });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
