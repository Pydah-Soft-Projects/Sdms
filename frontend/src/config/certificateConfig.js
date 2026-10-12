export const certificateConfig = {
  diploma: [
    { id: '10th_tc', name: '10th TC (Transfer Certificate)', required: true },
    { id: '10th_study', name: '10th Study Certificate', required: true },
    { id: '10th_cert', name: '10th Certificate', required: true }
  ],
  ug: [
    { id: 'inter_diploma_study', name: '10th/Inter/ Diploma Study Certificate', required: true },
    { id: 'inter_diploma_tc', name: 'Inter/Diploma TC (Transfer Certificate)', required: true },
    { id: 'inter_diploma_cert', name: 'Inter/Diploma certificate', required: true },
    { id: '10th_original', name: '10 Original Certificate', required: true }
  ],
  pg: [
    { id: 'ug_study', name: 'UG Study Certificate', required: false },
    { id: 'ug_tc', name: 'UG TC (Transfer Certificate)', required: true },
    { id: 'ug_cert', name: 'UG (Certificate)', required: true },
    { id: 'ug_cmm', name: 'UG CMM (Consolidated Marks Memo)', required: true },
    { id: '10th_original', name: '10 original Certificate', required: true },
    { id: 'inter_diploma_original', name: 'Inter/Diploma Original Certificate', required: true }
  ]
};

export const getCourseType = (course) => {
  // If passed an object with a level property, use that (new reliable method)
  if (typeof course === 'object' && course !== null && course.level) {
    const levelStr = String(course.level).toLowerCase();
    if (levelStr === 'diploma') return 'Diploma';
    if (levelStr === 'pg') return 'PG';
    return 'UG';
  }

  // If passed a string that is exactly a level, use it
  if (typeof course === 'string') {
    const s = course.toLowerCase();
    if (s === 'diploma') return 'Diploma';
    if (s === 'pg') return 'PG';
    if (s === 'ug') return 'UG';
  }

  // Fallback to legacy string matching
  const courseStr = typeof course === 'string' ? course : (course?.name || '');
  if (!courseStr) return null;

  const courseName = courseStr.toLowerCase();
  if (courseName.includes('diploma')) {
    return 'Diploma';
  }

  if (
    courseName.includes('pg') ||
    courseName.includes('post graduate') ||
    courseName.includes('m.tech') ||
    courseName.includes('mtech') ||
    courseName.includes('mba') ||
    courseName.includes('mca') ||
    courseName.includes('msc') ||
    courseName.includes('m sc') ||
    courseName.includes('aqua') ||
    courseName.includes('m.pharma') ||
    courseName.includes('m pharma') ||
    (courseName.includes('pharma') && (courseName.includes('m') || courseName.startsWith('pharma')))
  ) {
    return 'PG';
  }

  return 'UG';
};

export const getCertificatesForCourse = (courseType) => {
  const type = courseType?.toLowerCase();
  if (type === 'diploma') {
    return certificateConfig.diploma.map(c => ({ key: c.id, label: c.name, name: c.name }));
  } else if (type === 'ug') {
    return certificateConfig.ug.map(c => ({ key: c.id, label: c.name, name: c.name }));
  } else if (type === 'pg') {
    return certificateConfig.pg.map(c => ({ key: c.id, label: c.name, name: c.name }));
  }
  return [];
};

const CERT_ALIASES = {
  'custom_1771671980118': ['custom_1771671980118', '10th_original', 'ssc_certificate', '10th_cert', '10th_study', 'ssc'],
  'custom_1771672088118': ['custom_1771672088118', '10th_original', 'ssc_certificate', '10th_cert', '10th_study', 'ssc'],
  'custom_1771672142110': ['custom_1771672142110', '10th_cert', '10th_original', 'ssc_certificate', 'ssc'],
  'custom_1771672108925': ['custom_1771672108925', 'inter_diploma_original', 'inter_diploma_cert', 'inter_diploma_study'],
  '10th_study': ['10th_study', 'ssc_study', 'studyCertificate'],
  '10th_tc': ['10th_tc', 'ssc_tc', 'transferCertificate'],
  '10th_cert': ['10th_cert', '10th_original', 'ssc_certificate', 'ssc', 'custom_1771672142110'],
  '10th_original': ['10th_original', 'custom_1771671980118', 'custom_1771672088118', '10th_cert', 'ssc_certificate', 'ssc'],
  'inter_diploma_study': ['inter_diploma_study', 'inter_diploma_cert', 'inter_study', 'diploma_study'],
  'inter_diploma_tc': ['inter_diploma_tc', 'inter_tc', 'diploma_tc'],
  'inter_diploma_cert': ['inter_diploma_cert', 'inter_diploma_study', 'inter_cert', 'inter', 'diploma_cert'],
  'inter_diploma_original': ['inter_diploma_original', 'custom_1771672108925', 'inter_original']
};

