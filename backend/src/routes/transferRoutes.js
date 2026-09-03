const express = require('express');
const { sequelize, Transfer, Asset, Assignment, User, Department, AuditLog } = require('../models');
const { Op } = require('sequelize');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const canManageTransfers = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager')];
const canRequestTransfers = [requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college')];

const toTransferResponse = (transfer) => {
  const data = transfer.toJSON();
  return {
    ...data,
    asset_id: data.assetId,
    source_department: data.sourceDepartment,
    destination_department: data.destinationDepartment,
    current_location: data.currentLocation,
    new_location: data.newLocation,
    transfer_reason: data.transferReason,
    transfer_date: data.transferDate,
    created_by: data.createdBy,
    approved_by: data.approvedBy,
    approval_date: data.approvalDate,
    asset_name: transfer.Asset?.name,
    asset_code: transfer.Asset?.assetCode,
    created_by_name: transfer.Creator?.username,
    approved_by_name: transfer.Approver?.username,
  };
};

const transferInclude = [
  { model: Asset, attributes: ['assetCode', 'name'] },
  { model: User, attributes: ['username', 'fullName'], as: 'Creator' },
  { model: User, attributes: ['username', 'fullName'], as: 'Approver' },
];

const ACTIVE_STATUSES = ['Pending', 'Approved', 'In Progress'];
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'In Progress', 'Completed', 'Cancelled'];

const resolveDepartment = async (value, transaction) => {
  if (!value) return null;
  const department = await Department.findByPk(value, { transaction })
    || await Department.findOne({ where: { name: String(value).trim() }, transaction });
  return department;
};

const validateTransferDate = (value) => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTransferBlockedStatus = (asset) => {
  const status = String(asset.status || '').toLowerCase().replace(/[_ ]/g, '-');
  return ['under-maintenance', 'lost', 'retired'].includes(status) ? asset.status : null;
};

// Get all transfers
router.get('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college'), async (req, res, next) => {
  try {
    const assetScope = req.user.role === 'college' ? { department: req.user.department } : undefined;
    const transfers = await Transfer.findAll({
      include: assetScope ? [{ model: Asset, attributes: ['assetCode', 'name', 'department'], where: assetScope, required: true }, ...transferInclude.slice(1)] : transferInclude,
      order: [['createdAt', 'DESC']]
    });
    res.json({
      success: true,
      data: transfers.map(toTransferResponse),
      transfers: transfers.map(toTransferResponse)
    });
  } catch (error) {
    next(error);
  }
});

// Get transfer by ID
router.get('/:id', requireAuth, requireRole('admin', 'ict_officer', 'store_manager', 'college'), async (req, res, next) => {
  try {
    const transfer = await Transfer.findByPk(req.params.id, { include: transferInclude });
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }
    if (req.user.role === 'college' && transfer.Asset?.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'Department access denied' });
    }
    res.json({ success: true, data: toTransferResponse(transfer) });
  } catch (error) {
    next(error);
  }
});

