const express = require('express');
const path = require('path');
const fs = require('fs');
const { getAllMaintenance, getPreventiveMaintenance, getPreventiveMaintenanceById, createPreventiveMaintenance, updatePreventiveMaintenance, deletePreventiveMaintenance, activatePreventiveMaintenance, startPreventiveMaintenance, pausePreventiveMaintenance, resumePreventiveMaintenance, assignPreventiveMaintenance, updatePreventiveChecklist, updatePreventiveFindings, completePreventiveMaintenance, getMaintenanceHistory, createMaintenance, updateMaintenance, setStatus, approve, reject, start, complete, assign, removeMaintenance, dashboard, getMaintenanceCalendar, getTechnicianDirectory, getMaintenanceWorkOrders, getMaintenanceWorkOrder, getMaintenanceWorkOrderOptions, createMaintenanceWorkOrder, updateMaintenanceWorkOrder, updateMaintenanceWorkOrderStatus, assignMaintenanceWorkOrder, getRepairHistory, getRepairDetails, createRepair, updateRepair, getSpareParts, getSparePartDetail, listMaintenanceVendors, getMaintenanceVendor, createMaintenanceVendor, updateMaintenanceVendor, setMaintenanceVendorStatus, getMaintenanceReportsSummary, getMaintenanceReportsActivity, getMaintenanceReportsHistory, getMaintenanceReportsWorkOrders, getMaintenanceReportsRepairs, getMaintenanceReportsPreventive, getMaintenanceReportsAssets, getMaintenanceReportsTechnicians, getMaintenanceReportsVendors, getMaintenanceReportsTesting, getMaintenanceReportsCosts, getMaintenanceReportsDowntime, getMaintenanceReportsDepartments } = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const inspectionController = require('../controllers/maintenanceInspectionController');
const testingController = require('../controllers/maintenanceTestingController');
const { sequelize, Config, Notification, AuditLog, MaintenanceHistory, MaintenanceQualityControl, MaintenanceQualityControlItem, MaintenanceTest, MaintenanceWorkOrder, Asset, Maintenance, User } = require('../models');
const { Op } = require('sequelize');
const { validateQcDecision, normalizeQcStatus, resolveQcStatusForDecision, isTestEligibleForQualityControl } = require('../utils/maintenanceQualityControl');
const notificationService = require('../services/notificationService');

const router = express.Router();

const maintenanceReadAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'college', 'store_manager')];
router.get('/', ...maintenanceReadAccess, getAllMaintenance);
router.get('/scheduled', ...maintenanceReadAccess, getAllMaintenance);
router.get('/assets-under-maintenance', ...maintenanceReadAccess, require('../controllers/maintenanceController').getAssetsUnderMaintenance);
router.get('/assets-under-maintenance/:id', ...maintenanceReadAccess, require('../controllers/maintenanceController').getAssetMaintenanceDetail);
router.get('/assets-under-maintenance/:id/timeline', ...maintenanceReadAccess, async (req, res, next) => {
  try {
    const asset = await require('../controllers/maintenanceController').getAssetMaintenanceDetail(req, res, next);
    if (asset) return asset;
  } catch (error) { return next(error); }
});
router.get('/preventive', ...maintenanceReadAccess, getPreventiveMaintenance);
router.get('/preventive/:id', ...maintenanceReadAccess, getPreventiveMaintenanceById);
router.post('/preventive', ...maintenanceReadAccess, createPreventiveMaintenance);
router.put('/preventive/:id', ...maintenanceReadAccess, updatePreventiveMaintenance);
router.delete('/preventive/:id', ...maintenanceReadAccess, deletePreventiveMaintenance);
router.patch('/preventive/:id/activate', ...maintenanceReadAccess, activatePreventiveMaintenance);
router.patch('/preventive/:id/start', ...maintenanceReadAccess, startPreventiveMaintenance);
router.patch('/preventive/:id/pause', ...maintenanceReadAccess, pausePreventiveMaintenance);
router.patch('/preventive/:id/resume', ...maintenanceReadAccess, resumePreventiveMaintenance);
router.patch('/preventive/:id/assign', ...maintenanceReadAccess, assignPreventiveMaintenance);
router.patch('/preventive/:id/checklist', ...maintenanceReadAccess, updatePreventiveChecklist);
router.patch('/preventive/:id/findings', ...maintenanceReadAccess, updatePreventiveFindings);
router.post('/preventive/:id/complete', ...maintenanceReadAccess, completePreventiveMaintenance);
router.get('/history', ...maintenanceReadAccess, getMaintenanceHistory);
router.get('/reports', ...maintenanceReadAccess, getMaintenanceReportsSummary);
router.get('/reports/summary', ...maintenanceReadAccess, getMaintenanceReportsSummary);
router.get('/reports/activity', ...maintenanceReadAccess, getMaintenanceReportsActivity);
router.get('/reports/history', ...maintenanceReadAccess, getMaintenanceReportsHistory);
router.get('/reports/work-orders', ...maintenanceReadAccess, getMaintenanceReportsWorkOrders);
router.get('/reports/repairs', ...maintenanceReadAccess, getMaintenanceReportsRepairs);
router.get('/reports/preventive', ...maintenanceReadAccess, getMaintenanceReportsPreventive);
router.get('/reports/assets', ...maintenanceReadAccess, getMaintenanceReportsAssets);
router.get('/reports/technicians', ...maintenanceReadAccess, getMaintenanceReportsTechnicians);
router.get('/reports/vendors', ...maintenanceReadAccess, getMaintenanceReportsVendors);
router.get('/reports/testing', ...maintenanceReadAccess, getMaintenanceReportsTesting);
router.get('/reports/costs', ...maintenanceReadAccess, getMaintenanceReportsCosts);
router.get('/reports/downtime', ...maintenanceReadAccess, getMaintenanceReportsDowntime);
router.get('/reports/departments', ...maintenanceReadAccess, getMaintenanceReportsDepartments);
router.get('/dashboard', ...maintenanceReadAccess, dashboard);
router.get('/calendar', ...maintenanceReadAccess, getMaintenanceCalendar);
router.get('/spare-parts', ...maintenanceReadAccess, getSpareParts);
router.get('/spare-parts/:id', ...maintenanceReadAccess, getSparePartDetail);
router.get('/technicians', ...maintenanceReadAccess, getTechnicianDirectory);
router.get('/work-orders', ...maintenanceReadAccess, getMaintenanceWorkOrders);
router.get('/work-orders/options', ...maintenanceReadAccess, getMaintenanceWorkOrderOptions);
router.get('/work-orders/:id', ...maintenanceReadAccess, getMaintenanceWorkOrder);
router.post('/work-orders', ...maintenanceReadAccess, createMaintenanceWorkOrder);
router.put('/work-orders/:id', ...maintenanceReadAccess, updateMaintenanceWorkOrder);
router.patch('/work-orders/:id/status', ...maintenanceReadAccess, updateMaintenanceWorkOrderStatus);
router.patch('/work-orders/:id/assign', ...maintenanceReadAccess, assignMaintenanceWorkOrder);

