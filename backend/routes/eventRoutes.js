const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/auth');
const { verifyPermission } = require('../middleware/rbac');

// Admin Routes - Reuse 'announcements' permission for now (Pragmatic choice)
router.post(
    '/',
    authMiddleware,
    verifyPermission('announcements', 'create'),
    eventController.createEvent
);

router.get(
    '/admin',
    authMiddleware,
    verifyPermission('announcements', 'view'),
    eventController.getEvents
);

router.get(
    '/:id/registrations',
    authMiddleware,
    verifyPermission('announcements', 'view'),
    eventController.getEventRegistrations
);

router.delete(
    '/:id/registrations/:registrationId',
    authMiddleware,
    verifyPermission('announcements', 'edit'),
    eventController.removeEventRegistration
);

router.put(
    '/:id',
    authMiddleware,
    verifyPermission('announcements', 'edit'),
    eventController.updateEvent
);

router.delete(
    '/:id',
    authMiddleware,
    verifyPermission('announcements', 'delete'),
    eventController.deleteEvent
);

router.patch(
    '/:id/status',
    authMiddleware,
    verifyPermission('announcements', 'edit'),
    eventController.toggleStatus
);

// Student Routes
router.get(
    '/student',
    authMiddleware,
    eventController.getStudentEvents
);

router.post('/:id/register', authMiddleware, eventController.registerForEvent);
router.delete('/:id/register', authMiddleware, eventController.cancelEventRegistration);

module.exports = router;
