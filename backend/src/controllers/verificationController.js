const { sequelize, VerificationSession, VerificationItem, Asset, Department, AuditLog } = require('../models');
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
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const name = String(req.body?.name || '').trim();
    if (name.length < 2) return res.status(400).json({ success: false, message: 'A verification session name is required' });
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
    const session = await VerificationSession.create({ name, collegeId: scope.collegeId, departmentId, startedBy: req.user.id, status: 'in_progress' });
    await AuditLog.create({ userId: req.user.id, action: 'VERIFICATION_SESSION_CREATED', entity: `verification:${session.id}`, details: JSON.stringify({ sessionId: session.id, departmentId }) });
    res.status(201).json({ success: true, message: 'Verification session created', data: session });
  } catch (error) { next(error); }
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
          include: [{
            model: Asset,
            where: scopedSessionWhere(scope),
            required: true,
            attributes: ['id', 'name', 'assetCode', 'departmentId', 'collegeId', 'location', 'status'],
          }],
        },
        sessionDepartmentInclude(scope),
      ],
    });
    if (!session) return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    res.json({ success: true, data: session });
  } catch (error) { next(error); }
};

const addItem = async (req, res, next) => {
  try {
    const scope = getVerificationScope(req);
    if (!scope) return res.status(403).json({ success: false, message: 'Verification scope is not configured for this account' });
    const session = await VerificationSession.findOne({ where: { id: req.params.id, ...scopedSessionWhere(scope) } });
    if (!session) return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    if (!['draft', 'in_progress'].includes(session.status)) return res.status(409).json({ success: false, message: 'Verification session is no longer editable' });
    const asset = await Asset.findOne({ where: { id: req.body?.asset_id, ...scopedSessionWhere(scope) } });
    if (!asset) return res.status(403).json({ success: false, message: 'Asset is outside your verification scope' });
    if (!['verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'].includes(req.body?.state)) return res.status(400).json({ success: false, message: 'Invalid verification state' });
    const notes = String(req.body?.notes || '').trim();
    const [item] = await VerificationItem.findOrCreate({ where: { sessionId: session.id, assetId: asset.id }, defaults: { sessionId: session.id, assetId: asset.id, state: req.body.state, notes } });
    if (item.state !== req.body.state || item.notes !== notes) await item.update({ state: req.body.state, notes });
    await AuditLog.create({ userId: req.user.id, action: 'VERIFICATION_ITEM_RECORDED', entity: `verification:${session.id}`, details: JSON.stringify({ sessionId: session.id, assetId: asset.id, state: item.state }) });
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
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
