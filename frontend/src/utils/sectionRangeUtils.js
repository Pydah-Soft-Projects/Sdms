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
 * Automatically distribute sorted students with PINs into N sections.
 * If sectionBreakdown is provided with strengths, distributes according to those capacities.
 * Otherwise, distributes evenly across the sections.
 * Returns array of { startPin, endPin, count, startIndex, endIndex }.
 */
export const distributeStudentsIntoSections = (
  sortedStudents = [],
  numSections = 0,
  sectionBreakdown = []
) => {
  const total = sortedStudents.length;
  if (total === 0 || numSections <= 0) return [];

  // When numSections equals the full breakdown length, use configured breakdown capacities
  const isFullBreakdown =
    Array.isArray(sectionBreakdown) &&
    sectionBreakdown.length > 0 &&
    numSections === sectionBreakdown.length;

  const hasConfiguredStrengths =
    isFullBreakdown &&
    sectionBreakdown.every((item) => Number(item?.strength) > 0);

  if (hasConfiguredStrengths) {
    let currentIndex = 0;
    const distributed = [];

    for (let i = 0; i < numSections; i++) {
      if (currentIndex >= total) {
        distributed.push({
          startIndex: total > 0 ? total - 1 : 0,
          endIndex: total > 0 ? total - 1 : 0,
          count: 0,
          startPin: '',
          endPin: ''
        });
        continue;
      }

      const startIndex = currentIndex;
      const strength = Number(sectionBreakdown[i].strength);

      // The last section must ALWAYS fit all remaining students up to total - 1
      const isLast = i === numSections - 1;
      const endIndex = isLast
        ? total - 1
        : Math.min(total - 1, currentIndex + strength - 1);
      const count = Math.max(0, endIndex - startIndex + 1);

      distributed.push({
        startIndex,
        endIndex,
        count,
        startPin: sortedStudents[startIndex]?.pinNo || '',
        endPin: sortedStudents[endIndex]?.pinNo || ''
      });

      currentIndex = endIndex + 1;
    }

    return distributed;
  }

  // When decreasing section count or without fixed breakdown capacities:
  // All students are fitted evenly across the requested number of sections!
  const baseSize = Math.floor(total / numSections);
  const remainder = total % numSections;

  let currentIndex = 0;
  const distributed = [];

  for (let i = 0; i < numSections; i++) {
    const sectionSize = baseSize + (i < remainder ? 1 : 0);
    if (sectionSize === 0 || currentIndex >= total) {
      distributed.push({
        startIndex: total > 0 ? total - 1 : 0,
        endIndex: total > 0 ? total - 1 : 0,
        count: 0,
        startPin: '',
        endPin: ''
      });
    } else {
      const startIndex = currentIndex;
      const isLast = i === numSections - 1;
      const endIndex = isLast
        ? total - 1
        : Math.min(total - 1, currentIndex + sectionSize - 1);
      const count = Math.max(0, endIndex - startIndex + 1);

      distributed.push({
        startIndex,
        endIndex,
        count,
        startPin: sortedStudents[startIndex]?.pinNo || '',
        endPin: sortedStudents[endIndex]?.pinNo || ''
      });
      currentIndex = endIndex + 1;
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

  // Calculate aggregated stats per unique section
  const sectionSummaryMap = new Map();
  sectionCounts.forEach((rc) => {
    if (!sectionSummaryMap.has(rc.section)) {
      sectionSummaryMap.set(rc.section, {
        section: rc.section,
        count: 0,
        percentage: 0,
        studentKeys: new Set(),
        rangeCount: 0
      });
    }
    const secSum = sectionSummaryMap.get(rc.section);
    secSum.rangeCount += 1;
    rc.studentKeys.forEach((key) => secSum.studentKeys.add(key));
  });

  const sectionSummaries = Array.from(sectionSummaryMap.values()).map((sec) => {
    const count = sec.studentKeys.size;
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      section: sec.section,
      count,
      percentage,
      studentKeys: Array.from(sec.studentKeys),
      rangeCount: sec.rangeCount
    };
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
    sectionSummaries,
    overlappingCount: overlaps.length,
    overlaps
  };
};

/**
 * Compute available student options for a given range so that already selected PIN ranges
 * from other ranges are excluded.
 */
export const getAvailableRangeOptions = (
  sortedStudentsWithPin = [],
  allFlatRanges = [],
  currentRangeId = '',
  currentStartPin = '',
  currentEndPin = ''
) => {
  if (!Array.isArray(sortedStudentsWithPin) || sortedStudentsWithPin.length === 0) {
    return {
      occupiedIndices: new Set(),
      occupiedPinSet: new Set(),
      availableStartStudents: [],
      availableEndStudents: []
    };
  }

  // 1. Identify all OTHER valid ranges
  const otherRanges = allFlatRanges.filter(
    (r) => r.id !== currentRangeId && r.startPin && r.endPin
  );

  // 2. Map occupied indices
  const occupiedIndices = new Set();
  const occupiedPinSet = new Set();

  otherRanges.forEach((r) => {
    const sIdx = sortedStudentsWithPin.findIndex((s) => s.pinNo === r.startPin);
    let eIdx = -1;
    for (let i = sortedStudentsWithPin.length - 1; i >= 0; i--) {
      if (sortedStudentsWithPin[i]?.pinNo === r.endPin) {
        eIdx = i;
        break;
      }
    }

    if (sIdx !== -1 && eIdx !== -1 && sIdx <= eIdx) {
      for (let i = sIdx; i <= eIdx; i++) {
        occupiedIndices.add(i);
        if (sortedStudentsWithPin[i]?.pinNo) {
          occupiedPinSet.add(sortedStudentsWithPin[i].pinNo);
        }
      }
    } else {
      // Fallback range check
      sortedStudentsWithPin.forEach((s, idx) => {
        if (isPinInRange(s.pinNo, r.startPin, r.endPin)) {
          occupiedIndices.add(idx);
          if (s.pinNo) occupiedPinSet.add(s.pinNo);
        }
      });
    }
  });

  // 3. Available students for Start PIN (unoccupied + currently selected startPin)
  const availableStartStudents = sortedStudentsWithPin.filter((student, idx) => {
    if (occupiedIndices.has(idx)) {
      return student.pinNo === currentStartPin;
    }
    return true;
  });

  // 4. Available students for End PIN (unoccupied >= startPin, up to the first blocked index)
  let availableEndStudents = [];
  if (!currentStartPin) {
    availableEndStudents = [];
  } else {
    const startIdx = sortedStudentsWithPin.findIndex((s) => s.pinNo === currentStartPin);
    if (startIdx === -1) {
      availableEndStudents = [];
    } else {
      let maxAllowedIdx = sortedStudentsWithPin.length - 1;
      for (let i = startIdx + 1; i < sortedStudentsWithPin.length; i++) {
        if (occupiedIndices.has(i)) {
          maxAllowedIdx = i - 1;
          break;
        }
      }

      availableEndStudents = sortedStudentsWithPin.filter((student, idx) => {
        if (idx < startIdx) return false;
        if (idx <= maxAllowedIdx) return true;
        return student.pinNo === currentEndPin;
      });
    }
  }

  return {
    occupiedIndices,
    occupiedPinSet,
    availableStartStudents,
    availableEndStudents
  };
};
