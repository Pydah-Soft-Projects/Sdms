const { masterPool } = require('../config/database');
const { getNotificationSetting } = require('../controllers/settingsController');
const { ROLE_LABELS } = require('../constants/rbac');

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

        await masterPool.query(
            `INSERT INTO sms_logs (student_id, mobile_number, message, category, status, message_id)
       VALUES (?, ?, ?, ?, 'Sent', ?)`,
            [recipientId, mobileNumber, fullMessage, category, data ? JSON.stringify(data) : null]
        );
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

exports.createStaffNotification = async ({ userId, title, message, category = 'General' }) => (
    createWebNotification({
        recipientId: userId,
        mobileNumber: 'WEB_STAFF',
        title,
        message,
        category
    })
);

exports.notifyPinUpdates = async (students) => {
    if (!Array.isArray(students) || students.length === 0) return;

    const setting = await getNotificationSetting('pin_update');
    const validRoles = [...Object.keys(ROLE_LABELS), 'admin', 'staff'];
    const recipientRoles = Array.isArray(setting?.recipientRoles)
        ? setting.recipientRoles.filter((role) => validRoles.includes(role))
        : [];
    if (setting?.enabled === false || recipientRoles.length === 0) return;

    const [recipients] = await masterPool.query(
        `SELECT id, role, college_id, course_id, branch_id,
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

        const studentLines = scopedStudents.slice(0, 100).map((student) => (
            `${student.student_name || 'Student'} (${student.admission_number}): ${student.pin_no}`
        ));
        if (scopedStudents.length > studentLines.length) {
            studentLines.push(`...and ${scopedStudents.length - studentLines.length} more student(s).`);
        }

        await exports.createStaffNotification({
            userId: recipient.id,
            title: 'ID Card PIN numbers updated',
            message: `PIN numbers were updated for ${scopedStudents.length} student(s):\n${studentLines.join('\n')}`,
            category: 'ID Card'
        });
    }
};

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
