const { maintenancePool, masterPool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for ticket photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/tickets';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'ticket-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Generate unique ticket number
 */
const generateTicketNumber = async () => {
  const prefix = 'TKT';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${year}-${timestamp}-${random}`;
};

/**
 * Resolve student info from student_database (masterPool)
 * Supports admission_number, admissionNumber, pinNo, pin_no, student_id, or username
 */
const resolveStudentInfo = async (studentUser) => {
  if (!studentUser) return null;
  const rawAdmission = studentUser.admission_number || studentUser.admissionNumber || studentUser.pinNo || studentUser.pin_no || studentUser.username;
  const rawId = studentUser.id || studentUser.student_id;

  if (rawAdmission) {
    const [rows] = await masterPool.query(
      `SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        COALESCE(s.college_id, col.id) AS college_id,
        COALESCE(col.name, s.college) AS college_name
       FROM students s
       LEFT JOIN colleges col ON (
         s.college_id = col.id
         OR s.college COLLATE utf8mb4_unicode_ci = col.name COLLATE utf8mb4_unicode_ci
       )
       WHERE s.admission_number = ? OR s.pin_no = ?
       LIMIT 1`,
      [rawAdmission, rawAdmission]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  if (rawId) {
    const [rows] = await masterPool.query(
      `SELECT
        s.id,
        s.admission_number,
        s.pin_no,
        s.student_name,
        COALESCE(s.college_id, col.id) AS college_id,
        COALESCE(col.name, s.college) AS college_name
       FROM students s
       LEFT JOIN colleges col ON (
         s.college_id = col.id
         OR s.college COLLATE utf8mb4_unicode_ci = col.name COLLATE utf8mb4_unicode_ci
       )
       WHERE s.id = ?
       LIMIT 1`,
      [rawId]
    );
    if (rows && rows.length > 0) return rows[0];
  }

  if (rawAdmission) {
    return {
      id: rawId || null,
      admission_number: rawAdmission,
      pin_no: rawAdmission,
      student_name: studentUser.name || studentUser.username || 'Student',
      college_id: studentUser.college_id || null,
      college_name: studentUser.college_name || null
    };
  }

  return null;
};

/**
 * Create a new ticket (student raises complaint)
 * Stored in maintenance_db.complaints
 */
const createTicket = async (req, res) => {
  try {
    const {
      category_id,
      sub_category_id,
      title,
      description,
      block_no,
      floor_no,
      room_no
    } = req.body;

    const studentUser = req.user || req.student;
    const studentData = await resolveStudentInfo(studentUser);

    if (!studentData || !studentData.admission_number) {
      return res.status(401).json({
        success: false,
        message: 'Student authentication required'
      });
    }

    if (!category_id || !title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category and title are required'
      });
    }

    // Verify category exists and is active in maintenance_db
    const pool = maintenancePool || masterPool;
    let [category] = await pool.query(
      'SELECT id, parent_id, is_active FROM categories WHERE id = ?',
      [category_id]
    ).catch(async () => {
      return await masterPool.query(
        'SELECT id, parent_id, is_active FROM complaint_categories WHERE id = ?',
        [category_id]
      );
    });

    if (category.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid complaint category'
      });
    }

    if (!category[0].is_active) {
      return res.status(400).json({
        success: false,
        message: 'This complaint category is not active'
      });
    }

    // Handle photo upload
    let photoUrl = null;
    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Image = fileBuffer.toString('base64');
      const mimeType = req.file.mimetype;
      photoUrl = `data:${mimeType};base64,${base64Image}`;
    }

    // Generate unique ticket number
    const ticketNumber = await generateTicketNumber();

    // Insert into maintenance_db.complaints
    let result;
    try {
      [result] = await pool.query(
        `INSERT INTO complaints 
         (complaint_number, requester_type, requester_name, requester_identifier, category_id, sub_category_id, college_id, college_name, block_no, floor_no, room_no, title, description, photo_url, status, priority, assignments, comments, status_history, created_at, updated_at)
         VALUES (?, 'student', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'medium', '[]', '[]', JSON_ARRAY(JSON_OBJECT('status', 'pending', 'updated_at', NOW(), 'updated_by', 'Student')), NOW(), NOW())`,
        [
          ticketNumber,
          studentData.student_name || 'Student',
          studentData.admission_number,
          category_id,
          sub_category_id || null,
          studentData.college_id || null,
          studentData.college_name || null,
          block_no?.trim() || null,
          floor_no?.trim() || null,
          room_no?.trim() || null,
          title.trim(),
          description?.trim() || null,
          photoUrl
        ]
      );
    } catch (insertError) {
      console.warn('Falling back to masterPool.tickets on complaint insert:', insertError.message);
      [result] = await masterPool.query(
        `INSERT INTO tickets 
         (ticket_number, student_id, admission_number, category_id, sub_category_id, college_id, college_name, block_no, floor_no, room_no, title, description, photo_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          ticketNumber,
          studentData.id || 0,
          studentData.admission_number,
          category_id,
          sub_category_id || null,
          studentData.college_id || null,
          studentData.college_name || null,
          block_no?.trim() || null,
          floor_no?.trim() || null,
          room_no?.trim() || null,
          title.trim(),
          description?.trim() || '',
          photoUrl
        ]
      );
    }

    // Clean up uploaded file if converted to base64
    if (req.file && photoUrl && photoUrl.startsWith('data:') && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: {
        id: result.insertId,
        ticket_number: ticketNumber,
        complaint_number: ticketNumber,
        status: 'pending',
        title: title.trim(),
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error creating ticket',
      error: error.message
    });
  }
};

