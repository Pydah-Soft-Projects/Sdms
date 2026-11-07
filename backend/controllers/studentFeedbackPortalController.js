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
    if (!rows.length) return null;
    const student = rows[0];

    // If branch_id or branch_code is missing, try to resolve from course_branches by branch string
    if ((!student.branch_id || !student.branch_code) && (student.branch_name || student.raw_branch)) {
        try {
            const raw = (student.branch_name || student.raw_branch || '').trim();
            const [cb] = await masterPool.query(
                `SELECT id, name, code, course_id FROM course_branches 
                 WHERE UPPER(TRIM(code)) = UPPER(?) OR UPPER(TRIM(name)) = UPPER(?)
                 LIMIT 1`,
                [raw, raw]
            );
            if (cb.length > 0) {
                if (!student.branch_id) student.branch_id = cb[0].id;
                if (!student.branch_name) student.branch_name = cb[0].name;
                if (!student.branch_code) student.branch_code = cb[0].code;
                if (!student.course_id && cb[0].course_id) student.course_id = cb[0].course_id;
            }
        } catch (e) {
            // ignore lookup error
        }
    }

    return student;
};

const parseJsonSafe = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch (e) { return null; }
};

const normSec = (val) => String(val || '').toUpperCase().replace(/^(SEC|SECTION)[\s\-_]*/i, '').trim();

const extractSecToken = (sec) => {
    const raw = normSec(sec);
    // If 'CSE-A' or 'CIVIL - B' or 'A (CSE)', extract the trailing letter or number
    const m = raw.match(/([A-Z0-9]+)\s*(\([A-Z0-9\s]+\))?$/i);
    return m ? m[1].toUpperCase() : raw;
};

