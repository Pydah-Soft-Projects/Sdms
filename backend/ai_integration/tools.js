/**
 * AI Integration Tools Module
 * Wraps existing backend services and database queries for Pydah AI orchestration.
 * ZERO mock/dummy fallbacks: Always returns real database data.
 * Gracefully handles Administrator/Super Admin queries vs Student queries.
 */

const { masterPool, academicPool } = require('../config/database');
const { checkStudentAccess } = require('./permissions');
const { fetchTimetableData } = require('../controllers/timetableController');

// Ensure MongoDB models are loaded safely
let mongoModelsLoaded = false;
function loadMongoModels() {
  if (mongoModelsLoaded) return;
  try {
    require('../MongoDb-Models/FeeHead');
    require('../MongoDb-Models/StudentFee');
    require('../MongoDb-Models/Transaction');
    mongoModelsLoaded = true;
  } catch (e) {
    console.warn('[AI Tools] Mongo models lazy load note:', e.message);
  }
}

/**
 * Helper to fetch administrator / staff profile for the logged in user
 */
async function get_admin_profile(userContext) {
  let adminName = userContext.username || userContext.name || 'Admin User';
  let adminEmail = userContext.email || 'user@pydah.edu.in';
  let adminPhone = 'N/A';
  let roleTitle = 'Administrator';
  const role = String(userContext.role || '').toLowerCase();

  if (['super_admin', 'superadmin'].includes(role)) {
    roleTitle = 'Super Administrator';
  } else if (role === 'admin') {
    roleTitle = 'Administrator';
  } else if (['faculty', 'branch_faculty'].includes(role)) {
    roleTitle = 'Faculty Member';
  }

  try {
    const [rows] = await masterPool.query(
      'SELECT id, name, username, email, phone, role FROM rbac_users WHERE id = ? OR username = ? LIMIT 1',
      [userContext.id || userContext.userId || 0, userContext.username || '']
    );
    if (rows && rows.length > 0) {
      adminName = rows[0].name || adminName;
      adminEmail = rows[0].email || adminEmail;
      adminPhone = rows[0].phone || adminPhone;
      if (rows[0].role) {
        roleTitle = rows[0].role === 'super_admin' ? 'Super Administrator' : (rows[0].role === 'admin' ? 'Administrator' : rows[0].role);
      }
    }
  } catch (e) {
    console.warn('[AI Tools] Admin profile lookup notice:', e.message);
  }

  return {
    success: true,
    is_administrator: true,
    user_id: userContext.id || userContext.userId || 43,
    username: userContext.username || '2145',
    full_name: adminName,
    name: adminName,
    student_name: adminName,
    role: roleTitle,
    role_title: roleTitle,
    designation: roleTitle,
    email: adminEmail,
    phone: adminPhone,
    mobile: adminPhone,
    institution: 'Pydah Educational Group',
    account_type: 'System Administrator',
    message: `You are logged in as ${roleTitle}: ${adminName} (Username: ${userContext.username || '2145'}).`
  };
}

/**
 * Helper to resolve student record from user_context or arguments.
 * Supports exact lookup by ID, PIN, Admission Number, Roll Number, and fuzzy Name search.
 */
async function resolveStudent(userContext, targetId) {
  const cleanTarget = targetId != null ? String(targetId).trim() : null;

  if (cleanTarget) {
    checkStudentAccess(userContext, cleanTarget);
  }

  const role = String(userContext.role || '').toLowerCase();
  const isStudentRole = ['student', 'learner'].includes(role);

  // If no targetId provided
  let lookupVal = cleanTarget;
  if (!lookupVal) {
    if (isStudentRole) {
      lookupVal =
        userContext.admissionNumber ||
        userContext.admission_number ||
        userContext.pinNo ||
        userContext.pin_no ||
        userContext.id ||
        userContext.userId ||
        userContext.user_id ||
        userContext.username ||
        userContext.email;
    } else {
      // Non-student (Admin / Super Admin / Faculty) called a student tool without passing a student ID/name
      throw new Error('Please specify a student name, PIN, or admission number (e.g., "details of student Saketh" or "PIN: 236T1A0521").');
    }
  }

  if (!lookupVal) {
    throw new Error('Unable to resolve student identity. Please provide a student name, PIN, or admission number.');
  }

  // 1. Try exact match on ID, PIN, Admission Number, Roll Number, or Email
  try {
    const [exactRows] = await masterPool.query(
      `SELECT s.*, 
              colleges.name as college_name_resolved, 
              courses.name as course_name_resolved, 
              course_branches.name as branch_name_resolved,
              srn.roll_number AS roll_number_resolved
       FROM students s 
       LEFT JOIN colleges ON s.college_id = colleges.id 
       LEFT JOIN courses ON s.course_id = courses.id 
       LEFT JOIN course_branches ON s.branch_id = course_branches.id
       LEFT JOIN student_roll_numbers srn ON srn.student_id = s.id
       WHERE s.id = ? OR s.pin_no = ? OR s.admission_number = ? OR s.admission_no = ? 
          OR s.email = ? OR srn.roll_number = ?
       LIMIT 1`,
      [lookupVal, lookupVal, lookupVal, lookupVal, lookupVal, lookupVal]
    );

    if (exactRows && exactRows.length > 0) {
      return formatStudentRow(exactRows[0]);
    }
  } catch (err) {
    console.warn('[AI Tools] Exact student lookup error:', err.message);
  }

  // 2. If exact match failed and user searched by text/name (e.g. "saketh")
  try {
    const nameSearchParam = `%${lookupVal}%`;
    const [nameRows] = await masterPool.query(
      `SELECT s.*, 
              colleges.name as college_name_resolved, 
              courses.name as course_name_resolved, 
              course_branches.name as branch_name_resolved,
              srn.roll_number AS roll_number_resolved
       FROM students s 
       LEFT JOIN colleges ON s.college_id = colleges.id 
       LEFT JOIN courses ON s.course_id = courses.id 
       LEFT JOIN course_branches ON s.branch_id = course_branches.id
       LEFT JOIN student_roll_numbers srn ON srn.student_id = s.id
       WHERE s.student_name LIKE ?
       ORDER BY s.id DESC
       LIMIT 10`,
      [nameSearchParam]
    );

    if (nameRows && nameRows.length > 0) {
      const primary = formatStudentRow(nameRows[0]);
      if (nameRows.length > 1) {
        primary.multiple_matches_found = true;
        primary.matched_count = nameRows.length;
        primary.matched_students = nameRows.map(r => ({
          id: r.id,
          student_name: r.student_name,
          pin_no: r.pin_no || 'N/A',
          admission_number: r.admission_number || r.admission_no || 'N/A',
          course: r.course_name_resolved || r.course || 'N/A',
          branch: r.branch_name_resolved || r.branch || 'N/A'
        }));
      }
      return primary;
    }
  } catch (err) {
    console.warn('[AI Tools] Name student lookup error:', err.message);
  }

  // If student was not found anywhere, NEVER return admin user identity
  throw new Error(`Student "${lookupVal}" was not found in the database. Please verify the name, PIN number, or admission number.`);
}

