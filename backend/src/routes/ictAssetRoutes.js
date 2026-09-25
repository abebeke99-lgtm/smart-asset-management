const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');
const controller = require('../controllers/ictAssetController');
const reportController = require('../controllers/ictReportController');
const deviceHealthController = require('../controllers/deviceHealthController');
const { getIctAssetAnalytics } = require('../services/ictAnalyticsService');

const router = express.Router();
const scopedIctAccess = [requireAuth, requireRole('admin', 'ict_officer'), (req, res, next) => req.user.role === 'admin' ? next() : resolveCollegeScope(req, res, next)];

router.get('/dashboard', ...scopedIctAccess, controller.getIctDashboard);
router.get('/reports/export', ...scopedIctAccess, reportController.exportIctReport);
router.get('/reports', ...scopedIctAccess, reportController.getIctReports);
router.get('/analytics', ...scopedIctAccess, async (req, res, next) => {
	try {
		const collegeId = req.user.role === 'admin' ? Number(req.query.collegeId) : req.organizationScope.collegeId;
		if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
		const data = await getIctAssetAnalytics(req.query, collegeId);
		return res.json({ success: true, data });
	} catch (error) {
		return next(error);
	}
});
router.get('/options', ...scopedIctAccess, controller.getIctOptions);
router.get('/tracking', ...scopedIctAccess, controller.listIctTracking);
router.get('/tracking/scan/:identifier', ...scopedIctAccess, controller.scanIctTracking);
router.get('/tracking/:id', ...scopedIctAccess, controller.getIctTracking);
router.post('/tracking/assign', ...scopedIctAccess, controller.assignIctRfid);
router.delete('/tracking/:id/rfid', ...scopedIctAccess, controller.unassignIctRfid);
router.get('/device-health', ...scopedIctAccess, deviceHealthController.listDeviceHealth);
router.get('/device-health/:id', ...scopedIctAccess, deviceHealthController.getDeviceHealth);
router.post('/device-health', ...scopedIctAccess, deviceHealthController.createInspection);
router.get('/network', ...scopedIctAccess, controller.listNetworkEquipment);
router.get('/network/:id', ...scopedIctAccess, controller.getNetworkEquipment);
router.get('/equipment', ...scopedIctAccess, controller.listIctEquipment);
router.get('/assets', ...scopedIctAccess, controller.listIctAssets);
router.get('/assets/options', ...scopedIctAccess, controller.getIctOptions);
router.get('/assets/:id', ...scopedIctAccess, controller.getIctAsset);
router.patch('/assets/:id', ...scopedIctAccess, controller.updateIctAsset);
router.get('/asset-history', ...scopedIctAccess, controller.listIctAssetHistory);
router.get('/asset-history/asset/:assetId', ...scopedIctAccess, controller.getIctAssetHistoryByAsset);
router.get('/asset-history/:id', ...scopedIctAccess, controller.getIctAssetHistoryRecord);
router.get('/', ...scopedIctAccess, controller.listIctAssets);
router.get('/:id', ...scopedIctAccess, controller.getIctAsset);
router.patch('/:id', ...scopedIctAccess, controller.updateIctAsset);

module.exports = router;