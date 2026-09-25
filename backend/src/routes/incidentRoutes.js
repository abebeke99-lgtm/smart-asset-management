const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const controller = require('../controllers/incidentController');

const router = express.Router();
router.use(requireAuth);
router.get('/statistics', controller.statistics);
router.get('/overdue', controller.overdue);
router.get('/my-incidents', controller.myIncidents);
router.get('/', controller.listIncidents);
router.post('/', controller.createIncident);
router.get('/:id/comments', controller.listComments);
router.post('/:id/comments', controller.addComment);
router.get('/:id/history', controller.listHistory);
router.post('/:id/attachments', controller.addAttachment);
router.get('/:id', controller.getIncidentDetails);
router.put('/:id', controller.updateIncident);
router.patch('/:id/status', controller.transition);
router.patch('/:id/assign', controller.assignIncident);
router.patch('/:id/escalate', controller.escalateIncident);
router.patch('/:id/investigate', (req, res, next) => { req.body.status = 'investigating'; controller.transition(req, res, next); });
router.patch('/:id/resolve', (req, res, next) => { req.body.status = 'resolved'; controller.transition(req, res, next); });
router.patch('/:id/close', (req, res, next) => { req.body.status = 'closed'; controller.transition(req, res, next); });
router.patch('/:id/reopen', (req, res, next) => { req.body.status = 'investigating'; controller.transition(req, res, next); });
router.delete('/:id', controller.removeIncident);

module.exports = router;
