const { masterPool, academicPool } = require('../config/database');

const DAY_MAP = {
    'mon': 'Monday', 'monday': 'Monday',
    'tue': 'Tuesday', 'tues': 'Tuesday', 'tuesday': 'Tuesday',
    'wed': 'Wednesday', 'wednesday': 'Wednesday',
    'thu': 'Thursday', 'thur': 'Thursday', 'thurs': 'Thursday', 'thursday': 'Thursday',
    'fri': 'Friday', 'friday': 'Friday',
    'sat': 'Saturday', 'saturday': 'Saturday',
    'sun': 'Sunday', 'sunday': 'Sunday'
};

const normalizeDay = (day) => {
    if (!day) return '';
    const clean = String(day).trim().toLowerCase();
    return DAY_MAP[clean] || day;
};

/**
 * Timetable data fetcher - Strictly from Academic Portal DB (academic_portal)
 */
async function fetchTimetableData({ branch_id, branch, year, semester, section, faculty_id, faculty_name, student_id }) {
    try {
        if (!branch_id && branch) {
            try {
                const [bRows] = await masterPool.query(
                    'SELECT id FROM course_branches WHERE name = ? OR code = ? LIMIT 1',
                    [branch, branch]
                );
                if (bRows && bRows.length > 0) branch_id = bRows[0].id;
            } catch (e) {}
        }
        // 1. Faculty Timetable Lookup in Academic Portal DB
        if (faculty_id || faculty_name) {
            let staffId = faculty_id;
            let staffDisplayName = faculty_name;

            try {
                const [staffRows] = await academicPool.query(
                    `SELECT id, display_name, employee_code FROM ap_staff_link 
                     WHERE id = ? OR hrms_employee_id = ? OR employee_code = ? OR display_name = ? LIMIT 1`,
                    [faculty_id, faculty_id, faculty_id, faculty_name || faculty_id]
                );
                if (staffRows && staffRows.length > 0) {
                    staffId = staffRows[0].id;
                    staffDisplayName = staffRows[0].display_name;
                }
            } catch (staffErr) {
                console.warn('Academic Portal staff link lookup warning:', staffErr.message);
            }

            const [facultyEntries] = await academicPool.query(
                `SELECT 
                    e.*,
                    p.branch_id,
                    p.year_of_study,
                    p.semester_number,
                    p.section_name,
                    p.academic_year_label,
                    sl.display_name as faculty_name,
                    sl.display_name as teacher_name,
                    sl.display_name as faculty,
                    sl.display_name as staff_name,
                    ts.slot_order,
                    COALESCE(ts.slot_order, e.period_slot_id, e.timing_slot_id) as slot_order_id,
                    ts.label as slot_label,
                    ts.start_time,
                    ts.end_time,
                    COALESCE(e.entry_type, 'subject') as type,
                    COALESCE(e.span, 1) as span
                 FROM ap_timetable_entries e
                 JOIN ap_timetable_plans p ON p.id = e.plan_id
                 LEFT JOIN ap_timing_template_slots ts ON (ts.id = e.period_slot_id OR ts.id = e.timing_slot_id)
                 LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
                 WHERE (e.faculty_staff_link_id = ? OR sl.display_name = ?)
                 ORDER BY FIELD(e.day_of_week, 'MON', 'TUE', 'WED', 'THUR', 'THU', 'FRI', 'SAT', 'SUN', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), ts.slot_order`,
                [staffId, staffDisplayName || '']
            );

            return {
                success: true,
                data: facultyEntries || [],
                source: 'academic_portal'
            };
        }

        // 2. Student & Branch Timetable Lookup in Academic Portal DB
        if (year && semester) {
            let plans = [];

            // A. Match branch and section
            if (branch_id && section) {
                const cleanSec = String(section).replace(/^sec(tion)?\s*/i, '').trim();
                [plans] = await academicPool.query(
                    `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                     FROM ap_timetable_plans
                     WHERE branch_id = ? AND year_of_study = ? AND semester_number = ? AND (section_name = ? OR section_name = ? OR section_name LIKE ?)
                     ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                     LIMIT 1`,
                    [branch_id, year, semester, section, cleanSec, `%${cleanSec}%`]
                );
            }

            // B. Match branch, year, semester
            if (!plans || plans.length === 0) {
                if (branch_id) {
                    [plans] = await academicPool.query(
                        `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                         FROM ap_timetable_plans
                         WHERE branch_id = ? AND year_of_study = ? AND semester_number = ?
                         ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                         LIMIT 1`,
                        [branch_id, year, semester]
                    );
                }
            }

            // B.2 Alias branch fallback (e.g. CSEAI ML branch 43 <-> CSE(AI) branch 42, or CSE branch 57 <-> branch 39)
            if (!plans || plans.length === 0) {
                let aliasBranchId = null;
                if (Number(branch_id) === 43) aliasBranchId = 42;
                else if (Number(branch_id) === 42) aliasBranchId = 43;
                else if (Number(branch_id) === 57) aliasBranchId = 39;
                else if (Number(branch_id) === 39) aliasBranchId = 57;

                if (aliasBranchId) {
                    [plans] = await academicPool.query(
                        `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                         FROM ap_timetable_plans
                         WHERE branch_id = ? AND year_of_study = ? AND semester_number = ?
                         ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                         LIMIT 1`,
                        [aliasBranchId, year, semester]
                    );
                }
            }

            // C. Fallback: Match branch (any plan for branch)
            if (!plans || plans.length === 0) {
                if (branch_id) {
                    [plans] = await academicPool.query(
                        `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                         FROM ap_timetable_plans
                         WHERE branch_id = ?
                         ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                         LIMIT 1`,
                        [branch_id]
                    );
                }
            }

            // D. Fallback: Match year and semester across same course if possible
            if (!plans || plans.length === 0) {
                [plans] = await academicPool.query(
                    `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                     FROM ap_timetable_plans
                     WHERE year_of_study = ? AND semester_number = ?
                     ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                     LIMIT 1`,
                    [year, semester]
                );
            }

            // E. Fallback: Latest active plan in Academic Portal
            if (!plans || plans.length === 0) {
                [plans] = await academicPool.query(
                    `SELECT id, timing_template_id, batch, year_of_study, semester_number, section_name, status, version_no, academic_year_label
                     FROM ap_timetable_plans
                     ORDER BY (status = 'published') DESC, version_no DESC, id DESC
                     LIMIT 1`
                );
            }

            if (plans && plans.length > 0) {
                const plan = plans[0];
                const [apRows] = await academicPool.query(
                    `SELECT 
                        e.*,
                        sl.display_name as faculty_name,
                        sl.display_name as teacher_name,
                        sl.display_name as faculty,
                        sl.display_name as staff_name,
                        ts.slot_order,
                        COALESCE(ts.slot_order, e.period_slot_id, e.timing_slot_id) as slot_order_id,
                        ts.label as slot_label,
                        ts.start_time,
                        ts.end_time,
                        COALESCE(e.entry_type, 'subject') as type,
                        COALESCE(e.span, 1) as span
                     FROM ap_timetable_entries e
                     LEFT JOIN ap_timing_template_slots ts ON (ts.id = e.period_slot_id OR ts.id = e.timing_slot_id)
                     LEFT JOIN ap_staff_link sl ON sl.id = e.faculty_staff_link_id
                     WHERE e.plan_id = ?
                     ORDER BY FIELD(e.day_of_week, 'MON', 'TUE', 'WED', 'THUR', 'THU', 'FRI', 'SAT', 'SUN', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), ts.slot_order`,
                    [plan.id]
                );

                let filteredRows = apRows || [];
                if (student_id) {
                    filteredRows = filteredRows.filter(r => {
                        // General entries without student_ids apply to the whole class/section
                        if (!r.student_ids) return true;
                        try {
                            let sids = r.student_ids;
                            if (typeof sids === 'string') {
                                try {
                                    sids = JSON.parse(sids);
                                } catch {
                                    sids = sids.split(',').map(s => Number(s.trim())).filter(Boolean);
                                }
                            }
                            if (Array.isArray(sids) && sids.length > 0) {
                                return sids.includes(Number(student_id));
                            }
                            return true;
                        } catch (e) {
                            return true;
                        }
                    });
                }

                // Also fetch timing template slots directly from Academic Portal
                let planSlots = [];
                if (plan.timing_template_id) {
                    try {
                        const [tSlots] = await academicPool.query(
                            `SELECT DISTINCT slot_order as id, slot_order, label as slot_name, label as name, MIN(start_time) as start_time, MAX(end_time) as end_time, slot_type, slot_order as sort_order
                             FROM ap_timing_template_slots
                             WHERE template_id = ?
                             GROUP BY slot_order, label, slot_type
                             ORDER BY slot_order ASC`,
                            [plan.timing_template_id]
                        );
                        planSlots = tSlots || [];
                    } catch (tsErr) {
                        console.warn('Academic Portal plan template slots fetch notice:', tsErr.message);
                    }
                }

                return {
                    success: true,
                    data: filteredRows,
                    plan: plan,
                    slots: planSlots,
                    source: 'academic_portal'
                };
            }

            // Fallback: Check SDMS masterPool timetable_entries if academicPool has no plans
            try {
                const [masterRows] = await masterPool.query(
                    `SELECT 
                        te.id,
                        te.branch_id,
                        te.year_of_study,
                        te.semester_number,
                        te.day_of_week,
                        te.period_slot_id,
                        te.subject_id,
                        te.type,
                        te.custom_label,
                        te.span,
                        s.name AS subject_name,
                        s.code AS subject_code,
                        ps.name AS slot_label,
                        ps.name AS slot_name,
                        ps.start_time,
                        ps.end_time,
                        ps.sort_order AS slot_order,
                        ps.sort_order AS slot_order_id
                     FROM timetable_entries te
                     LEFT JOIN subjects s ON s.id = te.subject_id
                     LEFT JOIN period_slots ps ON ps.id = te.period_slot_id
                     WHERE (te.branch_id = ? OR ?) AND (te.year_of_study = ? OR ?) AND (te.semester_number = ? OR ?)
                     ORDER BY FIELD(te.day_of_week, 'MON', 'TUE', 'WED', 'THUR', 'THU', 'FRI', 'SAT', 'SUN', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'), ps.sort_order`,
                    [branch_id, !branch_id, year, !year, semester, !semester]
                );

                if (masterRows && masterRows.length > 0) {
                    const [masterSlots] = await masterPool.query(
                        `SELECT id, name as slot_name, name, start_time, end_time, sort_order
                         FROM period_slots ORDER BY sort_order ASC`
                    );
                    return {
                        success: true,
                        data: masterRows,
                        plan: null,
                        slots: masterSlots || [],
                        source: 'master'
                    };
                }
            } catch (mErr) {
                console.warn('masterPool timetable fallback error:', mErr.message);
            }

            return {
                success: true,
                data: [],
                plan: null,
                slots: [],
                source: 'academic_portal',
                message: `No timetable plan found for Year ${year} Sem ${semester}`
            };
        }

        return {
            success: false,
            data: [],
            source: 'academic_portal',
            message: 'branch_id, year, and semester (or faculty_id) are required'
        };
    } catch (apErr) {
        console.error('Academic Portal timetable fetch error:', apErr);
        return {
            success: false,
            data: [],
            source: 'academic_portal',
            error: apErr.message
        };
    }
}