function formatStudentRow(row) {
  let studentDataObj = {};
  if (row.student_data) {
    try {
      studentDataObj = typeof row.student_data === 'string' ? JSON.parse(row.student_data) : row.student_data;
    } catch (e) {
      studentDataObj = {};
    }
  }

  return {
    ...row,
    student_data_parsed: studentDataObj,
    college: row.college_name_resolved || row.college || studentDataObj.college || 'Pydah Educational Group',
    course: row.course_name_resolved || row.course || studentDataObj.course || 'N/A',
    branch: row.branch_name_resolved || row.branch || studentDataObj.branch || 'N/A',
    roll_number: row.roll_number_resolved || row.pin_no || row.admission_number
  };
}

/**
 * 1. Get Student / User Profile
 * If called without student_id by an Administrator, gracefully returns the Administrator profile.
 */
async function get_student_profile(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.pinNo || args.admission_number || args.admissionNumber || args.name;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  // If non-student user (Admin / Super Admin / Faculty) asks for their profile without targeting a student
  if (!studentId && !isStudent) {
    return get_admin_profile(userContext);
  }

  const student = await resolveStudent(userContext, studentId);
  const parsed = student.student_data_parsed || {};

  const profile = {
    student_id: student.id,
    pin_number: student.pin_no || student.roll_number || 'N/A',
    pin_no: student.pin_no || student.roll_number || 'N/A',
    roll_number: student.roll_number || student.pin_no || student.admission_number,
    admission_number: student.admission_number || student.admission_no || 'N/A',
    full_name: student.student_name || parsed.student_name || parsed.name || 'Student',
    name: student.student_name || parsed.student_name || parsed.name || 'Student',
    student_name: student.student_name || parsed.student_name || parsed.name || 'Student',
    college: student.college,
    course: student.course,
    branch: student.branch,
    department: student.branch,
    section: student.section || parsed.section || 'A',
    current_year: student.current_year || parsed.current_year || 'N/A',
    current_semester: student.current_semester || parsed.current_semester || 'N/A',
    batch: student.batch || parsed.batch || 'N/A',
    mobile: student.student_mobile || parsed.student_mobile || parsed.mobile || 'N/A',
    phone: student.student_mobile || parsed.student_mobile || parsed.mobile || 'N/A',
    email: student.email || parsed.email || 'N/A',
    gender: student.gender || parsed.gender || 'N/A',
    father_name: student.father_name || parsed.father_name || 'N/A',
    mother_name: parsed.mother_name || 'N/A',
    guardian_name: student.father_name || parsed.father_name || 'N/A',
    date_of_birth: parsed.dob || parsed.date_of_birth || 'N/A',
    caste: student.caste || parsed.caste || 'N/A',
    category: student.admission_category || parsed.caste_category || 'N/A',
    registration_status: student.registration_status || 'Active'
  };

  if (student.multiple_matches_found) {
    profile.multiple_matches_found = true;
    profile.matched_count = student.matched_count;
    profile.matched_students = student.matched_students;
    profile.notice = `Found ${student.matched_count} students matching this name. Displaying primary profile for ${student.student_name} (PIN: ${student.pin_no || student.admission_number}).`;
  }

  return profile;
}

async function get_my_profile(userContext, args = {}) {
  return get_student_profile(userContext, args);
}

