const { masterPool } = require('../config/database');
const { sendNotificationToUser } = require('./pushController');
const { createBroadcastNotification } = require('../services/notificationService');
const { parseTargetsFromRow, matchesStudent } = require('../services/targetingService');

const parseRegistrationFields = (fields) => {
    if (!fields) return [];
    try {
        const parsed = typeof fields === 'string' ? JSON.parse(fields) : fields;
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

const parseRegistrationResponses = (responses) => {
    if (!responses) return {};
    try {
        const parsed = typeof responses === 'string' ? JSON.parse(responses) : responses;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
        return {};
    }
};

const normalizeRegistrationSettings = (body) => {
    const enabled = body.requires_registration === true ||
        body.requires_registration === 1 ||
        body.requires_registration === '1' ||
        body.requires_registration === 'true';
    const maxSeats = enabled && Number.parseInt(body.max_seats, 10) > 0
        ? Number.parseInt(body.max_seats, 10)
        : null;
    const fields = enabled ? parseRegistrationFields(body.registration_form_fields) : [];

    return {
        requiresRegistration: enabled,
        maxSeats,
        deadline: enabled && body.registration_deadline ? body.registration_deadline : null,
        fields: enabled ? JSON.stringify(fields) : null
    };
};

const serializeTarget = (target) => {
    if (Array.isArray(target) && target.length > 0) {
        return JSON.stringify(target.filter(Boolean));
    }
    if (typeof target === 'string' && target.trim()) {
        try {
            const parsed = JSON.parse(target);
            if (Array.isArray(parsed)) return JSON.stringify(parsed.filter(Boolean));
        } catch {
            return JSON.stringify([target.trim()]);
        }
    }
    return null;
};

const resolveLegacyAdminId = async (user) => {
    if (!user) {
        return null;
    }

    if (user.role === 'admin') {
        return user.id || null;
    }

    if (!user.username) {
        return null;
    }

    const [admins] = await masterPool.query(
        'SELECT id FROM admins WHERE username = ? LIMIT 1',
        [user.username]
    );

    return admins.length > 0 ? admins[0].id : null;
};

exports.createEvent = async (req, res) => {
    try {
        const {
            title,
            description,
            event_date,
            start_time,
            end_time,
            event_type, // 'academic', 'holiday', 'exam', 'other'
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            image_url
        } = req.body;
        const registration = normalizeRegistrationSettings(req.body);

        // `events.created_by` still references the legacy `admins` table.
        // RBAC/HRMS users may not have a matching admin row, so store NULL
        // instead of failing the insert with a foreign key error.
        const createdBy = await resolveLegacyAdminId(req.user || req.admin);

        const [result] = await masterPool.query(
            `INSERT INTO events 
            (title, description, event_date, end_date, start_time, end_time, event_type, created_by, target_college, target_batch, target_course, target_branch, target_year, target_semester, requires_registration, max_seats, registration_deadline, registration_form_fields, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                description,
                event_date,
                req.body.end_date || null,
                start_time || null,
                end_time || null,
                event_type || 'other',
                createdBy,
                serializeTarget(target_college),
                serializeTarget(target_batch),
                serializeTarget(target_course),
                serializeTarget(target_branch),
                serializeTarget(target_year),
                serializeTarget(target_semester),
                registration.requiresRegistration ? 1 : 0,
                registration.maxSeats,
                registration.deadline,
                registration.fields,
                image_url || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Event created successfully',
        });

        // Send Push Notifications (Async)
        if (String(event_type || '').toLowerCase() !== 'exam') {
            notifyTargetedStudents({
                title,
                description,
                event_date,
                event_type,
                target_college,
                target_batch,
                target_course,
                target_branch,
                target_year,
                target_semester,
                image_url
            }).catch(err => console.error('Event notification failed:', err));
        }

    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const query = `
            SELECT 
                e.*, 
                u.username as created_by_name,
                COALESCE(reg.registered_count, 0) AS registered_count
            FROM events e
            LEFT JOIN admins u ON e.created_by = u.id
            LEFT JOIN (
                SELECT event_id, COUNT(*) AS registered_count
                FROM event_registrations
                WHERE status = 'confirmed'
                GROUP BY event_id
            ) reg ON reg.event_id = e.id
            ORDER BY e.event_date DESC
        `;

        let rows;
        try {
            [rows] = await masterPool.query(query);
        } catch (error) {
            if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
            console.warn('event_registrations table is missing; returning events without registration counts until its migration is applied.');
            [rows] = await masterPool.query(`
                SELECT e.*, u.username as created_by_name, 0 AS registered_count
                FROM events e
                LEFT JOIN admins u ON e.created_by = u.id
                ORDER BY e.event_date DESC
            `);
        }

        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
};

exports.getStudentEvents = async (req, res) => {
    try {
        const { admission_number, admissionNumber } = req.user;
        const studentAdmNum = admission_number || admissionNumber;

        const [studentRows] = await masterPool.query(
            'SELECT id, college, course, branch, batch, current_year, current_semester, student_status FROM students WHERE admission_number = ? OR admission_no = ?',
            [studentAdmNum, studentAdmNum]
        );

        if (studentRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        const student = studentRows[0];

        let rows;
        try {
            [rows] = await masterPool.query(
                `SELECT e.*, COALESCE(reg.registered_count, 0) AS registered_count,
                    mine.id AS my_registration_id, mine.status AS my_registration_status
             FROM events e
             LEFT JOIN (
                 SELECT event_id, COUNT(*) AS registered_count
                 FROM event_registrations
                 WHERE status = 'confirmed'
                 GROUP BY event_id
             ) reg ON reg.event_id = e.id
             LEFT JOIN event_registrations mine
                ON mine.event_id = e.id AND mine.student_id = ? AND mine.status = 'confirmed'
             WHERE e.is_active = 1
             ORDER BY e.event_date ASC`,
                [student.id]
            );
        } catch (error) {
            if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
            console.warn('event_registrations table is missing; returning student events without registration details until its migration is applied.');
            [rows] = await masterPool.query(
                `SELECT e.*, 0 AS registered_count,
                        NULL AS my_registration_id, NULL AS my_registration_status
                 FROM events e
                 WHERE e.is_active = 1
                 ORDER BY e.event_date ASC`
            );
        }

        const matchedEvents = rows.filter(event => {
            if (event.event_type === 'holiday') return true;
            const targets = parseTargetsFromRow(event);
            return matchesStudent(student, targets);
        });

        res.json({
            success: true,
            data: matchedEvents
        });

    } catch (error) {
        console.error('Get student events error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            event_date,
            start_time,
            end_time,
            event_type,
            target_college,
            target_batch,
            target_course,
            target_branch,
            target_year,
            target_semester,
            image_url
        } = req.body;
        const registration = normalizeRegistrationSettings(req.body);

        await masterPool.query(
            `UPDATE events SET 
                title = ?, 
                description = ?, 
                event_date = ?, 
                end_date = ?,
                start_time = ?, 
                end_time = ?, 
                event_type = ?,
                target_college = ?, 
                target_batch = ?, 
                target_course = ?, 
                target_branch = ?, 
                target_year = ?, 
                target_semester = ?,
                requires_registration = ?,
                max_seats = ?,
                registration_deadline = ?,
                registration_form_fields = ?,
                image_url = ?
            WHERE id = ?`,
            [
                title,
                description,
                event_date,
                req.body.end_date || null,
                start_time || null,
                end_time || null,
                event_type,
                serializeTarget(target_college),
                serializeTarget(target_batch),
                serializeTarget(target_course),
                serializeTarget(target_branch),
                serializeTarget(target_year),
                serializeTarget(target_semester),
                registration.requiresRegistration ? 1 : 0,
                registration.maxSeats,
                registration.deadline,
                registration.fields,
                image_url || null,
                id
            ]
        );

        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
};

exports.getEventRegistrations = async (req, res) => {
    try {
        const { id } = req.params;
        const [events] = await masterPool.query(
            `SELECT e.id, e.title, e.requires_registration, e.max_seats,
                    e.registration_deadline, e.registration_form_fields,
                    COALESCE(reg.registered_count, 0) AS registered_count
             FROM events e
             LEFT JOIN (
                 SELECT event_id, COUNT(*) AS registered_count
                 FROM event_registrations
                 WHERE status = 'confirmed'
                 GROUP BY event_id
             ) reg ON reg.event_id = e.id
             WHERE e.id = ? LIMIT 1`,
            [id]
        );
        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const [registrations] = await masterPool.query(
            `SELECT id, student_id, student_name, pin_number, college, branch,
                    current_year, current_semester, phone, email, form_responses, registered_at
             FROM event_registrations
             WHERE event_id = ? AND status = 'confirmed'
             ORDER BY registered_at ASC`,
            [id]
        );

        res.json({
            success: true,
            data: {
                event: {
                    ...events[0],
                    requires_registration: Boolean(events[0].requires_registration),
                    max_seats: events[0].max_seats ? Number(events[0].max_seats) : null,
                    registration_form_fields: parseRegistrationFields(events[0].registration_form_fields)
                },
                registrations: registrations.map((registration) => ({
                    ...registration,
                    form_responses: parseRegistrationResponses(registration.form_responses)
                }))
            }
        });
    } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE' && error.message.includes('event_registrations')) {
            console.error('Event registrations table is missing. Run the backend database migrations.');
            return res.status(503).json({
                success: false,
                message: 'Event registrations are not set up yet. Run the backend database migrations.'
            });
        }
        console.error('Get event registrations error:', error);
        res.status(500).json({ success: false, message: 'Failed to load event registrations' });
    }
};

exports.registerForEvent = async (req, res) => {
    let connection;
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ success: false, message: 'Student account required' });
        }
        const { admission_number, admissionNumber } = req.user || {};
        const admissionNumberValue = admission_number || admissionNumber;
        if (!admissionNumberValue) {
            return res.status(403).json({ success: false, message: 'Student account required' });
        }

        const [students] = await masterPool.query(
            `SELECT id, student_name, admission_number, pin_no, college, course, branch,
                    batch, current_year, current_semester, student_mobile, email, student_status
             FROM students
             WHERE admission_number = ? OR admission_no = ? LIMIT 1`,
            [admissionNumberValue, admissionNumberValue]
        );
        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        const student = students[0];
        if (student.student_status && String(student.student_status).toLowerCase() !== 'regular') {
            return res.status(403).json({ success: false, message: 'Only active students can register' });
        }

        const submittedResponses = req.body.form_responses || {};
        let responses;
        try {
            responses = typeof submittedResponses === 'string'
                ? JSON.parse(submittedResponses)
                : submittedResponses;
        } catch (error) {
            return res.status(400).json({ success: false, message: 'Registration responses are invalid' });
        }
        if (!responses || typeof responses !== 'object' || Array.isArray(responses)) {
            return res.status(400).json({ success: false, message: 'Registration responses are invalid' });
        }

        connection = await masterPool.getConnection();
        await connection.beginTransaction();
        const [events] = await connection.query(
            'SELECT * FROM events WHERE id = ? AND is_active = 1 FOR UPDATE',
            [req.params.id]
        );
        if (events.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Event not found or inactive' });
        }

        const event = events[0];
        const [registrationCountRows] = await connection.query(
            `SELECT COUNT(*) AS registered_count FROM event_registrations
             WHERE event_id = ? AND status = 'confirmed'`,
            [event.id]
        );
        const registeredCount = Number(registrationCountRows[0].registered_count || 0);
        if (!event.requires_registration) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Registration is not enabled for this event' });
        }
        if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: 'Registration deadline has passed' });
        }
        const targets = parseTargetsFromRow(event);
        if (event.event_type !== 'holiday' && !matchesStudent(student, targets)) {
            await connection.rollback();
            return res.status(403).json({ success: false, message: 'This event is not available to your student scope' });
        }

        const [existing] = await connection.query(
            'SELECT id, status FROM event_registrations WHERE event_id = ? AND student_id = ? LIMIT 1',
            [event.id, student.id]
        );
        if (existing.length > 0 && existing[0].status === 'confirmed') {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'You are already registered' });
        }
        if (event.max_seats && registeredCount >= Number(event.max_seats)) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Registration is full' });
        }

        const fields = parseRegistrationFields(event.registration_form_fields);
        for (const field of fields) {
            if (!field.required) continue;
            const value = responses[field.id || field.label];
            if (value === undefined || value === null || String(value).trim() === '') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: `Please complete: ${field.label}` });
            }
        }

        const values = [
            student.student_name || '',
            student.pin_no || student.admission_number || '',
            student.college,
            student.branch,
            student.current_year,
            student.current_semester,
            student.student_mobile,
            student.email,
            JSON.stringify(responses)
        ];
        if (existing.length > 0) {
            await connection.query(
                `UPDATE event_registrations SET
                    student_name = ?, pin_number = ?, college = ?, branch = ?,
                    current_year = ?, current_semester = ?, phone = ?, email = ?,
                    form_responses = ?, status = 'confirmed', registered_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [...values, existing[0].id]
            );
        } else {
            await connection.query(
                `INSERT INTO event_registrations
                    (event_id, student_id, student_name, pin_number, college, branch,
                     current_year, current_semester, phone, email, form_responses)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [event.id, student.id, ...values]
            );
        }
        await connection.commit();
        res.status(201).json({ success: true, message: 'Successfully registered for the event' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Event registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to register for the event' });
    } finally {
        if (connection) connection.release();
    }
};

exports.cancelEventRegistration = async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ success: false, message: 'Student account required' });
        }
        const { admission_number, admissionNumber } = req.user || {};
        const [students] = await masterPool.query(
            'SELECT id FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1',
            [admission_number || admissionNumber || '', admission_number || admissionNumber || '']
        );
        if (students.length === 0) {
            return res.status(404).json({ success: false, message: 'Student profile not found' });
        }
        await masterPool.query(
            `UPDATE event_registrations SET status = 'cancelled'
             WHERE event_id = ? AND student_id = ? AND status = 'confirmed'`,
            [req.params.id, students[0].id]
        );
        res.json({ success: true, message: 'Event registration cancelled' });
    } catch (error) {
        console.error('Cancel event registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to cancel registration' });
    }
};

exports.removeEventRegistration = async (req, res) => {
    try {
        await masterPool.query(
            `UPDATE event_registrations SET status = 'cancelled'
             WHERE id = ? AND event_id = ? AND status = 'confirmed'`,
            [req.params.registrationId, req.params.id]
        );
        res.json({ success: true, message: 'Event registration removed' });
    } catch (error) {
        console.error('Remove event registration error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove registration' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM events WHERE id = ?', [id]);
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
};

exports.toggleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        await masterPool.query('UPDATE events SET is_active = ? WHERE id = ?', [is_active, id]);
        res.json({ success: true, message: 'Status updated' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update status' });
    }
};

// Helper: Notify targeted students
const notifyTargetedStudents = async (event) => {
    // 1. Build query to find matching students
    let query = `SELECT id FROM students WHERE student_status = 'Regular'`;
    const params = [];

    const addCondition = (field, values) => {
        if (values && Array.isArray(values) && values.length > 0) {
            query += ` AND ${field} IN (${values.map(() => '?').join(',')})`;
            params.push(...values);
        } else if (values && typeof values === 'string') {
            query += ` AND ${field} = ?`;
            params.push(values);
        }
    };

    addCondition('college', event.target_college);
    addCondition('batch', event.target_batch);
    addCondition('course', event.target_course);
    addCondition('branch', event.target_branch);
    addCondition('current_year', event.target_year);
    addCondition('current_semester', event.target_semester);

    const [students] = await masterPool.query(query, params);

    if (students.length === 0) return;

    console.log(`Sending event notification to ${students.length} students...`);

    const payload = {
        title: `New Event: ${event.title}`,
        body: `${event.description ? event.description.substring(0, 50) + '...' : 'Check event calendar for details.'}`,
        icon: '/icon-192x192.png',
        data: {
            url: 'https://pydahgroup.com/student/events'
        }
    };

    // Send Web Notifications
    const studentIds = students.map(s => s.id);
    await createBroadcastNotification(studentIds, {
        title: `New Event: ${event.title}`,
        message: event.description ? event.description.substring(0, 100) : 'Check event calendar',
        category: 'Event'
    });

    // Send in batches to avoid overwhelming (basic batching is handled by Node event loop naturally here for simple map)
    const promises = students.map(student => sendNotificationToUser(student.id, payload));
    await Promise.allSettled(promises);
    console.log('Event notifications sent.');
};
