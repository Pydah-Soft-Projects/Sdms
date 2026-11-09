const { masterPool } = require('../config/database');
const { parseTargetsFromRow, matchesStudent, parseTarget } = require('../services/targetingService');

const smsService = require('../services/smsService');
const pushController = require('./pushController');
const fs = require('fs');
// Helper to parse targeting parameters into an array of values
const parseTargetParam = (val) => {
    if (!val) return null;
    const arr = parseTarget(val);
    return arr && arr.length > 0 ? arr : null;
};

const parseJsonField = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const parseBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true';
const parseStudentIds = (value) => parseTargetParam(value)
    ?.map(id => Number(id))
    .filter((id, index, ids) => Number.isSafeInteger(id) && id > 0 && ids.indexOf(id) === index) || [];
const hasCustomFormFields = (fields) => Array.isArray(fields) && fields.some(
    field => field && !field.is_default && field.enabled !== false && String(field.label || '').trim()
);

const getCircularNumbers = async (connection, colleges, existing = {}) => {
    const numbers = { ...existing };
    const year = new Date().getFullYear();

    for (const college of colleges) {
        if (numbers[college]) continue;
        const code = college.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'COLLEGE';
        await connection.query(
            `INSERT IGNORE INTO announcement_circular_sequences (college_name, series_year, last_number)
             VALUES (?, ?, 0)`,
            [college, year]
        );
        await connection.query(
            `UPDATE announcement_circular_sequences
             SET last_number = last_number + 1
             WHERE college_name = ? AND series_year = ?`,
            [college, year]
        );
        const [sequenceRows] = await connection.query(
            `SELECT last_number FROM announcement_circular_sequences
             WHERE college_name = ? AND series_year = ?`,
            [college, year]
        );
        numbers[college] = `CIRC/${code}/${year}/${String(sequenceRows[0].last_number).padStart(4, '0')}`;
    }

    return numbers;
};

