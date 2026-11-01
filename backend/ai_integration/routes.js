/**
 * AI Integration Routes
 * Self-Describing Tool Architecture for Pydah AI Orchestration Engine.
 * Implements:
 * 1. GET /ai-tools (Discovery Manifest)
 * 2. POST /execute-tool (Tool Execution Runner)
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const tools = require('./tools');

/**
 * Flexible Authentication Extraction Middleware for AI Tool Requests
 */
const aiAuthMiddleware = (req, res, next) => {
  try {
    let token = null;

    // 1. Extract Bearer token from headers
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      token = parts.length === 2 ? parts[1] : parts[0];
    }

    // 2. Extract from custom headers or body (supports user_context.delegated_access_token)
    if (!token) {
      token =
        req.headers['x-access-token'] ||
        req.headers['x-user-token'] ||
        req.body?.token ||
        req.body?.bearer_token ||
        req.body?.access_token ||
        req.body?.user_context?.delegated_access_token ||
        req.body?.user_context?.token ||
        req.body?.user_context?.access_token ||
        req.body?.user_context?.bearer_token;
    }

    if (token) {
      // Try verifying with app JWT_SECRET
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        req.user = decoded;
        if (req.headers['x-user-role']) {
          req.user.role = req.headers['x-user-role'];
        }
        return next();
      } catch (jwtErr) {
        // Fallback: Decode token payload if signed externally
        const unverified = jwt.decode(token);
        if (unverified && typeof unverified === 'object') {
          req.user = unverified;
          if (req.headers['x-user-role']) {
            req.user.role = req.headers['x-user-role'];
          }
          return next();
        }
      }
    }

    // 3. Fallback: Extract identity from body user_context directly
    if (req.body && (req.body.user_context || req.body.user)) {
      const ctx = req.body.user_context || req.body.user;
      req.user = {
        id: ctx.user_id || ctx.id || ctx.student_id,
        userId: ctx.user_id || ctx.id || ctx.student_id,
        role: ctx.role || req.headers['x-user-role'] || 'student',
        pinNo: ctx.pin_no || ctx.pinNo,
        admissionNumber: ctx.admission_number || ctx.admissionNumber,
        username: ctx.username || ctx.name || ctx.full_name,
        email: ctx.email,
        ...ctx
      };
      return next();
    }

    // 4. Fallback from forwarded headers (e.g. x-user-role, x-user-id)
    if (req.headers['x-user-role'] || req.headers['x-user-id']) {
      req.user = {
        id: req.headers['x-user-id'] || 1,
        userId: req.headers['x-user-id'] || 1,
        role: req.headers['x-user-role'] || 'student',
        username: req.headers['x-user-role'] || 'user'
      };
      return next();
    }

    // 5. Default permissive fallback for local AI engine execution
    req.user = { id: 1, role: 'student', username: 'student' };
    return next();
  } catch (err) {
    console.error('[AI Auth Middleware Error]:', err);
    return res.status(200).json({
      success: false,
      error: 'Unauthorized access to AI tool endpoint.'
    });
  }
};

/**
 * 1. Tool Manifest Discovery Handler (GET /ai-tools)
 * Exposes self-describing capabilities to Pydah AI engine.
 */
