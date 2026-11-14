const jwt = require('jsonwebtoken');
const { masterPool } = require('../config/database');
const attendanceController = require('./attendanceController');
const feeController = require('./feeController');
const timetableController = require('./timetableController');
const { normalizeMobile, mobilesMatch, PARENT_PROFILE_FIELDS } = require('../utils/parentAuth');

const requireParent = (req, res) => {
  if (!req.user || req.user.role !== 'parent') {
    res.status(403).json({ success: false, message: 'Parent access required' });
    return false;
  }
  return true;
};

exports.getProfile = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const studentId = req.user.studentId || req.user.id;
    const baseFields = PARENT_PROFILE_FIELDS.join(', ');
    const extraFields = [
      'pin_no', 'admission_no', 'caste', 'adhar_no', 'admission_date', 'mandal_name',
      'student_status', 'scholar_status', 'fee_status', 'certificates_status',
      'registration_status', 'previous_college', 'stud_type', 'student_data'
    ].join(', ');

    let rows;
    try {
      [rows] = await masterPool.query(
        `SELECT ${baseFields}, ${extraFields} FROM students WHERE id = ? LIMIT 1`,
        [studentId]
      );
    } catch (colErr) {
      if (colErr.code === 'ER_BAD_FIELD_ERROR') {
        [rows] = await masterPool.query(
          `SELECT ${baseFields}, student_data FROM students WHERE id = ? LIMIT 1`,
          [studentId]
        );
      } else {
        throw colErr;
      }
    }

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = rows[0];
    let studentData = {};
    try {
      studentData = typeof student.student_data === 'string'
        ? JSON.parse(student.student_data)
        : (student.student_data || {});
    } catch {
      studentData = {};
    }

    res.json({
      success: true,
      data: {
        ...student,
        student_data: studentData,
        parent_mobile: req.user.parent_mobile
      }
    });
  } catch (error) {
    console.error('Parent get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    req.params.studentId = String(req.user.studentId || req.user.id);
    return attendanceController.getStudentAttendanceHistory(req, res);
  } catch (error) {
    console.error('Parent get attendance error:', error);
    res.status(500).json({ success: false, message: 'Failed to load attendance' });
  }
};

exports.logView = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;

    const { page } = req.body;
    if (!page || !['profile', 'attendance'].includes(page)) {
      return res.status(400).json({ success: false, message: 'Invalid page type' });
    }

    const studentId = req.user.studentId || req.user.id;
    const parentMobile = req.user.parent_mobile || '';

    await masterPool.query(
      `INSERT INTO parent_view_logs (student_id, parent_mobile, page) VALUES (?, ?, ?)`,
      [studentId, parentMobile, page]
    );

    const countColumn = page === 'profile' ? 'profile_view_count' : 'attendance_view_count';
    await masterPool.query(
      `INSERT INTO parent_engagement (student_id, ${countColumn}, last_viewed_at, last_parent_mobile)
       VALUES (?, 1, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         ${countColumn} = ${countColumn} + 1,
         last_viewed_at = NOW(),
         last_parent_mobile = VALUES(last_parent_mobile)`,
      [studentId, parentMobile]
    );

    res.json({ success: true, message: 'View logged' });
  } catch (error) {
    console.error('Parent log view error:', error);
    res.status(500).json({ success: false, message: 'Failed to log view' });
  }
};

exports.getEngagement = async (req, res) => {
  try {
    const studentId = req.params.studentId;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const [engagement] = await masterPool.query(
      `SELECT student_id, profile_view_count, attendance_view_count, last_viewed_at,
              last_parent_mobile, last_login_at
       FROM parent_engagement WHERE student_id = ?`,
      [studentId]
    );

    const [studentRows] = await masterPool.query(
      'SELECT parent_mobile1, parent_mobile2, student_data FROM students WHERE id = ?',
      [studentId]
    );

    let isParentVerified = false;
    if (studentRows.length) {
      try {
        const data = typeof studentRows[0].student_data === 'string'
          ? JSON.parse(studentRows[0].student_data)
          : (studentRows[0].student_data || {});
        isParentVerified = data.is_parent_mobile_verified === true;
      } catch {
        isParentVerified = false;
      }
    }

    const stats = engagement[0] || {
      profile_view_count: 0,
      attendance_view_count: 0,
      last_viewed_at: null,
      last_parent_mobile: null,
      last_login_at: null
    };

    res.json({
      success: true,
      data: {
        ...stats,
        is_parent_mobile_verified: isParentVerified,
        parent_mobile1: studentRows[0]?.parent_mobile1 || null,
        parent_mobile2: studentRows[0]?.parent_mobile2 || null,
        total_views: (stats.profile_view_count || 0) + (stats.attendance_view_count || 0)
      }
    });
  } catch (error) {
    console.error('Parent engagement error:', error);
    res.status(500).json({ success: false, message: 'Failed to load parent engagement' });
  }
};

