const express = require('express');
const { Op } = require('sequelize');
const {
  listCampuses,
  getCampus,
  createCampus,
  updateCampus,
  deleteCampus,
  listBuildings,
  getBuilding,
  createBuilding,
  updateBuilding,
  deleteBuilding,
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  deleteRoom,
} = require('../controllers/campusLocationController');
const { Location, Asset, AuditLog } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/campuses', requireAuth, listCampuses);
router.get('/campuses/:id', requireAuth, getCampus);
router.post('/campuses', requireAuth, requireRole('admin'), createCampus);
router.put('/campuses/:id', requireAuth, requireRole('admin'), updateCampus);
router.delete('/campuses/:id', requireAuth, requireRole('admin'), deleteCampus);

router.get('/buildings', requireAuth, listBuildings);
router.get('/buildings/:id', requireAuth, getBuilding);
router.post('/buildings', requireAuth, requireRole('admin'), createBuilding);
router.put('/buildings/:id', requireAuth, requireRole('admin'), updateBuilding);
router.delete('/buildings/:id', requireAuth, requireRole('admin'), deleteBuilding);

router.get('/rooms', requireAuth, listRooms);
router.get('/rooms/:id', requireAuth, getRoom);
router.post('/rooms', requireAuth, requireRole('admin'), createRoom);
router.put('/rooms/:id', requireAuth, requireRole('admin'), updateRoom);
router.delete('/rooms/:id', requireAuth, requireRole('admin'), deleteRoom);

const requireAdmin = [requireAuth, requireRole('admin')];

const serializeLocation = async (location) => {
  const assetCount = await Asset.count({ where: { location: location.name } });
  return {
    id: location.id,
    name: location.name,
    code: location.code,
    description: location.description,
    status: location.status,
    assetCount,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
};

const normalizeLocationList = async (rows) => Promise.all(rows.map(serializeLocation));

router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const [totalLocations, activeLocations, locationsWithAssets, totalAssets] = await Promise.all([
      Location.count(),
      Location.count({ where: { status: 'active' } }),
      Location.findAll({
        attributes: ['id', 'name'],
        raw: true,
      }).then(async (rows) => {
        const locationNames = rows.map((row) => row.name).filter(Boolean);
        if (!locationNames.length) return 0;
        const counts = await Asset.findAll({
          attributes: ['location', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
          where: { location: { [Op.in]: locationNames } },
          group: ['location'],
          raw: true,
        });
        return counts.filter((row) => Number(row.count) > 0).length;
      }),
      Asset.sum('id', { where: { location: { [Op.not]: null } } }),
    ]);

    const summary = {
      totalLocations,
      activeLocations,
      locationsWithAssets,
      totalAssets: Number(totalAssets || 0),
    };

    return res.json({ success: true, data: summary, summary });
  } catch (error) { next(error); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const where = {};
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status && status !== 'all') where.status = status;
    const rows = await Location.findAll({ where, order: [['name', 'ASC']] });
    const data = await normalizeLocationList(rows);
    return res.json({ success: true, data, locations: data, total: data.length });
  } catch (error) { next(error); }
});

router.get('/:id/assets', requireAuth, async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    const assets = await Asset.findAll({
      where: { location: location.name },
      order: [['name', 'ASC']],
      raw: true,
    });
    return res.json({ success: true, data: assets, assets, total: assets.length });
  } catch (error) { next(error); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    const data = await serializeLocation(location);
    return res.json({ success: true, data, location: data });
  } catch (error) { next(error); }
});

router.post('/', ...requireAdmin, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const code = String(req.body.code ?? '').trim() || null;
    if (!name) return res.status(400).json({ success: false, message: 'Location name is required' });
    const duplicate = await Location.findOne({ where: { [Op.or]: [{ name }, { code: code || null }] } });
    if (duplicate) return res.status(409).json({ success: false, message: 'A location with this name or code already exists' });
    const status = ['active', 'inactive'].includes(String(req.body.status || '').toLowerCase()) ? String(req.body.status).toLowerCase() : 'active';
    const location = await Location.create({
      name,
      code,
      description: String(req.body.description || '').trim(),
      status,
    });
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_CREATED', entity: `location:${location.id}`, details: JSON.stringify({ name, code, status }) });
    const data = await serializeLocation(location);
    return res.status(201).json({ success: true, data, location: data, message: 'Location created successfully' });
  } catch (error) { next(error); }
});

router.put('/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : location.name;
    const code = req.body.code !== undefined ? (String(req.body.code).trim() || null) : (location.code || null);
    if (!name) return res.status(400).json({ success: false, message: 'Location name is required' });
    const duplicate = await Location.findOne({ where: { [Op.or]: [{ name }, { code: code || null }], id: { [Op.ne]: location.id } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'A location with this name or code already exists' });
    const nextStatus = req.body.status !== undefined && ['active', 'inactive'].includes(String(req.body.status).toLowerCase()) ? String(req.body.status).toLowerCase() : location.status;
    await location.update({
      name,
      code,
      description: req.body.description !== undefined ? String(req.body.description).trim() : location.description,
      status: nextStatus,
    });
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_UPDATED', entity: `location:${location.id}`, details: JSON.stringify({ previous: { name: location.name, code: location.code, status: location.status }, next: { name, code, status: nextStatus } }) });
    const data = await serializeLocation(location);
    return res.json({ success: true, data, location: data, message: 'Location updated successfully' });
  } catch (error) { next(error); }
});

router.delete('/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    const assetCount = await Asset.count({ where: { location: location.name } });
    if (assetCount > 0) {
      await AuditLog.create({ userId: req.user.id, action: 'LOCATION_DELETE_BLOCKED', entity: `location:${location.id}`, details: JSON.stringify({ name: location.name, assetCount }) });
      return res.status(409).json({ success: false, message: `Location "${location.name}" is used by ${assetCount} assets. Deactivate it instead of deleting.` });
    }
    await location.destroy();
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_DELETED', entity: `location:${location.id}`, details: JSON.stringify({ name: location.name, code: location.code }) });
    return res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) { next(error); }
});

module.exports = router;