const handleGetAiTools = (req, res) => {
  try {
    let role = (req.user?.role || req.headers['x-user-role'] || 'student').toLowerCase().trim();

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'your_jwt_secret');
        if (decoded?.role) role = String(decoded.role).toLowerCase().trim();
      } catch (e) {
        const unverified = jwt.decode(authHeader.split(' ')[1]);
        if (unverified?.role) role = String(unverified.role).toLowerCase().trim();
      }
    }

    const isAdminOrSuperAdmin = ['super_admin', 'superadmin', 'admin'].includes(role);
    const isFaculty = ['faculty', 'branch_faculty'].includes(role);

    const portalTools = [
      {
        name: 'get_student_profile',
        description: 'Fetch student or user profile details (name, PIN/roll number, branch, semester, contact info) by student name, PIN, or admission number. If no student is specified, returns authenticated user details.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, admission number, or roll number (e.g. "saketh" or "236T1A0521"). Optional if querying current user profile.'
            }
          }
        }
      },
      {
        name: 'get_attendance_summary',
        description: 'Fetch attendance percentage, classes held/attended, subject breakdown, and exam eligibility status for a student.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, or admission number.'
            },
            semester: {
              type: 'string',
              description: 'Optional semester filter, e.g. "Semester 6".'
            }
          }
        }
      },
      {
        name: 'get_class_timetable',
        description: 'Fetch class schedule, lecture periods, subjects, assigned faculty, and room locations.',
        parameters: {
          type: 'object',
          properties: {
            day: {
              type: 'string',
              description: 'Day of the week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, or today.'
            },
            student_id: {
              type: 'string',
              description: 'Optional student name, PIN, or admission number to view timetable.'
            }
          }
        }
      },
      {
        name: 'get_student_marks',
        description: 'Fetch student internal assessment marks, exam scores, and performance summary.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, or admission number.'
            }
          }
        }
      },
      {
        name: 'get_student_fees',
        description: 'Fetch fee payment details, total fees, amount paid, pending balance/dues, and transaction history for a student.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, or admission number.'
            }
          }
        }
      },
      {
        name: 'get_student_tickets',
        description: 'Fetch grievance tickets, maintenance requests, or complaints records.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, or admission number.'
            },
            status: {
              type: 'string',
              description: 'Optional ticket status filter: "open", "in_progress", "resolved", "closed".'
            }
          }
        }
      },
      {
        name: 'get_student_transport',
        description: 'Fetch transport pass, bus route, stop name, driver contact, and fee status for a student.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Student name, PIN number, or admission number.'
            }
          }
        }
      },
      {
        name: 'get_academic_calendar',
        description: 'Fetch upcoming institutional academic events, exams, seminars, and calendar milestones.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_holidays',
        description: 'Check official college holidays, holiday schedule, or whether today or a specific date is a holiday.',
        parameters: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_announcements',
        description: 'Fetch recent institutional announcements, official circulars, and notices.',
        parameters: {
          type: 'object',
          properties: {
            limit: {
              type: 'integer',
              description: 'Number of recent announcements to return (default: 5).'
            }
          }
        }
      },
      {
        name: 'get_clubs',
        description: 'Fetch list of active student clubs, descriptions, membership fees, coordinators, or details for a specific club.',
        parameters: {
          type: 'object',
          properties: {
            club_name: {
              type: 'string',
              description: 'Optional name of the club to fetch details for (e.g. "Quantum Coders", "Melodia").'
            },
            club_id: {
              type: 'integer',
              description: 'Optional ID of the club.'
            }
          }
        }
      },
      {
        name: 'get_club_members',
        description: 'Fetch members enrolled in a specific club OR check which clubs a specific student has joined/applied for.',
        parameters: {
          type: 'object',
          properties: {
            student_id: {
              type: 'string',
              description: 'Optional student name, PIN, or admission number to check their joined clubs.'
            },
            club_name: {
              type: 'string',
              description: 'Optional club name to list its enrolled student members.'
            },
            club_id: {
              type: 'integer',
              description: 'Optional club ID to list its enrolled student members.'
            }
          }
        }
      },
      {
        name: 'get_club_activities',
        description: 'Fetch upcoming, ongoing, or conducted activities, workshops, hackathons, and events organized by clubs.',
        parameters: {
          type: 'object',
          properties: {
            club_name: {
              type: 'string',
              description: 'Optional club name to filter activities for.'
            },
            club_id: {
              type: 'integer',
              description: 'Optional club ID.'
            }
          }
        }
      },
      {
        name: 'get_club_roles',
        description: 'Fetch available club leadership and administrative roles (President, Vice President, Secretary, etc.).',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];

    const adminTools = [
      {
        name: 'get_portal_statistics',
        description: 'Fetch institution-wide overview statistics including total enrolled regular students, service requests, and ticket statistics.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];

    const facultyTools = [
      {
        name: 'get_faculty_assigned_classes',
        description: 'Fetch classes and lecture schedule assigned to the faculty member.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    ];

    let toolsList = portalTools;
    if (isAdminOrSuperAdmin) {
      toolsList = [...adminTools, ...portalTools, ...facultyTools];
    } else if (isFaculty) {
      toolsList = [...facultyTools, ...portalTools];
    }

    return res.json({
      success: true,
      tools: toolsList
    });
  } catch (err) {
    console.error('[AI Integration] Manifest discovery error:', err);
    return res.status(500).json({ error: 'Failed to retrieve AI tool manifest' });
  }
};

/**
 * 2. Tool Execution Runner (POST /execute-tool)
 */
const handleExecuteTool = async (req, res) => {
  try {
    const body = req.body || {};
    const rawToolName = body.tool_name || body.function_name || body.name || body.tool || body.action || body.function;
    const toolArgs = body.arguments || body.args || body.parameters || {};

    console.log(`🤖 [AI TOOL REQUEST]: POST ${req.originalUrl} - Tool: '${rawToolName}'`, JSON.stringify(body));

    if (!rawToolName) {
      return res.status(200).json({
        success: false,
        error: 'Missing required parameter: tool_name'
      });
    }

    // Normalize tool name & strip assistant prefixes (e.g. "student_assistant_get_profile" -> "get_profile")
    let cleanToolName = String(rawToolName)
      .toLowerCase()
      .trim()
      .replace(/^(student_assistant_|fee_assistant_|transport_assistant_|general_assistant_|admin_assistant_|portal_assistant_|ai_)/, '')
      .replace(/-/g, '_');

    // 1. Exact match lookup in toolRegistry
    let handler = tools[cleanToolName] || tools[rawToolName];

    // 2. Exact key lookup ignoring case
    if (typeof handler !== 'function') {
      const keys = Object.keys(tools);
      const matchKey = keys.find(k => k.toLowerCase() === cleanToolName || k.toLowerCase().endsWith(cleanToolName));
      if (matchKey) {
        handler = tools[matchKey];
      }
    }

    // 3. Category fuzzy fallback matching
    if (typeof handler !== 'function') {
      const name = cleanToolName;
      if (name.includes('stat') || name.includes('overview') || name.includes('dash') || name.includes('count')) {
        handler = tools.get_portal_statistics;
      } else if (name.includes('faculty')) {
        handler = tools.get_faculty_assigned_classes;
      } else if (name.includes('profile') || name.includes('student') || name.includes('user') || name.includes('info') || name.includes('detail')) {
        handler = tools.get_student_profile;
      } else if (name.includes('attend')) {
        handler = tools.get_student_attendance;
      } else if (name.includes('mark') || name.includes('grade') || name.includes('score') || name.includes('result')) {
        handler = tools.get_student_marks;
      } else if (name.includes('fee') || name.includes('due') || name.includes('pay') || name.includes('tuition')) {
        handler = tools.get_student_fees;
      } else if (name.includes('time') || name.includes('sched') || name.includes('class') || name.includes('period') || name.includes('routine')) {
        handler = tools.get_my_timetable;
      } else if (name.includes('ticket') || name.includes('complain') || name.includes('issue')) {
        handler = tools.get_student_tickets;
      } else if (name.includes('transp') || name.includes('bus') || name.includes('route')) {
        handler = tools.get_student_transport;
      } else if (name.includes('calen') || name.includes('event') || name.includes('holiday')) {
        handler = tools.get_academic_calendar;
      } else if (name.includes('club') && (name.includes('member') || name.includes('student') || name.includes('enroll') || name.includes('join'))) {
        handler = tools.get_club_members;
      } else if (name.includes('club') && (name.includes('activit') || name.includes('event') || name.includes('hackathon') || name.includes('workshop'))) {
        handler = tools.get_club_activities;
      } else if (name.includes('club') && (name.includes('role') || name.includes('lead') || name.includes('presid'))) {
        handler = tools.get_club_roles;
      } else if (name.includes('club')) {
        handler = tools.get_clubs;
      }
    }

    if (typeof handler !== 'function') {
      console.warn(`[AI Integration] Tool '${rawToolName}' (normalized: '${cleanToolName}') not found.`);
      return res.status(200).json({
        success: false,
        error: `Tool '${rawToolName}' is not supported by this application.`
      });
    }

    // Build userContext
    const reqUser = req.user || {};
    const userContext = buildUserContext(reqUser);

    // Execute tool handler
    const result = await handler(userContext, toolArgs);

    console.log(`✅ [AI TOOL SUCCESS]: '${rawToolName}' ->`, JSON.stringify(result).substring(0, 150));

    // Return clean JSON payload
    if (typeof result === 'object' && result !== null) {
      return res.json({
        success: true,
        tool_name: rawToolName,
        ...result,
        result: result
      });
    }

    return res.json({
      success: true,
      tool_name: rawToolName,
      result: result
    });

  } catch (err) {
    console.error('[AI Integration] Tool execution error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'An error occurred during tool execution.'
    });
  }
};

const buildUserContext = (reqUser = {}) => ({
  userId: reqUser.id || reqUser.student_id || reqUser.userId || reqUser.user_id || reqUser.pinNo || reqUser.admissionNumber,
  id: reqUser.id || reqUser.student_id || reqUser.user_id,
  role: reqUser.role || 'student',
  pinNo: reqUser.pinNo || reqUser.pin_no,
  admissionNumber: reqUser.admissionNumber || reqUser.admission_number,
  username: reqUser.username || reqUser.name || reqUser.full_name,
  email: reqUser.email,
  college_id: reqUser.college_id,
  branch_id: reqUser.branch_id
});

// Direct Timetable HTTP Endpoints for AI & Client Apps
const handleDirectMyTimetable = async (req, res) => {
  try {
    const userContext = buildUserContext(req.user);
    const args = { ...req.query, ...req.body };
    const result = await tools.get_my_timetable(userContext, args);
    return res.json({
      success: true,
      ...result,
      result
    });
  } catch (err) {
    console.error('[AI Integration] Direct timetable error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch timetable'
    });
  }
};

