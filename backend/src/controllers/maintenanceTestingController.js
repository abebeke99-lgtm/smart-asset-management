const { Op } = require('sequelize');
const { sequelize, Maintenance, MaintenanceRepair, MaintenanceWorkOrder, MaintenanceTest, MaintenanceHistory, Asset, User, AuditLog } = require('../models');
const { normalizeTestResult, validateTestResult } = require('../utils/maintenanceTesting');

const testIncludes = [
  { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'department', 'location', 'status'] },
  { model: Maintenance, attributes: ['id', 'title', 'description', 'status', 'priority', 'assignedTo'] },
  { model: MaintenanceWorkOrder, attributes: ['id', 'workOrderNumber', 'status', 'technicianId'], required: false },
  { model: User, as: 'Tester', attributes: ['id', 'username', 'fullName', 'role'] },
  { model: User, as: 'Reviewer', attributes: ['id', 'username', 'fullName', 'role'], required: false },
  { model: MaintenanceTest, as: 'ParentTest', attributes: ['id', 'overallResult', 'testDate'], required: false },
];

const getMaintenanceTestSummary = (tests = []) => tests.reduce((summary, item) => {
  const status = String(item.status || '').toLowerCase();
  const result = normalizeTestResult(item.overallResult);
  const qualityStatus = String(item.qualityStatus || '').toLowerCase();
  summary.total += 1;
  if (status === 'pending') summary.pending += 1;
  if (status === 'in-progress') summary.inTesting += 1;
  if (result === 'Passed') summary.passed += 1;
  if (result === 'Failed') summary.failed += 1;
  if (result === 'Retest Required' || status === 'retest-required') summary.retestRequired += 1;
  if (qualityStatus === 'pending-qc') summary.awaitingQualityControl += 1;
  if (qualityStatus === 'approved' && status === 'completed') summary.returnedToService += 1;
  if (['pending', 'in-progress'].includes(status) && item.testDate && new Date(item.testDate).getTime() < Date.now()) summary.overdue += 1;
  return summary;
}, { total: 0, pending: 0, inTesting: 0, passed: 0, failed: 0, retestRequired: 0, awaitingQualityControl: 0, returnedToService: 0, overdue: 0 });

const appendTestHistory = (item, userId, actionType, previousStatus, newStatus, description, transaction) => MaintenanceHistory.create({
  assetId: item.assetId,
  maintenanceId: item.maintenanceId,
  userId,
  actionType,
  actionDate: new Date(),
  previousStatus: previousStatus || '',
  newStatus: newStatus || '',
  description,
  details: { testId: item.id, workOrderId: item.workOrderId || null },
}, { transaction });

const auditTestAction = (req, item, action, oldValue, newValue, transaction) => AuditLog.create({
  userId: req.user.id,
  action,
  entity: `maintenance_test:${item.id}`,
  details: JSON.stringify({ testId: item.id, assetId: item.assetId, maintenanceId: item.maintenanceId, previousState: oldValue, newState: newValue }),
}, { transaction });

