const { Infrastructure, VerificationSession, VerificationItem, AuditLog } = require('../models');
const { Op } = require('sequelize');
const verificationController = require('./verificationController');

const list = async (req, res, next) => {
  try {
    return await verificationController.listSessions(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const assets = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { assetCode: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
      ];
    }
    const items = await Infrastructure.findAll({
      where,
      attributes: ['id', 'name', 'assetCode', 'category', 'location', 'building', 'condition', 'status'],
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return res.json({ success: true, data: items });
  } catch (error) {
    return next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    return await verificationController.getSession(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  try {
    return await verificationController.createSession(req, res, next);
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const session = await VerificationSession.findByPk(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Verification session not found' });
    }
    const payload = { ...(req.body || {}) };
    const allowedStates = ['verified', 'missing', 'damaged', 'needs_review'];
    if (payload.state && !allowedStates.includes(payload.state)) {
      return res.status(422).json({ success: false, message: 'Invalid verification state' });
    }
    const data = await session.update(payload);
    await AuditLog.create({
      userId: req.user?.id || 0,
      action: 'UPDATE_INFRASTRUCTURE_VERIFICATION',
      entity: `verification_session:${session.id}`,
      details: JSON.stringify({ sessionId: session.id, state: payload.state || session.state })
    });
    return res.json({ success: true, data, message: 'Verification session updated successfully' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { list, assets, getOne, create, update };
