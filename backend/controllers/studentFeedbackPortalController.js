const { masterPool, academicPool } = require('../config/database');
const crypto = require('crypto');

const generateStudentToken = (studentId, publicationId, subjectName) => {
    const raw = `${studentId}-${publicationId}-${String(subjectName || '').trim().toLowerCase()}`;
    return 'anon_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
};

const resolveStudent = async (studentId) => {
    const [rows] = await masterPool.query(
        `SELECT s.id, s.college_id, s.section, s.batch, s.current_year, s.current_semester AS semester,
                c.name AS college_name, COALESCE(cb.name, s.branch) AS branch_name, s.course
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
        const studentYear    = (student.current_year != null) ? Number(student.current_year) : null;
        const studentSem     = (student.semester != null) ? Number(student.semester) : null;
        const studentAbsoluteSem = (studentYear && studentSem) ? (studentYear - 1) * 2 + studentSem : null;
        const studentBranch  = (student.branch_name || '').trim().toUpperCase();
        const studentCollegeId = student.college_id ? Number(student.college_id) : null;
        const studentCourse  = (student.course || '').trim().toUpperCase();

        // 1. Publication-level semester filter (if a publication is targeted to a specific semester)
        const semMatchedPubs = pubs.filter(pub => {
            if (pub.semester != null && pub.semester !== '') {
                const pSem = Number(pub.semester);
                if (studentSem !== null) {
                    const semWithinYear = ((pSem - 1) % 2) + 1;
                    const matchesDirect = (pSem === studentSem);
                    const matchesAbsolute = (studentAbsoluteSem !== null && pSem === studentAbsoluteSem);
                    const matchesMod = (semWithinYear === studentSem);
                    if (!matchesDirect && !matchesAbsolute && !matchesMod) return false;
                }
            }
            return true;
        });

        // 2. Deduplicate re-published sessions sharing title, form_id, and academic_year
        const seenPubKeys = new Set();
        const uniquePubs = [];
        for (const pub of semMatchedPubs) {
            const key = `${pub.form_id}_${(pub.academic_year || '').trim()}_${(pub.title || '').trim().toLowerCase()}`;
            if (!seenPubKeys.has(key)) {
                seenPubKeys.add(key);
                uniquePubs.push(pub);
            }
        }

        const filtered = uniquePubs.map(pub => {
            let subjects = pub.mapped_staff_subjects;
            try { subjects = typeof subjects === 'string' ? JSON.parse(subjects) : (subjects || []); } catch (e) { subjects = []; }

            const relevant = subjects.filter(s => {
                // Section match (allow empty section on subject or match student's section)
                const ss = (s.sectionName || s.section || '').trim().toUpperCase();
                if (ss && studentSection && ss !== studentSection) return false;

                // Batch match
                const sb = String(s.batch || '').trim();
                if (sb && studentBatch && sb !== studentBatch) return false;

                // Branch match
                const sBranch = (s.branchName || s.branch || '').trim().toUpperCase();
                if (sBranch && studentBranch && sBranch !== studentBranch) return false;

                // College match
                if (s.collegeId && studentCollegeId && Number(s.collegeId) !== studentCollegeId) return false;

                // Course match (if specified on mapped subject)
                const sCourse = (s.courseName || s.course || '').trim().toUpperCase();
                if (sCourse && studentCourse && sCourse !== studentCourse) return false;

                // Year match (if specified on mapped subject)
                const sy = (s.yearOfStudy != null && s.yearOfStudy !== '') ? Number(s.yearOfStudy) : null;
                if (sy !== null && studentYear !== null && sy !== studentYear) return false;

                // Semester match (supports within-year 1-2, absolute 1-8, and mod 2)
                const sm = (s.semester != null && s.semester !== '') ? Number(s.semester) : null;
                if (sm !== null && studentSem !== null) {
                    const semWithinYear = ((sm - 1) % 2) + 1;
                    const matchesDirect = (sm === studentSem);
                    const matchesAbsolute = (studentAbsoluteSem !== null && sm === studentAbsoluteSem);
                    const matchesMod = (semWithinYear === studentSem);

                    if (!matchesDirect && !matchesAbsolute && !matchesMod) return false;
                }

                return true;
            });

            return {
                id: pub.id, title: pub.title, formId: pub.form_id,
                academicYear: pub.academic_year, semester: pub.semester,
                startDate: pub.start_date, endDate: pub.end_date,
                mappedStaffSubjects: relevant
            };
        }).filter(p => p.mappedStaffSubjects.length > 0);

        // Check already submitted subjects for this student across publications
        const pubsWithSubmissions = await Promise.all(filtered.map(async (pub) => {
            const tokenToSubject = {};
            (pub.mappedStaffSubjects || []).forEach(s => {
                if (s.subjectName) {
                    const token = generateStudentToken(studentId, pub.id, s.subjectName);
                    tokenToSubject[token] = s.subjectName;
                }
            });

            const tokens = Object.keys(tokenToSubject);
            let submittedSubjects = [];
            if (tokens.length > 0) {
                try {
                    const [subRows] = await academicPool.query(
                        `SELECT student_token_hash FROM ap_feedback_responses 
                         WHERE publication_id = ? AND student_token_hash IN (${tokens.map(() => '?').join(',')})`,
                        [pub.id, ...tokens]
                    );
                    submittedSubjects = subRows.map(r => tokenToSubject[r.student_token_hash]).filter(Boolean);
                } catch (subErr) {
                    console.error('[StudentFeedback] checking existing submissions error:', subErr);
                }
            }

            return {
                ...pub,
                submittedSubjects
            };
        }));

        res.json({
            success: true, data: pubsWithSubmissions,
            student: {
                id: student.id,
                college_id: student.college_id,
                college: student.college_name,
                branch: student.branch_name,
                section: student.section,
                batch: student.batch,
                year: student.current_year,
                semester: student.semester,
                course: student.course
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
        const token = generateStudentToken(studentId, publicationId, subjectName);

        conn = await academicPool.pool.getConnection();
        await conn.beginTransaction();

        // Validate that feedback for this subject has not already been submitted by this student
        const [existing] = await conn.query(
            'SELECT id FROM ap_feedback_responses WHERE publication_id = ? AND student_token_hash = ? LIMIT 1',
            [publicationId, token]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Feedback for this subject has already been submitted.'
            });
        }

        const unitsCovered  = answers['unitsCovered']  != null ? String(answers['unitsCovered'])  : null;
        const facultyRating = answers['facultyRating'] != null ? Number(answers['facultyRating']) : null;
        const unitStatus    = answers['unitStatus']    != null ? String(answers['unitStatus'])    : null;

        await conn.query(
            `INSERT INTO ap_feedback_responses
                (publication_id, form_id, college_id, branch_name, academic_year, semester,
                 section_name, subject_name, faculty_name, units_covered, faculty_rating,
                 unit_status, answers_json, student_token_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [publicationId, pub.form_id, student.college_id, student.branch_name,
             pub.academic_year, pub.semester || student.semester, sectionName || student.section,
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
