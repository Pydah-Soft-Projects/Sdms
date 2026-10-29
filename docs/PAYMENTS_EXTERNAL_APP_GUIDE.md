# Pydah Payment Gateway — Client Application Integration Guide

This guide provides instructions and copy-pasteable code for integrating any PydahSoft application (LMS, Admissions, Student Portal, ERP, etc.) with the **Pydah Payment Gateway (PPG)**.

---

## 1. Environment Configuration (`.env`)

> **Best Practice:** Always store your Gateway credentials and URLs in your application backend's `.env` file. **Never** hardcode secrets in code, and **never** expose `PPG_APP_SECRET` in browser/frontend code.

In your application backend's `.env` file, add:

```dotenv
# Pydah Payment Gateway Base API URL
PPG_BASE_URL=http://localhost:5000/api/v1

# Credentials obtained from PPG Admin Console (Applications section)
PPG_APP_KEY=key_your_application_key_id
PPG_APP_SECRET=sec_your_application_secret_key
```

---

## 2. Integration Flow Architecture

```
[ User Browser / Mobile App ]              [ Your App Backend ]               [ Pydah Payment Gateway ]
             |                                       |                                   |
             | 1. Click "Pay"                        |                                   |
             |-------------------------------------->|                                   |
             |                                       | 2. POST /payments                 |
             |                                       |    Headers: X-App-Key & Secret    |
             |                                       |---------------------------------->|
             |                                       |                                   | (Creates Razorpay Order)
             |                                       | 3. Returns { paymentId, checkout }|
             |                                       |<----------------------------------|
             | 4. Returns checkout options           |                                   |
             |<--------------------------------------|                                   |
             |                                       |                                   |
             | 5. User completes payment on Razorpay |                                   |
             |    Modal (returns signature)          |                                   |
             |                                       |                                   |
             | 6. POST /verify-payment/:paymentId    |                                   |
             |-------------------------------------->|                                   |
             |                                       | 7. POST /payments/:id/verify      |
             |                                       |---------------------------------->|
             |                                       |                                   | (Verifies HMAC SHA-256)
             |                                       | 8. 200 OK (SUCCEEDED)             |
             |                                       |<----------------------------------|
             | 9. "Payment Successful!"              |                                   |
             |<--------------------------------------|                                   |
```

---

## 3. Backend Integration (Node.js / Express)

Add this router to your application backend:

```javascript
// File: routes/payment.routes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// Load Gateway settings from your backend environment variables
const PPG_BASE_URL = process.env.PPG_BASE_URL || 'http://localhost:5000/api/v1';
const APP_KEY = process.env.PPG_APP_KEY;
const APP_SECRET = process.env.PPG_APP_SECRET;

/**
 * Endpoint 1: Create a Payment Order
 * POST /api/payments/create
 */
router.post('/payments/create', async (req, res) => {
  try {
    const { amountInRupees, customerName, customerEmail, customerPhone, description, referenceId } = req.body;

    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    // PPG stores money in integer minor units (paise). ₹1,500.00 = 150000 paise.
    const amountInPaise = Math.round(amountInRupees * 100);
    const businessReference = referenceId || `REF-${Date.now()}`;
    const idempotencyKey = `idemp-${businessReference}`;

    // Server-to-server call to Pydah Payment Gateway
    const ppgResponse = await axios.post(
      `${PPG_BASE_URL}/payments`,
      {
        businessReference,
        amount: amountInPaise,
        currency: 'INR',
        description: description || 'PydahSoft Application Payment',
        customer: {
          name: customerName || '',
          email: customerEmail || '',
          phone: customerPhone || '',
        },
        idempotencyKey,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': APP_KEY,
          'X-App-Secret': APP_SECRET,
          'X-Idempotency-Key': idempotencyKey,
        },
        timeout: 10000,
      }
    );

    // Return the paymentId and safe checkout configuration to your frontend
    res.status(201).json({
      success: true,
      paymentId: ppgResponse.data.data.paymentId,
      checkout: ppgResponse.data.data.checkout,
    });
  } catch (error) {
    console.error('PPG Order Creation Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
    });
  }
});

/**
 * Endpoint 2: Verify Payment Signature
 * POST /api/payments/verify/:paymentId
 */
router.post('/payments/verify/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment signature parameters' });
    }

    // Authoritative cryptographic verification performed by Gateway
    const verifyResponse = await axios.post(
      `${PPG_BASE_URL}/payments/${paymentId}/verify`,
      {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': APP_KEY,
          'X-App-Secret': APP_SECRET,
        },
        timeout: 10000,
      }
    );

    // Signature verified successfully -> Payment marked as SUCCEEDED
    // Perform your application business logic here (mark invoice paid, unlock features, etc.)
    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: verifyResponse.data.data,
    });
  } catch (error) {
    console.error('PPG Signature Verification Failed:', error.response?.data || error.message);
    res.status(400).json({
      success: false,
      error: 'Cryptographic signature verification failed',
    });
  }
});

/**
 * Endpoint 3: Optional Inbound Webhook Listener
 * POST /api/payments/webhook
 */
router.post('/payments/webhook', (req, res) => {
  const event = req.body;
  const signature = req.headers['x-ppg-signature'];

  console.log(`[PPG Webhook] Event: ${event.event}`, event.data);

  if (event.event === 'payment.succeeded') {
    // Payment confirmed in gateway
    console.log(`Payment ${event.data.paymentId} confirmed.`);
  }

  res.status(200).json({ received: true });
});

module.exports = router;
```

---

## 4. Frontend Client Integration (React / Web)

### Step 1: Add Razorpay Checkout Script
Add Razorpay's script to your frontend's `index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

### Step 2: Trigger Payment Function
```javascript
async function initiateCheckout(amountInRupees) {
  try {
    // 1. Call your own backend
    const res = await fetch('/api/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInRupees,
        customerName: 'Student Name',
        customerEmail: 'student@pydah.edu.in',
        description: 'Semester Tuition Fee',
      }),
    });

    const data = await res.json();
    if (!data.success) {
      alert('Order creation failed: ' + data.error);
      return;
    }

    const { paymentId, checkout } = data;

    // 2. Open Razorpay Checkout Modal
    const options = {
      key: checkout.keyId,       // Public Key ID provided by Gateway
      amount: checkout.amount,   // In paise
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      order_id: checkout.orderId,
      prefill: checkout.prefill,
      theme: { color: '#4f46e5' },
      handler: async function (response) {
        // 3. Send response to your backend for server-side verification
        const verifyRes = await fetch(`/api/payments/verify/${paymentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          alert('Payment Successful and Verified!');
        } else {
          alert('Verification failed: ' + verifyData.error);
        }
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Failed to initiate checkout: ' + error.message);
  }
}
```

---

## 5. cURL Quick Test Reference

### Create Payment:
```bash
curl -X POST "$PPG_BASE_URL/payments" \
  -H "Content-Type: application/json" \
  -H "X-App-Key: $PPG_APP_KEY" \
  -H "X-App-Secret: $PPG_APP_SECRET" \
  -H "X-Idempotency-Key: idemp-sample-001" \
  -d '{
    "businessReference": "INV-1001",
    "amount": 150000,
    "currency": "INR",
    "description": "Fee Payment",
    "customer": {
      "name": "Bannu Kumar",
      "email": "student@pydah.edu.in"
    }
  }'
```

### Check Payment Status:
```bash
curl -X GET "$PPG_BASE_URL/payments/PAYMENT_ID" \
  -H "X-App-Key: $PPG_APP_KEY" \
  -H "X-App-Secret: $PPG_APP_SECRET"
```
