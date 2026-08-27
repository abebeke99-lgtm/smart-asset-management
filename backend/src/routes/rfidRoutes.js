const express = require('express');
const { getAllLogs, createLog } = require('../controllers/rfidController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, getAllLogs);
router.get('/logs', requireAuth, getAllLogs);
router.get('/history/:assetId', requireAuth, getAllLogs);
router.post('/', requireAuth, requireRole('admin', 'ict_officer'), createLog);

module.exports = router;
