const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentFeedbackPortalController');
const authMiddleware = require('../middleware/auth');

// All routes require student auth
router.use(authMiddleware);

// GET  /api/student-feedback/publications          – list active publications for this student
router.get('/publications', ctrl.getActivePublications);

// GET  /api/student-feedback/forms/:formId         – fetch form questions
router.get('/forms/:formId', ctrl.getFeedbackForm);

// POST /api/student-feedback/publications/:publicationId/submit  – submit response
router.post('/publications/:publicationId/submit', ctrl.submitFeedback);

module.exports = router;