exports.fetchTimetableData = fetchTimetableData;

exports.list = async (req, res) => {
    try {
        let { branch_id, branch, year, semester, faculty_id, section } = req.query;

        // Auto-detect student profile if user is authenticated and parameters are missing
        if (req.user && (!branch_id || !year || !semester)) {
            const lookupVal = req.user.id || req.user.pinNo || req.user.pin_no || req.user.admissionNumber || req.user.admission_number || req.user.username;
            if (lookupVal) {
                try {
                    const [students] = await masterPool.query(
                        `SELECT s.branch_id, s.current_year, s.current_semester, s.section, cb.name as branch_name 
                         FROM students s 
                         LEFT JOIN course_branches cb ON cb.id = s.branch_id
                         WHERE s.id = ? OR s.pin_no = ? OR s.admission_number = ? LIMIT 1`,
                        [lookupVal, lookupVal, lookupVal]
                    );
                    if (students && students.length > 0) {
                        branch_id = branch_id || students[0].branch_id;
                        branch = branch || students[0].branch_name;
                        year = year || students[0].current_year;
                        semester = semester || students[0].current_semester || 1;
                        section = section || students[0].section;
                    }
                } catch (e) {}
            }
        }

        const result = await fetchTimetableData({ branch_id, branch, year, semester, faculty_id, section });
        res.json({ success: true, data: result.data || [], slots: result.slots || [], source: result.source, plan: result.plan });
    } catch (error) {
        console.error('timetable list error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch timetable' });
    }
};

