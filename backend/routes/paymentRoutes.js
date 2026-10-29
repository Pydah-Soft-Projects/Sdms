const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');

// Endpoint 1: Create a Payment Order (PPG & legacy support)
router.post('/create', authMiddleware, paymentController.createOrder);
router.post('/create-order', authMiddleware, paymentController.createOrder);

// Endpoint 2: Verify Payment Signature (PPG & legacy support)
router.post('/verify/:paymentId', authMiddleware, paymentController.verifyPayment);
router.post('/verify', authMiddleware, paymentController.verifyPayment);

// Endpoint 3: Status check from Pydah Payment Gateway
router.get('/status/:paymentId', authMiddleware, paymentController.getPaymentStatus);

// Endpoint 4: Inbound Webhook Listener from PPG
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
