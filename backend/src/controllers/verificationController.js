const { sequelize, VerificationSession, VerificationItem, Asset, Department, User, AuditLog } = require('../models');
const { Op } = require('sequelize');

const getVerificationScope = (req) => {
  const organizationScope = req?.organizationScope || {};
  const collegeId = Number(organizationScope.collegeId ?? organizationScope.department?.collegeId);
  const departmentId = Number(organizationScope.departmentId ?? organizationScope.department?.id);
  if (!Number.isSafeInteger(collegeId) || collegeId <= 0) return null;
  if (Number.isSafeInteger(departmentId) && departmentId > 0) return { collegeId, departmentId };
  return { collegeId };
};

const scopedSessionWhere = (scope) => ({
  collegeId: scope.collegeId,
  ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
});

const sessionDepartmentInclude = (scope) => ({
  model: Department,
  attributes: ['id', 'name', 'code'],
  required: false,
  where: { collegeId: scope.collegeId },
});

const listSessions = async (req, res, next) => {
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const sessions = await VerificationSession.findAll({
      where: scopedSessionWhere(scope),
      include: [sessionDepartmentInclude(scope)],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: sessions });
  } catch (error) { next(error); }
};

const createSession = async (req, res, next) => {
  let transaction;
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const name = String(req.body?.name || '').trim();
    if (name.length < 2 || name.length > 255) return res.status(400).json({ success: false, message: 'A verification session name between 2 and 255 characters is required' });
    let departmentId = scope.departmentId || req.body?.department_id || null;
    if (departmentId) {
      const parsedDepartmentId = Number(departmentId);
      if (!Number.isSafeInteger(parsedDepartmentId) || parsedDepartmentId <= 0) {
        return res.status(400).json({ success: false, message: 'Department ID is invalid' });
      }
      const department = await Department.findOne({
        where: { id: parsedDepartmentId, collegeId: scope.collegeId, ...(scope.departmentId ? { id: scope.departmentId } : {}) },
      });
      if (!department) return res.status(403).json({ success: false, message: 'Department is outside your organization scope' });
      departmentId = department.id;
    }
    const assets = await Asset.findAll({
      where: { collegeId: scope.collegeId, ...(departmentId ? { departmentId } : {}) },
      attributes: ['id'],
      raw: true,
    });
    if (!assets.length) return res.status(409).json({ success: false, message: 'No registered assets are available in the selected verification scope' });

    transaction = await sequelize.transaction();
    const session = await VerificationSession.create({
      name,
      collegeId: scope.collegeId,
      departmentId,
      startedBy: req.user.id,
      status: 'in_progress',
    }, { transaction });
    await VerificationItem.bulkCreate(assets.map((asset) => ({
      sessionId: session.id,
      assetId: asset.id,
      state: 'pending',
      notes: '',
    })), { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'VERIFICATION_SESSION_CREATED',
      entity: `verification:${session.id}`,
      details: JSON.stringify({ sessionId: session.id, departmentId, assetCount: assets.length }),
    }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, message: 'Verification session created', data: session });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    next(error);
  }
};

const getSession = async (req, res, next) => {
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const session = await VerificationSession.findOne({
      where: { id: req.params.id, ...scopedSessionWhere(scope) },
      include: [
        {
          model: VerificationItem,
          include: [
            {
              model: Asset,
              where: scopedSessionWhere(scope),
              required: true,
              attributes: ['id', 'name', 'assetCode', 'departmentId', 'collegeId', 'location', 'status', 'qrCode', 'rfidTag', 'serialNumber', 'condition'],
            },
            { model: User, as: 'Verifier', attributes: ['id', 'fullName', 'username'], required: false },
          ],
        },
        sessionDepartmentInclude(scope),
      ],
    });
    if (!session) return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    res.json({ success: true, data: session });
  } catch (error) { next(error); }
};

const addItem = async (req, res, next) => {
  let transaction;
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const assetId = Number(req.body?.asset_id);
    if (!Number.isSafeInteger(assetId) || assetId <= 0) return res.status(400).json({ success: false, message: 'Asset ID is invalid' });
    if (!['verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'].includes(req.body?.state)) return res.status(400).json({ success: false, message: 'Invalid verification state' });
    const notes = String(req.body?.notes || '').trim();
    if (notes.length > 2000) return res.status(400).json({ success: false, message: 'Verification notes cannot exceed 2000 characters' });
    const observedLocation = String(req.body?.observed_location || '').trim();
    if (observedLocation.length > 255) return res.status(400).json({ success: false, message: 'Observed location cannot exceed 255 characters' });
    transaction = await sequelize.transaction();
    const session = await VerificationSession.findOne({
      where: { id: req.params.id, ...scopedSessionWhere(scope) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!session) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    }
    if (!['draft', 'in_progress'].includes(session.status)) {
      await transaction.rollback();
      return res.status(409).json({ success: false, message: 'Verification session is no longer editable' });
    }
    const asset = await Asset.findOne({
      where: { id: assetId, ...scopedSessionWhere(scope), ...(session.departmentId ? { departmentId: session.departmentId } : {}) },
      transaction,
    });
    if (!asset) {
      await transaction.rollback();
      return res.status(403).json({ success: false, message: 'Asset is outside your verification scope' });
    }
    const [item] = await VerificationItem.findOrCreate({
      where: { sessionId: session.id, assetId: asset.id },
      defaults: { sessionId: session.id, assetId: asset.id, state: 'pending', notes: '' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    await item.update({
      state: req.body.state,
      notes,
      observedLocation: observedLocation || null,
      verifiedBy: req.user.id,
    }, { transaction });
    await AuditLog.create({
      userId: req.user.id,
      action: 'VERIFICATION_ITEM_RECORDED',
      entity: `verification:${session.id}`,
      details: JSON.stringify({ sessionId: session.id, assetId: asset.id, state: item.state }),
    }, { transaction });
    await transaction.commit();
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    next(error);
  }
};

const changeSessionStatus = (status) => async (req, res, next) => {
  const scope = getVerificationScope(req);
  if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const session = await VerificationSession.findOne({ where: { id: req.params.id, ...scopedSessionWhere(scope) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!session) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Verification session not found in your scope' }); }
    const allowed = status === 'submitted' ? ['draft', 'in_progress'] : ['submitted'];
    if (!allowed.includes(session.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Invalid verification session state transition' }); }
    const before = session.status;
    await session.update({ status, ...(status === 'finalized' ? { finalizedAt: new Date() } : {}) }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: status === 'finalized' ? 'VERIFICATION_FINALIZED' : 'VERIFICATION_SUBMITTED', entity: `verification:${session.id}`, details: JSON.stringify({ beforeStatus: before, afterStatus: status }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: `Verification ${status}`, data: session });
  } catch (error) {
    if (transaction && !transaction.finished) await transaction.rollback();
    next(error);
  }
};

module.exports = { listSessions, createSession, getSession, addItem, submitSession: changeSessionStatus('submitted'), finalizeSession: changeSessionStatus('finalized') };
