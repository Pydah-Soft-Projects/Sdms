# Next Receipt Number Generation API Documentation

This API enables external applications (e.g., Admissions, Hostel, Transport, Academic Portals) to fetch or allocate the next receipt number from the Fees system.

---

## 1. Endpoints

| Environment / Mode               | Method             | Endpoint                                  | Authentication         |
| :------------------------------- | :----------------- | :---------------------------------------- | :--------------------- |
| **Inter-Service / Public** | `POST` / `GET` | `/api/public/transactions/next-receipt` | None required          |
| **Standard / Internal**    | `POST` / `GET` | `/api/transactions/next-receipt`        | `Bearer <JWT_TOKEN>` |

> **Tip:** Sister microservices running inside the local infrastructure (Admission, Hostel, etc.) should use `/api/public/transactions/next-receipt`.

---

## 2. Request Parameters

You can send parameters as a **JSON Body** (recommended with `POST`) or as **Query Parameters** (with `GET`).

| Parameter                           | Type                  | Required | Default   | Description                                                                                                                                                                        |
| :---------------------------------- | :-------------------- | :------- | :-------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `studentId` / `admissionNumber` | `string`            | Optional | `null`  | Student admission number (e.g., `23PEC001`). When provided, the API automatically resolves the student's `collegeCode` and `courseCode` from the database.                   |
| `feeHeadId`                       | `string`            | Optional | `null`  | MongoDB Fee Head ID. When provided, the API automatically resolves the `groupCode` from the Fee Group.                                                                           |
| `collegeCode`                     | `string`            | Optional | `'GEN'` | Direct college code override (e.g., `PEC`, `AET`).                                                                                                                             |
| `courseCode`                      | `string`            | Optional | `'GEN'` | Direct course code override (e.g., `BTECH`, `DEG`, `MBA`).                                                                                                                   |
| `groupCode`                       | `string`            | Optional | `'GEN'` | Direct fee group code override (e.g., `TUITION`, `HOSTEL`, `BUS`, `GEN`).                                                                                                  |
| `date`                            | `string` / `Date` | Optional | Today     | Reference date for financial year calculation (Format: `YYYY-MM-DD`).                                                                                                            |
| `allocate`                        | `boolean`           | Optional | `true`  | **`true` (Default)**: Atomically reserves and increments the sequence counter in the database.**`false`**: Preview only without incrementing the sequence counter. |
| `preview`                         | `boolean`           | Optional | `false` | Alias for `allocate: false`.                                                                                                                                                     |
| `feeHeadIds`                      | `string[]`          | Optional | `null`  | Array of Fee Head IDs if processing multi-head payments across groups.                                                                                                             |

---

## 3. Sequence Logic & Structure

* **Custom Sequence Enabled:**
  Format: `{collegeCode}{separator}{courseCode}{separator}{groupCode}{separator}{paddedNumber}`
  * Example: `PEC/BTECH/TUITION/00001`
  * Financial Year cycle (e.g. `2026-27`) resets every April 1st (or custom configured month/day).
  * Concurrency-safe: uses atomic database increments (`$inc: { nextNumber: 1 }`).
* **Custom Sequence Disabled:**
  Format: `REC{timestamp}{random}`
  * Example: `REC492810729`

---

## 4. API Request & Response Examples

### A. Allocate Next Receipt by Student Admission Number

#### Request:

```http
POST /api/public/transactions/next-receipt
Content-Type: application/json

{
  "studentId": "23PEC001",
  "feeHeadId": "65b8e9f2910b230012345678",
  "allocate": true
}
```

#### Response (`200 OK`):

```json
{
  "success": true,
  "receiptNumber": "PEC/BTECH/TUITION/00001",
  "sequenceNumber": 1,
  "isCustomSequence": true,
  "allocated": true,
  "details": {
    "collegeCode": "PEC",
    "courseCode": "BTECH",
    "groupCode": "TUITION",
    "financialYear": "2026-27",
    "padding": 5,
    "separator": "/"
  }
}
```

---

### B. Allocate Using Direct Codes (Without Student Lookup)

#### Request:

