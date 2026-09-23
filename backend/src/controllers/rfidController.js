const { Op } = require('sequelize');
const { RFIDLog, Asset, RfidDevice, AuditLog } = require('../models');

const include = [{ model: Asset, attributes: ['id', 'name', 'assetCode', 'category', 'department', 'location', 'status', 'condition', 'rfidTag'] }];
const normalize = (item) => {
  const data = item.toJSON();
  return {
    ...data,
    asset_id: data.assetId,
    rfid_tag: data.tag,
    reader_location: data.location,
    reader_id: data.readerId || null,
    timestamp: data.createdAt,
    asset: item.Asset,
    asset_name: item.Asset?.name,
    asset_tag: item.Asset?.assetCode,
    isAnomaly: false
  };
};

const getAllLogs = async (req, res) => {
  try {
    const where = req.params.assetId ? { assetId: req.params.assetId } : {};
    if (req.query.asset_id) where.assetId = req.query.asset_id;
    if (req.query.tag || req.query.rfid_tag) where.tag = req.query.tag || req.query.rfid_tag;
    if (req.query.location || req.query.reader_location) where.location = req.query.location || req.query.reader_location;
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search) where[Op.or] = [
        { tag: { [Op.like]: `%${search}%` } },
        { location: { [Op.like]: `%${search}%` } },
        { action: { [Op.like]: `%${search}%` } },
        { '$Asset.name$': { [Op.like]: `%${search}%` } },
        { '$Asset.assetCode$': { [Op.like]: `%${search}%` } }
      ];
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
    const logs = await RFIDLog.findAll({ where, include, order: [['createdAt', 'DESC']], limit });
    const normalized = logs.map(normalize);
    res.json({ success: true, data: normalized, logs: normalized, total: normalized.length, capabilities: { anomalies: false, readers: false, realtime: false } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createLog = async (req, res) => {
  try {
    const tag = String(req.body.rfid_tag || req.body.tag || '').trim();
    const assetId = req.body.asset_id || req.body.assetId;
    if (!tag) return res.status(400).json({ success: false, message: 'RFID tag is required' });
    const asset = assetId
      ? await Asset.findByPk(assetId)
      : await Asset.findOne({ where: { rfidTag: tag } });
    if (!asset) return res.status(404).json({ success: false, result: 'Unknown Tag', message: 'RFID tag is not registered' });
    if (!asset.rfidTag || asset.rfidTag !== tag) return res.status(409).json({ success: false, message: 'RFID tag is not registered to this asset' });
    const readerId = String(req.body.reader_id || req.body.readerId || '').trim();
    const reader = readerId ? await RfidDevice.findOne({ where: { reader_id: readerId } }) : null;
    if (readerId && !reader) return res.status(404).json({ success: false, message: 'RFID reader not found' });
    const location = String(req.body.location || req.body.reader_location || reader?.location || '').trim();
    const log = await RFIDLog.create({ assetId: asset.id, tag, readerId: reader?.reader_id || null, action: req.body.action || 'scan', location, notes: req.body.notes || '' });
    await AuditLog.create({
      userId: req.user.id,
      action: 'RFID_SCAN_RECEIVED',
      entity: `asset:${asset.id}`,
      details: JSON.stringify({ assetId: asset.id, tag, readerId: reader?.reader_id || null, location, scanId: log.id }),
    });
    const saved = await RFIDLog.findByPk(log.id, { include });
    res.status(201).json({ success: true, data: normalize(saved) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllLogs, createLog };
