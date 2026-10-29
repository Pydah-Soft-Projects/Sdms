# Pydah Payment Gateway — Client Application Integration Guide

This guide is for any PydahSoft application (LMS, Admissions, Student Portal, ERP, etc.) integrating with the **Pydah Payment Gateway (PPG)**.

---

## 1. Environment Configuration (`.env`)

In your application backend's `.env` file, store your Gateway API URL and credentials:

```dotenv
# Pydah Payment Gateway Base API URL
PPG_BASE_URL=http://localhost:5000/api/v1

# S2S API Credentials (from Gateway Dashboard -> Applications)
PPG_APP_KEY=key_your_application_key_id
PPG_APP_SECRET=sec_your_application_secret_key
```

> **Security Rule:** `PPG_APP_SECRET` must **only** reside on your backend server. Never expose it in browser bundles or client code.

---

## 2. In-Page Popup Checkout via `ppg.js` (Recommended)

Using the **PPG Drop-in SDK (`ppg.js`)**, the payment modal opens **directly inside your own website as an overlay**. The student never leaves your URL, and your application needs **zero provider SDKs** (no Razorpay, no Cashfree).

```
[Student on Your App] ---> Clicks "Pay ₹1,500"
         |
         v
[Your App Backend] calls PPG `POST /payments` ---> returns `checkoutUrl`
         |
         v
[Your App Frontend] calls `PPG.openCheckout({ checkoutUrl, onSuccess })`
         |
         v
[PPG In-Page Modal Opens on Your Screen] ---> Student pays
         |
         v
[Payment Verified] ---> Modal closes automatically ---> `onSuccess` callback runs!
```

---

### Step A: Your Backend Creates Order & Returns `checkoutUrl`

Add this endpoint to your application backend:

```javascript
// File: routes/payment.routes.js (in your backend)
const express = require('express');
const axios = require('axios');
const router = express.Router();

const PPG_BASE_URL = process.env.PPG_BASE_URL || 'http://localhost:5000/api/v1';
const APP_KEY = process.env.PPG_APP_KEY;
const APP_SECRET = process.env.PPG_APP_SECRET;

router.post('/api/payments/create-order', async (req, res) => {
  try {
    const { amountInRupees, customerName, customerEmail } = req.body;

    // Convert Rupees to integer paise: ₹1,500.00 = 150000 paise
    const amountInPaise = Math.round(amountInRupees * 100);
    const businessReference = `INV-${Date.now()}`;

    const ppgResponse = await axios.post(
      `${PPG_BASE_URL}/payments`,
      {
        businessReference,
        amount: amountInPaise,
        currency: 'INR',
        description: 'Semester Tuition Fee',
        customer: {
          name: customerName,
          email: customerEmail,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': APP_KEY,
          'X-App-Secret': APP_SECRET,
          'X-Idempotency-Key': `idemp-${businessReference}`,
        },
      }
    );

    // Return the checkoutUrl to your frontend
    res.json({
      success: true,
      paymentId: ppgResponse.data.data.paymentId,
      checkoutUrl: ppgResponse.data.data.checkoutUrl,
    });
  } catch (error) {
    console.error('PPG Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

module.exports = router;
```

---

### Step B: Your Frontend Opens the In-Page Popup

#### 1. Add `ppg.js` to your frontend's `index.html`:
```html
<script src="http://localhost:5000/sdk/ppg.js"></script>
```
*(Replace `http://localhost:5000` with your deployed Gateway domain in production).*

#### 2. Trigger the in-page popup when user clicks Pay:
```javascript
// In your React / Vue / HTML frontend:
async function handlePayNow(amount) {
  try {
    // 1. Get the checkoutUrl from your backend
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInRupees: amount,
        customerName: 'Bannu Kumar',
        customerEmail: 'student@pydah.edu.in',
      }),
    });

    const data = await res.json();
    if (!data.success) {
      alert('Order creation failed: ' + data.error);
      return;
    }

    // 2. Open the Gateway popup right inside your application!
    window.PPG.openCheckout({
      checkoutUrl: data.checkoutUrl,
      onSuccess: function (result) {
        // Payment succeeded and verified!
        console.log('Payment Completed:', result);
        alert('Payment Successful! Payment ID: ' + result.paymentId);
        
        // Refresh your UI or update invoice status in your frontend
      },
      onFailure: function (error) {
        alert('Payment failed: ' + (error.message || 'Transaction declined'));
      },
      onClose: function () {
        console.log('Student closed the payment window without paying.');
      },
    });
  } catch (err) {
    console.error('Checkout error:', err);
  }
}
```

---

### Why this is the Best Solution:
1. **User Never Leaves Your Website:** The payment modal appears right over your application screen.
2. **Provider Agnostic:** If the admin switches from Razorpay to Cashfree or PayU in the Gateway Dashboard, the popup automatically displays the new provider. **Your application changes 0 lines of code!**
3. **Automatic Verification:** The Gateway verifies the cryptographic signature before triggering the `onSuccess` callback.

---

## 3. Alternative: Full Page Redirect (If you prefer not using popup)

If an application prefers a traditional redirect (like Stripe Checkout):
```javascript
// Simply redirect the browser window:
window.location.href = data.checkoutUrl;
```
The Gateway will collect payment and redirect the student back to `returnUrl` (e.g. `https://your-app.com/payment-success?paymentId=...&status=SUCCEEDED`).

---

## 4. Backend Webhook Receiver (Optional but Recommended)

When you register your application in the Gateway Dashboard, you can specify your **Notification Webhook URL** (e.g. `https://your-backend/api/payments/webhook`).

Add this listener on your backend:

```javascript
router.post('/api/payments/webhook', (req, res) => {
  const event = req.body;
  const signature = req.headers['x-ppg-signature'];

  console.log(`[PPG Webhook] Event: ${event.event}`, event.data);

  if (event.event === 'payment.succeeded') {
    const { paymentId, businessReference, amount } = event.data;
    console.log(`Payment ${paymentId} for invoice ${businessReference} was successful!`);
    
    // Update your database (mark invoice paid, unlock student account, send email)
  }

  res.status(200).json({ received: true });
});
```