/**
 * Get My Timetable (Context-Aware for Logged-in Student or Faculty)
 */
exports.getMyTimetable = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const role = String(user.role || '').toLowerCase();
        let branchId = req.query.branch_id || user.branchId || user.branch_id;
        let year = req.query.year || user.current_year || user.year || user.year_of_study;
        let semester = req.query.semester || user.current_semester || user.semester || user.semester_number;
        let section = req.query.section || user.section;
        let branch = req.query.branch || user.branch;
        let studentRecord = null;
        let facultyId = null;

        // If user is student or role is undefined, lookup student profile
        if (role === 'student' || (!branchId && !year && !['admin', 'super_admin'].includes(role))) {
            const lookupVal = user.id || user.pinNo || user.pin_no || user.admissionNumber || user.admission_number || user.username;
            if (lookupVal) {
                const [students] = await masterPool.query(
                    `SELECT s.id, s.student_name, s.pin_no, s.admission_number, s.branch_id, s.current_year, s.current_semester, s.section, s.batch,
                            s.branch, cb.name as branch_name, c.name as course_name
                     FROM students s
                     LEFT JOIN course_branches cb ON cb.id = s.branch_id
                     LEFT JOIN courses c ON c.id = s.course_id
                     WHERE s.id = ? OR s.pin_no = ? OR s.admission_number = ? OR s.admission_no = ? LIMIT 1`,
                    [lookupVal, lookupVal, lookupVal, lookupVal]
                );

                if (students && students.length > 0) {
                    studentRecord = students[0];
                    branchId = branchId || studentRecord.branch_id;
                    branch = branch || studentRecord.branch || studentRecord.branch_name;
                    year = year || studentRecord.current_year;
                    semester = semester || studentRecord.current_semester || 1;
                    section = section || studentRecord.section;
                }
            }
        }

        if (['faculty', 'teacher', 'branch_faculty'].includes(role)) {
            facultyId = user.id;
        }

        const result = await fetchTimetableData({
            branch_id: branchId,
            branch: branch,
            year: year || 1,
            semester: semester || 1,
            section: section,
            faculty_id: facultyId,
            student_id: studentRecord ? studentRecord.id : user.id
        });

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = dayNames[new Date().getDay()];

        const todaySchedule = (result.data || []).filter(item => {
            const norm = normalizeDay(item.day_of_week);
            return norm === todayName;
        });

        return res.json({
            success: true,
            source: result.source,
            student: studentRecord || {
                id: user.id,
                username: user.username,
                role: user.role,
                branch_id: branchId,
                current_year: year,
                current_semester: semester,
                section: section
            },
            today_day: todayName,
            today_schedule: todaySchedule,
            data: result.data || [],
            slots: result.slots || [],
            plan: result.plan || null
        });
    } catch (error) {
        console.error('getMyTimetable error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch timetable' });
    }
};

