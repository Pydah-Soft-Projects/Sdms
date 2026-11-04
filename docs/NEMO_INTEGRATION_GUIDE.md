# Nemo AI - Portal Developer Integration Guide (Self-Describing Tool Architecture)

Welcome! This guide explains how application backend developers (Student Portal, Campus Portal, Faculty Portal, Admin System) can integrate with **Nemo AI (`nemo-ai`)**.

With our **Self-Describing Manifest Architecture**, you **never** need to touch or modify `nemo-ai` code to add new AI capabilities. **Your portal backend is the single source of truth** for all functions, database queries, and role permissions.

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│ Host Application Frontend (Student / Campus Portal)    │
│  - Embeds Chat UI Widget                               │Automatically attaches logged-in user's JWT Token   │
└───────────────────────────┬────────────────────────────┘
                            │ User Prompt + Bearer Token
                            ▼
┌────────────────────────────────────────────────────────┐
│ Nemo AI Engine (Central Orchestrator)                  │
│  1. Discovers tools: GET {PORTAL_URL}/ai-tools          │
│  2. Asks LLM (Gemini) which tool to use                │
│  3. Dispatches execution: POST {PORTAL_URL}/execute-tool│
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │ 1. GET /ai-tools          │ 2. POST /execute-tool
              ▼                           ▼