exports.getChildren = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const parentMobile = req.user.parent_mobile;
    const activeStudentId = Number(req.user.studentId || req.user.id);

    if (!parentMobile) {
      const [students] = await masterPool.query(
        `SELECT id, admission_number, pin_no, student_name, student_photo, college, course, branch, current_year, current_semester
         FROM students WHERE id = ? LIMIT 1`,
        [activeStudentId]
      );
      return res.json({
        success: true,
        children: students.map((s) => ({ ...s, isSelected: true }))
      });
    }

    const normalized = normalizeMobile(parentMobile);
    const [rows] = await masterPool.query(
      `SELECT id, admission_number, pin_no, student_name, student_photo, college, course, branch, current_year, current_semester, parent_mobile1, parent_mobile2, student_data
       FROM students
       WHERE parent_mobile1 LIKE ? OR parent_mobile2 LIKE ? OR parent_mobile1 = ? OR parent_mobile2 = ?
       LIMIT 20`,
      [`%${normalized}`, `%${normalized}`, normalized, parentMobile]
    );

    const matched = rows.filter((r) => mobilesMatch(r.parent_mobile1, parentMobile) || mobilesMatch(r.parent_mobile2, parentMobile));
    const list = matched.length > 0 ? matched : rows;

    res.json({
      success: true,
      children: list.map((s) => ({
        id: s.id,
        admission_number: s.admission_number,
        pin_no: s.pin_no,
        student_name: s.student_name,
        student_photo: s.student_photo,
        college: s.college,
        course: s.course,
        branch: s.branch,
        current_year: s.current_year,
        current_semester: s.current_semester,
        isSelected: Number(s.id) === activeStudentId
      }))
    });
  } catch (error) {
    console.error('Parent get children error:', error);
    res.status(500).json({ success: false, message: 'Failed to load children' });
  }
};

