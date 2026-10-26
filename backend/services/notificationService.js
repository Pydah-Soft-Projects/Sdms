const { masterPool } = require('../config/database');
const { getNotificationSetting } = require('../controllers/settingsController');
const { ROLE_LABELS } = require('../constants/rbac');
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
        const notificationCreated = await exports.createStaffNotification({
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

        if (!notificationCreated) {
            console.error(`Failed to create PIN update notification for staff user ${recipient.id}`);
        }

        if (recipient.email) {
            const groupHtml = Array.from(groups.values()).map((group) => `
                <section style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;">
                    <h3 style="margin:0 0 4px;">${escapeHtml(group.college)}</h3>
                    <p style="margin:0 0 10px;color:#4b5563;">${escapeHtml([group.batch, group.course, group.branch].join(' · '))}</p>
                    <p style="margin:0;">${group.studentCount} student(s) need ID cards issued.</p>
                </section>
            `).join('');

            try {
                console.info(`Sending PIN update email to staff user ${recipient.id} for ${scopedStudents.length} student(s).`);
                const emailResult = await sendBrevoEmail({
                    to: recipient.email,
                    toName: recipient.name || recipient.email,
                    subject: title,
                    htmlContent: `
                        <div style="font-family:Arial,sans-serif;color:#1f2937;line-height:1.5;">
                            <h2>${escapeHtml(title)}</h2>
                            <p>PIN numbers were updated for <strong>${scopedStudents.length}</strong> student(s) within your assigned scope. Please issue their ID cards.</p>
                            ${groupHtml}
                        </div>
                    `
                });
                if (emailResult.success) {
                    console.info(`PIN update email sent successfully to staff user ${recipient.id}.`);
                } else {
                    console.error(`PIN update email failed for staff user ${recipient.id}: ${emailResult.message}`);
                }
            } catch (error) {
                console.error(`PIN update email failed for staff user ${recipient.id}:`, error);
            }
        } else {
            console.warn(`Skipping PIN update email for staff user ${recipient.id}: no email address is configured`);
        }
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
