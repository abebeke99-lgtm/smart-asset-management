const express = require('express');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { resolveCollegeScope } = require('../middlewares/organizationScope');
const controller = require('../controllers/softwareLicenseController');

const router = express.Router();
const access = [requireAuth, requireRole('admin', 'ict_officer'), (req, res, next) => req.user.role === 'admin' ? next() : resolveCollegeScope(req, res, next)];

router.get('/statistics', ...access, controller.statistics);
router.get('/expiring', ...access, controller.list);
router.get('/:id/assignments', ...access, controller.listAssignments);
router.post('/:id/assignments', ...access, controller.assign);
router.delete('/:id/assignments/:assignmentId', ...access, controller.unassign);
router.patch('/:id/archive', ...access, controller.archive);
router.patch('/:id/restore', ...access, controller.restore);
router.get('/:id', ...access, controller.details);
router.put('/:id', ...access, controller.update);
router.delete('/:id', ...access, controller.archive);
router.get('/', ...access, controller.list);
router.post('/', ...access, controller.create);

module.exports = router;
