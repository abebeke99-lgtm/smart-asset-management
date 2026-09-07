const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, register, changePassword, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const forgotPasswordLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-8',
	legacyHeaders: false,
	message: { success: false, message: 'Too many password reset requests. Please try again later.' },
});

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', requireAuth, changePassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
