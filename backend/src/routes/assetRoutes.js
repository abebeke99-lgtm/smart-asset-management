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
const { requireAuth, requireRole, requirePermission, requireAnyPermission } = require('../middlewares/auth');
const { resolveDepartmentScope, resolveCollegeScope, isCollegeScopedRole, getCollegeScopeId } = require('../middlewares/organizationScope');
const { sequelize, Asset, Assignment, Inventory, InventoryTransaction, Maintenance, Transfer, RFIDLog, AuditLog, User, Department } = require('../models');
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
const trackingReadAccess = [
	requireAuth,
	requireRole('admin', 'department_head'),
	requireAnyPermission('assets.view'),
	resolveDepartmentHeadAssetScope,
	verifyDepartmentHeadAsset,
];
const resolveTeachingAssistantDepartmentScope = async (req, res, next) => {
	if (req.user.role !== 'teaching_assistant') return next();
	const departmentId = Number(req.user.departmentId ?? req.user.department_id);
	if (!Number.isSafeInteger(departmentId) || departmentId < 1) {
		return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
	}
	try {
		const department = await Department.findOne({
			where: { id: departmentId, status: 'active' },
			attributes: ['id', 'name', 'collegeId'],
		});
		if (!department) return res.status(403).json({ success: false, message: 'Department scope is not configured for this account' });
		req.organizationScope = { department, departmentId: department.id, collegeId: department.collegeId };
		return next();
	} catch (error) {
		return next(error);
	}
};
const verifyTeachingAssistantAsset = async (req, res, next) => {
	if (req.user.role !== 'teaching_assistant') return next();
	try {
		const asset = await Asset.findOne({
			where: {
				id: req.params.id,
				departmentId: req.organizationScope.departmentId,
				...(req.organizationScope.collegeId ? { collegeId: req.organizationScope.collegeId } : {}),
			},
			attributes: ['id'],
		});
		if (!asset) return res.status(403).json({ success: false, message: 'Asset is outside your department scope' });
		return next();
	} catch (error) {
		return next(error);
	}
};

