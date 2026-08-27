const express = require('express');
const { getAllAssets, getAssetById, createAsset, updateAsset, deleteAsset, getNextAssetId, checkAssetField, getAssetHistory } = require('../controllers/assetController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { Assignment, Maintenance, Transfer, RFIDLog, AuditLog, User, Department } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/', requireAuth, getAllAssets);
router.get('/next-id', requireAuth, getNextAssetId);
router.get('/check-id/:value', requireAuth, checkAssetField('assetCode'));
router.get('/check-serial/:value', requireAuth, checkAssetField('serialNumber'));
router.get('/check-rfid/:value', requireAuth, checkAssetField('rfidTag'));
router.get('/:id/history', requireAuth, getAssetHistory);
router.post('/:id/assign', requireAuth, requireRole('admin'), async (req, res, next) => {
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
		await AuditLog.create({ userId: req.user.id, action: 'ASSIGN_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: asset.toJSON(), assignmentId: assignment.id, assignedTo: assignee.id }) }, { transaction });
		await transaction.commit();
		res.status(201).json({ success: true, assignment, asset: asset.toJSON() });
	} catch (error) { await transaction.rollback(); next(error); }
});
router.post('/:id/transfer', requireAuth, requireRole('admin'), async (req, res, next) => {
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
		await AuditLog.create({ userId: req.user.id, action: 'TRANSFER_ASSET', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: asset.toJSON(), transferId: transfer.id }) });
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
router.post('/:id/rfid', requireAuth, requireRole('admin'), linkRfid);
router.put('/:id/rfid', requireAuth, requireRole('admin'), linkRfid);
router.delete('/:id/rfid', requireAuth, requireRole('admin'), async (req, res, next) => {
	try {
		const asset = await require('../models').Asset.findByPk(req.params.id);
		if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
		const previousValue = asset.rfidTag;
		await asset.update({ rfidTag: '' });
		await RFIDLog.create({ assetId: asset.id, tag: previousValue || '', action: 'unlink', location: asset.location || '', notes: `Unlinked by user ${req.user.id}` });
		await AuditLog.create({ userId: req.user.id, action: 'UNLINK_RFID', entity: `asset:${asset.id}`, details: JSON.stringify({ assetId: asset.id, previousValue, newValue: '' }) });
		res.json({ success: true, asset: asset.toJSON() });
	} catch (error) { next(error); }
});
router.get('/:id', requireAuth, getAssetById);
router.get('/:id/assignments', requireAuth, async (req, res, next) => {
	try {
		const history = await Assignment.findAll({ where: { assetId: req.params.id }, order: [['createdAt', 'DESC']] });
		res.json({ success: true, history });
	} catch (error) { next(error); }
});
router.get('/:id/maintenance', requireAuth, async (req, res, next) => {
	try {
		const history = await Maintenance.findAll({ where: { assetId: req.params.id }, order: [['createdAt', 'DESC']] });
		res.json({ success: true, history });
	} catch (error) { next(error); }
});
router.post('/', requireAuth, requireRole('admin', 'ict_officer'), createAsset);
router.put('/:id', requireAuth, requireRole('admin', 'ict_officer'), updateAsset);
router.delete('/:id', requireAuth, requireRole('admin'), deleteAsset);

module.exports = router;
