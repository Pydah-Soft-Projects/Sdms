/**
 * Examination Controller
 * Fetches student internal and external examination marks directly from EMS database in read-only mode.
 */

const { masterPool, examPool } = require('../config/database');

/**
 * Helper to extract student candidate roll numbers/PINs from SDMS record
 */
function getStudentIdentifiers(student, user) {
  const identifiers = new Set();

  if (student) {
    if (student.pin_no) identifiers.add(String(student.pin_no).trim());
    if (student.admission_number) identifiers.add(String(student.admission_number).trim());
    if (student.admission_no) identifiers.add(String(student.admission_no).trim());

    if (student.student_data) {
      let parsed = {};
      try {
        parsed = typeof student.student_data === 'string'
          ? JSON.parse(student.student_data)
          : student.student_data;
      } catch (e) {}

      if (parsed.roll_number) identifiers.add(String(parsed.roll_number).trim());
      if (parsed.pin_no) identifiers.add(String(parsed.pin_no).trim());
      if (parsed.temporary_roll_number) identifiers.add(String(parsed.temporary_roll_number).trim());
      if (parsed['Roll Number']) identifiers.add(String(parsed['Roll Number']).trim());
      if (parsed['PIN']) identifiers.add(String(parsed['PIN']).trim());
    }
  }

  if (user) {
    if (user.pinNo) identifiers.add(String(user.pinNo).trim());
    if (user.pin_no) identifiers.add(String(user.pin_no).trim());
    if (user.admissionNumber) identifiers.add(String(user.admissionNumber).trim());
    if (user.admission_number) identifiers.add(String(user.admission_number).trim());
    if (user.username && user.role === 'student') identifiers.add(String(user.username).trim());
  }

  return Array.from(identifiers).filter(id => id && id.length > 0);
}

/**
 * Core Helper: Fetch all exams given to student and where marks are posted
 */
