const express = require('express');
const controller = require('../controllers/technicalSupportController');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const managers = ['admin', 'ict_officer', 'maintenance', 'infrastructure'];
router.use(requireAuth);
router.get('/statistics', controller.statistics);
router.get('/overdue', controller.overdueTickets);
router.get('/my-tickets', (req, res, next) => { req.query.my = 'true'; controller.listTickets(req, res, next); });
router.get('/technicians', requireRole(...managers), controller.technicians);
router.get('/tickets', controller.listTickets);
router.post('/tickets', controller.createTicket);
router.get('/tickets/:id', controller.getTicketDetails);
router.patch('/tickets/:id/status', requireRole(...managers), controller.updateStatus);
router.patch('/tickets/:id/resolve', requireRole(...managers), (req, res, next) => { req.body = { ...req.body, status: 'resolved' }; controller.updateStatus(req, res, next); });
router.patch('/tickets/:id/close', requireRole(...managers), (req, res, next) => { req.body = { ...req.body, status: 'closed' }; controller.updateStatus(req, res, next); });
router.patch('/tickets/:id/reopen', requireAuth, (req, res, next) => { req.body = { ...req.body, status: 'open', comment: req.body.reason || 'Ticket reopened' }; controller.updateStatus(req, res, next); });
router.patch('/tickets/:id/assign', requireRole(...managers), controller.assignTicket);
router.get('/tickets/:id/comments', controller.listComments);
router.post('/tickets/:id/comments', controller.createComment);
router.get('/tickets/:id/history', controller.listHistory);

module.exports = router;