┌────────────────────────────────────────────────────────┐
│ Your Portal Backend (Node.js / Python / PHP / Java)    │
│  - Checks JWT token & User Role (Student / Faculty)   │
│  - Calls existing database queries / services          │
│  - Returns clean JSON data                             │
└────────────────────────────────────────────────────────┘
```

---

## 2. The 2 Requirements for Your Application Backend

To enable AI features in your portal, your backend needs to expose **only two HTTP endpoints**:

| Endpoint                    | Method   | Purpose                                                                                     |
| :-------------------------- | :------- | :------------------------------------------------------------------------------------------ |
| **`/ai-tools`**     | `GET`  | Returns list of available tools & descriptions that the AI can call.                        |
| **`/execute-tool`** | `POST` | Receives tool name + parameters, checks user permissions, executes query, and returns JSON. |

> Supported path variants: `nemo-ai` automatically recognizes `/ai-tools`, `/api/v1/ai-tools`, `/ai/tools`, `/execute-tool`, `/api/v1/execute-tool`, and `/api/execute-tool`.

---

## 3. Specification: `GET /ai-tools` (Discovery Manifest)

When a user asks a question, `nemo-ai` calls your `GET /ai-tools` endpoint to know what capabilities your portal supports.

### Request Sent by `nemo-ai`:

- **Method:** `GET`
- **Headers:**
  - `Authorization: Bearer <user_jwt_token>` (if user is logged in)
  - `x-user-role: student` (or `faculty`, `admin`, etc.)
  - `Accept: application/json`

### Response Format:

Return a JSON array of tool objects (or `{ "tools": [...] }`):

```json
{
  "tools": [
    {
      "name": "get_student_profile",
      "description": "Fetch personal student profile details including name, roll number, department, semester, and email.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    },
    {
      "name": "get_attendance_summary",
      "description": "Fetch attendance percentage, classes held/attended, subject breakdown, and exam eligibility status.",
      "parameters": {
        "type": "object",
        "properties": {
          "semester": {
            "type": "string",
            "description": "Optional semester filter, e.g., 'Semester 6'."
          }
        }
      }
    },
    {
      "name": "get_class_timetable",
      "description": "Fetch class schedule, lecture periods, subjects, assigned faculty, and room locations.",
      "parameters": {
        "type": "object",
        "properties": {
          "day": {
            "type": "string",
            "description": "Day of the week: Monday, Tuesday, etc."
          }
        }
      }
    },
    {
      "name": "get_faculty_assigned_classes",
      "description": "Fetch classes and lecture schedule assigned to the logged-in faculty member.",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

> **Role-Based Dynamic Manifest (Optional but Recommended):**
> If the incoming `Authorization` token belongs to a **student**, you can return student tools.
> If the token belongs to a **faculty** or **administrator**, you can return faculty/department tools!

---

## 4. Specification: `POST /execute-tool` (Execution Endpoint)

When the AI determines that it needs data to answer the user's question, it calls your `POST /execute-tool` endpoint.

### Request Body Received from `nemo-ai`:

```json
{
  "tool_name": "get_attendance_summary",
  "function_name": "get_attendance_summary",
  "arguments": {
    "semester": "Semester 6"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_context": {
    "delegated_access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user_id": "STU-2025-0842",
    "role": "student"
  }
}
```

### Request Headers Forwarded:

- `Authorization: Bearer <token>`
- `x-access-token: <token>`
- `x-user-role: student`
- `x-user-id: STU-2025-0842`

### Your Execution Responsibilities:

1. **Verify Token:** Authenticate the incoming Bearer token using your portal's existing JWT secret/middleware.
2. **Enforce Record Security:**
   - If `role === 'student'`: Extract `student_id` directly from the verified token. **Never** allow a student to query another student's marks or records!
   - If `role === 'faculty'` or `'admin'`: Extract faculty/admin ID and authorize access to department records.
3. **Call Existing Business Logic:** Call your existing DB controllers or services. Do **not** rewrite queries.
4. **Return Clean JSON:**
   - Return `{ ... data ... }` with HTTP 200.
   - If record not found, return `{ "error": "No records found" }` (do NOT return HTML error pages).

---

## 5. Complete Implementation Examples

### Option A: Node.js / Express Implementation

```javascript
// routes/aiIntegration.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Your existing auth library
const StudentService = require('../services/studentService'); // Your existing service
const FacultyService = require('../services/facultyService'); // Your existing service

// 1. Tool Manifest Discovery
router.get('/ai-tools', (req, res) => {
  // Check token (optional) to show different tools for students vs faculty
  const authHeader = req.headers.authorization;
  let role = 'student';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      role = decoded.role || 'student';
    } catch (e) {}
  }

  const studentTools = [
    {
      name: 'get_student_profile',
      description: 'Fetch student name, roll number, department, semester, and email.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'get_attendance_summary',
      description: 'Fetch attendance percentage and subject breakdown.',
      parameters: { type: 'object', properties: {} }
    },
    {
      name: 'get_class_timetable',
      description: 'Fetch daily class schedule and periods.',
      parameters: {
        type: 'object',
        properties: {
          day: { type: 'string', description: 'e.g. Monday, Tuesday, today' }
        }
      }
    }
  ];

  const facultyTools = [
    {
      name: 'get_faculty_assigned_classes',
      description: 'Fetch lecture schedule and assigned courses for faculty.',
      parameters: { type: 'object', properties: {} }
    }
  ];

  const tools = role === 'faculty' ? [...studentTools, ...facultyTools] : studentTools;
  res.json({ tools });
});

// 2. Tool Execution Runner
router.post('/execute-tool', async (req, res) => {
  try {
    const { tool_name, arguments: args } = req.body;
  
    // Extract token from header or body
    const token = (req.headers.authorization || '').replace('Bearer ', '') || req.body.token;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify JWT
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const userId = user.id || user.student_id || user.sub;
    const userRole = user.role || 'student';

    switch (tool_name) {
      case 'get_student_profile':
        const profile = await StudentService.getProfile(userId);
        return res.json(profile);

      case 'get_attendance_summary':
        const attendance = await StudentService.getAttendance(userId);
        return res.json(attendance);

      case 'get_class_timetable':
        const timetable = await StudentService.getTimetable(userId, args?.day);
        return res.json(timetable);

      case 'get_faculty_assigned_classes':
        if (userRole !== 'faculty' && userRole !== 'admin') {
          return res.status(403).json({ error: 'Permission denied: Faculty role required' });
        }
        const classes = await FacultyService.getClasses(userId);
        return res.json(classes);

      default:
        return res.status(404).json({ error: `Tool '${tool_name}' not implemented in portal` });
    }
  } catch (error) {
    console.error('AI Tool Execution Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to execute tool' });
  }
});

module.exports = router;
```

---

### Option B: Python / FastAPI Implementation

```python
# ai_routes.py
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from typing import Dict, Any, Optional
import jwt  # PyJWT

router = APIRouter(prefix="", tags=["AI Integration"])
JWT_SECRET = "your-app-jwt-secret"

@router.get("/ai-tools")
def get_ai_tools(authorization: Optional[str] = Header(None)):
    """Expose available portal tools to Nemo AI."""
    return {
        "tools": [
            {
                "name": "get_student_profile",
                "description": "Fetch student profile details for the authenticated user.",
                "parameters": {"type": "object", "properties": {}}
            },
            {
                "name": "get_attendance_summary",
                "description": "Fetch attendance percentage and subject breakdown.",
                "parameters": {"type": "object", "properties": {}}
            },
            {
                "name": "get_class_timetable",
                "description": "Fetch class periods, timetable, and subjects.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day": {"type": "string", "description": "e.g. Monday, Tuesday"}
                    }
                }
            }
        ]
    }

@router.post("/execute-tool")
async def execute_tool(request: Request):
    """Execute requested tool and return record data."""
    body = await request.json()
    tool_name = body.get("tool_name")
    args = body.get("arguments", {})
  
    # Extract Bearer token
    auth_header = request.headers.get("authorization") or ""
    token = auth_header.replace("Bearer ", "") if "Bearer " in auth_header else body.get("token")
  
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing token")
      
    try:
        user_claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        student_id = user_claims.get("student_id") or user_claims.get("sub")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

    # Route to existing database services
    if tool_name == "get_student_profile":
        # Call existing service: StudentService.get_profile(student_id)
        return {
            "student_id": student_id,
            "full_name": "Sai Ram Krishna",
            "roll_number": "22PY1A0584",
            "branch": "Computer Science & Engineering",
            "semester": "Semester 6",
            "email": "sairam.k@pydah.edu.in"
        }
    elif tool_name == "get_attendance_summary":
        return {
            "student_id": student_id,
            "overall_percentage": 87.5,
            "total_classes_held": 240,
            "total_classes_attended": 210,
            "status": "ELIGIBLE_FOR_EXAMS"
        }
    elif tool_name == "get_class_timetable":
        return {
            "day": args.get("day", "Today"),
            "schedule": [
                {"period": 1, "time": "09:30 - 10:25", "subject": "AI & ML", "room": "CS-302"},
                {"period": 2, "time": "10:25 - 11:20", "subject": "DBMS", "room": "CS-302"}
            ]
        }
    else:
        raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")
```

---

## 6. Dynamic Backend URL Resolution (Zero-Config on Nemo AI)

**Nemo AI is 100% dynamic.** You do **not** need to modify `.env` on the Nemo AI server every time a new portal integrates. 

Instead, each host application simply specifies its own backend URL directly in the Chat UI widget or API call:

### Dynamic Integration (Recommended for all Portals):
- **React / Next.js Widget:** Pass `serviceUrl="https://student-api.mycollege.edu"` prop to `<NemoAIChatWidget />`.
- **CDN Script Embed:** Set `window.NEMO_AI_SERVICE_URL = "https://student-api.mycollege.edu"`.
- **Direct API Call:** Pass `"service_url": "https://student-api.mycollege.edu"` or `X-Service-URL` header in `/api/v1/chat`.

Nemo AI will dynamically query `{service_url}/ai-tools` and dispatch tool execution to `{service_url}/execute-tool`.

---

### Local Testing Mode (Fallback `.env` in `nemo-ai/.env`):
For standalone local development when no `serviceUrl` is passed:

```env
# Optional fallback for local testing
STUDENT_SERVICE_URL=http://localhost:5002
PORT=8000
GEMINI_MODEL=gemini-2.5-flash
```

---

## 7. Frontend CDN Integration: Testing vs. Production

### 🧪 Mode A: Local Testing Mode (Localhost)

If you are developing or testing on your local machine:

```html
<!-- Local Testing Script Tag Embed -->
<link rel="stylesheet" href="http://localhost:5173/src/index.css" />
<!-- Or use local dist: <link rel="stylesheet" href="http://localhost:8000/cdn/style.css" /> -->
<script src="http://localhost:8000/cdn/index.umd.js"></script>

<script>
  // 1. Point to your local Nemo AI backend
  window.NEMO_AI_API_URL = "http://localhost:8000";

  // 2. Attach host portal's backend URL for dynamic tool execution
  window.NEMO_AI_SERVICE_URL = "http://localhost:5002";

  // 3. Pass test auth token (or real student token)
  window.NEMO_AI_AUTH_TOKEN = localStorage.getItem("jwt_token") || "test-student-token";

  // 4. Configure Assistant
  window.NEMO_AI_ASSISTANT_ID = "portal-assistant";
  window.NEMO_AI_TITLE = "Nemo (Dev)";
  window.NEMO_AI_MODE = "widget"; // Floating widget in bottom right
</script>
```

---

### 🚀 Mode B: Production Mode (Live AWS Lightsail CDN)

In your production web application (Student Portal, Campus Portal, Faculty Dashboard):

```html
<!-- Production CDN Script & Stylesheet (Hosted on nemo-chat.pydah.edu.in) -->
<link rel="stylesheet" href="https://nemo-chat.pydah.edu.in/style.css" />
<script src="https://nemo-chat.pydah.edu.in/index.umd.js"></script>

<script>
  // 1. Point to your live production Nemo AI API
  window.NEMO_AI_API_URL = "https://nemo-ai.pydah.edu.in";

  // 2. Attach host portal's backend URL for dynamic tool execution
  window.NEMO_AI_SERVICE_URL = "https://student-api.pydah.edu.in";

  // 3. Attach authenticated user's JWT token
  window.NEMO_AI_AUTH_TOKEN = localStorage.getItem("jwt_token");

  // 4. Configure Assistant Persona & UI
  window.NEMO_AI_ASSISTANT_ID = "portal-assistant";
  window.NEMO_AI_TITLE = "Nemo";
  window.NEMO_AI_MODE = "widget"; // Options: "widget" (floating button) or "embedded" (full-page)
</script>
```

---

### ⚛️ Mode C: React Component Integration

If your portal is built with React:

```jsx
import { NemoAIChatWidget } from 'pydah-ai-chat-ui';
import 'pydah-ai-chat-ui/style.css';

function PortalLayout() {
  const userToken = useAuthToken(); // From your auth state / context

  // Toggle API URL based on environment
  const apiUrl = process.env.NODE_ENV === 'production'
    ? 'https://nemo-ai.pydah.edu.in'
    : 'http://localhost:8000';

  return (
    <div>
      {/* Your Portal UI */}
    
      <NemoAIChatWidget
        apiBaseUrl={apiUrl}
        serviceUrl={process.env.REACT_APP_PORTAL_BACKEND_URL || "https://student-api.pydah.edu.in"}
        assistantId="portal-assistant"
        authToken={userToken}
        title="Nemo"
      />
    </div>
  );
}
```

---

### ⚡ Mode D: Next.js Integration (App Router & Pages Router)

In Next.js (App Router or Pages Router), always disable SSR for the client chat widget using `next/dynamic` or `'use client'` to prevent server-side `window is not defined` errors:

```jsx
'use client'; // Required in Next.js 13+ App Router (app/ directory)

import React from 'react';
import dynamic from 'next/dynamic';
import 'pydah-ai-chat-ui/style.css';

// Load dynamically without server-side rendering
const NemoAIChatWidget = dynamic(
  () => import('pydah-ai-chat-ui').then((mod) => mod.NemoAIChatWidget),
  { ssr: false }
);

export default function PortalLayout({ children }) {
  const userToken = typeof window !== 'undefined' ? localStorage.getItem("jwt_token") : null;

  return (
    <>
      {children}
      <NemoAIChatWidget
        apiBaseUrl={process.env.NEXT_PUBLIC_NEMO_AI_API_URL || "https://nemo-ai.pydah.edu.in"}
        serviceUrl={process.env.NEXT_PUBLIC_PORTAL_BACKEND_URL || "https://student-api.pydah.edu.in"}
        assistantId="portal-assistant"
        authToken={userToken}
        title="Nemo"
        welcomeMessage="How can I help you today?"
        position="bottom-right"
      />
    </>
  );
}
```

---

### 🌐 Mode E: Direct REST API Integration (Backend-to-Backend / Mobile / Custom UI)

If your application calls the Nemo AI engine directly via HTTP instead of using the Chat UI widget, pass `service_url` in the request body or via the `X-Service-URL` header:

#### HTTP Request:
```http
POST /api/v1/chat HTTP/1.1
Host: nemo-ai.pydah.edu.in
Content-Type: application/json
Authorization: Bearer <user_jwt_token>
X-Service-URL: https://student-api.pydah.edu.in

{
  "message": "What is my attendance summary and do I have pending fees?",
  "assistant_id": "portal-assistant",
  "service_url": "https://student-api.pydah.edu.in",
  "conversation_id": "optional-session-id"
}
```

#### cURL Example:
```bash
curl -X POST "https://nemo-ai.pydah.edu.in/api/v1/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_STUDENT_JWT_TOKEN" \
  -H "X-Service-URL: https://student-api.pydah.edu.in" \
  -d '{
    "message": "What is my attendance summary?",
    "assistant_id": "portal-assistant",
    "service_url": "https://student-api.pydah.edu.in"
  }'
```

#### JSON Response:
```json
{
  "success": true,
  "answer": "Your overall attendance is currently at 87.5% (210 out of 240 classes attended). You are fully eligible for the upcoming semester examinations.",
  "model": "gemini-2.5-flash",
  "assistant_id": "portal-assistant",
  "conversation_id": "conv-1024",
  "executed_tools": ["get_attendance_summary"]
}
```

---

## 8. Summary Checklist for Portal Developers

| Step                          | Testing Mode (Local)                       | Production Mode (AWS Lightsail)                 |
| :---------------------------- | :----------------------------------------- | :---------------------------------------------- |
| **Nemo AI Core API**          | `http://localhost:8000`                    | `https://nemo-ai.pydah.edu.in`                  |
| **Host Portal Backend**       | `http://localhost:5002`                    | `https://student.pydah.edu.in`                  |
| **Dynamic Resolution Prop**   | `serviceUrl="http://localhost:5002"`       | `serviceUrl="https://student-api.pydah.edu.in"` |
| **CDN Script URL**            | `http://localhost:8000/cdn/index.umd.js`   | `https://nemo-chat.pydah.edu.in/index.umd.js`   |
| **CDN Stylesheet**            | `http://localhost:8000/cdn/style.css`      | `https://nemo-chat.pydah.edu.in/style.css`      |
| **User Authentication**       | Test JWT or student token                  | Real logged-in student/staff JWT token          |

- [X] Expose `GET /ai-tools` returning available tools & parameter schemas.
- [X] Expose `POST /execute-tool` to execute tools using existing services.
- [X] Pass `serviceUrl` prop or `window.NEMO_AI_SERVICE_URL` pointing to your portal backend.
- [X] Verify incoming Bearer token to protect records by `user_id` and `role`.
- [X] Done! Any new query or feature added to `/ai-tools` will be instantly available in the AI assistant!