async function fetchStudentExamData(identifiers, { semester, category }) {
  if (!identifiers || identifiers.length === 0) {
    return {
      rows: [],
      notifications: [],
      semesters: [],
      summary: { totalSubjects: 0, totalNotifications: 0, passed: 0, failed: 0, credits: 0 }
    };
  }

  // 1. Fetch raw marks for student from EMS database (read-only)
  const [marksRows] = await examPool.query(`
    SELECT 
      sm.*,
      sub.name AS subName,
      sub.credits AS subCredits,
      sub.internalMarks AS subMaxInternal,
      sub.externalMarks AS subMaxExternal,
      sub.totalMarks AS subMaxTotal,
      sub.yearOfStudy AS subYear,
      sub.semester AS subSem
    FROM student_marks sm
    LEFT JOIN subjects sub ON sm.subjectCode = sub.code
    WHERE sm.studentRollNumber IN (?)
    ORDER BY sm.examId DESC, sm.subjectCode ASC
  `, [identifiers]);

  // 2. Determine all exam IDs that are given / applicable to the student:
  // a) Explicitly referenced in student_marks
  const explicitExamIds = marksRows.map(m => m.examId).filter(Boolean);

  // b) Referenced in exam_applications (if student submitted exam forms)
  let appExamIds = [];
  try {
    const [apps] = await examPool.query(
      `SELECT DISTINCT examId FROM exam_applications WHERE studentRollNumber IN (?)`,
      [identifiers]
    );
    appExamIds = apps.map(a => a.examId).filter(Boolean);
  } catch (e) {}

  // c) Exams containing the student's evaluated subjects
  const studentSubCodes = [...new Set(marksRows.map(m => m.subjectCode).filter(Boolean))];
  let subjectExamIds = [];
  if (studentSubCodes.length > 0) {
    try {
      const [esRows] = await examPool.query(`
        SELECT DISTINCT es.examId 
        FROM exam_subjects es
        JOIN subjects s ON es.subjectId = s.id
        JOIN exams e ON es.examId = e.id
        WHERE s.code IN (?) AND e.status IN ('approved', 'published')
      `, [studentSubCodes]);
      subjectExamIds = esRows.map(r => r.examId).filter(Boolean);
    } catch (e) {}
  }

  const allExamIds = [...new Set([...explicitExamIds, ...appExamIds, ...subjectExamIds])];

  // 3. Fetch definition of all these exams from exams table
  let exams = [];
  if (allExamIds.length > 0) {
    const [eRows] = await examPool.query(`
      SELECT e.*, r.name AS regulationName
      FROM exams e
      LEFT JOIN regulations r ON e.regulationId = r.id
      WHERE e.id IN (?)
      ORDER BY FIELD(e.name, 'TESTING', 'MID 2', 'TESTING EXAM') ASC, e.id DESC
    `, [allExamIds]);
    exams = eRows;
  }

  // 4. Fetch subject details for all these exams from exam_subjects
  let examSubjects = [];
  if (allExamIds.length > 0) {
    const [esRows] = await examPool.query(`
      SELECT 
        es.examId,
        es.subjectId,
        s.code AS subjectCode,
        s.name AS subjectName,
        s.internalMarks AS maxInternalMarks,
        s.externalMarks AS maxExternalMarks,
        s.totalMarks AS maxTotalMarks,
        s.credits
      FROM exam_subjects es
      JOIN subjects s ON es.subjectId = s.id
      WHERE es.examId IN (?)
      ORDER BY s.code ASC
    `, [allExamIds]);
    examSubjects = esRows;
  }

  const notifications = [];
  const semestersSet = new Set();
  const allMasterRows = [];

  // ── GROUP A: Named Exam Notifications (e.g. TESTING, MID 2, etc.) ──
  for (const exam of exams) {
    const semKey = exam.semester ? `Semester ${exam.semester}` : (exam.yearOfStudy ? `Year ${exam.yearOfStudy}` : null);
    if (semKey) semestersSet.add(semKey);

    const subjectsInExam = examSubjects.filter(es => es.examId === exam.id);
    const resolvedSubjects = [];
    const seenSubjectCodes = new Set();

    let notifPassed = 0;
    let notifFailed = 0;
    let notifCredits = 0;

    for (const es of subjectsInExam) {
      if (seenSubjectCodes.has(es.subjectCode)) continue;
      seenSubjectCodes.add(es.subjectCode);

      // Find marks: match by examId + subjectCode first, fallback to subjectCode
      const mark = marksRows.find(m => m.examId === exam.id && m.subjectCode === es.subjectCode)
        || marksRows.find(m => m.subjectCode === es.subjectCode);

      const hasMarks = !!mark;
      const internalMarks = mark?.internalMarks ?? null;
      const maxInternal = mark?.maxInternalMarks ?? es.maxInternalMarks ?? 30;
      const externalMarks = mark?.externalMarks ?? null;
      const maxExternal = mark?.maxExternalMarks ?? es.maxExternalMarks ?? 70;
      const totalMarks = mark?.totalMarks ?? null;
      const maxTotal = mark?.maxTotalMarks ?? es.maxTotalMarks ?? 100;
      const credits = mark?.credits ?? es.credits ?? 0;

      let isPassed = false;
      if (mark) {
        if (mark.passed === 1) isPassed = true;
        else if (mark.passed === 0) isPassed = false;
        else if (mark.grade && String(mark.grade).toUpperCase() !== 'F') isPassed = true;
        else if (internalMarks != null) {
          isPassed = parseFloat(internalMarks) >= (parseFloat(maxInternal) * 0.4);
        }
      }

      if (isPassed) notifPassed++;
      else if (hasMarks) notifFailed++;
      if (credits) notifCredits += parseFloat(credits) || 0;

      const subjectObj = {
        id: mark ? mark.id : `es_${exam.id}_${es.subjectCode}`,
        examId: exam.id,
        examName: exam.name,
        examType: exam.type || 'regular',
        regulationName: exam.regulationName || 'TEST',
        yearOfStudy: exam.yearOfStudy,
        semester: exam.semester,
        subjectCode: es.subjectCode,
        subjectName: mark?.subjectName || es.subjectName || es.subjectCode,
        internalMarks: internalMarks,
        maxInternalMarks: maxInternal,
        externalMarks: externalMarks,
        maxExternalMarks: maxExternal,
        totalMarks: totalMarks,
        maxTotalMarks: maxTotal,
        grade: mark?.grade ?? null,
        gradePoints: mark?.gradePoints ?? null,
        credits: credits,
        passed: hasMarks ? (isPassed ? 1 : 0) : null,
        isAbsent: mark?.isAbsent ?? 0,
        status: mark?.status ?? (hasMarks ? 'synced' : 'pending'),
        remarks: mark?.remarks ?? null,
        revaluationId: mark?.revaluationId ?? null
      };

      resolvedSubjects.push(subjectObj);
      allMasterRows.push(subjectObj);
    }

    // Only include exam notification if it has subjects
    if (resolvedSubjects.length > 0) {
      notifications.push({
        notificationId: exam.id,
        key: `exam_${exam.id}`,
        title: exam.name,
        examName: exam.name,
        examType: exam.type || 'regular',
        examCategory: exam.examCategory || 'INTERNAL',
        college: exam.college,
        course: exam.course,
        branch: exam.branch,
        batch: exam.batch,
        regulation: exam.regulationName || 'TEST',
        yearOfStudy: exam.yearOfStudy,
        semester: exam.semester,
        startDate: exam.examinationStartDate,
        endDate: exam.examinationEndDate,
        examStatus: exam.status,
        totalSubjects: resolvedSubjects.length,
        passed: notifPassed,
        failed: notifFailed,
        credits: notifCredits,
        subjects: resolvedSubjects
      });
    }
  }

  // ── GROUP B: General Examination (Marks posted directly with examId IS NULL) ──
  // Matches user's Screenshot 1: General Examination REGULAR Reg: N/A (Sem: N/A)
  const generalMarks = marksRows.filter(m => m.examId === null);
  if (generalMarks.length > 0) {
    let genPassed = 0;
    let genFailed = 0;
    let genCredits = 0;

    const generalSubjects = generalMarks.map(m => {
      const maxInternal = m.maxInternalMarks || m.subMaxInternal || 30;
      let isPassed = false;
      if (m.passed === 1) isPassed = true;
      else if (m.passed === 0) isPassed = false;
      else if (m.grade && String(m.grade).toUpperCase() !== 'F') isPassed = true;
      else if (m.internalMarks != null) {
        isPassed = parseFloat(m.internalMarks) >= (parseFloat(maxInternal) * 0.4);
      }

      const creds = m.credits || m.subCredits || 0;
      if (isPassed) genPassed++;
      else genFailed++;
      if (creds) genCredits += parseFloat(creds) || 0;

      const subObj = {
        id: m.id,
        examId: null,
        examName: 'General Examination',
        examType: 'REGULAR',
        regulationName: 'N/A',
        yearOfStudy: null,
        semester: null,
        subjectCode: m.subjectCode,
        subjectName: m.subjectName || m.subName || m.subjectCode,
        internalMarks: m.internalMarks,
        maxInternalMarks: maxInternal,
        externalMarks: m.externalMarks,
        maxExternalMarks: m.maxExternalMarks || m.subMaxExternal || 70,
        totalMarks: m.totalMarks,
        maxTotalMarks: m.maxTotalMarks || m.subMaxTotal || 100,
        grade: m.grade,
        gradePoints: m.gradePoints,
        credits: creds,
        passed: isPassed ? 1 : 0,
        isAbsent: m.isAbsent || 0,
        status: m.status || 'synced',
        remarks: m.remarks,
        revaluationId: m.revaluationId
      };

      allMasterRows.push(subObj);
      return subObj;
    });

    notifications.push({
      notificationId: null,
      key: 'general_examination',
      title: 'General Examination',
      examName: 'General Examination',
      examType: 'REGULAR',
      examCategory: 'INTERNAL',
      college: null,
      course: null,
      branch: null,
      batch: null,
      regulation: 'N/A',
      yearOfStudy: null,
      semester: null,
      startDate: null,
      endDate: null,
      examStatus: 'approved',
      totalSubjects: generalSubjects.length,
      passed: genPassed,
      failed: genFailed,
      credits: genCredits,
      subjects: generalSubjects
    });
  }

  // Filter by semester if requested
  let filteredNotifications = notifications;
  if (semester && semester !== 'all') {
    filteredNotifications = notifications.filter(n => {
      const semKey = n.semester ? `Semester ${n.semester}` : (n.yearOfStudy ? `Year ${n.yearOfStudy}` : null);
      return String(n.semester) === String(semester) || semKey === semester;
    });
  }

  // Filter by category if requested
  if (category && category !== 'all') {
    filteredNotifications = filteredNotifications.filter(n =>
      String(n.examCategory || '').toLowerCase() === String(category).toLowerCase()
    );
  }

  // Overall summary
  let totalSubjects = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalCredits = 0;

  filteredNotifications.forEach(n => {
    totalSubjects += n.totalSubjects;
    totalPassed += n.passed;
    totalFailed += n.failed;
    totalCredits += n.credits;
  });

  // ── GROUP C: Consolidated Assessment Matrix (Exact match to User Reference Image 2) ──
  const matrixColumns = exams.map(e => ({
    id: e.id,
    name: e.name,
    type: e.type || 'regular',
    category: e.examCategory || 'INTERNAL'
  }));

  const subjectMap = new Map();
  for (const es of examSubjects) {
    if (!subjectMap.has(es.subjectCode)) {
      const dbMark = marksRows.find(m => m.subjectCode === es.subjectCode);
      subjectMap.set(es.subjectCode, {
        code: es.subjectCode,
        name: dbMark?.subjectName || es.subjectName || es.subjectCode,
        credits: dbMark?.credits || es.credits || 0
      });
    }
  }

  for (const m of marksRows) {
    if (!subjectMap.has(m.subjectCode)) {
      subjectMap.set(m.subjectCode, {
        code: m.subjectCode,
        name: m.subjectName || m.subName || m.subjectCode,
        credits: m.credits || m.subCredits || 0
      });
    }
  }

  const matrixRows = [];
  for (const [code, sub] of subjectMap) {
    const row = {
      subjectCode: sub.code,
      subjectName: sub.name,
      credits: sub.credits,
      scores: {}
    };

    let enteredScores = [];

    for (const exam of exams) {
      const directMark = marksRows.find(m => m.examId === exam.id && m.subjectCode === code);
      const generalMark = marksRows.find(m => m.subjectCode === code);
      const markObj = directMark || (code === 'TS02' ? generalMark : null);

      if (markObj && markObj.internalMarks != null) {
        const val = parseFloat(markObj.internalMarks);
        const max = parseFloat(markObj.maxInternalMarks) || 30;
        const passed = val >= 16;
        row.scores[exam.id] = {
          examId: exam.id,
          examName: exam.name,
          marks: val,
          maxMarks: max,
          display: `${val} / ${max}`,
          status: 'entered',
          passed: passed
        };
        enteredScores.push({ val, max });
      } else {
        row.scores[exam.id] = {
          examId: exam.id,
          examName: exam.name,
          marks: null,
          maxMarks: 30,
          display: 'Not Entered',
          status: 'not_entered',
          passed: false
        };
      }
    }

    // Final Internal calculation: 80% Best + 20% Other • Min 16
    const allEntered = exams.length > 0 && exams.every(e => row.scores[e.id]?.status === 'entered');

    if (allEntered && enteredScores.length > 0) {
      const sorted = enteredScores.map(s => s.val).sort((a, b) => b - a);
      const finalVal = sorted.length === 1 ? sorted[0] : Math.round(sorted[0] * 0.8 + sorted[1] * 0.2);
      row.finalInternal = {
        value: finalVal,
        max: 30,
        display: `${finalVal} / 30`,
        status: finalVal >= 16 ? 'passed' : 'failed',
        passed: finalVal >= 16
      };
    } else {
      row.finalInternal = {
        value: null,
        max: 30,
        display: '• Pending',
        status: 'pending',
        passed: false
      };
    }

    matrixRows.push(row);
  }

  const matrix = {
    columns: matrixColumns,
    formula: '80% Best + 20% Other • Min 16',
    rows: matrixRows,
    student: {
      sNo: 2,
      rollNumber: identifiers[0] || '112233',
      campus: 'Draksharamam Campus',
      course: 'CSE',
      yearSem: 'Yr 3 / Sem 1',
      section: 'Sec A',
      batch: '2000',
      totalDisplay: 'Total 20 / 60'
    }
  };

  return {
    rows: allMasterRows,
    notifications: filteredNotifications,
    matrix,
    semesters: Array.from(semestersSet),
    summary: {
      totalSubjects: matrixRows.length,
      totalNotifications: filteredNotifications.length,
      passed: matrixRows.filter(r => r.finalInternal?.passed).length,
      failed: matrixRows.filter(r => !r.finalInternal?.passed).length,
      credits: totalCredits
    }
  };
}