const getMaintenanceTests = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where = {};
    if (req.query.status) where.status = String(req.query.status).trim().toLowerCase();
    if (req.query.result) where.overallResult = normalizeTestResult(req.query.result) || String(req.query.result).trim();
    if (req.query.qualityStatus) where.qualityStatus = String(req.query.qualityStatus).trim().toLowerCase();
    if (req.query.maintenanceType) where['$Maintenance.title$'] = { [Op.like]: `%${String(req.query.maintenanceType).trim()}%` };
    if (req.query.department) where['$Asset.department$'] = String(req.query.department).trim();
    if (req.query.from || req.query.to) {
      where.testDate = {};
      if (req.query.from) where.testDate[Op.gte] = new Date(req.query.from);
      if (req.query.to) where.testDate[Op.lte] = new Date(req.query.to);
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      where[Op.or] = [
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } },
        { '$Asset.serialNumber$': { [Op.like]: `%${search}%` } },
        { '$Maintenance.title$': { [Op.like]: `%${search}%` } },
        { '$Maintenance.id$': { [Op.like]: `%${search}%` } },
        { '$Tester.fullName$': { [Op.like]: `%${search}%` } },
        { '$Tester.username$': { [Op.like]: `%${search}%` } },
        { testType: { [Op.like]: `%${search}%` } },
        ...(Number.isInteger(Number(search)) ? [{ id: Number(search) }] : []),
      ];
    }
    const { count, rows } = await MaintenanceTest.findAndCountAll({
      where,
      include: testIncludes,
      order: [['testDate', 'DESC'], ['id', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    });
    const summaryRows = await MaintenanceTest.findAll({ where, attributes: ['status', 'overallResult', 'qualityStatus', 'testDate'] });
    return res.json({ success: true, data: rows, summary: getMaintenanceTestSummary(summaryRows), pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) { return next(error); }
};

const getMaintenanceTestOptions = async (req, res, next) => {
  try {
    const maintenance = await Maintenance.findAll({
      where: { status: { [Op.in]: ['testing', 'in-progress'] } },
      include: [
        { model: Asset, attributes: ['id', 'name', 'assetCode', 'serialNumber', 'department', 'location', 'status'] },
        { model: User, as: 'Technician', attributes: ['id', 'username', 'fullName', 'role'], required: false },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 100,
    });
    const testers = await User.findAll({ where: { role: { [Op.in]: ['admin', 'maintenance', 'ict_officer'] }, active: true }, attributes: ['id', 'username', 'fullName', 'role'], order: [['fullName', 'ASC']] });
    return res.json({ success: true, data: { maintenance, testers } });
  } catch (error) { return next(error); }
};

const getMaintenanceTest = async (req, res, next) => {
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { include: testIncludes });
    if (!item) return res.status(404).json({ success: false, message: 'Maintenance test not found' });
    const [history, retests] = await Promise.all([
      MaintenanceHistory.findAll({ where: { maintenanceId: item.maintenanceId }, order: [['actionDate', 'ASC']] }),
      MaintenanceTest.findAll({ where: { parentTestId: item.id }, order: [['testDate', 'ASC']] }),
    ]);
    return res.json({ success: true, data: { ...item.toJSON(), history, retests } });
  } catch (error) { return next(error); }
};

const createMaintenanceTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const maintenanceId = Number(req.body.maintenanceId);
    if (!Number.isInteger(maintenanceId) || maintenanceId < 1) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Select a valid maintenance record.' }); }
    const maintenance = await Maintenance.findByPk(maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!maintenance) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance record not found.' }); }
    const asset = await Asset.findByPk(maintenance.assetId, { transaction });
    if (!asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'The maintenance record has no valid asset.' }); }

    let workOrder = null;
    if (req.body.workOrderId) {
      workOrder = await MaintenanceWorkOrder.findByPk(Number(req.body.workOrderId), { transaction, lock: transaction.LOCK.UPDATE });
      if (!workOrder || Number(workOrder.maintenanceId) !== Number(maintenance.id) || Number(workOrder.assetId) !== Number(asset.id)) {
        await transaction.rollback();
        return res.status(422).json({ success: false, message: 'The work order must belong to this maintenance record and asset.' });
      }
      if (String(workOrder.status).toLowerCase() !== 'completed') { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Complete the related work order before testing.' }); }
    }
    const workReady = String(maintenance.status).toLowerCase() === 'testing' || Boolean(workOrder);
    if (!workReady) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Maintenance work must be completed and moved to testing before a test can be created.' }); }
    const technicianId = workOrder?.technicianId || maintenance.assignedTo;
    if (!technicianId) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Assign a maintenance technician before testing.' }); }
    const activeTest = await MaintenanceTest.findOne({ where: { maintenanceId, status: { [Op.in]: ['pending', 'in-progress'] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (activeTest) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'An active test already exists for this maintenance record.' }); }
    const testType = String(req.body.testType || '').trim();
    if (!testType) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Test type is required.' }); }
    const item = await MaintenanceTest.create({
      maintenanceId,
      workOrderId: workOrder?.id || null,
      assetId: asset.id,
      testerId: req.user.id,
      testDate: req.body.testDate ? new Date(req.body.testDate) : new Date(),
      testType: testType.slice(0, 100),
      procedure: String(req.body.procedure || '').trim(),
      expectedResult: String(req.body.expectedResult || '').trim(),
      checklist: Array.isArray(req.body.checklist) ? req.body.checklist : [],
      measurements: Array.isArray(req.body.measurements) ? req.body.measurements : [],
      status: 'pending',
      overallResult: 'Pending',
      qualityStatus: 'not-reviewed',
    }, { transaction });
    await appendTestHistory(item, req.user.id, 'test_created', maintenance.status, 'pending', `Test ${item.id} created for maintenance ${maintenance.id}`, transaction);
    await auditTestAction(req, item, 'MAINTENANCE_TEST_CREATED', null, { status: 'pending', testType }, transaction);
    await transaction.commit();
    const created = await MaintenanceTest.findByPk(item.id, { include: testIncludes });
    return res.status(201).json({ success: true, data: created });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const startMaintenanceTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (item.status !== 'pending') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only a pending test can be started.' }); }
    const previousStatus = item.status;
    await item.update({ status: 'in-progress' }, { transaction });
    await appendTestHistory(item, req.user.id, 'test_started', previousStatus, item.status, `Test ${item.id} started`, transaction);
    await auditTestAction(req, item, 'MAINTENANCE_TEST_STARTED', previousStatus, item.status, transaction);
    await transaction.commit();
    return res.json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const completeMaintenanceTest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (item.status !== 'in-progress') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Start the test before recording a result.' }); }
    const payload = { ...req.body, checklist: Array.isArray(req.body.checklist) ? req.body.checklist : item.checklist };
    const validation = validateTestResult(payload);
    if (validation.message) { await transaction.rollback(); return res.status(422).json({ success: false, message: validation.message }); }
    const previousStatus = item.status;
    const failed = validation.result !== 'Passed';
    await item.update({
      status: failed ? (validation.result === 'Retest Required' ? 'retest-required' : 'failed') : 'passed',
      overallResult: validation.result,
      functionalResult: validation.result,
      qualityResult: 'Pending',
      actualResult: String(req.body.actualResult).trim(),
      failureReason: String(req.body.failureReason || '').trim(),
      failedCheck: String(req.body.failedCheck || '').trim(),
      recommendedAction: String(req.body.recommendedAction || '').trim(),
      notes: String(req.body.notes || '').trim(),
      checklist: payload.checklist,
      measurements: Array.isArray(req.body.measurements) ? req.body.measurements : item.measurements,
    }, { transaction });
    const maintenance = await Maintenance.findByPk(item.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (failed) {
      await maintenance.update({ status: 'in-progress' }, { transaction });
      await asset.update({ status: 'under-maintenance' }, { transaction });
      const repair = await MaintenanceRepair.findOne({ where: { maintenanceId: item.maintenanceId }, transaction, lock: transaction.LOCK.UPDATE });
      if (repair) await repair.update({ status: 'rework' }, { transaction });
      if (item.workOrderId) await MaintenanceWorkOrder.update({ status: 'in-progress' }, { where: { id: item.workOrderId }, transaction });
    }
    await appendTestHistory(item, req.user.id, failed ? 'test_failed' : 'test_passed', previousStatus, item.status, `Test ${item.id} recorded ${validation.result}`, transaction);
    await auditTestAction(req, item, failed ? 'MAINTENANCE_TEST_FAILED' : 'MAINTENANCE_TEST_PASSED', previousStatus, item.status, transaction);
    await transaction.commit();
    return res.json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const createMaintenanceRetest = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const parent = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!parent) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (!['Failed', 'Retest Required'].includes(normalizeTestResult(parent.overallResult))) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only a failed test can be retested.' }); }
    const maintenance = await Maintenance.findByPk(parent.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!maintenance || String(maintenance.status).toLowerCase() !== 'testing') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Complete the corrective maintenance and move the job back to testing first.' }); }
    const activeTest = await MaintenanceTest.findOne({ where: { maintenanceId: parent.maintenanceId, status: { [Op.in]: ['pending', 'in-progress'] } }, transaction, lock: transaction.LOCK.UPDATE });
    if (activeTest) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'An active test already exists for this maintenance record.' }); }
    const item = await MaintenanceTest.create({
      maintenanceId: parent.maintenanceId,
      workOrderId: parent.workOrderId,
      assetId: parent.assetId,
      testerId: req.user.id,
      parentTestId: parent.id,
      testDate: req.body.testDate ? new Date(req.body.testDate) : new Date(),
      testType: String(req.body.testType || parent.testType),
      procedure: String(req.body.procedure || parent.procedure || ''),
      expectedResult: String(req.body.expectedResult || parent.expectedResult || ''),
      checklist: parent.checklist || [],
      measurements: [],
      status: 'pending',
      overallResult: 'Pending',
      qualityStatus: 'not-reviewed',
    }, { transaction });
    await appendTestHistory(item, req.user.id, 'retest_created', parent.overallResult, 'pending', `Retest ${item.id} created from failed test ${parent.id}`, transaction);
    await auditTestAction(req, item, 'MAINTENANCE_RETEST_CREATED', parent.id, item.id, transaction);
    await transaction.commit();
    return res.status(201).json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const sendMaintenanceTestToQuality = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (normalizeTestResult(item.overallResult) !== 'Passed' || item.status !== 'passed') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Only a passed test can be sent to quality control.' }); }
    if (item.qualityStatus !== 'not-reviewed') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This test has already been sent to quality control.' }); }
    const previousStatus = item.qualityStatus;
    await item.update({ qualityStatus: 'pending-qc' }, { transaction });
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    await asset.update({ status: 'quality-control' }, { transaction });
    await appendTestHistory(item, req.user.id, 'test_sent_to_qc', previousStatus, item.qualityStatus, `Test ${item.id} sent for quality review`, transaction);
    await auditTestAction(req, item, 'MAINTENANCE_TEST_SENT_TO_QC', previousStatus, item.qualityStatus, transaction);
    await transaction.commit();
    return res.json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const reviewMaintenanceTestQuality = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (item.qualityStatus !== 'pending-qc') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This test is not awaiting quality review.' }); }
    const decision = String(req.body.decision || '').toLowerCase();
    if (!['approve', 'reject'].includes(decision)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'Choose approve or reject.' }); }
    const rejectionReason = String(req.body.rejectionReason || '').trim();
    const correctiveAction = String(req.body.correctiveAction || '').trim();
    if (decision === 'reject' && (!rejectionReason || !correctiveAction)) { await transaction.rollback(); return res.status(422).json({ success: false, message: 'A rejection reason and corrective action are required.' }); }
    const previousStatus = item.qualityStatus;
    const qualityStatus = decision === 'approve' ? 'approved' : 'rejected';
    await item.update({ qualityStatus, reviewerId: req.user.id, reviewedAt: new Date(), rejectionReason, correctiveAction }, { transaction });
    if (decision === 'reject') {
      const maintenance = await Maintenance.findByPk(item.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
      const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
      await maintenance.update({ status: 'in-progress' }, { transaction });
      await asset.update({ status: 'under-maintenance' }, { transaction });
      const repair = await MaintenanceRepair.findOne({ where: { maintenanceId: item.maintenanceId }, transaction, lock: transaction.LOCK.UPDATE });
      if (repair) await repair.update({ status: 'rework' }, { transaction });
      if (item.workOrderId) await MaintenanceWorkOrder.update({ status: 'in-progress' }, { where: { id: item.workOrderId }, transaction });
    }
    await appendTestHistory(item, req.user.id, decision === 'approve' ? 'quality_approved' : 'quality_rejected', previousStatus, qualityStatus, decision === 'approve' ? `Test ${item.id} approved by quality control` : `Test ${item.id} rejected: ${rejectionReason}`, transaction);
    await auditTestAction(req, item, decision === 'approve' ? 'MAINTENANCE_TEST_QC_APPROVED' : 'MAINTENANCE_TEST_QC_REJECTED', previousStatus, qualityStatus, transaction);
    await transaction.commit();
    return res.json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

const returnMaintenanceTestToService = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const item = await MaintenanceTest.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!item) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Maintenance test not found.' }); }
    if (item.status !== 'passed' || item.qualityStatus !== 'approved') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'A passed test with approved quality control is required before return to service.' }); }
    if (item.status === 'completed') { await transaction.rollback(); return res.status(409).json({ success: false, message: 'This asset has already been returned to service.' }); }
    const maintenance = await Maintenance.findByPk(item.maintenanceId, { transaction, lock: transaction.LOCK.UPDATE });
    const asset = await Asset.findByPk(item.assetId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!maintenance || !asset) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'The linked maintenance record or asset no longer exists.' }); }
    const previousStatus = item.status;
    await item.update({ status: 'completed' }, { transaction });
    await maintenance.update({ status: 'completed' }, { transaction });
    await asset.update({ status: 'available' }, { transaction });
    await appendTestHistory(item, req.user.id, 'asset_returned_to_service', previousStatus, 'completed', `Asset ${asset.assetCode || asset.id} returned to service`, transaction);
    await auditTestAction(req, item, 'MAINTENANCE_ASSET_RETURNED_TO_SERVICE', previousStatus, 'completed', transaction);
    await transaction.commit();
    return res.json({ success: true, data: item });
  } catch (error) { await transaction.rollback(); return next(error); }
};

module.exports = {
  getMaintenanceTests,
  getMaintenanceTestOptions,
  getMaintenanceTest,
  createMaintenanceTest,
  startMaintenanceTest,
  completeMaintenanceTest,
  createMaintenanceRetest,
  sendMaintenanceTestToQuality,
  reviewMaintenanceTestQuality,
  returnMaintenanceTestToService,
  getMaintenanceTestSummary,
};