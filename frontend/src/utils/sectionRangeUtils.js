/**
 * Utility functions for section separation and PIN range calculations.
 */

/**
 * Compare two student PIN numbers.
 * Matches SQL ordering:
 * 1. Pure numbers first, sorted numerically.
 * 2. Alphanumeric strings sorted ASCII/alphanumerically (case-insensitive).
 */
export const comparePins = (a, b) => {
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

/**
 * Check if a student's PIN falls within a [startPin, endPin] range (inclusive).
 * Supports:
 * - Direct range comparison (e.g. 26320CM001 to 26320CM060)
 * - Trailing numeric comparison when start and end are pure digits (e.g. 1 to 60 for 26320CM025)
 */
export const isPinInRange = (studentPin, startPin, endPin) => {
  if (!studentPin || !startPin || !endPin) return false;
  const s = String(studentPin).trim().toUpperCase();
  const start = String(startPin).trim().toUpperCase();
  const end = String(endPin).trim().toUpperCase();

  // 1. Direct compare
  if (comparePins(s, start) >= 0 && comparePins(s, end) <= 0) {
    return true;
  }

  // 2. Trailing numeric match if start and end are pure digits
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

/**
 * Automatically distribute sorted students with PINs into N sections evenly.
 * Returns array of { startPin, endPin, count, startIndex, endIndex }.
 */
export const distributeStudentsIntoSections = (sortedStudents, numSections) => {
  const total = sortedStudents.length;
  if (total === 0 || numSections <= 0) return [];
  const baseSize = Math.floor(total / numSections);
  const remainder = total % numSections;

  let currentIndex = 0;
  const distributed = [];

  for (let i = 0; i < numSections; i++) {
    const sectionSize = baseSize + (i < remainder ? 1 : 0);
    if (sectionSize === 0) {
      distributed.push({
        startIndex: currentIndex,
        endIndex: currentIndex,
        count: 0,
        startPin: '',
        endPin: ''
      });
    } else {
      const startIndex = currentIndex;
      const endIndex = currentIndex + sectionSize - 1;
      distributed.push({
        startIndex,
        endIndex,
        count: sectionSize,
        startPin: sortedStudents[startIndex]?.pinNo || '',
        endPin: sortedStudents[endIndex]?.pinNo || ''
      });
      currentIndex += sectionSize;
    }
  }
  return distributed;
};

/**
 * Calculate estimated counts, coverage, and overlaps for each section range.
 */
export const calculateSectionRangeStats = (students = [], ranges = []) => {
  const total = students.length;
  const studentsWithPin = students.filter((s) => s.pinNo && String(s.pinNo).trim());
  const studentsWithoutPin = students.filter((s) => !s.pinNo || !String(s.pinNo).trim());

  // Sort students by PIN
  const sortedStudentsWithPin = [...studentsWithPin].sort((a, b) => comparePins(a.pinNo, b.pinNo));

  const minPin = sortedStudentsWithPin.length > 0 ? sortedStudentsWithPin[0].pinNo : null;
  const maxPin =
    sortedStudentsWithPin.length > 0
      ? sortedStudentsWithPin[sortedStudentsWithPin.length - 1].pinNo
      : null;

  const sectionCounts = ranges.map((range) => {
    if (!range.startPin || !range.endPin) {
      return {
        id: range.id,
        section: range.section,
        count: 0,
        percentage: 0,
        studentKeys: [],
        isInvalidRange: false
      };
    }

    const isInvalid = comparePins(range.startPin, range.endPin) > 0;
    if (isInvalid) {
      return {
        id: range.id,
        section: range.section,
        count: 0,
        percentage: 0,
        studentKeys: [],
        isInvalidRange: true
      };
    }

    const matched = sortedStudentsWithPin.filter((s) =>
      isPinInRange(s.pinNo, range.startPin, range.endPin)
    );

    const count = matched.length;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      id: range.id,
      section: range.section,
      count,
      percentage,
      studentKeys: matched.map((s) => s.admissionNumber || String(s.id)),
      isInvalidRange: false
    };
  });

  const studentMatchMap = new Map();
  sectionCounts.forEach(({ section, studentKeys }) => {
    studentKeys.forEach((key) => {
      if (!studentMatchMap.has(key)) {
        studentMatchMap.set(key, []);
      }
      studentMatchMap.get(key).push(section);
    });
  });

  const overlaps = [];
  studentMatchMap.forEach((matchedSections, key) => {
    if (matchedSections.length > 1) {
      overlaps.push({ key, sections: matchedSections });
    }
  });

  const totalMatched = studentMatchMap.size;
  const unmatchedCount = sortedStudentsWithPin.length - totalMatched;

  return {
    totalStudents: total,
    withPinCount: sortedStudentsWithPin.length,
    noPinCount: studentsWithoutPin.length,
    minPin,
    maxPin,
    sortedStudentsWithPin,
    studentsWithoutPin,
    totalMatched,
    unmatchedCount,
    sectionCounts,
    overlappingCount: overlaps.length,
    overlaps
  };
};
