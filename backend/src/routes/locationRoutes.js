const express = require('express');
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

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};
    if (search) where.name = { [require('sequelize').Op.like]: `%${search}%` };
    const rows = await Location.findAll({ where, order: [['name', 'ASC']] });
    const data = await Promise.all(rows.map(serializeLocation));
    return res.json({ success: true, data, locations: data, total: data.length });
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
    if (!name) return res.status(400).json({ success: false, message: 'Location name is required' });
    if (await Location.findOne({ where: { name } })) return res.status(409).json({ success: false, message: 'A location with this name already exists' });
    const location = await Location.create({
      name,
      code: String(req.body.code || '').trim(),
      description: String(req.body.description || '').trim(),
      status: ['active', 'inactive'].includes(req.body.status) ? req.body.status : 'active',
    });
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_CREATED', entity: `location:${location.id}`, details: JSON.stringify({ name }) });
    const data = await serializeLocation(location);
    return res.status(201).json({ success: true, data, location: data, message: 'Location created successfully' });
  } catch (error) { next(error); }
});

router.put('/:id', ...requireAdmin, async (req, res, next) => {
  try {
    const location = await Location.findByPk(req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : location.name;
    if (!name) return res.status(400).json({ success: false, message: 'Location name is required' });
    const duplicate = await Location.findOne({ where: { name, id: { [require('sequelize').Op.ne]: location.id } } });
    if (duplicate) return res.status(409).json({ success: false, message: 'A location with this name already exists' });
    await location.update({
      name,
      code: req.body.code !== undefined ? String(req.body.code).trim() : location.code,
      description: req.body.description !== undefined ? String(req.body.description).trim() : location.description,
      status: req.body.status !== undefined && ['active', 'inactive'].includes(req.body.status) ? req.body.status : location.status,
    });
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_UPDATED', entity: `location:${location.id}`, details: JSON.stringify({ name }) });
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
    await AuditLog.create({ userId: req.user.id, action: 'LOCATION_DELETED', entity: `location:${location.id}`, details: JSON.stringify({ name: location.name }) });
    return res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) { next(error); }
});

module.exports = router;