/**
 * Get tickets for a student from maintenance_db.complaints
 */
const getStudentTickets = async (req, res) => {
  try {
    const studentUser = req.user || req.student;
    const studentData = await resolveStudentInfo(studentUser);

    if (!studentData || !studentData.admission_number) {
      return res.status(401).json({
        success: false,
        message: 'Student authentication required'
      });
    }

    const pool = maintenancePool || masterPool;
    let tickets = [];

    try {
      const [complaints] = await pool.query(
        `SELECT 
          c.id,
          c.complaint_number AS ticket_number,
          c.complaint_number,
          c.requester_type,
          c.requester_name,
          c.requester_identifier,
          c.requester_identifier AS admission_number,
          c.category_id,
          c.sub_category_id,
          c.college_id,
          c.college_name,
          c.block_no,
          c.floor_no,
          c.room_no,
          c.title,
          c.description,
          c.photo_url,
          c.status,
          c.priority,
          c.feedback,
          c.created_at,
          c.updated_at,
          c.resolved_at,
          c.closed_at,
          cat.name AS category_name,
          subcat.name AS sub_category_name
         FROM complaints c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN categories subcat ON c.sub_category_id = subcat.id
         WHERE c.requester_identifier = ?
            OR (c.requester_type = 'student' AND c.requester_name = ?)
         ORDER BY c.created_at DESC`,
        [studentData.admission_number, studentData.student_name]
      );
      tickets = complaints;
    } catch (err) {
      console.warn('Falling back to masterPool.tickets for getStudentTickets:', err.message);
      const [fallback] = await masterPool.query(
        `SELECT 
          t.*,
          c.name as category_name,
          sc.name as sub_category_name
         FROM tickets t
         LEFT JOIN complaint_categories c ON t.category_id = c.id
         LEFT JOIN complaint_categories sc ON t.sub_category_id = sc.id
         WHERE t.admission_number = ?
         ORDER BY t.created_at DESC`,
        [studentData.admission_number]
      );
      tickets = fallback;
    }

    res.json({
      success: true,
      data: tickets
    });
  } catch (error) {
    console.error('Error fetching student tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
};

/**
 * Get single ticket details
 */
const getTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = maintenancePool || masterPool;

    let ticket = null;
    try {
      const [complaints] = await pool.query(
        `SELECT 
          c.*,
          c.complaint_number AS ticket_number,
          c.requester_identifier AS admission_number,
          c.requester_name AS student_name,
          cat.name as category_name,
          cat.description as category_description,
          subcat.name as sub_category_name,
          subcat.description as sub_category_description
         FROM complaints c
         LEFT JOIN categories cat ON c.category_id = cat.id
         LEFT JOIN categories subcat ON c.sub_category_id = subcat.id
         WHERE c.id = ?`,
        [id]
      );
      if (complaints.length > 0) ticket = complaints[0];
    } catch {
      // fallback
    }

    if (!ticket) {
      const [fallback] = await masterPool.query(
        `SELECT t.*, 
          c.name as category_name,
          c.description as category_description,
          sc.name as sub_category_name,
          sc.description as sub_category_description
         FROM tickets t
         LEFT JOIN complaint_categories c ON t.category_id = c.id
         LEFT JOIN complaint_categories sc ON t.sub_category_id = sc.id
         WHERE t.id = ?`,
        [id]
      );
      if (fallback.length > 0) ticket = fallback[0];
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket details',
      error: error.message
    });
  }
};