```http
POST /api/public/transactions/next-receipt
Content-Type: application/json

{
  "collegeCode": "PEC",
  "courseCode": "BTECH",
  "groupCode": "HOSTEL",
  "allocate": true
}
```

#### Response (`200 OK`):

```json
{
  "success": true,
  "receiptNumber": "PEC/BTECH/HOSTEL/00015",
  "sequenceNumber": 15,
  "isCustomSequence": true,
  "allocated": true,
  "details": {
    "collegeCode": "PEC",
    "courseCode": "BTECH",
    "groupCode": "HOSTEL",
    "financialYear": "2026-27",
    "padding": 5,
    "separator": "/"
  }
}
```

---

### C. Preview Only (Without Incrementing Counter)

#### Request:

```http
GET /api/public/transactions/next-receipt?collegeCode=PEC&courseCode=BTECH&groupCode=HOSTEL&allocate=false
```

#### Response (`200 OK`):

```json
{
  "success": true,
  "receiptNumber": "PEC/BTECH/HOSTEL/00016",
  "sequenceNumber": 16,
  "isCustomSequence": true,
  "allocated": false,
  "details": {
    "collegeCode": "PEC",
    "courseCode": "BTECH",
    "groupCode": "HOSTEL",
    "financialYear": "2026-27",
    "padding": 5,
    "separator": "/"
  }
}
```

---

## 5. Using the Pre-Generated Receipt in Fees Transactions

When the calling application records the transaction into the Fees system (`POST /api/transactions`), it can pass the `receiptNumber` in the transaction payload.

The backend **will reuse the provided receipt number** and will not generate or increment another one.

### Single Transaction Example:

```json
{
  "studentId": "23PEC001",
  "studentName": "John Doe",
  "feeHeadId": "65b8e9f2910b230012345678",
  "amount": 25000,
  "paymentMode": "Cash",
  "receiptNumber": "PEC/BTECH/TUITION/00001"
}
```

### Batch Transactions Example:

```json
{
  "receiptNumber": "PEC/BTECH/TUITION/00001",
  "transactions": [
    {
      "studentId": "23PEC001",
      "feeHeadId": "65b8e9f2910b230012345678",
      "amount": 20000,
      "receiptNumber": "PEC/BTECH/TUITION/00001"
    },
    {
      "studentId": "23PEC001",
      "feeHeadId": "65b8e9f2910b230087654321",
      "amount": 5000,
      "receiptNumber": "PEC/BTECH/TUITION/00001"
    }
  ]
}
```

---

## 6. Configuration in Other Applications (.env)

The external application should configure the Fees backend base URL in its `.env` file:

```env
# In the other application's .env file:
# Local development (Fees backend runs on port 5001 by default):
FEES_BACKEND_URL=http://localhost:5001

# Production / Staging:
# FEES_BACKEND_URL=http://<FEES_SERVER_IP>:5001
# FEES_BACKEND_URL=https://fees.pydahsoft.com
```

---

## 7. Code Snippets for External Applications

### Node.js / Express (using process.env):

```javascript
const allocateReceiptNumber = async (studentId, feeHeadId) => {
  const feesBaseUrl = process.env.FEES_BACKEND_URL || 'http://localhost:5001';

  const response = await fetch(`${feesBaseUrl}/api/public/transactions/next-receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId,
      feeHeadId,
      allocate: true
    })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Failed to allocate receipt number');
  }

  return data.receiptNumber; // e.g. "PEC/BTECH/TUITION/00001"
};
```

### Python:

```python
import os
import requests

FEES_BACKEND_URL = os.getenv("FEES_BACKEND_URL", "http://localhost:5001")

def get_next_receipt(student_id, fee_head_id=None):
    url = f"{FEES_BACKEND_URL}/api/public/transactions/next-receipt"
    payload = {
        "studentId": student_id,
        "feeHeadId": fee_head_id,
        "allocate": True
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    data = response.json()
    return data["receiptNumber"]
```

### cURL:

```bash
curl -X POST "http://localhost:5001/api/public/transactions/next-receipt" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "23PEC001",
    "allocate": true
  }'
```
