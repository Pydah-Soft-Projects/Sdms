const { masterPool } = require('../config/database');

const SECTION_COLLATE = 'utf8mb4_unicode_ci';

const collatedSectionExpr = (expr) =>
  `NULLIF(TRIM(CAST(${expr} AS CHAR CHARACTER SET utf8mb4) COLLATE ${SECTION_COLLATE}), '' COLLATE ${SECTION_COLLATE})`;

/** Canonical section value: students.section column only (entire application). */
const resolveStudentSectionSql = (alias = 'students') =>
  collatedSectionExpr(`${alias}.section`);

/** @deprecated Use resolveStudentSectionSql — same source (students.section). */
const resolveManualStudentSectionSql = resolveStudentSectionSql;

const resolveStudentPinSql = (alias = 'students') => `CASE
  WHEN NULLIF(TRIM(${alias}.pin_no), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM student_roll_numbers srn
      WHERE srn.student_id = ${alias}.id
        AND srn.roll_number COLLATE utf8mb4_unicode_ci = ${alias}.pin_no COLLATE utf8mb4_unicode_ci
    ) THEN TRIM(${alias}.pin_no)
  WHEN ${alias}.student_data IS NOT NULL AND JSON_VALID(${alias}.student_data) = 1 THEN
    NULLIF(TRIM(COALESCE(
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$.pin_no'))), ''),
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$."Pin Number"'))), ''),
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$.pin_number'))), ''),
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$.PIN'))), '')
    )), '')
  ELSE NULL
END`;

const resolveStudentNameSql = (alias = 'students') => `CASE
  WHEN NULLIF(TRIM(${alias}.student_name), '') IS NOT NULL THEN TRIM(${alias}.student_name)
  WHEN ${alias}.student_data IS NOT NULL AND JSON_VALID(${alias}.student_data) = 1 THEN
    NULLIF(TRIM(COALESCE(
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$.student_name'))), ''),
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$."Student Name"'))), ''),
      NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(${alias}.student_data, '$.name'))), '')
    )), '')
  ELSE NULL
END`;

const parseBranchMetadata = (metadata) => {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata);
    } catch {
      return null;
    }
  }
  return metadata;
};

const getConfiguredSectionsForBranch = async ({ course, branch } = {}) => {
  if (!branch) {
    return { courseName: course || null, configuredSections: [], sectionBreakdown: [] };
  }

  if (course) {
    let courseRows;
    if (/^\d+$/.test(course)) {
      [courseRows] = await masterPool.query(
        'SELECT id, name FROM courses WHERE id = ? AND is_active = 1',
        [parseInt(course, 10)]
      );
    } else {
      [courseRows] = await masterPool.query(
        'SELECT id, name FROM courses WHERE (name = ? OR code = ?) AND is_active = 1',
        [course, course]
      );
    }

    if (courseRows.length === 0) {
      return { courseName: course, configuredSections: [], sectionBreakdown: [] };
    }

    const courseIds = courseRows.map((c) => c.id);
    let branchRows;
    if (/^\d+$/.test(branch)) {
      [branchRows] = await masterPool.query(
        `SELECT metadata, course_id FROM course_branches WHERE course_id IN (${courseIds.map(() => '?').join(',')}) AND id = ? AND is_active = 1`,
        [...courseIds, parseInt(branch, 10)]
      );
    } else {
      [branchRows] = await masterPool.query(
        `SELECT metadata, course_id FROM course_branches WHERE course_id IN (${courseIds.map(() => '?').join(',')}) AND (name = ? OR code = ?) AND is_active = 1`,
        [...courseIds, branch, branch]
      );
    }

    for (const bRow of branchRows) {
      if (!bRow.metadata) continue;
      const metadata = parseBranchMetadata(bRow.metadata);
      if (!metadata?.sections?.enabled || !Array.isArray(metadata.sections.items)) {
        continue;
      }

      const sectionBreakdown = metadata.sections.items.filter(
        (item) => item && (item.name || typeof item === 'string')
      );
      const configuredSections = sectionBreakdown
        .map((item) => (typeof item === 'object' ? item.name : item))
        .filter(Boolean);

      if (configuredSections.length > 0) {
        const matchedCourse = courseRows.find((c) => c.id === bRow.course_id);
        return {
          courseName: matchedCourse ? matchedCourse.name : course,
          configuredSections,
          sectionBreakdown
        };
      }
    }

    return { courseName: courseRows[0].name, configuredSections: [], sectionBreakdown: [] };
  }

  let branchRows;
  if (/^\d+$/.test(branch)) {
    [branchRows] = await masterPool.query(
      `SELECT cb.metadata, c.name AS course_name
       FROM course_branches cb
       JOIN courses c ON cb.course_id = c.id
       WHERE cb.id = ? AND cb.is_active = 1 AND c.is_active = 1`,
      [parseInt(branch, 10)]
    );
  } else {
    [branchRows] = await masterPool.query(
      `SELECT cb.metadata, c.name AS course_name
       FROM course_branches cb
       JOIN courses c ON cb.course_id = c.id
       WHERE (cb.name = ? OR cb.code = ?) AND cb.is_active = 1 AND c.is_active = 1`,
      [branch, branch]
    );
  }

  for (const row of branchRows) {
    const metadata = parseBranchMetadata(row.metadata);
    if (!metadata?.sections?.enabled || !Array.isArray(metadata.sections.items)) {
      continue;
    }

    const sectionBreakdown = metadata.sections.items.filter(
      (item) => item && (item.name || typeof item === 'string')
    );
    const configuredSections = sectionBreakdown
      .map((item) => (typeof item === 'object' ? item.name : item))
      .filter(Boolean);

    if (configuredSections.length > 0) {
      return {
        courseName: row.course_name,
        configuredSections,
        sectionBreakdown
      };
    }
  }

  return { courseName: null, configuredSections: [], sectionBreakdown: [] };
};

