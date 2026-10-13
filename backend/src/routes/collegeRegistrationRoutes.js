const express = require('express');
const rateLimit = require('express-rate-limit');
const rateLimitKeyGenerator = require('../utils/rateLimitKeyGenerator');
const controller = require('../controllers/collegeRegistrationController');

const router = express.Router();
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: rateLimitKeyGenerator,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many registration attempts. Please try again later.' },
});
const statusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: rateLimitKeyGenerator,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many status requests. Please try again later.' },
});
router.get('/campuses', controller.listCampuses);
router.post('/', submissionLimiter, controller.submitApplication);
router.get('/status/:id', statusLimiter, controller.getApplicationStatus);

module.exports = router;