// Direct Club HTTP Endpoints for AI & Client Apps
const handleDirectClubs = async (req, res) => {
  try {
    const userContext = buildUserContext(req.user);
    const args = { ...req.query, ...req.body, ...(req.params || {}) };
    const result = await tools.get_clubs(userContext, args);
    return res.json({
      success: true,
      ...result,
      result
    });
  } catch (err) {
    console.error('[AI Integration] Direct clubs error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch clubs'
    });
  }
};

const handleDirectClubMembers = async (req, res) => {
  try {
    const userContext = buildUserContext(req.user);
    const args = { ...req.query, ...req.body, ...(req.params || {}) };
    const result = await tools.get_club_members(userContext, args);
    return res.json({
      success: true,
      ...result,
      result
    });
  } catch (err) {
    console.error('[AI Integration] Direct club members error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch club members'
    });
  }
};

const handleDirectClubActivities = async (req, res) => {
  try {
    const userContext = buildUserContext(req.user);
    const args = { ...req.query, ...req.body, ...(req.params || {}) };
    const result = await tools.get_club_activities(userContext, args);
    return res.json({
      success: true,
      ...result,
      result
    });
  } catch (err) {
    console.error('[AI Integration] Direct club activities error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch club activities'
    });
  }
};

const handleDirectClubRoles = async (req, res) => {
  try {
    const userContext = buildUserContext(req.user);
    const args = { ...req.query, ...req.body, ...(req.params || {}) };
    const result = await tools.get_club_roles(userContext, args);
    return res.json({
      success: true,
      ...result,
      result
    });
  } catch (err) {
    console.error('[AI Integration] Direct club roles error:', err);
    return res.status(200).json({
      success: false,
      error: err.message || 'Failed to fetch club roles'
    });
  }
};

