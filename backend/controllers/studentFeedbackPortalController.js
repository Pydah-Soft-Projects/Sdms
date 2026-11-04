const { masterPool, academicPool } = require('../config/database');
const crypto = require('crypto');

const generateStudentToken = (studentId, publicationId, subjectName) => {
    const raw = `${studentId}-${publicationId}-${String(subjectName || '').trim().toLowerCase()}`;
    return 'anon_' + crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
};

const resolveStudent = async (studentId) => {
    const [rows] = await masterPool.query(
        `SELECT s.id, s.college_id, s.branch_id, s.course_id,
                s.section, s.batch, s.current_year, s.current_semester AS semester,
                c.name AS college_name, c.code AS college_code,
                COALESCE(cb.name, s.branch) AS branch_name,
                cb.code AS branch_code,
                s.branch AS raw_branch,
                COALESCE(co.name, s.course) AS course_name,
                co.code AS course_code,
                s.course AS raw_course
         FROM students s
         LEFT JOIN colleges        c  ON c.id  = s.college_id
         LEFT JOIN courses         co ON co.id = s.course_id
         LEFT JOIN course_branches cb ON cb.id = s.branch_id
         WHERE s.id = ? LIMIT 1`,
        [studentId]
    );
    return rows.length ? rows[0] : null;
};

const parseJsonSafe = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return null; }
};

const normSec = (val) => String(val || '').toUpperCase().replace(/^(SEC|SECTION)[\s\-_]*/i, '').trim();

