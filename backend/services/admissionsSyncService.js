require('dotenv').config();
const { masterPool, admissionsPool } = require('../config/database');

/**
 * Helper to safely extract JSON data if stored as a string or object.
 */
function parseJson(data) {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch (e) {
    return {};
  }
}

/**
 * Extract clean value prioritizing direct column value, then JSON payload field.
 */
function getValue(colVal, jsonObj, jsonKeys = []) {
  if (colVal !== undefined && colVal !== null && String(colVal).trim() !== '') {
    return String(colVal).trim();
  }
  for (const key of jsonKeys) {
    if (jsonObj[key] !== undefined && jsonObj[key] !== null && String(jsonObj[key]).trim() !== '') {
      return String(jsonObj[key]).trim();
    }
  }
  return null;
}

/**
 * Format date to YYYY-MM-DD for MySQL DATE columns if possible.
 */
function formatDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.substring(0, 10);
  }
  const dateObj = new Date(str);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toISOString().split('T')[0];
  }
  return str;
}

const VALID_RESERVATION_VALUES = new Set(['oc', 'ews', 'bc-a', 'bc-b', 'bc-c', 'bc-d', 'bc-e', 'sc', 'st']);

function normalizeReservationGeneral(val) {
  if (!val) return null;
  let str = String(val).trim().toLowerCase();
  if (str === 'fc' || str === 'general') str = 'oc';
  if (str === 'bc_a') str = 'bc-a';
  if (str === 'bc_b') str = 'bc-b';
  if (str === 'bc_c') str = 'bc-c';
  if (str === 'bc_d') str = 'bc-d';
  if (str === 'bc_e') str = 'bc-e';
  return VALID_RESERVATION_VALUES.has(str) ? str : null;
}

