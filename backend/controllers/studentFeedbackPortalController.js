const { masterPool, academicPool } = require('../config/database');
const crypto = require('crypto');

const resolveStudent = async (studentId) => {
    const [rows] = await masterPool.query(
        `SELECT s.id, s.college_id, s.section, s.batch, s.current_semester AS semester,
                c.name AS college_name, cb.name AS branch_name
         FROM students s
         LEFT JOIN colleges        c  ON c.id  = s.college_id
         LEFT JOIN course_branches cb ON cb.id = s.branch_id
         WHERE s.id = ? LIMIT 1`,
        [studentId]
    );
    return rows.length ? rows[0] : null;
};

exports.getActivePublications = async (req, res) => {
    try {
        const studentId = req.user && req.user.id;
        if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const student = await resolveStudent(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const now = new Date();
        const [pubs] = await academicPool.query(
            `SELECT * FROM ap_feedback_publications
             WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
             ORDER BY created_at DESC`,
            [now, now]
        );

        if (!pubs.length) return res.json({ success: true, data: [], student });

        const studentSection = (student.section || '').trim().toUpperCase();
        const studentBatch   = String(student.batch || '').trim();
        const studentSem     = Number(student.semester);

        const filtered = pubs.map(pub => {
            let subjects = pub.mapped_staff_subjects;
            try { subjects = typeof subjects === 'string' ? JSON.parse(subjects) : (subjects || []); } catch (e) { subjects = []; }

            const relevant = subjects.filter(s => {
                const ss = (s.sectionName || '').trim().toUpperCase();
                const sb = String(s.batch || '').trim();
                const sm = (s.semester != null) ? Number(s.semester) : null;
                return (!ss || ss === studentSection) && (!sb || sb === studentBatch) && (sm === null || sm === studentSem);
            });

            return {
                id: pub.id, title: pub.title, formId: pub.form_id,
                academicYear: pub.academic_year, semester: pub.semester,
                startDate: pub.start_date, endDate: pub.end_date,
                mappedStaffSubjects: relevant
            };
        }).filter(p => p.mappedStaffSubjects.length > 0);

        res.json({
            success: true, data: filtered,
            student: {
                id: student.id, college_id: student.college_id,
                college: student.college_name, branch: student.branch_name,
                section: student.section, batch: student.batch, semester: student.semester
            }
        });
    } catch (err) {
        console.error('[StudentFeedback] getActivePublications error:', err);
        res.status(500).json({ success: false, message: 'Failed to load feedback sessions' });
    }
};

exports.getFeedbackForm = async (req, res) => {
    try {
        const { formId } = req.params;
        const [forms] = await academicPool.query(
            'SELECT id, name FROM ap_feedback_forms WHERE id = ? LIMIT 1', [formId]
        );
        if (!forms.length) return res.status(404).json({ success: false, message: 'Form not found' });

        const [qRows] = await academicPool.query(
            `SELECT id, question_text, question_type, is_required, min_value, max_value, options_json
             FROM ap_feedback_questions WHERE form_id = ? ORDER BY order_index ASC, id ASC`,
            [formId]
        );

        const questions = qRows.map(q => ({
            id: q.id,
            questionText: q.question_text,
            questionType: q.question_type,
            isRequired: !!q.is_required,
            minValue: q.min_value,
            maxValue: q.max_value,
            options: (() => {
                try { return q.options_json ? (typeof q.options_json === 'string' ? JSON.parse(q.options_json) : q.options_json) : []; }
                catch (e) { return []; }
            })()
        }));

        res.json({ success: true, data: { id: forms[0].id, name: forms[0].name, questions } });
    } catch (err) {
        console.error('[StudentFeedback] getFeedbackForm error:', err);
        res.status(500).json({ success: false, message: 'Failed to load form' });
    }
};

exports.submitFeedback = async (req, res) => {
    let conn;
    try {
        const studentId = req.user && req.user.id;
        const { publicationId } = req.params;
        if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { subjectName, facultyName, sectionName, answers } = req.body;
        if (!subjectName || !facultyName || !answers || typeof answers !== 'object')
            return res.status(400).json({ success: false, message: 'Missing required fields' });

        const student = await resolveStudent(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const now = new Date();
        const [pubs] = await academicPool.query(
            'SELECT * FROM ap_feedback_publications WHERE id = ? AND is_active = 1 AND start_date <= ? AND end_date >= ? LIMIT 1',
            [publicationId, now, now]
        );
        if (!pubs.length) return res.status(400).json({ success: false, message: 'Session not active' });

        const pub = pubs[0];
        const unitsCovered  = answers['unitsCovered']  != null ? String(answers['unitsCovered'])  : null;
        const facultyRating = answers['facultyRating'] != null ? Number(answers['facultyRating']) : null;
        const unitStatus    = answers['unitStatus']    != null ? String(answers['unitStatus'])    : null;
        const token = 'anon_' + crypto.createHash('sha256').update(
            studentId + '-' + publicationId + '-' + subjectName + '-' + facultyName + '-' + Date.now()
        ).digest('hex').slice(0, 12);

        conn = await academicPool.pool.getConnection();
        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO ap_feedback_responses
                (publication_id, form_id, college_id, branch_name, academic_year, semester,
                 section_name, subject_name, faculty_name, units_covered, faculty_rating,
                 unit_status, answers_json, student_token_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicationId, pub.form_id, student.college_id, student.branch_name,
             pub.academic_year, pub.semester, sectionName || student.section,
             subjectName, facultyName, unitsCovered, facultyRating, unitStatus,
             JSON.stringify(answers), token]
        );
        await conn.commit();
        res.json({ success: true, message: 'Feedback submitted', token });
    } catch (err) {
        if (conn) await conn.rollback();
        console.error('[StudentFeedback] submitFeedback error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit feedback' });
    } finally {
        if (conn) conn.release();
    }
};
