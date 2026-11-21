import React, { useEffect, useState, useMemo } from 'react';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, AlertCircle, Calendar, Filter, MessageSquare, ArrowRight, Download, CreditCard, Printer, X, Plus, Search, Settings, ShieldCheck, RefreshCw, History, User, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../config/api';
import useAuthStore from '../store/authStore';

const ServiceRequests = () => {
    const { user } = useAuthStore();
    const isSuperAdmin = ['super_admin', 'superadmin', 'admin'].includes(String(user?.role || '').toLowerCase()) || Boolean(user?.isSuperAdmin);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Summary statistics for dashboard widgets
    const adminStats = useMemo(() => {
        const total = requests.length;
        const pendingPayment = requests.filter(r => r.payment_status === 'pending').length;
        const processing = requests.filter(r => r.status === 'processing').length;
        const ready = requests.filter(r => r.status === 'ready_to_collect').length;
        const closed = requests.filter(r => r.status === 'closed').length;
        return { total, pendingPayment, processing, ready, closed };
    }, [requests]);

    // Search & Filter
    const filteredRequests = useMemo(() => {
        let list = requests;
        if (filterStatus) {
            list = list.filter(r => r.status === filterStatus);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(r => {
                const name = (r.student_name || '').toLowerCase();
                const adm = (r.admission_number || '').toLowerCase();
                const pin = (r.pin_no || '').toLowerCase();
                const seq = (r.sequence_no || '').toLowerCase();
                const sName = (r.service_name || '').toLowerCase();
                return name.includes(q) || adm.includes(q) || pin.includes(q) || seq.includes(q) || sName.includes(q);
            });
        }
        return list;
    }, [requests, filterStatus, searchQuery]);

    // Service Requests Settings State (Super Admin Only)
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [feeHeadsList, setFeeHeadsList] = useState([]);
    const [selectedFeeHeadId, setSelectedFeeHeadId] = useState('');
    const [settingsNotes, setSettingsNotes] = useState('');
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // Action State
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionType, setActionType] = useState(null); // 'ready', 'close', 'edit_student', 'create_request'
    const [actionData, setActionData] = useState({ collect_date: '', admin_note: '' });
    const [previewUrl, setPreviewUrl] = useState(null);
    const [editingStudent, setEditingStudent] = useState(null);
    const [studentForm, setStudentForm] = useState({});

    // Create Request State
    const [services, setServices] = useState([]);
    const [createForm, setCreateForm] = useState({});
    const [searchingStudent, setSearchingStudent] = useState(false);
    const [syncingFees, setSyncingFees] = useState(false);
    const [syncingRowId, setSyncingRowId] = useState(null);

    // Lifecycle Audit History Modal State
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [historyRequest, setHistoryRequest] = useState(null);

    const getRequestTimeline = (req) => {
        if (!req) return [];
        let history = req.history;
        if (typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = []; }
        }
        if (!Array.isArray(history) || history.length === 0) {
            history = [{
                action: 'CREATED',
                title: 'Request Initiated',
                details: `Request created for ${req.service_name || 'Service'}. Initial fee status: ${req.payment_status || 'pending'}.`,
                performed_by: {
                    id: req.student_id,
                    name: req.student_name || 'Student',
                    role: 'student'
                },
                timestamp: req.created_at || req.request_date || new Date().toISOString()
            }];
            if (req.payment_status === 'paid') {
                history.push({
                    action: 'PAYMENT_VERIFIED',
                    title: 'Payment Completed',
                    details: 'Fee payment verified in Fee Management.',
                    performed_by: { name: 'Fee System', role: 'system' },
                    timestamp: req.request_date || new Date().toISOString()
                });
            }
            if (req.status === 'processing') {
                history.push({
                    action: 'STATUS_CHANGED',
                    title: 'In Processing',
                    details: 'Request is currently being processed by staff.',
                    performed_by: { name: 'Staff/Admin', role: 'admin' },
                    timestamp: req.request_date || new Date().toISOString()
                });
            } else if (req.status === 'ready_to_collect') {
                history.push({
                    action: 'READY_TO_COLLECT',
                    title: 'Ready for Collection',
                    details: `Scheduled collection date: ${req.collect_date ? new Date(req.collect_date).toLocaleDateString() : 'Ready'}. Note: ${req.admin_note || 'Available at office.'}`,
                    performed_by: { name: 'Staff/Admin', role: 'admin' },
                    timestamp: req.collect_date || req.request_date || new Date().toISOString()
                });
            } else if (req.status === 'closed') {
                history.push({
                    action: 'CLOSED',
                    title: 'Request Closed & Delivered',
                    details: 'Certificate issued and delivered to student.',
                    performed_by: { name: 'Staff/Admin', role: 'admin' },
                    timestamp: req.request_date || new Date().toISOString()
                });
            }
        }
        return history;
    };

    // Define Schemas for each Template Type
    // This defines EXACTLY what blanks are shown to the user based on the backend templates
    const TEMPLATE_SCHEMAS = {
        study_certificate: [
            {
                section: 'Student Details', fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter Admission No & Tab' },
                    { name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'Enter PIN & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true, placeholder: "Father's Name" }, // Used as S/o, D/o
                    { name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' },
                ]
            },
            {
                section: 'Academic Details', fields: [
                    { name: 'course', label: 'Program', type: 'text', placeholder: 'e.g. B.Tech' },
                    { name: 'branch', label: 'Branch', type: 'text', placeholder: 'e.g. CSE' },
                    { name: 'current_year', label: 'Year', type: 'number', className: 'w-1/2' },
                    { name: 'current_semester', label: 'Semester', type: 'number', className: 'w-1/2' },
                    { name: 'academic_year', label: 'Academic Year', type: 'text', placeholder: 'e.g. 2024-2025' } // Crucial for Study Cert
                ]
            },
            {
                section: 'Certificate Details', fields: [
                    { name: 'purpose', label: 'Purpose', type: 'text', required: true, placeholder: 'e.g. Scholarship Application' }
                ]
            }
        ],
        custodian_certificate: [
            {
                section: 'Student Details', fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter Admission No & Tab' },
                    { name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'Enter PIN & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true, placeholder: "Father's Name" }, // Used as S/o
                    { name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' },
                ]
            },
            {
                section: 'Academic Details', fields: [
                    { name: 'course', label: 'Course', type: 'text', required: true, placeholder: 'e.g. B.Tech' },
                    { name: 'branch', label: 'Branch', type: 'text', required: true, placeholder: 'e.g. CSE' }
                ]
            },
            {
                section: 'Certificate Details', fields: [
                    { name: 'custody_list', label: 'Certificates in Custody', type: 'textarea', required: true, placeholder: 'e.g. S.S.C, Intermediate, Transfer Certificate' },
                    { name: 'purpose', label: 'Purpose', type: 'text', required: true, placeholder: 'e.g. Verification' }
                ]
            }
        ],
        refund_application: [
            {
                section: 'Student Details', fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter Admission No & Tab' },
                    { name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'Enter PIN & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' },
                    // Father name not explicitly used in Refund App top block, but good for record.
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', placeholder: "Father's Name" },
                    { name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' },
                ]
            },
            {
                section: 'Academic Details', fields: [
                    { name: 'course', label: 'Program', type: 'text', placeholder: 'e.g. B.Tech' },
                    { name: 'branch', label: 'Branch', type: 'text', placeholder: 'e.g. CSE' },
                    { name: 'current_year', label: 'Year', type: 'number', className: 'w-1/2' },
                    { name: 'current_semester', label: 'Semester', type: 'number', className: 'w-1/2' },
                ]
            },
            {
                section: 'Refund Details', fields: [
                    { name: 'reason', label: 'Reason for Refund', type: 'text', required: true, placeholder: 'e.g. Discontinued course' },
                    { name: 'excess_amount', label: 'Excess Amount (Rs.)', type: 'text', required: true, placeholder: 'e.g. 5000' },
                    { name: 'amount_in_words', label: 'Amount in Words', type: 'text', required: true, placeholder: 'e.g. Five Thousand Only' }
                ]
            }
        ],
        // Default Fallback
        default: [
            {
                section: 'Request Details', fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter Admission No & Tab' },
                    { name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'Enter PIN & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', placeholder: "Father's Name" },
                    { name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' },
                    { name: 'purpose', label: 'Purpose/Note', type: 'text', placeholder: 'Purpose/Note' }
                ]
            }
        ]
    };

    // Helper to determine dynamic fields based on service type and template content
    const getTemplateFields = (serviceId) => {
        if (!serviceId) return [];
        const service = services.find(s => s.id == serviceId) || (selectedRequest?.service_id == serviceId ? selectedRequest : null);
        if (!service) return TEMPLATE_SCHEMAS.default;

        // 1. Check for admin_fields from DB if explicitly configured
        if (service.admin_fields && Array.isArray(service.admin_fields) && service.admin_fields.length > 0) {
            return [{
                section: 'Details',
                fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, disabled: true },
                    { name: 'pin_no', label: 'PIN / Roll Number', type: 'text' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
                    { name: 'college_name', label: 'College Name', type: 'text' },
                    ...service.admin_fields
                ]
            }];
        }

        // 2. Predefined static template types
        const name = (service.name || service.service_name || '').toLowerCase();
        const type = service.template_type || '';

        if (type === 'study_certificate' || name.includes('study')) return TEMPLATE_SCHEMAS.study_certificate;
        if (type === 'custodian_certificate' || name.includes('custodian')) return TEMPLATE_SCHEMAS.custodian_certificate;
        if (type === 'refund_application' || name.includes('refund')) return TEMPLATE_SCHEMAS.refund_application;

        // 3. Dynamic template handling: generate fields based on template content, variables, and blanks
        let config = service.template_config || {};
        if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) { config = {}; }
        }

        const content = ((config.top_content || '') + '\n' + (config.middle_content || '') + '\n' + (config.bottom_content || '')).trim();

        if (content) {
            // Find all variables matching @variable, {{variable}}, or @[label](variable)
            const detectedVars = new Set();
            const varRegex = /(?:@|{{)\s*([a-zA-Z0-9_]+)\s*(?:}})?/g;
            let m;
            while ((m = varRegex.exec(content)) !== null) {
                detectedVars.add(m[1].toLowerCase());
            }
            const bracketRegex = /@\[(.*?)\]\(([a-zA-Z0-9_]+)\)/g;
            while ((m = bracketRegex.exec(content)) !== null) {
                detectedVars.add(m[2].toLowerCase());
            }

            const ignoredVars = new Set(['principal_signature', 'current_date', 'date']);
            const sections = [];

            // Group 1: Student Details
            const studentFields = [
                { name: 'admission_number', label: 'Admission Number', type: 'text', placeholder: 'Enter Admission No & Tab' },
                { name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'Enter PIN & Tab' },
                { name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' }
            ];

            if (detectedVars.has('father_name') || detectedVars.has('father')) {
                studentFields.push({ name: 'father_name', label: "Father's Name", type: 'text', placeholder: "Father's Name" });
            }
            if (detectedVars.has('mother_name') || detectedVars.has('mother')) {
                studentFields.push({ name: 'mother_name', label: "Mother's Name", type: 'text', placeholder: "Mother's Name" });
            }
            if (detectedVars.has('guardian_name') || detectedVars.has('guardian')) {
                studentFields.push({ name: 'guardian_name', label: "Guardian's Name", type: 'text', placeholder: "Guardian's Name" });
            }
            if (detectedVars.has('college_name') || detectedVars.has('college')) {
                studentFields.push({ name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' });
            }
            if ((detectedVars.has('pin_no') || detectedVars.has('pin') || detectedVars.has('ht_no') || detectedVars.has('roll_number')) && !studentFields.some(f => f.name === 'pin_no')) {
                studentFields.push({ name: 'pin_no', label: 'PIN / Roll Number', type: 'text', placeholder: 'PIN / Roll Number' });
            }
            if (detectedVars.has('dob') || detectedVars.has('date_of_birth')) {
                studentFields.push({ name: 'dob', label: 'Date of Birth', type: 'date' });
            }
            if (detectedVars.has('gender') || detectedVars.has('sex')) {
                studentFields.push({ name: 'gender', label: 'Gender', type: 'select', options: [{ label: 'Male', value: 'M' }, { label: 'Female', value: 'F' }, { label: 'Other', value: 'Other' }] });
            }
            if (detectedVars.has('caste') || detectedVars.has('category')) {
                studentFields.push({ name: 'caste', label: 'Caste', type: 'text', placeholder: 'Caste' });
            }
            if (detectedVars.has('student_mobile') || detectedVars.has('mobile') || detectedVars.has('phone_number')) {
                studentFields.push({ name: 'student_mobile', label: 'Mobile Number', type: 'text', placeholder: 'Mobile Number' });
            }
            if (detectedVars.has('student_address') || detectedVars.has('address')) {
                studentFields.push({ name: 'student_address', label: 'Address', type: 'textarea', placeholder: 'Address' });
            }
            if (detectedVars.has('college_name')) {
                studentFields.push({ name: 'college_name', label: 'College Name', type: 'text', placeholder: 'College Name' });
            }

            sections.push({
                section: 'Student Details',
                fields: studentFields
            });

            // Group 2: Academic Details
            const academicFields = [];
            if (detectedVars.has('course') || detectedVars.has('program') || detectedVars.has('degree')) {
                academicFields.push({ name: 'course', label: 'Course / Program', type: 'text', placeholder: 'e.g. B.Tech, MBA' });
            }
            if (detectedVars.has('branch') || detectedVars.has('department')) {
                academicFields.push({ name: 'branch', label: 'Branch / Department', type: 'text', placeholder: 'e.g. CSE, EEE' });
            }
            if (detectedVars.has('current_year') || detectedVars.has('year')) {
                academicFields.push({ name: 'current_year', label: 'Year', type: 'text', placeholder: 'e.g. 1, 2, 3, 4' });
            }
            if (detectedVars.has('current_semester') || detectedVars.has('semester') || detectedVars.has('sem')) {
                academicFields.push({ name: 'current_semester', label: 'Semester', type: 'text', placeholder: 'e.g. 1, 2' });
            }
            if (detectedVars.has('academic_year')) {
                academicFields.push({ name: 'academic_year', label: 'Academic Year', type: 'text', placeholder: 'e.g. 2024-2025' });
            }

            if (academicFields.length > 0) {
                sections.push({
                    section: 'Academic Details',
                    fields: academicFields
                });
            }

            // Group 3: Certificate Reference & Sequence
            const refFields = [];
            if (detectedVars.has('sequence_no')) {
                refFields.push({ name: 'sequence_no', label: 'Sequence No', type: 'text', placeholder: 'e.g. SR-2026-0001' });
            }
            if (detectedVars.has('sequence')) {
                refFields.push({ name: 'sequence', label: 'Sequence Number', type: 'text', placeholder: 'e.g. 0001' });
            }
            if (detectedVars.has('serial_no')) {
                refFields.push({ name: 'serial_no', label: 'Serial No', type: 'text', placeholder: 'e.g. SR-2026-0001' });
            }
            if (detectedVars.has('ref_no')) {
                refFields.push({ name: 'ref_no', label: 'Reference No', type: 'text', placeholder: 'e.g. SR-2026-0001' });
            }
            if (detectedVars.has('certificate_no')) {
                refFields.push({ name: 'certificate_no', label: 'Certificate No', type: 'text', placeholder: 'e.g. SR-2026-0001' });
            }
            if (refFields.length > 0) {
                sections.push({
                    section: 'Certificate Reference & Sequence',
                    fields: refFields
                });
            }

            // Group 4: Custom Variables (any other @variable in template)
            const knownVars = new Set([
                'admission_number', 'student_name', 'name', 'father_name', 'father',
                'mother_name', 'mother', 'guardian_name', 'guardian', 'pin_no', 'pin',
                'ht_no', 'roll_number', 'dob', 'date_of_birth', 'gender', 'sex', 'caste',
                'category', 'student_mobile', 'mobile', 'phone_number', 'student_address',
                'address', 'college_name', 'course', 'program', 'degree', 'branch',
                'department', 'current_year', 'year', 'current_semester', 'semester', 'sem',
                'academic_year', 'principal_signature', 'current_date', 'date', 'purpose',
                'sequence_no', 'sequence', 'serial_no', 'ref_no', 'certificate_no'
            ]);

            const customFields = [];
            detectedVars.forEach(v => {
                if (!knownVars.has(v) && !ignoredVars.has(v)) {
                    const label = v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    customFields.push({
                        name: v,
                        label: label,
                        type: 'text',
                        placeholder: `Enter ${label}`
                    });
                }
            });

            if (customFields.length > 0) {
                sections.push({
                    section: 'Custom Variables',
                    fields: customFields
                });
            }

            // Group 4: Input Fields Entry (fillable blanks in template: ___, ....., …………, etc.)
            const blankRegex = /(?:___(?:\[\d+\])?(?:\s*___)*)+|_{2,}|[.\u2026]{2,}|[—–―-]{2,}/g;
            const blankMatches = content.match(blankRegex) || [];
            const blankVarCount = Array.isArray(config.blank_variables) ? config.blank_variables.length : 0;
            const totalBlanks = Math.max(blankMatches.length, blankVarCount);

            if (totalBlanks > 0) {
                const blankFields = [];
                for (let i = 1; i <= totalBlanks; i++) {
                    const customName = config.blank_variables && config.blank_variables[i - 1]
                        ? (typeof config.blank_variables[i - 1] === 'string' ? config.blank_variables[i - 1] : config.blank_variables[i - 1].label || config.blank_variables[i - 1].name)
                        : null;

                    let inferredLabel = customName;
                    if (!inferredLabel) {
                        const matchStr = blankMatches[i - 1];
                        if (matchStr) {
                            const matchIndex = content.indexOf(matchStr);
                            const beforeSnippet = content.substring(Math.max(0, matchIndex - 120), matchIndex).replace(/\[\/?.*?\]/g, '').trim();
                            if (/conduct/i.test(beforeSnippet)) {
                                inferredLabel = 'Conduct';
                            } else if (/reason/i.test(beforeSnippet)) {
                                inferredLabel = 'Reason';
                            } else if (/purpose/i.test(beforeSnippet)) {
                                inferredLabel = 'Purpose';
                            } else if (/remark/i.test(beforeSnippet)) {
                                inferredLabel = 'Remarks';
                            } else if (/amount/i.test(beforeSnippet)) {
                                inferredLabel = 'Amount';
                            } else {
                                inferredLabel = `Input Field ${i}`;
                            }
                        } else {
                            inferredLabel = `Input Field ${i}`;
                        }
                    }

                    blankFields.push({
                        name: `field_${i}`,
                        label: inferredLabel,
                        type: 'text',
                        placeholder: `Enter ${inferredLabel}`,
                        fullWidth: true
                    });
                }
                sections.push({
                    section: 'Input Fields Entry',
                    fields: blankFields
                });
            }

            // Group 5: Purpose / Note if referenced
            if (detectedVars.has('purpose') || /purpose/i.test(content)) {
                sections.push({
                    section: 'Additional Details',
                    fields: [
                        { name: 'purpose', label: 'Purpose', type: 'text', placeholder: 'e.g. Higher Studies, Verification' }
                    ]
                });
            }

            return sections;
        }

        return TEMPLATE_SCHEMAS.default;
    };

    // Auto-fill helper (supports admission number or PIN number)
    const handleStudentLookup = async (identifier) => {
        const query = (identifier || createForm.admission_number || createForm.pin_no || '').trim();
        if (!query) return;
        try {
            setSearchingStudent(true);
            let s = null;
            try {
                const fastRes = await api.get(`/services/student-lookup/${encodeURIComponent(query)}`);
                if (fastRes.data && fastRes.data.data) {
                    s = fastRes.data.data;
                }
            } catch (fastErr) {
                // Fallback to standard endpoint if needed
                const fallbackRes = await api.get(`/students/${encodeURIComponent(query)}`);
                if (fallbackRes.data && fallbackRes.data.data) {
                    s = fallbackRes.data.data;
                }
            }

            if (s) {
                const toUpper = (val) => (typeof val === 'string' ? val.toUpperCase() : (val ?? ''));
                setCreateForm(prev => {
                    const next = { ...prev };
                    // Populate all properties from student object
                    Object.keys(s).forEach(k => {
                        const val = s[k];
                        if (val !== undefined && val !== null && val !== '') {
                            if (k === 'dob' || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/))) {
                                next[k] = val.includes('T') ? val.split('T')[0] : val;
                            } else if (typeof val === 'string') {
                                next[k] = val.toUpperCase();
                            } else {
                                next[k] = val;
                            }
                        }
                    });

                    // Ensure all standard aliases are explicitly set
                    const admissionNum = toUpper(s.admission_number || prev.admission_number || query);
                    const pinNum = toUpper(s.pin_no || prev.pin_no || (query !== s.admission_number ? query : ''));
                    const studentName = toUpper(s.student_name || prev.student_name || '');
                    const collegeName = toUpper(s.college_name || s.college || prev.college_name || '');
                    const fatherName = toUpper(s.father_name || prev.father_name || '');
                    const motherName = toUpper(s.mother_name || prev.mother_name || '');
                    const guardianName = toUpper(s.guardian_name || prev.guardian_name || '');
                    const courseName = toUpper(s.course || s.program || s.degree || prev.course || '');
                    const branchName = toUpper(s.branch || s.department || prev.branch || '');
                    const yearVal = s.current_year ?? s.year ?? prev.current_year ?? '';
                    const semVal = s.current_semester ?? s.semester ?? prev.current_semester ?? '';
                    const acadYear = toUpper(s.academic_year || (s.batch ? `${s.batch}-${parseInt(s.batch)+1}` : '') || prev.academic_year || '');
                    const mobileVal = s.student_mobile || s.mobile || s.parent_mobile1 || prev.student_mobile || '';
                    const addrVal = toUpper(s.student_address || s.address || prev.student_address || '');

                    next.admission_number = admissionNum;
                    next.admission_no = admissionNum;
                    next.pin_no = pinNum;
                    next.pin = pinNum;
                    next.roll_number = pinNum;
                    next.ht_no = pinNum;
                    next.student_name = studentName;
                    next.name = studentName;
                    next.college_name = collegeName;
                    next.college = collegeName;
                    next.father_name = fatherName;
                    next.father = fatherName;
                    next.mother_name = motherName;
                    next.guardian_name = guardianName;
                    next.course = courseName;
                    next.program = courseName;
                    next.degree = courseName;
                    next.branch = branchName;
                    next.department = branchName;
                    next.current_year = yearVal;
                    next.year = yearVal;
                    next.current_semester = semVal;
                    next.semester = semVal;
                    next.sem = semVal;
                    next.academic_year = acadYear;
                    next.gender = s.gender || prev.gender || '';
                    next.caste = toUpper(s.caste || prev.caste || '');
                    next.student_mobile = mobileVal;
                    next.mobile = mobileVal;
                    next.phone_number = mobileVal;
                    next.student_address = addrVal;
                    next.address = addrVal;

                    return next;
                });
                toast.success(`Found: ${s.student_name || query}`);
            } else {
                toast.error('Student not found with this identifier');
            }
        } catch (e) {
            console.warn('Student lookup failed:', e);
        } finally {
            setSearchingStudent(false);
        }
    };

    const handleAdmissionBlur = () => handleStudentLookup(createForm.admission_number || createForm.pin_no);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getRequests({ status: filterStatus });
            setRequests(response.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const res = await serviceService.getAllServices();
            setServices(res.data || []);
        } catch (error) {
            console.error(error);
        }
    }

    useEffect(() => {
        fetchRequests();
        fetchServices();
    }, [filterStatus]);

    const handleDirectStatusUpdate = async (req, newStatus) => {
        try {
            await serviceService.updateRequestStatus(req.id, {
                status: newStatus
            });
            const labels = {
                processing: 'Processing',
                ready_to_collect: 'Ready to Collect',
                closed: 'Closed'
            };
            toast.success(`Request marked as ${labels[newStatus] || newStatus}`);
            fetchRequests();
        } catch (error) {
            console.error('Status update failed:', error);
            toast.error(error.response?.data?.message || 'Failed to update request status');
        }
    };

    const handleUpdateStatus = async () => {
        if (!selectedRequest?.id) {
            toast.error('No request selected');
            return;
        }

        try {
            if (actionType === 'ready') {
                const collectDate = actionData.collect_date || new Date().toISOString().split('T')[0];
                const adminNote = (actionData.admin_note || '').trim() || `Your ${selectedRequest.service_name || 'certificate'} is ready for collection.`;

                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'ready_to_collect',
                    collect_date: collectDate,
                    admin_note: adminNote,
                    ...actionData
                });
                toast.success('Request marked as Ready to Collect');
            } else if (actionType === 'close') {
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'closed'
                });
                toast.success('Request Closed');
            } else if (actionType === 'processing') {
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'processing'
                });
                toast.success('Request marked as Processing');
            }

            setSelectedRequest(null);
            setActionType(null);
            setActionData({ collect_date: '', admin_note: '' });
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Update failed');
        }
    };

    const openActionModal = (req, type) => {
        setSelectedRequest(req);
        setActionType(type);
        // Pre-fill text for convenience
        if (type === 'ready') {
            setActionData({
                collect_date: new Date().toISOString().split('T')[0],
                admin_note: `Your ${req.service_name} is ready. Please collect it from the admin office.`
            });
        }
    };

    // New Flow: 1. Click Print -> 2. Fetch Student -> 3. Show Edit Modal -> 4. Update Service Request Data -> 5. Generate
    const handleVerifyAndPrint = async (request) => {
        const price = Number(request.service_price || 0);
        if (price > 0 && request.payment_status !== 'paid') {
            toast.error('Cannot issue certificate: Payment is pending in Fee Portal. Please verify or sync payment first.');
            return;
        }

        try {
            const toastId = toast.loading('Fetching details...');
            // Parse any custom data previously saved on this service request
            let reqData = {};
            if (typeof request.request_data === 'string') {
                try {
                    reqData = JSON.parse(request.request_data);
                } catch (e) {
                    reqData = {};
                }
            } else if (typeof request.request_data === 'object' && request.request_data !== null) {
                reqData = request.request_data;
            }

            // Fetch student based on admission number, pin_no, or student_id
            const identifier = (request.admission_number || request.pin_no || reqData.admission_number || reqData.pin_no || request.student_id || '').trim();
            let student = null;
            try {
                const fastRes = await api.get(`/services/student-lookup/${encodeURIComponent(identifier)}`);
                if (fastRes.data && fastRes.data.data) {
                    student = fastRes.data.data;
                }
            } catch (fastErr) {
                const response = await api.get(`/students/${encodeURIComponent(identifier)}`);
                if (response.data && response.data.data) {
                    student = response.data.data;
                }
            }

            toast.dismiss(toastId);

            if (student) {
                setEditingStudent(student);

                // Initialize form: prefer request_data (service-specific values), fallback to student record
                const reqSeq = request.sequence_no || `SR-${new Date(request.created_at || request.request_date || Date.now()).getFullYear()}-${String(request.id).padStart(4, '0')}`;
                const seqDigits = reqSeq.includes('-') ? reqSeq.split('-').pop() : String(request.id).padStart(4, '0');

                const toUpper = (val) => (typeof val === 'string' ? val.toUpperCase() : (val ?? ''));

                const initialForm = {
                    admission_number: toUpper(student.admission_number || request.admission_number || reqData.admission_number || ''),
                    student_name: toUpper(reqData.student_name ?? reqData.name ?? student.student_name ?? ''),
                    name: toUpper(reqData.name ?? reqData.student_name ?? student.student_name ?? ''),
                    father_name: toUpper(reqData.father_name ?? student.father_name ?? ''),
                    mother_name: toUpper(reqData.mother_name ?? student.mother_name ?? ''),
                    guardian_name: toUpper(reqData.guardian_name ?? student.guardian_name ?? ''),
                    pin_no: toUpper(reqData.pin_no ?? student.pin_no ?? student.admission_number ?? ''),
                    college_name: toUpper(reqData.college_name ?? student.college_name ?? student.college ?? ''),
                    college: toUpper(reqData.college ?? reqData.college_name ?? student.college_name ?? student.college ?? ''),
                    course: toUpper(reqData.course ?? student.course ?? ''),
                    branch: toUpper(reqData.branch ?? student.branch ?? ''),
                    current_year: reqData.current_year ?? student.current_year ?? '',
                    current_semester: reqData.current_semester ?? student.current_semester ?? '',
                    academic_year: toUpper(reqData.academic_year ?? student.academic_year ?? ''),
                    dob: reqData.dob ?? (student.dob ? new Date(student.dob).toISOString().split('T')[0] : ''),
                    gender: reqData.gender ?? student.gender ?? '',
                    caste: toUpper(reqData.caste ?? student.caste ?? ''),
                    student_mobile: reqData.student_mobile ?? student.student_mobile ?? '',
                    student_address: toUpper(reqData.student_address ?? student.student_address ?? ''),
                    purpose: toUpper(reqData.purpose ?? request.purpose ?? ''),
                    sequence_no: reqData.sequence_no ?? reqSeq,
                    sequence: reqData.sequence ?? seqDigits,
                    serial_no: reqData.serial_no ?? reqSeq,
                    ref_no: reqData.ref_no ?? reqSeq,
                    certificate_no: reqData.certificate_no ?? reqSeq,
                };

                // Uppercase all other custom fields from reqData (except dates)
                Object.keys(reqData).forEach(k => {
                    if (k === 'dob' || k.includes('date')) {
                        initialForm[k] = reqData[k];
                    } else if (typeof reqData[k] === 'string') {
                        initialForm[k] = reqData[k].toUpperCase();
                    } else if (initialForm[k] === undefined) {
                        initialForm[k] = reqData[k];
                    }
                });

                setStudentForm(initialForm);
                setSelectedRequest(request);
                setActionType('edit_student'); // Open the edit modal
            } else {
                toast.error('Student details not found');
            }
        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error('Failed to fetch student details. They may have been deleted.');
        }
    };

    const handleUpdateStudentAndPrint = async () => {
        try {
            if (!selectedRequest?.id) {
                toast.error('No service request selected');
                return;
            }

            const toastId = toast.loading('Saving request details...');

            // Convert all text fields to UPPERCASE before saving
            const upperForm = {};
            Object.keys(studentForm).forEach(k => {
                const val = studentForm[k];
                if (k === 'dob' || (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/))) {
                    upperForm[k] = val;
                } else if (typeof val === 'string') {
                    upperForm[k] = val.trim().toUpperCase();
                } else {
                    upperForm[k] = val;
                }
            });

            // Save details ONLY to this service request's request_data (does NOT mutate student master table)
            await serviceService.updateRequestData(selectedRequest.id, {
                request_data: upperForm
            });

            toast.dismiss(toastId);
            toast.success('Request details updated');

            // Close edit modal
            setEditingStudent(null);
            setActionType(null);

            const updatedRequest = {
                ...selectedRequest,
                request_data: upperForm
            };
            setSelectedRequest(updatedRequest);
            fetchRequests();

            // Proceed to print / preview
            await generatePreview(updatedRequest);

        } catch (error) {
            console.error(error);
            toast.dismiss();
            toast.error('Update failed');
        }
    };

    const generatePreview = async (request) => {
        try {
            const toastId = toast.loading('Generating preview...');
            const response = await api.get(`/services/requests/${request.id}/download`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url); // Set preview URL to open modal

            toast.dismiss(toastId);
        } catch (error) {
            console.error(error);
            toast.error('Preview failed. Check if payment is cleared.');
        }
    };

    // Helper to just print if user skips editing
    const handleDirectPrint = (request) => {
        setActionType(null);
        setEditingStudent(null);
        generatePreview(request);
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        const adm = (createForm.admission_number || createForm.pin_no || '').trim();
        // Validation: Service ID, Admission / PIN No, and Student Name are bare minimum
        if (!createForm.service_id || !adm || !createForm.student_name) {
            toast.error('Service, Admission / PIN Number and Student Name are required');
            return;
        }

        // Convert all text values to UPPERCASE
        const upperCreateForm = {};
        Object.keys(createForm).forEach(k => {
            const v = createForm[k];
            if (k === 'dob' || (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}$/))) {
                upperCreateForm[k] = v;
            } else if (typeof v === 'string') {
                upperCreateForm[k] = v.trim().toUpperCase();
            } else {
                upperCreateForm[k] = v;
            }
        });

        if (!upperCreateForm.admission_number && upperCreateForm.pin_no) {
            upperCreateForm.admission_number = upperCreateForm.pin_no;
        }

        try {
            const res = await serviceService.createRequestByAdmin({
                ...upperCreateForm
            });

            const isPaid = res.payment_status === 'paid';
            if (isPaid) {
                toast.success('Service Request Created & Marked Paid');
            } else {
                toast.success('Service Request Created (Unpaid due registered in Fee Portal)');
            }

            setCreateForm({});
            setActionType(null);
            fetchRequests();

            if (isPaid) {
                // Immediately trigger verify & print for free/paid requests
                const mockRequest = {
                    id: res.requestId,
                    admission_number: res.student?.admission_number || upperCreateForm.admission_number,
                    pin_no: res.student?.pin_no || upperCreateForm.pin_no,
                    student_name: res.student_name || upperCreateForm.student_name,
                    service_id: upperCreateForm.service_id,
                    service_name: res.service_name || 'Service',
                    service_price: res.service_price || 0,
                    status: 'pending',
                    payment_status: 'paid',
                    request_data: upperCreateForm
                };

                setTimeout(() => handleVerifyAndPrint(mockRequest), 500);
            } else {
                toast('Payment is pending in the Fee Portal. Once paid, click "Sync Fee Status" to issue the certificate.', { icon: 'ℹ️', duration: 6000 });
            }

        } catch (error) {
            console.error(error);
            toast.error('Failed to create request');
        }
    };

    // --- Fee Status Sync Handlers ---
    const handleSyncAllFeeStatus = async () => {
        try {
            setSyncingFees(true);
            const res = await serviceService.syncFeeStatus();
            if (res.success) {
                if (res.syncedCount > 0) {
                    toast.success(res.message);
                } else {
                    toast(res.message, { icon: 'ℹ️' });
                }
                fetchRequests();
            } else {
                toast.error(res.message || 'Failed to sync fee status');
            }
        } catch (err) {
            console.error('Error syncing fee status:', err);
            toast.error('Failed to sync fee status from Fee Portal');
        } finally {
            setSyncingFees(false);
        }
    };

    const handleSyncSingleFeeStatus = async (requestId) => {
        try {
            setSyncingRowId(requestId);
            const res = await serviceService.syncFeeStatus(requestId);
            if (res.success) {
                if (res.syncedCount > 0) {
                    toast.success(res.message);
                } else {
                    toast(res.message, { icon: 'ℹ️' });
                }
                fetchRequests();
            } else {
                toast.error(res.message || 'Failed to sync fee status');
            }
        } catch (err) {
            console.error('Error syncing fee status for request:', err);
            toast.error('Failed to sync fee status');
        } finally {
            setSyncingRowId(null);
        }
    };

    // --- Super Admin Settings Handlers ---
    const fetchServiceSettings = async () => {
        if (!isSuperAdmin) return;
        try {
            setLoadingSettings(true);
            const res = await serviceService.getServiceSettings();
            if (res.success) {
                setFeeHeadsList(res.availableFeeHeads || []);
                setSelectedFeeHeadId(res.settings?.feeHeadId || (res.currentFeeHead ? String(res.currentFeeHead._id) : ''));
                setSettingsNotes(res.settings?.description || '');
                setAutoSyncEnabled(res.settings?.autoSync !== false);
            }
        } catch (err) {
            console.error('Failed to fetch service settings:', err);
            toast.error('Failed to load settings from fee portal');
        } finally {
            setLoadingSettings(false);
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        if (!isSuperAdmin) {
            toast.error('Only Super Admins can update service settings');
            return;
        }
        if (!selectedFeeHeadId) {
            toast.error('Please select a fee head from the fee portal');
            return;
        }

        const chosenHead = feeHeadsList.find(h => String(h._id) === String(selectedFeeHeadId));

        try {
            setSavingSettings(true);
            const res = await serviceService.updateServiceSettings({
                feeHeadId: selectedFeeHeadId,
                feeHeadCode: chosenHead?.code || '',
                feeHeadName: chosenHead?.name || '',
                description: settingsNotes
            });

            if (res.success) {
                toast.success('Service Request Fee Head settings saved successfully');
                setSettingsModalOpen(false);
            } else {
                toast.error(res.message || 'Failed to save settings');
            }
        } catch (err) {
            console.error('Failed to save service settings:', err);
            toast.error(err.response?.data?.message || 'Failed to save service settings');
        } finally {
            setSavingSettings(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-[var(--warning-light)] text-warning',
            processing: 'bg-[var(--primary-light)] text-primary',
            ready_to_collect: 'bg-[var(--primary-light)] text-secondary',
            closed: 'bg-[var(--success-light)] text-success',
            rejected: 'bg-[var(--danger-light)] text-danger'
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${styles[status] || 'bg-background'}`}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-in relative pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight">Service Requests</h1>
                    <p className="text-xs sm:text-sm text-muted-text mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                        <span>Track, verify payments, process, and issue student certificates</span>
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <button
                        onClick={handleSyncAllFeeStatus}
                        disabled={syncingFees}
                        className="px-3.5 py-2 bg-surface text-main border border-border rounded-xl hover:bg-background flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm transition-all"
                        title="Sync pending service requests with Fee Portal payments"
                    >
                        <RefreshCw size={15} className={`text-primary ${syncingFees ? 'animate-spin' : ''}`} />
                        {syncingFees ? 'Syncing...' : 'Sync Fee Status'}
                    </button>

                    {isSuperAdmin && (
                        <button
                            onClick={() => {
                                fetchServiceSettings();
                                setSettingsModalOpen(true);
                            }}
                            className="px-3.5 py-2 bg-surface text-main border border-border rounded-xl hover:bg-background flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm transition-all"
                            title="Configure Fee Head for Service Requests (Super Admin Only)"
                        >
                            <Settings size={15} className="text-primary" /> Fee Settings
                        </button>
                    )}

                    <button
                        onClick={() => setActionType('create_request')}
                        className="px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-98"
                    >
                        <Plus size={16} /> Issue Service
                    </button>
                </div>
            </div>

            {/* Dashboard Overview Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Total Requests</p>
                    <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-main font-mono">{adminStats.total}</h3>
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                            <FileText size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Pending Fee</p>
                    <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-danger font-mono">{adminStats.pendingPayment}</h3>
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-danger flex items-center justify-center font-bold">
                            <CreditCard size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-xs font-medium text-muted-text uppercase tracking-wider">In Processing</p>
                    <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-primary font-mono">{adminStats.processing}</h3>
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-primary flex items-center justify-center font-bold">
                            <Clock size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Ready to Collect</p>
                    <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-purple-600 font-mono">{adminStats.ready}</h3>
                        <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                            <Calendar size={18} />
                        </div>
                    </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all col-span-2 sm:col-span-1">
                    <p className="text-xs font-medium text-muted-text uppercase tracking-wider">Completed / Closed</p>
                    <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl sm:text-2xl font-bold text-success font-mono">{adminStats.closed}</h3>
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="bg-surface border border-border rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-96">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student, admission, roll no, sequence..."
                        className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm text-main placeholder-muted-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-main">
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-xl border border-border">
                        <Filter size={15} className="text-muted-text" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent border-none text-xs sm:text-sm font-semibold focus:ring-0 text-main py-0 cursor-pointer outline-none"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="ready_to_collect">Ready to Collect</option>
                            <option value="closed">Closed / Delivered</option>
                        </select>
                    </div>

                    <div className="text-xs text-muted-text font-medium whitespace-nowrap">
                        Showing {filteredRequests.length} request(s)
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-background/70 text-muted-text text-xs font-semibold uppercase tracking-wider border-b border-border">
                            <tr>
                                <th className="px-5 py-3.5">Request Info</th>
                                <th className="px-5 py-3.5">Student</th>
                                <th className="px-5 py-3.5">Mobile</th>
                                <th className="px-5 py-3.5">Status</th>
                                <th className="px-5 py-3.5">Payment</th>
                                <th className="px-5 py-3.5">Dates</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 text-sm">
                            {loading ? (
                                <tr><td colSpan="7" className="p-12 text-center text-muted-text">Loading requests...</td></tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-16 text-center text-muted-text">
                                        <FileText size={36} className="mx-auto text-muted-text/50 mb-3" />
                                        <h3 className="font-bold text-main text-base mb-1">No service requests found</h3>
                                        <p className="text-xs text-muted-text">Try adjusting your status filter or search query.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-background/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-semibold text-main">{req.service_name}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                                                        {req.sequence_no || `SR-${new Date(req.created_at || req.request_date || Date.now()).getFullYear()}-${String(req.id).padStart(4, '0')}`}
                                                    </span>
                                                    <span className="text-[11px] text-muted-text">ID: #{req.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-main">{req.student_name}</span>
                                                <span className="text-xs text-muted-text">{req.pin_no ? `${req.pin_no} (${req.admission_number})` : req.admission_number} | {req.course}-{req.branch}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-xs text-muted-text font-mono">
                                            {req.student_mobile || '-'}
                                        </td>
                                        <td className="px-5 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${req.payment_status === 'paid' ? 'bg-[var(--success-light)] text-success border border-success/20' : 'bg-[var(--danger-light)] text-danger border border-danger/20'}`}>
                                                {req.payment_status || 'pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-text">
                                            <div>Req: {new Date(req.request_date).toLocaleDateString()}</div>
                                            {req.collect_date && (
                                                <div className="text-secondary font-medium">Col: {new Date(req.collect_date).toLocaleDateString()}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        setHistoryRequest(req);
                                                        setHistoryModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1.5 bg-surface text-sub border border-border text-xs font-semibold rounded hover:bg-background flex items-center gap-1 transition-all"
                                                    title="View lifecycle history & audit log"
                                                >
                                                    <History size={12} />
                                                    History
                                                </button>
                                                {req.payment_status !== 'paid' ? (
                                                    <button
                                                        onClick={() => handleSyncSingleFeeStatus(req.id)}
                                                        disabled={syncingRowId === req.id}
                                                        className="px-3 py-1.5 bg-surface text-primary border border-border text-xs font-semibold rounded hover:bg-background flex items-center gap-1 transition-all"
                                                        title="Check & sync payment status from Fee Portal"
                                                    >
                                                        <RefreshCw size={12} className={syncingRowId === req.id ? 'animate-spin' : ''} />
                                                        Sync
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleVerifyAndPrint(req)}
                                                            className="px-3 py-1.5 bg-background text-sub text-xs font-semibold rounded hover:bg-background flex items-center gap-1"
                                                            title="Verify details & Print"
                                                        >
                                                            <Printer size={12} /> Verify & Print
                                                        </button>
                                                        {req.status === 'pending' && (
                                                            <button
                                                                onClick={() => handleDirectStatusUpdate(req, 'processing')}
                                                                className="px-3 py-1.5 bg-[var(--primary-light)] text-primary text-xs font-semibold rounded hover:bg-[var(--primary-light)] flex items-center gap-1"
                                                                title="Mark request as Processing"
                                                            >
                                                                Process
                                                            </button>
                                                        )}
                                                        {(req.status === 'pending' || req.status === 'processing') && (
                                                            <button
                                                                onClick={() => openActionModal(req, 'ready')}
                                                                className="px-3 py-1.5 bg-[var(--primary-light)] text-secondary text-xs font-semibold rounded hover:bg-[var(--primary-light)] flex items-center gap-1"
                                                                title="Mark certificate as Ready to Collect"
                                                            >
                                                                Mark Ready
                                                            </button>
                                                        )}
                                                        {(req.status === 'ready_to_collect' || req.status === 'processing') && (
                                                            <button
                                                                onClick={() => { setSelectedRequest(req); setActionType('close'); }}
                                                                className="px-3 py-1.5 bg-[var(--success-light)] text-success text-xs font-semibold rounded hover:bg-[var(--success-light)] flex items-center gap-1"
                                                                title="Mark request as Closed / Completed"
                                                            >
                                                                Close
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Request Modal - Dynamic Form */}
            {actionType === 'create_request' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-4xl p-6 shadow-xl animate-scale-in max-h-[95vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-main">Issue New Service</h2>
                            <button onClick={() => { setActionType(null); }} className="text-muted-text hover:text-sub">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRequest} className="space-y-6">

                            {/* 1. Service Selection */}
                            <div className="bg-background p-4 rounded-lg border border-border">
                                <label className="block text-sm font-bold text-main mb-2">Select Certificate / Service <span className="text-danger">*</span></label>
                                <select
                                    required
                                    className="w-full px-4 py-3 border border-border-strong rounded-lg focus:ring-2 focus:ring-primary outline-none bg-surface text-lg"
                                    value={createForm.service_id || ''}
                                    onChange={e => setCreateForm(prev => ({ ...prev, service_id: e.target.value }))}
                                >
                                    <option value="">-- Choose Template --</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (₹{s.price})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dynamic Fields Section */}
                            {createForm.service_id && (
                                <div className="animate-fade-in space-y-6">

                                    {getTemplateFields(createForm.service_id).map((section, secIdx) => (
                                        <div key={secIdx} className="bg-surface p-5 rounded-lg border border-border shadow-sm">
                                            <h3 className="text-md font-bold text-main mb-4 flex items-center gap-2">
                                                <span className="bg-[var(--primary-light)] text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs">{secIdx + 1}</span>
                                                {section.section}
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {section.fields.map((field, fIdx) => (
                                                    <div
                                                        key={fIdx}
                                                        className={`${field.type === 'textarea' || field.name === 'custody_list' ? 'md:col-span-2 lg:col-span-3' : ''} ${field.className || ''}`}
                                                    >
                                                        <label className="block text-sm font-medium text-sub mb-1">
                                                            {field.label} {field.required && <span className="text-danger">*</span>}
                                                        </label>

                                                        {field.type === 'textarea' ? (
                                                            <textarea
                                                                required={field.required}
                                                                rows="3"
                                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none uppercase"
                                                                style={{ textTransform: 'uppercase' }}
                                                                placeholder={field.placeholder || ''}
                                                                value={createForm[field.name] || ''}
                                                                onChange={e => setCreateForm({ ...createForm, [field.name]: e.target.value.toUpperCase() })}
                                                            />
                                                        ) : (field.name === 'admission_number' || field.name === 'pin_no') ? (
                                                            <div className="relative flex items-center">
                                                                <input
                                                                    type={field.type || 'text'}
                                                                    required={field.required}
                                                                    autoFocus={field.autoFocus}
                                                                    className="w-full px-3 py-2 pr-16 border rounded-lg focus:ring-2 focus:ring-primary outline-none uppercase bg-[var(--warning-light)] font-medium"
                                                                    style={{ textTransform: 'uppercase' }}
                                                                    placeholder={field.placeholder || ''}
                                                                    value={createForm[field.name] || ''}
                                                                    onChange={e => {
                                                                        const val = e.target.value.toUpperCase();
                                                                        setCreateForm({ ...createForm, [field.name]: val });
                                                                    }}
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            handleStudentLookup(createForm[field.name]);
                                                                        }
                                                                    }}
                                                                    onBlur={() => handleStudentLookup(createForm[field.name])}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={searchingStudent || !createForm[field.name]}
                                                                    onClick={() => handleStudentLookup(createForm[field.name])}
                                                                    className="absolute right-1 px-2.5 py-1 text-xs font-bold rounded bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition flex items-center gap-1 shadow-sm"
                                                                    title="Fetch student details by Admission No or PIN"
                                                                >
                                                                    {searchingStudent ? (
                                                                        <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                                                    ) : (
                                                                        <Search size={12} />
                                                                    )}
                                                                    Fetch
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type={field.type || 'text'}
                                                                required={field.required}
                                                                autoFocus={field.autoFocus}
                                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none uppercase"
                                                                style={{ textTransform: field.type === 'date' || field.type === 'number' ? 'none' : 'uppercase' }}
                                                                placeholder={field.placeholder || ''}
                                                                value={createForm[field.name] || ''}
                                                                onChange={e => {
                                                                    const val = field.type === 'date' || field.type === 'number' ? e.target.value : e.target.value.toUpperCase();
                                                                    setCreateForm({ ...createForm, [field.name]: val });
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {(() => {
                                        const selectedServiceObj = services.find(s => String(s.id) === String(createForm.service_id));
                                        const price = Number(selectedServiceObj?.price || 0);
                                        return (
                                            <button
                                                type="submit"
                                                className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover mt-4 shadow-lg text-lg flex items-center justify-center gap-2"
                                            >
                                                {price > 0 ? (
                                                    <>
                                                        <Plus size={20} /> Raise Service Request (Unpaid - ₹{price})
                                                    </>
                                                ) : (
                                                    <>
                                                        <Printer size={20} /> Issue & Generate Free Certificate
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })()}
                                </div>
                            )}

                            {!createForm.service_id && (
                                <div className="text-center py-10 text-muted-text">
                                    <div className="text-6xl mb-4">📄</div>
                                    <p>Select a template above to start</p>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Student Edit Modal (Before Printing) */}
            {selectedRequest && actionType === 'edit_student' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-2xl p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <div>
                                <h2 className="text-xl font-bold text-main">Verify Details</h2>
                                <p className="text-sm text-muted-text">Ensure details are correct before printing.</p>
                            </div>
                            <button onClick={() => { setActionType(null); setEditingStudent(null); }} className="text-muted-text hover:text-sub">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-4 mb-6">
                            {getTemplateFields(selectedRequest.service_id).map((section, secIdx) => (
                                <div key={secIdx} className="bg-background/40 p-4 rounded-xl border border-border">
                                    <h3 className="text-sm font-bold text-main mb-3 flex items-center gap-2">
                                        <span className="bg-[var(--primary-light)] text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                            {secIdx + 1}
                                        </span>
                                        {section.section}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {section.fields.map((field) => (
                                            <div key={field.name} className={field.type === 'textarea' || field.fullWidth ? 'md:col-span-2' : ''}>
                                                <label className="block text-xs font-semibold text-sub mb-1">
                                                    {field.label}
                                                    {field.required && <span className="text-danger ml-0.5">*</span>}
                                                </label>
                                                {field.type === 'textarea' ? (
                                                    <textarea
                                                        rows="2"
                                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface uppercase"
                                                        style={{ textTransform: 'uppercase' }}
                                                        value={studentForm[field.name] || ''}
                                                        onChange={e => setStudentForm({ ...studentForm, [field.name]: e.target.value.toUpperCase() })}
                                                        placeholder={field.placeholder || ''}
                                                    />
                                                ) : field.type === 'select' ? (
                                                    <select
                                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface uppercase"
                                                        style={{ textTransform: 'uppercase' }}
                                                        value={studentForm[field.name] || ''}
                                                        onChange={e => setStudentForm({ ...studentForm, [field.name]: e.target.value })}
                                                    >
                                                        <option value="">Select...</option>
                                                        {(field.options || []).map(opt => (
                                                            <option key={opt.value || opt} value={opt.value || opt}>
                                                                {opt.label || opt}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.type || 'text'}
                                                        disabled={field.disabled || field.name === 'admission_number'}
                                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface uppercase ${
                                                            field.disabled || field.name === 'admission_number'
                                                                ? 'bg-background text-muted-text cursor-not-allowed'
                                                                : ''
                                                        }`}
                                                        style={{ textTransform: field.type === 'date' || field.type === 'number' ? 'none' : 'uppercase' }}
                                                        value={studentForm[field.name] ?? ''}
                                                        onChange={e => {
                                                            const val = field.type === 'date' || field.type === 'number' ? e.target.value : (e.target.value ?? '').toUpperCase();
                                                            setStudentForm({ ...studentForm, [field.name]: val });
                                                        }}
                                                        placeholder={field.placeholder || ''}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => handleDirectPrint(selectedRequest)}
                                className="px-6 py-2.5 bg-background rounded-lg font-medium text-sub hover:bg-background"
                            >
                                Skip & Print
                            </button>
                            <div className="flex-1"></div>
                            <button
                                onClick={() => { setActionType(null); setEditingStudent(null); }}
                                className="px-6 py-2.5 bg-surface border border-border-strong rounded-lg font-medium text-sub hover:bg-background"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateStudentAndPrint}
                                className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover shadow-sm flex items-center gap-2"
                            >
                                <CheckCircle size={18} /> Update & Generate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {selectedRequest && actionType === 'ready' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Mark as Ready to Collect</h2>
                        <div className="space-y-4">
                            {/* Dynamic Admin Fields */}
                            {selectedRequest?.admin_fields && selectedRequest.admin_fields.length > 0 && (
                                <div className="p-3 bg-[var(--primary-light)] rounded-lg border border-[var(--primary-light)] mb-2">
                                    <h3 className="text-sm font-bold text-primary mb-2">Required Information</h3>
                                    <div className="space-y-3">
                                        {(typeof selectedRequest.admin_fields === 'string'
                                            ? JSON.parse(selectedRequest.admin_fields)
                                            : selectedRequest.admin_fields
                                        ).map((field, idx) => (
                                            <div key={idx}>
                                                <label className="block text-xs font-medium text-sub mb-1">
                                                    {field.label}
                                                </label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                                                        value={actionData[field.name] || ''}
                                                        onChange={e => setActionData({ ...actionData, [field.name]: e.target.value })}
                                                    >
                                                        <option value="">Select...</option>
                                                        {(field.options || []).map((opt) => (
                                                            <option key={opt} value={opt.id || opt}>{opt.name || opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                        className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-primary outline-none"
                                                        value={actionData[field.name] || ''}
                                                        onChange={e => setActionData({ ...actionData, [field.name]: e.target.value })}
                                                        placeholder={`Enter ${field.label}`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-sub mb-1">Collect Date</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                    value={actionData.collect_date}
                                    onChange={e => setActionData({ ...actionData, collect_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-sub mb-1">Notification to Student</label>
                                <textarea
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                    rows="3"
                                    value={actionData.admin_note}
                                    onChange={e => setActionData({ ...actionData, admin_note: e.target.value })}
                                    placeholder="Enter message for student..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setSelectedRequest(null)} className="flex-1 py-2.5 bg-background rounded-lg font-medium text-sub">Cancel</button>
                                <button onClick={handleUpdateStatus} className="flex-1 py-2.5 bg-secondary text-white rounded-lg font-medium">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Confirmation Modal */}
            {selectedRequest && actionType === 'close' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl animate-scale-in text-center">
                        <div className="w-12 h-12 bg-[var(--success-light)] rounded-full flex items-center justify-center mx-auto mb-4 text-success">
                            <CheckCircle size={24} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Close Request?</h2>
                        <p className="text-muted-text mb-6">This will mark the service as completed and closed.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedRequest(null)} className="flex-1 py-2.5 bg-background rounded-lg font-medium text-sub">Cancel</button>
                            <button onClick={handleUpdateStatus} className="flex-1 py-2.5 bg-success text-white rounded-lg font-medium">Yes, Close it</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Print Preview Modal */}
            {previewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-surface rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-xl font-bold text-main flex items-center gap-2">
                                <Printer className="text-primary" /> Certificate Preview
                            </h2>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        const iframe = document.getElementById('pdf-preview-frame');
                                        if (iframe) iframe.contentWindow.print();
                                    }}
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover transition flex items-center gap-2"
                                >
                                    <Printer size={18} /> Print Certificate
                                </button>
                                <button
                                    onClick={() => setPreviewUrl(null)}
                                    className="p-2 hover:bg-background rounded-full transition"
                                >
                                    <X size={24} className="text-muted-text" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-background p-4">
                            <iframe
                                id="pdf-preview-frame"
                                src={previewUrl}
                                className="w-full h-full rounded-lg shadow-inner bg-surface"
                                title="Certificate Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* Service Requests Settings Modal (Super Admin Only) */}
            {isSuperAdmin && settingsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-border animate-scale-in">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-background/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                    <Settings size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-main">Service Requests Settings</h2>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                            <ShieldCheck size={12} /> Super Admin Only
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-text">Configure fee heads and ledger synchronization</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSettingsModalOpen(false)}
                                className="p-2 text-muted-text hover:text-main hover:bg-background rounded-full transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <form onSubmit={handleSaveSettings}>
                            <div className="p-6 space-y-5">
                                {/* Informational Callout */}
                                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    <strong>Fee Portal Integration:</strong> Select the fee head from your Fee Portal where service request demands and receipts should be booked. All headers are dynamically fetched from the fee portal database without hardcoded values.
                                </div>

                                {loadingSettings ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-text">
                                        <RefreshCw size={28} className="animate-spin text-primary" />
                                        <span className="text-sm font-medium">Fetching fee heads from fee portal...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Dynamic Fee Head Dropdown */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-bold uppercase tracking-wider text-muted-text">
                                                    Select Fee Head *
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={fetchServiceSettings}
                                                    className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                                                >
                                                    <RefreshCw size={12} /> Refresh Heads
                                                </button>
                                            </div>
                                            <select
                                                value={selectedFeeHeadId}
                                                onChange={(e) => setSelectedFeeHeadId(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-main text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                                                required
                                            >
                                                <option value="">-- Choose a Fee Head from Fee Portal --</option>
                                                {feeHeadsList.map((head) => (
                                                    <option key={head._id} value={head._id}>
                                                        {head.code ? `[${head.code}] ` : ''}{head.name} {head.description ? `— ${head.description}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Selected Fee Head Details Card */}
                                        {selectedFeeHeadId && (() => {
                                            const selectedHead = feeHeadsList.find(h => String(h._id) === String(selectedFeeHeadId));
                                            if (!selectedHead) return null;
                                            return (
                                                <div className="p-4 rounded-xl bg-background border border-border space-y-2">
                                                    <div className="text-xs font-semibold text-muted-text uppercase tracking-wider">
                                                        Active Fee Head Summary
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div>
                                                            <span className="text-muted-text">Head Name:</span>{' '}
                                                            <span className="font-bold text-main">{selectedHead.name}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-text">Code:</span>{' '}
                                                            <span className="font-mono font-bold text-primary">{selectedHead.code || 'None'}</span>
                                                        </div>
                                                        {selectedHead.description && (
                                                            <div className="col-span-2">
                                                                <span className="text-muted-text">Description:</span>{' '}
                                                                <span className="text-main">{selectedHead.description}</span>
                                                            </div>
                                                        )}
                                                        <div className="col-span-2 text-[11px] font-mono text-muted-text">
                                                            ID: {selectedHead._id}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Remarks / Notes */}
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase tracking-wider text-muted-text">
                                                Admin Remarks / Notes
                                            </label>
                                            <textarea
                                                rows="2"
                                                value={settingsNotes}
                                                onChange={(e) => setSettingsNotes(e.target.value)}
                                                placeholder="Internal notes regarding this fee head allocation..."
                                                className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-border bg-background/50">
                                <button
                                    type="button"
                                    onClick={() => setSettingsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-sub hover:bg-background rounded-lg transition"
                                    disabled={savingSettings}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingSettings || loadingSettings || !selectedFeeHeadId}
                                    className="px-5 py-2 text-sm font-bold bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition flex items-center gap-2"
                                >
                                    {savingSettings && <RefreshCw size={14} className="animate-spin" />}
                                    {savingSettings ? 'Saving Settings...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Request Lifecycle & Audit History Modal */}
            {historyModalOpen && historyRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-2xl w-full max-w-2xl p-0 shadow-2xl border border-border overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-border bg-background/60 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                                        {historyRequest.sequence_no || `SR-${new Date(historyRequest.created_at || historyRequest.request_date || Date.now()).getFullYear()}-${String(historyRequest.id).padStart(4, '0')}`}
                                    </span>
                                    <span className="text-xs text-muted-text">#{historyRequest.id}</span>
                                    {getStatusBadge(historyRequest.status)}
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${historyRequest.payment_status === 'paid' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'}`}>
                                        Fee: {historyRequest.payment_status || 'pending'}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-main flex items-center gap-2">
                                    <History className="text-primary" size={20} />
                                    Lifecycle & Audit History
                                </h2>
                                <p className="text-xs text-muted-text mt-1">
                                    Service: <strong className="text-main">{historyRequest.service_name}</strong> • Student: <strong className="text-main">{historyRequest.student_name}</strong> ({historyRequest.admission_number || historyRequest.pin_no || 'N/A'})
                                </p>
                            </div>
                            <button
                                onClick={() => { setHistoryModalOpen(false); setHistoryRequest(null); }}
                                className="p-2 text-muted-text hover:text-main hover:bg-background rounded-lg transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body / Timeline */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {(() => {
                                const timeline = getRequestTimeline(historyRequest);
                                if (timeline.length === 0) {
                                    return (
                                        <div className="py-12 text-center text-muted-text">
                                            No history recorded for this request.
                                        </div>
                                    );
                                }

                                return (
                                    <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {timeline.map((event, idx) => {
                                            const action = event.action || '';
                                            let icon = <Clock size={14} className="text-amber-500" />;
                                            let badgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-500';

                                            if (action.includes('CREATED')) {
                                                icon = <Plus size={14} className="text-blue-500" />;
                                                badgeColor = 'bg-blue-500/10 border-blue-500/30 text-blue-500';
                                            } else if (action === 'PAYMENT_VERIFIED') {
                                                icon = <CreditCard size={14} className="text-emerald-500" />;
                                                badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
                                            } else if (action === 'READY_TO_COLLECT') {
                                                icon = <Calendar size={14} className="text-purple-500" />;
                                                badgeColor = 'bg-purple-500/10 border-purple-500/30 text-purple-500';
                                            } else if (action === 'DATA_UPDATED') {
                                                icon = <FileText size={14} className="text-cyan-500" />;
                                                badgeColor = 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500';
                                            } else if (action === 'CERTIFICATE_GENERATED') {
                                                icon = <Printer size={14} className="text-indigo-500" />;
                                                badgeColor = 'bg-indigo-500/10 border-indigo-500/30 text-indigo-500';
                                            } else if (action === 'CLOSED') {
                                                icon = <CheckCircle size={14} className="text-emerald-500" />;
                                                badgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500';
                                            }

                                            const dateStr = event.timestamp
                                                ? new Date(event.timestamp).toLocaleString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                })
                                                : 'Recent';

                                            return (
                                                <div key={idx} className="relative group">
                                                    {/* Dot / Icon */}
                                                    <div className={`absolute -left-[30px] top-1.5 w-6 h-6 rounded-full border flex items-center justify-center bg-surface shadow-sm ${badgeColor}`}>
                                                        {icon}
                                                    </div>

                                                    {/* Content Box */}
                                                    <div className="bg-background/80 p-4 rounded-xl border border-border hover:border-primary/40 transition">
                                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                                            <h4 className="font-bold text-main text-sm flex items-center gap-1.5">
                                                                {event.title || 'Event Logged'}
                                                            </h4>
                                                            <span className="text-[11px] font-mono text-muted-text">
                                                                {dateStr}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-text">
                                                            <User size={12} className="text-sub" />
                                                            <span>By:</span>
                                                            <strong className="text-main font-semibold">
                                                                {event.performed_by?.name || 'Staff/Admin'}
                                                            </strong>
                                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted-text/10 text-sub">
                                                                {event.performed_by?.role || 'admin'}
                                                            </span>
                                                        </div>

                                                        {event.details && (
                                                            <div className="text-xs text-sub bg-surface p-2.5 rounded-lg border border-border/60">
                                                                {event.details}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-border bg-background/50 flex justify-end">
                            <button
                                onClick={() => { setHistoryModalOpen(false); setHistoryRequest(null); }}
                                className="px-5 py-2 bg-surface text-main border border-border hover:bg-background rounded-lg text-sm font-semibold transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceRequests;
