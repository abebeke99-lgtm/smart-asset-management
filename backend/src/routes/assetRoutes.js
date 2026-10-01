const express = require('express');
const { getAllAssets, getAssetById, createAsset, updateAsset, deleteAsset, getNextAssetId, checkAssetField, getAssetHistory } = require('../controllers/assetController');
const {
  generateDigitalId,
  lookupByQr,
  listDeletedAssets,
  restoreAsset,
  permanentDeleteAsset,
  bulkImportAssets,
  assetImportTemplate,
  listAssetDocuments,
  uploadAssetDocument,
  deleteAssetDocument,
  downloadAssetDocument,
  listAssetGrants,
  createAssetGrant,
  listCustody,
  createAssetCustody,
  endCustody,
} = require('../controllers/assetExtendedController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveDepartmentScope, resolveCollegeScope, isCollegeScopedRole, getCollegeScopeId } = require('../middlewares/organizationScope');
const { Asset, Assignment, Maintenance, Transfer, RFIDLog, AuditLog, User, Department } = require('../models');
const { Op } = require('sequelize');
const { createAuditLog } = require('../services/auditLogService');
const trackingController = require('../controllers/assetTrackingController');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];

const assetManagerRoles = ['admin', 'ict_officer', 'store_manager'];
const resolveScopedCollegeAssetScope = (req, res, next) => isCollegeScopedRole(req.user?.role) ? resolveCollegeScope(req, res, next) : next();
const verifyScopedCollegeAsset = async (req, res, next) => {
	if (!isCollegeScopedRole(req.user?.role)) return next();
	const collegeId = getCollegeScopeId(req);
	if (!collegeId) return res.status(403).json({ success: false, message: 'College scope is not configured for this account' });
	try {
		const asset = await Asset.findOne({ where: { id: req.params.id, collegeId }, paranoid: false, attributes: ['id'] });
		if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your college' });
		return next();
	} catch (error) { return next(error); }
};
const resolveDepartmentHeadAssetScope = (req, res, next) => req.user.role === 'department_head'
	? resolveDepartmentScope(req, res, next)
	: next();
const verifyDepartmentHeadAsset = async (req, res, next) => {
	if (req.user.role !== 'department_head') return next();
	const asset = await require('../models').Asset.findOne({ where: { id: req.params.id, departmentId: req.organizationScope.departmentId, ...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}) } });
	if (!asset) return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
	return next();
};

