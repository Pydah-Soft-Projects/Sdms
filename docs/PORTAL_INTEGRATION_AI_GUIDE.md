# Pydah AI - Portal Developer Integration Guide (Self-Describing Tool Architecture)

Welcome! This guide explains how application backend developers (Student Portal, Campus Portal, Faculty Portal, Admin System) can integrate with **Pydah AI (`pydah-ai`)**.

With our **Self-Describing Manifest Architecture**, you **never** need to touch or modify `pydah-ai` code to add new AI capabilities. **Your portal backend is the single source of truth** for all functions, database queries, and role permissions.

---

## 1. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│ Host Application Frontend (Student / Campus Portal)    │
│  - Embeds Chat UI Widget                               │
│  - Automatically attaches logged-in user's JWT Token   │
└───────────────────────────┬────────────────────────────┘
                            │ User Prompt + Bearer Token
                            ▼
┌────────────────────────────────────────────────────────┐
│ Pydah AI Engine (Central Orchestrator)                 │
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

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| **`/ai-tools`** | `GET` | Returns list of available tools & descriptions that the AI can call. |
| **`/execute-tool`** | `POST` | Receives tool name + parameters, checks user permissions, executes query, and returns JSON. |

> Supported path variants: `pydah-ai` automatically recognizes `/ai-tools`, `/api/v1/ai-tools`, `/ai/tools`, `/execute-tool`, `/api/v1/execute-tool`, and `/api/execute-tool`.

---

## 3. Specification: `GET /ai-tools` (Discovery Manifest)

When a user asks a question, `pydah-ai` calls your `GET /ai-tools` endpoint to know what capabilities your portal supports.

### Request Sent by `pydah-ai`:
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

### Request Body Received from `pydah-ai`:
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
    """Expose available portal tools to Pydah AI."""
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

## 6. How to Connect in Your `.env`

In `pydah-ai/.env`:
Set your portal's URL:

```env
# Point to your running portal backend
STUDENT_SERVICE_URL=http://localhost:3001
# (Or APPLICATION_SERVICE_URL=http://localhost:3001)
```

`pydah-ai` will:
1. Check `http://localhost:3001/ai-tools` automatically.
2. Present those tools to the Gemini / OpenRouter model.
3. Call `http://localhost:3001/execute-tool` with the user's token whenever a query requires it.

---

## 7. Frontend Integration (Embedding the Chat Widget)

To add the AI widget into your portal web pages:

### Option 1: Script Tag Embed (HTML / PHP / Vanilla JS)
```html
<!-- Include Widget UMD Script & CSS -->
<link rel="stylesheet" href="https://your-cdn.com/pydah-ai-chat-ui/dist/style.css" />
<script src="https://your-cdn.com/pydah-ai-chat-ui/dist/index.umd.js"></script>

<script>
  // Configure the widget with the current logged-in student/user session
  window.PYDAH_AI_API_URL = "http://localhost:8000";
  window.PYDAH_AI_AUTH_TOKEN = localStorage.getItem("jwt_token"); // Logged-in user's token
  window.PYDAH_AI_ASSISTANT_ID = "student-assistant"; // or "portal-assistant"
  window.PYDAH_AI_TITLE = "Pydah Student Assistant";
  window.PYDAH_AI_MODE = "widget"; // Floating widget in bottom right
</script>
```

### Option 2: React Component Embed
```jsx
import { PydahAIChatWidget } from 'pydah-ai-chat-ui';
import 'pydah-ai-chat-ui/style.css';

function PortalLayout() {
  const userToken = useAuthToken(); // From your Auth context

  return (
    <div>
      {/* Your Portal UI */}
      <PydahAIChatWidget
        apiBaseUrl="http://localhost:8000"
        assistantId="student-assistant"
        authToken={userToken}
        title="Pydah Portal Assistant"
      />
    </div>
  );
}
```

---

## 8. Summary Checklist for Portal Developers

- [x] Expose `GET /ai-tools` returning your available tools & parameter schemas.
- [x] Expose `POST /execute-tool` to execute tools using existing services.
- [x] Verify incoming Bearer token to protect records by `user_id` and `role`.
- [x] Add your backend URL to `pydah-ai/.env` under `STUDENT_SERVICE_URL`.
- [x] You are done! To add a new query in the future, just add it to your `/ai-tools` array—`pydah-ai` will discover and use it automatically!