const getAnnouncementAudienceCount = async (connection, targets, studentIds = []) => {
    if (studentIds.length > 0) {
        const [rows] = await connection.query(
            'SELECT COUNT(*) AS count FROM students WHERE student_status = "Regular" AND id IN (?)',
            [studentIds]
        );
        return Number(rows[0]?.count || 0);
    }

    let query = 'SELECT COUNT(*) AS count FROM students WHERE student_status = "Regular"';
    const params = [];
    const mappings = [
        ['target_college', 'college'],
        ['target_batch', 'batch'],
        ['target_course', 'course'],
        ['target_branch', 'branch'],
        ['target_year', 'current_year'],
        ['target_semester', 'current_semester']
    ];

    mappings.forEach(([target, column]) => {
        const values = parseTargetParam(targets[target]);
        if (values) {
            query += ` AND ${column} IN (?)`;
            params.push(values);
        }
    });

    const [rows] = await connection.query(query, params);
    return Number(rows[0]?.count || 0);
};


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
    let connection;
    try {
        const {
            title,
            content,
            announcement_type,
            target_type,
            selected_student_ids,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            expires_at,
            circular_signatory,
            circular_designation,
            event_date,
            event_time,
            event_venue,
            achievement_data,
            requires_registration,
            max_seats,
            registration_deadline,
            custom_registration_field,
            registration_form_fields
        } = req.body;

        const normalizedType = String(announcement_type || 'announcement').toLowerCase();
        const supportedTypes = ['announcement', 'circular', 'event', 'achievement', 'form'];
        if (!supportedTypes.includes(normalizedType)) {
            return res.status(400).json({ success: false, message: 'Unsupported announcement type' });
        }
        if (!String(title || '').trim()) {
            return res.status(400).json({ success: false, message: 'A title is required' });
        }
        if ((normalizedType === 'circular' || normalizedType === 'form') && !String(content || '').trim()) {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }
        if (normalizedType === 'circular' && (!String(circular_signatory || '').trim() || !String(circular_designation || '').trim())) {
            return res.status(400).json({ success: false, message: 'Signatory name and designation are required' });
        }

        const isIndividualTarget = target_type === 'individual';
        const targetStudentIds = isIndividualTarget ? parseStudentIds(selected_student_ids) : [];
        if (isIndividualTarget && targetStudentIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Select at least one student' });
        }
        const createdBy = req.user?.id || 1;
        const parsedTargets = {
            target_college: isIndividualTarget ? null : target_college || null,
            target_batch: isIndividualTarget ? null : target_batch || null,
            target_course: isIndividualTarget ? null : target_course || null,
            target_branch: isIndividualTarget ? null : target_branch || null,
            target_year: isIndividualTarget ? null : target_year || null,
            target_semester: isIndividualTarget ? null : target_semester || null
        };
        const parsedFields = parseJsonField(registration_form_fields, []);
        const isForm = normalizedType === 'form';
        if (isForm && !hasCustomFormFields(parsedFields)) {
            return res.status(400).json({ success: false, message: 'Add at least one form field' });
        }
        const isRegistrationEnabled = isForm || parseBoolean(requires_registration);
        const parsedMaxSeats = max_seats ? Number.parseInt(max_seats, 10) : null;
        if (parsedMaxSeats !== null && (!Number.isInteger(parsedMaxSeats) || parsedMaxSeats < 1)) {
            return res.status(400).json({ success: false, message: 'Seat limit must be a positive number' });
        }
        let imageUrl = null;

        if (req.file) {
            localFilePath = req.file.path;
            const fileData = fs.readFileSync(localFilePath);
            const base64Image = fileData.toString('base64');
            const mimeType = req.file.mimetype;
            imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const audienceCount = await getAnnouncementAudienceCount(connection, parsedTargets, targetStudentIds);
        const parsedExpiresAt = expires_at && expires_at !== 'null' ? expires_at : null;
        let circularNumbers = null;

        if (normalizedType === 'circular') {
            const targetColleges = isIndividualTarget
                ? (await connection.query('SELECT DISTINCT college FROM students WHERE id IN (?) AND college IS NOT NULL AND TRIM(college) <> "" ORDER BY college', [targetStudentIds]))[0].map(row => row.college)
                : parseTargetParam(target_college);
            const colleges = targetColleges || (await connection.query(
                'SELECT DISTINCT college FROM students WHERE college IS NOT NULL AND TRIM(college) <> "" ORDER BY college'
            ))[0].map(row => row.college);
            if (colleges.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Select at least one college for a circular' });
            }
            circularNumbers = await getCircularNumbers(connection, colleges);
        }

        const [result] = await connection.query(
            `INSERT INTO announcements 
            (title, content, image_url, target_college, target_batch, target_course, target_branch, target_year, target_semester, target_student_ids,
             created_by, audience_count, expires_at, announcement_type, circular_numbers, circular_signatory, circular_designation,
             event_date, event_time, event_venue, achievement_data, requires_registration, max_seats, registration_deadline,
             custom_registration_field, registration_form_fields)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
                String(title).trim(),
                content || '',
                imageUrl,
                ...Object.values(parsedTargets),
                targetStudentIds.length ? JSON.stringify(targetStudentIds) : null,
                createdBy,
                audienceCount,
                parsedExpiresAt,
                normalizedType,
                circularNumbers ? JSON.stringify(circularNumbers) : null,
                circular_signatory || null,
                circular_designation || null,
                event_date || null,
                event_time || null,
                event_venue || null,
                achievement_data ? JSON.stringify(parseJsonField(achievement_data, achievement_data)) : null,
                isRegistrationEnabled ? 1 : 0,
                parsedMaxSeats,
                registration_deadline || null,
                custom_registration_field || null,
                isRegistrationEnabled ? JSON.stringify(Array.isArray(parsedFields) ? parsedFields : []) : null
            ]
        );
        await connection.commit();
        connection.release();
        connection = null;

        // Trigger Push Notifications (Background)
        (async () => {
            try {
                if (audienceCount === 0) return;

                let idQuery = 'SELECT id FROM students WHERE student_status = "Regular"';
                const params = [];
                if (targetStudentIds.length) {
                    idQuery += ' AND id IN (?)';
                    params.push(targetStudentIds);
                } else {
                    [
                        ['target_college', 'college'],
                        ['target_batch', 'batch'],
                        ['target_course', 'course'],
                        ['target_branch', 'branch'],
                        ['target_year', 'current_year'],
                        ['target_semester', 'current_semester']
                    ].forEach(([target, column]) => {
                        const values = parseTargetParam(parsedTargets[target]);
                        if (values) {
                            idQuery += ` AND ${column} IN (?)`;
                            params.push(values);
                        }
                    });
                }
                const [students] = await masterPool.query(idQuery, params);
                const userIds = students.map(s => s.id);

                if (userIds.length > 0) {
                    await pushController.sendBatchNotification(userIds, {
                        title: `New Announcement: ${title}`,
                        body: String(content || '').substring(0, 100) + (String(content || '').length > 100 ? '...' : ''),
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
            data: { id: result.insertId, title, image_url: imageUrl, audience_count: audienceCount, circular_numbers: circularNumbers }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Create announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to create announcement' });
    } finally {
        if (connection) connection.release();
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
                a.announcement_type,
                a.circular_numbers,
                a.circular_signatory,
                a.circular_designation,
                a.event_date,
                a.event_time,
                a.event_venue,
                a.achievement_data,
                (a.image_url IS NOT NULL AND a.image_url != '') as has_image,
                CASE WHEN a.image_url LIKE 'http%' THEN a.image_url ELSE NULL END as external_image_url,
                a.file_name,
                a.target_college,
                a.target_batch,
                a.target_course,
                a.target_branch,
                a.target_year,
                a.target_semester,
                a.target_student_ids,
                a.created_by,
                a.audience_count,
                a.is_active,
                a.expires_at,
                a.requires_registration,
                a.max_seats,
                a.registration_deadline,
                a.custom_registration_field,
                a.registration_form_fields,
                COALESCE(reg.registered_count, 0) AS registered_count,
                a.created_at,
                a.updated_at,
                u.username as created_by_name
            FROM announcements a
            LEFT JOIN admins u ON a.created_by = u.id
            LEFT JOIN (
                SELECT announcement_id, COUNT(*) AS registered_count
                FROM announcement_registrations
                WHERE status = 'confirmed'
                GROUP BY announcement_id
            ) reg ON reg.announcement_id = a.id
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

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const baseUrl = `${protocol}://${req.get('host')}`;
        const data = rows.map(ann => {
            const maxSeats = ann.max_seats ? Number(ann.max_seats) : null;
            const registeredCount = Number(ann.registered_count || 0);
            const imageUrl = ann.external_image_url || (ann.has_image ? `${baseUrl}/api/announcements/${ann.id}/image` : null);
            return {
                ...ann,
                announcement_type: ann.announcement_type || 'announcement',
                target_type: parseStudentIds(ann.target_student_ids).length ? 'individual' : 'filters',
                target_student_ids: parseStudentIds(ann.target_student_ids),
                circular_numbers: parseJsonField(ann.circular_numbers, {}),
                achievement_data: parseJsonField(ann.achievement_data, null),
                requires_registration: Boolean(ann.requires_registration),
                registration_form_fields: parseJsonField(ann.registration_form_fields, []),
                registered_count: registeredCount,
                max_seats: maxSeats,
                available_seats: maxSeats === null ? null : Math.max(0, maxSeats - registeredCount),
                is_full: maxSeats !== null && registeredCount >= maxSeats,
                image_url: imageUrl,
                file_url: ann.announcement_type === 'circular' ? imageUrl : null
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
                'SELECT id, college, course, branch, batch, current_year, current_semester, student_status FROM students WHERE admission_number = ? OR admission_no = ? OR id = ? LIMIT 1',
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

        // Fetch active announcements with registration details
        let rows = [];
        try {
            [rows] = await masterPool.query(
                `SELECT 
                    a.id, 
                    a.title, 
                    a.content, 
                    (a.image_url IS NOT NULL AND a.image_url != "") as has_image, 
                    a.created_at, 
                    a.expires_at, 
                    a.is_active, 
                    a.target_college, 
                    a.target_batch, 
                    a.target_course, 
                    a.target_branch, 
                    a.target_year, 
                    a.target_semester,
                    a.target_student_ids,
                    a.announcement_type,
                    a.circular_numbers,
                    a.circular_signatory,
                    a.circular_designation,
                    a.event_date,
                    a.event_time,
                    a.event_venue,
                    a.achievement_data,
                    a.requires_registration,
                    a.max_seats,
                    a.registration_deadline,
                    a.custom_registration_field,
                    a.registration_form_fields,
                    COALESCE(reg.registered_count, 0) AS registered_count,
                    mine.id AS my_registration_id,
                    mine.status AS my_registration_status
                FROM announcements a
                LEFT JOIN (
                    SELECT announcement_id, COUNT(*) AS registered_count
                    FROM announcement_registrations
                    WHERE status = 'confirmed'
                    GROUP BY announcement_id
                ) reg ON reg.announcement_id = a.id
                LEFT JOIN announcement_registrations mine
                    ON mine.announcement_id = a.id AND mine.student_id = ? AND mine.status = 'confirmed'
                WHERE a.is_active = 1 
                ORDER BY a.created_at DESC`,
                [student ? student.id : 0]
            );
        } catch (dbErr) {
            [rows] = await masterPool.query(
                `SELECT 
                    a.id, 
                    a.title, 
                    a.content, 
                    (a.image_url IS NOT NULL AND a.image_url != "") as has_image, 
                    a.created_at, 
                    a.expires_at, 
                    a.is_active, 
                    a.target_college, 
                    a.target_batch, 
                    a.target_course, 
                    a.target_branch, 
                    a.target_year, 
                    a.target_semester,
                    a.target_student_ids,
                    a.announcement_type,
                    a.circular_numbers,
                    a.circular_signatory,
                    a.circular_designation,
                    a.event_date,
                    a.event_time,
                    a.event_venue,
                    a.achievement_data,
                    a.requires_registration,
                    a.max_seats,
                    a.registration_deadline,
                    a.custom_registration_field,
                    a.registration_form_fields,
                    0 AS registered_count,
                    NULL AS my_registration_id,
                    NULL AS my_registration_status
                FROM announcements a
                WHERE a.is_active = 1 
                ORDER BY a.created_at DESC`
            );
        }

        let matchedAnnouncements = rows;
        if (student) {
            matchedAnnouncements = rows.filter(ann => {
                const individualIds = parseStudentIds(ann.target_student_ids);
                if (individualIds.length && !individualIds.includes(Number(student.id))) return false;
                const targets = parseTargetsFromRow(ann);
                return matchesStudent(student, targets);
            });
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const baseUrl = `${protocol}://${req.get('host')}`;
        const pagedData = matchedAnnouncements.slice(offset, offset + limit).map(ann => {
            const requiresReg = Boolean(ann.requires_registration);
            const registeredCount = Number(ann.registered_count || 0);
            const maxSeats = ann.max_seats ? Number(ann.max_seats) : null;
            const isFull = maxSeats ? registeredCount >= maxSeats : false;
            const isRegistered = Boolean(ann.my_registration_id);
            let availableSeats = null;
            if (maxSeats !== null) {
                availableSeats = Math.max(0, maxSeats - registeredCount);
            }
            const circularNumbers = parseJsonField(ann.circular_numbers, {});
            const studentCircularNumbers = student?.college
                ? Object.fromEntries(Object.entries(circularNumbers).filter(([college]) =>
                    college.trim().toLowerCase() === String(student.college).trim().toLowerCase()
                ))
                : circularNumbers;
            const imageUrl = ann.has_image ? `${baseUrl}/api/announcements/${ann.id}/image` : null;
            return {
                ...ann,
                announcement_type: ann.announcement_type || 'announcement',
                circular_numbers: studentCircularNumbers,
                achievement_data: parseJsonField(ann.achievement_data, null),
                requires_registration: requiresReg,
                registration_form_fields: parseJsonField(ann.registration_form_fields, []),
                registered_count: registeredCount,
                max_seats: maxSeats,
                registration_deadline: ann.registration_deadline,
                custom_registration_field: ann.custom_registration_field,
                available_seats: availableSeats,
                is_full: isFull,
                is_registered: isRegistered,
                my_registration: isRegistered ? { id: ann.my_registration_id, status: ann.my_registration_status } : null,
                image_url: imageUrl,
                file_url: ann.announcement_type === 'circular' ? imageUrl : null
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

        const parseParam = parseTargetParam;

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
    let connection;
    try {
        const { id } = req.params;
        const {
            title,
            content,
            announcement_type,
            target_type,
            selected_student_ids,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            existing_image_url,
            expires_at,
            circular_signatory,
            circular_designation,
            event_date,
            event_time,
            event_venue,
            achievement_data,
            requires_registration,
            max_seats,
            registration_deadline,
            custom_registration_field,
            registration_form_fields
        } = req.body;

        const normalizedType = String(announcement_type || 'announcement').toLowerCase();
        const supportedTypes = ['announcement', 'circular', 'event', 'achievement', 'form'];
        if (!supportedTypes.includes(normalizedType)) {
            return res.status(400).json({ success: false, message: 'Unsupported announcement type' });
        }
        if (!String(title || '').trim()) {
            return res.status(400).json({ success: false, message: 'A title is required' });
        }
        if ((normalizedType === 'circular' || normalizedType === 'form') && !String(content || '').trim()) {
            return res.status(400).json({ success: false, message: 'Content is required' });
        }
        if (normalizedType === 'circular' && (!String(circular_signatory || '').trim() || !String(circular_designation || '').trim())) {
            return res.status(400).json({ success: false, message: 'Signatory name and designation are required' });
        }

        const isIndividualTarget = target_type === 'individual';
        const targetStudentIds = isIndividualTarget ? parseStudentIds(selected_student_ids) : [];
        if (isIndividualTarget && targetStudentIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Select at least one student' });
        }
        const parsedTargets = {
            target_college: isIndividualTarget ? null : target_college || null,
            target_batch: isIndividualTarget ? null : target_batch || null,
            target_course: isIndividualTarget ? null : target_course || null,
            target_branch: isIndividualTarget ? null : target_branch || null,
            target_year: isIndividualTarget ? null : target_year || null,
            target_semester: isIndividualTarget ? null : target_semester || null
        };
        const isRegistrationEnabled = normalizedType === 'form' || parseBoolean(requires_registration);
        const parsedMaxSeats = max_seats ? Number.parseInt(max_seats, 10) : null;
        if (parsedMaxSeats !== null && (!Number.isInteger(parsedMaxSeats) || parsedMaxSeats < 1)) {
            return res.status(400).json({ success: false, message: 'Seat limit must be a positive number' });
        }
        const parsedFields = parseJsonField(registration_form_fields, []);
        if (normalizedType === 'form' && !hasCustomFormFields(parsedFields)) {
            return res.status(400).json({ success: false, message: 'Add at least one form field' });
        }
        let imageUrl = existing_image_url || null;

        if (req.file) {
            localFilePath = req.file.path;
            const fileData = fs.readFileSync(localFilePath);
            const base64Image = fileData.toString('base64');
            const mimeType = req.file.mimetype;
            imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const [currentRows] = await connection.query('SELECT circular_numbers FROM announcements WHERE id = ? FOR UPDATE', [id]);
        if (!currentRows.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Announcement not found' });
        }
        const audienceCount = await getAnnouncementAudienceCount(connection, parsedTargets, targetStudentIds);
        const parsedExpiresAt = expires_at && expires_at !== 'null' ? expires_at : null;
        let circularNumbers = null;
        if (normalizedType === 'circular') {
            const targetColleges = isIndividualTarget
                ? (await connection.query('SELECT DISTINCT college FROM students WHERE id IN (?) AND college IS NOT NULL AND TRIM(college) <> "" ORDER BY college', [targetStudentIds]))[0].map(row => row.college)
                : parseTargetParam(target_college);
            const colleges = targetColleges || (await connection.query(
                'SELECT DISTINCT college FROM students WHERE college IS NOT NULL AND TRIM(college) <> "" ORDER BY college'
            ))[0].map(row => row.college);
            if (colleges.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Select at least one college for a circular' });
            }
            const previousNumbers = parseJsonField(currentRows[0].circular_numbers, {});
            circularNumbers = await getCircularNumbers(connection, colleges, previousNumbers);
        }

        await connection.query(
            `UPDATE announcements SET 
                title = ?, 
                content = ?,
                image_url = ?,
                target_college = ?, 
                target_batch = ?, 
                target_course = ?, 
                target_branch = ?, 
                target_year = ?, 
                target_semester = ?,
                target_student_ids = ?,
                audience_count = ?,
                expires_at = ?,
                announcement_type = ?,
                circular_numbers = ?,
                circular_signatory = ?,
                circular_designation = ?,
                event_date = ?,
                event_time = ?,
                event_venue = ?,
                achievement_data = ?,
                requires_registration = ?,
                max_seats = ?,
                registration_deadline = ?,
                custom_registration_field = ?,
                registration_form_fields = ?
            WHERE id = ?`,
            [
                String(title).trim(),
                content || '',
                imageUrl,
                ...Object.values(parsedTargets),
                targetStudentIds.length ? JSON.stringify(targetStudentIds) : null,
                audienceCount,
                parsedExpiresAt,
                normalizedType,
                circularNumbers ? JSON.stringify(circularNumbers) : null,
                circular_signatory || null,
                circular_designation || null,
                event_date || null,
                event_time || null,
                event_venue || null,
                achievement_data ? JSON.stringify(parseJsonField(achievement_data, achievement_data)) : null,
                isRegistrationEnabled ? 1 : 0,
                parsedMaxSeats,
                registration_deadline || null,
                custom_registration_field || null,
                isRegistrationEnabled ? JSON.stringify(Array.isArray(parsedFields) ? parsedFields : []) : null,
                id
            ]
        );
        await connection.commit();
        connection.release();
        connection = null;

        res.json({ success: true, message: 'Announcement updated', audience_count: audienceCount, circular_numbers: circularNumbers });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Update announcement error:', error);
        res.status(500).json({ success: false, message: 'Failed to update announcement' });
    } finally {
        if (connection) connection.release();
        if (localFilePath) deleteLocalFile(localFilePath);
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

        const parseParam = parseTargetParam;

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

            if (colleges) { query += ' AND (colleges.name IN (?) OR students.college IN (?))'; params.push(colleges, colleges); }
            if (batches) { query += ' AND students.batch IN (?)'; params.push(batches); }
            if (courses) { query += ' AND (courses.name IN (?) OR students.course IN (?))'; params.push(courses, courses); }
            if (branches) { query += ' AND (course_branches.name IN (?) OR students.branch IN (?))'; params.push(branches, branches); }
            if (years) { query += ' AND students.current_year IN (?)'; params.push(years); }
            if (semesters) { query += ' AND students.current_semester IN (?)'; params.push(semesters); }
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

                        let studentData = student.student_data;
                        if (typeof studentData === 'string') {
                            try {
                                studentData = JSON.parse(studentData);
                            } catch (e) {
                                studentData = {};
                            }
                        }
                        if (!studentData || typeof studentData !== 'object') {
                            studentData = {};
                        }

                        const studentMobile = student.student_mobile || student.mobile || student.phone || student.student_phone ||
                            studentData['Student Mobile Number'] || studentData['student_mobile'] || studentData['Mobile Number'] || studentData['Student Mobile'] || '';

                        const parentMobile1 = student.parent_mobile1 || student.parent_mobile || student.parent_phone || student.father_mobile || student.guardian_mobile ||
                            studentData['Parent Mobile Number 1'] || studentData['parent_mobile1'] || studentData['Parent Preferred Number'] || studentData['Parent Mobile Number'] || studentData['Parent Mobile'] || studentData['Parent Phone'] || studentData['Father Mobile Number'] || studentData['Guardian Mobile Number'] || '';

                        const parentMobile2 = student.parent_mobile2 || student.mother_mobile || student.alternate_mobile ||
                            studentData['Parent Mobile Number 2'] || studentData['parent_mobile2'] || studentData['Mother Mobile Number'] || studentData['Alternate Mobile Number'] || '';

                        const mobileMap = {
                            student_mobile: studentMobile,
                            parent_mobile1: parentMobile1,
                            parent_mobile2: parentMobile2
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

        const submittedResponses = parseJsonField(form_responses, {});
        let responsesJson = null;
        if (form_responses) {
            responsesJson = JSON.stringify(submittedResponses);
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
        if (!matchesStudent(student, parseTargetsFromRow(announcement))) {
            return res.status(403).json({ success: false, message: 'This announcement is not available to your student profile' });
        }

        const registrationFields = parseJsonField(announcement.registration_form_fields, []);
        for (const field of registrationFields.filter(item => !item.is_default && item.enabled !== false && item.required)) {
            const fieldKey = field.id || field.label;
            const response = submittedResponses?.[fieldKey];
            if (response === undefined || response === null || String(response).trim() === '') {
                return res.status(400).json({ success: false, message: `Please provide an answer for "${field.label}"` });
            }
        }

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
            message: announcement.announcement_type === 'form'
                ? 'Your form response has been submitted successfully'
                : 'Successfully registered for the event!'
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
