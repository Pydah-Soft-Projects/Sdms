/**
 * Backend utility for mobile number normalization and duplication validation.
 */

const normalizeMobile = (mobile) => {
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
const checkSameStudentAndParentMobile = (studentMobile, parentMobile1, parentMobile2) => {
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
      number: normStudent
    };
  }

  const normP2 = normalizeMobile(parentMobile2);
  if (normP2 && normP2.length >= 5 && normStudent === normP2) {
    return {
      hasDuplicate: true,
      matchedField: 'parent_mobile2',
      matchedLabel: 'Parent Mobile 2 (Mother Mobile)',
      number: normStudent
    };
  }

  return { hasDuplicate: false };
};

module.exports = {
  normalizeMobile,
  checkSameStudentAndParentMobile
};
