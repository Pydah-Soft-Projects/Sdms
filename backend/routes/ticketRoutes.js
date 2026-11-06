const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');
const ticketController = require('../controllers/ticketController');

// All routes require authentication
router.use(authMiddleware);

// Student routes (no permission check - students can manage their own tickets)
router.post(
  '/',
  ticketController.uploadPhoto,
  ticketController.createTicket
);

router.get(
  '/student/my-tickets',
  ticketController.getStudentTickets
);

router.post(
  '/:id/feedback',
  ticketController.submitFeedback
);

router.post(
  '/:id/reopen',
  ticketController.reopenStudentTicket
);

// Admin routes - require ticket management permission
router.get(
  '/',
  verifyPermission('ticket_management', 'read'),
  ticketController.getTickets
);

router.get(
  '/stats',
  verifyPermission('ticket_management', 'read'),
  ticketController.getTicketStats
);

// Allow students to view their own tickets, or admins with permission
router.get(
  '/:id',
  ticketController.getTicket
);

router.post(
  '/:id/assign',
  verifyPermission('ticket_management', 'write'),
  ticketController.assignTicket
);

router.put(
  '/:id/status',
  verifyPermission('ticket_management', 'write'),
  ticketController.changeTicketStatus
);

router.post(
  '/:id/comments',
  verifyPermission('ticket_management', 'write'),
  ticketController.addComment
);

module.exports = router;