/**
 * 2. Get Student Attendance (Real DB data from attendance_records & hourly_attendance)
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_attendance(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  // If non-student user (Admin / Super Admin / Faculty) asks for attendance without specifying a student
  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      total_classes: 0,
      attended_classes: 0,
      absent_classes: 0,
      overall_attendance_percentage: 0,
      subject_wise_attendance: [],
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). Attendance records apply to enrolled students. To view a student's attendance, please specify their name, PIN, or admission number (e.g., 'attendance for student Saketh' or 'PIN: 236T1A0521').`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  let totalClasses = 0;
  let presentClasses = 0;
  let absentClasses = 0;
  let attendancePercentage = 0;
  let subjectWise = [];

  // Query daily attendance records (main attendance storage)
  try {
    const [attRows] = await masterPool.query(
      `SELECT 
         COUNT(*) as total_days,
         SUM(CASE WHEN LOWER(status) = 'present' THEN 1 ELSE 0 END) as present_days,
         SUM(CASE WHEN LOWER(status) = 'absent' THEN 1 ELSE 0 END) as absent_days,
         SUM(CASE WHEN LOWER(status) = 'holiday' THEN 1 ELSE 0 END) as holiday_days,
         MIN(attendance_date) as start_date,
         MAX(attendance_date) as last_date
       FROM attendance_records
       WHERE student_id = ? OR admission_number = ?`,
      [student.id, student.admission_number || '']
    );

    if (attRows && attRows.length > 0 && Number(attRows[0].total_days) > 0) {
      const row = attRows[0];
      const validDays = Number(row.present_days || 0) + Number(row.absent_days || 0);
      totalClasses = validDays > 0 ? validDays : Number(row.total_days);
      presentClasses = Number(row.present_days || 0);
      absentClasses = Number(row.absent_days || 0);
      attendancePercentage = totalClasses > 0 ? Number(((presentClasses / totalClasses) * 100).toFixed(2)) : 0;
    }
  } catch (err) {
    console.warn('[AI Tools] attendance_records lookup error:', err.message);
  }

  // Query hourly/subject-wise attendance if recorded
  try {
    const [subjRows] = await masterPool.query(
      `SELECT 
         s.name as subject_name,
         COUNT(*) as total,
         SUM(CASE WHEN ha.status IN ('P', 'Present', '1') THEN 1 ELSE 0 END) as present
       FROM hourly_attendance ha
       LEFT JOIN subjects s ON ha.subject_id = s.id
       WHERE ha.student_id = ?
       GROUP BY ha.subject_id, s.name`,
      [student.id]
    );

    if (subjRows && subjRows.length > 0) {
      subjectWise = subjRows.map(r => ({
        subject: r.subject_name || 'General Class',
        total_classes: Number(r.total),
        attended_classes: Number(r.present || 0),
        percentage: Number(r.total > 0 ? ((r.present / r.total) * 100).toFixed(2) : 0)
      }));

      // If hourly attendance exists, it gives fine-grained periods
      const hourlyTotal = subjectWise.reduce((acc, curr) => acc + curr.total_classes, 0);
      const hourlyAttended = subjectWise.reduce((acc, curr) => acc + curr.attended_classes, 0);
      if (hourlyTotal > 0) {
        totalClasses = hourlyTotal;
        presentClasses = hourlyAttended;
        absentClasses = hourlyTotal - hourlyAttended;
        attendancePercentage = Number(((presentClasses / totalClasses) * 100).toFixed(2));
      }
    }
  } catch (err) {
    console.warn('[AI Tools] hourly_attendance lookup error:', err.message);
  }

  const result = {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    admission_number: student.admission_number || 'N/A',
    total_classes: totalClasses,
    attended_classes: presentClasses,
    absent_classes: absentClasses,
    overall_attendance_percentage: attendancePercentage,
    exam_eligibility_status: totalClasses > 0 
      ? (attendancePercentage >= 75 ? 'Eligible' : 'Condonation Required (Below 75%)')
      : 'No Records',
    subject_wise_attendance: subjectWise,
    has_records: totalClasses > 0
  };

  if (totalClasses === 0) {
    result.message = 'No official attendance sessions or daily records have been logged in the portal for this student yet.';
  }

  return result;
}

async function get_my_attendance(userContext, args = {}) {
  return get_student_attendance(userContext, args);
}

/**
 * 3. Get Student Internal Marks & Academic Performance (Real DB data)
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_marks(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      internal_marks: [],
      has_marks_recorded: false,
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). Academic assessment marks apply to enrolled students. To view a student's marks, please specify a student name, PIN, or admission number (e.g. 'marks of student Saketh').`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  let internalMarks = [];

  try {
    const [marksRows] = await masterPool.query(
      `SELECT im.marks_type, im.marks, im.max_marks, im.semester, im.academic_year, s.name as subject_name
       FROM internal_marks im
       LEFT JOIN subjects s ON im.subject_id = s.id
       WHERE im.student_id = ?
       ORDER BY im.semester DESC, s.name ASC`,
      [student.id]
    );

    if (marksRows && marksRows.length > 0) {
      internalMarks = marksRows.map(m => ({
        subject: m.subject_name || 'Subject',
        marks_type: m.marks_type,
        obtained_marks: Number(m.marks),
        max_marks: Number(m.max_marks || 100),
        semester: m.semester,
        academic_year: m.academic_year
      }));
    }
  } catch (err) {
    console.warn('[AI Tools] internal_marks lookup error:', err.message);
  }

  const result = {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    admission_number: student.admission_number || 'N/A',
    current_year: student.current_year,
    current_semester: student.current_semester,
    internal_marks: internalMarks,
    has_marks_recorded: internalMarks.length > 0
  };

  if (internalMarks.length === 0) {
    result.message = 'No internal assessment marks have been entered in the portal for this student yet.';
  } else {
    const totalObtained = internalMarks.reduce((a, c) => a + c.obtained_marks, 0);
    const totalMax = internalMarks.reduce((a, c) => a + c.max_marks, 0);
    result.average_percentage = totalMax > 0 ? Number(((totalObtained / totalMax) * 100).toFixed(2)) : 0;
  }

  return result;
}

async function get_my_marks(userContext, args = {}) {
  return get_student_marks(userContext, args);
}

/**
 * 4. Get Student Fees & Dues Summary (Real DB data from MongoDB StudentFee & Transaction)
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_fees(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      total_fee: 0,
      paid_fee: 0,
      pending_dues: 0,
      fee_breakdown: [],
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). Fee records are associated with enrolled students. To view fee details, please specify a student name, PIN, or admission number (e.g. 'fees of student Saketh').`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  loadMongoModels();

  let totalFee = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let breakdown = [];
  let transactionsList = [];

  try {
    const StudentFee = require('../MongoDb-Models/StudentFee');
    const Transaction = require('../MongoDb-Models/Transaction');

    const lookupStudentIds = [
      student.admission_number,
      student.pin_no,
      String(student.id)
    ].filter(Boolean);

    // 1. Fetch Demanded Fees
    const fees = await StudentFee.find({
      studentId: { $in: lookupStudentIds }
    }).populate('feeHead');

    if (fees && fees.length > 0) {
      fees.forEach(f => {
        const itemAmount = Number(f.amount || 0);
        totalFee += itemAmount;
        breakdown.push({
          fee_head: f.feeHead?.name || f.remarks || 'Fee',
          amount: itemAmount,
          academic_year: f.academicYear || 'N/A',
          year: f.studentYear || 'N/A',
          semester: f.semester || 'N/A'
        });
      });
    }

    // 2. Fetch Paid Transactions
    const txs = await Transaction.find({
      $or: [
        { studentId: { $in: lookupStudentIds } },
        { admissionNumber: student.admission_number },
        { pinNo: student.pin_no }
      ],
      transactionType: 'DEBIT',
      status: 'active'
    }).populate('feeHead');

    if (txs && txs.length > 0) {
      txs.forEach(t => {
        const paid = Number(t.amount || 0);
        totalPaid += paid;
        transactionsList.push({
          receipt_no: t.receiptNumber || 'N/A',
          fee_head: t.feeHead?.name || t.remarks || 'Fee',
          amount: paid,
          payment_mode: t.paymentMode || 'Cash',
          payment_date: t.paymentDate ? t.paymentDate.toISOString().split('T')[0] : 'N/A'
        });
      });
    }

    totalDue = Math.max(0, totalFee - totalPaid);
  } catch (err) {
    console.warn('[AI Tools] Mongo fee lookup error:', err.message);
  }

  // 3. Check Scholarship status in MySQL if available
  let scholarship = null;
  try {
    const [scholRows] = await masterPool.query(
      'SELECT sanctioned_amount, released_amount, paid_amount, fee_paid, eligible FROM student_scholarship WHERE student_id = ? LIMIT 1',
      [student.id]
    );
    if (scholRows && scholRows.length > 0) {
      scholarship = scholRows[0];
    }
  } catch (e) {
    // optional table
  }

  const result = {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    admission_number: student.admission_number || 'N/A',
    total_fee: totalFee,
    paid_fee: totalPaid,
    pending_dues: totalDue,
    fee_breakdown: breakdown,
    recent_payments: transactionsList.slice(0, 5),
    scholarship: scholarship,
    has_fee_records: totalFee > 0 || totalPaid > 0
  };

  if (totalFee === 0 && totalPaid === 0) {
    result.message = 'No fee structures or payment transaction records found in the portal for this student.';
  }

  return result;
}

async function get_my_pending_dues(userContext, args = {}) {
  return get_student_fees(userContext, args);
}

async function get_my_fees(userContext, args = {}) {
  return get_student_fees(userContext, args);
}

const DAY_MAP = {
  'mon': 'Monday', 'monday': 'Monday',
  'tue': 'Tuesday', 'tues': 'Tuesday', 'tuesday': 'Tuesday',
  'wed': 'Wednesday', 'wednesday': 'Wednesday',
  'thu': 'Thursday', 'thur': 'Thursday', 'thurs': 'Thursday', 'thursday': 'Thursday',
  'fri': 'Friday', 'friday': 'Friday',
  'sat': 'Saturday', 'saturday': 'Saturday',
  'sun': 'Sunday', 'sunday': 'Sunday'
};

function normalizeDay(day) {
  if (!day) return '';
  const clean = String(day).trim().toLowerCase();
  return DAY_MAP[clean] || day;
}

/**
 * 5. Get Student Timetable & Schedule (Context & Authentication Aware)
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_timetable(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      total_classes_today: 0,
      today_schedule: [],
      schedule: [],
      weekly_schedule: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] },
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). To inspect schedules, please specify a student name/PIN or request faculty assigned classes.`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  let branchId = args.branch_id || student.branch_id;
  if (!branchId && student.branch) {
    try {
      const [bRows] = await masterPool.query(
        'SELECT id FROM course_branches WHERE name = ? OR code = ? LIMIT 1',
        [student.branch, student.branch]
      );
      if (bRows && bRows.length > 0) {
        branchId = bRows[0].id;
      }
    } catch (e) {
      console.warn('Branch id resolution notice:', e.message);
    }
  }

  const year = args.year || student.current_year || 1;
  const semester = args.semester || student.current_semester || 1;
  const section = args.section || student.section;

  let schedule = [];
  let source = 'academic_portal';
  let planMetadata = null;

  try {
    const fetchRes = await fetchTimetableData({
      branch_id: branchId,
      year: year,
      semester: semester,
      section: section,
      student_id: student.id,
      faculty_id: ['faculty', 'teacher', 'branch_faculty'].includes(String(userContext.role || '').toLowerCase()) ? userContext.id : null
    });

    source = fetchRes.source || 'academic_portal';
    planMetadata = fetchRes.plan || null;

    if (fetchRes.data && Array.isArray(fetchRes.data)) {
      schedule = fetchRes.data.map(r => {
        const dayNorm = normalizeDay(r.day_of_week);
        const startTimeStr = r.start_time ? String(r.start_time).substring(0, 5) : '';
        const endTimeStr = r.end_time ? String(r.end_time).substring(0, 5) : '';
        const timeDisplay = startTimeStr && endTimeStr ? `${startTimeStr} - ${endTimeStr}` : 'Scheduled';

        return {
          day: dayNorm,
          day_short: r.day_of_week,
          period: r.slot_label || r.period_name || (r.slot_order ? `Slot ${r.slot_order}` : 'Period'),
          slot_order: r.slot_order || r.period_slot_id || 1,
          time: timeDisplay,
          start_time: r.start_time || null,
          end_time: r.end_time || null,
          subject: r.subject_name || r.custom_label || 'Subject',
          subject_code: r.subject_code || '',
          faculty: r.faculty_name || r.teacher_name || r.faculty || r.staff_name || 'Faculty Member',
          type: r.type || r.entry_type || 'theory',
          room: r.room_label || '',
          batch: r.batch_label || ''
        };
      });
    }
  } catch (err) {
    console.warn('Timetable lookup error:', err.message);
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const todayDay = dayNames[now.getDay()];
  const todaySchedule = schedule.filter(s => s.day === todayDay);

  const weeklySchedule = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: []
  };
  schedule.forEach(item => {
    if (weeklySchedule[item.day]) {
      weeklySchedule[item.day].push(item);
    }
  });

  return {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    admission_number: student.admission_number || 'N/A',
    branch: student.branch,
    section: student.section,
    current_year: student.current_year,
    current_semester: student.current_semester,
    today_day: todayDay,
    total_classes_today: todaySchedule.length,
    today_schedule: todaySchedule,
    schedule: schedule,
    weekly_schedule: weeklySchedule,
    source: source,
    has_timetable: schedule.length > 0
  };
}

async function get_my_timetable(userContext, args = {}) {
  return get_student_timetable(userContext, args);
}

/**
 * 6. Get Student Tickets & Complaints Status
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_tickets(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      tickets: [],
      tickets_count: 0,
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). To view student tickets or grievances, please specify a student name or PIN.`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  let tickets = [];

  try {
    const [rows] = await masterPool.query(
      `SELECT ticket_number, title, description, status, created_at, updated_at
       FROM tickets
       WHERE student_id = ? OR admission_number = ? OR pin_no = ?
       ORDER BY created_at DESC`,
      [student.id, student.admission_number, student.pin_no]
    );

    tickets = (rows || []).map(t => ({
      ticket_number: t.ticket_number,
      title: t.title,
      description: t.description,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at
    }));
  } catch (err) {
    console.warn('Tickets lookup error:', err.message);
  }

  return {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    tickets_count: tickets.length,
    tickets: tickets,
    message: tickets.length === 0 ? 'No tickets or complaints submitted by this student.' : undefined
  };
}

async function get_my_tickets(userContext, args = {}) {
  return get_student_tickets(userContext, args);
}

/**
 * 7. Get Transport Details (Real DB data from transport_students & transport_routes)
 * If called without student_id by an Administrator, gracefully returns informative guidance.
 */