exports.updateBulk = async (req, res) => {
    try {
        const { branch_id, year, semester, entries } = req.body;
        if (!branch_id || !year || !semester || !Array.isArray(entries)) {
            return res.status(400).json({ success: false, message: 'branch_id, year, semester, and entries array are required' });
        }

        // Use a transaction for bulk update
        const connection = await masterPool.getConnection();
        await connection.beginTransaction();

        try {
            // Option 1: Delete existing for this context and re-insert
            await connection.query(
                'DELETE FROM timetable_entries WHERE branch_id = ? AND year_of_study = ? AND semester_number = ?',
                [branch_id, year, semester]
            );

            if (entries.length > 0) {
                const values = entries.map(e => [
                    branch_id,
                    year,
                    semester,
                    e.day_of_week,
                    e.period_slot_id,
                    e.subject_id || null,
                    e.type || 'subject',
                    e.custom_label || null,
                    e.span || 1
                ]);

                await connection.query(
                    `INSERT INTO timetable_entries (branch_id, year_of_study, semester_number, day_of_week, period_slot_id, subject_id, type, custom_label, span)
           VALUES ?`,
                    [values]
                );
            }

            await connection.commit();
            res.json({ success: true, message: 'Timetable updated successfully' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('timetable bulk update error:', error);
        res.status(500).json({ success: false, message: 'Failed to update timetable' });
    }
};

exports.saveEntry = async (req, res) => {
    try {
        const { branch_id, year, semester, day_of_week, period_slot_id, subject_id, type, custom_label, span } = req.body;

        await masterPool.query(
            `INSERT INTO timetable_entries (branch_id, year_of_study, semester_number, day_of_week, period_slot_id, subject_id, type, custom_label, span)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                subject_id = VALUES(subject_id),
                type = VALUES(type),
                custom_label = VALUES(custom_label),
                span = VALUES(span)`,
            [branch_id, year, semester, day_of_week, period_slot_id, subject_id || null, type || 'subject', custom_label || null, span || 1]
        );

        res.json({ success: true, message: 'Entry saved' });
    } catch (error) {
        console.error('timetable save entry error:', error);
        res.status(500).json({ success: false, message: 'Failed to save entry' });
    }
};

exports.removeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        await masterPool.query('DELETE FROM timetable_entries WHERE id = ?', [id]);
        res.json({ success: true, message: 'Entry removed' });
    } catch (error) {
        console.error('timetable remove entry error:', error);
        res.status(500).json({ success: false, message: 'Failed to remove entry' });
    }
};