// Create transfer
router.post('/', ...canRequestTransfers, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { assetId, destinationDepartment, newLocation, transferReason, transferDate, notes } = req.body;

    if (!assetId || !destinationDepartment || !newLocation || !String(transferReason || '').trim()) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Asset, destination department, destination location, and transfer reason are required'
      });
    }

    const date = validateTransferDate(transferDate);
    if (!date) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid transfer date' });
    }

    const asset = await Asset.findByPk(assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    if (req.user.role === 'college' && asset.department !== req.user.department) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Department access denied' });
    }

    const blockedStatus = getTransferBlockedStatus(asset);
    if (blockedStatus) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: `Asset is not eligible for transfer while its status is ${blockedStatus}` });
    }

    const destination = await resolveDepartment(destinationDepartment, transaction);
    if (!destination) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Destination department not found' });
    }
    if (String(asset.department || '').trim() === destination.name && String(asset.location || '').trim() === String(newLocation).trim()) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset is already in the requested destination' });
    }

    const duplicate = await Transfer.findOne({ where: { assetId: asset.id, status: { [Op.in]: ACTIVE_STATUSES } }, transaction, lock: transaction.LOCK.UPDATE });
    if (duplicate) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Asset already has a pending transfer' });
    }

    const transfer = await Transfer.create({
      assetId,
      sourceDepartment: asset.department || '',
      destinationDepartment: destination.name,
      currentLocation: asset.location || '',
      newLocation: String(newLocation).trim(),
      transferReason: String(transferReason).trim(),
      transferDate: date,
      status: 'Pending',
      notes: notes || '',
      createdBy: req.user.id
    }, { transaction });

    await AuditLog.create({ userId: req.user.id, action: 'CREATE_TRANSFER', entity: `asset:${asset.id}`, details: JSON.stringify({ transferId: transfer.id, assetId: asset.id }) }, { transaction });
    await transaction.commit();
    const populatedTransfer = await Transfer.findByPk(transfer.id, { include: transferInclude });
    res.status(201).json({ success: true, data: toTransferResponse(populatedTransfer) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// Update transfer
router.put('/:id', ...canManageTransfers, async (req, res, next) => {
  try {
    const transfer = await Transfer.findByPk(req.params.id);
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    // Don't allow status updates via PUT (use PATCH for status changes)
    const { status, ...updateData } = req.body;

    await transfer.update(updateData);
    const updatedTransfer = await Transfer.findByPk(transfer.id, { include: transferInclude });
    res.json({ success: true, data: toTransferResponse(updatedTransfer) });
  } catch (error) {
    next(error);
  }
});

// Update transfer (via PATCH with status)
router.patch('/:id', ...canManageTransfers, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { status, ...updateData } = req.body;
    const transfer = await Transfer.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });

    if (!transfer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    // Update data
    if (Object.keys(updateData).length > 0) {
      await transfer.update(updateData);
    }

    // Handle status changes
    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: `Invalid status. Valid statuses: ${VALID_STATUSES.join(', ')}` });
      }

      await transfer.update({
        status,
        approvedBy: status === 'Approved' ? req.user.id : transfer.approvedBy,
        approvalDate: status === 'Approved' ? new Date() : transfer.approvalDate
      });

      if (status === 'Completed') {
        const asset = await Asset.findByPk(transfer.assetId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!asset) {
          await transaction.rollback();
          return res.status(404).json({ success: false, message: 'Asset not found' });
        }
        const blockedStatus = getTransferBlockedStatus(asset);
        if (blockedStatus) {
          await transaction.rollback();
          return res.status(409).json({ success: false, message: `Asset is not eligible for transfer while its status is ${blockedStatus}` });
        }
        await asset.update({ department: transfer.destinationDepartment, location: transfer.newLocation }, { transaction });
        const assignment = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' }, transaction, lock: transaction.LOCK.UPDATE });
        if (assignment) {
          let notes = {};
          try { notes = JSON.parse(assignment.notes || '{}'); } catch (error) { notes = {}; }
          await assignment.update({ notes: JSON.stringify({ ...notes, department: transfer.destinationDepartment, location: transfer.newLocation }) }, { transaction });
        }
        await AuditLog.create({ userId: req.user.id, action: 'COMPLETE_TRANSFER', entity: `asset:${asset.id}`, details: JSON.stringify({ transferId: transfer.id, destinationDepartment: transfer.destinationDepartment, destinationLocation: transfer.newLocation }) }, { transaction });
      }
    }

    await transaction.commit();
    const updatedTransfer = await Transfer.findByPk(transfer.id, { include: transferInclude });
    res.json({ success: true, data: toTransferResponse(updatedTransfer) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// Delete transfer
router.delete('/:id', ...canManageTransfers, async (req, res, next) => {
  try {
    const transfer = await Transfer.findByPk(req.params.id);
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found' });
    }

    await transfer.destroy();
    res.json({ success: true, message: 'Transfer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
