const router = require('express').Router();
const adminSettings = require('../controllers/adminSettingsController');
const { auth, isAdmin } = require('../middleware/auth');

router.get('/settings', auth, isAdmin, adminSettings.getSettings);
router.put('/settings', auth, isAdmin, adminSettings.updateSettings);

module.exports = router;