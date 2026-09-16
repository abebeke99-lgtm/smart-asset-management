const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');
const controller = require('../controllers/ictAssetController');

const router = express.Router();
const scopedIctAccess = [requireAuth, requireRole('admin', 'ict_officer'), (req, res, next) => req.user.role === 'admin' ? next() : resolveCollegeScope(req, res, next)];

router.get('/options', ...scopedIctAccess, controller.getIctOptions);
router.get('/', ...scopedIctAccess, controller.listIctAssets);
router.get('/:id', ...scopedIctAccess, controller.getIctAsset);
router.patch('/:id', ...scopedIctAccess, controller.updateIctAsset);

module.exports = router;