router.get('/', requireAuth, resolveScopedCollegeAssetScope, getAllAssets);
router.get('/lookup/:assetId', ...requireAdmin, trackingController.lookupByAssetCode);
router.get('/next-id', requireAuth, getNextAssetId);
router.get('/next-digital-id', requireAuth, generateDigitalId);
router.get('/scan/:identifier', requireAuth, resolveScopedCollegeAssetScope, lookupByQr);
router.get('/deleted', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, listDeletedAssets);
router.get('/import/template', requireAuth, assetImportTemplate);
router.post('/import', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), bulkImportAssets);
router.get('/check-id/:value', requireAuth, checkAssetField('assetCode'));
router.get('/check-serial/:value', requireAuth, checkAssetField('serialNumber'));
router.get('/check-rfid/:value', requireAuth, checkAssetField('rfidTag'));
router.get('/:id/history', requireAuth, requireRole('admin', 'ict_officer', 'college', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, getAssetHistory);
router.post('/:id/restore', requireAuth, requireRole('admin'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, restoreAsset);
router.delete('/:id/permanent', requireAuth, requireRole('admin'), permanentDeleteAsset);
router.get('/:id/documents', requireAuth, resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, listAssetDocuments);
router.post('/:id/documents', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, uploadAssetDocument);
router.delete('/:id/documents/:documentId', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, deleteAssetDocument);
router.get('/:id/documents/:documentId/file', requireAuth, resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, downloadAssetDocument);
router.get('/:id/grants', requireAuth, resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, listAssetGrants);
router.post('/:id/grants', requireAuth, requireRole('admin', 'ict_officer'), createAssetGrant);
router.get('/:id/custody', requireAuth, resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, listCustody);
router.post('/:id/custody', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, createAssetCustody);
router.post('/:id/custody/:custodyId/end', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, endCustody);
router.post('/:id/assign', requireAuth, requireRole('admin', 'ict_officer'), async (req, res, next) => {
	const transaction = await require('../models').sequelize.transaction();
	try {
		const asset = await require('../models').Asset.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
		if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
		const assignee = await User.findByPk(req.body.user_id || req.body.assigned_to, { transaction });
		if (!assignee || !assignee.active) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid active user is required' }); }
		const active = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction });
		if (active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is already assigned' }); }
		const previousValue = asset.toJSON();
		const assignment = await Assignment.create({ assetId: asset.id, assignedTo: assignee.id, assignedBy: req.user.id, status: 'active', notes: JSON.stringify({ department: req.body.department_id || '', location: req.body.location || '', reason: req.body.reason || '' }) }, { transaction });
		await asset.update({ status: 'in-use', department: req.body.department_id || asset.department, location: req.body.location || asset.location }, { transaction });
		await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'ASSIGN_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: { asset: asset.toJSON(), assignment: assignment.toJSON() }, details: { assetId: asset.id, assignmentId: assignment.id, assignedTo: assignee.id }, transaction });
		await transaction.commit();
		res.status(201).json({ success: true, assignment, asset: asset.toJSON() });
	} catch (error) { await transaction.rollback(); next(error); }
});
router.post('/:id/transfer', requireAuth, requireRole('admin', 'ict_officer'), async (req, res, next) => {
	try {
		const asset = await require('../models').Asset.findByPk(req.params.id);
		if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
		const destinationDepartment = req.body.department_id || req.body.new_department_id;
		const destinationLocation = req.body.location || req.body.new_location;
		if (!destinationDepartment || !destinationLocation) return res.status(400).json({ success: false, message: 'Destination department and location are required' });
		const department = await Department.findByPk(destinationDepartment);
		if (!department) return res.status(400).json({ success: false, message: 'Destination department not found' });
		const previousValue = asset.toJSON();
		const transfer = await Transfer.create({ assetId: asset.id, sourceDepartment: asset.department || '', destinationDepartment: department.name, currentLocation: asset.location || '', newLocation: destinationLocation, transferReason: req.body.reason || 'Administrative transfer', status: 'Completed', createdBy: req.user.id, approvedBy: req.user.id, approvalDate: new Date() });
		await asset.update({ department: department.name, location: destinationLocation });
		await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'TRANSFER_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: { asset: asset.toJSON(), transfer: transfer.toJSON() }, details: { assetId: asset.id, transferId: transfer.id } });
		res.json({ success: true, transfer, asset: asset.toJSON() });
	} catch (error) { next(error); }
});
const linkRfid = async (req, res, next) => {
	try {
		const asset = await require('../models').Asset.findByPk(req.params.id);
		const tag = String(req.body.rfid_tag || req.body.tag || '').trim();
		if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
		if (!tag) return res.status(400).json({ success: false, message: 'RFID tag is required' });
		const duplicate = await require('../models').Asset.findOne({ where: { rfidTag: tag, id: { [Op.ne]: asset.id } } });
		if (duplicate) return res.status(409).json({ success: false, message: 'RFID tag is already assigned' });
		const previousValue = asset.rfidTag;
		await asset.update({ rfidTag: tag });
		await RFIDLog.create({ assetId: asset.id, tag, action: 'link', location: asset.location || '', notes: `Linked by user ${req.user.id}` });
		await AuditLog.create({ userId: req.user.id, action: 'LINK_RFID', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: tag }) });
		res.json({ success: true, asset: asset.toJSON() });
	} catch (error) { next(error); }
};
router.post('/:id/rfid', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, linkRfid);
router.put('/:id/rfid', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, linkRfid);
router.delete('/:id/rfid', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, async (req, res, next) => {
	try {
		const asset = await require('../models').Asset.findByPk(req.params.id);
		if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
		const previousValue = asset.rfidTag;
		await asset.update({ rfidTag: null });
		await RFIDLog.create({ assetId: asset.id, tag: previousValue || '', action: 'unlink', location: asset.location || '', notes: `Unlinked by user ${req.user.id}` });
		await AuditLog.create({ userId: req.user.id, action: 'UNLINK_RFID', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: '' }) });
		res.json({ success: true, asset: asset.toJSON() });
	} catch (error) { next(error); }
});
router.get('/:id', requireAuth, resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset, getAssetById);
router.get('/:id/location', ...requireAdmin, trackingController.getLocation);
router.get('/:id/assignments', ...requireAdmin, trackingController.getAssignments);
router.get('/:id/transfers', ...requireAdmin, trackingController.getTransfers);
router.get('/:id/maintenance', ...requireAdmin, trackingController.getMaintenance);
router.post('/', requireAuth, requireRole('admin'), resolveScopedCollegeAssetScope, createAsset);
router.put('/:id', requireAuth, requireRole('admin'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, updateAsset);
router.delete('/:id', requireAuth, requireRole('admin'), deleteAsset);

module.exports = router;
