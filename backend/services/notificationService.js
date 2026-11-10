const { masterPool } = require('../config/database');
const { getNotificationSetting } = require('../controllers/settingsController');
const { ROLE_LABELS, USER_ROLES } = require('../constants/rbac');
const { sendBrevoEmail } = require('../utils/emailService');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[character]));

const parseScopeIds = (value, fallback) => {
    let ids = [];
    try {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        ids = Array.isArray(parsed) ? parsed : parsed == null ? [] : [parsed];
    } catch (error) {
        ids = value == null ? [] : [value];
    }

    return ids.length > 0 ? ids : (fallback == null ? [] : [fallback]);
};

const scopeContains = (studentValue, scopeIds) => (
    scopeIds.length === 0 ||
    (studentValue != null && scopeIds.some((id) => String(id) === String(studentValue)))
);

let tableInitialized = false;
const ensurePinUpdatesTable = async () => {
    if (tableInitialized) return;
    try {
        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS pin_updates_daily_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NULL,
                admission_number VARCHAR(100) NOT NULL,
                student_name VARCHAR(255) NULL,
                pin_no VARCHAR(50) NOT NULL,
                college VARCHAR(255) NULL,
                college_id INT NULL,
                course VARCHAR(255) NULL,
                course_id INT NULL,
                branch VARCHAR(255) NULL,
                branch_id INT NULL,
                batch VARCHAR(100) NULL,
                current_year TINYINT NULL,
                current_semester TINYINT NULL,
                update_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_student_date (admission_number, update_date),
                INDEX idx_update_date (update_date),
                INDEX idx_college (college_id),
                INDEX idx_course (course_id),
                INDEX idx_branch (branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        tableInitialized = true;
    } catch (err) {
        console.error('Failed to ensure pin_updates_daily_log table exists:', err.message);
    }
};

/**
 * Record student PIN updates into the daily log so they can be sent together
 * with the attendance report instead of sending individual emails per student.
 */
const recordPinUpdates = async (students) => {
    if (!Array.isArray(students) || students.length === 0) return;
    await ensurePinUpdatesTable();

    for (const student of students) {
        const pin = String(student.pin_no || '').trim();
        const admission = String(student.admission_number || '').trim();
        if (!pin || !admission) continue;

        try {
            await masterPool.query(`
                INSERT INTO pin_updates_daily_log 
                (student_id, admission_number, student_name, pin_no, college, college_id, course, course_id, branch, branch_id, batch, current_year, current_semester, update_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
                ON DUPLICATE KEY UPDATE 
                    pin_no = VALUES(pin_no),
                    student_name = VALUES(student_name),
                    college = VALUES(college),
                    college_id = VALUES(college_id),
                    course = VALUES(course),
                    course_id = VALUES(course_id),
                    branch = VALUES(branch),
                    branch_id = VALUES(branch_id),
                    batch = VALUES(batch),
                    current_year = VALUES(current_year),
                    current_semester = VALUES(current_semester),
                    created_at = CURRENT_TIMESTAMP
            `, [
                student.id || student.student_id || null,
                admission,
                student.student_name || null,
                pin,
                student.college || null,
                student.college_id || null,
                student.course || null,
                student.course_id || null,
                student.branch || null,
                student.branch_id || null,
                student.batch || null,
                student.current_year || student.year || null,
                student.current_semester || student.semester || null
            ]);
        } catch (logErr) {
            console.error('Failed to log student PIN update to pin_updates_daily_log:', logErr.message);
        }
    }
};

/**
 * Fetch all PIN numbers updated for a given date.
 * Queries pin_updates_daily_log with fallback to audit_logs for completeness.
 */
const getPinUpdatesForDate = async (reportDate) => {
    try {
        await ensurePinUpdatesTable();
        const dateStr = reportDate ? String(reportDate).split('T')[0] : new Date().toISOString().split('T')[0];

        const [rows] = await masterPool.query(`
            SELECT 
                student_id,
                admission_number,
                student_name,
                pin_no,
                college,
                college_id,
                course,
                course_id,
                branch,
                branch_id,
                batch,
                current_year,
                current_semester,
                update_date,
                DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%s+05:30') AS updated_at
            FROM pin_updates_daily_log
            WHERE update_date = ?
            ORDER BY college, course, branch, student_name
        `, [dateStr]);

        const existingAdmissions = new Set(rows.map(r => r.admission_number));

        // Resilient fallback: also check audit_logs for any PIN updates on this date
        try {
            const [auditRows] = await masterPool.query(`
                SELECT 
                    a.entity_id AS admission_number,
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%s+05:30') AS updated_at
                FROM audit_logs a
                WHERE a.entity_type = 'STUDENT'
                  AND DATE(a.created_at) = ?
                  AND (
                    a.action_type = 'UPDATE_PIN_NUMBER'
                    OR (a.action_type = 'UPDATE' AND a.details LIKE '%"pin_no"%')
                  )
            `, [dateStr]);

            const missingAdmissions = [];
            for (const aRow of auditRows) {
                if (aRow.admission_number && !existingAdmissions.has(aRow.admission_number)) {
                    missingAdmissions.push(aRow.admission_number);
                    existingAdmissions.add(aRow.admission_number);
                }
            }

            if (missingAdmissions.length > 0) {
                const [students] = await masterPool.query(`
                    SELECT 
                        s.id AS student_id,
                        s.admission_number,
                        s.student_name,
                        s.pin_no,
                        s.college,
                        s.college_id,
                        s.course,
                        s.course_id,
                        s.branch,
                        s.branch_id,
                        s.batch,
                        s.current_year,
                        s.current_semester,
                        DATE_FORMAT(s.updated_at, '%Y-%m-%dT%H:%i:%s+05:30') AS updated_at
                    FROM students s
                    WHERE s.admission_number IN (${missingAdmissions.map(() => '?').join(',')})
                      AND s.pin_no IS NOT NULL AND TRIM(s.pin_no) != ''
                `, missingAdmissions);

                for (const s of students) {
                    rows.push({
                        ...s,
                        update_date: dateStr
                    });
                }
            }
        } catch (auditErr) {
            console.warn('Fallback audit check for PIN updates skipped:', auditErr.message);
        }

        return rows;
    } catch (error) {
        console.error('Error in getPinUpdatesForDate:', error);
        return [];
    }
};

/**
 * Filter PIN updates by recipient's RBAC scope (college, course, branch)
 */
const filterPinUpdatesByUserScope = (pinUpdates, userScope) => {
    if (!Array.isArray(pinUpdates) || pinUpdates.length === 0) return [];
    if (!userScope || userScope.role === 'super_admin') return pinUpdates;

    return pinUpdates.filter(pin => {
        // College scope check
        if (Array.isArray(userScope.collegeNames) && userScope.collegeNames.length > 0) {
            const EngineeringCollegeName = 'Pydah College of Engineering';
            const isEngineeringUser = userScope.collegeNames.includes(EngineeringCollegeName);
            const isDiplomaPin = 
                (pin.course || '').toLowerCase().includes('diploma') ||
                (pin.course || '').startsWith('DAP') ||
                (pin.course || '').startsWith('DAE') ||
                (pin.college || '').toLowerCase().includes('polytechnic') ||
                pin.college === 'Diploma College';

            if (!userScope.collegeNames.includes(pin.college)) {
                if (isEngineeringUser && isDiplomaPin) {
                    // Allowed for engineering user to access diploma
                } else {
                    return false;
                }
            }
        }

        // Course scope check
        if (!userScope.allCourses && Array.isArray(userScope.courseNames) && userScope.courseNames.length > 0) {
            if (!userScope.courseNames.includes(pin.course)) {
                return false;
            }
        }

        // Branch scope check (HODs)
        if (userScope.role === USER_ROLES.BRANCH_HOD && Array.isArray(userScope.branchNames) && userScope.branchNames.length > 0) {
            if (!userScope.branchNames.includes(pin.branch)) {
                return false;
            }
        }

        return true;
    });
};

/**
 * Generate formatted HTML table for PIN numbers in the exact same format as attendance reports
 */
const generatePinUpdatesTableHtml = (pinUpdates, options = {}) => {
    if (!Array.isArray(pinUpdates) || pinUpdates.length === 0) return '';

    const title = options.title || `Student PIN Numbers Updated Today (${pinUpdates.length})`;
    const attendanceDate = options.attendanceDate || '';

    // Group by College for clarity
    const byCollege = pinUpdates.reduce((acc, pin) => {
        const col = pin.college || 'General';
        if (!acc[col]) acc[col] = [];
        acc[col].push(pin);
        return acc;
    }, {});

    const colleges = Object.keys(byCollege).sort();

    const collegeTables = colleges.map(college => {
        const students = byCollege[college];
        const rowsHtml = students.map((s, idx) => {
            const timeStr = s.updated_at
                ? new Date(s.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
                : '-';
            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; font-family: monospace; font-weight: 600; color: #1e293b;">${escapeHtml(s.admission_number || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; font-family: monospace; font-weight: 700; color: #047857; background-color: #ecfdf5;">${escapeHtml(s.pin_no || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; font-weight: 600; color: #0f172a;">${escapeHtml(s.student_name || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${escapeHtml(s.course || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${escapeHtml(s.branch || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.current_year || s.year || '-'}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.current_semester || s.semester || '-'}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${escapeHtml(s.batch || '-')}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center; font-size: 10px; color: #64748b;">${timeStr}</td>
                </tr>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 20px;">
                ${colleges.length > 1 ? `<h4 style="color: #334155; margin: 10px 0 6px 0; font-size: 13px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">${escapeHtml(college)} (${students.length})</h4>` : ''}
                <table>
                    <thead>
                        <tr>
                            <th style="width: 4%; text-align: center;">#</th>
                            <th style="width: 13%;">Admission No</th>
                            <th style="width: 14%; background-color: #065f46;">PIN Number</th>
                            <th style="width: 21%;">Student Name</th>
                            <th style="width: 12%;">Course</th>
                            <th style="width: 13%;">Branch</th>
                            <th style="width: 5%; text-align: center;">Yr</th>
                            <th style="width: 5%; text-align: center;">Sem</th>
                            <th style="width: 6%; text-align: center;">Batch</th>
                            <th style="width: 7%; text-align: center;">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');

    return `
        <div style="margin-top: 30px; margin-bottom: 25px;">
            <h3 style="color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 6px; margin-bottom: 10px; font-size: 16px;">
                ${escapeHtml(title)}
            </h3>
            
            <div style="margin-bottom: 12px; font-size: 11px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; padding: 8px 12px; border-radius: 6px;">
                <strong>🆔 PIN Updates Summary:</strong> <strong>${pinUpdates.length}</strong> student PIN number(s) were assigned/updated today${attendanceDate ? ` (${attendanceDate})` : ''}. Details are tabulated below in synchronization with attendance records for ID card issuance and academic administration.
            </div>

            ${collegeTables}
        </div>
    `;
};

/**
 * Generate formatted HTML card for PIN numbers to be included in attendance report notification emails
 */
const generatePinUpdatesCardHtml = (pinUpdates, options = {}) => {
    if (!Array.isArray(pinUpdates) || pinUpdates.length === 0) return '';
    const formattedDate = options.formattedDate || '';

    const rowsHtml = pinUpdates.map((s, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 6px 8px; text-align: center; font-size: 12px; color: #64748b;">${idx + 1}</td>
            <td style="padding: 6px 8px; font-family: monospace; font-size: 12px; font-weight: 600; color: #1e293b;">${escapeHtml(s.admission_number || '-')}</td>
            <td style="padding: 6px 8px; font-family: monospace; font-size: 12px; font-weight: 700; color: #047857; background-color: #ecfdf5;">${escapeHtml(s.pin_no || '-')}</td>
            <td style="padding: 6px 8px; font-size: 12px; font-weight: 600; color: #0f172a;">${escapeHtml(s.student_name || '-')}</td>
            <td style="padding: 6px 8px; font-size: 12px; color: #334155;">${escapeHtml(s.course || '-')} - ${escapeHtml(s.branch || '-')}</td>
            <td style="padding: 6px 8px; text-align: center; font-size: 12px; color: #475569;">${s.current_year || s.year || '-'}/${s.current_semester || s.semester || '-'}</td>
        </tr>
    `).join('');

    return `
        <div style="background: #ffffff; border: 2px solid #0d6efd; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
                <h3 style="color: #0d6efd; margin: 0; font-size: 15px;">
                    🆔 Student PIN Numbers Updated (${pinUpdates.length})
                </h3>
                ${formattedDate ? `<span style="font-size: 11px; color: #64748b;">${escapeHtml(formattedDate)}</span>` : ''}
            </div>
            <p style="margin: 0 0 12px 0; color: #475569; font-size: 13px;">
                The following <strong>${pinUpdates.length}</strong> student PIN number(s) have been assigned/updated today. Details are tabulated below:
            </p>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <thead>
                        <tr style="background-color: #1e293b; color: #ffffff;">
                            <th style="padding: 8px; text-align: center; font-size: 11px; width: 6%;">#</th>
                            <th style="padding: 8px; text-align: left; font-size: 11px; width: 20%;">Admission No</th>
                            <th style="padding: 8px; text-align: left; font-size: 11px; width: 20%; background-color: #065f46;">PIN Number</th>
                            <th style="padding: 8px; text-align: left; font-size: 11px; width: 24%;">Student Name</th>
                            <th style="padding: 8px; text-align: left; font-size: 11px; width: 20%;">Course & Branch</th>
                            <th style="padding: 8px; text-align: center; font-size: 11px; width: 10%;">Yr/Sem</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};


const createWebNotification = async ({
    recipientId,
    mobileNumber,
    title,
    message,
    category = 'General',
    data = null
}) => {
    try {
        const fullMessage = title ? `**${title}**\n${message}` : message;

        try {
            await masterPool.query(
                `INSERT INTO sms_logs (student_id, mobile_number, message, category, status, notification_data)
         VALUES (?, ?, ?, ?, 'Sent', ?)`,
                [recipientId, mobileNumber, fullMessage, category, data ? JSON.stringify(data) : null]
            );
        } catch (error) {
            if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;

            console.warn('sms_logs.notification_data is missing; saving notification without structured data until migration is applied.');
            await masterPool.query(
                `INSERT INTO sms_logs (student_id, mobile_number, message, category, status, message_id)
         VALUES (?, ?, ?, ?, 'Sent', NULL)`,
                [recipientId, mobileNumber, fullMessage, category]
            );
        }
        return true;
    } catch (error) {
        console.error('Error creating web notification:', error);
        return false;
    }
};

/**
 * Create a web notification
 * @param {Object} params
 * @param {number|string} params.studentId - Recipient Student ID
 * @param {string} params.title - Short title
 * @param {string} params.message - Content
 * @param {string} params.category - Category (e.g., Attendance, Event, Service)
 */
exports.createNotification = async ({ studentId, title, message, category = 'General', data = null }) => {
    const created = await createWebNotification({
        recipientId: studentId,
        mobileNumber: 'WEB',
        title,
        message,
        category,
        data
    });
    if (created) {
        console.log(`🔔 Notification created for Student ${studentId}: ${title}`);
    }
    return created;
};

exports.createStaffNotification = async ({ userId, title, message, category = 'General', data = null }) => (
    createWebNotification({
        recipientId: userId,
        mobileNumber: 'WEB_STAFF',
        title,
        message,
        category,
        data
    })
);

exports.notifyPinUpdates = async (students) => {
    if (!Array.isArray(students) || students.length === 0) return;

    // 1. Record PIN updates in the daily log so they are included with the attendance report email
    await recordPinUpdates(students);

    // 2. In-app staff notifications (for dashboard bell alerts)
    const setting = await getNotificationSetting('pin_update');
    const validRoles = [...Object.keys(ROLE_LABELS), 'admin', 'staff'];
    const recipientRoles = Array.isArray(setting?.recipientRoles)
        ? setting.recipientRoles.filter((role) => validRoles.includes(role))
        : [];
    if (setting?.enabled === false || recipientRoles.length === 0) return;

    const [recipients] = await masterPool.query(
        `SELECT id, name, email, role, college_id, course_id, branch_id,
                college_ids, course_ids, branch_ids, all_courses, all_branches
         FROM rbac_users
         WHERE is_active = 1 AND LOWER(TRIM(role)) IN (?)`,
        [recipientRoles]
    );

    for (const recipient of recipients) {
        const collegeIds = parseScopeIds(recipient.college_ids, recipient.college_id);
        const courseIds = parseScopeIds(recipient.course_ids, recipient.course_id);
        const branchIds = parseScopeIds(recipient.branch_ids, recipient.branch_id);
        const scopedStudents = students.filter((student) => (
            scopeContains(student.college_id, collegeIds) &&
            (recipient.all_courses || scopeContains(student.course_id, courseIds)) &&
            (recipient.all_branches || scopeContains(student.branch_id, branchIds))
        ));

        if (scopedStudents.length === 0) continue;

        const groups = new Map();
        for (const student of scopedStudents) {
            const group = {
                college: student.college || (student.college_id ? `College ${student.college_id}` : 'Unassigned College'),
                batch: student.batch || 'Unassigned Batch',
                course: student.course || (student.course_id ? `Course ${student.course_id}` : 'Unassigned Course'),
                branch: student.branch || (student.branch_id ? `Branch ${student.branch_id}` : 'Unassigned Branch')
            };
            const groupKey = [group.college, group.batch, group.course, group.branch].join('|');
            if (!groups.has(groupKey)) groups.set(groupKey, { ...group, studentCount: 0 });
            groups.get(groupKey).studentCount += 1;
        }

        const title = 'ID Card PIN numbers updated';
        const message = `PIN numbers were updated for ${scopedStudents.length} student(s). Issue their ID cards by group below.`;
        await exports.createStaffNotification({
            userId: recipient.id,
            title,
            message,
            category: 'ID Card',
            data: {
                type: 'pin_update',
                totalStudents: scopedStudents.length,
                groups: Array.from(groups.values()),
                students: scopedStudents.map((student) => ({
                    name: student.student_name || '',
                    admissionNumber: student.admission_number || '',
                    pinNumber: student.pin_no || '',
                    college: student.college || '',
                    batch: student.batch || '',
                    course: student.course || '',
                    branch: student.branch || ''
                }))
            }
        });

        // NOTE: Individual emails are NO LONGER sent per student/update.
        // Instead, PIN updates are aggregated and sent along with the attendance report
        // in a clean, comprehensive table format.
    }
};

exports.recordPinUpdates = recordPinUpdates;
exports.getPinUpdatesForDate = getPinUpdatesForDate;
exports.filterPinUpdatesByUserScope = filterPinUpdatesByUserScope;
exports.generatePinUpdatesTableHtml = generatePinUpdatesTableHtml;
exports.generatePinUpdatesCardHtml = generatePinUpdatesCardHtml;

/**
 * Create broadcast notification for multiple students
 * @param {Array<number>} studentIds
 * @param {Object} params
 */
exports.createBroadcastNotification = async (studentIds, { title, message, category }) => {
    if (!studentIds || studentIds.length === 0) return;

    try {
        // Bulk insert could be better, but simple loop is safer for now
        for (const studentId of studentIds) {
            await exports.createNotification({ studentId, title, message, category });
        }
    } catch (error) {
        console.error('Error broadcasting notifications:', error);
    }
};
