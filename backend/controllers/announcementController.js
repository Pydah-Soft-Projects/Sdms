const { masterPool } = require('../config/database');
const { parseTargetsFromRow, matchesStudent } = require('../services/targetingService');

const smsService = require('../services/smsService');
const pushController = require('./pushController');
const fs = require('fs');

// Helper to delete local file
const deleteLocalFile = (path) => {
    if (path && fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
};

// Ensure expires_at column exists in announcements table
(async () => {
    try {
        const [cols] = await masterPool.query("SHOW COLUMNS FROM announcements LIKE 'expires_at'");
        if (cols.length === 0) {
            await masterPool.query("ALTER TABLE announcements ADD COLUMN expires_at DATETIME DEFAULT NULL AFTER audience_count");
            console.log('✅ Added expires_at column to announcements table');
        }
    } catch (e) {
        console.error('Error checking expires_at column:', e.message);
    }
})();

exports.createAnnouncement = async (req, res) => {
    let localFilePath = null;
    try {
        const {
            title,
            content,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            expires_at,
            requires_registration,
            max_seats,
            registration_deadline,
            custom_registration_field,
            registration_form_fields
        } = req.body;

        const createdBy = req.user?.id || 1;

        const reqReg = (requires_registration === '1' || requires_registration === 1 || requires_registration === true || requires_registration === 'true') ? 1 : 0;
        const parsedMaxSeats = reqReg && max_seats && parseInt(max_seats, 10) > 0 ? parseInt(max_seats, 10) : null;
        const parsedRegDeadline = reqReg && registration_deadline && registration_deadline !== 'null' ? registration_deadline : null;
        const customField = reqReg && custom_registration_field && custom_registration_field.trim() ? custom_registration_field.trim() : null;

        let parsedFormFields = null;
        if (reqReg && registration_form_fields) {
            if (typeof registration_form_fields === 'string') {
                try {
                    JSON.parse(registration_form_fields);
                    parsedFormFields = registration_form_fields;
                } catch (e) {
                    parsedFormFields = null;
                }
            } else if (Array.isArray(registration_form_fields)) {
                parsedFormFields = JSON.stringify(registration_form_fields);
            }
        }

        let imageUrl = null;

        // Handle Image Upload
        if (req.file) {
            localFilePath = req.file.path;
            const fileData = fs.readFileSync(localFilePath);
            const base64Image = fileData.toString('base64');
            const mimeType = req.file.mimetype;
            imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        // Calculate audience count first
        let countQuery = 'SELECT COUNT(*) as count FROM students WHERE student_status = "Regular"';
        const queryParams = [];

        const parseParam = (val) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.length ? val : null;
            try { const parsed = JSON.parse(val); return parsed.length ? parsed : null; } catch (e) { return null; }
        };

        const colleges = parseParam(target_college);
        const batches = parseParam(target_batch);
        const courses = parseParam(target_course);
        const branches = parseParam(target_branch);
        const years = parseParam(target_year);
        const semesters = parseParam(target_semester);

        if (colleges) { countQuery += ' AND college IN (?)'; queryParams.push(colleges); }
        if (batches) { countQuery += ' AND batch IN (?)'; queryParams.push(batches); }
        if (courses) { countQuery += ' AND course IN (?)'; queryParams.push(courses); }
        if (branches) { countQuery += ' AND branch IN (?)'; queryParams.push(branches); }
        if (years) { countQuery += ' AND current_year IN (?)'; queryParams.push(years); }
        if (semesters) { countQuery += ' AND current_semester IN (?)'; queryParams.push(semesters); }

        const [countRow] = await masterPool.query(countQuery, queryParams);
        const audienceCount = countRow[0].count;

        const parsedExpiresAt = expires_at && expires_at !== 'null' ? expires_at : null;

        const [result] = await masterPool.query(
            `INSERT INTO announcements 
            (title, content, image_url, target_college, target_batch, target_course, target_branch, target_year, target_semester, created_by, audience_count, expires_at, requires_registration, max_seats, registration_deadline, custom_registration_field, registration_form_fields) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                content,
                imageUrl,
                target_college || null,
                target_batch || null,
                target_course || null,
                target_branch || null,
                target_year || null,
                target_semester || null,
                createdBy,
                audienceCount,
                parsedExpiresAt,
                reqReg,
                parsedMaxSeats,
                parsedRegDeadline,
                customField,
                parsedFormFields
            ]
        );

        // Trigger Push Notifications (Background)
        (async () => {
            try {
                if (audienceCount === 0) return;

                // For large lists, we skip the memory-heavy id fetching if we can,
                // but since sendBatchNotification needs IDs, we fetch them efficiently.
                let idQuery = 'SELECT id FROM students WHERE student_status = "Regular"';
                if (colleges) idQuery += ' AND college IN (?)';
                if (batches) idQuery += ' AND batch IN (?)';
                if (courses) idQuery += ' AND course IN (?)';
                if (branches) idQuery += ' AND branch IN (?)';
                if (years) idQuery += ' AND current_year IN (?)';
                if (semesters) idQuery += ' AND current_semester IN (?)';

                const [students] = await masterPool.query(idQuery, queryParams);
                const userIds = students.map(s => s.id);

                if (userIds.length > 0) {
                    await pushController.sendBatchNotification(userIds, {
                        title: `New Announcement: ${title}`,
                        body: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
                        icon: '/icon-192x192.png',
                        data: { url: '/student/announcements' }
                    });
                }
            } catch (err) {
                console.error('Push notification trigger error:', err);
            }
        })();

        res.status(201).json({
            success: true,
            message: 'Announcement created successfully',
            data: { id: result.insertId, title, imageUrl, audience_count: audienceCount }
        });

    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement' });
    } finally {
        if (localFilePath) deleteLocalFile(localFilePath);
    }
};

exports.getAnnouncements = async (req, res) => {
    try {
        // Admin View: Get all or filter
        const { college, course, branch } = req.query;
        let query = `
            SELECT 
                a.id,
                a.title,
                a.content,
                (a.image_url IS NOT NULL AND a.image_url != '') as has_image,
                CASE WHEN a.image_url LIKE 'http%' THEN a.image_url ELSE NULL END as external_image_url,
                a.target_college,
                a.target_batch,
                a.target_course,
                a.target_branch,
                a.target_year,
                a.target_semester,
                a.created_by,
                a.audience_count,
                a.is_active,
                a.expires_at,
                a.requires_registration,
                a.max_seats,
                a.registration_deadline,
                a.custom_registration_field,
                a.registration_form_fields,
                a.created_at,
                a.updated_at,
                u.username as created_by_name,
                COALESCE(reg.registered_count, 0) as registered_count
            FROM announcements a
            LEFT JOIN admins u ON a.created_by = u.id
            LEFT JOIN (
                SELECT announcement_id, COUNT(*) as registered_count 
                FROM announcement_registrations 
                WHERE status = 'confirmed' 
                GROUP BY announcement_id
            ) reg ON a.id = reg.announcement_id
            WHERE 1=1
        `;
        const params = [];

        if (college) {
            query += ' AND (a.target_college = ? OR a.target_college IS NULL)';
            params.push(college);
        }
        // Additional filters can be added here

        query += ' ORDER BY a.created_at DESC';

        const [rows] = await masterPool.query(query, params);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const data = rows.map(ann => {
            const registeredCount = Number(ann.registered_count || 0);
            const maxSeats = ann.max_seats ? Number(ann.max_seats) : null;
            const availableSeats = maxSeats !== null ? Math.max(0, maxSeats - registeredCount) : null;
            const isFull = maxSeats !== null ? registeredCount >= maxSeats : false;

            let parsedFields = [];
            if (ann.registration_form_fields) {
                try {
                    parsedFields = typeof ann.registration_form_fields === 'string'
                        ? JSON.parse(ann.registration_form_fields)
                        : ann.registration_form_fields;
                } catch (e) {
                    parsedFields = [];
                }
            }

            return {
                ...ann,
                registration_form_fields: parsedFields,
                registered_count: registeredCount,
                max_seats: maxSeats,
                available_seats: availableSeats,
                is_full: isFull,
                image_url: ann.external_image_url || (ann.has_image ? `${baseUrl}/api/announcements/${ann.id}/image` : null)
            };
        });

        res.json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
};


exports.getStudentAnnouncements = async (req, res) => {
    try {
        const { admission_number, admissionNumber, id } = req.user || {};
        const studentAdmNum = admission_number || admissionNumber;
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = parseInt(req.query.offset, 10) || 0;

        let student = null;
        if (studentAdmNum || id) {
            const [studentRows] = await masterPool.query(
                'SELECT college, course, branch, batch, current_year, current_semester, student_status FROM students WHERE admission_number = ? OR admission_no = ? OR id = ? LIMIT 1',
                [studentAdmNum || '', studentAdmNum || '', id || 0]
            );
            if (studentRows && studentRows.length > 0) {
                student = studentRows[0];
            }
        }

        // Only block if student status is explicitly inactive/suspended
        if (student && student.student_status && ['inactive', 'suspended', 'dropped', 'discontinued'].includes(String(student.student_status).trim().toLowerCase())) {
            return res.json({ success: true, data: [], hasMore: false });
        }

        // Fetch active announcements (order by created_at DESC)
        const [rows] = await masterPool.query(
            `SELECT 
                a.id, 
                a.title, 
                a.content, 
                (a.image_url IS NOT NULL AND a.image_url != "") as has_image, 
                a.created_at, 
                a.expires_at, 
                a.requires_registration,
                a.max_seats,
                a.registration_deadline,
                a.custom_registration_field,
                a.registration_form_fields,
                a.is_active, 
                a.target_college, 
                a.target_batch, 
                a.target_course, 
                a.target_branch, 
                a.target_year, 
                a.target_semester,
                COALESCE(reg.registered_count, 0) as registered_count,
                my_reg.id as my_registration_id,
                my_reg.status as my_registration_status,
                my_reg.registered_at as my_registered_at,
                my_reg.custom_field_value as my_custom_response,
                my_reg.form_responses as my_form_responses
            FROM announcements a
            LEFT JOIN (
                SELECT announcement_id, COUNT(*) as registered_count 
                FROM announcement_registrations 
                WHERE status = 'confirmed' 
                GROUP BY announcement_id
            ) reg ON a.id = reg.announcement_id
            LEFT JOIN announcement_registrations my_reg 
                ON a.id = my_reg.announcement_id 
                AND my_reg.student_id = ? 
                AND my_reg.status = 'confirmed'
            WHERE a.is_active = 1 
            ORDER BY a.created_at DESC`,
            [student ? student.id : 0]
        );

        let matchedAnnouncements = rows;
        if (student) {
            const filtered = rows.filter(ann => {
                const targets = parseTargetsFromRow(ann);
                return matchesStudent(student, targets);
            });
            // If student matches specific announcements, use them; if none matched specific filters, fallback to all active to avoid empty state
            matchedAnnouncements = filtered.length > 0 ? filtered : rows;
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const pagedData = matchedAnnouncements.slice(offset, offset + limit).map(ann => {
            const registeredCount = Number(ann.registered_count || 0);
            const maxSeats = ann.max_seats ? Number(ann.max_seats) : null;
            const availableSeats = maxSeats !== null ? Math.max(0, maxSeats - registeredCount) : null;
            const isFull = maxSeats !== null ? registeredCount >= maxSeats : false;

            let parsedFields = [];
            if (ann.registration_form_fields) {
                try {
                    parsedFields = typeof ann.registration_form_fields === 'string'
                        ? JSON.parse(ann.registration_form_fields)
                        : ann.registration_form_fields;
                } catch (e) {
                    parsedFields = [];
                }
            }

            let myResponses = {};
            if (ann.my_form_responses) {
                try {
                    myResponses = typeof ann.my_form_responses === 'string'
                        ? JSON.parse(ann.my_form_responses)
                        : ann.my_form_responses;
                } catch (e) {
                    myResponses = {};
                }
            }

            return {
                ...ann,
                registration_form_fields: parsedFields,
                registered_count: registeredCount,
                max_seats: maxSeats,
                available_seats: availableSeats,
                is_full: isFull,
                is_registered: Boolean(ann.my_registration_id),
                my_registration: ann.my_registration_id ? {
                    id: ann.my_registration_id,
                    registered_at: ann.my_registered_at,
                    custom_field_value: ann.my_custom_response,
                    form_responses: myResponses
                } : null,
                image_url: ann.has_image ? `${baseUrl}/api/announcements/${ann.id}/image` : null
            };
        });

        res.json({
            success: true,
            data: pagedData,
            total: matchedAnnouncements.length,
            hasMore: matchedAnnouncements.length > offset + limit
        });

    } catch (error) {
        console.error('Get student announcements error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
};

exports.calculateRecipientCount = async (req, res) => {
    try {
        const { target_type, selected_student_ids, target_college, target_batch, target_status, target_course, target_branch, target_year, target_semester } = req.body;

        const parseParam = (val) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.length ? val : null;
            try {
                const parsed = JSON.parse(val);
                return parsed.length ? parsed : null;
            } catch (e) { return null; }
        };

        const studentIds = parseParam(selected_student_ids);
        const statuses = parseParam(target_status);

        if (target_type === 'individual' && studentIds) {
            let indQuery = 'SELECT COUNT(*) as count FROM students WHERE 1=1 AND id IN (?)';
            const indParams = [studentIds];
            if (statuses && statuses.length > 0) {
                indQuery += ' AND student_status IN (?)';
                indParams.push(statuses);
            } else {
                indQuery += ' AND student_status = "Regular"';
            }
            const [rows] = await masterPool.query(indQuery, indParams);
            return res.json({ success: true, count: rows[0].count });
        }

        // Build dynamic query
        let query = 'SELECT COUNT(*) as count FROM students WHERE 1=1';
        const params = [];

        if (statuses && statuses.length > 0) {
            query += ' AND student_status IN (?)';
            params.push(statuses);
        } else {
            query += ' AND student_status = "Regular"';
        }

        const colleges = parseParam(target_college);
        const batches = parseParam(target_batch);
        const courses = parseParam(target_course);
        const branches = parseParam(target_branch);
        const years = parseParam(target_year);
        const semesters = parseParam(target_semester);

        if (colleges) { query += ' AND college IN (?)'; params.push(colleges); }
        if (batches) { query += ' AND batch IN (?)'; params.push(batches); }
        if (courses) {
            query += ' AND course IN (?)'; params.push(courses);
        }
        if (branches) { query += ' AND branch IN (?)'; params.push(branches); }
        if (years) { query += ' AND current_year IN (?)'; params.push(years); }
        if (semesters) { query += ' AND current_semester IN (?)'; params.push(semesters); }

        const [rows] = await masterPool.query(query, params);
        res.json({ success: true, count: rows[0].count });

    } catch (error) {
        console.error('Count calculation error:', error);
        res.status(500).json({ success: false, count: 0 });
    }
};

exports.updateAnnouncement = async (req, res) => {
    let localFilePath = null;
    try {
        const { id } = req.params;
        const {
            title,
            content,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            existing_image_url,
            expires_at,
            requires_registration,
            max_seats,
            registration_deadline,
            custom_registration_field,
            registration_form_fields
        } = req.body;

        const reqReg = (requires_registration === '1' || requires_registration === 1 || requires_registration === true || requires_registration === 'true') ? 1 : 0;
        const parsedMaxSeats = reqReg && max_seats && parseInt(max_seats, 10) > 0 ? parseInt(max_seats, 10) : null;
        const parsedRegDeadline = reqReg && registration_deadline && registration_deadline !== 'null' ? registration_deadline : null;
        const customField = reqReg && custom_registration_field && custom_registration_field.trim() ? custom_registration_field.trim() : null;

        let parsedFormFields = null;
        if (reqReg && registration_form_fields) {
            if (typeof registration_form_fields === 'string') {
                try {
                    JSON.parse(registration_form_fields);
                    parsedFormFields = registration_form_fields;
                } catch (e) {
                    parsedFormFields = null;
                }
            } else if (Array.isArray(registration_form_fields)) {
                parsedFormFields = JSON.stringify(registration_form_fields);
            }
        }

        let imageClause = '';
        const imageParam = [];

        if (req.file) {
            localFilePath = req.file.path;
            const fileData = fs.readFileSync(localFilePath);
            const base64Image = fileData.toString('base64');
            const mimeType = req.file.mimetype;
            imageClause = 'image_url = ?, ';
            imageParam.push(`data:${mimeType};base64,${base64Image}`);
        } else if (!existing_image_url) {
            // User explicitly removed the image
            imageClause = 'image_url = NULL, ';
        }

        // Calculate audience count
        let countQuery = 'SELECT COUNT(*) as count FROM students WHERE student_status = "Regular"';
        const queryParams = [];

        const parseParam = (val) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.length ? val : null;
            try { const parsed = JSON.parse(val); return parsed.length ? parsed : null; } catch (e) { return null; }
        };

        const colleges = parseParam(target_college);
        const batches = parseParam(target_batch);
        const courses = parseParam(target_course);
        const branches = parseParam(target_branch);
        const years = parseParam(target_year);
        const semesters = parseParam(target_semester);

        if (colleges) { countQuery += ' AND college IN (?)'; queryParams.push(colleges); }
        if (batches) { countQuery += ' AND batch IN (?)'; queryParams.push(batches); }
        if (courses) { countQuery += ' AND course IN (?)'; queryParams.push(courses); }
        if (branches) { countQuery += ' AND branch IN (?)'; queryParams.push(branches); }
        if (years) { countQuery += ' AND current_year IN (?)'; queryParams.push(years); }
        if (semesters) { countQuery += ' AND current_semester IN (?)'; queryParams.push(semesters); }

        const [countRow] = await masterPool.query(countQuery, queryParams);
        const audienceCount = countRow[0].count;

        const parsedExpiresAt = expires_at && expires_at !== 'null' ? expires_at : null;

        await masterPool.query(
            `UPDATE announcements SET 
                title = ?, 
                content = ?, 
                ${imageClause}
                target_college = ?, 
                target_batch = ?, 
                target_course = ?, 
                target_branch = ?, 
                target_year = ?, 
                target_semester = ?,
                audience_count = ?,
                expires_at = ?,
                requires_registration = ?,
                max_seats = ?,
                registration_deadline = ?,
                custom_registration_field = ?,
                registration_form_fields = ?
            WHERE id = ?`,
            [
                title,
                content,
                ...imageParam,
                target_college || null,
                target_batch || null,
                target_course || null,
                target_branch || null,
                target_year || null,
                target_semester || null,
                audienceCount,
                parsedExpiresAt,
                reqReg,
                parsedMaxSeats,
                parsedRegDeadline,
                customField,
                parsedFormFields,
                id
            ]
        );

        res.json({ success: true, message: 'Announcement updated', audience_count: audienceCount });

    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to update announcement' });
    } finally {
        if (localFilePath && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        await masterPool.query(
            'UPDATE announcements SET is_active = ? WHERE id = ?',
            [is_active, id]
        );

        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM announcements WHERE id = ?', [id]);
        res.json({ success: true, message: 'Announcement deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete announcement' });
    }
};

// Metadata functions
exports.getBranches = async (req, res) => {
    try {
        const [rows] = await masterPool.query('SELECT DISTINCT branch, course FROM students WHERE branch IS NOT NULL AND branch != "" ORDER BY branch');
        // Return structured data: { name: 'BranchName', course_id: 'CourseName' } 
        // Note: Students table stores course NAME in 'course' column usually.
        // We'll map course name to "courseId" for frontend filtering simulation basically
        // Or better yet, just return the name and let frontend filter by string matching?
        // Frontend expects { value, label, courseId }.
        // We'll assume 'course' column holds the Course Name.
        const branches = rows.map(r => ({
            name: r.branch,
            course_id: r.course // Using course name as ID for filtering since frontend logic uses strings/ids
        }));
        res.json({ success: true, data: branches });
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ success: false, data: [] });
    }
};

exports.getBatches = async (req, res) => {
    try {
        const [rows] = await masterPool.query('SELECT DISTINCT batch FROM students WHERE batch IS NOT NULL AND batch != "" ORDER BY batch DESC');
        const batches = rows.map(r => ({ name: r.batch }));
        res.json({ success: true, data: batches });
    } catch (error) {
        console.error('Get batches error:', error);
        res.status(500).json({ success: false, data: [] });
    }
};

exports.getYears = async (req, res) => {
    try {
        // Return year associated with batch to allow filtering
        const [rows] = await masterPool.query('SELECT DISTINCT current_year, batch FROM students WHERE current_year IS NOT NULL ORDER BY current_year');
        const years = rows.map(r => ({ name: String(r.current_year), batch_id: r.batch }));
        res.json({ success: true, data: years });
    } catch (error) {
        console.error('Get years error:', error);
        res.status(500).json({ success: false, data: [] });
    }
};

exports.getSemesters = async (req, res) => {
    try {
        const [rows] = await masterPool.query('SELECT DISTINCT current_semester, batch FROM students WHERE current_semester IS NOT NULL ORDER BY current_semester');
        const semesters = rows.map(r => ({ name: String(r.current_semester), batch_id: r.batch }));
        res.json({ success: true, data: semesters });
    } catch (error) {
        console.error('Get semesters error:', error);
        res.status(500).json({ success: false, data: [] });
    }
};

exports.getStatuses = async (req, res) => {
    try {
        const [rows] = await masterPool.query(
            'SELECT DISTINCT student_status FROM students WHERE student_status IS NOT NULL AND student_status != "" ORDER BY student_status'
        );
        const statuses = rows.map(r => ({ value: r.student_status, label: r.student_status }));
        res.json({ success: true, data: statuses });
    } catch (error) {
        console.error('Get statuses error:', error);
        res.status(500).json({ success: false, data: [] });
    }
};

exports.sendSMSAnnouncement = async (req, res) => {
    try {
        const {
            template_id,
            template_content,
            variable_mappings,
            selected_mobile_targets,
            target_type,
            selected_student_ids,
            target_college,
            target_batch,
            target_status,
            target_course,
            target_branch,
            target_year,
            target_semester
        } = req.body;

        if (!template_id || !template_content) {
            return res.status(400).json({ success: false, message: 'Template ID and content are required' });
        }

        const allowedMobileTargets = ['student_mobile', 'parent_mobile1', 'parent_mobile2'];
        const mobileTargets = Array.isArray(selected_mobile_targets) && selected_mobile_targets.length
            ? selected_mobile_targets.filter(target => allowedMobileTargets.includes(target))
            : ['parent_mobile1'];

        if (!mobileTargets.length) {
            return res.status(400).json({ success: false, message: 'At least one valid mobile target is required' });
        }

        // 1. Fetch Recipients
        let query = 'SELECT students.*, colleges.name as college, courses.name as course, course_branches.name as branch FROM students LEFT JOIN colleges ON students.college_id = colleges.id LEFT JOIN courses ON students.course_id = courses.id LEFT JOIN course_branches ON students.branch_id = course_branches.id WHERE 1=1';
        const params = [];

        const parseParam = (val) => {
            if (!val) return null;
            if (Array.isArray(val)) return val.length ? val : null;
            try {
                const parsed = JSON.parse(val);
                return parsed.length ? parsed : null;
            } catch (e) { return null; }
        };

        const statuses = parseParam(target_status);
        if (statuses && statuses.length > 0) {
            query += ' AND students.student_status IN (?)';
            params.push(statuses);
        } else {
            query += ' AND students.student_status = "Regular"';
        }

        const studentIds = parseParam(selected_student_ids);

        if (target_type === 'individual' && studentIds) {
            query += ' AND students.id IN (?)';
            params.push(studentIds);
        } else {
            const colleges = parseParam(target_college);
            const batches = parseParam(target_batch);
            const courses = parseParam(target_course);
            const branches = parseParam(target_branch);
            const years = parseParam(target_year);
            const semesters = parseParam(target_semester);

            if (colleges) { query += ' AND college IN (?)'; params.push(colleges); }
            if (batches) { query += ' AND batch IN (?)'; params.push(batches); }
            if (courses) { query += ' AND course IN (?)'; params.push(courses); }
            if (branches) { query += ' AND branch IN (?)'; params.push(branches); }
            if (years) { query += ' AND current_year IN (?)'; params.push(years); }
            if (semesters) { query += ' AND current_semester IN (?)'; params.push(semesters); }
        }

        const [students] = await masterPool.query(query, params);

        if (students.length === 0) {
            return res.json({ success: true, message: 'No students found matching criteria', count: 0 });
        }

        // Return response immediately to prevent timeout
        res.json({
            success: true,
            message: `SMS broadcast started for ${students.length} recipients. System will process them in the background.`,
            count: students.length
        });

        // 2. Process and Send (Background)
        (async () => {
            console.log(`🚀 Starting background SMS broadcast for ${students.length} students...`);
            let sentCount = 0;
            let failedCount = 0;
            const startTime = Date.now();

            // Process in chunks
            const chunkSize = 50;
            for (let i = 0; i < students.length; i += chunkSize) {
                const chunk = students.slice(i, i + chunkSize);
                await Promise.all(chunk.map(async (student) => {
                    try {
                        // Resolve variables
                        let message = template_content;
                        if (Array.isArray(variable_mappings)) {
                            let varIndex = 0;
                            message = message.replace(/\{#var#\}/g, () => {
                                const mapping = variable_mappings[varIndex];
                                varIndex++;

                                if (!mapping) return '';

                                if (mapping.type === 'static') {
                                    return mapping.value || '';
                                } else if (mapping.type === 'field') {
                                    const key = mapping.value;
                                    if (key === 'current_date') {
                                        return new Date().toLocaleDateString('en-IN');
                                    }
                                    if (key === 'login_link') {
                                        return process.env.LOGIN_LINK || 'pydahgroup.com';
                                    }
                                    if (key === 'user_type') {
                                        return student.user_type || 'Student';
                                    }
                                    if (key === 'default_password') {
                                        const namePart = (student.student_name || '').substring(0, 4);
                                        const mobileStr = String(student.student_mobile || '');
                                        const mobilePart = mobileStr.length >= 4 ? mobileStr.slice(-4) : mobileStr;
                                        return namePart + mobilePart;
                                    }
                                    const val = student[key] || (student.student_data && student.student_data[key]) || '';
                                    return String(val).trim();
                                }
                                return '';
                            });
                        }

                        const mobileMap = {
                            student_mobile: student.student_mobile || student.student_data?.['Student Mobile Number'],
                            parent_mobile1: student.parent_mobile1 || student.student_data?.['Parent Mobile Number 1'],
                            parent_mobile2: student.parent_mobile2 || student.student_data?.['Parent Mobile Number 2']
                        };
                        const uniqueNumbers = [...new Set(
                            mobileTargets
                                .map(target => mobileMap[target])
                                .filter(Boolean)
                                .map(number => String(number).replace(/[^0-9]/g, ''))
                                .filter(number => number.length >= 10)
                        )];

                        if (!uniqueNumbers.length) {
                            failedCount++;
                            return;
                        }

                        await Promise.all(uniqueNumbers.map(async (mobileNumber) => {
                            await smsService.sendSms({
                                to: mobileNumber,
                                message: message,
                                templateId: template_id,
                                peId: process.env.SMS_PE_ID,
                                meta: {
                                    category: 'SMS Template',
                                    sentBy: req.user?.name || req.user?.username || req.user?.email || 'Administrator',
                                    student: {
                                        id: student.id,
                                        admissionNumber: student.admission_number,
                                        currentYear: student.current_year,
                                        currentSemester: student.current_semester
                                    }
                                }
                            });
                            sentCount++;
                        }));

                    } catch (e) {
                        console.error(`Failed to send SMS to student ${student.admission_number}:`, e);
                        failedCount++;
                    }
                }));

                // Optional: small delay between chunks to be nice to the SMS provider/Database?
                // await new Promise(r => setTimeout(r, 100));
            }

            const duration = (Date.now() - startTime) / 1000;
            console.log(`✅ Background SMS broadcast completed in ${duration}s. Sent: ${sentCount}, Failed: ${failedCount}`);
        })().catch(err => {
            console.error('❌ Background SMS broadcast critical failure:', err);
        });

    } catch (error) {
        console.error('SMS Announcement Error:', error);
        // Only verify if headers sent? No, because we send res.json early in the happy path.
        // But if error occurs BEFORE res.json (in fetch phase), we must send error.
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to process SMS announcement' });
        }
    }
};

exports.getSMSHistory = async (req, res) => {
    try {
        const { date_from, date_to, template_id, search } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const offset = (page - 1) * limit;

        let whereClause = "WHERE (sl.category = 'SMS Template' OR sl.category = 'General' OR sl.category IS NULL OR sl.template_id IS NOT NULL)";
        const params = [];

        if (date_from) {
            whereClause += " AND DATE(sl.sent_at) >= ?";
            params.push(date_from);
        }
        if (date_to) {
            whereClause += " AND DATE(sl.sent_at) <= ?";
            params.push(date_to);
        }
        if (template_id) {
            whereClause += " AND sl.template_id = ?";
            params.push(template_id);
        }
        if (search) {
            whereClause += " AND (sl.message LIKE ? OR sl.sent_by LIKE ? OR t.name LIKE ? OR sl.template_id LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        // 1. Overall all-time summary (unfiltered totals till date for Announcements SMS)
        const [overallRows] = await masterPool.query(`
            SELECT 
                COUNT(*) as total_sent_all_time,
                SUM(CASE WHEN status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) as sent_count_all_time,
                SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_count_all_time,
                COUNT(DISTINCT template_id) as templates_used_all_time,
                MIN(sent_at) as earliest_sent_at,
                MAX(sent_at) as latest_sent_at
            FROM sms_logs
            WHERE (category = 'SMS Template' OR category = 'General' OR category IS NULL OR template_id IS NOT NULL)
        `);

        // 2. Count distinct action groups for pagination
        const [countRows] = await masterPool.query(`
            SELECT COUNT(*) as total FROM (
                SELECT 1
                FROM sms_logs sl
                LEFT JOIN (
                    SELECT template_id, MAX(name) as name
                    FROM sms_templates
                    GROUP BY template_id
                ) t ON sl.template_id = t.template_id
                ${whereClause}
                GROUP BY DATE(sl.sent_at), sl.template_id, t.name, COALESCE(NULLIF(TRIM(sl.sent_by), ''), 'System Generated')
            ) as grouped
        `, params);

        const totalActions = Number(countRows[0]?.total || 0);

        // 3. Grouped history rows by date & template & sender
        const [historyRows] = await masterPool.query(`
            SELECT 
                DATE(sl.sent_at) as send_date,
                DATE(sl.sent_at) as action_date,
                sl.template_id,
                COALESCE(t.name, 'Custom / Direct') as template_name,
                COUNT(*) as total_count,
                SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
                MIN(sl.sent_at) as first_sent_at,
                MAX(sl.sent_at) as last_sent_at,
                COALESCE(NULLIF(TRIM(MAX(sl.sent_by)), ''), 'System Generated') as sent_by,
                SUBSTRING(MAX(sl.message), 1, 300) as sample_message
            FROM sms_logs sl
            LEFT JOIN (
                SELECT template_id, MAX(name) as name
                FROM sms_templates
                GROUP BY template_id
            ) t ON sl.template_id = t.template_id
            ${whereClause}
            GROUP BY DATE(sl.sent_at), sl.template_id, t.name, COALESCE(NULLIF(TRIM(sl.sent_by), ''), 'System Generated')
            ORDER BY last_sent_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        // 4. Per-template breakdown stats (every template with count till date)
        const [perTemplateRows] = await masterPool.query(`
            SELECT 
                t.template_id,
                t.name as template_name,
                COUNT(sl.id) as total_sent,
                SUM(CASE WHEN sl.status IN ('Sent', 'Delivered') THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN sl.status = 'Failed' THEN 1 ELSE 0 END) as failed_count,
                MAX(sl.sent_at) as last_used_at
            FROM sms_templates t
            LEFT JOIN sms_logs sl ON sl.template_id = t.template_id
            GROUP BY t.id, t.name, t.template_id
            ORDER BY total_sent DESC
        `);

        res.json({
            success: true,
            data: {
                summary: {
                    total_sent_all_time: Number(overallRows[0]?.total_sent_all_time || 0),
                    sent_count_all_time: Number(overallRows[0]?.sent_count_all_time || 0),
                    failed_count_all_time: Number(overallRows[0]?.failed_count_all_time || 0),
                    templates_used_all_time: Number(overallRows[0]?.templates_used_all_time || 0),
                    earliest_sent_at: overallRows[0]?.earliest_sent_at,
                    latest_sent_at: overallRows[0]?.latest_sent_at
                },
                history: historyRows.map(r => ({
                    ...r,
                    total_count: Number(r.total_count),
                    sent_count: Number(r.sent_count),
                    failed_count: Number(r.failed_count)
                })),
                perTemplate: perTemplateRows.map(r => ({
                    template_id: r.template_id,
                    template_name: r.template_name,
                    total_sent: Number(r.total_sent),
                    sent_count: Number(r.sent_count),
                    failed_count: Number(r.failed_count),
                    last_used_at: r.last_used_at
                })),
                pagination: {
                    page,
                    limit,
                    total: totalActions,
                    totalPages: Math.ceil(totalActions / limit) || 0
                }
            }
        });
    } catch (error) {
        console.error('Failed to fetch SMS history:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching SMS history' });
    }
};

exports.getAnnouncementImage = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await masterPool.query(
            'SELECT image_url FROM announcements WHERE id = ?',
            [id]
        );

        if (rows.length === 0 || !rows[0].image_url) {
            return res.status(404).send('Image not found');
        }

        const raw = rows[0].image_url;
        if (typeof raw === 'string' && raw.startsWith('data:')) {
            const matches = raw.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                const contentType = matches[1];
                const buffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(buffer);
            }
        }

        if (typeof raw === 'string' && (raw.startsWith('http://') || raw.startsWith('https://'))) {
            return res.redirect(raw);
        }

        return res.status(404).send('Invalid image format');
    } catch (err) {
        console.error('Error serving announcement image:', err);
        res.status(500).send('Error serving image');
    }
};

