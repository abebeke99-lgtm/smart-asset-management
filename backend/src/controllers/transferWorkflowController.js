const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, Transfer, Asset, Department, User, AssetMovement, AuditLog } = require('../models');

const ACTIVE = ['Requested', 'Approved', 'Ready', 'In Transit'];
const transitions = {
  Requested: ['Approved', 'Rejected', 'Cancelled'],
  Approved: ['Ready', 'Cancelled'],
  Ready: ['In Transit'],
  'In Transit': ['Received', 'Cancelled'],
  Received: [], Rejected: [], Cancelled: [],
};
const number = () => `TR-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
const scopeWhere = (req) => !req.organizationScope ? {} : req.organizationScope.departmentId ? { [Op.or]: [{ sourceDepartmentId: req.organizationScope.departmentId }, { destinationDepartmentId: req.organizationScope.departmentId }] } : { [Op.or]: [{ sourceCollegeId: req.organizationScope.collegeId }, { destinationCollegeId: req.organizationScope.collegeId }] };
const normalize = (item) => ({ ...item.toJSON(), transfer_number: item.transferNumber, source_department_id: item.sourceDepartmentId, destination_department_id: item.destinationDepartmentId });

const listTransfers = async (req, res, next) => {
  try {
    const where = { ...scopeWhere(req) };
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.search) where.transferNumber = { [Op.like]: `%${String(req.query.search).trim()}%` };
    const rows = await Transfer.findAll({ where, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rows.map(normalize), transfers: rows.map(normalize) });
  } catch (error) { next(error); }
};

const getTransfer = async (req, res, next) => {
  try {
    const row = await Transfer.findOne({ where: { id: req.params.id, ...scopeWhere(req) } });
    if (!row) return res.status(404).json({ success: false, message: 'Transfer not found in your scope' });
    res.json({ success: true, data: normalize(row) });
  } catch (error) { next(error); }
};

const createTransfer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { asset_id: assetId, destination_department_id: destinationDepartmentId, destination_location: destinationLocation, reason } = req.body;
    if (!assetId || !destinationDepartmentId || !String(reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Asset, destination department, and reason are required' }); }
    const assetWhere = req.organizationScope.departmentId ? { id: assetId, departmentId: req.organizationScope.departmentId } : { id: assetId, collegeId: req.organizationScope.collegeId };
    const asset = await Asset.findOne({ where: assetWhere, transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Asset is outside your organization scope' }); }
    if (['disposed', 'missing', 'under-maintenance', 'in-maintenance'].includes(String(asset.status).toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset is not eligible for transfer' }); }
    const destination = await Department.findOne({ where: { id: destinationDepartmentId, collegeId: asset.collegeId, status: 'active' }, transaction });
    if (!destination || destination.id === asset.departmentId) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'Destination department is invalid' }); }
    const duplicate = await Transfer.findOne({ where: { assetId, status: { [Op.in]: ACTIVE } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset already has an active transfer' }); }
    const row = await Transfer.create({ transferNumber: number(), assetId: asset.id, sourceCollegeId: asset.collegeId, sourceDepartmentId: asset.departmentId, sourceDepartment: asset.department || '', destinationCollegeId: destination.collegeId, destinationDepartmentId: destination.id, destinationDepartment: destination.name, currentLocation: asset.location || '', newLocation: String(destinationLocation || '').trim(), transferReason: String(reason).trim(), requestedBy: req.user.id, createdBy: req.user.id, requestedAt: new Date(), status: 'Requested' }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'TRANSFER_CREATED', entity: `transfer:${row.id}`, details: JSON.stringify({ beforeStatus: null, afterStatus: row.status, assetId: asset.id }) }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, message: 'Transfer request created', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

const changeTransfer = (target, roles) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const row = await Transfer.findOne({ where: { id: req.params.id, ...scopeWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Transfer not found in your scope' }); }
    if (!roles.includes(req.user.role)) { await transaction.rollback(); return res.status(403).json({ success: false, message: 'Transfer action is not authorized' }); }
    if (!transitions[row.status]?.includes(target)) { await transaction.rollback(); return res.status(409).json({ success: false, message: `Invalid transfer transition from ${row.status} to ${target}` }); }
    if (target === 'Approved' && row.requestedBy === req.user.id) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A requester cannot approve their own transfer' }); }
    if (['Rejected', 'Cancelled'].includes(target) && !String(req.body.reason || '').trim()) { await transaction.rollback(); return res.status(400).json({ success: false, message: 'A reason is required' }); }
    const before = row.status;
    const updates = { status: target };
    if (target === 'Approved') Object.assign(updates, { approvedBy: req.user.id, approvalDate: new Date(), approvalReason: String(req.body.reason || '').trim() });
    if (target === 'Ready') updates.readyAt = new Date();
    if (target === 'In Transit') Object.assign(updates, { dispatchedBy: req.user.id, dispatchedAt: new Date() });
    if (target === 'Received') Object.assign(updates, { receivedBy: req.user.id, receivedAt: new Date() });
    await row.update(updates, { transaction });
    if (target === 'Received') {
      const asset = await Asset.findByPk(row.assetId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!asset || asset.status === 'disposed' || asset.status === 'missing') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Asset cannot be received in its current state' }); }
      await asset.update({ collegeId: row.destinationCollegeId, departmentId: row.destinationDepartmentId, department: row.destinationDepartment, location: row.newLocation }, { transaction });
      await AssetMovement.create({ assetId: asset.id, movementType: 'transfer', sourceType: 'department', sourceId: row.sourceDepartmentId, destinationType: 'department', destinationId: row.destinationDepartmentId, referenceType: 'transfer', referenceId: row.id, performedBy: req.user.id, notes: String(req.body.notes || '').trim() }, { transaction });
    }
    await AuditLog.create({ userId: req.user.id, action: `TRANSFER_${target.replace(/ /g, '_').toUpperCase()}`, entity: `transfer:${row.id}`, details: JSON.stringify({ beforeStatus: before, afterStatus: target, reason: req.body.reason || '' }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Transfer status updated', data: normalize(row) });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listTransfers, getTransfer, createTransfer, approveTransfer: changeTransfer('Approved', ['college', 'admin']), rejectTransfer: changeTransfer('Rejected', ['college', 'admin']), cancelTransfer: changeTransfer('Cancelled', ['department_head', 'college', 'admin']), readyTransfer: changeTransfer('Ready', ['store_manager']), dispatchTransfer: changeTransfer('In Transit', ['store_manager']), receiveTransfer: changeTransfer('Received', ['store_manager']) };
