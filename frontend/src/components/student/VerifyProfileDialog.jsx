import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertCircle, Clock, CheckCircle, User, Users, MapPin, GraduationCap, FileText, ChevronRight, Check, Phone, Lock } from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

// Field categorization matching Settings.jsx and PublicForm.jsx
const PERSONAL_FIELDS = [
    'student_name', 'student name', 'name', 'studentname',
    'father_name', 'father name', 'father', 'fathername',
    'mother_name', 'mother name', 'mother', 'mothername',
    'gender', 'm/f', 'sex', 'mf',
    'dob', 'date of birth', 'birth date', 'birthday', 'date-month-year', 'date month year',
    'adhar_no', 'adhar number', 'aadhar', 'aadhar no', 'aadhar number', 'adhar', 'aadhar_no', 'aadhar no',
    'pin_no', 'pin number', 'pin', 'pinno',
    'apaar', 'apaar id', 'apaar_id', 'apaar number', 'apaar no', 'apaarid',
    'admission_no', 'admission number', 'admission', 'admissionno',
    'caste', 'category'
];
const ACADEMIC_FIELDS = [
    'college', 'college name', 'collegename',
    'batch', 'academic year', 'batch year', 'admission year', 'admission year (ex:', 'admission year ex', 'admission year (ex: 09-sep-2003)',
    'course', 'course name', 'coursename',
    'branch', 'branch name', 'specialization', 'branchname',
    'current_year', 'current academic year', 'current year', 'year', 'currentyear',
    'current_semester', 'current semester', 'semester', 'currentsemester',
    'stud_type', 'student type', 'student_type', 'type', 'studtype',
    'student_status', 'student status', 'status', 'studentstatus',
    'scholar_status', 'scholar status', 'scholarship status', 'scholarstatus',
    'previous_college', 'previous college', 'previous college name', 'previous_college_name', 'previouscollege'
];
const CONTACT_FIELDS = [
    'student_mobile', 'student mobile', 'student mobile number', 'student phone', 'mobile', 'studentmobile',
    'parent_mobile1', 'parent mobile1', 'parent mobile 1', 'parent mobile number 1', 'parent phone 1', 'parentmobile1',
    'parent_mobile2', 'parent mobile2', 'parent mobile 2', 'parent mobile number 2', 'parent phone 2', 'parentmobile2',
    'phone', 'contact', 'telephone', 'mobile number', 'mobilenumber'
];
const ADDRESS_FIELDS = [
    'student_address', 'student address', 'address', 'full address', 'permanent address', 'studentaddress',
    'city_village', 'city village', 'city/village', 'city village name', 'city or village', 'cityvillage', 'city/village name', 'cityvillage name',
    'mandal_name', 'mandal name', 'mandal', 'mandalname',
    'district', 'district name', 'districtname',
    'state', 'state name', 'statename',
    'pincode', 'pin code', 'postal code', 'zip code', 'pincode'
];
const ADDITIONAL_FIELDS = [
    'caste', 'category',
    'certificates_status', 'certificate status', 'certificates status', 'cert status', 'certificatesstatus',
    'remarks', 'remark', 'notes', 'note', 'comments', 'comment',
    'student_photo', 'student photo', 'photo', 'image', 'picture', 'profile picture', 'studentphoto',
    'certificate', 'document'
];

