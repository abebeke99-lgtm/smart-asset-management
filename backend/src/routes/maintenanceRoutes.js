const express = require('express');
const path = require('path');
const fs = require('fs');
const { getAllMaintenance, createMaintenance, updateMaintenance, setStatus, approve, reject, start, complete, assign, removeMaintenance, dashboard, getRepairHistory, getRepairDetails, createRepair, updateRepair } = require('../controllers/maintenanceController');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { sequelize, Config, Notification, AuditLog } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

const maintenanceReadAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'college', 'store_manager')];
router.get('/', ...maintenanceReadAccess, getAllMaintenance);
router.get('/scheduled', ...maintenanceReadAccess, getAllMaintenance);
router.get('/history', ...maintenanceReadAccess, getAllMaintenance);
router.get('/dashboard', ...maintenanceReadAccess, dashboard);
const ictRepairAccess = [requireAuth, requireRole('ict_officer')];
router.get('/repairs', ...ictRepairAccess, getRepairHistory);
router.get('/repairs/:id', ...ictRepairAccess, getRepairDetails);
router.post('/repairs', ...ictRepairAccess, createRepair);
router.put('/repairs/:id', ...ictRepairAccess, updateRepair);
const ictMaintenanceAccess = [requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'store_manager')];
router.post('/', requireAuth, requireRole('admin', 'ict_officer', 'maintenance', 'college', 'store_manager'), createMaintenance);
router.put('/:id', ...ictMaintenanceAccess, updateMaintenance);
router.patch('/:id/status', ...ictMaintenanceAccess, setStatus);
router.patch('/:id/approve', ...ictMaintenanceAccess, approve);
router.patch('/:id/reject', ...ictMaintenanceAccess, reject);
router.patch('/:id/start', ...ictMaintenanceAccess, start);
router.post('/:id/complete', ...ictMaintenanceAccess, complete);
router.post('/:id/diagnosis', ...ictMaintenanceAccess, updateMaintenance);
router.post('/:id/reassign', ...ictMaintenanceAccess, assign);
router.delete('/:id', ...ictMaintenanceAccess, removeMaintenance);

const adminSystemActions = [requireAuth, requireRole('admin')];

router.post('/optimize-db', ...adminSystemActions, async (req, res, next) => {
  try {
    const [tables] = await sequelize.query('SHOW TABLES');
    const tableNames = tables.map((row) => Object.values(row)[0]).filter(Boolean);
    const optimized = [];
    for (const tableName of tableNames) {
      await sequelize.query(`OPTIMIZE TABLE \`${tableName}\``);
      optimized.push(tableName);
    }
    await AuditLog.create({ userId: req.user.id, action: 'DB_OPTIMIZED', entity: 'database', details: JSON.stringify({ tables: optimized.length }) });
    res.json({ success: true, message: `Database optimization completed (${optimized.length} tables).`, data: { optimized: optimized.length, tables: optimized } });
  } catch (error) { next(error); }
});

router.post('/clear-cache', ...adminSystemActions, async (req, res, next) => {
  try {
    const uploadPath = path.join(__dirname, '../../uploads');
    let removed = 0;
    if (fs.existsSync(uploadPath)) {
      const entries = fs.readdirSync(uploadPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(tmp|bak)$/i.test(entry.name)) {
          fs.unlinkSync(path.join(uploadPath, entry.name));
          removed += 1;
        }
      }
    }
    await AuditLog.create({ userId: req.user.id, action: 'CACHE_CLEARED', entity: 'cache', details: JSON.stringify({ filesRemoved: removed }) });
    res.json({ success: true, message: removed ? `Cache cleared (${removed} temporary files removed).` : 'No application cache files were found to clear.', data: { filesRemoved: removed } });
  } catch (error) { next(error); }
});

router.post('/cleanup', ...adminSystemActions, async (req, res, next) => {
  try {
    const [orphanCheck] = await sequelize.query('SELECT COUNT(*) AS cnt FROM notifications n LEFT JOIN users u ON u.id = n.user_id WHERE n.user_id IS NOT NULL AND u.id IS NULL');
    const orphaned = Number(orphanCheck[0]?.cnt || 0);
    if (orphaned > 0) await sequelize.query('DELETE FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)');
    await AuditLog.create({ userId: req.user.id, action: 'SYSTEM_CLEANUP', entity: 'system', details: JSON.stringify({ orphanedNotificationsRemoved: orphaned }) });
    res.json({ success: true, message: orphaned ? `Cleanup completed (${orphaned} orphaned records removed).` : 'Cleanup completed; no orphaned records found.', data: { orphanedNotificationsRemoved: orphaned } });
  } catch (error) { next(error); }
});

router.post('/reset', ...adminSystemActions, async (req, res, next) => {
  try {
    const [deleted] = await Config.destroy({ where: { key: { [Op.like]: 'settings:%' } } });
    const deletedSystem = await Config.destroy({ where: { key: { [Op.in]: ['system', 'security'] } } });
    await AuditLog.create({ userId: req.user.id, action: 'SYSTEM_SETTINGS_RESET', entity: 'system', details: JSON.stringify({ settingsReset: deleted, legacyConfigReset: deletedSystem }) });
    res.json({ success: true, message: `System settings reset to defaults (${deleted + deletedSystem} records cleared).`, data: { settingsReset: deleted, legacyConfigReset: deletedSystem } });
  } catch (error) { next(error); }
});

module.exports = router;
