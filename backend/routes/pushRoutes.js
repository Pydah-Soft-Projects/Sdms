const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const verifyToken = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

// Public key does not need auth, but better to have it open
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Subscribe (Web)
router.post('/subscribe', verifyToken, pushController.subscribe);

// Register Mobile Push Token (Expo Android / iOS)
router.post('/register-mobile', verifyToken, pushController.registerMobile);

// Unregister Mobile Push Token on Logout
router.post('/unregister-mobile', verifyToken, pushController.unregisterMobile);

// Test Device Push Notification
router.post('/test-device', verifyToken, pushController.testDevicePush);

// Broadcast (Admin only)
router.post('/broadcast', verifyToken, requireAdmin, pushController.broadcastNotification);

module.exports = router;