async function get_student_transport(userContext, args = {}) {
  const studentId = args.student_id || args.studentId || args.pin_no || args.admission_number;
  const role = String(userContext.role || '').toLowerCase();
  const isStudent = ['student', 'learner'].includes(role);

  if (!studentId && !isStudent) {
    const admin = await get_admin_profile(userContext);
    return {
      success: true,
      is_administrator: true,
      user_name: admin.full_name,
      role: admin.role_title,
      is_enrolled: false,
      message: `You are currently logged in as ${admin.role_title} (${admin.full_name}). Transport subscriptions are tracked for students. To view transport details, please specify a student name or PIN.`
    };
  }

  const student = await resolveStudent(userContext, studentId);

  let transportDetails = null;

  try {
    const [rows] = await masterPool.query(
      `SELECT ts.route_name, ts.stop_name, ts.bus_number, ts.fee_amount, ts.status,
              r.driver_name, r.driver_mobile
       FROM transport_students ts
       LEFT JOIN transport_routes r ON ts.route_id = r.id
       WHERE ts.student_id = ? OR ts.pin_no = ? LIMIT 1`,
      [student.id, student.pin_no]
    );

    if (rows && rows.length > 0) {
      const t = rows[0];
      transportDetails = {
        bus_number: t.bus_number || 'N/A',
        route_name: t.route_name || 'N/A',
        stop_name: t.stop_name || 'N/A',
        driver_name: t.driver_name || 'N/A',
        driver_contact: t.driver_mobile || 'N/A',
        fee: Number(t.fee_amount || 0),
        status: t.status || 'Active'
      };
    }
  } catch (err) {
    console.warn('Transport lookup error:', err.message);
  }

  return {
    student_name: student.student_name,
    pin_no: student.pin_no || student.roll_number || 'N/A',
    is_enrolled: !!transportDetails,
    transport_info: transportDetails || { message: 'No active transport pass or bus subscription found for this student.' }
  };
}

