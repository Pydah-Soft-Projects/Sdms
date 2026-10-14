const PROFILE_REPORT_FIELD_KEY_ALIASES = {
    admission_number: ['admission_no', 'Admission Number', 'Admission No', 'enquiryNumber'],
    student_name: ['Student Name', 'studentname', 'name', 'fullName'],
    father_name: ['Father Name', 'fathername', 'fatherName'],
    mother_name: ['Mother Name', 'mothername', 'motherName'],
    gender: ['M/F', 'Gender', 'sex'],
    college: ['College Name', 'college_name', 'school_or_college_name'],
    course: ['Program', 'Program Name', 'Course', 'Course Name', 'course_name', 'program_name'],
    branch: ['Branch Name', 'branch_name', 'Branch'],
    batch: ['Batch'],
    current_year: ['Current Academic Year', 'Year', 'academic_year', 'Current Year'],
    current_semester: ['Semester', 'Semister', 'Current Semester'],
    stud_type: ['StudType', 'Student Type', 'student_type', 'quota', 'Quota'],
    student_status: ['Student Status', 'studentstatus'],
    student_mobile: ['Student Mobile number', 'Mobile Number', 'Student Mobile', 'student_mobile_number', 'mobile_number', 'phone'],
    parent_mobile1: ['Parent Mobile 1', 'parent_mobile_1', 'Parent Mobile Number 1', 'father_mobile', 'father_phone', 'fatherPhone'],
    parent_mobile2: ['Parent Mobile 2', 'parent_mobile_2', 'Parent Mobile Number 2', 'mother_mobile', 'mother_phone', 'motherPhone'],
    dob: ['DOB (Date of Birth - DD-MM-YYYY)', 'DOB (Date-Month-Year) Ex: 09-Sep-2003)', 'date_of_birth', 'DOB', 'Date of Birth', 'dateOfBirth'],
    caste: ['Category', 'category', 'category_name', 'category_id', 'caste_id', 'Caste'],
    adhar_no: ['aadhar_no', 'aadhaar_no', 'aadhar_number', 'aadhaar_number', 'aadhaarNumber', 'ADHAR No', 'Aadhar Number', 'Aadhaar Number', 'adhar', 'aadhar', 'aadhaar'],
    city_village: ['city_village_name', 'City/Village', 'City/Village Name', 'city', 'village', 'City', 'Village'],
    mandal_name: ['mandal', 'Mandal Name', 'Mandal'],
    district: ['district_name', 'District', 'District Name'],
    student_address: ['address', 'permanent_address', 'Student Address', 'Permanent Address', 'Student Address (D.No, Str name, Village, Mandal, Dist)'],
    student_photo: ['photo', 'studentphoto', 'Student Photo', 'Photo'],
    certificates_status: ['certificate_status', 'certification_status', 'certificates_verified', 'certificatesstatus', 'Certificates Status', 'Certificate Status'],
    pin_no: ['pin_number', 'roll_number', 'PIN Number', 'Pin Number', 'temporary_roll_no', 'temp_roll_no'],
    apaar_id: ['apaar id', 'APAAR ID', 'apaarId'],
    previous_college: ['previous_college_name', 'Previous College', 'Previous College Name', 'interCollege'],
    admission_date: ['admissionDate', 'Admission Date', 'admission_date'],
    scholar_status: ['scholarstatus', 'Scholar Status', 'isScholarApplicable'],
    remarks: ['Remarks', 'notes']
};

const flattenStudentData = rawStudentData => {
    if (!rawStudentData || typeof rawStudentData !== 'object') return {};
    const data = { ...rawStudentData };
    const lead = data.leadData || {};
    const info = data.studentInfo || {};
    const parents = data.parents || {};
    const father = parents.father || {};
    const mother = parents.mother || {};
    const regForm = data.registrationFormData || {};
    const courseInfo = data.courseInfo || {};

    const defaults = {
        student_name: info.name || lead.name,
        father_name: father.name || lead.fatherName,
        mother_name: mother.name || lead.motherName,
        student_mobile: info.phone || lead.phone,
        parent_mobile1: father.phone || lead.fatherPhone,
        parent_mobile2: mother.phone || lead.motherPhone,
        dob: info.dateOfBirth,
        gender: info.gender || lead.gender,
        adhar_no: info.aadhaarNumber,
        student_photo: info.photo,
        city_village: lead.village,
        mandal_name: lead.mandal,
        district: lead.district,
        student_address: lead.address,
        certificates_status: regForm.certificates_status || data.certification_status || data.certificates_verified,
        student_status: regForm.student_status,
        stud_type: courseInfo.quota || lead.quota
    };

    for (const [key, val] of Object.entries(defaults)) {
        if (data[key] === undefined && val !== undefined && val !== null && val !== '') {
            data[key] = val;
        }
    }
    return data;
};

const parseJsonObject = value => {
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return {};
        }
    }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

const isValidProfileValue = value => {
    if (value === null || value === undefined || value === false) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    const normalized = String(value).trim().toLowerCase();
    return !['', 'n/a', '-', '{}', 'null', 'undefined'].includes(normalized);
};

const getProfileFieldKeys = field => {
    if (!field) return [];
    const keys = [field.key, field.label].filter(Boolean);
    const normalizedFieldKeys = new Set(keys.map(key => String(key).trim().toLowerCase()));
    for (const [key, aliases] of Object.entries(PROFILE_REPORT_FIELD_KEY_ALIASES)) {
        if ([key, ...aliases].some(alias => normalizedFieldKeys.has(alias.toLowerCase()))) {
            keys.push(key, ...aliases);
        }
    }
    return [...new Set(keys)];
};

module.exports = {
    PROFILE_REPORT_FIELD_KEY_ALIASES,
    flattenStudentData,
    parseJsonObject,
    isValidProfileValue,
    getProfileFieldKeys
};
