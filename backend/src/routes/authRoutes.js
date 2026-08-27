const express = require('express');
const { login, register, changePassword, logout } = require('../controllers/authController');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', register);
router.put('/change-password', requireAuth, changePassword);
router.post('/logout', requireAuth, logout);

module.exports = router;
