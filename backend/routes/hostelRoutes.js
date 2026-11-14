const express = require('express');
const router = express.Router();
const hostelController = require('../controllers/hostelController');
const verifyToken = require('../middleware/auth');

// Get current student's hostel details (account existence, allocation, fees, leaves, complaints, attendance)
router.get('/my-details', verifyToken, hostelController.getMyHostelDetails);

// Get mess menus
router.get('/menu', verifyToken, hostelController.getHostelMenu);

// Get hostel announcements
router.get('/announcements', verifyToken, hostelController.getHostelAnnouncements);

module.exports = router;