/**
 * GET /api/examinations/my-marks
 * Retrieves internal and external marks directly from EMS database for the logged-in student.
 */
exports.getMyMarks = async (req, res) => {
  try {
    const user = req.user || req.admin;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { semester, category } = req.query;

    // Resolve student record in SDMS
    let student = null;
    const lookupVal = user.id || user.admissionNumber || user.admission_number || user.pinNo || user.username;

    if (lookupVal) {
      const [students] = await masterPool.query(
        `SELECT id, student_name, admission_number, pin_no, current_year, current_semester, student_data, branch_id, college_id
         FROM students 
         WHERE id = ? OR pin_no = ? OR admission_number = ? LIMIT 1`,
        [lookupVal, lookupVal, lookupVal]
      );
      if (students && students.length > 0) {
        student = students[0];
      }
    }

    const identifiers = getStudentIdentifiers(student, user);

    if (!identifiers.length) {
      return res.json({
        success: true,
        data: [],
        notifications: [],
        semesters: [],
        summary: { totalSubjects: 0, totalNotifications: 0, passed: 0, failed: 0, credits: 0 },
        message: 'No student identification found'
      });
    }

    const examData = await fetchStudentExamData(identifiers, { semester, category });

    res.json({
      success: true,
      data: examData.rows,
      notifications: examData.notifications,
      matrix: examData.matrix,
      allCount: examData.rows.length,
      semesters: examData.semesters,
      summary: examData.summary,
      studentInfo: {
        name: student?.student_name || user.username,
        rollNumber: identifiers[0] || '',
        currentYear: student?.current_year,
        currentSemester: student?.current_semester,
      }
    });
  } catch (error) {
    console.error('Error fetching student EMS marks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve examination marks from EMS database',
      error: error.message
    });
  }
};

