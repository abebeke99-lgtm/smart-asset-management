const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole, requirePermission } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');
const controller = require('../controllers/ictAssetController');
const reportController = require('../controllers/ictReportController');
const deviceHealthController = require('../controllers/deviceHealthController');
const { getIctAssetAnalytics } = require('../services/ictAnalyticsService');
const verification = require('../controllers/verificationController');
const ictInventoryController = require('../controllers/ictInventoryController');
const ictNetworkEquipmentController = require('../controllers/ictNetworkEquipmentController');

const router = express.Router();
const scopedIctAccess = (permission) => [
	requireAuth,
	requireRole('admin', 'ict_officer'),
	requirePermission(permission),
	(req, res, next) => req.user.role === 'admin' ? next() : resolveCollegeScope(req, res, next),
];
const scopedIctVerificationAccess = (permission) => [
	requireAuth,
	requireRole('admin', 'ict_officer'),
	requirePermission(permission),
	(req, res, next) => req.user.role === 'admin' ? next() : resolveCollegeScope(req, res, next),
];
const inventoryImportUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 10 * 1024 * 1024, files: 1 },
	fileFilter: (req, file, callback) => {
		const extension = file.originalname.split('.').pop()?.toLowerCase();
		const allowedMimeTypes = {
			csv: ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'],
			xls: ['application/vnd.ms-excel', 'application/octet-stream'],
			xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
		};
		if (!allowedMimeTypes[extension]?.includes(file.mimetype.toLowerCase())) {
			const error = new Error('Upload a CSV, XLS, or XLSX spreadsheet');
			error.statusCode = 400;
			return callback(error);
		}
		return callback(null, true);
	},
}).single('file');
const receiveInventoryImport = (req, res, next) => {
	inventoryImportUpload(req, res, (error) => {
		if (error) {
			const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : error.statusCode || 400;
			return res.status(status).json({
				success: false,
				message: error.code === 'LIMIT_FILE_SIZE'
					? 'The spreadsheet must be 10 MB or smaller'
					: error.message,
			});
		}
		if (!req.file) {
			return res.status(400).json({ success: false, message: 'Select a CSV, XLS, or XLSX spreadsheet' });
		}
		return next();
	});
};

