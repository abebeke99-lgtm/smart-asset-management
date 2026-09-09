const { sequelize, VerificationSession, VerificationItem, Asset, Department, AuditLog } = require('../models');
const { Op } = require('sequelize');

const sessionInclude = [{ model: Department, attributes: ['id', 'name', 'code'] }];
const scopedSessionWhere = (req) => req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };
const assetScope = (req) => req.organizationScope.departmentId ? { departmentId: req.organizationScope.departmentId } : { collegeId: req.organizationScope.collegeId };

const listSessions = async (req, res, next) => {
  try {
    const sessions = await VerificationSession.findAll({ where: scopedSessionWhere(req), include: sessionInclude, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: sessions });
  } catch (error) { next(error); }
};

const createSession = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (name.length < 2) return res.status(400).json({ success: false, message: 'A verification session name is required' });
    let departmentId = req.organizationScope.departmentId || req.body.department_id || null;
    if (departmentId) {
      const department = await Department.findOne({ where: { id: departmentId, ...(req.organizationScope.departmentId ? {} : { collegeId: req.organizationScope.collegeId }) } });
      if (!department) return res.status(403).json({ success: false, message: 'Department is outside your organization scope' });
      departmentId = department.id;
    }
    const session = await VerificationSession.create({ name, collegeId: req.organizationScope.collegeId || req.organizationScope.department.collegeId, departmentId, startedBy: req.user.id, status: 'in_progress' });
    await AuditLog.create({ userId: req.user.id, action: 'VERIFICATION_SESSION_CREATED', entity: `verification:${session.id}`, details: JSON.stringify({ sessionId: session.id, departmentId }) });
    res.status(201).json({ success: true, message: 'Verification session created', data: session });
  } catch (error) { next(error); }
};

const getSession = async (req, res, next) => {
  try {
    const session = await VerificationSession.findOne({ where: { id: req.params.id, ...scopedSessionWhere(req) }, include: [{ model: VerificationItem, include: [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'departmentId', 'collegeId', 'location', 'status'] }] }, ...sessionInclude] });
    if (!session) return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    res.json({ success: true, data: session });
  } catch (error) { next(error); }
};

const addItem = async (req, res, next) => {
  try {
    const session = await VerificationSession.findOne({ where: { id: req.params.id, ...scopedSessionWhere(req) } });
    if (!session) return res.status(404).json({ success: false, message: 'Verification session not found in your scope' });
    if (!['draft', 'in_progress'].includes(session.status)) return res.status(409).json({ success: false, message: 'Verification session is no longer editable' });
    const asset = await Asset.findOne({ where: { id: req.body.asset_id, ...assetScope(req) } });
    if (!asset) return res.status(403).json({ success: false, message: 'Asset is outside your verification scope' });
    if (!['verified', 'missing', 'wrong_location', 'damaged', 'unidentified', 'needs_review'].includes(req.body.state)) return res.status(400).json({ success: false, message: 'Invalid verification state' });
    const [item] = await VerificationItem.findOrCreate({ where: { sessionId: session.id, assetId: asset.id }, defaults: { sessionId: session.id, assetId: asset.id, state: req.body.state, notes: String(req.body.notes || '').trim() } });
    if (item.state !== req.body.state || item.notes !== String(req.body.notes || '').trim()) await item.update({ state: req.body.state, notes: String(req.body.notes || '').trim() });
    await AuditLog.create({ userId: req.user.id, action: 'VERIFICATION_ITEM_RECORDED', entity: `verification:${session.id}`, details: JSON.stringify({ sessionId: session.id, assetId: asset.id, state: item.state }) });
    res.status(201).json({ success: true, data: item });
  } catch (error) { next(error); }
};

const changeSessionStatus = (status) => async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const session = await VerificationSession.findOne({ where: { id: req.params.id, ...scopedSessionWhere(req) }, transaction, lock: transaction.LOCK.UPDATE });
    if (!session) { await transaction.rollback(); return res.status(404).json({ success: false, message: 'Verification session not found in your scope' }); }
    const allowed = status === 'submitted' ? ['draft', 'in_progress'] : ['submitted'];
    if (!allowed.includes(session.status)) { await transaction.rollback(); return res.status(409).json({ success: false, message: 'Invalid verification session state transition' }); }
    const before = session.status;
    await session.update({ status, ...(status === 'finalized' ? { finalizedAt: new Date() } : {}) }, { transaction });
    await AuditLog.create({ userId: req.user.id, action: status === 'finalized' ? 'VERIFICATION_FINALIZED' : 'VERIFICATION_SUBMITTED', entity: `verification:${session.id}`, details: JSON.stringify({ beforeStatus: before, afterStatus: status }) }, { transaction });
    await transaction.commit();
    res.json({ success: true, message: `Verification ${status}`, data: session });
  } catch (error) { await transaction.rollback(); next(error); }
};

module.exports = { listSessions, createSession, getSession, addItem, submitSession: changeSessionStatus('submitted'), finalizeSession: changeSessionStatus('finalized') };