const qualityControlAccess = [requireAuth, requireRole('admin', 'maintenance', 'ict_officer', 'quality_control_reviewer')];
router.get('/quality-control', ...qualityControlAccess, async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const where = {};
    if (status) where.status = normalizeQcStatus(status);
    if (search) {
      where[Op.or] = [
        { id: Number.isInteger(Number(search)) ? Number(search) : null },
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
        { '$Maintenance.title$': { [Op.like]: `%${search}%` } },
        { '$Technician.fullName$': { [Op.like]: `%${search}%` } },
        { '$Tester.fullName$': { [Op.like]: `%${search}%` } },
        { '$Reviewer.fullName$': { [Op.like]: `%${search}%` } },
      ].filter(Boolean);
    }
    const { rows, count } = await MaintenanceQualityControl.findAndCountAll({
      where,
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'department', 'location'] },
        { model: Maintenance, attributes: ['id', 'title', 'status', 'priority'] },
        { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'] },
        { model: User, as: 'Tester', attributes: ['id', 'fullName', 'username'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'fullName', 'username'] },
        { model: MaintenanceQualityControlItem, as: 'ChecklistItems', attributes: ['id', 'requirement', 'expectedCondition', 'actualCondition', 'result', 'notes', 'required'] },
      ],
      order: [['reviewDate', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const summary = {
      pending: rows.filter((item) => item.status === 'pending').length,
      inReview: rows.filter((item) => item.status === 'in-review').length,
      approved: rows.filter((item) => item.decision === 'approved').length,
      rejected: rows.filter((item) => item.decision === 'rejected').length,
      conditionalApproval: rows.filter((item) => item.decision === 'conditional-approval').length,
      retestRequired: rows.filter((item) => item.decision === 'retest-required').length,
      readyForReturn: rows.filter((item) => item.readyForReturn).length,
      overdueReviews: rows.filter((item) => item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'approved').length,
    };
    res.json({ success: true, data: rows.map((item) => item.toJSON()), summary, pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) } });
  } catch (error) { next(error); }
});
router.get('/quality-control/:id', ...qualityControlAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceQualityControl.findOne({
      where: { id: req.params.id },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'category', 'status', 'department', 'location'] },
        { model: Maintenance, attributes: ['id', 'title', 'status', 'priority'] },
        { model: User, as: 'Technician', attributes: ['id', 'fullName', 'username'] },
        { model: User, as: 'Tester', attributes: ['id', 'fullName', 'username'] },
        { model: User, as: 'Reviewer', attributes: ['id', 'fullName', 'username'] },
        { model: MaintenanceQualityControlItem, as: 'ChecklistItems', attributes: ['id', 'requirement', 'expectedCondition', 'actualCondition', 'result', 'notes', 'required'] },
      ],
    });
    if (!item) return res.status(404).json({ success: false, message: 'Quality control review not found' });
    return res.json({ success: true, data: item.toJSON() });
  } catch (error) { next(error); }
});
router.post('/quality-control', ...qualityControlAccess, async (req, res, next) => {
  try {
    const body = req.body || {};
    const assetId = Number(body.assetId ?? body.asset_id);
    const maintenanceId = Number(body.maintenanceId ?? body.maintenance_id);
    if (!assetId || !maintenanceId) return res.status(422).json({ success: false, message: 'Asset and maintenance record are required' });
    const [asset, maintenance, workOrder] = await Promise.all([
      Asset.findByPk(assetId),
      Maintenance.findByPk(maintenanceId),
      body.workOrderId || body.work_order_id ? MaintenanceWorkOrder.findByPk(Number(body.workOrderId ?? body.work_order_id)) : null,
    ]);
    if (!asset) return res.status(404).json({ success: false, message: 'Asset not found' });
    if (!maintenance) return res.status(404).json({ success: false, message: 'Maintenance record not found' });
    if (workOrder && Number(workOrder.assetId) !== Number(assetId)) return res.status(422).json({ success: false, message: 'The selected work order must match the asset' });
    const testId = body.testId ?? body.test_id ?? null;
    if (testId) {
      const testRecord = await MaintenanceTest.findByPk(testId);
      if (!testRecord) return res.status(404).json({ success: false, message: 'Test record not found' });
      if (Number(testRecord.maintenanceId) !== Number(maintenanceId) || Number(testRecord.assetId) !== Number(assetId)) return res.status(422).json({ success: false, message: 'The test record must belong to the same maintenance and asset' });
    }
    const entry = await MaintenanceQualityControl.create({
      maintenanceId,
      workOrderId: workOrder ? workOrder.id : (body.workOrderId ?? body.work_order_id ?? null),
      assetId,
      testId,
      technicianId: body.technicianId ?? body.technician_id ?? maintenance.assignedTo ?? null,
      testerId: body.testerId ?? body.tester_id ?? null,
      reviewerId: body.reviewerId ?? body.reviewer_id ?? req.user.id,
      reviewDate: body.reviewDate || new Date(),
      dueDate: body.dueDate || body.reviewDueDate || null,
      status: body.status || 'pending',
      decision: body.decision || 'pending',
      findings: body.findings || '',
      rejectionReason: body.rejectionReason || '',
      failedRequirement: body.failedRequirement || '',
      correctiveAction: body.correctiveAction || '',
      conditions: body.conditions || '',
      notes: body.notes || '',
      requiredChecklistCompleted: Boolean(body.requiredChecklistCompleted),
      documentationComplete: Boolean(body.documentationComplete),
      readyForReturn: Boolean(body.readyForReturn),
    });
    const checklist = Array.isArray(body.checklist) ? body.checklist : [];
    if (checklist.length) {
      await Promise.all(checklist.map((item) => MaintenanceQualityControlItem.create({
        qualityControlId: entry.id,
        requirement: String(item.requirement || '').trim(),
        expectedCondition: item.expectedCondition || '',
        actualCondition: item.actualCondition || '',
        result: String(item.result || 'pass').trim() || 'pass',
        notes: item.notes || '',
        required: item.required !== false,
      })));
    }
    return res.status(201).json({ success: true, data: entry.toJSON() });
  } catch (error) { next(error); }
});
const decideQualityControl = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const review = await MaintenanceQualityControl.findByPk(req.params.id, { include: [{ model: MaintenanceQualityControlItem, as: 'ChecklistItems' }], transaction, lock: transaction.LOCK.UPDATE });
    if (!review) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Quality control review not found' }); }
    if (['approved', 'rejected'].includes(String(review.decision || '').toLowerCase())) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This quality control review already has a final decision' }); }
    const testRecord = review.testId ? await MaintenanceTest.findByPk(review.testId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    const validation = validateQcDecision(req.body.decision, req.body, testRecord || { maintenanceId: review.maintenanceId, assetId: review.assetId, status: 'completed', overallResult: 'Passed' });
    if (validation.message) { await transaction.rollback(); return res.status(422).json({ success: false, message: validation.message }); }
    const maintenance = await Maintenance.findByPk(review.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!maintenance) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance request not found' }); }
    const asset = validation.decision === 'rejected' ? await Asset.findByPk(review.assetId, { transaction, lock: transaction.LOCK.UPDATE }) : null;
    if (validation.decision === 'rejected' && !asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousValue = { status: review.status, decision: review.decision, readyForReturn: review.readyForReturn };
    const previousMaintenanceStatus = maintenance.status;
    const updates = {
      reviewerId: req.body.reviewerId ?? req.body.reviewer_id ?? review.reviewerId ?? req.user.id,
      decision: validation.decision,
      status: resolveQcStatusForDecision(validation.decision, req.body.status),
      findings: req.body.findings || review.findings || '',
      rejectionReason: req.body.rejectionReason || review.rejectionReason || '',
      failedRequirement: req.body.failedRequirement || review.failedRequirement || '',
      correctiveAction: req.body.correctiveAction || review.correctiveAction || '',
      conditions: req.body.conditions || review.conditions || '',
      notes: req.body.notes || review.notes || '',
      readyForReturn: validation.decision === 'approved',
      reviewDate: req.body.reviewDate || new Date(),
      requiredChecklistCompleted: true,
      documentationComplete: req.body.documentationComplete !== undefined ? Boolean(req.body.documentationComplete) : review.documentationComplete,
    };
    await review.update(updates, { transaction });
    if (testRecord) {
      await testRecord.update({ qualityStatus: validation.decision, reviewerId: req.user.id, reviewedAt: updates.reviewDate, rejectionReason: updates.rejectionReason, correctiveAction: updates.correctiveAction }, { transaction });
    }
    if (validation.decision === 'rejected') {
      await maintenance.update({ status: 'in-progress' }, { transaction });
      await asset.update({ status: 'under-maintenance' }, { transaction });
      await MaintenanceHistory.create({
        assetId: review.assetId,
        maintenanceId: maintenance.id,
        userId: req.user.id,
        actionType: 'qc_failed',
        actionDate: updates.reviewDate,
        previousStatus: previousMaintenanceStatus,
        newStatus: 'in-progress',
        description: `Quality control failed: ${updates.rejectionReason}`,
        details: { qualityControlId: review.id, failedRequirement: updates.failedRequirement, correctiveAction: updates.correctiveAction },
      }, { transaction });
    }
    const nextValue = { status: updates.status, decision: validation.decision, readyForReturn: updates.readyForReturn, maintenanceStatus: validation.decision === 'rejected' ? 'in-progress' : previousMaintenanceStatus, assetStatus: validation.decision === 'rejected' ? 'under-maintenance' : undefined };
    await AuditLog.create({ userId: req.user.id, action: 'QC_DECISION', entity: `quality_control:${review.id}`, details: JSON.stringify({ actorRole: req.user.role, testId: review.testId, previousValue, newValue: nextValue, reason: updates.rejectionReason, failedRequirement: updates.failedRequirement, correctiveAction: updates.correctiveAction }) }, { transaction });
    await transaction.commit();
    try {
      await notificationService.createEventNotification({
        event: 'maintenance_qc_decision',
        eventKey: `maintenance_qc_decision:${review.id}:${validation.decision}`,
        entityId: review.id,
        userIds: [review.technicianId, review.testerId, maintenance?.requestedBy].filter(Boolean),
        senderId: req.user.id,
        assetId: review.assetId,
        type: 'maintenance',
        title: `Quality control ${validation.decision}`,
        message: `Quality review ${review.id} for maintenance request ${review.maintenanceId} was ${validation.decision}.`,
      });
    } catch (notificationError) { console.error('Maintenance QC decision notification failed:', notificationError.message); }
    return res.json({ success: true, data: review.toJSON() });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};
router.patch('/quality-control/:id/decision', ...qualityControlAccess, decideQualityControl);
router.patch('/quality-control/:id/start', ...qualityControlAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceQualityControl.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Quality control review not found' });
    await item.update({ status: 'in-review', reviewerId: req.user.id, reviewDate: new Date() });
    return res.json({ success: true, data: item.toJSON() });
  } catch (error) { next(error); }
});
router.patch('/quality-control/:id/approve', ...qualityControlAccess, (req, res, next) => {
  req.body = { ...req.body, decision: 'approved' };
  return decideQualityControl(req, res, next);
});
router.patch('/quality-control/:id/reject', ...qualityControlAccess, (req, res, next) => {
  req.body = { ...req.body, decision: 'rejected' };
  return decideQualityControl(req, res, next);
});
router.patch('/quality-control/:id/retest', ...qualityControlAccess, async (req, res, next) => {
  try {
    const item = await MaintenanceQualityControl.findByPk(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Quality control review not found' });
    await item.update({ status: 'retest-required', decision: 'retest-required', reviewerId: req.user.id, notes: req.body.notes || item.notes || '', reviewDate: new Date() });
    return res.json({ success: true, data: item.toJSON() });
  } catch (error) { next(error); }
});
router.patch('/quality-control/:id/return-to-service', ...qualityControlAccess, async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceQualityControl.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Quality control review not found' }); }
    if (item.decision !== 'approved') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only approved items can be returned to service' }); }
    const maintenance = await Maintenance.findByPk(item.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!maintenance) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance request not found' }); }
    if (normalizeQcStatus(maintenance.status) === 'completed' || item.readyForReturn) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This maintenance request has already been returned to service' }); }
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Asset not found' }); }
    const previousMaintenanceStatus = maintenance.status;
    const previousAssetStatus = asset.status;
    await asset.update({ status: 'available' }, { transaction });
    await maintenance.update({ status: 'completed' }, { transaction });
    await item.update({ readyForReturn: true, status: 'approved' }, { transaction });
    await MaintenanceHistory.create({ assetId: item.assetId, maintenanceId: maintenance.id, userId: req.user.id, actionType: 'returned_to_service', actionDate: new Date(), previousStatus: previousMaintenanceStatus, newStatus: 'completed', description: 'Asset returned to service after quality approval', details: { qualityControlId: item.id, previousAssetStatus, newAssetStatus: 'available' } }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: 'MAINTENANCE_RETURNED_TO_SERVICE', entity: `maintenance:${maintenance.id}`, details: JSON.stringify({ actorRole: req.user.role, qualityControlId: item.id, previousMaintenanceStatus, newMaintenanceStatus: 'completed', previousAssetStatus, newAssetStatus: 'available' }) }, { transaction });
    await transaction.commit();
    try {
      await notificationService.createEventNotification({
        event: 'maintenance_completed',
        eventKey: `maintenance_completed:${maintenance.id}`,
        entityId: maintenance.id,
        userIds: [...new Set([maintenance.requestedBy, maintenance.assignedTo, item.technicianId].filter(Boolean))],
        senderId: req.user.id,
        assetId: item.assetId,
        type: 'maintenance',
        title: 'Maintenance completed',
        message: `Asset ${item.assetId} passed quality control and was returned to service.`,
      });
    } catch (notificationError) { console.error('Maintenance completion notification failed:', notificationError.message); }
    return res.json({ success: true, data: item.toJSON() });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
});
const vendorAccess = [requireAuth, requireRole('admin', 'maintenance', 'store_manager', 'finance')];
router.get('/vendors', ...vendorAccess, listMaintenanceVendors);
router.get('/vendors/:id', ...vendorAccess, getMaintenanceVendor);
router.post('/vendors', ...vendorAccess, createMaintenanceVendor);
router.put('/vendors/:id', ...vendorAccess, updateMaintenanceVendor);
router.patch('/vendors/:id/status', ...vendorAccess, setMaintenanceVendorStatus);
const repairAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance')];
const inspectionReadAccess = [requireAuth, requireRole('admin', 'maintenance', 'ict_officer')];
router.get('/inspections', ...inspectionReadAccess, inspectionController.listInspections);
router.get('/inspections/options', ...inspectionReadAccess, inspectionController.getInspectionOptions);
router.get('/inspections/:id', ...inspectionReadAccess, inspectionController.getInspection);
router.post('/inspections', ...inspectionReadAccess, inspectionController.createInspection);
router.put('/inspections/:id', ...inspectionReadAccess, inspectionController.updateInspection);
router.delete('/inspections/:id', requireAuth, requireRole('admin'), inspectionController.deleteInspection);
router.get('/repairs', ...repairAccess, getRepairHistory);
router.get('/repairs/:id', ...repairAccess, getRepairDetails);
router.post('/repairs', ...repairAccess, createRepair);
router.put('/repairs/:id', ...repairAccess, updateRepair);
const testingAccess = [requireAuth, requireRole('admin', 'maintenance', 'ict_officer')];
router.get('/testing', ...testingAccess, testingController.getMaintenanceTests);
router.get('/testing/options', ...testingAccess, testingController.getMaintenanceTestOptions);
router.get('/testing/:id', ...testingAccess, testingController.getMaintenanceTest);
router.post('/testing', ...testingAccess, testingController.createMaintenanceTest);
router.patch('/testing/:id/start', ...testingAccess, testingController.startMaintenanceTest);
router.patch('/testing/:id/complete', ...testingAccess, testingController.completeMaintenanceTest);
router.post('/testing/:id/retest', ...testingAccess, testingController.createMaintenanceRetest);
router.patch('/testing/:id/send-to-qc', ...testingAccess, testingController.sendMaintenanceTestToQuality);
router.patch('/testing/:id/quality', requireAuth, requireRole('admin'), testingController.reviewMaintenanceTestQuality);
router.patch('/testing/:id/return-to-service', requireAuth, requireRole('admin', 'maintenance'), testingController.returnMaintenanceTestToService);
const ictMaintenanceAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'store_manager')];
router.post('/', requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'college', 'store_manager'), createMaintenance);
router.put('/:id', ...ictMaintenanceAccess, updateMaintenance);
router.patch('/:id/status', ...ictMaintenanceAccess, setStatus);
router.patch('/:id/approve', ...ictMaintenanceAccess, approve);
router.patch('/:id/reject', ...ictMaintenanceAccess, reject);
router.patch('/:id/start', ...ictMaintenanceAccess, start);
router.post('/:id/complete', ...ictMaintenanceAccess, complete);
router.post('/:id/diagnosis', ...ictMaintenanceAccess, updateMaintenance);
router.post('/:id/reassign', ...ictMaintenanceAccess, assign);
router.delete('/:id', ...ictMaintenanceAccess, removeMaintenance);

