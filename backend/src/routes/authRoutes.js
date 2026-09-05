const express = require('express');
const { login, register, changePassword, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.put('/change-password', requireAuth, changePassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