/**
 * Reopen a completed complaint
 */
const reopenStudentTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const studentUser = req.user || req.student;
    const studentData = await resolveStudentInfo(studentUser);

    if (!studentData || !studentData.admission_number) {
      return res.status(401).json({
        success: false,
        message: 'Student authentication required'
      });
    }

    const pool = maintenancePool || masterPool;
    try {
      await pool.query(
        `UPDATE complaints 
         SET status = 'pending',
             status_history = JSON_ARRAY_APPEND(COALESCE(status_history, '[]'), '$', JSON_OBJECT('status', 'reopened', 'updated_at', NOW(), 'updated_by', 'Student')),
             updated_at = NOW()
         WHERE id = ? AND requester_identifier = ?`,
        [id, studentData.admission_number]
      );
    } catch {
      await masterPool.query(
        `UPDATE tickets SET status = 'pending', updated_at = NOW() WHERE id = ? AND admission_number = ?`,
        [id, studentData.admission_number]
      );
    }

    res.json({
      success: true,
      message: 'Complaint raised again successfully'
    });
  } catch (error) {
    console.error('Error reopening student ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error reopening ticket',
      error: error.message
    });
  }
};

/**
 * Submit feedback for completed ticket
 */
const submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, feedback_text } = req.body;
    const studentUser = req.user || req.student;
    const studentData = await resolveStudentInfo(studentUser);

    if (!studentData || !studentData.admission_number) {
      return res.status(401).json({
        success: false,
        message: 'Student authentication required'
      });
    }

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required'
      });
    }

    const feedbackObj = JSON.stringify({
      rating: parseInt(rating, 10),
      feedback_text: feedback_text || null,
      submitted_at: new Date().toISOString()
    });

    const pool = maintenancePool || masterPool;
    try {
      await pool.query(
        `UPDATE complaints SET feedback = ?, status = 'closed', updated_at = NOW() WHERE id = ?`,
        [feedbackObj, id]
      );
    } catch {
      await masterPool.query(
        `INSERT INTO ticket_feedback (ticket_id, student_id, rating, feedback_text) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), feedback_text = VALUES(feedback_text)`,
        [id, studentData.id || 0, rating, feedback_text || null]
      );
    }

    res.json({
      success: true,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting feedback',
      error: error.message
    });
  }
};

/**
 * Get all tickets (admin view)
 */