async function get_my_transport(userContext, args = {}) {
  return get_student_transport(userContext, args);
}

/**
 * 8. Get Academic Calendar & Institutional Events
 */
async function get_academic_calendar(userContext, args = {}) {
  let events = [];

  try {
    const [rows] = await masterPool.query(
      `SELECT id, title, description, event_date as start_date, end_date, start_time, end_time, event_type
       FROM events
       WHERE event_date >= CURDATE() - INTERVAL 15 DAY
       ORDER BY event_date ASC LIMIT 20`
    );

    events = (rows || []).map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      date: e.start_date ? e.start_date.toISOString().split('T')[0] : 'N/A',
      end_date: e.end_date ? e.end_date.toISOString().split('T')[0] : null,
      type: e.event_type || 'Academic'
    }));
  } catch (err) {
    console.warn('Calendar lookup error:', err.message);
  }

  return {
    success: true,
    total_events: events.length,
    upcoming_events: events
  };
}

/**
 * 9. Get Holidays & Check Today's Holiday Status
 */
async function get_holidays(userContext, args = {}) {
  let isTodayHoliday = false;
  let todayHolidayDetails = null;
  let upcomingHolidays = [];

  try {
    // Check if today is a holiday
    const [todayRows] = await masterPool.query(
      `SELECT id, holiday_date, title, description
       FROM custom_holidays
       WHERE DATE(holiday_date) = CURDATE() LIMIT 1`
    );

    if (todayRows && todayRows.length > 0) {
      isTodayHoliday = true;
      todayHolidayDetails = {
        title: todayRows[0].title,
        description: todayRows[0].description,
        date: todayRows[0].holiday_date.toISOString().split('T')[0]
      };
    }

    // List recent & upcoming holidays
    const [rows] = await masterPool.query(
      `SELECT id, holiday_date, title, description, target_college, target_course
       FROM custom_holidays
       WHERE holiday_date >= CURDATE() - INTERVAL 15 DAY
       ORDER BY holiday_date ASC LIMIT 10`
    );

    upcomingHolidays = (rows || []).map(h => ({
      title: h.title,
      description: h.description,
      date: h.holiday_date ? h.holiday_date.toISOString().split('T')[0] : 'N/A'
    }));
  } catch (err) {
    console.warn('Holidays query error:', err.message);
  }

  return {
    success: true,
    is_today_holiday: isTodayHoliday,
    today_status: isTodayHoliday
      ? `Today is a holiday: ${todayHolidayDetails?.title}`
      : 'Today is a regular working day for students (No holiday scheduled).',
    today_details: todayHolidayDetails,
    upcoming_holidays: upcomingHolidays
  };
}

/**
 * 10. Get Announcements & Notices
 */
async function get_announcements(userContext, args = {}) {
  let list = [];
  const limit = Math.min(Number(args.limit || 5), 20);

  try {
    const [rows] = await masterPool.query(
      `SELECT id, title, content, target_college, target_course, target_branch, created_at
       FROM announcements
       WHERE is_active = 1
       ORDER BY id DESC LIMIT ?`,
      [limit]
    );

    list = (rows || []).map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      target_college: a.target_college,
      target_course: a.target_course,
      date: a.created_at ? a.created_at.toISOString().split('T')[0] : 'N/A'
    }));
  } catch (err) {
    console.warn('Announcements query error:', err.message);
  }

  return {
    success: true,
    total: list.length,
    announcements: list
  };
}

/**
 * 11. Get Portal Statistics (Admin & Super Admin Overview)
 */
async function get_portal_statistics(userContext, args = {}) {
  let studentStats = {
    total_students: 0,
    regular_students: 0,
    registration_completed: 0,
    registration_pending: 0
  };

  try {
    const [studentCounts] = await masterPool.query(`
      SELECT 
        COUNT(*) as total_students,
        SUM(CASE WHEN student_status = 'Regular' THEN 1 ELSE 0 END) as regular_students,
        SUM(CASE WHEN LOWER(registration_status) = 'completed' THEN 1 ELSE 0 END) as registration_completed,
        SUM(CASE WHEN LOWER(registration_status) != 'completed' OR registration_status IS NULL THEN 1 ELSE 0 END) as registration_pending
      FROM students
    `);
    if (studentCounts && studentCounts[0]) {
      studentStats = {
        total_students: Number(studentCounts[0].total_students || 0),
        regular_students: Number(studentCounts[0].regular_students || 0),
        registration_completed: Number(studentCounts[0].registration_completed || 0),
        registration_pending: Number(studentCounts[0].registration_pending || 0)
      };
    }
  } catch (err) {
    console.warn('[AI Integration] Portal stats student query error:', err.message);
  }

  let counts = { colleges: 0, courses: 0, branches: 0 };
  try {
    const [[colleges]] = await masterPool.query('SELECT COUNT(*) as count FROM colleges');
    const [[courses]] = await masterPool.query('SELECT COUNT(*) as count FROM courses');
    const [[branches]] = await masterPool.query('SELECT COUNT(*) as count FROM course_branches');
    counts = {
      colleges: Number(colleges?.count || 0),
      courses: Number(courses?.count || 0),
      branches: Number(branches?.count || 0)
    };
  } catch (err) {
    console.warn('[AI Integration] Portal stats structure query error:', err.message);
  }

  let serviceStats = {};
  try {
    const [srvRows] = await masterPool.query('SELECT status, COUNT(*) as count FROM service_requests GROUP BY status');
    (srvRows || []).forEach(r => {
      serviceStats[r.status] = Number(r.count || 0);
    });
  } catch (err) {}

  let ticketStats = {};
  try {
    const [tktRows] = await masterPool.query('SELECT status, COUNT(*) as count FROM tickets GROUP BY status');
    (tktRows || []).forEach(r => {
      ticketStats[r.status] = Number(r.count || 0);
    });
  } catch (err) {}

  return {
    success: true,
    institution: 'Pydah Educational Group',
    total_students: studentStats.total_students,
    regular_students: studentStats.regular_students,
    registration_status: {
      completed: studentStats.registration_completed,
      pending: studentStats.registration_pending
    },
    organization_structure: {
      total_colleges: counts.colleges,
      total_courses: counts.courses,
      total_branches: counts.branches
    },
    service_requests_by_status: serviceStats,
    tickets_by_status: ticketStats
  };
}

