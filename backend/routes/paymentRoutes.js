const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/auth');

// Endpoint 1: Create a Payment Order (PPG Hosted Checkout & legacy support)
router.post('/create', authMiddleware, paymentController.createOrder);
router.post('/create-order', authMiddleware, paymentController.createOrder);

// Endpoint 2: Hosted Checkout Confirmation (Verify & Record from redirect)
router.post('/confirm', authMiddleware, paymentController.confirmPayment);
router.get('/confirm/:paymentId', authMiddleware, paymentController.confirmPayment);

// Endpoint 3: Verify Payment Signature (Direct SDK / legacy support)
router.post('/verify/:paymentId', authMiddleware, paymentController.verifyPayment);
router.post('/verify', authMiddleware, paymentController.verifyPayment);

// Endpoint 4: Status check from Pydah Payment Gateway
router.get('/status/:paymentId', authMiddleware, paymentController.getPaymentStatus);

// Endpoint 5: Inbound Webhook Listener from PPG
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