function extractDoorStreet(rawAddress, village, mandal, district, state, pincode) {
  if (!rawAddress) return '';
  let str = String(rawAddress).trim();

  const esc = (s) => (s ? String(s).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');

  if (pincode) {
    str = str.replace(new RegExp(',?\\s*(PIN:?\\s*)?' + esc(pincode) + '$', 'i'), '');
  } else {
    str = str.replace(/,?\s*(PIN:?\s*)?\d{6}$/i, '');
  }

  if (state) {
    str = str.replace(new RegExp(',?\\s*' + esc(state).replace(/\s+/g, '\\s*') + '$', 'i'), '');
  } else {
    str = str.replace(/,?\s*(Andhra\s+Pradesh|Telangana)$/i, '');
  }

  if (district) {
    str = str.replace(new RegExp(',?\\s*' + esc(district) + '$', 'i'), '');
  }

  if (mandal) {
    str = str.replace(new RegExp(',?\\s*' + esc(mandal) + '$', 'i'), '');
  }

  if (village) {
    str = str.replace(new RegExp(',?\\s*' + esc(village) + '$', 'i'), '');
  }

  return str.trim();
}

function isDocSubmitted(val) {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val > 0;
  let str = '';
  if (typeof val === 'object') {
    const status = String(val.status || '').trim().toLowerCase();
    if (status === 'pending' || status === 'unverified' || status === 'no' || status === 'false') return false;
    if (status === 'received' || status === 'verified' || status === 'yes' || status === 'completed') return true;
    if (val.option || val.value) {
      str = String(val.option || val.value);
    } else {
      return false;
    }
  } else {
    str = String(val);
  }
  const cleaned = str.split(/[\u0001\x01]/)[0].trim().toLowerCase();
  if (!cleaned || cleaned === 'no' || cleaned === 'pending' || cleaned === 'unverified' || cleaned === 'false' || cleaned === '0' || cleaned === 'none' || cleaned === 'n/a') {
    return false;
  }
  return true;
}

function checkAnyDocSubmitted(student, json, keys) {
  if (!keys || !Array.isArray(keys)) return false;
  const checklist = json?.registrationFormData?.certificate_checklist || {};
  const certs = json?.certificates || {};
  const docs = json?.documents || {};

  for (const k of keys) {
    if (isDocSubmitted(student?.[k])) return true;
    if (isDocSubmitted(json?.[k])) return true;
    if (isDocSubmitted(checklist[k])) return true;
    if (isDocSubmitted(certs[k])) return true;
    if (isDocSubmitted(docs[k])) return true;
  }
  return false;
}

function resolveCourseType(course) {
  if (!course) return 'UG';
  const c = String(course).toLowerCase();
  if (c.includes('diploma') || c.includes('polytechnic')) return 'Diploma';
  if (c.includes('pg') || c.includes('m.tech') || c.includes('mtech') || c.includes('mba') || c.includes('mca') || c.includes('m.pharm') || c.includes('mpharm') || c.includes('m.sc')) return 'PG';
  return 'UG';
}

/**
 * Core function to sync a single SDMS student record to admissions_db
 * @param {string} admissionNumber - The student admission number
 * @param {object|null} studentRecord - Optional pre-fetched student record row from SDMS
 * @returns {Promise<{success: boolean, admissionNumber: string, updatedTables: string[], error?: string}>}
 */
async function syncStudentToAdmissions(admissionNumber, studentRecord = null) {
  const normAdmissionNumber = String(admissionNumber || '').trim();
  if (!normAdmissionNumber) {
    return { success: false, error: 'Admission number is required for admissions sync' };
  }

  try {
    let student = studentRecord;
    if (!student) {
      const [rows] = await masterPool.query(
        `SELECT * FROM students WHERE admission_number = ? OR admission_no = ? LIMIT 1`,
        [normAdmissionNumber, normAdmissionNumber]
      );
      if (!rows || rows.length === 0) {
        return { success: false, admissionNumber: normAdmissionNumber, error: 'Student not found in SDMS database' };
      }
      student = rows[0];
    }

    const json = parseJson(student.student_data);

    // Consolidated fields
    const name = getValue(student.student_name, json, ['Student Name', 'student_name', 'name', 'Name']);
    const dob = formatDate(getValue(student.dob, json, ['Date of Birth', 'dob', 'date_of_birth', 'DOB']));
    const aadhaar = getValue(student.adhar_no, json, ['Aadhar Card Number', 'adhar_no', 'aadhaar', 'student_aadhaar_number']);
    const gender = getValue(student.gender, json, ['Gender', 'gender']);
    const email = getValue(student.email, json, ['Email', 'email', 'student_email']);
    const fatherName = getValue(student.father_name, json, ['Father Name', 'father_name', 'father']);
    const studentPhone = getValue(student.student_mobile, json, ['Student Mobile Number', 'student_mobile', 'phone', 'student_phone']);
    const fatherPhone = getValue(student.parent_mobile1, json, ['Parent Mobile Number', 'parent_mobile1', 'father_phone']);
    const motherPhone = getValue(student.parent_mobile2, json, ['Parent Mobile Number 2', 'parent_mobile2', 'mother_phone']);
    const preferredPhone = getValue(student.preferred_mobile_number, json, ['preferred_mobile_number']) || studentPhone || fatherPhone;


    const rawStreetAddress = getValue(student.student_address, json, ['Student Address', 'student_address', 'address_door_street', 'address']);
    const village = getValue(student.city_village, json, ['Village/City', 'city_village', 'village', 'address_village_city']);
    const mandal = getValue(student.mandal_name, json, ['Mandal Name', 'mandal_name', 'mandal', 'address_mandal']);
    const district = getValue(student.district, json, ['District', 'district', 'address_district']);
    const landmark = getValue(null, json, ['address_landmark', 'Landmark', 'landmark']);

    
    let pincode = getValue(null, json, ['pincode', 'pin_code', 'address_pin_code', 'Pincode', 'Pin Code']);
    let state = getValue(null, json, ['state', 'address_state', 'State']);

    if (!pincode && rawStreetAddress) {
      const pinMatch = String(rawStreetAddress).match(/\b(\d{6})\b/);
      if (pinMatch) pincode = pinMatch[1];
    }
    if (!state && rawStreetAddress) {
      if (/Andhra\s+Pradesh/i.test(rawStreetAddress)) state = 'Andhra Pradesh';
      else if (/Telangana/i.test(rawStreetAddress)) state = 'Telangana';
    }

    const cleanDoorStreet = extractDoorStreet(rawStreetAddress, village, mandal, district, state, pincode);
    const streetAddress = cleanDoorStreet || rawStreetAddress;

    const course = getValue(student.course, json, ['Course', 'course']);
    const branch = getValue(student.branch, json, ['Branch', 'branch']);
    const quota = getValue(student.stud_type, json, ['Stud Type', 'stud_type', 'quota', 'Quota']);
    const rawCaste = getValue(student.caste, json, ['Caste', 'caste', 'reservation_general']);
    const caste = normalizeReservationGeneral(rawCaste);

    const studentPhoto = getValue(student.student_photo, json, ['student_photo']);
    const fatherPhoto = getValue(student.father_photo, json, ['father_photo']);
    const motherPhoto = getValue(student.mother_photo, json, ['mother_photo']);
    const remarks = getValue(student.remarks, json, ['Remarks', 'remarks']);

    // Resolve course type (Diploma, UG, PG)
    const courseType = resolveCourseType(course);

    // Resolve Certificates & Documents
    const rawCertStatus = String(student.certificates_status || json.certificates_status || '').trim().toLowerCase();
    const isCertCompletedOrVerified = rawCertStatus === 'verified' || rawCertStatus === 'completed' || (rawCertStatus.includes('verified') && !rawCertStatus.includes('not verified') && !rawCertStatus.includes('unverified'));

    const sscKeys = ['10th_original', '10th_cert', 'ssc_certificate', 'document_ssc', 'ssc', 'custom_1771671980118', 'custom_1771672088118', 'custom_1771672142110', '10th'];
    const hasSsc = checkAnyDocSubmitted(student, json, sscKeys) || (isCertCompletedOrVerified && courseType !== 'Diploma');

    const interKeys = ['inter_diploma_cert', 'inter_diploma_original', 'inter_diploma_study', 'document_inter', 'inter_cert', 'inter', 'diploma_cert', 'diploma', 'custom_1771672108925'];
    const hasInter = checkAnyDocSubmitted(student, json, interKeys) || (isCertCompletedOrVerified && (courseType === 'UG' || courseType === 'PG'));

    const tcKeys = ['inter_diploma_tc', '10th_tc', 'ug_tc', 'transferCertificate', 'document_transfer_certificate', 'tc', 'transfer_certificate', 'ssc_tc', 'inter_tc'];
    const hasTc = checkAnyDocSubmitted(student, json, tcKeys) || isCertCompletedOrVerified;

    const studyKeys = ['inter_diploma_study', '10th_study', 'ug_study', 'studyCertificate', 'document_study_certificate', 'study', 'study_certificate', 'ssc_study', 'inter_study'];
    const hasStudy = checkAnyDocSubmitted(student, json, studyKeys) || isCertCompletedOrVerified;

    const cmmKeys = ['ug_cmm', 'ug_cert', 'ug_pc', 'ug_od', 'document_ug_pg_cmm', 'cmm'];
    const hasCmm = checkAnyDocSubmitted(student, json, cmmKeys) || (isCertCompletedOrVerified && courseType === 'PG');

    const aadhaarKeys = ['document_aadhaar_card', 'aadhaar_card', 'aadhaar', 'adhar_no'];
    const hasAadhaarDoc = checkAnyDocSubmitted(student, json, aadhaarKeys) || Boolean(aadhaar && String(aadhaar).replace(/\D/g, '').length === 12);

    const photoKeys = ['document_photos', 'photos', 'student_photo'];
    const hasPhotosDoc = checkAnyDocSubmitted(student, json, photoKeys) || Boolean(studentPhoto);

    const casteKeys = ['document_caste_certificate', 'caste_certificate', 'caste_cert', 'caste_doc'];
    const hasCasteDoc = checkAnyDocSubmitted(student, json, casteKeys);

    const incomeKeys = ['document_income_certificate', 'income_certificate', 'income_cert', 'income_doc'];
    const hasIncomeDoc = checkAnyDocSubmitted(student, json, incomeKeys);

    const rankKeys = ['document_cet_rank_card', 'cet_rank_card', 'rank_card'];
    const hasRankDoc = checkAnyDocSubmitted(student, json, rankKeys) || Boolean(getValue(student.rank, json, ['rank', 'cet_rank']));

    const hallTicketKeys = ['document_cet_hall_ticket', 'cet_hall_ticket', 'hall_ticket', 'hall_ticket_number'];
    const hasHallTicketDoc = checkAnyDocSubmitted(student, json, hallTicketKeys) || Boolean(getValue(student.hall_ticket_number, json, ['hall_ticket_number', 'hallTicketNumber', 'hall_ticket']));

    const allotmentKeys = ['document_allotment_letter', 'allotment_letter', 'allotment_order', 'allotment_doc'];
    const hasAllotmentDoc = checkAnyDocSubmitted(student, json, allotmentKeys);

    const joiningReportKeys = ['document_joining_report', 'joining_report', 'joining_doc'];
    const hasJoiningReportDoc = checkAnyDocSubmitted(student, json, joiningReportKeys);

    const bankKeys = ['document_bank_passbook', 'bank_passbook', 'passbook', 'bank_doc'];
    const hasBankPassbookDoc = checkAnyDocSubmitted(student, json, bankKeys);

    const rationKeys = ['document_ration_card', 'ration_card', 'ration_doc', 'ration_card_number', 'ration_no'];
    const hasRationCardDoc = checkAnyDocSubmitted(student, json, rationKeys) || Boolean(getValue(null, json, ['ration_card_number', 'ration_card', 'ration_no']));

    // Resolve Merit Status (qualification_merit: 0 or 1)
    let qualificationMerit = 0;
    try {
      if (student.id) {
        const [meritRows] = await masterPool.query(
          `SELECT sms.merit_status 
           FROM student_merit_status sms 
           WHERE sms.student_id = ? 
             AND (sms.student_year = COALESCE(?, 1) OR sms.student_year = 1)
           ORDER BY (sms.student_year = COALESCE(?, 1)) DESC, sms.student_year DESC
           LIMIT 1`,
          [student.id, student.current_year, student.current_year]
        );
        if (meritRows.length > 0 && meritRows[0].merit_status) {
          qualificationMerit = String(meritRows[0].merit_status).trim().toLowerCase() === 'yes' ? 1 : 0;
        } else {
          const rawMerit = getValue(student.merit_status, json, ['merit_status', 'qualification_merit', 'is_merit', 'merit']);
          if (rawMerit !== null && rawMerit !== undefined) {
            const norm = String(rawMerit).trim().toLowerCase();
            qualificationMerit = (norm === 'yes' || norm === 'y' || norm === 'true' || norm === '1') ? 1 : 0;
          } else if (json?.qualifications?.merit !== undefined) {
            qualificationMerit = json.qualifications.merit ? 1 : 0;
          }
        }
      }
    } catch (meritErr) {
      console.warn(`[AdmissionsSync] Error resolving merit status for student ${normAdmissionNumber}:`, meritErr.message);
    }

    const updatedTables = [];

    // 1. Sync to admissions_db.admissions table
    const [admRows] = await admissionsPool.query(
      `SELECT id, lead_id, joining_id, lead_data, 
              document_ssc, document_inter, document_ug_pg_cmm, 
              document_transfer_certificate, document_study_certificate, 
              document_aadhaar_card, document_photos, document_income_certificate, 
              document_caste_certificate, document_cet_rank_card, document_cet_hall_ticket, 
              document_allotment_letter, document_joining_report, document_bank_passbook, 
              document_ration_card, qualification_merit 
       FROM admissions WHERE admission_number = ?`,
      [normAdmissionNumber]
    );

    let leadId = null;
    let joiningId = null;

    if (admRows.length > 0) {
      leadId = admRows[0].lead_id;
      joiningId = admRows[0].joining_id;
      const existingAdm = admRows[0];

      const admUpdateFields = [];
      const admParams = [];

      const setIfVal = (col, val) => {
        if (val !== undefined && val !== null) {
          admUpdateFields.push(`${col} = ?`);
          admParams.push(val);
        }
      };

      setIfVal('student_name', name);
      setIfVal('student_phone', studentPhone);
      setIfVal('student_aadhaar_number', aadhaar);
      setIfVal('student_gender', gender);
      setIfVal('student_date_of_birth', dob);
      setIfVal('father_name', fatherName);
      setIfVal('father_phone', fatherPhone);
      setIfVal('mother_phone', motherPhone);
      setIfVal('preferred_mobile_number', preferredPhone);
      setIfVal('address_door_street', streetAddress);
      setIfVal('address_landmark', landmark || '');
      setIfVal('address_village_city', village);

      setIfVal('address_mandal', mandal);
      setIfVal('address_district', district);
      if (pincode) setIfVal('address_pin_code', pincode);
      if (state) setIfVal('address_state', state);

      setIfVal('course', course);
      setIfVal('branch', branch);
      setIfVal('quota', quota);
      setIfVal('reservation_general', caste);
      setIfVal('student_photo', studentPhoto);
      setIfVal('father_photo', fatherPhoto);
      setIfVal('mother_photo', motherPhoto);
      setIfVal('remarks', remarks);

      // Resolve final document statuses (preserving existing received status if SDMS has no explicit override)
      const finalDocSsc = hasSsc ? 'received' : (existingAdm.document_ssc === 'received' ? 'received' : 'pending');
      const finalDocInter = hasInter ? 'received' : (existingAdm.document_inter === 'received' ? 'received' : 'pending');
      const finalDocUgPgCmm = hasCmm ? 'received' : (existingAdm.document_ug_pg_cmm === 'received' ? 'received' : 'pending');
      const finalDocTc = hasTc ? 'received' : (existingAdm.document_transfer_certificate === 'received' ? 'received' : 'pending');
      const finalDocStudy = hasStudy ? 'received' : (existingAdm.document_study_certificate === 'received' ? 'received' : 'pending');
      const finalDocAadhaar = hasAadhaarDoc ? 'received' : (existingAdm.document_aadhaar_card === 'received' ? 'received' : 'pending');
      const finalDocPhotos = hasPhotosDoc ? 'received' : (existingAdm.document_photos === 'received' ? 'received' : 'pending');
      const finalDocCaste = hasCasteDoc ? 'received' : (existingAdm.document_caste_certificate === 'received' ? 'received' : 'pending');
      const finalDocIncome = hasIncomeDoc ? 'received' : (existingAdm.document_income_certificate === 'received' ? 'received' : 'pending');
      const finalDocCetRank = hasRankDoc ? 'received' : (existingAdm.document_cet_rank_card === 'received' ? 'received' : 'pending');
      const finalDocCetHallTicket = hasHallTicketDoc ? 'received' : (existingAdm.document_cet_hall_ticket === 'received' ? 'received' : 'pending');
      const finalDocAllotment = hasAllotmentDoc ? 'received' : (existingAdm.document_allotment_letter === 'received' ? 'received' : 'pending');
      const finalDocJoiningReport = hasJoiningReportDoc ? 'received' : (existingAdm.document_joining_report === 'received' ? 'received' : 'pending');
      const finalDocBankPassbook = hasBankPassbookDoc ? 'received' : (existingAdm.document_bank_passbook === 'received' ? 'received' : 'pending');
      const finalDocRationCard = hasRationCardDoc ? 'received' : (existingAdm.document_ration_card === 'received' ? 'received' : 'pending');

      setIfVal('qualification_merit', qualificationMerit);
      setIfVal('document_transfer_certificate', finalDocTc);
      setIfVal('document_study_certificate', finalDocStudy);
      setIfVal('document_ssc', finalDocSsc);
      setIfVal('document_inter', finalDocInter);
      setIfVal('document_ug_pg_cmm', finalDocUgPgCmm);
      setIfVal('document_aadhaar_card', finalDocAadhaar);
      setIfVal('document_photos', finalDocPhotos);
      setIfVal('document_income_certificate', finalDocIncome);
      setIfVal('document_caste_certificate', finalDocCaste);
      setIfVal('document_cet_rank_card', finalDocCetRank);
      setIfVal('document_cet_hall_ticket', finalDocCetHallTicket);
      setIfVal('document_allotment_letter', finalDocAllotment);
      setIfVal('document_joining_report', finalDocJoiningReport);
      setIfVal('document_bank_passbook', finalDocBankPassbook);
      setIfVal('document_ration_card', finalDocRationCard);

      if (admRows[0].lead_data) {
        try {
          let leadData = typeof admRows[0].lead_data === 'string' ? JSON.parse(admRows[0].lead_data) : admRows[0].lead_data;
          if (leadData && typeof leadData === 'object') {
            if (name) leadData.name = name;
            if (studentPhone) leadData.phone = studentPhone;
            if (aadhaar) leadData.student_aadhaar_number = aadhaar;
            if (fatherName) leadData.fatherName = fatherName;
            if (fatherPhone) leadData.fatherPhone = fatherPhone;
            if (motherPhone) leadData.motherPhone = motherPhone;
            if (preferredPhone) leadData.preferred_mobile_number = preferredPhone;
            if (streetAddress) {
              leadData.address = streetAddress;
              leadData.address_door_street = streetAddress;
              leadData.student_address = rawStreetAddress || streetAddress;
            }
            if (village) leadData.village = village;
            if (mandal) leadData.mandal = mandal;
            if (district) leadData.district = district;
            if (pincode) leadData.pincode = pincode;
            if (state) leadData.state = state;

            // Sync merit status to lead_data
            leadData.qualification_merit = qualificationMerit;
            if (!leadData.qualifications || typeof leadData.qualifications !== 'object') {
              leadData.qualifications = {};
            }
            leadData.qualifications.merit = qualificationMerit === 1;

            // Sync document status object in lead_data
            if (!leadData.documents || typeof leadData.documents !== 'object') {
              leadData.documents = {};
            }
            leadData.documents.ssc = finalDocSsc;
            leadData.documents.inter = finalDocInter;
            leadData.documents.ugPgCmm = finalDocUgPgCmm;
            leadData.documents.transferCertificate = finalDocTc;
            leadData.documents.studyCertificate = finalDocStudy;
            leadData.documents.aadhaarCard = finalDocAadhaar;
            leadData.documents.photos = finalDocPhotos;
            leadData.documents.incomeCertificate = finalDocIncome;
            leadData.documents.casteCertificate = finalDocCaste;
            leadData.documents.cetRankCard = finalDocCetRank;
            leadData.documents.cetHallTicket = finalDocCetHallTicket;
            leadData.documents.allotmentLetter = finalDocAllotment;
            leadData.documents.joiningReport = finalDocJoiningReport;
            leadData.documents.bankPassbook = finalDocBankPassbook;
            leadData.documents.rationCard = finalDocRationCard;

            // Sync _joiningRegistrationExtras (checklist & status)
            if (!leadData._joiningRegistrationExtras || typeof leadData._joiningRegistrationExtras !== 'object') {
              leadData._joiningRegistrationExtras = {};
            }
            const finalCertStatus = student.certificates_status || json.certificates_status || (isCertCompletedOrVerified ? 'Verified' : 'Unverified');
            const finalCertificationStatus = json.certification_status || (isCertCompletedOrVerified ? 'Yes' : 'Unverified');
            leadData._joiningRegistrationExtras.certificates_status = finalCertStatus;
            leadData._joiningRegistrationExtras.certification_status = finalCertificationStatus;

            if (!leadData._joiningRegistrationExtras.certificate_checklist || typeof leadData._joiningRegistrationExtras.certificate_checklist !== 'object') {
              leadData._joiningRegistrationExtras.certificate_checklist = {};
            }
            const chk = leadData._joiningRegistrationExtras.certificate_checklist;
            chk['10th_study'] = finalDocStudy;
            chk['inter_diploma_tc'] = finalDocTc;
            chk['10th_tc'] = hasTc ? 'received' : (chk['10th_tc'] || 'pending');
            chk['10th_original'] = finalDocSsc;
            chk['custom_1771671980118'] = finalDocSsc;
            chk['custom_1771672088118'] = finalDocSsc;
            chk['custom_1771672142110'] = finalDocSsc;
            chk['inter_diploma_cert'] = finalDocInter;
            chk['custom_1771672108925'] = finalDocInter;
            if (chk['inter_diploma_study'] && typeof chk['inter_diploma_study'] === 'object') {
              chk['inter_diploma_study'].status = finalDocStudy;
            } else {
              chk['inter_diploma_study'] = finalDocStudy;
            }

            setIfVal('lead_data', JSON.stringify(leadData));
          }
        } catch (e) {}
      }

      if (admUpdateFields.length > 0) {
        admUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
        admParams.push(normAdmissionNumber);
        await admissionsPool.query(
          `UPDATE admissions SET ${admUpdateFields.join(', ')} WHERE admission_number = ?`,
          admParams
        );
        updatedTables.push('admissions');
      }
    }

    // 2. Sync to admissions_db.leads table
    const [leadSearchRows] = await admissionsPool.query(
      `SELECT id FROM leads WHERE admission_number = ? ${leadId ? 'OR id = ?' : ''}`,
      leadId ? [normAdmissionNumber, leadId] : [normAdmissionNumber]
    );

    if (leadSearchRows.length > 0) {
      const leadUpdateFields = [];
      const leadParams = [];

      const setLeadVal = (col, val) => {
        if (val !== undefined && val !== null) {
          leadUpdateFields.push(`${col} = ?`);
          leadParams.push(val);
        }
      };

      setLeadVal('name', name);
      setLeadVal('phone', studentPhone);
      setLeadVal('alternate_mobile', fatherPhone);
      setLeadVal('email', email);
      setLeadVal('father_name', fatherName);
      setLeadVal('father_phone', fatherPhone);
      setLeadVal('address', streetAddress || [village, mandal, district].filter(Boolean).join(', '));
      setLeadVal('village', village);
      setLeadVal('mandal', mandal);
      setLeadVal('district', district);
      if (state) setLeadVal('state', state);
      setLeadVal('quota', quota);
      if (course) setLeadVal('course_interested', course);

      if (leadUpdateFields.length > 0) {
        leadUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
        const leadTargetId = leadSearchRows[0].id;
        leadParams.push(leadTargetId);
        await admissionsPool.query(
          `UPDATE leads SET ${leadUpdateFields.join(', ')} WHERE id = ?`,
          leadParams
        );
        updatedTables.push('leads');
      }
    }

    // 3. Sync to admissions_db.joinings table if joining_id or lead_id exists
    const [joiningSearchRows] = await admissionsPool.query(
      `SELECT id, lead_data, 
              document_ssc, document_inter, document_ug_pg_cmm, 
              document_transfer_certificate, document_study_certificate, 
              document_aadhaar_card, document_photos, document_income_certificate, 
              document_caste_certificate, document_cet_rank_card, document_cet_hall_ticket, 
              document_allotment_letter, document_joining_report, document_bank_passbook, 
              document_ration_card, qualification_merit 
       FROM joinings WHERE ${joiningId ? 'id = ?' : '1=0'} ${leadId ? 'OR lead_id = ?' : ''}`,
      [joiningId || '', leadId || '']
    );

    if (joiningSearchRows.length > 0) {
      const existingJoin = joiningSearchRows[0];
      const joinUpdateFields = [];
      const joinParams = [];

      const setJoinVal = (col, val) => {
        if (val !== undefined && val !== null) {
          joinUpdateFields.push(`${col} = ?`);
          joinParams.push(val);
        }
      };

      setJoinVal('student_name', name);
      setJoinVal('student_phone', studentPhone);
      setJoinVal('student_aadhaar_number', aadhaar);
      setJoinVal('student_gender', gender);
      setJoinVal('student_date_of_birth', dob);
      setJoinVal('father_name', fatherName);
      setJoinVal('father_phone', fatherPhone);
      setJoinVal('mother_phone', motherPhone);
      setJoinVal('preferred_mobile_number', preferredPhone);
      setJoinVal('address_door_street', streetAddress);
      setJoinVal('address_landmark', landmark || '');
      setJoinVal('address_village_city', village);

      setJoinVal('address_mandal', mandal);
      setJoinVal('address_district', district);
      if (pincode) setJoinVal('address_pin_code', pincode);
      if (state) setJoinVal('address_state', state);
      setJoinVal('course', course);
      setJoinVal('branch', branch);
      setJoinVal('quota', quota);
      setJoinVal('reservation_general', caste);
      setJoinVal('student_photo', studentPhoto);
      setJoinVal('father_photo', fatherPhoto);
      setJoinVal('mother_photo', motherPhoto);

      // Resolve final document statuses for joining record
      const joinDocSsc = hasSsc ? 'received' : (existingJoin.document_ssc === 'received' ? 'received' : 'pending');
      const joinDocInter = hasInter ? 'received' : (existingJoin.document_inter === 'received' ? 'received' : 'pending');
      const joinDocUgPgCmm = hasCmm ? 'received' : (existingJoin.document_ug_pg_cmm === 'received' ? 'received' : 'pending');
      const joinDocTc = hasTc ? 'received' : (existingJoin.document_transfer_certificate === 'received' ? 'received' : 'pending');
      const joinDocStudy = hasStudy ? 'received' : (existingJoin.document_study_certificate === 'received' ? 'received' : 'pending');
      const joinDocAadhaar = hasAadhaarDoc ? 'received' : (existingJoin.document_aadhaar_card === 'received' ? 'received' : 'pending');
      const joinDocPhotos = hasPhotosDoc ? 'received' : (existingJoin.document_photos === 'received' ? 'received' : 'pending');
      const joinDocCaste = hasCasteDoc ? 'received' : (existingJoin.document_caste_certificate === 'received' ? 'received' : 'pending');
      const joinDocIncome = hasIncomeDoc ? 'received' : (existingJoin.document_income_certificate === 'received' ? 'received' : 'pending');
      const joinDocCetRank = hasRankDoc ? 'received' : (existingJoin.document_cet_rank_card === 'received' ? 'received' : 'pending');
      const joinDocCetHallTicket = hasHallTicketDoc ? 'received' : (existingJoin.document_cet_hall_ticket === 'received' ? 'received' : 'pending');
      const joinDocAllotment = hasAllotmentDoc ? 'received' : (existingJoin.document_allotment_letter === 'received' ? 'received' : 'pending');
      const joinDocJoiningReport = hasJoiningReportDoc ? 'received' : (existingJoin.document_joining_report === 'received' ? 'received' : 'pending');
      const joinDocBankPassbook = hasBankPassbookDoc ? 'received' : (existingJoin.document_bank_passbook === 'received' ? 'received' : 'pending');
      const joinDocRationCard = hasRationCardDoc ? 'received' : (existingJoin.document_ration_card === 'received' ? 'received' : 'pending');

      setJoinVal('qualification_merit', qualificationMerit);
      setJoinVal('document_transfer_certificate', joinDocTc);
      setJoinVal('document_study_certificate', joinDocStudy);
      setJoinVal('document_ssc', joinDocSsc);
      setJoinVal('document_inter', joinDocInter);
      setJoinVal('document_ug_pg_cmm', joinDocUgPgCmm);
      setJoinVal('document_aadhaar_card', joinDocAadhaar);
      setJoinVal('document_photos', joinDocPhotos);
      setJoinVal('document_income_certificate', joinDocIncome);
      setJoinVal('document_caste_certificate', joinDocCaste);
      setJoinVal('document_cet_rank_card', joinDocCetRank);
      setJoinVal('document_cet_hall_ticket', joinDocCetHallTicket);
      setJoinVal('document_allotment_letter', joinDocAllotment);
      setJoinVal('document_joining_report', joinDocJoiningReport);
      setJoinVal('document_bank_passbook', joinDocBankPassbook);
      setJoinVal('document_ration_card', joinDocRationCard);

      if (joiningSearchRows[0].lead_data) {
        try {
          let leadData = typeof joiningSearchRows[0].lead_data === 'string' ? JSON.parse(joiningSearchRows[0].lead_data) : joiningSearchRows[0].lead_data;
          if (leadData && typeof leadData === 'object') {
            if (name) leadData.name = name;
            if (studentPhone) leadData.phone = studentPhone;
            if (aadhaar) leadData.student_aadhaar_number = aadhaar;
            if (fatherName) leadData.fatherName = fatherName;
            if (fatherPhone) leadData.fatherPhone = fatherPhone;
            if (motherPhone) leadData.motherPhone = motherPhone;
            if (preferredPhone) leadData.preferred_mobile_number = preferredPhone;
            if (streetAddress) {
              leadData.address = streetAddress;
              leadData.address_door_street = streetAddress;
              leadData.student_address = rawStreetAddress || streetAddress;
            }
            if (village) leadData.village = village;
            if (mandal) leadData.mandal = mandal;
            if (district) leadData.district = district;
            if (pincode) leadData.pincode = pincode;
            if (state) leadData.state = state;

            // Sync merit status to lead_data
            leadData.qualification_merit = qualificationMerit;
            if (!leadData.qualifications || typeof leadData.qualifications !== 'object') {
              leadData.qualifications = {};
            }
            leadData.qualifications.merit = qualificationMerit === 1;

            // Sync document status object in lead_data
            if (!leadData.documents || typeof leadData.documents !== 'object') {
              leadData.documents = {};
            }
            leadData.documents.ssc = joinDocSsc;
            leadData.documents.inter = joinDocInter;
            leadData.documents.ugPgCmm = joinDocUgPgCmm;
            leadData.documents.transferCertificate = joinDocTc;
            leadData.documents.studyCertificate = joinDocStudy;
            leadData.documents.aadhaarCard = joinDocAadhaar;
            leadData.documents.photos = joinDocPhotos;
            leadData.documents.incomeCertificate = joinDocIncome;
            leadData.documents.casteCertificate = joinDocCaste;
            leadData.documents.cetRankCard = joinDocCetRank;
            leadData.documents.cetHallTicket = joinDocCetHallTicket;
            leadData.documents.allotmentLetter = joinDocAllotment;
            leadData.documents.joiningReport = joinDocJoiningReport;
            leadData.documents.bankPassbook = joinDocBankPassbook;
            leadData.documents.rationCard = joinDocRationCard;

            // Sync _joiningRegistrationExtras (checklist & status)
            if (!leadData._joiningRegistrationExtras || typeof leadData._joiningRegistrationExtras !== 'object') {
              leadData._joiningRegistrationExtras = {};
            }
            const finalCertStatus = student.certificates_status || json.certificates_status || (isCertCompletedOrVerified ? 'Verified' : 'Unverified');
            const finalCertificationStatus = json.certification_status || (isCertCompletedOrVerified ? 'Yes' : 'Unverified');
            leadData._joiningRegistrationExtras.certificates_status = finalCertStatus;
            leadData._joiningRegistrationExtras.certification_status = finalCertificationStatus;

            if (!leadData._joiningRegistrationExtras.certificate_checklist || typeof leadData._joiningRegistrationExtras.certificate_checklist !== 'object') {
              leadData._joiningRegistrationExtras.certificate_checklist = {};
            }
            const chk = leadData._joiningRegistrationExtras.certificate_checklist;
            chk['10th_study'] = joinDocStudy;
            chk['inter_diploma_tc'] = joinDocTc;
            chk['10th_tc'] = hasTc ? 'received' : (chk['10th_tc'] || 'pending');
            chk['10th_original'] = joinDocSsc;
            chk['custom_1771671980118'] = joinDocSsc;
            chk['custom_1771672088118'] = joinDocSsc;
            chk['custom_1771672142110'] = joinDocSsc;
            chk['inter_diploma_cert'] = joinDocInter;
            chk['custom_1771672108925'] = joinDocInter;
            if (chk['inter_diploma_study'] && typeof chk['inter_diploma_study'] === 'object') {
              chk['inter_diploma_study'].status = joinDocStudy;
            } else {
              chk['inter_diploma_study'] = joinDocStudy;
            }

            setJoinVal('lead_data', JSON.stringify(leadData));
          }
        } catch (e) {}
      }

      if (joinUpdateFields.length > 0) {
        joinUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
        const joinTargetId = joiningSearchRows[0].id;
        joinParams.push(joinTargetId);
        await admissionsPool.query(
          `UPDATE joinings SET ${joinUpdateFields.join(', ')} WHERE id = ?`,
          joinParams
        );
        updatedTables.push('joinings');
      }
    }

    return {
      success: true,
      admissionNumber: normAdmissionNumber,
      updatedTables,
      matched: updatedTables.length > 0
    };
  } catch (error) {
    console.error(`Error in syncStudentToAdmissions for ${admissionNumber}:`, error);
    return {
      success: false,
      admissionNumber: normAdmissionNumber,
      error: error.message
    };
  }
}

/**
 * Bulk sync all SDMS students (or a specific list of admission numbers) to admissions database
 * @param {object} options - Options for sync (limit, batchSize, admissionNumbers)
 */
async function bulkSyncAllStudentsToAdmissions(options = {}) {
  const { batchSize = 50, admissionNumbers = null } = options;
  const stats = { totalProcessed: 0, totalUpdated: 0, totalErrors: 0, errors: [] };

  try {
    let targetAdmissionNumbers = [];

    if (admissionNumbers && Array.isArray(admissionNumbers) && admissionNumbers.length > 0) {
      targetAdmissionNumbers = admissionNumbers.map(a => String(a).trim()).filter(Boolean);
    } else {
      // Find all admission_numbers present in admissions_db (admissions or leads tables)
      const [admRows] = await admissionsPool.query(
        `SELECT DISTINCT admission_number FROM admissions WHERE admission_number IS NOT NULL AND TRIM(admission_number) != ''`
      );
      const [leadRows] = await admissionsPool.query(
        `SELECT DISTINCT admission_number FROM leads WHERE admission_number IS NOT NULL AND TRIM(admission_number) != ''`
      );

      const admSet = new Set([
        ...admRows.map(r => String(r.admission_number).trim()),
        ...leadRows.map(r => String(r.admission_number).trim())
      ]);

      targetAdmissionNumbers = Array.from(admSet).filter(Boolean);
    }

    console.log(`[AdmissionsSync] Found ${targetAdmissionNumbers.length} target admission records in admissions_db. Starting bulk sync...`);

    for (let i = 0; i < targetAdmissionNumbers.length; i += batchSize) {
      const chunkAdmissions = targetAdmissionNumbers.slice(i, i + batchSize);
      const placeholders = chunkAdmissions.map(() => '?').join(',');

      const [sdmsStudents] = await masterPool.query(
        `SELECT * FROM students WHERE admission_number IN (${placeholders}) OR admission_no IN (${placeholders})`,
        [...chunkAdmissions, ...chunkAdmissions]
      );

      await Promise.all(
        sdmsStudents.map(async (student) => {
          const admNum = student.admission_number || student.admission_no;
          if (!admNum) return;
          stats.totalProcessed++;

          const res = await syncStudentToAdmissions(admNum, student);
          if (res.success && res.matched) {
            stats.totalUpdated++;
          } else if (!res.success) {
            stats.totalErrors++;
            if (stats.errors.length < 50) {
              stats.errors.push({ admissionNumber: admNum, error: res.error });
            }
          }
        })
      );
      console.log(`[AdmissionsSync] Processed ${Math.min(i + batchSize, targetAdmissionNumbers.length)} / ${targetAdmissionNumbers.length} target admission records.`);
    }

    console.log(`[AdmissionsSync] Bulk sync completed. Processed: ${stats.totalProcessed}, Updated: ${stats.totalUpdated}, Errors: ${stats.totalErrors}`);
    return stats;
  } catch (err) {
    console.error('[AdmissionsSync] Critical error during bulk sync:', err);
    throw err;
  }
}

/**
 * Direct update helper for dual-database edits (synchronous execution)
 */
async function triggerAdmissionsSyncAsync(admissionNumber, studentData = null) {
  return await syncStudentToAdmissions(admissionNumber, studentData);
}

module.exports = {
  syncStudentToAdmissions,
  bulkSyncAllStudentsToAdmissions,
  triggerAdmissionsSyncAsync
};

