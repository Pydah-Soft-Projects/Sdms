/**
 * Mobile number normalization and duplication validation utility.
 */

export const normalizeMobile = (mobile) => {
  if (!mobile) return '';
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
};

/**
 * Checks if the student mobile number is identical to either parent_mobile1 or parent_mobile2.
 * @param {string|number} studentMobile 
 * @param {string|number} parentMobile1 
 * @param {string|number} parentMobile2 
 * @returns {{ hasDuplicate: boolean, matchedField?: string, matchedLabel?: string, number?: string }}
 */
export const checkSameStudentAndParentMobile = (studentMobile, parentMobile1, parentMobile2) => {
  const normStudent = normalizeMobile(studentMobile);
  if (!normStudent || normStudent.length < 5) {
    return { hasDuplicate: false };
  }

  const normP1 = normalizeMobile(parentMobile1);
  if (normP1 && normP1.length >= 5 && normStudent === normP1) {
    return {
      hasDuplicate: true,
      matchedField: 'parent_mobile1',
      matchedLabel: 'Parent Mobile 1 (Father Mobile)',
      number: normStudent,
      rawStudentMobile: studentMobile,
      rawParentMobile: parentMobile1
    };
  }

  const normP2 = normalizeMobile(parentMobile2);
  if (normP2 && normP2.length >= 5 && normStudent === normP2) {
    return {
      hasDuplicate: true,
      matchedField: 'parent_mobile2',
      matchedLabel: 'Parent Mobile 2 (Mother Mobile)',
      number: normStudent,
      rawStudentMobile: studentMobile,
      rawParentMobile: parentMobile2
    };
  }

  return { hasDuplicate: false };
};

/**
 * Extracts student mobile, parent mobile 1, and parent mobile 2 from a student record.
 */
export const getStudentMobileNumbers = (student) => {
  if (!student) return { studentMobile: '', parentMobile1: '', parentMobile2: '' };

  const studentData = student.student_data && typeof student.student_data === 'object'
    ? student.student_data
    : (typeof student.student_data === 'string'
      ? (() => { try { return JSON.parse(student.student_data); } catch { return {}; } })()
      : {});

  const studentMobile =
    student.student_mobile ||
    student['Student Mobile number'] ||
    student['Student Mobile Number'] ||
    student['Student Mobile'] ||
    student.mobile_number ||
    student.phone ||
    studentData.student_mobile ||
    studentData['Student Mobile number'] ||
    studentData['Student Mobile Number'] ||
    studentData['Student Mobile'] ||
    studentData.mobile_number ||
    studentData.phone ||
    '';

  const parentMobile1 =
    student.parent_mobile1 ||
    student['Parent Mobile Number 1'] ||
    student['Parent Mobile 1'] ||
    student.father_mobile ||
    student.father_phone ||
    studentData.parent_mobile1 ||
    studentData['Parent Mobile Number 1'] ||
    studentData['Parent Mobile 1'] ||
    studentData.father_mobile ||
    studentData.father_phone ||
    '';

  const parentMobile2 =
    student.parent_mobile2 ||
    student['Parent Mobile Number 2'] ||
    student['Parent Mobile 2'] ||
    student.mother_mobile ||
    student.mother_phone ||
    studentData.parent_mobile2 ||
    studentData['Parent Mobile Number 2'] ||
    studentData['Parent Mobile 2'] ||
    studentData.mother_mobile ||
    studentData.mother_phone ||
    '';

  return { studentMobile, parentMobile1, parentMobile2 };
};

/**
 * Checks if a given student record has identical student and parent mobile numbers.
 */
export const hasDuplicateStudentParentMobile = (student) => {
  const { studentMobile, parentMobile1, parentMobile2 } = getStudentMobileNumbers(student);
  return checkSameStudentAndParentMobile(studentMobile, parentMobile1, parentMobile2);
};