/** Distinct section values from students.section only. */
const fetchStudentTableSectionOptions = async ({ course, branch, batch, year, semester, college } = {}) => {
  const studentParams = [];
  let studentWhere = 'WHERE section IS NOT NULL AND TRIM(section) <> \'\'';

  if (branch) {
    studentWhere += ' AND branch = ?';
    studentParams.push(branch);
  }
  if (course) {
    studentWhere += ' AND course = ?';
    studentParams.push(course);
  }
  if (college) {
    studentWhere += ' AND college = ?';
    studentParams.push(college);
  }
  if (batch) {
    studentWhere += ' AND batch = ?';
    studentParams.push(batch);
  }
  if (year) {
    studentWhere += ' AND current_year = ?';
    studentParams.push(parseInt(year, 10));
  }
  if (semester) {
    studentWhere += ' AND current_semester = ?';
    studentParams.push(parseInt(semester, 10));
  }

  try {
    const [rows] = await masterPool.query(
      `SELECT DISTINCT TRIM(section) AS section
       FROM students
       ${studentWhere}
       ORDER BY section ASC`,
      studentParams
    );
    return rows.map((row) => row.section).filter(Boolean);
  } catch (error) {
    console.warn('Failed to fetch student table section options:', error);
    return [];
  }
};

const fetchSectionFilterOptions = async (filters = {}) => fetchStudentTableSectionOptions(filters);

const comparePins = (a, b) => {
  const strA = String(a || '').trim().toUpperCase();
  const strB = String(b || '').trim().toUpperCase();

  const isNumA = /^\d+$/.test(strA);
  const isNumB = /^\d+$/.test(strB);

  if (isNumA && isNumB) {
    const nA = parseInt(strA, 10);
    const nB = parseInt(strB, 10);
    return nA < nB ? -1 : nA > nB ? 1 : 0;
  }

  if (isNumA && !isNumB) return -1;
  if (!isNumA && isNumB) return 1;

  return strA < strB ? -1 : strA > strB ? 1 : 0;
};

const isPinInRange = (studentPin, startPin, endPin) => {
  if (!studentPin || !startPin || !endPin) return false;
  const s = String(studentPin).trim().toUpperCase();
  const start = String(startPin).trim().toUpperCase();
  const end = String(endPin).trim().toUpperCase();

  if (comparePins(s, start) >= 0 && comparePins(s, end) <= 0) {
    return true;
  }

  if (/^\d+$/.test(start) && /^\d+$/.test(end)) {
    const startNum = parseInt(start, 10);
    const endNum = parseInt(end, 10);
    const match = s.match(/(\d+)$/);
    if (match) {
      const pinNum = parseInt(match[1], 10);
      if (pinNum >= startNum && pinNum <= endNum) {
        return true;
      }
    }
  }

  return false;
};

module.exports = {
  resolveStudentSectionSql,
  resolveManualStudentSectionSql,
  resolveStudentPinSql,
  resolveStudentNameSql,
  fetchSectionFilterOptions,
  fetchStudentTableSectionOptions,
  getConfiguredSectionsForBranch,
  comparePins,
  isPinInRange
};