const categorizeField = (field) => {
    const key = field.key?.toLowerCase() || '';
    const label = field.label?.toLowerCase() || '';

    const normalize = (str) => {
        return str
            .replace(/[()]/g, ' ')
            .replace(/\([^)]*\)/g, '')
            .replace(/[_-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    };

    const normalizedKey = normalize(key);
    const normalizedLabel = normalize(label);

    const matches = (pattern) => {
        const normalizedPattern = normalize(pattern);
        return normalizedKey.includes(normalizedPattern) ||
            normalizedLabel.includes(normalizedPattern) ||
            normalizedKey.startsWith(normalizedPattern) ||
            normalizedLabel.startsWith(normalizedPattern) ||
            normalizedKey === normalizedPattern ||
            normalizedLabel === normalizedPattern;
    };

    if (ACADEMIC_FIELDS.some(matches)) return 'academic';
    if (ADDRESS_FIELDS.some(matches)) return 'address';
    if (PERSONAL_FIELDS.some(matches)) return 'personal';
    if (CONTACT_FIELDS.some(matches)) return 'contact';

    return 'other';
};

// System fields and restricted fields that shouldn't be edited by students directly
const READ_ONLY_KEYS = [
    'batch', 'course', 'branch',
    'admission_number', 'admission_no', 'admission_date', 'admission date', 'admission_year', 'admission year',
    'parent_mobile1', 'parent_mobile2', 'parent mobile 1', 'parent mobile 2', 'parent mobile1', 'parent mobile2', 'parent mobile', 'parent_mobile', 'parent phone', 'parent_phone', 'parent phone 1', 'parent phone 2',
    'pin_no', 'current_year', 'current_semester', 'stud_type', 'student_status', 'scholar_status', 'certificates_status'
];

const isFieldReadOnly = (field) => {
    if (!field) return false;
    const lowerKey = String(field.key || '').trim().toLowerCase();
    const lowerLabel = String(field.label || '').trim().toLowerCase();

    // Direct check in READ_ONLY_KEYS
    if (READ_ONLY_KEYS.includes(lowerKey) || READ_ONLY_KEYS.includes(lowerLabel)) return true;

    // Admission date / number / year
    if (lowerKey.includes('admission') || lowerLabel.includes('admission')) return true;

    // Parent mobile / phone / contact editing
    if (
        (lowerKey.includes('parent') && (lowerKey.includes('mobile') || lowerKey.includes('phone') || lowerKey.includes('contact') || lowerKey.includes('no') || lowerKey.includes('num'))) ||
        (lowerLabel.includes('parent') && (lowerLabel.includes('mobile') || lowerLabel.includes('phone') || lowerLabel.includes('contact') || lowerLabel.includes('no') || lowerLabel.includes('num')))
    ) {
        return true;
    }

    // Pattern matches against other keys (except student_status)
    return READ_ONLY_KEYS.some(k => (lowerKey.includes(k) || lowerLabel.includes(k)) && k !== 'student_status');
};

export const VerifyProfileDialog = ({ isOpen, onClose, studentData, onRequestSubmitted }) => {
    const [formData, setFormData] = useState({});
    const [originalData, setOriginalData] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [pendingRequest, setPendingRequest] = useState(null);
    const [activeTab, setActiveTab] = useState('personal');

    // Dynamic Form Fields state
    const [formFields, setFormFields] = useState([]);
    const [loadingConfig, setLoadingConfig] = useState(true);

    // Fetch Registration Form Config
    useEffect(() => {
        const fetchFormConfig = async () => {
            if (!isOpen) return;
            try {
                setLoadingConfig(true);
                const res = await api.get('/forms');
                if (res.data?.success && res.data.data) {
                    const activeForm = res.data.data.find(f => f.is_active);
                    const rawFields = activeForm.form_fields || [];

                    // Enforce and repair core fields
                    const coreFieldRepairs = {
                        gender: { type: 'select', options: ['Male', 'Female', 'Other'] },
                        current_year: { type: 'select', options: ['1', '2', '3', '4'] },
                        current_semester: { type: 'select', options: ['1', '2'] }
                    };

                    let correctedFields = rawFields.map(field => {
                        const k = String(field.key || '').toLowerCase();
                        if (coreFieldRepairs[k]) {
                            return { ...field, ...coreFieldRepairs[k] };
                        }
                        // If it's a system field that's read-only, ensure it's text type for better display
                        if (READ_ONLY_KEYS.includes(k) && field.type === 'select' && (!field.options || field.options.length === 0)) {
                            return { ...field, type: 'text' };
                        }
                        return field;
                    });

                    const coreFields = [
                        { key: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], required: true },
                        { key: 'course', label: 'Course', type: 'text', required: true },
                        { key: 'branch', label: 'Branch', type: 'text', required: true },
                        { key: 'current_year', label: 'Current Year', type: 'select', options: ['1', '2', '3', '4'], required: true },
                        { key: 'current_semester', label: 'Current Semester', type: 'select', options: ['1', '2'], required: true }
                    ];

                    coreFields.forEach(core => {
                        const exists = correctedFields.some(f => {
                            const k = String(f.key || '').toLowerCase();
                            const l = String(f.label || '').toLowerCase();
                            const ck = core.key.toLowerCase();
                            return k === ck || k.includes(ck) || l.includes(ck);
                        });
                        if (!exists) correctedFields.push(core);
                    });

                    setFormFields(correctedFields);
                }
            } catch (err) {
                console.error("Failed to fetch active form for verification", err);
            } finally {
                setLoadingConfig(false);
            }
        };
        fetchFormConfig();
    }, [isOpen]);

    // Group fields
    const groupedFields = useMemo(() => {
        const groups = { personal: [], academic: [], contact: [], address: [], other: [] };
        formFields.forEach(field => {
            // Skip file uploads in verify profile module
            if (field.type === 'file') return;

            const lowerKey = String(field.key).toLowerCase();
            const lowerLabel = String(field.label).toLowerCase();

            // Skip Remarks
            if (lowerKey === 'remarks' || lowerLabel.includes('remarks')) return;

            let modifiedField = { ...field };

            // Override caste to be a select
            if (lowerKey === 'caste' || lowerLabel.includes('caste')) {
                modifiedField.type = 'select';
                if (!modifiedField.options || modifiedField.options.length < 2) {
                    modifiedField.options = ['OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'Minority', 'Other'];
                }
            }

            const category = categorizeField(modifiedField);
            if (groups[category]) {
                groups[category].push(modifiedField);
            } else {
                groups.other.push(modifiedField);
            }
        });
        return groups;
    }, [formFields]);

    // Initial load of student data
    useEffect(() => {
        if (studentData && formFields.length > 0) {
            let parsedData = {};
            if (studentData.student_data) {
                if (typeof studentData.student_data === 'string') {
                    try { parsedData = JSON.parse(studentData.student_data); } catch (e) { }
                } else {
                    parsedData = studentData.student_data;
                }
            }

            const getVal = (field) => {
                if (!field) return '';
                const key = field.key;
                // Priorities for common variations and normalization
                const lowerKey = String(key || '').toLowerCase();
                const lowerLabel = String(field.label || '').toLowerCase();

                // Advanced case-insensitive lookup within student_data
                const getNested = (searchKey) => {
                    if (!parsedData) return null;
                    const sk = String(searchKey).toLowerCase();
                    const skUnderscore = sk.replace(/\s+/g, '_');
                    const skSpace = sk.replace(/_/g, ' ');

                    const foundK = Object.keys(parsedData).find(k => {
                        const lk = String(k).toLowerCase();
                        return lk === sk || lk === skUnderscore || lk === skSpace;
                    });
                    return foundK ? parsedData[foundK] : null;
                };

                const mappings = {
                    name: studentData.student_name || getNested('Student Name') || getNested('Name'),
                    adhar: studentData.adhar_no || studentData.aadhar_no || getNested('Adhar No') || getNested('Aadhar No') || getNested('Aadhar Number') || getNested('ADHAR No'),
                    pin: studentData.pin_no || getNested('PIN NO') || getNested('PIN Number') || getNested('Roll No') || getNested('Hall Ticket No') || getNested('Hallticket'),
                    apaar: (function () {
                        // 1. Direct columns or top-level properties
                        let v = studentData.apaar_id || studentData.apaar || studentData.apaar_no || studentData['APAAR ID'] || studentData['apaar_id'];
                        if (v) return v;

                        // 2. Precise nested lookups (getNested handles space/underscore)
                        v = getNested('APAAR ID') || getNested('apaar_id') || getNested('APAAR NO') || getNested('APAAR Number') || getNested('APAARID');
                        if (v) return v;

                        // 3. Fuzzy search in nested keys (any key containing 'apaar' or 'appar')
                        if (parsedData && typeof parsedData === 'object') {
                            const foundK = Object.keys(parsedData).find(k => {
                                const lk = String(k).toLowerCase();
                                return lk.includes('apaar') || lk.includes('appar');
                            });
                            if (foundK) return parsedData[foundK];
                        }
                        return '';
                    })(),
                    gender: (function () {
                        const raw = studentData.gender || getNested('Gender') || getNested('Sex') || getNested('M/F') || '';
                        const s = String(raw).trim().toUpperCase();
                        if (['M', 'MALE', 'BOY', '1'].includes(s)) return 'Male';
                        if (['F', 'FEMALE', 'GIRL', '2'].includes(s)) return 'Female';
                        if (['OTHER', 'O', 'NON-BINARY'].includes(s)) return 'Other';
                        return '';
                    })(),
                    course: studentData.course || getNested('Program') || getNested('Program Name') || getNested('Course') || getNested('Degree'),
                    year: studentData.current_year || getNested('Year') || getNested('Current Year'),
                    sem: studentData.current_semester || getNested('Semister') || getNested('Semester') || getNested('Current Semester'),
                    branch: studentData.branch || getNested('Branch') || getNested('Branch Name') || getNested('Specialization'),
                    caste: studentData.caste || getNested('Caste') || getNested('Category'),
                    father: studentData.father_name || getNested('Father Name') || getNested('Father'),
                    mother: studentData.mother_name || getNested('Mother Name') || getNested('Mother'),
                    dob: studentData.dob || getNested('DOB') || getNested('Date of Birth'),
                    mobile: studentData.student_mobile || getNested('Student Mobile number') || getNested('Phone') || getNested('Student Mobile'),
                    parent1: studentData.parent_mobile1 || getNested('Parent Mobile Number 1') || getNested('Parent Mobile 1'),
                    parent2: studentData.parent_mobile2 || getNested('Parent Mobile Number 2') || getNested('Parent Mobile 2'),
                    college: studentData.college || getNested('College') || getNested('College Name'),
                    address: studentData.student_address || getNested('Student Address') || getNested('Address'),
                    city: studentData.city_village || getNested('City') || getNested('City/Village'),
                    mandal: studentData.mandal_name || getNested('Mandal'),
                    district: studentData.district || getNested('District'),
                    admission: studentData.admission_date || getNested('Admission Date') || getNested('AdmissionDate'),
                    batch: studentData.batch || getNested('Batch') || getNested('Academic Year')
                };

                // Exact Match Checks (Highest Priority)
                if (lowerKey === 'student_name' || lowerLabel === 'student name' || lowerLabel === 'name') return mappings.name || '';
                if (lowerKey === 'adhar_no' || lowerLabel.includes('adhar') || lowerLabel.includes('aadhar')) return mappings.adhar || '';
                if (lowerKey === 'pin_no' || lowerLabel.includes('pin no') || lowerLabel.includes('roll')) return mappings.pin || '';
                if (lowerKey === 'apaar_id' || lowerKey === 'apaar' || lowerKey === 'appar' || lowerLabel.includes('apaar') || lowerLabel.includes('appar')) return mappings.apaar || '';
                if (lowerKey === 'gender' || lowerLabel.includes('gender') || lowerLabel === 'sex') return mappings.gender || '';
                if (lowerKey === 'course' || lowerLabel.includes('course') || lowerLabel.includes('program')) return mappings.course || '';
                if (lowerKey === 'current_year' || lowerLabel.includes('current year') || lowerKey === 'year') return mappings.year || '';
                if (lowerKey === 'current_semester' || lowerLabel.includes('semester')) return mappings.sem || '';
                if (lowerKey === 'branch' || lowerLabel.includes('branch')) return mappings.branch || '';
                if (lowerKey === 'caste' || lowerLabel.includes('caste') || lowerLabel.includes('category')) return mappings.caste || '';
                if (lowerKey === 'father_name' || lowerLabel.includes('father')) return mappings.father || '';
                if (lowerKey === 'mother_name' || lowerLabel.includes('mother')) return mappings.mother || '';
                if (lowerKey === 'student_mobile' || lowerLabel.includes('student mobile') || lowerLabel === 'mobile') return mappings.mobile || '';
                if (lowerKey === 'parent_mobile1' || lowerLabel.includes('parent mobile 1')) return mappings.parent1 || '';
                if (lowerKey === 'parent_mobile2' || lowerLabel.includes('parent mobile 2')) return mappings.parent2 || '';
                if (lowerKey === 'college') return mappings.college || '';
                if (lowerKey === 'student_address' || lowerLabel.includes('address')) return mappings.address || '';
                if (lowerKey === 'city_village' || lowerLabel === 'city' || lowerLabel === 'village') return mappings.city || '';
                if (lowerKey === 'mandal_name' || lowerLabel === 'mandal') return mappings.mandal || '';
                if (lowerKey === 'district') return mappings.district || '';
                if (lowerKey === 'admission_date' || lowerLabel.includes('admission date')) return mappings.admission || '';
                if (lowerKey === 'batch') return mappings.batch || '';

                if (lowerKey === 'dob' || lowerLabel.includes('date of birth')) {
                    const d = mappings.dob || '';
                    return d ? String(d).substring(0, 10) : '';
                }

                // General Fallback (Check flat studentData then parsedData by key/label)
                if (studentData[key] !== undefined && studentData[key] !== null) return studentData[key];
                if (parsedData[key] !== undefined && parsedData[key] !== null) return parsedData[key];

                const labelValue = getNested(field.label);
                if (labelValue !== null && labelValue !== undefined) return labelValue;

                return '';
            };

            const initialData = {};
            formFields.forEach(field => {
                if (field.type === 'file') return;
                let val = getVal(field);
                if (field.type === 'date' && val) val = String(val).substring(0, 10);

                // APAAR Formatting for initial load (XXXX-XXXX-XXXX)
                const lk = String(field.key || '').toLowerCase();
                const ll = String(field.label || '').toLowerCase();
                if ((lk.includes('apaar') || lk.includes('appar') || ll.includes('apaar') || ll.includes('appar')) && val) {
                    let digits = String(val).replace(/\D/g, '').substring(0, 12);
                    let formatted = '';
                    for (let i = 0; i < digits.length; i++) {
                        if (i > 0 && i % 4 === 0) formatted += '-';
                        formatted += digits[i];
                    }
                    val = formatted;
                }

                initialData[field.key] = val;
            });

            setFormData(initialData);
            setOriginalData(initialData);
        }
    }, [studentData, formFields]);

    // Check if there's an existing pending request
    useEffect(() => {
        const fetchRequests = async () => {
            if (isOpen) {
                try {
                    const res = await api.get('/profile-changes/my-requests');
                    if (res.data?.success && res.data.data) {
                        const pending = res.data.data.find(r => r.status === 'pending');
                        setPendingRequest(pending || null);
                    }
                } catch (err) {
                    console.error('Failed to fetch profile change requests', err);
                }
            }
        };
        fetchRequests();
    }, [isOpen]);

    const handleChange = (e) => {
        let { name, value } = e.target;

        // APAAR ID Formatting (xxxx-xxxx-xxxx)
        const lowerName = String(name).toLowerCase();
        if (lowerName === 'apaar_id' || lowerName.includes('apaar') || lowerName.includes('appar')) {
            let digits = value.replace(/\D/g, '');
            digits = digits.substring(0, 12);
            let formatted = '';
            for (let i = 0; i < digits.length; i++) {
                if (i > 0 && i % 4 === 0) formatted += '-';
                formatted += digits[i];
            }
            value = formatted;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const hasChanges = () => {
        for (const key in formData) {
            if (formData[key] !== originalData[key]) {
                const field = formFields.find(f => f.key === key) || { key };
                if (!isFieldReadOnly(field)) return true;
            }
        }
        return false;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const changedFields = (function () {
            const changes = {};
            for (const key in formData) {
                if (formData[key] !== originalData[key]) {
                    const field = formFields.find(f => f.key === key) || { key };
                    if (isFieldReadOnly(field)) continue;

                    // Apply gender normalization to changes too
                    if (key === 'gender') {
                        const g = String(formData[key]).toUpperCase();
                        if (g === 'MALE') changes[key] = 'M';
                        else if (g === 'FEMALE') changes[key] = 'F';
                        else changes[key] = 'Other';
                    } else {
                        changes[key] = formData[key];
                    }
                }
            }
            return changes;
        })();

        if (Object.keys(changedFields).length === 0) {
            toast.error('No changes detected');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await api.post('/profile-changes/request', {
                requested_changes: changedFields
            });

            if (res.data?.success) {
                toast.success('Profile change request submitted successfully. It will be reviewed for approval.');
                setPendingRequest({ status: 'pending', requested_changes: changedFields });
                if (onRequestSubmitted) onRequestSubmitted();
            } else {
                toast.error(res.data?.message || 'Failed to submit request');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMarkVerified = async () => {
        try {
            setIsVerifying(true);
            const res = await api.post('/profile-changes/mark-verified', {});
            if (res.data?.success) {
                toast.success('Profile marked as verified!');

                // Need to reload window to update useMemo isVerified instantly in Dashboard
                // Or let the parent handles it. A quick timeout is easiest.
                setTimeout(() => {
                    onClose();
                    window.location.reload();
                }, 1000);
            } else {
                toast.error(res.data?.message || 'Failed to verify profile');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to verify profile');
        } finally {
            setIsVerifying(false);
        }
    };

    if (!isOpen) return null;

    const availableTabs = [
        { id: 'personal', step: 1, label: 'Personal Info', shortLabel: 'Personal', icon: User, fields: groupedFields.personal },
        { id: 'contact', step: 2, label: 'Contact Details', shortLabel: 'Contact', icon: Phone, fields: groupedFields.contact },
        { id: 'address', step: 3, label: 'Address & Location', shortLabel: 'Address', icon: MapPin, fields: groupedFields.address }
    ].filter(tab => tab.fields && tab.fields.length > 0);

    // If activeTab is hidden, switch to the first available
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
        setActiveTab(availableTabs[0].id);
    }

    const currentStepIndex = availableTabs.findIndex(t => t.id === activeTab);
    const prevTab = currentStepIndex > 0 ? availableTabs[currentStepIndex - 1] : null;
    const nextTab = currentStepIndex < availableTabs.length - 1 ? availableTabs[currentStepIndex + 1] : null;

    const renderField = (field) => {
        if (!field) return null;
        const lowerKey = String(field.key || '').toLowerCase();
        const lowerLabel = String(field.label || '').toLowerCase();

        // Comprehensive check for read only
        const isReadOnly = isFieldReadOnly(field);

        const value = formData[field.key] || '';
        const isFullWidth = field.type === 'textarea' || lowerKey.includes('address') || lowerLabel.includes('address');

        return (
            <div className={`space-y-1 sm:space-y-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
                <div className="flex items-center justify-between">
                    <label className="text-[9px] sm:text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1 truncate">
                        <span>{field.label}</span>
                        {field.required && !isReadOnly && <span className="text-rose-500 font-bold">*</span>}
                    </label>
                    {isReadOnly && (
                        <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                            <Lock size={9} /> Locked
                        </span>
                    )}
                </div>

                {field.type === 'textarea' ? (
                    <textarea
                        name={field.key}
                        value={value}
                        onChange={handleChange}
                        disabled={!!pendingRequest || isReadOnly}
                        rows={2}
                        className={`w-full px-2.5 py-1.5 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all outline-none resize-none
                            ${isReadOnly
                                ? 'bg-slate-100/80 border border-slate-200 text-slate-400 cursor-not-allowed select-none'
                                : !!pendingRequest
                                    ? 'bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs'}`}
                    />
                ) : field.type === 'select' || field.type === 'radio' ? (
                    <select
                        name={field.key}
                        value={value}
                        onChange={handleChange}
                        disabled={!!pendingRequest || isReadOnly}
                        className={`w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all outline-none
                            ${isReadOnly
                                ? 'bg-slate-100/80 border border-slate-200 text-slate-400 cursor-not-allowed'
                                : !!pendingRequest
                                    ? 'bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs'}`}
                    >
                        <option value="">Select an option</option>
                        {(field.options || []).map((opt, i) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={field.type === 'date' ? 'date' : 'text'}
                        name={field.key}
                        value={value}
                        onChange={handleChange}
                        disabled={!!pendingRequest || isReadOnly}
                        className={`w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all outline-none
                            ${isReadOnly
                                ? 'bg-slate-100/80 border border-slate-200 text-slate-400 cursor-not-allowed'
                                : !!pendingRequest
                                    ? 'bg-slate-50 border border-slate-200 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs'}`}
                    />
                )}
            </div>
        );
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div
                className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92dvh] sm:max-h-[88vh] border border-slate-100 overflow-hidden my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Section */}
                <div className="px-3.5 sm:px-6 py-2.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0">
                            <User size={16} className="sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-xs sm:text-base font-black text-slate-900 leading-tight truncate">Edit Profile Details</h3>
                            <p className="text-[9px] sm:text-xs text-slate-500 font-medium truncate">Submitted edits require administrative approval.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0 ml-2"
                        aria-label="Close dialog"
                    >
                        <X size={16} className="sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Status Notice if request is pending */}
                {pendingRequest && (
                    <div className="px-3 sm:px-6 pt-2 pb-1 shrink-0">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 flex items-start gap-2 sm:gap-3 shadow-2xs">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                <Clock size={13} className="sm:w-4 sm:h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <h4 className="font-bold text-amber-950 text-[11px] sm:text-sm">Change Request Pending Approval</h4>
                                    <span className="px-1.5 py-0.5 text-[8px] sm:text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 rounded-full">
                                        Under Review
                                    </span>
                                </div>
                                <p className="text-[9px] sm:text-xs text-amber-800 font-medium mt-0.5 leading-relaxed">
                                    Your requested updates are under review for approval.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Steps 1, 2, 3 Navigation Bar - Only show numbers on mobile */}
                <div className="px-3 sm:px-6 py-2 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-50/80 shrink-0">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {availableTabs.map((tab, idx) => {
                            const isActive = activeTab === tab.id;
                            const stepNum = idx + 1;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`p-1 sm:px-3 sm:py-1.5 rounded-full sm:rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100/90 font-black'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                                    }`}
                                    title={`Step ${stepNum}: ${tab.label}`}
                                >
                                    <span className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                                            : 'bg-slate-200/90 text-slate-700'
                                    }`}>
                                        {stepNum}
                                    </span>
                                    <span className="hidden md:inline text-xs font-bold pr-1">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Active Step Indicator Name */}
                    <div className="text-[10px] sm:text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0 bg-white px-2.5 py-1 rounded-xl border border-slate-200/70 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                        <span className="text-indigo-700 font-black">Step {currentStepIndex + 1}:</span>
                        <span className="text-slate-800 truncate max-w-[120px] sm:max-w-none">
                            {availableTabs[currentStepIndex]?.label}
                        </span>
                    </div>
                </div>

                {/* Form Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 md:p-6 bg-white">
                    {loadingConfig ? (
                        <div className="animate-pulse space-y-3">
                            <div className="h-4 w-36 bg-slate-200 rounded"></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl"></div>)}
                            </div>
                        </div>
                    ) : (
                        <form id="profile-edit-form" onSubmit={handleSubmit}>
                            {availableTabs.map(tab => (
                                <div key={tab.id} className={activeTab === tab.id ? 'block animate-in fade-in duration-200' : 'hidden'}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
                                        {tab.fields.map((field, idx) => (
                                            <React.Fragment key={field.key || idx}>
                                                {renderField(field)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </form>
                    )}
                </div>

                {/* Modern Footer with Step Navigation */}
                <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                    <div className="text-[9px] sm:text-[11px] text-slate-500 font-medium text-center sm:text-left w-full sm:w-auto">
                        {hasChanges() ? (
                            <span className="text-indigo-600 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                                Changes detected. Ready to submit for approval.
                            </span>
                        ) : pendingRequest ? (
                            <span className="text-amber-800 font-bold flex items-center gap-1.5 justify-center sm:justify-start">
                                <Clock size={12} className="text-amber-600 shrink-0" />
                                Existing request pending review.
                            </span>
                        ) : (
                            <span>Edit fields across Steps 1-3 and click Submit.</span>
                        )}
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-2.5 sm:px-4 py-2 sm:py-2 text-[10px] sm:text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-200/70 sm:bg-transparent rounded-xl transition-colors cursor-pointer text-center"
                        >
                            Cancel
                        </button>

                        {/* Step Navigation Button (Next Step) */}
                        {nextTab && (
                            <button
                                type="button"
                                onClick={() => setActiveTab(nextTab.id)}
                                className="px-2.5 sm:px-3.5 py-2 sm:py-2 text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                            >
                                <span>Next: Step {currentStepIndex + 2}</span>
                                <ChevronRight size={13} />
                            </button>
                        )}

                        {!pendingRequest ? (
                            <button
                                type="submit"
                                form="profile-edit-form"
                                disabled={!hasChanges() || isSubmitting || loadingConfig}
                                className={`px-3 sm:px-5 py-2 sm:py-2 text-[10px] sm:text-xs font-black uppercase tracking-tight rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 text-center ${
                                    hasChanges() && !isSubmitting
                                        ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-indigo-200 cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                }`}
                            >
                                <Save size={13} className="shrink-0" />
                                <span className="whitespace-nowrap">{isSubmitting ? 'Sending...' : 'Submit Request'}</span>
                            </button>
                        ) : (
                            <div className="px-2.5 sm:px-4 py-2 sm:py-2 text-[10px] sm:text-xs font-bold rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center gap-1.5 border border-amber-200 text-center">
                                <Clock size={13} className="shrink-0 text-amber-600" />
                                <span className="whitespace-nowrap">Pending Approval</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default VerifyProfileDialog;
