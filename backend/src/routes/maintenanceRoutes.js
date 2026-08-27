const express = require('express');
const { getAllMaintenance, createMaintenance, updateMaintenance, setStatus, approve, reject, start, complete, assign, removeMaintenance, dashboard } = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, getAllMaintenance);
router.get('/scheduled', requireAuth, getAllMaintenance);
router.get('/history', requireAuth, getAllMaintenance);
router.get('/dashboard', requireAuth, dashboard);
const ictMaintenanceAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance')];
router.post('/', requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'department_head'), createMaintenance);
router.put('/:id', ...ictMaintenanceAccess, updateMaintenance);
router.patch('/:id/status', ...ictMaintenanceAccess, setStatus);
router.patch('/:id/approve', ...ictMaintenanceAccess, approve);
router.patch('/:id/reject', ...ictMaintenanceAccess, reject);
router.patch('/:id/start', ...ictMaintenanceAccess, start);
router.post('/:id/complete', ...ictMaintenanceAccess, complete);
router.post('/:id/diagnosis', ...ictMaintenanceAccess, updateMaintenance);
router.post('/:id/reassign', ...ictMaintenanceAccess, assign);
router.delete('/:id', ...ictMaintenanceAccess, removeMaintenance);

module.exports = router;
