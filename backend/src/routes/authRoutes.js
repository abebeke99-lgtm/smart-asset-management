const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  login,
  register,
  changePassword,
  logout,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
} = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset attempts. Please try again later.' },
});

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/forgot-password/request-otp', forgotPasswordLimiter, requestForgotPasswordOtp);
router.post('/forgot-password/verify-otp', otpLimiter, verifyForgotPasswordOtp);
router.post('/forgot-password/reset-password', resetLimiter, resetPasswordWithOtp);
router.post('/verify-reset-otp', otpLimiter, verifyResetOtp);
router.post('/reset-password', resetLimiter, resetPassword);
router.put('/change-password', requireAuth, changePassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
