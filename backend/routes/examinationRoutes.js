const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const examinationController = require('../controllers/examinationController');

router.use(authMiddleware);

// Get marks for the logged-in student
router.get('/my-marks', examinationController.getMyMarks);

// Get marks by student ID (accessible to staff / authorized users)
router.get('/student/:studentId/marks', examinationController.getStudentMarks);

module.exports = router;