exports.switchChild = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student ID is required' });
    }

    const parentMobile = req.user.parent_mobile;
    const [rows] = await masterPool.query(
      `SELECT id, admission_number, pin_no, student_name, student_photo, college, course, branch, current_year, current_semester, parent_mobile1, parent_mobile2
       FROM students WHERE id = ? LIMIT 1`,
      [studentId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const student = rows[0];
    if (parentMobile) {
      const match = mobilesMatch(student.parent_mobile1, parentMobile) || mobilesMatch(student.parent_mobile2, parentMobile);
      if (!match) {
        return res.status(403).json({ success: false, message: 'This student is not linked to your mobile number' });
      }
    }

    const payload = {
      id: student.id,
      studentId: student.id,
      role: 'parent',
      admission_number: student.admission_number,
      parent_mobile: parentMobile
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15d' });

    const user = {
      id: student.id,
      studentId: student.id,
      role: 'parent',
      admission_number: student.admission_number,
      student_name: student.student_name,
      parent_mobile: parentMobile,
      student_photo: student.student_photo,
      college: student.college,
      course: student.course,
      branch: student.branch,
      current_year: student.current_year,
      current_semester: student.current_semester
    };

    res.json({
      success: true,
      message: 'Switched child successfully',
      token,
      user
    });
  } catch (error) {
    console.error('Parent switch child error:', error);
    res.status(500).json({ success: false, message: 'Failed to switch child' });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const studentId = Number(req.user.studentId || req.user.id);

    // 1. Fetch student basic info
    const [students] = await masterPool.query(
      `SELECT s.id, s.admission_number, s.pin_no, s.student_name, s.student_photo,
              s.college, s.course, s.branch, s.branch_id, s.current_year, s.current_semester,
              s.section, s.batch, s.student_status
       FROM students s WHERE s.id = ? LIMIT 1`,
      [studentId]
    );

    if (!students.length) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    const student = students[0];

    // 2. Fetch Attendance Summary
    let attendanceSummary = {
      totalClasses: 0,
      attendedClasses: 0,
      absentClasses: 0,
      percentage: 0,
      todayStatus: 'Not Marked',
      todayReason: null
    };

    try {
      const [attCounts] = await masterPool.query(
        `SELECT
           COUNT(CASE WHEN LOWER(status) IN ('present', 'p') THEN 1 END) as attended,
           COUNT(CASE WHEN LOWER(status) IN ('absent', 'a') THEN 1 END) as absent,
           COUNT(CASE WHEN LOWER(status) IN ('present', 'p', 'absent', 'a', 'late', 'half_day') THEN 1 END) as total
         FROM attendance_records
         WHERE student_id = ?`,
        [studentId]
      );

      if (attCounts.length && attCounts[0].total > 0) {
        const total = Number(attCounts[0].total);
        const attended = Number(attCounts[0].attended);
        const absent = Number(attCounts[0].absent);
        attendanceSummary.totalClasses = total;
        attendanceSummary.attendedClasses = attended;
        attendanceSummary.absentClasses = absent;
        attendanceSummary.percentage = Math.round((attended / total) * 100);
      }

      // Today's attendance
      const [todayAtt] = await masterPool.query(
        `SELECT status, holiday_reason FROM attendance_records
         WHERE student_id = ? AND attendance_date = CURDATE() LIMIT 1`,
        [studentId]
      );
      if (todayAtt.length) {
        attendanceSummary.todayStatus = todayAtt[0].status;
        attendanceSummary.todayReason = todayAtt[0].holiday_reason;
      }
    } catch (attErr) {
      console.warn('Dashboard attendance fetch warning:', attErr.message);
    }

    // 3. Fetch Today's Timetable
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
    const todayIndex = new Date().getDay();
    const todayDay = todayIndex >= 1 && todayIndex <= 6 ? days[todayIndex] : 'MON';
    let todayClasses = [];

    try {
      const [ttRows] = await masterPool.query(
        `SELECT te.*, s.name as subject_name, s.code as subject_code, f.name as faculty_name,
                ps.slot_name, ps.start_time, ps.end_time, ps.sort_order
         FROM timetable_entries te
         LEFT JOIN subjects s ON s.id = te.subject_id
         LEFT JOIN faculty f ON f.id = te.faculty_id
         LEFT JOIN period_slots ps ON ps.id = te.period_slot_id
         WHERE (te.branch_id = ? OR te.branch_id = 0)
           AND te.year_of_study = ?
           AND te.semester_number = ?
           AND UPPER(te.day_of_week) = ?
         ORDER BY COALESCE(ps.sort_order, te.slot_order, 1) ASC`,
        [student.branch_id || 0, student.current_year || 1, student.current_semester || 1, todayDay]
      );
      todayClasses = ttRows;
    } catch (ttErr) {
      console.warn('Dashboard timetable fetch warning:', ttErr.message);
    }

    // 4. Fetch Announcements count & latest
    let latestAnnouncements = [];
    try {
      const [annRows] = await masterPool.query(
        `SELECT id, title, content, target_type, created_at, attachment_url
         FROM announcements
         WHERE is_active = 1
         ORDER BY created_at DESC LIMIT 3`
      );
      latestAnnouncements = annRows;
    } catch (annErr) {
      console.warn('Dashboard announcements warning:', annErr.message);
    }

    // 5. Fetch Events (Upcoming)
    let upcomingEvents = [];
    try {
      const [evRows] = await masterPool.query(
        `SELECT id, title, description, event_date, end_date, event_type, venue
         FROM events
         WHERE (event_date >= CURDATE() OR end_date >= CURDATE())
         ORDER BY event_date ASC LIMIT 3`
      );
      upcomingEvents = evRows;
    } catch (evErr) {
      console.warn('Dashboard events warning:', evErr.message);
    }

    res.json({
      success: true,
      data: {
        student,
        attendance: attendanceSummary,
        todayDay,
        todayClasses,
        latestAnnouncements,
        upcomingEvents
      }
    });
  } catch (error) {
    console.error('Parent dashboard summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to load dashboard summary' });
  }
};

exports.getFeeDetails = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    const studentAdm = req.user.admission_number;
    if (!studentAdm) {
      const [rows] = await masterPool.query('SELECT admission_number FROM students WHERE id = ? LIMIT 1', [req.user.studentId || req.user.id]);
      if (rows.length && rows[0].admission_number) {
        req.params.studentId = rows[0].admission_number;
      } else {
        return res.status(404).json({ success: false, message: 'Admission number not found' });
      }
    } else {
      req.params.studentId = studentAdm;
    }
    return feeController.getStudentFeeDetails(req, res);
  } catch (error) {
    console.error('Parent get fee details error:', error);
    res.status(500).json({ success: false, message: 'Failed to load fee details' });
  }
};

exports.getTimetable = async (req, res) => {
  try {
    if (!requireParent(req, res)) return;
    return timetableController.getMyTimetable(req, res);
  } catch (error) {
    console.error('Parent get timetable error:', error);
    res.status(500).json({ success: false, message: 'Failed to load timetable' });
  }
};