exports.getActivePublications = async (req, res) => {
    try {
        const studentId = req.user && req.user.id;
        if (!studentId) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const student = await resolveStudent(studentId);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const now = new Date();
        const [pubs] = await academicPool.query(
            `SELECT * FROM ap_feedback_publications
             WHERE is_active = 1 AND end_date >= ?
             ORDER BY start_date ASC, created_at DESC`,
            [now]
        );

        if (!pubs.length) return res.json({ success: true, data: [], student });

        const studentCollegeId   = student.college_id ? Number(student.college_id) : null;
        const studentCourseId    = student.course_id ? Number(student.course_id) : null;
        const studentBranchId    = student.branch_id ? Number(student.branch_id) : null;

        const studentCollegeName = (student.college_name || '').trim().toUpperCase();
        const studentCourseName  = (student.course_name || student.raw_course || '').trim().toUpperCase();
        const studentBranchName  = (student.branch_name || student.raw_branch || '').trim().toUpperCase();
        const studentBranchCode  = (student.branch_code || '').trim().toUpperCase();

        const studentSection     = (student.section || '').trim().toUpperCase();
        const studentBatch       = String(student.batch || '').trim();

        const studentYearRaw = (student.current_year != null && student.current_year !== '') ? Number(student.current_year) : null;
        const studentSemRaw  = (student.semester != null && student.semester !== '') ? Number(student.semester) : null;

        // Calculate student's absolute semester (1-8), within-year semester (1-2), and year of study (1-4)
        let studentCalculatedYear = studentYearRaw;
        let studentWithinYearSem  = null;
        let studentAbsoluteSem    = null;

        if (studentSemRaw !== null) {
            if (studentSemRaw > 2) {
                // Already absolute semester (e.g. sem 3, 4, 5, 6, 7, 8)
                studentAbsoluteSem = studentSemRaw;
                studentWithinYearSem = ((studentSemRaw - 1) % 2) + 1;
                if (!studentCalculatedYear) {
                    studentCalculatedYear = Math.ceil(studentSemRaw / 2);
                }
            } else if (studentSemRaw >= 1) {
                // Within-year semester (1 or 2)
                studentWithinYearSem = studentSemRaw;
                if (studentCalculatedYear) {
                    studentAbsoluteSem = (studentCalculatedYear - 1) * 2 + studentSemRaw;
                } else {
                    studentAbsoluteSem = studentSemRaw;
                }
            }
        }

        // 1. Publication-Level Target Scoping Filter
        const scopedPubs = pubs.filter(pub => {
            // College filter
            if (pub.college_id && studentCollegeId && Number(pub.college_id) !== studentCollegeId) {
                return false;
            }
            const targetColleges = parseJsonSafe(pub.target_colleges);
            if (Array.isArray(targetColleges) && targetColleges.length > 0 && studentCollegeId) {
                const hasMatch = targetColleges.some(c => Number(c?.id || c) === studentCollegeId);
                if (!hasMatch) return false;
            }

            // Course filter
            if (pub.course_id && studentCourseId && Number(pub.course_id) !== studentCourseId) {
                return false;
            }
            const targetCourses = parseJsonSafe(pub.target_courses);
            if (Array.isArray(targetCourses) && targetCourses.length > 0 && studentCourseId) {
                const hasMatch = targetCourses.some(c => Number(c?.id || c) === studentCourseId);
                if (!hasMatch) return false;
            }

            // Branch filter
            if (pub.branch_id && studentBranchId && Number(pub.branch_id) !== studentBranchId) {
                return false;
            }
            const targetBranches = parseJsonSafe(pub.target_branches);
            if (Array.isArray(targetBranches) && targetBranches.length > 0 && studentBranchId) {
                const hasMatch = targetBranches.some(b => Number(b?.id || b) === studentBranchId);
                if (!hasMatch) return false;
            }

            // Target Audience (years of study, batches, sections)
            const targetAudience = parseJsonSafe(pub.target_audience);
            if (targetAudience) {
                if (Array.isArray(targetAudience.yearsOfStudy) && targetAudience.yearsOfStudy.length > 0 && studentCalculatedYear) {
                    if (!targetAudience.yearsOfStudy.map(Number).includes(studentCalculatedYear)) {
                        return false;
                    }
                }
                if (Array.isArray(targetAudience.batches) && targetAudience.batches.length > 0 && studentBatch) {
                    const batchMatch = targetAudience.batches.some(b => {
                        const bStr = String(b || '').trim();
                        return bStr === studentBatch || studentBatch.includes(bStr) || bStr.includes(studentBatch);
                    });
                    if (!batchMatch) return false;
                }
                if (Array.isArray(targetAudience.sections) && targetAudience.sections.length > 0 && studentSection) {
                    const stNorm = normSec(studentSection);
                    const secMatch = targetAudience.sections.some(s => {
                        const sNorm = normSec(s);
                        return sNorm === 'ALL' || sNorm === stNorm;
                    });
                    if (!secMatch) return false;
                }
            }

            // Semester filter
            if (pub.semester != null && pub.semester !== '') {
                const pSem = Number(pub.semester);
                if (pSem > 2) {
                    if (studentAbsoluteSem !== null && pSem !== studentAbsoluteSem) return false;
                } else if (pSem >= 1) {
                    if (studentWithinYearSem !== null && pSem !== studentWithinYearSem) return false;
                }
            }

            return true;
        });

        // 2. Map publications and filter mapped subjects strictly for the student
        const filtered = scopedPubs.map(pub => {
            const subjects = parseJsonSafe(pub.mapped_staff_subjects) || [];

            const relevant = subjects.filter(s => {
                // College match
                if (s.collegeId && studentCollegeId && Number(s.collegeId) !== studentCollegeId) {
                    return false;
                }

                // Course match (by ID or Course Name)
                if (s.courseId && studentCourseId && Number(s.courseId) !== studentCourseId) {
                    return false;
                }
                const sCourse = (s.courseName || s.course || '').trim().toUpperCase();
                if (sCourse && studentCourseName) {
                    const matchCourse = (sCourse === studentCourseName) ||
                                        sCourse.includes(studentCourseName) ||
                                        studentCourseName.includes(sCourse);
                    if (!matchCourse && !s.courseId) return false;
                }

                // Branch match (CRITICAL: match by branchId and branchName/code)
                if (s.branchId && studentBranchId && Number(s.branchId) !== studentBranchId) {
                    return false;
                }
                const sBranch = (s.branchName || s.branch || '').trim().toUpperCase();
                if (sBranch) {
                    const branchNames = [
                        studentBranchName,
                        studentBranchCode,
                        (student.raw_branch || '').trim().toUpperCase()
                    ].filter(Boolean);

                    if (branchNames.length > 0) {
                        const matchesBranchName = branchNames.some(b => 
                            sBranch === b || sBranch.includes(b) || b.includes(sBranch)
                        );
                        if (!matchesBranchName && !s.branchId) return false;
                    }
                }

                // Year of Study Match (CRITICAL: prevents subjects from other years)
                const sy = (s.yearOfStudy != null && s.yearOfStudy !== '') ? Number(s.yearOfStudy) : null;
                if (sy !== null && studentCalculatedYear !== null && sy !== studentCalculatedYear) {
                    return false;
                }

                // Semester Match (CRITICAL: match absolute or within-year with matching year)
                const sm = (s.semester != null && s.semester !== '') ? Number(s.semester) : null;
                if (sm !== null) {
                    if (studentAbsoluteSem !== null && sm === studentAbsoluteSem) {
                        // Direct absolute semester match
                    } else if (sy !== null && studentCalculatedYear !== null && sy === studentCalculatedYear) {
                        // Same year: match within-year semester (e.g. sem 2 in year 2)
                        if (studentWithinYearSem !== null && sm === studentWithinYearSem) {
                            // Matched within-year
                        } else {
                            return false;
                        }
                    } else if (studentSemRaw !== null && sm === studentSemRaw && (!sy || !studentCalculatedYear || sy === studentCalculatedYear)) {
                        // Direct semester match when year matches or not specified
                    } else {
                        return false;
                    }
                }

                // Section match (allow empty/ALL or exact normalized match)
                const sSec = normSec(s.sectionName || s.section);
                const stSec = normSec(studentSection);
                if (sSec && sSec !== 'ALL' && stSec && sSec !== stSec) {
                    return false;
                }

                // Batch match
                const sb = String(s.batch || '').trim();
                if (sb && sb.toUpperCase() !== 'ALL' && studentBatch) {
                    const batchMatches = (sb === studentBatch) ||
                                         studentBatch.includes(sb) ||
                                         sb.includes(studentBatch);
                    if (!batchMatches) return false;
                }

                return true;
            });

            // Deduplicate mapped subjects within this publication so each subject & faculty appears once
            const dedupedSubjects = [];
            const seenSubj = new Set();
            for (const sub of relevant) {
                const subKey = `${(sub.subjectCode || '').trim().toLowerCase()}_${(sub.subjectName || '').trim().toLowerCase()}_${(sub.facultyName || '').trim().toLowerCase()}_${normSec(sub.sectionName || sub.section)}`;
                if (!seenSubj.has(subKey)) {
                    seenSubj.add(subKey);
                    dedupedSubjects.push(sub);
                }
            }

            const pubStart = new Date(pub.start_date);
            const pubEnd = new Date(pub.end_date);
            const isScheduled = pubStart.getTime() > now.getTime();
            const isClosed = !pub.is_active || pubEnd.getTime() < now.getTime();
            const status = isClosed ? 'closed' : isScheduled ? 'scheduled' : 'active';

            return {
                id: pub.id,
                title: pub.title,
                formId: pub.form_id,
                academicYear: pub.academic_year,
                semester: pub.semester,
                startDate: pub.start_date,
                endDate: pub.end_date,
                createdAt: pub.created_at,
                isScheduled,
                status,
                mappedStaffSubjects: dedupedSubjects
            };
        }).filter(p => p.mappedStaffSubjects.length > 0);

        // 3. Check already submitted subjects for this student across publications
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
            success: true,
            data: pubsWithSubmissions,
            student: {
                id: student.id,
                college_id: student.college_id,
                college: student.college_name,
                branch_id: student.branch_id,
                branch: student.branch_name,
                course_id: student.course_id,
                course: student.course_name || student.course,
                section: student.section,
                batch: student.batch,
                year: student.current_year,
                semester: student.semester
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
            'SELECT * FROM ap_feedback_publications WHERE id = ? AND is_active = 1 LIMIT 1',
            [publicationId]
        );
        if (!pubs.length) return res.status(400).json({ success: false, message: 'Feedback session not found or inactive' });

        const pub = pubs[0];
        const pubStart = new Date(pub.start_date);
        const pubEnd = new Date(pub.end_date);
        if (pubStart.getTime() > now.getTime()) {
            return res.status(400).json({
                success: false,
                message: `This feedback session is scheduled to start on ${pubStart.toLocaleString('en-IN')}. Submissions will open then.`
            });
        }
        if (pubEnd.getTime() < now.getTime()) {
            return res.status(400).json({
                success: false,
                message: 'This feedback session deadline has passed and is now closed.'
            });
        }
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