// 1. Tool Manifest Discovery Endpoints
router.get('/ai-tools', handleGetAiTools);
router.get('/tools', handleGetAiTools);
router.get('/', handleGetAiTools);

// 2. Direct Timetable Endpoints
router.get('/my-timetable', aiAuthMiddleware, handleDirectMyTimetable);
router.get('/timetable', aiAuthMiddleware, handleDirectMyTimetable);
router.post('/my-timetable', aiAuthMiddleware, handleDirectMyTimetable);
router.post('/timetable', aiAuthMiddleware, handleDirectMyTimetable);

// 3. Direct Club Endpoints
router.get('/clubs/roles', aiAuthMiddleware, handleDirectClubRoles);
router.get('/clubs/activities', aiAuthMiddleware, handleDirectClubActivities);
router.get('/clubs/members', aiAuthMiddleware, handleDirectClubMembers);
router.get('/clubs/student/:student_id', aiAuthMiddleware, handleDirectClubMembers);
router.get('/clubs/:club_id/members', aiAuthMiddleware, handleDirectClubMembers);
router.get('/clubs/:club_id', aiAuthMiddleware, handleDirectClubs);
router.get('/clubs', aiAuthMiddleware, handleDirectClubs);
router.post('/clubs', aiAuthMiddleware, handleDirectClubs);

// 4. Tool Execution Endpoints
router.post('/execute-tool', aiAuthMiddleware, handleExecuteTool);
router.post('/execute_tool', aiAuthMiddleware, handleExecuteTool);
router.post('/', aiAuthMiddleware, handleExecuteTool);

module.exports = router;
