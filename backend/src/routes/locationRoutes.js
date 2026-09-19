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

module.exports = router;