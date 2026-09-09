const express = require('express');
const { getAllUsers, getUserById, createUser, updateUser, deleteUser, updateProfile, setUserSecurityState, resetUserPassword, forcePasswordChange, terminateUserSession } = require('../controllers/userController');
const { AuditLog, User } = require('../models');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

router.get('/', requireAuth, requireRole('admin', 'college', 'store_manager', 'ict_officer', 'maintenance'), getAllUsers);
router.get('/technicians', requireAuth, requireRole('admin', 'maintenance', 'ict_officer'), getAllUsers);
router.put('/profile', requireAuth, updateProfile);
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
router.get('/:id', requireAuth, getUserById);
router.post('/', requireAuth, requireRole('admin'), createUser);
router.put('/:id', requireAuth, requireRole('admin'), updateUser);
router.delete('/:id', requireAuth, requireRole('admin'), deleteUser);

module.exports = router;