/**
 * Admin: Get registration candidates & seat management summary for an announcement
 */
exports.getAnnouncementRegistrations = async (req, res) => {
    try {
        const { id } = req.params;
        const [annRows] = await masterPool.query(
            `SELECT a.*, COALESCE(reg.registered_count, 0) as registered_count
             FROM announcements a
             LEFT JOIN (
                 SELECT announcement_id, COUNT(*) as registered_count 
                 FROM announcement_registrations 
                 WHERE status = 'confirmed' 
                 GROUP BY announcement_id
             ) reg ON a.id = reg.announcement_id
             WHERE a.id = ? LIMIT 1`,
            [id]
        );

        if (!annRows || annRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Announcement not found' });
        }

        const announcement = annRows[0];

        const [registrations] = await masterPool.query(
            `SELECT 
                ar.id,
                ar.announcement_id,
                ar.student_id,
                COALESCE(NULLIF(ar.student_name, ''), s.student_name, 'Unknown Student') as student_name,
                COALESCE(NULLIF(ar.pin_number, ''), s.pin_no, s.admission_number, 'N/A') as pin_number,
                COALESCE(ar.college, s.college) as college,
                COALESCE(ar.branch, s.branch) as branch,
                COALESCE(ar.current_year, s.current_year) as current_year,
                COALESCE(ar.current_semester, s.current_semester) as current_semester,
                COALESCE(NULLIF(ar.phone, ''), s.student_mobile) as phone,
                COALESCE(NULLIF(ar.email, ''), s.email) as email,
                ar.custom_field_value,
                ar.form_responses,
                ar.registered_at,
                ar.status
             FROM announcement_registrations ar
             LEFT JOIN students s ON ar.student_id = s.id
             WHERE ar.announcement_id = ?
             ORDER BY ar.registered_at ASC`,
            [id]
        );

        let formFields = [];
        if (announcement.registration_form_fields) {
            try {
                formFields = typeof announcement.registration_form_fields === 'string'
                    ? JSON.parse(announcement.registration_form_fields)
                    : announcement.registration_form_fields;
            } catch (e) {
                formFields = [];
            }
        }

        const parsedRegistrations = registrations.map(r => {
            let responses = {};
            if (r.form_responses) {
                try {
                    responses = typeof r.form_responses === 'string'
                        ? JSON.parse(r.form_responses)
                        : r.form_responses;
                } catch (e) {
                    responses = {};
                }
            }
            return {
                ...r,
                form_responses: responses
            };
        });

        const maxSeats = announcement.max_seats ? Number(announcement.max_seats) : null;
        const confirmedList = parsedRegistrations.filter(r => r.status === 'confirmed');
        const registeredCount = confirmedList.length;
        const availableSeats = maxSeats !== null ? Math.max(0, maxSeats - registeredCount) : null;
        const isFull = maxSeats !== null ? registeredCount >= maxSeats : false;

        res.json({
            success: true,
            data: {
                announcement: {
                    id: announcement.id,
                    title: announcement.title,
                    content: announcement.content,
                    requires_registration: Boolean(announcement.requires_registration),
                    max_seats: maxSeats,
                    registration_deadline: announcement.registration_deadline,
                    custom_registration_field: announcement.custom_registration_field,
                    registration_form_fields: formFields,
                    registered_count: registeredCount,
                    available_seats: availableSeats,
                    is_full: isFull
                },
                registrations: parsedRegistrations
            }
        });
    } catch (error) {
        console.error('Get announcement registrations error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch candidate registrations' });
    }
};