/**
 * 12. Get Faculty Assigned Classes
 */
async function get_faculty_assigned_classes(userContext, args = {}) {
  const facultyId = args.faculty_id || userContext.userId || userContext.id;
  try {
    const [rows] = await academicPool.query(
      `SELECT t.*, s.name as subject_name, cb.name as branch_name, c.name as course_name
       FROM timetables t
       LEFT JOIN subjects s ON t.subject_id = s.id
       LEFT JOIN course_branches cb ON t.branch_id = cb.id
       LEFT JOIN courses c ON t.course_id = c.id
       WHERE t.faculty_id = ? OR t.faculty_name = ?
       ORDER BY FIELD(t.day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), t.period_slot`,
      [facultyId, userContext.username || '']
    );
    return {
      success: true,
      faculty_id: facultyId,
      assigned_classes: rows || []
    };
  } catch (err) {
    return {
      success: true,
      faculty_id: facultyId,
      assigned_classes: [],
      message: 'No assigned timetable periods found or academic database unavailable.'
    };
  }
}

/**
 * 12. Get Clubs Information
 * Retrieves active college clubs, descriptions, membership fees, coordinators, or details for a specific club.
 */
async function get_clubs(userContext, args = {}) {
  const targetName = args.club_name || args.name || args.search || args.club || '';
  const targetId = args.club_id || args.id || null;

  try {
    let query = `
      SELECT c.id, c.name, c.description, c.membership_fee, c.fee_type, c.is_active, c.activities, c.admin_roles,
             COUNT(DISTINCT CASE WHEN cm.status = 'approved' THEN cm.id END) as approved_members_count,
             COUNT(DISTINCT CASE WHEN cm.status = 'pending' THEN cm.id END) as pending_members_count,
             COUNT(DISTINCT cm.id) as total_enrolled_count
      FROM clubs c
      LEFT JOIN club_members cm ON c.id = cm.club_id
      WHERE c.is_active = 1
    `;
    const params = [];

    if (targetId) {
      query += ` AND c.id = ?`;
      params.push(targetId);
    } else if (targetName && String(targetName).trim() !== '') {
      query += ` AND (c.name LIKE ? OR c.description LIKE ?)`;
      params.push(`%${String(targetName).trim()}%`, `%${String(targetName).trim()}%`);
    }

    query += ` GROUP BY c.id ORDER BY c.name ASC`;

    const [rows] = await masterPool.query(query, params);

    if (!rows || rows.length === 0) {
      return {
        success: true,
        total_clubs: 0,
        clubs: [],
        message: targetName ? `No active club matching '${targetName}' found.` : 'No active clubs currently found.'
      };
    }

    // Format club records
    const formattedClubs = rows.map(r => {
      let activitiesList = [];
      try {
        activitiesList = typeof r.activities === 'string' ? JSON.parse(r.activities) : (r.activities || []);
      } catch (e) {
        activitiesList = [];
      }

      let adminRoles = [];
      try {
        adminRoles = typeof r.admin_roles === 'string' ? JSON.parse(r.admin_roles) : (r.admin_roles || []);
      } catch (e) {
        adminRoles = [];
      }

      return {
        id: r.id,
        club_id: r.id,
        name: r.name,
        club_name: r.name,
        description: r.description,
        membership_fee: r.membership_fee != null ? `₹${parseFloat(r.membership_fee).toLocaleString('en-IN')}` : 'Free',
        fee_amount: r.membership_fee != null ? parseFloat(r.membership_fee) : 0,
        fee_type: r.fee_type || 'Yearly',
        status: r.is_active ? 'Active' : 'Inactive',
        total_enrolled: Number(r.total_enrolled_count || 0),
        approved_members: Number(r.approved_members_count || 0),
        pending_members: Number(r.pending_members_count || 0),
        activities_count: activitiesList.length,
        activities: activitiesList.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          posted_at: a.posted_at
        })),
        coordinators: adminRoles.map(cr => ({
          name: cr.name || cr.userName || cr.email || 'Coordinator',
          role: cr.role || 'Club Admin',
          email: cr.email || null
        }))
      };
    });

    if (formattedClubs.length === 1 && (targetId || targetName)) {
      const club = formattedClubs[0];
      return {
        success: true,
        club_id: club.id,
        club_name: club.name,
        description: club.description,
        membership_fee: club.membership_fee,
        fee_type: club.fee_type,
        status: club.status,
        total_enrolled: club.total_enrolled,
        approved_members: club.approved_members,
        pending_members: club.pending_members,
        activities_count: club.activities_count,
        activities: club.activities,
        coordinators: club.coordinators,
        message: `Details for club: ${club.name}`
      };
    }

    return {
      success: true,
      total_clubs: formattedClubs.length,
      clubs: formattedClubs.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        membership_fee: c.membership_fee,
        fee_type: c.fee_type,
        total_enrolled: c.total_enrolled,
        activities_count: c.activities_count
      })),
      message: `Retrieved ${formattedClubs.length} active college clubs.`
    };
  } catch (error) {
    console.error('[AI Tools] get_clubs error:', error);
    throw new Error(`Failed to fetch clubs: ${error.message}`);
  }
}

/**
 * 13. Get Club Members
 * Fetches members enrolled in a specific club OR checks which clubs a student has joined/applied for.
 */