export const normalizeCertificateValue = (rawVal) => {
  if (rawVal === null || rawVal === undefined) return null;
  if (typeof rawVal === 'boolean') return rawVal ? 'Yes' : 'No';
  if (typeof rawVal === 'number') return rawVal > 0 ? 'Yes' : 'No';

  let str = '';
  if (typeof rawVal === 'object') {
    const status = String(rawVal.status || '').trim().toLowerCase();
    if (status === 'pending') return 'No';
    if (rawVal.option) {
      str = String(rawVal.option);
    } else if (rawVal.value) {
      str = String(rawVal.value);
    } else if (rawVal.status) {
      str = String(rawVal.status);
    } else {
      str = JSON.stringify(rawVal);
    }
  } else {
    str = String(rawVal);
  }

  const cleaned = str.split(/[\u0001\x01]/)[0].trim();
  const lower = cleaned.toLowerCase();

  if (!lower || lower === 'no' || lower === 'pending' || lower === 'unverified' || lower === 'false' || lower === '0' || lower === 'none' || lower === 'n/a') {
    return 'No';
  }
  if (lower === 'memo') return 'Memo';
  if (lower === 'original') return 'Original';
  if (lower === 'temporary') return 'Temporary';
  if (lower === 'pc') return 'PC';
  if (lower === 'od') return 'OD';
  if (lower === 'originals returned' || lower === 'original returned' || lower === 'returned') return 'Original Returned';
  if (lower === 'not required') return 'Not Required';
  if (lower === 'yes' || lower === 'submitted' || lower === 'received' || lower === 'verified' || lower === 'true') {
    return 'Yes';
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const isSpecificSubmittedType = (val) => {
  if (!val || typeof val !== 'string') return false;
  const n = val.toLowerCase().trim();
  const generics = ['yes', 'no', 'true', 'false', 'pending', 'unverified', 'received', 'submitted', 'verified', '0', 'none', 'n/a', ''];
  return !generics.includes(n);
};

export const getCertificateValue = (student, certCol) => {
  if (!student) return null;
  const certKey = typeof certCol === 'object' && certCol !== null ? (certCol.key || certCol.id) : certCol;
  const certName = (typeof certCol === 'object' && certCol !== null ? (certCol.name || certCol.label) : '') || '';

  let keysToTry = [...(CERT_ALIASES[certKey] || [certKey])];

  const normName = certName.toLowerCase();
  if (normName.includes('10') || normName.includes('ssc')) {
    if (normName.includes('original')) {
      keysToTry.push('10th_original', 'ssc_certificate', '10th_cert', 'custom_1771671980118', 'custom_1771672088118');
    } else if (normName.includes('tc') || normName.includes('transfer')) {
      keysToTry.push('10th_tc', 'ssc_tc');
    } else if (normName.includes('study')) {
      keysToTry.push('10th_study', 'ssc_study');
    } else {
      keysToTry.push('10th_cert', '10th_original', 'ssc_certificate', 'custom_1771672142110');
    }
  } else if (normName.includes('inter') || normName.includes('diploma')) {
    if (normName.includes('original')) {
      keysToTry.push('inter_diploma_original', 'custom_1771672108925');
    } else if (normName.includes('tc') || normName.includes('transfer')) {
      keysToTry.push('inter_diploma_tc', 'inter_tc');
    } else if (normName.includes('study')) {
      keysToTry.push('inter_diploma_study', 'inter_study');
    } else if (normName.includes('cert')) {
      keysToTry.push('inter_diploma_cert', 'inter_diploma_study', 'inter_cert');
    }
  }

  keysToTry = Array.from(new Set(keysToTry));

  let genericTruthyFound = false;
  let genericFalsyFound = false;

  for (const k of keysToTry) {
    const rawCandidates = [];
    if (student[k] !== undefined && student[k] !== null) rawCandidates.push(student[k]);
    if (student.certificates && student.certificates[k] !== undefined && student.certificates[k] !== null) {
      rawCandidates.push(student.certificates[k]);
    }

    const sd = student.student_data;
    if (sd) {
      let parsedSd = sd;
      if (typeof sd === 'string') {
        try {
          parsedSd = JSON.parse(sd);
        } catch (e) {
          parsedSd = {};
        }
      }

      if (parsedSd && typeof parsedSd === 'object') {
        if (parsedSd[k] !== undefined && parsedSd[k] !== null) rawCandidates.push(parsedSd[k]);
        if (parsedSd.certificates && parsedSd.certificates[k] !== undefined && parsedSd.certificates[k] !== null) {
          rawCandidates.push(parsedSd.certificates[k]);
        }

        const checklist = parsedSd.registrationFormData?.certificate_checklist;
        if (checklist && checklist[k] !== undefined && checklist[k] !== null) {
          rawCandidates.push(checklist[k]);
        }

        if (parsedSd.registrationFormData && parsedSd.registrationFormData[k] !== undefined && parsedSd.registrationFormData[k] !== null) {
          rawCandidates.push(parsedSd.registrationFormData[k]);
        }

        if (parsedSd.documents && parsedSd.documents[k] !== undefined && parsedSd.documents[k] !== null) {
          rawCandidates.push(parsedSd.documents[k]);
        }
      }
    }

    for (const raw of rawCandidates) {
      const normalized = normalizeCertificateValue(raw);
      if (normalized) {
        if (isSpecificSubmittedType(normalized)) {
          return normalized;
        }
        if (normalized === 'Yes') {
          genericTruthyFound = true;
        } else if (normalized === 'No') {
          genericFalsyFound = true;
        }
      }
    }
  }

  if (genericTruthyFound) return 'Yes';
  if (genericFalsyFound) return 'No';
  return null;
};

export const isCertificatePresent = (val) => {
  if (val === true) return true;
  if (val === false || val === null || val === undefined) return false;
  if (typeof val === 'number') return val > 0;

  const norm = String(val).trim().toLowerCase();
  if (!norm || norm === 'no' || norm === 'pending' || norm === 'unverified' || norm === 'false' || norm === '0' || norm === 'none' || norm === 'n/a') {
    return false;
  }
  return true;
};

export const formatCertificateCell = (val) => {
  if (val === null || val === undefined || val === '') {
    return { text: 'No', badgeClass: 'bg-red-100 text-red-600 border-red-200' };
  }
  if (val === false) {
    return { text: 'No', badgeClass: 'bg-red-100 text-red-600 border-red-200' };
  }
  if (val === true) {
    return { text: 'Yes', badgeClass: 'bg-green-100 text-green-700 border-green-200' };
  }

  const rawStr = typeof val === 'object' ? (val.option || val.value || val.status || JSON.stringify(val)) : String(val);
  const cleaned = rawStr.split(/[\u0001\x01]/)[0].trim();
  const norm = cleaned.toLowerCase();

  if (!norm || norm === 'no' || norm === 'pending' || norm === 'unverified' || norm === 'false' || norm === '0' || norm === 'none' || norm === 'n/a') {
    return { text: 'No', badgeClass: 'bg-red-100 text-red-600 border-red-200' };
  }
  if (norm === 'yes' || norm === 'submitted' || norm === 'received' || norm === 'verified' || norm === 'true') {
    return { text: 'Yes', badgeClass: 'bg-green-100 text-green-700 border-green-200' };
  }
  if (norm === 'memo') {
    return { text: 'Memo', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (norm === 'original') {
    return { text: 'Original', badgeClass: 'bg-teal-100 text-teal-800 border-teal-300' };
  }
  if (norm === 'temporary') {
    return { text: 'Temporary', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  }
  if (norm === 'pc') {
    return { text: 'PC', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300' };
  }
  if (norm === 'od') {
    return { text: 'OD', badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
  }
  if (norm === 'original returned' || norm === 'originals returned' || norm === 'returned') {
    return { text: 'Original Returned', badgeClass: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (norm === 'not required') {
    return { text: 'Not Required', badgeClass: 'bg-gray-100 text-gray-700 border-gray-200' };
  }

  const displayText = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return { text: displayText, badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' };
};

export const getCertificateBadgeClass = (status) => {
  const norm = String(status || '').trim().toLowerCase();
  if (norm === 'verified') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (norm === 'original') return 'bg-teal-100 text-teal-800 border-teal-200';
  if (norm === 'temporary' || norm === 'memo') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (norm === 'pc') return 'bg-sky-100 text-sky-800 border-sky-200';
  if (norm === 'od') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  if (norm === 'submitted' || norm === 'yes') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (norm === 'unverified') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (norm === 'partial') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (norm === 'originals returned' || norm === 'original returned' || norm === 'returned') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (norm === 'no' || norm === 'pending') return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

export const computeOverallCertificateStatus = (student, reqCerts = []) => {
  if (!student) return 'Pending';

  const storedStatus = typeof student.certificates_status === 'object'
    ? (student.certificates_status?.name || '')
    : String(student.certificates_status || '');

  const normStored = storedStatus.trim().toLowerCase();

  // Special explicit administrative statuses preserved
  if (normStored === 'originals returned' || normStored === 'not required' || normStored === 'original returned' || normStored === 'returned') {
    return storedStatus;
  }

  // If no certificate requirements configured, fallback to stored status
  if (!Array.isArray(reqCerts) || reqCerts.length === 0) {
    return storedStatus || 'Pending';
  }

  let allSubmitted = true;
  let hasTemporary = false;
  let hasSubmittedAny = false;

  for (const certCol of reqCerts) {
    const val = getCertificateValue(student, certCol);
    const cellInfo = formatCertificateCell(val);

    if (cellInfo.text === 'No') {
      allSubmitted = false;
    } else {
      hasSubmittedAny = true;
      if (cellInfo.text === 'Memo' || cellInfo.text === 'Temporary') {
        hasTemporary = true;
      }
    }
  }

  if (allSubmitted) {
    return hasTemporary ? 'Temporary' : 'Verified';
  }

  if (hasSubmittedAny) {
    return 'Not Verified';
  }

  return storedStatus || 'Pending';
};

