const { sequelize, Maintenance, Asset, User, AuditLog, MaintenanceWorkOrder, MaintenanceCost, PreventiveMaintenance, MaintenanceHistory } = require('../models');
const { Op } = require('sequelize');

const scopedAsset = (req) => req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
const requestInclude = [
	{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'departmentId', 'collegeId', 'location', 'status', 'condition'] },
	{ model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
	{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
];
const scopedWhere = (req) => ({ '$Asset.departmentId$': req.organizationScope.departmentId || undefined, '$Asset.collegeId$': req.organizationScope.departmentId ? undefined : req.organizationScope.collegeId });
const cleanWhere = (req) => req.organizationScope.departmentId ? { '$Asset.departmentId$': req.organizationScope.departmentId } : { '$Asset.collegeId$': req.organizationScope.collegeId };

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

const getOversightList = async (req, res, next) => {
	try {
		const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
		const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
		const search = String(req.query.search || '').trim();
		const statusFilter = req.query.status ? String(req.query.status).toLowerCase() : null;
		const assetScopeWhere = cleanWhere(req);

		const maintenanceWhere = {};
		if (statusFilter && ['pending', 'approved', 'assigned', 'in-progress', 'waiting-for-parts', 'testing', 'completed', 'rejected', 'cancelled'].includes(statusFilter)) {
			maintenanceWhere.status = statusFilter;
		}

		let searchConditions = [];
		if (search) {
			searchConditions = [
				{ '$Asset.name$': { [Op.like]: `%${search}%` } },
				{ '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
				{ title: { [Op.like]: `%${search}%` } },
				{ description: { [Op.like]: `%${search}%` } },
				{ '$Requester.fullName$': { [Op.like]: `%${search}%` } },
				{ '$Technician.fullName$': { [Op.like]: `%${search}%` } },
				{ '$MaintenanceWorkOrders.workOrderNumber$': { [Op.like]: `%${search}%` } },
			];
		}

		const maintenanceWhere_final = search ? { ...maintenanceWhere, [Op.or]: searchConditions } : maintenanceWhere;

		const assetInclude = {
			model: Asset,
			attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'departmentId', 'collegeId', 'location', 'status', 'condition'],
			where: assetScopeWhere,
			required: true,
		};

		const { count, rows } = await Maintenance.findAndCountAll({
			where: maintenanceWhere_final,
			include: [
				assetInclude,
				{ model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
				{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
				{
					model: MaintenanceWorkOrder,
					attributes: ['id', 'workOrderNumber', 'technicianId', 'status', 'startDate', 'expectedCompletionDate', 'actualCompletionDate', 'estimatedCost', 'actualCost', 'priority'],
					include: [{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] }],
					required: false,
				},
				{
					model: MaintenanceCost,
					attributes: ['id', 'costCategory', 'amount', 'quantity', 'unitCost', 'costDate', 'status', 'description'],
					required: false,
				},
				{
					model: MaintenanceHistory,
					attributes: ['id', 'actionType', 'actionDescription', 'actionDate', 'performedBy'],
					required: false,
					order: [['actionDate', 'DESC']],
					limit: 5,
				},
			],
			order: [['createdAt', 'DESC']],
			limit,
			offset: (page - 1) * limit,
			distinct: true,
			subQuery: false,
		});

		// Enhance rows with work order and cost details
		const enhancedRows = rows.map((row) => {
			const data = row.toJSON();
			const workOrders = Array.isArray(data.MaintenanceWorkOrders) ? data.MaintenanceWorkOrders : [];
			const latestWorkOrder = workOrders.length > 0 ? workOrders[0] : null;
			const costs = Array.isArray(data.MaintenanceCosts) ? data.MaintenanceCosts : [];

			const costSummary = costs.reduce((acc, cost) => {
				const amount = Number(cost.amount || 0);
				acc.totalCost += amount;
				acc[cost.costCategory] = (acc[cost.costCategory] || 0) + amount;
				return acc;
			}, { totalCost: 0, labor: 0, parts: 0, service: 0, repair: 0, other: 0, materials: 0 });

			const isOverdue = latestWorkOrder && latestWorkOrder.expectedCompletionDate && new Date(latestWorkOrder.expectedCompletionDate) < new Date() && !['completed', 'cancelled'].includes(latestWorkOrder.status);

			return {
				...data,
				workOrder: latestWorkOrder,
				workOrderCount: workOrders.length,
				costBreakdown: costSummary,
				isOverdue,
				history: Array.isArray(data.MaintenanceHistories) ? data.MaintenanceHistories : [],
			};
		});

		// Summary statistics
		const summary = enhancedRows.reduce((acc, row) => {
			acc.total += 1;
			const status = String(row.status || '').toLowerCase();
			acc[status] = (acc[status] || 0) + 1;
			if (row.isOverdue) acc.overdue = (acc.overdue || 0) + 1;
			return acc;
		}, { total: 0, pending: 0, approved: 0, assigned: 0, 'in-progress': 0, 'waiting-for-parts': 0, testing: 0, completed: 0, rejected: 0, cancelled: 0, overdue: 0 });

		res.json({ success: true, data: enhancedRows, summary, total: count, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
	} catch (error) { next(error); }
};

const getOversightDetail = async (req, res, next) => {
	try {
		const assetScopeWhere = cleanWhere(req);
		const row = await Maintenance.findOne({
			where: { id: req.params.id },
			include: [
				{ model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'departmentId', 'collegeId', 'location', 'status', 'condition', 'purchaseDate', 'warrantyExpiry'], where: assetScopeWhere, required: true },
				{ model: User, as: 'Requester', attributes: ['id', 'username', 'fullName'] },
				{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName'] },
				{
					model: MaintenanceWorkOrder,
					attributes: ['id', 'workOrderNumber', 'technicianId', 'status', 'startDate', 'expectedCompletionDate', 'actualCompletionDate', 'estimatedCost', 'actualCost', 'priority', 'diagnosis', 'problemDescription', 'requiredWork', 'notes'],
					include: [{ model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'department'] }],
					order: [['createdAt', 'DESC']],
					limit: 10,
				},
				{
					model: MaintenanceCost,
					attributes: ['id', 'costCategory', 'amount', 'quantity', 'unitCost', 'costDate', 'status', 'description', 'approvedBy'],
					order: [['costDate', 'DESC']],
				},
				{
					model: MaintenanceHistory,
					attributes: ['id', 'actionType', 'actionDescription', 'actionDate', 'performedBy', 'previousStatus', 'newStatus'],
					order: [['actionDate', 'DESC']],
					limit: 50,
				},
			],
		});

		if (!row) return res.status(404).json({ success: false, message: 'Maintenance record not found in your scope' });

		const data = row.toJSON();
		const workOrders = Array.isArray(data.MaintenanceWorkOrders) ? data.MaintenanceWorkOrders : [];
		const costs = Array.isArray(data.MaintenanceCosts) ? data.MaintenanceCosts : [];

		const costSummary = costs.reduce((acc, cost) => {
			const amount = Number(cost.amount || 0);
			acc.totalCost += amount;
			acc[cost.costCategory] = (acc[cost.costCategory] || 0) + amount;
			return acc;
		}, { totalCost: 0, labor: 0, parts: 0, service: 0, repair: 0, other: 0, materials: 0 });

		res.json({
			success: true,
			data: {
				...data,
				workOrders,
				costBreakdown: costSummary,
				costDetails: costs,
				history: Array.isArray(data.MaintenanceHistories) ? data.MaintenanceHistories : [],
			},
		});
	} catch (error) { next(error); }
};

module.exports = { listRequests, getRequest, createRequest, cancelRequest, getOversightList, getOversightDetail };