const adminSystemActions = [requireAuth, requireRole('admin')];

router.post('/optimize-db', ...adminSystemActions, async (req, res, next) => {
  try {
    const [tables] = await sequelize.query('SHOW TABLES');
    const tableNames = tables.map((row) => Object.values(row)[0]).filter(Boolean);
    const optimized = [];
    for (const tableName of tableNames) {
      await sequelize.query(`OPTIMIZE TABLE \`${tableName}\``);
      optimized.push(tableName);
    }
    await AuditLog.create({ userId: req.user.id, action: 'DB_OPTIMIZED', entity: 'database', details: JSON.stringify({ tables: optimized.length }) });
    res.json({ success: true, message: `Database optimization completed (${optimized.length} tables).`, data: { optimized: optimized.length, tables: optimized } });
  } catch (error) { next(error); }
});

router.post('/clear-cache', ...adminSystemActions, async (req, res, next) => {
  try {
    const uploadPath = path.join(__dirname, '../../uploads');
    let removed = 0;
    if (fs.existsSync(uploadPath)) {
      const entries = fs.readdirSync(uploadPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(tmp|bak)$/i.test(entry.name)) {
          fs.unlinkSync(path.join(uploadPath, entry.name));
          removed += 1;
        }
      }
    }
    await AuditLog.create({ userId: req.user.id, action: 'CACHE_CLEARED', entity: 'cache', details: JSON.stringify({ filesRemoved: removed }) });
    res.json({ success: true, message: removed ? `Cache cleared (${removed} temporary files removed).` : 'No application cache files were found to clear.', data: { filesRemoved: removed } });
  } catch (error) { next(error); }
});