const cleanBranchStr = (str) => {
    return String(str || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const BRANCH_ALIASES = [
    { code: 'CSE', aliases: ['CSE', 'COMPUTER SCIENCE', 'COMPUTER SCIENCE ENGINEERING', 'COMPUTER SCIENCE AND ENGINEERING', 'COMPUTER SCIENCE & ENGINEERING'] },
    { code: 'ECE', aliases: ['ECE', 'ELECTRONICS', 'ELECTRONICS AND COMMUNICATION', 'ELECTRONICS & COMMUNICATION', 'ELECTRONICS AND COMMUNICATION ENGINEERING', 'ELECTRONICS & COMMUNICATION ENGINEERING'] },
    { code: 'MECH', aliases: ['MECH', 'MECHANICAL', 'MECHANICAL ENGINEERING'] },
    { code: 'CIVIL', aliases: ['CIVIL', 'CIVIL ENGINEERING'] },
    { code: 'EEE', aliases: ['EEE', 'ELECTRICAL', 'ELECTRICAL AND ELECTRONICS', 'ELECTRICAL & ELECTRONICS', 'ELECTRICAL AND ELECTRONICS ENGINEERING', 'ELECTRICAL & ELECTRONICS ENGINEERING'] },
    { code: 'IT', aliases: ['IT', 'INFORMATION TECHNOLOGY'] },
    { code: 'AIML', aliases: ['AIML', 'AI ML', 'AI & ML', 'AI AND ML', 'CSE AI ML', 'CSE AIML', 'CSE AI & ML', 'ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING', 'ARTIFICIAL INTELLIGENCE & MACHINE LEARNING', 'CSE ARTIFICIAL INTELLIGENCE AND MACHINE LEARNING'] },
    { code: 'AIDS', aliases: ['AIDS', 'AI DS', 'AI & DS', 'AI AND DS', 'CSE AI DS', 'CSE AIDS', 'CSE AI & DS', 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE', 'ARTIFICIAL INTELLIGENCE & DATA SCIENCE', 'CSE ARTIFICIAL INTELLIGENCE AND DATA SCIENCE'] },
    { code: 'DS', aliases: ['DS', 'DATA SCIENCE', 'CSE DS', 'CSE DATA SCIENCE'] },
    { code: 'CS', aliases: ['CS', 'CYBER SECURITY', 'CSE CYBER SECURITY', 'CSE CS'] },
    { code: 'IOT', aliases: ['IOT', 'INTERNET OF THINGS', 'CSE IOT'] },
    { code: 'MBA', aliases: ['MBA', 'MASTER OF BUSINESS ADMINISTRATION'] },
    { code: 'MCA', aliases: ['MCA', 'MASTER OF COMPUTER APPLICATIONS'] },
    { code: 'PHARM', aliases: ['B PHARM', 'B PHARMACY', 'PHARMACY', 'M PHARM', 'M PHARMACY', 'PHARMA'] },
    { code: 'DIPLOMA', aliases: ['DIPLOMA', 'POLYTECHNIC'] },
];

const branchesMatch = (b1, b2) => {
    if (!b1 || !b2) return false;
    const c1 = cleanBranchStr(b1);
    const c2 = cleanBranchStr(b2);
    if (!c1 || !c2) return false;
    if (c1 === c2) return true;
    if (c1.includes(c2) || c2.includes(c1)) return true;

    // Check alias sets
    for (const group of BRANCH_ALIASES) {
        const matches1 = group.aliases.some(a => {
            const ca = cleanBranchStr(a);
            return c1 === ca || c1.startsWith(ca + ' ') || c1.endsWith(' ' + ca) || c1.includes(ca);
        });
        const matches2 = group.aliases.some(a => {
            const ca = cleanBranchStr(a);
            return c2 === ca || c2.startsWith(ca + ' ') || c2.endsWith(' ' + ca) || c2.includes(ca);
        });
        if (matches1 && matches2) return true;
    }

    return false;
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
             WHERE is_active = 1 AND end_date >= ?
             ORDER BY start_date ASC, created_at DESC`,
            [now]
        );

        if (!pubs.length) return res.json({ success: true, data: [], student });

        // Load all course branches for fast accurate lookup and normalization
        const [allBranches] = await masterPool.query(`SELECT id, name, code FROM course_branches`).catch(() => [[]]);
        const branchLookup = new Map();
        (allBranches || []).forEach(b => {
            branchLookup.set(Number(b.id), b);
        });

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
            const pCollegeName = (pub.college_name || '').trim().toUpperCase();
            const isAllColleges = !pub.college_id || pCollegeName === 'ALL' || pCollegeName === 'ALL COLLEGES';
            if (!isAllColleges) {
                let colMatched = false;
                if (pub.college_id && studentCollegeId && Number(pub.college_id) === studentCollegeId) {
                    colMatched = true;
                } else if (pCollegeName && studentCollegeName && (pCollegeName === studentCollegeName || pCollegeName.includes(studentCollegeName) || studentCollegeName.includes(pCollegeName))) {
                    colMatched = true;
                }
                const targetColleges = parseJsonSafe(pub.target_colleges);
                if (Array.isArray(targetColleges) && targetColleges.length > 0) {
                    const matchTarget = targetColleges.some(c => {
                        const cId = Number(c?.id || c);
                        if (studentCollegeId && cId === studentCollegeId) return true;
                        const cName = String(c?.name || c || '').trim().toUpperCase();
                        return cName && studentCollegeName && (cName === studentCollegeName || cName.includes(studentCollegeName) || studentCollegeName.includes(cName));
                    });
                    if (matchTarget) colMatched = true;
                }
                if (!colMatched) return false;
            }

            // Course filter
            const pCourseName = (pub.course_name || '').trim().toUpperCase();
            const isAllCourses = !pub.course_id || pCourseName === 'ALL' || pCourseName === 'ALL COURSES';
            if (!isAllCourses) {
                let courseMatched = false;
                if (pub.course_id && studentCourseId && Number(pub.course_id) === studentCourseId) {
                    courseMatched = true;
                } else if (pCourseName && studentCourseName && (pCourseName === studentCourseName || pCourseName.includes(studentCourseName) || studentCourseName.includes(pCourseName))) {
                    courseMatched = true;
                }
                const targetCourses = parseJsonSafe(pub.target_courses);
                if (Array.isArray(targetCourses) && targetCourses.length > 0) {
                    const matchTarget = targetCourses.some(c => {
                        const cId = Number(c?.id || c);
                        if (studentCourseId && cId === studentCourseId) return true;
                        const cName = String(c?.name || c || '').trim().toUpperCase();
                        return cName && studentCourseName && (cName === studentCourseName || cName.includes(studentCourseName) || studentCourseName.includes(cName));
                    });
                    if (matchTarget) courseMatched = true;
                }
                if (!courseMatched) return false;
            }

            // Branch filter
            const pBranchName = (pub.branch_name || '').trim().toUpperCase();
            const isAllBranches = !pub.branch_id || pBranchName === 'ALL' || pBranchName === 'ALL BRANCHES';
            if (!isAllBranches) {
                let branchMatched = false;
                if (pub.branch_id && studentBranchId && Number(pub.branch_id) === studentBranchId) {
                    branchMatched = true;
                } else if (pBranchName && (branchesMatch(pBranchName, studentBranchName) || branchesMatch(pBranchName, studentBranchCode) || branchesMatch(pBranchName, student.raw_branch))) {
                    branchMatched = true;
                }
                const targetBranches = parseJsonSafe(pub.target_branches);
                if (Array.isArray(targetBranches) && targetBranches.length > 0) {
                    const matchTarget = targetBranches.some(b => {
                        const bId = Number(b?.id || b);
                        if (studentBranchId && bId === studentBranchId) return true;
                        const bName = b?.name || (typeof b === 'string' ? b : '');
                        const bCode = b?.code || '';
                        return branchesMatch(bName, studentBranchName) ||
                               branchesMatch(bName, studentBranchCode) ||
                               branchesMatch(bCode, studentBranchCode) ||
                               branchesMatch(bName, student.raw_branch);
                    });
                    if (matchTarget) branchMatched = true;
                }
                if (!branchMatched) return false;
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
                    const stToken = extractSecToken(studentSection);
                    const secMatch = targetAudience.sections.some(s => {
                        const sNorm = normSec(s);
                        const sToken = extractSecToken(s);
                        return sNorm === 'ALL' || sNorm === stNorm || sToken === stToken;
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
                    if (studentWithinYearSem !== null && pSem !== studentWithinYearSem && studentAbsoluteSem !== pSem) return false;
                }
            }

            return true;
        });

        // 2. Map publications and filter mapped subjects strictly for the student
        const filtered = await Promise.all(scopedPubs.map(async (pub) => {
            let subjects = parseJsonSafe(pub.mapped_staff_subjects) || [];

            const filterSubjectForStudent = (s) => {
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

                // Branch match (CRITICAL: match by branchId and branchName/code with aliases)
                const sBranchId = s.branchId ? Number(s.branchId) : null;
                const sBranchObj = sBranchId ? branchLookup.get(sBranchId) : null;
                const sBranchName = (s.branchName || s.branch || sBranchObj?.name || '').trim();
                const sBranchCode = (s.branchCode || sBranchObj?.code || '').trim();

                // If subject has branch restriction, verify student belongs to it
                if (sBranchId || sBranchName || sBranchCode) {
                    let branchMatch = false;
                    // 1. Direct ID match
                    if (sBranchId && studentBranchId && sBranchId === studentBranchId) {
                        branchMatch = true;
                    }
                    // 2. Name / alias match
                    if (!branchMatch) {
                        const studentNames = [
                            studentBranchName,
                            studentBranchCode,
                            (student.raw_branch || '').trim()
                        ].filter(Boolean);

                        for (const stName of studentNames) {
                            if (sBranchName && branchesMatch(sBranchName, stName)) {
                                branchMatch = true;
                                break;
                            }
                            if (sBranchCode && branchesMatch(sBranchCode, stName)) {
                                branchMatch = true;
                                break;
                            }
                        }
                    }

                    if (!branchMatch) {
                        return false;
                    }
                }

                // Year of Study Match (prevents subjects from other years)
                const sy = (s.yearOfStudy != null && s.yearOfStudy !== '') ? Number(s.yearOfStudy) : null;
                if (sy !== null && studentCalculatedYear !== null && sy !== studentCalculatedYear) {
                    return false;
                }

                // Semester Match (match absolute, within-year, or inferred year)
                const sm = (s.semester != null && s.semester !== '') ? Number(s.semester) : null;
                if (sm !== null) {
                    let semMatches = false;
                    if (studentAbsoluteSem !== null && sm === studentAbsoluteSem) {
                        semMatches = true;
                    } else if (sy !== null && studentCalculatedYear !== null && sy === studentCalculatedYear) {
                        if (studentWithinYearSem !== null && sm === studentWithinYearSem) {
                            semMatches = true;
                        } else if (studentSemRaw === null) {
                            semMatches = true;
                        }
                    } else if (studentSemRaw !== null && sm === studentSemRaw) {
                        semMatches = true;
                    } else if (studentSemRaw === null && studentCalculatedYear !== null && (!sy || sy === studentCalculatedYear)) {
                        semMatches = true;
                    } else if (studentSemRaw === null && studentCalculatedYear === null) {
                        semMatches = true;
                    }

                    if (!semMatches) return false;
                }

                // Section match (allow empty/ALL or matching section letter)
                const sSec = normSec(s.sectionName || s.section);
                const stSec = normSec(studentSection);
                if (sSec && sSec !== 'ALL' && stSec && stSec !== 'ALL') {
                    const sToken = extractSecToken(sSec);
                    const stToken = extractSecToken(stSec);
                    const secMatched = sSec === stSec || sSec.includes(stSec) || stSec.includes(sSec) || sToken === stToken;
                    if (!secMatched) return false;
                }

                // Batch match
                const sb = String(s.batch || '').trim();
                if (sb && sb.toUpperCase() !== 'ALL' && studentBatch && studentBatch.toUpperCase() !== 'ALL') {
                    const extractYear = (b) => { const m = String(b || '').match(/\d{4}/); return m ? m[0] : null; };
                    const sbYear = extractYear(sb);
                    const stYear = extractYear(studentBatch);
                    const batchMatches = (sb === studentBatch) ||
                                         studentBatch.includes(sb) ||
                                         sb.includes(studentBatch) ||
                                         (sbYear && stYear && sbYear === stYear);
                    if (!batchMatches) return false;
                }

                return true;
            };

            let relevant = subjects.filter(filterSubjectForStudent);

            // DYNAMIC TIMETABLE ENRICHMENT / FALLBACK:
            // If the publication's pre-mapped subjects didn't have entries for this student's branch/class,
            // query the academic timetable database directly for live faculty allocations!
            if (relevant.length === 0) {
                try {
                    const ttConds = [
                        "te.subject_name IS NOT NULL",
                        "TRIM(te.subject_name) != ''",
                        "te.subject_name != 'null'",
                        "sl.display_name IS NOT NULL",
                        "TRIM(sl.display_name) != ''",
                        "sl.display_name != 'null'",
                        "(tp.status IN ('published', 'active', 'draft', 'in_review') OR tp.status IS NULL)"
                    ];
                    const ttParams = [];

                    if (studentBranchId) {
                        ttConds.push("tp.branch_id = ?");
                        ttParams.push(studentBranchId);
                    }
                    if (studentCollegeId) {
                        ttConds.push("(tp.college_id = ? OR tp.college_id IS NULL)");
                        ttParams.push(studentCollegeId);
                    }
                    if (pub.academic_year) {
                        ttConds.push("(tp.academic_year_label = ? OR tp.academic_year_label LIKE ?)");
                        ttParams.push(pub.academic_year, `%${String(pub.academic_year).slice(0, 4)}%`);
                    }

                    const [liveRows] = await academicPool.query(
                        `SELECT
                          te.subject_id AS subjectId,
                          COALESCE(te.subject_code, '') AS subjectCode,
                          te.subject_name AS subjectName,
                          sl.id AS staffLinkId,
                          COALESCE(sl.display_name, 'Faculty') AS facultyName,
                          sl.employee_code AS employeeCode,
                          tp.college_id AS collegeId,
                          tp.course_id AS courseId,
                          tp.branch_id AS branchId,
                          tp.academic_year_label AS academicYear,
                          CASE
                            WHEN tp.year_of_study IS NOT NULL AND tp.year_of_study > 0
                              THEN (tp.year_of_study - 1) * 2 + COALESCE(tp.semester_number, 1)
                            ELSE COALESCE(tp.semester_number, 1)
                          END AS semester,
                          tp.year_of_study AS yearOfStudy,
                          tp.section_name AS sectionName,
                          tp.batch AS batch
                        FROM ap_timetable_entries te
                        INNER JOIN ap_timetable_plans tp ON tp.id = te.plan_id
                        LEFT JOIN ap_staff_link sl ON sl.id = te.faculty_staff_link_id
                        WHERE ${ttConds.join(" AND ")}
                        GROUP BY te.subject_id, te.subject_code, te.subject_name, sl.id, sl.display_name, sl.employee_code,
                                 tp.college_id, tp.course_id, tp.branch_id, tp.year_of_study, tp.semester_number, tp.section_name, tp.batch, tp.academic_year_label
                        LIMIT 200`,
                        ttParams
                    );

                    if (liveRows && liveRows.length > 0) {
                        relevant = liveRows.filter(filterSubjectForStudent);
                    }
                } catch (ttErr) {
                    console.warn('[StudentFeedback] Live timetable query fallback warning:', ttErr.message);
                }
            }

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
        }));

        const visiblePubs = filtered.filter(p => p.mappedStaffSubjects.length > 0);

        // 3. Check already submitted subjects for this student across publications
        const pubsWithSubmissions = await Promise.all(visiblePubs.map(async (pub) => {
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
