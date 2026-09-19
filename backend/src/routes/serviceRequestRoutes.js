const express = require('express');
const {
  createServiceRequest,
  listServiceRequests,
  getServiceRequest,
  setStatus,
  acknowledge,
  acknowledgeTicket,
  start,
  complete,
  cancel,
  assignTicket,
  escalateTickets,
  listFeedback,
  createFeedback,
  listTechnicianCandidates,
  getRoutingOptions,
} = require('../controllers/serviceRequestController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();

const serviceManagerRoles = ['admin', 'maintenance', 'ict_officer', 'infrastructure'];

router.get('/', requireAuth, listServiceRequests);
router.get('/routing-options', requireAuth, getRoutingOptions);
router.get('/technicians', requireAuth, requireRole(...serviceManagerRoles), listTechnicianCandidates);
router.post('/', requireAuth, createServiceRequest);
router.get('/escalate/run', requireAuth, requireRole('admin'), escalateTickets);
router.post('/escalate/run', requireAuth, requireRole('admin'), escalateTickets);
router.get('/feedback', requireAuth, listFeedback);
router.get('/:id', requireAuth, getServiceRequest);
router.patch('/:id/status', requireAuth, requireRole(...serviceManagerRoles), setStatus);
router.post('/:id/acknowledge', requireAuth, requireRole(...serviceManagerRoles), acknowledgeTicket);
router.post('/:id/assign', requireAuth, requireRole(...serviceManagerRoles), assignTicket);
router.post('/:id/start', requireAuth, requireRole(...serviceManagerRoles), start);
router.post('/:id/complete', requireAuth, requireRole(...serviceManagerRoles), complete);
router.post('/:id/cancel', requireAuth, cancel);
router.post('/:id/feedback', requireAuth, createFeedback);

module.exports = router;