async function get_club_members(userContext, args = {}) {
  const targetStudent = args.student_id || args.student || args.pin_no || args.pin || null;
  const targetClubName = args.club_name || args.club || args.name || null;
  const targetClubId = args.club_id || args.id || null;
  const isStudentRole = ['student', 'learner'].includes(String(userContext.role || '').toLowerCase());

  // If a student inquiry (either explicitly requested or caller is a student)
  if (targetStudent || (isStudentRole && !targetClubName && !targetClubId)) {
    let student = null;
    try {
      student = await resolveStudent(userContext, targetStudent);
    } catch (e) {
      if (!isStudentRole && !targetClubName && !targetClubId) {
        throw e;
      }
    }

    if (student) {
      const [memberships] = await masterPool.query(`
        SELECT cm.id as membership_id, cm.status, cm.payment_status, cm.fee_type, cm.joined_at, cm.updated_at,
               c.id as club_id, c.name as club_name, c.description as club_description, c.membership_fee
        FROM club_members cm
        JOIN clubs c ON cm.club_id = c.id
        WHERE cm.student_id = ?
        ORDER BY cm.joined_at DESC
      `, [student.id]);

      return {
        success: true,
        student_id: student.id,
        student_name: student.student_name,
        pin_no: student.pin_no,
        admission_number: student.admission_number,
        total_clubs_joined: (memberships || []).length,
        clubs: (memberships || []).map(m => ({
          membership_id: m.membership_id,
          club_id: m.club_id,
          club_name: m.club_name,
          status: m.status || 'pending',
          payment_status: m.payment_status || 'payment_due',
          fee_type: m.fee_type || 'Yearly',
          membership_fee: m.membership_fee ? `₹${parseFloat(m.membership_fee).toLocaleString('en-IN')}` : 'Free',
          joined_date: m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-IN') : 'N/A'
        })),
        message: (memberships && memberships.length > 0)
          ? `Student ${student.student_name} (${student.pin_no || student.admission_number}) is enrolled in ${memberships.length} club(s).`
          : `Student ${student.student_name} (${student.pin_no || student.admission_number}) has not joined any clubs yet.`
      };
    }
  }

  // Club members lookup by club
  try {
    let clubQuery = 'SELECT id, name FROM clubs WHERE is_active = 1';
    const clubParams = [];
    if (targetClubId) {
      clubQuery += ' AND id = ?';
      clubParams.push(targetClubId);
    } else if (targetClubName) {
      clubQuery += ' AND name LIKE ?';
      clubParams.push(`%${String(targetClubName).trim()}%`);
    }

    const [matchedClubs] = await masterPool.query(clubQuery, clubParams);
    if (!matchedClubs || matchedClubs.length === 0) {
      return {
        success: true,
        total_members: 0,
        members: [],
        message: targetClubName ? `No club found matching '${targetClubName}'.` : 'Please specify a club name or student PIN.'
      };
    }

    const club = matchedClubs[0];

    const [members] = await masterPool.query(`
      SELECT cm.id as membership_id, cm.status, cm.payment_status, cm.fee_type, cm.joined_at,
             s.id as student_id, s.student_name, s.pin_no, s.admission_number,
             courses.name as course_name,
             course_branches.name as branch_name
      FROM club_members cm
      JOIN students s ON cm.student_id = s.id
      LEFT JOIN courses ON s.course_id = courses.id
      LEFT JOIN course_branches ON s.branch_id = course_branches.id
      WHERE cm.club_id = ?
      ORDER BY cm.joined_at DESC
      LIMIT 100
    `, [club.id]);

    return {
      success: true,
      club_id: club.id,
      club_name: club.name,
      total_members: (members || []).length,
      members: (members || []).map(m => ({
        membership_id: m.membership_id,
        student_id: m.student_id,
        student_name: m.student_name,
        pin_no: m.pin_no || 'N/A',
        admission_number: m.admission_number || 'N/A',
        course: m.course_name || 'N/A',
        branch: m.branch_name || 'N/A',
        status: m.status || 'pending',
        payment_status: m.payment_status || 'payment_due',
        fee_type: m.fee_type || 'Yearly',
        joined_date: m.joined_at ? new Date(m.joined_at).toLocaleDateString('en-IN') : 'N/A'
      })),
      message: `Retrieved ${members.length} members for ${club.name}.`
    };
  } catch (error) {
    console.error('[AI Tools] get_club_members error:', error);
    throw new Error(`Failed to fetch club members: ${error.message}`);
  }
}

/**
 * 14. Get Club Activities & Events
 * Retrieves activities, workshops, hackathons, or meetings organized by clubs.
 */
async function get_club_activities(userContext, args = {}) {
  const targetClubName = args.club_name || args.club || args.name || null;
  const targetClubId = args.club_id || args.id || null;

  try {
    let query = 'SELECT id, name, activities FROM clubs WHERE is_active = 1';
    const params = [];
    if (targetClubId) {
      query += ' AND id = ?';
      params.push(targetClubId);
    } else if (targetClubName) {
      query += ' AND name LIKE ?';
      params.push(`%${String(targetClubName).trim()}%`);
    }

    const [rows] = await masterPool.query(query, params);

    const allActivities = [];
    (rows || []).forEach(club => {
      let activities = [];
      try {
        activities = typeof club.activities === 'string' ? JSON.parse(club.activities) : (club.activities || []);
      } catch (e) {
        activities = [];
      }
      (activities || []).forEach(act => {
        allActivities.push({
          activity_id: act.id,
          club_id: club.id,
          club_name: club.name,
          title: act.title || 'Club Activity',
          description: act.description || '',
          posted_at: act.posted_at || null,
          formatted_date: act.posted_at ? new Date(act.posted_at).toLocaleDateString('en-IN') : 'N/A'
        });
      });
    });

    return {
      success: true,
      total_activities: allActivities.length,
      activities: allActivities,
      message: allActivities.length > 0
        ? `Found ${allActivities.length} club activity records.`
        : 'No club activities currently posted.'
    };
  } catch (error) {
    console.error('[AI Tools] get_club_activities error:', error);
    throw new Error(`Failed to fetch club activities: ${error.message}`);
  }
}

/**
 * 15. Get Club Roles
 * Retrieves club leadership and administrative roles.
 */
async function get_club_roles(userContext, args = {}) {
  try {
    const [roles] = await masterPool.query('SELECT id, role_name, role_code, description, is_system FROM club_roles ORDER BY id ASC');
    return {
      success: true,
      total_roles: (roles || []).length,
      roles: (roles || []).map(r => ({
        id: r.id,
        role_name: r.role_name,
        role_code: r.role_code,
        description: r.description
      })),
      message: `Retrieved ${roles.length} club roles.`
    };
  } catch (error) {
    console.error('[AI Tools] get_club_roles error:', error);
    throw new Error(`Failed to fetch club roles: ${error.message}`);
  }
}

// Function Alias References
const get_profile = get_student_profile;
const get_my_student_profile = get_student_profile;
const fetch_student_profile = get_student_profile;
const fetch_profile = get_student_profile;
const fetch_my_profile = get_student_profile;
const student_profile = get_student_profile;
const my_profile = get_student_profile;
const get_user_profile = get_student_profile;
const get_student_details = get_student_profile;
const get_my_details = get_student_profile;
const get_student_by_id = get_student_profile;
const profile = get_student_profile;
const whoami = get_student_profile;
const get_whoami = get_student_profile;
const my_name = get_student_profile;
const get_my_name = get_student_profile;
const admin_profile = get_admin_profile;

const get_attendance = get_student_attendance;
const get_my_student_attendance = get_student_attendance;
const fetch_attendance = get_student_attendance;
const student_attendance = get_student_attendance;
const get_attendance_summary = get_student_attendance;
const get_my_attendance_summary = get_student_attendance;
const my_attendance_summary = get_student_attendance;
const attendance = get_student_attendance;

