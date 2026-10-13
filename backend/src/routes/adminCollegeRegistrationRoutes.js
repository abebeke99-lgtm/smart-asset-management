const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const controller = require('../controllers/collegeRegistrationController');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', controller.listApplications);
router.post('/:id/approve', controller.approveApplication);
router.post('/:id/reject', controller.rejectApplication);

module.exports = router;