router.get('/dashboard', ...scopedIctAccess('ict.dashboard.view'), controller.getIctDashboard);
router.get('/inventory', ...scopedIctAccess('ict.inventory.view'), ictInventoryController.getInventory);
router.post('/inventory/import', ...scopedIctAccess('ict.inventory.import'), receiveInventoryImport, ictInventoryController.importInventory);
router.get('/reports/export', ...scopedIctAccess('ict.reports.export'), reportController.exportIctReport);
router.get('/reports', ...scopedIctAccess('ict.reports.view'), reportController.getIctReports);
router.get('/analytics', ...scopedIctAccess('ict.analytics.view'), async (req, res, next) => {
	try {
		const collegeId = req.user.role === 'admin' ? Number(req.query.collegeId) : req.organizationScope.collegeId;
		if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
		const data = await getIctAssetAnalytics(req.query, collegeId);
		return res.json({ success: true, data });
	} catch (error) {
		return next(error);
	}
});
router.get('/options', ...scopedIctAccess('ict.assets.view'), controller.getIctOptions);
router.get('/verification', ...scopedIctVerificationAccess('ict.assets.view'), verification.listSessions);
router.post('/verification', ...scopedIctVerificationAccess('ict.assets.update'), verification.createSession);
router.get('/verification/:id', ...scopedIctVerificationAccess('ict.assets.view'), verification.getSession);
router.post('/verification/:id/items', ...scopedIctVerificationAccess('ict.assets.update'), verification.addItem);
router.post('/verification/:id/submit', ...scopedIctVerificationAccess('ict.assets.update'), verification.submitSession);
router.post('/verification/:id/finalize', ...scopedIctVerificationAccess('ict.assets.update'), verification.finalizeSession);
router.get('/tracking', ...scopedIctAccess('ict.tracking.view'), controller.listIctTracking);
router.get('/tracking/scan/:identifier', ...scopedIctAccess('ict.assets.qr'), controller.scanIctTracking);
router.get('/tracking/:id', ...scopedIctAccess('ict.tracking.view'), controller.getIctTracking);
router.post('/tracking/assign', ...scopedIctAccess('ict.assets.rfid'), controller.assignIctRfid);
router.delete('/tracking/:id/rfid', ...scopedIctAccess('ict.assets.rfid'), controller.unassignIctRfid);
router.get('/device-health', ...scopedIctAccess('ict.devicehealth.view'), deviceHealthController.listDeviceHealth);
router.get('/device-health/:id', ...scopedIctAccess('ict.devicehealth.view'), deviceHealthController.getDeviceHealth);
router.post('/device-health', ...scopedIctAccess('ict.devicehealth.manage'), deviceHealthController.createInspection);
router.get('/equipment/options', ...scopedIctAccess('ict.assets.view'), controller.listIctEquipmentOptions);
router.get('/equipment/network', ...scopedIctAccess('ict.network.view'), ictNetworkEquipmentController.listNetworkEquipment);
router.post('/equipment/network', ...scopedIctAccess('ict.network.manage'), ictNetworkEquipmentController.createNetworkEquipment);
router.get('/equipment/network/:id', ...scopedIctAccess('ict.network.view'), ictNetworkEquipmentController.getNetworkEquipment);
router.put('/equipment/network/:id', ...scopedIctAccess('ict.network.manage'), ictNetworkEquipmentController.updateNetworkEquipment);
router.delete('/equipment/network/:id', ...scopedIctAccess('ict.network.manage'), ictNetworkEquipmentController.deleteNetworkEquipment);
router.get('/network', ...scopedIctAccess('ict.network.view'), controller.listNetworkEquipment);
router.get('/network/:id', ...scopedIctAccess('ict.network.view'), controller.getNetworkEquipment);
router.get('/equipment', ...scopedIctAccess('ict.assets.view'), controller.listIctEquipment);
router.get('/equipment/:id', ...scopedIctAccess('ict.assets.view'), controller.getIctEquipment);
router.post('/equipment', ...scopedIctAccess('ict.assets.create'), controller.createIctEquipment);
router.put('/equipment/:id', ...scopedIctAccess('ict.assets.update'), controller.updateIctEquipment);
router.delete('/equipment/:id', ...scopedIctAccess('ict.assets.delete'), controller.deleteIctEquipment);
router.patch('/equipment/:id/retire', ...scopedIctAccess('ict.assets.retire'), controller.retireIctAsset);
router.get('/assets', ...scopedIctAccess('ict.assets.view'), controller.listIctAssets);
router.post('/assets', ...scopedIctAccess('ict.assets.create'), controller.createIctAsset);
router.get('/assets/options', ...scopedIctAccess('ict.assets.view'), controller.getIctOptions);
router.post('/assets/:id/maintenance', ...scopedIctAccess('ict.maintenance.create'), controller.createIctMaintenanceRequest);
router.get('/assets/:id', ...scopedIctAccess('ict.assets.view'), controller.getIctAsset);
router.patch('/assets/:id', ...scopedIctAccess('ict.assets.update'), controller.updateIctAsset);
router.get('/asset-history', ...scopedIctAccess('ict.history.view'), controller.listIctAssetHistory);
router.get('/asset-history/asset/:assetId', ...scopedIctAccess('ict.history.view'), controller.getIctAssetHistoryByAsset);
router.get('/asset-history/:id', ...scopedIctAccess('ict.history.view'), controller.getIctAssetHistoryRecord);
router.get('/search', ...scopedIctAccess('ict.assets.view'), controller.globalIctSearch);
router.get('/preventive-maintenance', ...scopedIctAccess('ict.maintenance.view'), controller.listIctPreventiveMaintenance);
router.post('/preventive-maintenance', ...scopedIctAccess('ict.maintenance.create'), controller.createIctPreventiveMaintenance);
router.post('/assets/:id/assign', ...scopedIctAccess('ict.assets.assign'), controller.assignIctAsset);
router.post('/assets/:id/transfer', ...scopedIctAccess('ict.assets.transfer'), controller.transferIctAsset);
router.get('/assets/:id/documents', ...scopedIctAccess('ict.assets.view'), controller.listIctAssetDocuments);
router.post('/assets/:id/documents', ...scopedIctAccess('ict.assets.update'), controller.uploadIctAssetDocument);
router.delete('/assets/:id/documents/:documentId', ...scopedIctAccess('ict.assets.update'), controller.deleteIctAssetDocument);
router.get('/assets/:id/warranty', ...scopedIctAccess('ict.assets.view'), controller.getIctWarrantyInfo);
router.get('/warranties', ...scopedIctAccess('ict.assets.view'), controller.listIctWarranties);
router.get('/', ...scopedIctAccess('ict.assets.view'), controller.listIctAssets);
router.get('/:id', ...scopedIctAccess('ict.assets.view'), controller.getIctAsset);
router.patch('/:id', ...scopedIctAccess('ict.assets.update'), controller.updateIctAsset);

module.exports = router;