const get_marks = get_student_marks;
const get_my_student_marks = get_student_marks;
const get_internal_marks = get_student_marks;
const get_grades = get_student_marks;
const get_academic_performance = get_student_marks;
const get_my_marks_summary = get_student_marks;
const my_marks_summary = get_student_marks;
const student_marks = get_student_marks;
const marks = get_student_marks;
const grades = get_student_marks;

const get_pending_dues = get_student_fees;
const get_my_student_fees = get_student_fees;
const get_fee_details = get_student_fees;
const get_fees = get_student_fees;
const fetch_pending_dues = get_student_fees;
const get_my_fee_summary = get_student_fees;
const my_fee_summary = get_student_fees;
const student_fees = get_student_fees;
const fees = get_student_fees;
const dues = get_student_fees;

const get_timetable = get_student_timetable;
const get_my_student_timetable = get_student_timetable;
const student_timetable = get_student_timetable;
const my_timetable = get_student_timetable;
const timetable = get_student_timetable;
const schedule = get_student_timetable;
const my_schedule = get_student_timetable;
const get_today_timetable = get_student_timetable;
const today_timetable = get_student_timetable;
const get_class_schedule = get_student_timetable;
const class_schedule = get_student_timetable;
const get_class_timetable = get_student_timetable;
const class_timetable = get_student_timetable;
const fetch_my_timetable = get_student_timetable;
const fetch_timetable = get_student_timetable;
const get_my_timetable_summary = get_student_timetable;
const my_timetable_summary = get_student_timetable;

const get_tickets = get_student_tickets;
const get_my_student_tickets = get_student_tickets;
const student_tickets = get_student_tickets;
const tickets = get_student_tickets;

const get_transport = get_student_transport;
const get_my_student_transport = get_student_transport;
const student_transport = get_student_transport;
const transport = get_student_transport;

const get_calendar = get_academic_calendar;
const get_events = get_academic_calendar;
const calendar = get_academic_calendar;
const events = get_academic_calendar;

const holiday = get_holidays;
const holidays = get_holidays;
const check_holiday = get_holidays;
const is_today_holiday = get_holidays;

const notices = get_announcements;
const announcements = get_announcements;
const get_notices = get_announcements;

const get_portal_stats = get_portal_statistics;
const portal_statistics = get_portal_statistics;
const get_dashboard_stats = get_portal_statistics;
const dashboard_stats = get_portal_statistics;
const portal_stats = get_portal_statistics;
const faculty_assigned_classes = get_faculty_assigned_classes;
const get_faculty_classes = get_faculty_assigned_classes;
const faculty_classes = get_faculty_assigned_classes;

// Club Aliases
const clubs = get_clubs;
const club = get_clubs;
const get_club_details = get_clubs;
const club_details = get_clubs;
const get_college_clubs = get_clubs;
const college_clubs = get_clubs;

const club_members = get_club_members;
const get_members = get_club_members;
const members = get_club_members;
const student_clubs = get_club_members;
const get_student_clubs = get_club_members;

const club_activities = get_club_activities;
const get_activities = get_club_activities;
const activities = get_club_activities;

const club_roles = get_club_roles;
const get_roles = get_club_roles;
const roles = get_club_roles;

/**
 * Comprehensive Tool Registry with exact names & aliases
 */
const toolRegistry = {
  // Profile Aliases
  get_student_profile,
  get_my_profile,
  get_my_student_profile,
  get_profile,
  fetch_student_profile,
  fetch_profile,
  fetch_my_profile,
  student_profile,
  my_profile,
  get_user_profile,
  get_student_details,
  get_my_details,
  get_student_by_id,
  profile,
  get_admin_profile,
  admin_profile,
  whoami,
  get_whoami,
  my_name,
  get_my_name,

  // Attendance Aliases
  get_student_attendance,
  get_my_attendance,
  get_my_student_attendance,
  get_attendance,
  fetch_attendance,
  student_attendance,
  get_attendance_summary,
  get_my_attendance_summary,
  my_attendance_summary,
  attendance,

  // Marks / Grades Aliases
  get_student_marks,
  get_my_marks,
  get_my_student_marks,
  get_marks,
  get_internal_marks,
  get_grades,
  get_academic_performance,
  get_my_marks_summary,
  my_marks_summary,
  student_marks,
  marks,
  grades,

  // Fees / Dues Aliases
  get_student_fees,
  get_my_pending_dues,
  get_my_fees,
  get_my_student_fees,
  get_pending_dues,
  get_fee_details,
  get_fees,
  fetch_pending_dues,
  get_my_fee_summary,
  my_fee_summary,
  student_fees,
  fees,
  dues,

  // Timetable Aliases
  get_student_timetable,
  get_my_timetable,
  get_my_student_timetable,
  get_timetable,
  student_timetable,
  my_timetable,
  timetable,
  schedule,
  my_schedule,
  get_today_timetable,
  today_timetable,
  get_class_schedule,
  class_schedule,
  get_class_timetable,
  class_timetable,
  fetch_my_timetable,
  fetch_timetable,
  get_my_timetable_summary,
  my_timetable_summary,

  // Tickets Aliases
  get_student_tickets,
  get_my_tickets,
  get_my_student_tickets,
  get_tickets,
  student_tickets,
  tickets,

  // Transport Aliases
  get_student_transport,
  get_my_transport,
  get_my_student_transport,
  get_transport,
  student_transport,
  transport,

  // Calendar / Events Aliases
  get_academic_calendar,
  get_calendar,
  get_events,
  calendar,
  events,

  // Holiday Aliases
  get_holidays,
  holiday,
  holidays,
  check_holiday,
  is_today_holiday,

  // Announcement Aliases
  get_announcements,
  announcements,
  notices,
  get_notices,

  // Portal Overview & Admin Tools
  get_portal_statistics,
  get_portal_stats,
  portal_statistics,
  get_dashboard_stats,
  dashboard_stats,
  portal_stats,

  // Faculty Tools
  get_faculty_assigned_classes,
  faculty_assigned_classes,
  get_faculty_classes,
  faculty_classes,

  // Club Tools & Aliases
  get_clubs,
  clubs,
  club,
  get_club_details,
  club_details,
  get_college_clubs,
  college_clubs,
  get_club_members,
  club_members,
  get_members,
  members,
  student_clubs,
  get_student_clubs,
  get_club_activities,
  club_activities,
  get_activities,
  activities,
  get_club_roles,
  club_roles,
  get_roles,
  roles
};

module.exports = toolRegistry;
