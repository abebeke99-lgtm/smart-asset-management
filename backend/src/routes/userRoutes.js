const express = require('express');
const multer = require('multer');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, getCurrentUserProfile, updateProfile, updateCurrentUserProfilePhoto, removeCurrentUserProfilePhoto, setUserSecurityState, resetUserPassword, forcePasswordChange, terminateUserSession } = require('../controllers/userController');
const { AuditLog, User } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { validateProfilePhoto } = require('../utils/uploadUtils');

const router = express.Router();
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const validation = validateProfilePhoto({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: Buffer.alloc(0),
    }, { maxSize: 5 * 1024 * 1024 });

    if (!validation.valid) {
      return cb(new Error(validation.message));
    }

    cb(null, true);
  },
});

router.get('/', requireAuth, requireRole('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'), getAllUsers);
router.get('/technicians', requireAuth, requireRole('admin', 'maintenance', 'ict_officer'), getAllUsers);
router.get('/profile', requireAuth, getCurrentUserProfile);
router.put('/profile', requireAuth, updateProfile);
router.post('/profile/photo', requireAuth, profilePhotoUpload.single('photo'), updateCurrentUserProfilePhoto);
router.delete('/profile/photo', requireAuth, removeCurrentUserProfilePhoto);
router.post('/:id/lock', requireAuth, requireRole('admin'), (req, res, next) => setUserSecurityState(req, res, 'lock').catch(next));
router.post('/:id/unlock', requireAuth, requireRole('admin'), (req, res, next) => setUserSecurityState(req, res, 'unlock').catch(next));
router.post('/:id/reset-password', requireAuth, requireRole('admin'), (req, res, next) => resetUserPassword(req, res).catch(next));
router.post('/:id/force-password-change', requireAuth, requireRole('admin'), (req, res, next) => forcePasswordChange(req, res).catch(next));
router.post('/:id/terminate-session', requireAuth, requireRole('admin'), (req, res, next) => terminateUserSession(req, res).catch(next));
router.get('/activity', requireAuth, requireRole('admin'), async (req, res, next) => {
	try {
		const where = req.query.userId ? { userId: req.query.userId } : {};
		const logs = await AuditLog.findAll({
			where,
			include: [{ model: User, attributes: ['username', 'fullName', 'role'] }],
			order: [['createdAt', 'DESC']],
			limit: 500,
		});
		res.json({ success: true, data: logs, activities: logs });
	} catch (error) {
		next(error);
	}
});
router.get('/:id/activity', requireAuth, requireRole('admin'), async (req, res, next) => {
	try {
		const where = req.params.id === 'all' ? {} : { userId: req.params.id };
		const logs = await AuditLog.findAll({
			where,
			include: [{ model: User, attributes: ['username', 'fullName', 'role'] }],
			order: [['createdAt', 'DESC']],
			limit: 500,
		});
		res.json({ success: true, logs });
	} catch (error) {
		next(error);
	}
});
router.get('/:id', requireAuth, requireRole('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'), getUserById);
router.post('/', requireAuth, requireRole('admin'), createUser);
router.put('/:id', requireAuth, requireRole('admin'), updateUser);
router.delete('/:id', requireAuth, requireRole('admin'), deleteUser);

module.exports = router;
