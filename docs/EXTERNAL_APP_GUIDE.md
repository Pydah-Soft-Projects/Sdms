# Pydah Payment Gateway (PPG) — External Application Integration Guide

This is the definitive guide for any PydahSoft external application (Student Portal, Admission Portal, ERP, Mobile Apps, LMS) integrating with the **Pydah Payment Gateway (PPG)**.

---

## 1. Environment Configuration (`.env`)

In your application backend's `.env` file, configure your Gateway API URL and S2S credentials (obtained from the PPG Admin Console under **Applications**):

```dotenv
# PPG Gateway Base API URL
PPG_BASE_URL=http://localhost:5000/api/v1

# S2S API Credentials
PPG_APP_KEY=app_key_xxxxxxxxxxxxxxxx
PPG_APP_SECRET=app_sec_xxxxxxxxxxxxxxxx
```

> [!SECURITY]
> `PPG_APP_SECRET` must **only** reside on your backend server. Never expose it in client-side code, browser bundles, or mobile app binaries.

---

## 2. Architecture & Payment Flow

```
[Student on Your App] ---> Clicks "Pay Fees"
          │
          ▼
[Your Backend] calls PPG `POST /api/v1/payments` with:
   - `amount`: minor units (paise)
   - `college`: "PYDAH_ENG" (College Code)
   - `course`: "BTECH_CSE" (Course Code)
          │
          ▼
[PPG Server]
   1. Dynamic Routing Engine resolves mapped payment account (Razorpay / Cashfree)
   2. Creates provider order & returns `{ paymentId, checkoutUrl }`
          │
          ▼
[Your Frontend] calls `window.PPG.openCheckout({ checkoutUrl, onSuccess })`
          │
          ▼
[In-Page Checkout Modal Opens] ---> Student completes payment via UPI / Cards / Netbanking
          │
          ▼
[Signature Verified by PPG] ---> Modal closes automatically ---> `onSuccess` callback runs!
```

---

## 3. Step A: Backend Order Creation (Server-to-Server)

Add this endpoint to your application's backend:

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
    const {
      amountInRupees,
      collegeCode,
      courseCode,
      customerName,
      customerEmail,
      customerPhone,
      studentId,
    } = req.body;

    // Convert Rupees to integer paise: ₹25,000.00 = 2500000 paise
    const amountInPaise = Math.round(amountInRupees * 100);
    const businessReference = `INV-${Date.now()}`;

    // Call PPG Central Gateway
    const ppgResponse = await axios.post(
      `${PPG_BASE_URL}/payments`,
      {
        businessReference,
        amount: amountInPaise,
        currency: 'INR',
        description: 'Semester Tuition Fee',
        // College & Course for dynamic multi-tenant routing
        college: collegeCode, // e.g. "PYDAH_ENG" or college ID
        course: courseCode,   // e.g. "BTECH_CSE" or course ID
        customer: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
        },
        notes: {
          studentId: studentId || '',
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
    const errorDetails = error.response?.data?.error?.message || error.message;
    console.error('PPG Order Creation Error:', errorDetails);
    res.status(error.response?.status || 500).json({ success: false, error: errorDetails });
  }
});

module.exports = router;
```

---

## 4. How PPG Dynamic Routing Works

PPG evaluates incoming payments using the following hierarchy:

| When You Pass | Routing Behavior |
| :--- | :--- |
| **`college` + `course`** | **Strict Course Route**: PPG looks specifically for that course's assigned payment account. If **no account is configured for that course, it stops immediately and returns an error**. It will **NOT** fall back to the college-wide account, guaranteeing funds are never miscredited. |
| **`college` only (no `course`)** | **College-Wide Route**: Resolves to the college's general default payment account (e.g. for general application fees). |
| **Neither passed** | **Application Default**: Resolves to the application's default payment account. |

### Supported formats for `college` and `course`:
- **Code (Recommended)**: `"college": "PYDAH_ENG"`, `"course": "BTECH_CSE"`
- **Numeric ID**: `"college": 1`, `"course": 5`
- **Explicit fields**: `"collegeCode": "PYDAH_ENG"`, `"courseCode": "BTECH_CSE"`

---

## 5. Step B: Frontend In-Page Popup via `ppg.js`

### 1. Include `ppg.js` in your HTML:
```html
<script src="http://localhost:5000/sdk/ppg.js"></script>
```
*(In production, replace `http://localhost:5000` with your gateway domain).*

### 2. Trigger Checkout when Student clicks Pay:
```javascript
async function payStudentFees() {
  try {
    // 1. Request checkoutUrl from your application backend
    const res = await fetch('/api/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountInRupees: 25000,
        collegeCode: 'PYDAH_ENG',
        courseCode: 'BTECH_CSE',
        customerName: 'Bannu Kumar',
        customerEmail: 'student@pydah.edu.in',
        customerPhone: '+919876543210',
        studentId: 'PY26-ENG-402',
      }),
    });

    const data = await res.json();
    if (!data.success) {
      alert('Unable to initiate payment: ' + data.error);
      return;
    }

    // 2. Open the seamless In-Page Modal
    window.PPG.openCheckout({
      checkoutUrl: data.checkoutUrl,
      onSuccess: function (result) {
        console.log('Payment Succeeded:', result);
        alert('Payment Successful! Reference: ' + result.paymentId);
        // Refresh invoice status or redirect to receipt
        window.location.reload();
      },
      onFailure: function (error) {
        alert('Payment failed: ' + (error.message || 'Transaction declined'));
      },
      onClose: function () {
        console.log('Checkout modal closed by user');
      },
    });
  } catch (err) {
    console.error('Checkout error:', err);
  }
}
```

---

## 6. Backend Webhook Notifications (S2S Callback)

When a payment succeeds, PPG notifies your application backend via webhook:

```javascript
// In your backend: routes/webhook.routes.js
router.post('/api/payments/webhook', (req, res) => {
  const event = req.body;
  const signature = req.headers['x-ppg-signature'];

  if (event.event === 'payment.succeeded') {
    const { paymentId, businessReference, amount, college, course } = event.data;
    console.log(`Payment ${paymentId} succeeded for ${college?.code} - ${course?.code}`);

    // Update your database (e.g. mark fee as PAID, issue receipt)
  }

  res.status(200).json({ received: true });
});
```

---

## 7. Key Benefits
1. **Zero Provider SDKs in Client Apps**: No need to install or update Razorpay or Cashfree SDKs in your applications.
2. **Dynamic Account Routing**: Admins can map and remap bank/merchant accounts in the PPG dashboard at any time without changing a single line of client application code.
3. **Strict Accounting Isolation**: Course payments are strictly isolated to dedicated course accounts.
