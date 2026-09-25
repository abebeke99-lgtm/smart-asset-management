const { sequelize, Maintenance, Asset, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const scopedAsset = (req) => req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
const requestInclude = [
	{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'departmentId', 'collegeId', 'location', 'status', 'condition'] },
	{ model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
	{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
];
const scopedWhere = (req) => ({ '$Asset.department_id$': req.organizationScope.departmentId || undefined, '$Asset.college_id$': req.organizationScope.departmentId ? undefined : req.organizationScope.collegeId });
const cleanWhere = (req) => req.organizationScope.departmentId ? { '$Asset.department_id$': req.organizationScope.departmentId } : { '$Asset.college_id$': req.organizationScope.collegeId };

const listRequests = async (req, res, next) => {
	try {
		const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
		const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
		const where = {};
		const search = String(req.query.search || '').trim();
		if (req.query.status) where.status = String(req.query.status).toLowerCase();
		if (req.query.priority) where.priority = String(req.query.priority).toLowerCase();
		if (search) {
			where[Op.or] = [
				{ title: { [Op.like]: `%${search}%` } },
				{ description: { [Op.like]: `%${search}%` } },
				{ '$Asset.name$': { [Op.like]: `%${search}%` } },
				{ '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
				{ '$Requester.fullName$': { [Op.like]: `%${search}%` } },
				{ '$Requester.username$': { [Op.like]: `%${search}%` } },
				{ '$Technician.fullName$': { [Op.like]: `%${search}%` } },
				{ '$Technician.username$': { [Op.like]: `%${search}%` } },
				...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
			];
		}
		const assetInclude = { ...requestInclude[0], where: cleanWhere(req), required: true };
		const { count, rows } = await Maintenance.findAndCountAll({
			where,
			include: [assetInclude, requestInclude[1], requestInclude[2]],
			order: [['createdAt', 'DESC']],
			limit,
			offset: (page - 1) * limit,
			distinct: true,
		});
		const summaryRows = await Maintenance.findAll({ where, include: [assetInclude], attributes: ['status'], distinct: true });
		const summary = summaryRows.reduce((result, row) => {
			const status = String(row.status || '').toLowerCase();
			result.total += 1;
			result[status] = (result[status] || 0) + 1;
			return result;
		}, { total: 0 });
		res.json({ success: true, data: rows, summary, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
	} catch (error) { next(error); }
};

const getRequest = async (req, res, next) => {
	try {
		const row = await Maintenance.findOne({ where: { id: req.params.id }, include: [{ ...requestInclude[0], where: cleanWhere(req), required: true }, requestInclude[1], requestInclude[2]] });
		if (!row) return res.status(404).json({ success: false, message: 'Maintenance request not found in your scope' });
		res.json({ success: true, data: row });
	} catch (error) { next(error); }
};

const createRequest = async (req, res, next) => { const transaction = await sequelize.transaction(); try { const { asset_id: assetId, problem, description, priority = 'normal' } = req.body; const normalizedPriority = String(priority).toLowerCase(); if (!assetId || !String(problem || description || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset and problem description are required' }); } if (!['low', 'normal', 'medium', 'high', 'critical'].includes(normalizedPriority)) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Invalid maintenance priority' }); } if (normalizedPriority === 'critical' && String(req.body.critical_reason || '').trim().length < 5) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Critical maintenance requires an explanation' }); } const asset = await Asset.findOne({ where: { id: assetId, ...scopedAsset(req) }, transaction, lock: transaction.LOCK.UPDATE }); if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your maintenance scope' }); } if (['disposed', 'missing'].includes(String(asset.status).toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot receive a maintenance request in its current state' }); } const duplicate = await Maintenance.findOne({ where: { assetId, status: { [Op.in]: ['pending', 'approved', 'assigned', 'in-progress'] } }, transaction, lock: transaction.LOCK.UPDATE }); if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'An active maintenance request already exists for this asset' }); } const row = await Maintenance.create({ assetId, requestedBy: req.user.id, title: String(problem || description).trim(), description: String(description || problem).trim(), priority: normalizedPriority === 'normal' ? 'medium' : normalizedPriority, status: 'pending' }, { transaction }); await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_REQUESTED', entity: `maintenance:${row.id}`, details: JSON.stringify({ assetId, status: row.status }) }, { transaction }); await transaction.commit(); res.status(201).json({ success: true, message: 'Maintenance request created', data: row }); } catch (error) { await transaction.rollback(); next(error); } };

const cancelRequest = async (req, res, next) => { const transaction = await sequelize.transaction(); try { const row = await Maintenance.findOne({ where: { id: req.params.id, requestedBy: req.user.id, status: { [Op.in]: ['pending', 'approved'] } }, include: [{ model: Asset, where: cleanWhere(req), required: true }], transaction, lock: transaction.LOCK.UPDATE }); if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Cancellable maintenance request not found in your scope' }); } await row.update({ status: 'cancelled' }, { transaction }); await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_CANCELLED', entity: `maintenance:${row.id}`, details: JSON.stringify({ beforeStatus: row._previousDataValues.status, afterStatus: 'cancelled' }) }, { transaction }); await transaction.commit(); res.json({ success: true, message: 'Maintenance request cancelled', data: row }); } catch (error) { await transaction.rollback(); next(error); } };

module.exports = { listRequests, getRequest, createRequest, cancelRequest };