const getTickets = async (req, res) => {
  try {
    const { status, category_id, page = 1, limit = 50, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const pool = maintenancePool || masterPool;

    let query = `
      SELECT 
        c.id,
        c.complaint_number AS ticket_number,
        c.complaint_number,
        c.requester_type,
        c.requester_name,
        c.requester_identifier,
        c.category_id,
        c.sub_category_id,
        c.college_name,
        c.block_no,
        c.floor_no,
        c.room_no,
        c.title,
        c.status,
        c.priority,
        c.created_at,
        c.updated_at,
        cat.name AS category_name,
        subcat.name AS sub_category_name
      FROM complaints c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN categories subcat ON c.sub_category_id = subcat.id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (category_id) {
      conditions.push('c.category_id = ?');
      params.push(category_id);
    }

    if (search) {
      conditions.push('(c.title LIKE ? OR c.complaint_number LIKE ? OR c.requester_name LIKE ? OR c.requester_identifier LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    let tickets = [];
    let total = 0;

    try {
      const [rows] = await pool.query(query, params);
      tickets = rows;

      let countQuery = 'SELECT COUNT(*) as total FROM complaints c';
      if (conditions.length > 0) countQuery += ' WHERE ' + conditions.join(' AND ');
      const [countResult] = await pool.query(countQuery, params.slice(0, -2));
      total = countResult[0]?.total || 0;
    } catch {
      // Fallback
      tickets = [];
      total = 0;
    }

    res.json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching tickets for admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tickets',
      error: error.message
    });
  }
};

/**
 * Assign ticket
 */
const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to, notes } = req.body;
    const pool = maintenancePool || masterPool;

    await pool.query(
      `UPDATE complaints 
       SET assignments = JSON_ARRAY(JSON_OBJECT('assigned_to', ?, 'notes', ?, 'assigned_at', NOW())),
           status = 'approaching',
           updated_at = NOW()
       WHERE id = ?`,
      [JSON.stringify(assigned_to), notes || null, id]
    );

    res.json({
      success: true,
      message: 'Ticket assigned successfully'
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning ticket',
      error: error.message
    });
  }
};

/**
 * Change ticket status
 */
const changeTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    const pool = maintenancePool || masterPool;

    await pool.query(
      `UPDATE complaints 
       SET status = ?,
           status_history = JSON_ARRAY_APPEND(COALESCE(status_history, '[]'), '$', JSON_OBJECT('status', ?, 'comment', ?, 'updated_at', NOW())),
           updated_at = NOW()
       WHERE id = ?`,
      [status, status, comment || null, id]
    );

    res.json({
      success: true,
      message: 'Ticket status updated successfully'
    });
  } catch (error) {
    console.error('Error changing ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating ticket status',
      error: error.message
    });
  }
};

/**
 * Add comment to ticket
 */
const addComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const pool = maintenancePool || masterPool;

    await pool.query(
      `UPDATE complaints 
       SET comments = JSON_ARRAY_APPEND(COALESCE(comments, '[]'), '$', JSON_OBJECT('comment', ?, 'created_at', NOW())),
           updated_at = NOW()
       WHERE id = ?`,
      [comment, id]
    );

    res.json({
      success: true,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
};

/**
 * Get ticket statistics
 */
const getTicketStats = async (req, res) => {
  try {
    const pool = maintenancePool || masterPool;
    const [statusStats] = await pool.query(
      `SELECT status, COUNT(*) as count FROM complaints GROUP BY status`
    );

    const [categoryStats] = await pool.query(
      `SELECT cat.name as category_name, COUNT(c.id) as count
       FROM categories cat
       LEFT JOIN complaints c ON cat.id = c.category_id
       WHERE cat.parent_id IS NULL
       GROUP BY cat.id, cat.name
       ORDER BY count DESC
       LIMIT 10`
    );

    res.json({
      success: true,
      data: {
        by_status: statusStats,
        by_category: categoryStats
      }
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching ticket statistics',
      error: error.message
    });
  }
};

const updateTicketStatus = async (ticketId, status) => {
  const pool = maintenancePool || masterPool;
  await pool.query('UPDATE complaints SET status = ?, updated_at = NOW() WHERE id = ?', [status, ticketId]);
};

module.exports = {
  uploadPhoto: upload.single('photo'),
  createTicket,
  getTickets,
  getTicket,
  getStudentTickets,
  reopenStudentTicket,
  assignTicket,
  changeTicketStatus,
  addComment,
  submitFeedback,
  getTicketStats,
  updateTicketStatus
};
