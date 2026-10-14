const { Op } = require('sequelize');
const { Infrastructure, AuditLog, User } = require('../models');

const VERIFICATION_STATES = ['verified', 'missing', 'wrong_location', 'damaged', 'needs_review'];
const VERIFICATION_ACTION = 'VERIFY_INFRASTRUCTURE_ASSET';

const parseDetails = (value) => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const latestVerificationByAsset = async (assetIds) => {
  if (!assetIds.length) return new Map();
  const events = await AuditLog.findAll({
    where: {
      action: VERIFICATION_ACTION,
      entity: { [Op.in]: assetIds.map((id) => `infrastructure_asset:${id}`) },
    },
    include: [{ model: User, attributes: ['id', 'fullName', 'username'], required: false }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  const latest = new Map();
  events.forEach((event) => {
    if (latest.has(event.entity)) return;
    latest.set(event.entity, {
      ...parseDetails(event.details),
      createdAt: event.createdAt,
      verifiedBy: event.User?.fullName || event.User?.username || 'System',
    });
  });
  return latest;
};

const recordVerification = async (req, res, next, assetId) => {
  try {
    const parsedId = Number(assetId);
    if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ success: false, message: 'Infrastructure asset ID is invalid.' });
    }
    const asset = await Infrastructure.findByPk(parsedId);
    if (!asset) return res.status(404).json({ success: false, message: 'Infrastructure asset not found.' });

    const state = String(req.body?.state || 'verified').trim().toLowerCase();
    if (!VERIFICATION_STATES.includes(state)) {
      return res.status(422).json({ success: false, message: 'Invalid Infrastructure verification result.' });
    }
    const condition = String(req.body?.condition || '').trim();
    const observedLocation = String(req.body?.observedLocation || req.body?.observed_location || '').trim();
    const notes = String(req.body?.notes || '').trim();
    if (condition.length > 100 || observedLocation.length > 255 || notes.length > 2000) {
      return res.status(422).json({ success: false, message: 'Verification details exceed the allowed length.' });
    }

    const event = await AuditLog.create({
      userId: req.user.id,
      action: VERIFICATION_ACTION,
      entity: `infrastructure_asset:${asset.id}`,
      details: JSON.stringify({
        state,
        condition: condition || null,
        observedLocation: observedLocation || null,
        notes: notes || null,
      }),
    });

    return res.status(req.method === 'POST' ? 201 : 200).json({
      success: true,
      data: {
        ...asset.toJSON(),
        latestVerification: {
          state,
          condition: condition || null,
          observedLocation: observedLocation || null,
          notes: notes || null,
          createdAt: event.createdAt,
          verifiedBy: req.user.fullName || req.user.username || 'Current user',
        },
      },
      message: 'Infrastructure asset verification recorded successfully.',
    });
  } catch (error) {
    return next(error);
  }
};

const list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || '').trim();
    const where = {};

    if (search) {
      where[Op.or] = ['name', 'assetCode', 'serialNumber', 'qrCode', 'rfidTag', 'category', 'location', 'building']
        .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    }

    const { count, rows } = await Infrastructure.findAndCountAll({
      where,
      order: [['name', 'ASC'], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });
    const latest = await latestVerificationByAsset(rows.map((asset) => asset.id));
    const data = rows.map((asset) => ({
      ...asset.toJSON(),
      latestVerification: latest.get(`infrastructure_asset:${asset.id}`) || null,
    }));

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total: count, pages: Math.max(1, Math.ceil(count / limit)) },
    });
  } catch (error) {
    return next(error);
  }
};

const assets = async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) {
      where[Op.or] = ['name', 'assetCode', 'serialNumber', 'qrCode', 'rfidTag', 'location']
        .map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
    }
    const data = await Infrastructure.findAll({
      where,
      attributes: ['id', 'name', 'assetCode', 'serialNumber', 'qrCode', 'rfidTag', 'category', 'location', 'condition', 'status'],
      order: [['name', 'ASC'], ['id', 'ASC']],
      limit: 100,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};

const getOne = async (req, res, next) => {
  try {
    const asset = await Infrastructure.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Infrastructure asset not found.' });
    const latest = await latestVerificationByAsset([asset.id]);
    return res.json({
      success: true,
      data: {
        ...asset.toJSON(),
        latestVerification: latest.get(`infrastructure_asset:${asset.id}`) || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const create = async (req, res, next) => {
  const identifier = String(req.body?.assetCode || req.body?.qrCode || req.body?.rfidTag || '').trim();
  const assetId = Number(req.body?.asset_id || req.body?.assetId);
  const where = [];
  if (Number.isSafeInteger(assetId) && assetId > 0) where.push({ id: assetId });
  if (identifier) where.push({ [Op.or]: [{ assetCode: identifier }, { qrCode: identifier }, { rfidTag: identifier }] });
  if (!where.length) {
    return res.status(422).json({ success: false, message: 'Provide an Infrastructure asset ID, code, QR code, or RFID tag.' });
  }
  try {
    const asset = await Infrastructure.findOne({ where: { [Op.or]: where } });
    if (!asset) return res.status(404).json({ success: false, message: 'Infrastructure asset not found.' });
    return await recordVerification(req, res, next, asset.id);
  } catch (error) {
    return next(error);
  }
};

const update = async (req, res, next) => recordVerification(req, res, next, req.params.id);

module.exports = { list, assets, getOne, create, update };
