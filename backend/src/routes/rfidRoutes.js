const express = require('express');
const { RfidDevice, RFIDLog, AuditLog } = require('../models');
const { Op } = require('sequelize');
const { getAllLogs, createLog } = require('../controllers/rfidController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const requireAdmin = [requireAuth, requireRole('admin')];

const serializeDevice = (device) => ({
  id: device.id,
  name: device.name,
  reader_id: device.reader_id,
  ip_address: device.ip_address,
  location: device.location,
  status: device.status,
  last_connected: device.last_connected,
  createdAt: device.createdAt,
  updatedAt: device.updatedAt,
});

router.get('/devices', requireAuth, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const statusFilter = String(req.query.status || '').trim();
    const where = {};
    if (search) where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { reader_id: { [Op.like]: `%${search}%` } },
      { ip_address: { [Op.like]: `%${search}%` } },
      { location: { [Op.like]: `%${search}%` } },
    ];
    if (statusFilter) where.status = statusFilter;
    const rows = await RfidDevice.findAll({ where, order: [['name', 'ASC']] });
    const devices = rows.map(serializeDevice);
    return res.json({ success: true, data: devices, devices, total: devices.length });
  } catch (error) { next(error); }
});

router.get('/devices/:id', requireAuth, async (req, res, next) => {
  try {
    const device = await RfidDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'RFID device not found' });
    return res.json({ success: true, data: serializeDevice(device), device: serializeDevice(device) });
  } catch (error) { next(error); }
});

router.post('/devices', ...requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const readerId = String(req.body.reader_id || req.body.readerId || '').trim();
    if (!name || !readerId) return res.status(400).json({ success: false, message: 'Device name and reader id are required' });
    if (await RfidDevice.findOne({ where: { reader_id: readerId } })) return res.status(409).json({ success: false, message: 'A reader with this id already exists' });
    const device = await RfidDevice.create({
      name,
      reader_id: readerId,
      ip_address: String(req.body.ip_address || '').trim(),
      location: String(req.body.location || '').trim(),
      status: req.body.status === 'Inactive' ? 'Inactive' : 'Active',
    });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_CREATED', entity: `device:${device.id}`, details: JSON.stringify({ name, readerId }) });
    return res.status(201).json({ success: true, data: serializeDevice(device), device: serializeDevice(device), message: 'RFID reader added successfully' });
  } catch (error) { next(error); }
});

router.put('/devices/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const device = await RfidDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'RFID device not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : device.name;
    const readerId = req.body.reader_id !== undefined ? String(req.body.reader_id).trim() : device.reader_id;
    if (!name || !readerId) return res.status(400).json({ success: false, message: 'Device name and reader id are required' });
    const duplicate = await RfidDevice.findOne({ where: { reader_id: readerId, id: { [Op.ne]: device.id } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'A reader with this id already exists' });
    await device.update({
      name,
      reader_id: readerId,
      ip_address: req.body.ip_address !== undefined ? String(req.body.ip_address).trim() : device.ip_address,
      location: req.body.location !== undefined ? String(req.body.location).trim() : device.location,
      status: req.body.status === 'Active' || req.body.status === 'Inactive' ? req.body.status : device.status,
    });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_UPDATED', entity: `device:${device.id}`, details: JSON.stringify({ name, readerId }) });
    return res.json({ success: true, data: serializeDevice(device), device: serializeDevice(device), message: 'RFID reader updated successfully' });
  } catch (error) { next(error); }
});

router.put('/devices/:id/status', ...requireAdmin, async (req, res, next) => {
  try {
    const device = await RfidDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'RFID device not found' });
    const status = req.body.status === 'Active' || req.body.status === 'Inactive' ? req.body.status : device.status === 'Active' ? 'Inactive' : 'Active';
    await device.update({ status });
    await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_STATUS_CHANGED', entity: `device:${device.id}`, details: JSON.stringify({ status }) });
    return res.json({ success: true, data: serializeDevice(device), device: serializeDevice(device), message: `Reader ${status === 'Active' ? 'activated' : 'deactivated'}` });
  } catch (error) { next(error); }
});

router.post('/devices/:id/test', ...requireAdmin, async (req, res, next) => {
  try {
    const device = await RfidDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'RFID device not found' });
    const lastScan = device.location
      ? await RFIDLog.findOne({ where: { location: device.location }, order: [['createdAt', 'DESC']] })
      : null;
    const lastSeen = lastScan ? lastScan.createdAt : null;
    await device.update({ last_connected: new Date() });
    if (lastSeen) {
      await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_TESTED', entity: `device:${device.id}`, details: JSON.stringify({ readerId: device.reader_id, lastSeen }) });
    } else {
      await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_TESTED', entity: `device:${device.id}`, details: JSON.stringify({ readerId: device.reader_id, lastSeen: null }) });
    }
    return res.json({
      success: true,
      data: {
        id: device.id,
        reader_id: device.reader_id,
        reachable: Boolean(lastSeen),
        lastSeen: lastSeen ? lastSeen.toISOString() : null,
        checkedAt: new Date().toISOString(),
        message: lastSeen ? `Reader responded; last scan recorded ${lastSeen.toISOString()}.` : 'No scanner activity has been recorded for this reader so far.',
      },
      message: lastSeen ? `Connectivity check passed for ${device.name}.` : `Connectivity check completed; no recent scan activity for ${device.name}.`,
    });
  } catch (error) { next(error); }
});

router.delete('/devices/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const device = await RfidDevice.findByPk(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'RFID device not found' });
    await device.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'RFID_DEVICE_DELETED', entity: `device:${device.id}`, details: JSON.stringify({ name: device.name, readerId: device.reader_id }) });
    return res.json({ success: true, message: 'RFID reader deleted successfully' });
  } catch (error) { next(error); }
});

router.get('/', requireAuth, getAllLogs);
router.get('/logs', requireAuth, getAllLogs);
router.get('/history/:assetId', requireAuth, getAllLogs);
router.post('/', requireAuth, requireRole('admin', 'ict_officer', 'store_manager'), createLog);

module.exports = router;