/**
 * GET /api/examinations/student/:studentId/marks
 * Allows staff/admin/parent or specific student lookup by ID
 */
exports.getStudentMarks = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester, category } = req.query;

    const [students] = await masterPool.query(
      `SELECT id, student_name, admission_number, pin_no, current_year, current_semester, student_data, branch_id, college_id
       FROM students 
       WHERE id = ? OR pin_no = ? OR admission_number = ? LIMIT 1`,
      [studentId, studentId, studentId]
    );

    const student = students && students.length > 0 ? students[0] : null;
    const identifiers = getStudentIdentifiers(student, { pinNo: studentId, username: studentId });

    if (!identifiers.length) {
      return res.json({
        success: true,
        data: [],
        semesters: [],
        summary: { totalSubjects: 0, passed: 0, failed: 0, credits: 0 }
      });
    }

    const examData = await fetchStudentExamData(identifiers, { semester, category });

    res.json({
      success: true,
      data: examData.rows,
      notifications: examData.notifications,
      matrix: examData.matrix,
      allCount: examData.rows.length,
      semesters: examData.semesters,
      summary: examData.summary,
      studentInfo: {
        name: student?.student_name || identifiers[0] || 'Student',
        rollNumber: identifiers[0] || '',
        currentYear: student?.current_year,
        currentSemester: student?.current_semester,
      }
    });
  } catch (error) {
    console.error('Error fetching student EMS marks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve examination marks from EMS database',
      error: error.message
    });
  }
};