router.post('/cleanup', ...adminSystemActions, async (req, res, next) => {
  try {
    const [orphanCheck] = await sequelize.query('SELECT COUNT(*) AS cnt FROM notifications n LEFT JOIN users u ON u.id = n.user_id WHERE n.user_id IS NOT NULL AND u.id IS NULL');
    const orphaned = Number(orphanCheck[0]?.cnt || 0);
    if (orphaned > 0) await sequelize.query('DELETE FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)');
    await AuditLog.create({ userId: req.user.id, action: 'SYSTEM_CLEANUP', entity: 'system', details: JSON.stringify({ orphanedNotificationsRemoved: orphaned }) });
    res.json({ success: true, message: orphaned ? `Cleanup completed (${orphaned} orphaned records removed).` : 'Cleanup completed; no orphaned records found.', data: { orphanedNotificationsRemoved: orphaned } });
  } catch (error) { next(error); }
});

router.post('/reset', ...adminSystemActions, async (req, res, next) => {
  try {
    const [deleted] = await Config.destroy({ where: { key: { [Op.like]: 'settings:%' } } });
    const deletedSystem = await Config.destroy({ where: { key: { [Op.in]: ['system', 'security'] } } });
    await AuditLog.create({ userId: req.user.id, action: 'SYSTEM_SETTINGS_RESET', entity: 'system', details: JSON.stringify({ settingsReset: deleted, legacyConfigReset: deletedSystem }) });
    res.json({ success: true, message: `System settings reset to defaults (${deleted + deletedSystem} records cleared).`, data: { settingsReset: deleted, legacyConfigReset: deletedSystem } });
  } catch (error) { next(error); }
});

module.exports = router;
