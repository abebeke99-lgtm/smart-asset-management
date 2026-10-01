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
      ['Selected filters'],
      ...Object.entries(data.filters || {}).map(([key, value]) => [key, value]),
      [],
      ['Metric', 'Value'],
      ...Object.entries(data.kpis || {}),
      [],
      ['Category', 'Asset Count', 'Value'],
      ...(data.categories || []).map((row) => [row.category, row.count, row.value]),
      [],
      ['Status', 'Asset Count'],
      ...(data.status || []).map((row) => [row.status, row.count]),
      [],
      ['Condition', 'Asset Count'],
      ...(data.distributions?.byCondition || []).map((row) => [row.condition, row.count]),
      [],
      ['Age Group', 'Asset Count'],
      ...(data.distributions?.byAge || []).map((row) => [row.bucket, row.count]),
      [],
      ['College', 'Asset Count', 'Asset Value'],
      ...(data.organizations?.collegePerformance || []).map((row) => [row.name, row.count, row.value]),
      [],
      ['Department', 'Asset Count', 'Asset Value'],
      ...(data.organizations?.departmentPerformance || []).map((row) => [row.name, row.count, row.value]),
      [],
      ['Campus', 'Asset Count', 'Asset Value'],
      ...(data.organizations?.campusPerformance || []).map((row) => [row.name, row.count, row.value]),
      [],
      ['Acquisition Period', 'Assets Acquired'],
      ...(data.trends?.acquisitions || []).map((row) => [row.period, row.count]),
      [],
      ['Research Grant Source', 'Assets', 'Asset Value'],
      ...(data.acquisition?.researchGrant?.bySource || []).map((row) => [row.source, row.count, row.value]),
      [],
      ['Maintenance Status', 'Request Count'],
      ...(data.maintenance?.statuses || []).map((row) => [row.status, row.count]),
      [],
      ['Frequently Maintained Asset', 'Asset Code', 'Category', 'Maintenance Count', 'Status'],
      ...(data.maintenance?.frequentlyMaintained || []).map((row) => [row.name, row.assetCode, row.category, row.maintenanceCount, row.status]),
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