router.get('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager', 'department_head', 'teaching_assistant'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, resolveDepartmentHeadAssetScope, resolveTeachingAssistantDepartmentScope, getAllAssets);
router.get('/lookup/:assetId', ...requireAdmin, trackingController.lookupByAssetCode);
router.get('/next-id', requireAuth, requireRole(...assetManagerRoles), getNextAssetId);
router.get('/next-digital-id', requireAuth, requireRole(...assetManagerRoles), generateDigitalId);
router.get('/scan/:identifier', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager', 'department_head'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, resolveDepartmentHeadAssetScope, lookupByQr);
router.get('/deleted', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, listDeletedAssets);
router.get('/import/template', requireAuth, assetImportTemplate);
router.post('/import', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), bulkImportAssets);
router.get('/check-id/:value', requireAuth, requireRole(...assetManagerRoles), checkAssetField('assetCode'));
router.get('/check-serial/:value', requireAuth, requireRole(...assetManagerRoles), checkAssetField('serialNumber'));
router.get('/check-rfid/:value', requireAuth, requireRole(...assetManagerRoles), checkAssetField('rfidTag'));
router.get('/:id/history', requireAuth, requireRole('admin', 'ict_officer', 'college', 'store_manager', 'department_head'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset, getAssetHistory);
router.post('/:id/restore', requireAuth, requireRole('admin'), requirePermission('assets.delete'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, restoreAsset);
router.delete('/:id/permanent', requireAuth, requireRole('admin'), requirePermission('assets.delete'), permanentDeleteAsset);
router.get('/:id/documents', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager', 'department_head'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset, listAssetDocuments);
router.post('/:id/documents', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, uploadAssetDocument);
router.delete('/:id/documents/:documentId', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, deleteAssetDocument);
router.get('/:id/documents/:documentId/file', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager', 'department_head'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset, downloadAssetDocument);
router.get('/:id/grants', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, listAssetGrants);
router.post('/:id/grants', requireAuth, requireRole('admin', 'ict_officer'), createAssetGrant);
router.get('/:id/custody', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, listCustody);
router.post('/:id/custody', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, createAssetCustody);
router.post('/:id/custody/:custodyId/end', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, endCustody);
router.post('/:id/assign', requireAuth, requireRole('admin', 'ict_officer'), requireAnyPermission('assets.assign', 'ict.assets.assign'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, async (req, res, next) => {
	const transaction = await sequelize.transaction();
	try {
		const asset = await Asset.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
		if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
		const assigneeId = Number(req.body.user_id || req.body.assigned_to);
		if (!Number.isInteger(assigneeId) || assigneeId <= 0) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid user is required.' }); }
		const assignee = await User.findByPk(assigneeId, { transaction });
		if (!assignee || !assignee.active) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A valid active user is required' }); }
		if (String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-') !== 'available') { await transaction.rollback(); return res.status(409).json({ success: false, message: `Asset cannot be assigned while its status is ${asset.status}.` }); }
		if (req.body.location && String(req.body.location).trim().length > 255) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Location must be 255 characters or fewer.' }); }
		const condition = String(req.body.condition_at_assignment || req.body.condition || asset.condition || 'Good');
		if (!['excellent', 'good', 'fair', 'poor', 'damaged'].includes(condition.toLowerCase())) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Condition must be Excellent, Good, Fair, Poor or Damaged.' }); }
		const active = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction });
		if (active) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is already assigned' }); }
		const inventory = await Inventory.findOne({ where: { assetId: asset.id }, transaction, lock: transaction.LOCK.UPDATE });
		if (!inventory || Number(inventory.availableQuantity) < 1) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not available in inventory.' }); }
		if (req.user.role === 'ict_officer' && Number(assignee.collegeId) !== Number(req.organizationScope.collegeId)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Recipient is outside your organization scope.' }); }
		const departmentId = Number(req.body.department_id || assignee.departmentId || 0) || null;
		if (departmentId) {
			const department = await Department.findByPk(departmentId, { transaction });
			if (!department) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Department not found.' }); }
			if (assignee.departmentId && Number(assignee.departmentId) !== departmentId) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'The selected user does not belong to the selected department.' }); }
			if (req.user.role === 'ict_officer' && Number(department.collegeId) !== Number(req.organizationScope.collegeId)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Department is outside your organization scope.' }); }
		}
		const previousValue = asset.toJSON();
		const assignedDate = new Date();
		const location = String(req.body.location || asset.location || '').trim();
		await inventory.update({ availableQuantity: inventory.availableQuantity - 1 }, { transaction });
		const assignment = await Assignment.create({
			assetId: asset.id,
			assignedTo: assignee.id,
			assignedToType: 'user',
			assignedToId: assignee.id,
			assignedBy: req.user.id,
			workflowStatus: 'assigned',
			assignedDate,
			departmentId,
			location,
			conditionAtAssignment: condition,
			status: 'active',
			notes: JSON.stringify({ departmentId, location, condition, notes: req.body.notes || '', reason: req.body.reason || '' }),
		}, { transaction });
		await asset.update({ status: 'assigned', ...(departmentId ? { departmentId } : {}), location }, { transaction });
		await InventoryTransaction.create({ inventoryId: inventory.id, assetId: asset.id, userId: req.user.id, type: 'issue', quantity: 1, reason: 'Asset assignment', notes: req.body.notes || '' }, { transaction });
		await createAuditLog({ userId: req.user.id, role: req.user.role, action: 'ASSIGN_ASSET', entity: `asset:${asset.id}`, entityId: asset.id, oldValue: previousValue, newValue: { asset: asset.toJSON(), assignment: assignment.toJSON() }, details: { assetId: asset.id, assignmentId: assignment.id, assignedTo: { type: 'user', id: assignee.id }, ip: req.ip, sessionId: req.sessionID || null }, transaction });
		await transaction.commit();
		res.status(201).json({ success: true, assignment, asset: asset.toJSON() });
	} catch (error) { if (!transaction.finished) await transaction.rollback(); next(error); }
});
router.post('/:id/transfer', requireAuth, requireRole('admin', 'ict_officer'), requireAnyPermission('assets.transfer', 'ict.assets.transfer'), async (req, res, next) => {
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
router.get('/:id', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college_manager', 'department_head', 'teaching_assistant'), requireAnyPermission('assets.view', 'ict.assets.view', 'college.assets.view'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, resolveDepartmentHeadAssetScope, verifyDepartmentHeadAsset, resolveTeachingAssistantDepartmentScope, verifyTeachingAssistantAsset, getAssetById);
router.get('/:id/location', ...trackingReadAccess, trackingController.getLocation);
router.get('/:id/assignments', ...trackingReadAccess, trackingController.getAssignments);
router.get('/:id/transfers', ...trackingReadAccess, trackingController.getTransfers);
router.get('/:id/maintenance', ...trackingReadAccess, trackingController.getMaintenance);
router.post('/', requireAuth, requireRole('admin'), requirePermission('assets.create'), resolveScopedCollegeAssetScope, createAsset);
router.put('/:id', requireAuth, requireRole('admin'), requirePermission('assets.update'), resolveScopedCollegeAssetScope, verifyScopedCollegeAsset, updateAsset);
router.delete('/:id', requireAuth, requireRole('admin'), requirePermission('assets.delete'), deleteAsset);

module.exports = router;
