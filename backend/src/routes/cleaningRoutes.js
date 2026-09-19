const express = require('express');
const {
  listSchedules,
  createSchedule,
  updateSchedule,
  getSchedule,
  deleteSchedule,
  dashboard,
} = require('../controllers/cleaningController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, listSchedules);
router.get('/dashboard', requireAuth, requireRole('admin', 'maintenance'), dashboard);
router.post('/', requireAuth, requireRole('admin', 'maintenance', 'infrastructure'), createSchedule);
router.get('/:id', requireAuth, getSchedule);
router.put('/:id', requireAuth, requireRole('admin', 'maintenance', 'infrastructure'), updateSchedule);
router.delete('/:id', requireAuth, requireRole('admin', 'maintenance', 'infrastructure'), deleteSchedule);

module.exports = router;