/**
 * Student: Register for an announcement event
 */
exports.registerForAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            custom_field_value,
            phone,
            email,
            student_name: submittedName,
            pin_number: submittedPin,
            college: submittedCollege,
            branch: submittedBranch,
            year_sem: submittedYearSem,
            form_responses
        } = req.body;
        const { admission_number, admissionNumber, id: tokenUserId } = req.user || {};
        const studentAdmNum = admission_number || admissionNumber;

        let responsesJson = null;
        if (form_responses) {
            responsesJson = typeof form_responses === 'string' ? form_responses : JSON.stringify(form_responses);
        }

        // 1. Fetch announcement with seat info
        const [annRows] = await masterPool.query(
            `SELECT a.*, COALESCE(reg.registered_count, 0) as registered_count
             FROM announcements a
             LEFT JOIN (
                 SELECT announcement_id, COUNT(*) as registered_count 
                 FROM announcement_registrations 
                 WHERE status = 'confirmed' 
                 GROUP BY announcement_id
             ) reg ON a.id = reg.announcement_id
             WHERE a.id = ? AND a.is_active = 1 LIMIT 1`,
            [id]
        );

        if (!annRows || annRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Announcement not found or is currently inactive' });
        }

        const announcement = annRows[0];
        if (!announcement.requires_registration) {
            return res.status(400).json({ success: false, message: 'Registration is not enabled for this announcement' });
        }

        // Deadline check
        if (announcement.registration_deadline && new Date(announcement.registration_deadline) < new Date()) {
            return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
        }

        // Seat capacity check
        if (announcement.max_seats && Number(announcement.registered_count) >= Number(announcement.max_seats)) {
            return res.status(400).json({ success: false, message: 'All seats are booked. Registrations are full.' });
        }

        // 2. Fetch student details
        const [studentRows] = await masterPool.query(
            `SELECT id, student_name, admission_number, pin_no, college, branch, current_year, current_semester, student_mobile, email 
             FROM students 
             WHERE admission_number = ? OR admission_no = ? OR id = ? 
             LIMIT 1`,
            [studentAdmNum || '', studentAdmNum || '', tokenUserId || 0]
        );

        if (!studentRows || studentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student profile not found. Please log in as a student.' });
        }

        const student = studentRows[0];
        const finalName = (submittedName || student.student_name || '').trim();
        const finalPin = (submittedPin || student.pin_no || student.admission_number || 'N/A').trim();
        const finalCollege = submittedCollege || student.college || null;
        const finalBranch = submittedBranch || student.branch || null;
        const finalPhone = phone || student.student_mobile || null;
        const finalEmail = email || student.email || null;

        // 3. Check existing registration
        const [existingReg] = await masterPool.query(
            'SELECT id, status FROM announcement_registrations WHERE announcement_id = ? AND student_id = ? LIMIT 1',
            [id, student.id]
        );

        if (existingReg.length > 0) {
            if (existingReg[0].status === 'confirmed') {
                return res.status(400).json({ success: false, message: 'You are already registered for this event' });
            } else {
                // Re-confirm previously cancelled registration
                await masterPool.query(
                    `UPDATE announcement_registrations SET 
                        status = 'confirmed', 
                        student_name = ?,
                        pin_number = ?,
                        college = ?,
                        branch = ?,
                        phone = ?, 
                        email = ?, 
                        custom_field_value = ?, 
                        form_responses = ?,
                        registered_at = NOW() 
                     WHERE id = ?`,
                    [finalName, finalPin, finalCollege, finalBranch, finalPhone, finalEmail, custom_field_value || null, responsesJson, existingReg[0].id]
                );
                return res.json({ success: true, message: 'Registration confirmed successfully' });
            }
        }

        // 4. Insert new registration
        await masterPool.query(
            `INSERT INTO announcement_registrations 
             (announcement_id, student_id, student_name, pin_number, college, branch, current_year, current_semester, phone, email, custom_field_value, form_responses, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
            [
                id,
                student.id,
                finalName,
                finalPin,
                finalCollege,
                finalBranch,
                submittedYearSem || student.current_year || null,
                student.current_semester || null,
                finalPhone,
                finalEmail,
                custom_field_value || null,
                responsesJson
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Successfully registered for the event!'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to complete registration' });
    }
};

/**
 * Student: Cancel own registration
 */
exports.cancelMyRegistration = async (req, res) => {
    try {
        const { id } = req.params;
        const { admission_number, admissionNumber, id: tokenUserId } = req.user || {};
        const studentAdmNum = admission_number || admissionNumber;

        const [studentRows] = await masterPool.query(
            'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? OR id = ? LIMIT 1',
            [studentAdmNum || '', studentAdmNum || '', tokenUserId || 0]
        );

        if (!studentRows || studentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }

        const studentId = studentRows[0].id;
        await masterPool.query(
            'DELETE FROM announcement_registrations WHERE announcement_id = ? AND student_id = ?',
            [id, studentId]
        );

        res.json({ success: true, message: 'Registration cancelled successfully' });
    } catch (error) {
        console.error('Cancel registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel registration' });
    }
};

/**
 * Admin: Remove/delete a candidate registration
 */
exports.removeCandidateRegistration = async (req, res) => {
    try {
        const { id, registrationId } = req.params;
        await masterPool.query(
            'DELETE FROM announcement_registrations WHERE id = ? AND announcement_id = ?',
            [registrationId, id]
        );
        res.json({ success: true, message: 'Candidate registration removed successfully' });
    } catch (error) {
        console.error('Remove registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove registration' });
    }
};

