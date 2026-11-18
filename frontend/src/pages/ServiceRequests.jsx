import React, { useEffect, useState } from 'react';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, AlertCircle, Calendar, Filter, MessageSquare, ArrowRight, Download, CreditCard, Printer, X, Plus } from 'lucide-react';
import api from '../config/api';

const ServiceRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');

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

    // Define Schemas for each Template Type
    // This defines EXACTLY what blanks are shown to the user based on the backend templates
    const TEMPLATE_SCHEMAS = {
        study_certificate: [
            {
                section: 'Student Details', fields: [
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true }, // Used as S/o, D/o
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
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text', required: true }, // Used as S/o
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
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true, placeholder: 'Enter & Tab' },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
                    // Father name not explicitly used in Refund App top block, but good for record.
                    { name: 'father_name', label: 'Father\'s Name', type: 'text' },
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
                    { name: 'admission_number', label: 'Admission Number', type: 'text', required: true, autoFocus: true },
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
                    { name: 'father_name', label: 'Father\'s Name', type: 'text' },
                    { name: 'purpose', label: 'Purpose/Note', type: 'text' }
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
                    { name: 'student_name', label: 'Student Name', type: 'text', required: true },
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
                { name: 'admission_number', label: 'Admission Number', type: 'text', disabled: true, placeholder: 'Admission Number' }
            ];

            if (detectedVars.has('student_name') || detectedVars.has('name') || !detectedVars.size) {
                studentFields.push({ name: 'student_name', label: 'Student Name', type: 'text', required: true, placeholder: 'Student Name' });
            }
            if (detectedVars.has('father_name') || detectedVars.has('father')) {
                studentFields.push({ name: 'father_name', label: "Father's Name", type: 'text', placeholder: "Father's Name" });
            }
            if (detectedVars.has('mother_name') || detectedVars.has('mother')) {
                studentFields.push({ name: 'mother_name', label: "Mother's Name", type: 'text', placeholder: "Mother's Name" });
            }
            if (detectedVars.has('guardian_name') || detectedVars.has('guardian')) {
                studentFields.push({ name: 'guardian_name', label: "Guardian's Name", type: 'text', placeholder: "Guardian's Name" });
            }
            if (detectedVars.has('pin_no') || detectedVars.has('pin') || detectedVars.has('ht_no') || detectedVars.has('roll_number')) {
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

            // Group 3: Custom Variables (any other @variable in template)
            const knownVars = new Set([
                'admission_number', 'student_name', 'name', 'father_name', 'father',
                'mother_name', 'mother', 'guardian_name', 'guardian', 'pin_no', 'pin',
                'ht_no', 'roll_number', 'dob', 'date_of_birth', 'gender', 'sex', 'caste',
                'category', 'student_mobile', 'mobile', 'phone_number', 'student_address',
                'address', 'college_name', 'course', 'program', 'degree', 'branch',
                'department', 'current_year', 'year', 'current_semester', 'semester', 'sem',
                'academic_year', 'principal_signature', 'current_date', 'date', 'purpose'
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

    // Auto-fill helper (optional, non-blocking)
    const handleAdmissionBlur = async () => {
        if (!createForm.admission_number) return;
        try {
            const response = await api.get(`/students/${createForm.admission_number}`);
            if (response.data && response.data.data) {
                const s = response.data.data;
                // Merge found data into form, preserving existing inputs if user typed them
                setCreateForm(prev => ({
                    ...prev,
                    student_name: s.student_name || prev.student_name || '',
                    father_name: s.father_name || prev.father_name || '',
                    mother_name: s.mother_name || prev.mother_name || '',
                    dob: s.dob || prev.dob || '',
                    course: s.course || prev.course || '',
                    branch: s.branch || prev.branch || '',
                    current_year: s.current_year || prev.current_year || '',
                    current_semester: s.current_semester || prev.current_semester || '',
                    academic_year: s.academic_year || prev.academic_year || '',
                    gender: s.gender || prev.gender || '',
                }));
                console.log('Student loaded:', s);
            }
        } catch (e) {
            // No error if not found, just let them type
        }
    };

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

    const handleUpdateStatus = async () => {
        try {
            if (actionType === 'ready') {
                if (!actionData.collect_date || !actionData.admin_note) {
                    toast.error('Please provide collect date and notification note');
                    return;
                }
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'ready_to_collect',
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
            toast.error('Update failed');
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

    const handlePayment = async (request) => {
        if (!window.confirm(`Mark payment of ₹${request.service_price} as received?`)) return;

        try {
            await serviceService.processPayment(request.id);
            toast.success('Payment marked as received');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error('Payment update failed');
        }
    };

    // New Flow: 1. Click Print -> 2. Fetch Student -> 3. Show Edit Modal -> 4. Update Service Request Data -> 5. Generate
    const handleVerifyAndPrint = async (request) => {
        try {
            const toastId = toast.loading('Fetching details...');
            // Fetch student based on admission number key in the request or student_id
            const response = await api.get(`/students/${request.admission_number}`);

            toast.dismiss(toastId);

            if (response.data && response.data.data) {
                const student = response.data.data;
                setEditingStudent(student);

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

                // Initialize form: prefer request_data (service-specific values), fallback to student record
                setStudentForm({
                    admission_number: student.admission_number || request.admission_number || '',
                    student_name: reqData.student_name ?? reqData.name ?? student.student_name ?? '',
                    name: reqData.name ?? reqData.student_name ?? student.student_name ?? '',
                    father_name: reqData.father_name ?? student.father_name ?? '',
                    mother_name: reqData.mother_name ?? student.mother_name ?? '',
                    guardian_name: reqData.guardian_name ?? student.guardian_name ?? '',
                    pin_no: reqData.pin_no ?? student.pin_no ?? student.admission_number ?? '',
                    college_name: reqData.college_name ?? student.college ?? '',
                    course: reqData.course ?? student.course ?? '',
                    branch: reqData.branch ?? student.branch ?? '',
                    current_year: reqData.current_year ?? student.current_year ?? '',
                    current_semester: reqData.current_semester ?? student.current_semester ?? '',
                    academic_year: reqData.academic_year ?? student.academic_year ?? '',
                    dob: reqData.dob ?? (student.dob ? new Date(student.dob).toISOString().split('T')[0] : ''),
                    gender: reqData.gender ?? student.gender ?? '',
                    caste: reqData.caste ?? student.caste ?? '',
                    student_mobile: reqData.student_mobile ?? student.student_mobile ?? '',
                    student_address: reqData.student_address ?? student.student_address ?? '',
                    purpose: reqData.purpose ?? request.purpose ?? '',
                    ...reqData
                });
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

            // Save details ONLY to this service request's request_data (does NOT mutate student master table)
            await serviceService.updateRequestData(selectedRequest.id, {
                request_data: studentForm
            });

            toast.dismiss(toastId);
            toast.success('Request details updated');

            // Close edit modal
            setEditingStudent(null);
            setActionType(null);

            const updatedRequest = {
                ...selectedRequest,
                request_data: studentForm
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
        // Basic validation: Service ID, Admission No, and Student Name are bare minimum
        if (!createForm.service_id || !createForm.admission_number || !createForm.student_name) {
            toast.error('Service, Admission Number and Student Name are required');
            return;
        }

        try {
            const res = await serviceService.createRequestByAdmin({
                ...createForm
            });

            toast.success('Service Created & Paid');

            setCreateForm({});

            setActionType(null);
            fetchRequests();

            // Immediately trigger verify & print
            const mockRequest = {
                id: res.requestId,
                admission_number: res.student?.admission_number || createForm.admission_number,
                student_name: res.student_name,
                service_id: createForm.service_id,
                service_name: res.service_name || 'Service',
                status: 'pending',
                payment_status: 'paid',
                request_data: {} // Data is already in DB, verify fetch will pull student data
            };

            // Small delay to allow DB commit
            setTimeout(() => handleVerifyAndPrint(mockRequest), 500);

        } catch (error) {
            console.error(error);
            toast.error('Failed to create request');
        }
    }

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
        <div className="p-6 space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-main">Service Requests</h1>
                    <p className="text-muted-text">Manage student service requests</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setActionType('create_request')}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-2 font-medium shadow-sm"
                    >
                        <Plus size={18} /> Issue Service
                    </button>

                    <div className="flex items-center gap-2 bg-surface p-1 rounded-lg border border-border">
                        <Filter size={16} className="text-muted-text ml-2" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium focus:ring-0 text-sub py-1"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="ready_to_collect">Ready to Collect</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-background text-muted-text text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Request Info</th>
                                <th className="px-6 py-4">Student</th>
                                <th className="px-6 py-4">Mobile</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Payment</th>
                                <th className="px-6 py-4">Dates</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center">Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-muted-text">No requests found</td></tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-background">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-main">{req.service_name}</span>
                                                <span className="text-xs text-muted-text">ID: #{req.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-main">{req.student_name}</span>
                                                <span className="text-xs text-muted-text">{req.admission_number} | {req.course}-{req.branch}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-text">
                                            {req.student_mobile || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${req.payment_status === 'paid' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--danger-light)] text-danger'}`}>
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
                                                {req.payment_status === 'pending' && (
                                                    <button
                                                        onClick={() => handlePayment(req)}
                                                        className="px-3 py-1.5 bg-[var(--success-light)] text-success text-xs font-semibold rounded hover:bg-[var(--success-light)] flex items-center gap-1"
                                                    >
                                                        <CreditCard size={12} /> Mark Paid
                                                    </button>
                                                )}
                                                {req.payment_status === 'paid' && (
                                                    <button
                                                        onClick={() => handleVerifyAndPrint(req)}
                                                        className="px-3 py-1.5 bg-background text-sub text-xs font-semibold rounded hover:bg-background flex items-center gap-1"
                                                        title="Verify details & Print"
                                                    >
                                                        <Printer size={12} /> Verify & Print
                                                    </button>
                                                )}
                                                {req.status === 'pending' && (
                                                    <button
                                                        onClick={() => { setSelectedRequest(req); setActionType('processing'); handleUpdateStatus(); }}
                                                        className="px-3 py-1.5 bg-[var(--primary-light)] text-primary text-xs font-semibold rounded hover:bg-[var(--primary-light)]"
                                                    >
                                                        Process
                                                    </button>
                                                )}
                                                {(req.status === 'pending' || req.status === 'processing') && (
                                                    <button
                                                        onClick={() => openActionModal(req, 'ready')}
                                                        className="px-3 py-1.5 bg-[var(--primary-light)] text-secondary text-xs font-semibold rounded hover:bg-[var(--primary-light)] flex items-center gap-1"
                                                    >
                                                        Mark Ready
                                                    </button>
                                                )}
                                                {req.status === 'ready_to_collect' && (
                                                    <button
                                                        onClick={() => { setSelectedRequest(req); setActionType('close'); }}
                                                        className="px-3 py-1.5 bg-[var(--success-light)] text-success text-xs font-semibold rounded hover:bg-[var(--success-light)] flex items-center gap-1"
                                                    >
                                                        Close
                                                    </button>
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
                                                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none"
                                                                placeholder={field.placeholder || ''}
                                                                value={createForm[field.name] || ''}
                                                                onChange={e => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                                                            />
                                                        ) : (
                                                            <input
                                                                type={field.type || 'text'}
                                                                required={field.required}
                                                                autoFocus={field.autoFocus}
                                                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none ${field.name === 'admission_number' ? 'bg-[var(--warning-light)] font-medium uppercase' : ''}`}
                                                                placeholder={field.placeholder || ''}
                                                                value={createForm[field.name] || ''}
                                                                onChange={e => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                                                                onBlur={field.name === 'admission_number' ? handleAdmissionBlur : undefined}
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="submit"
                                        className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover mt-4 shadow-lg text-lg flex items-center justify-center gap-2"
                                    >
                                        <Printer size={20} /> Issue & Generate
                                    </button>
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
                                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface"
                                                        value={studentForm[field.name] || ''}
                                                        onChange={e => setStudentForm({ ...studentForm, [field.name]: e.target.value })}
                                                        placeholder={field.placeholder || ''}
                                                    />
                                                ) : field.type === 'select' ? (
                                                    <select
                                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface"
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
                                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm bg-surface ${
                                                            field.disabled || field.name === 'admission_number'
                                                                ? 'bg-background text-muted-text cursor-not-allowed'
                                                                : ''
                                                        }`}
                                                        value={studentForm[field.name] ?? ''}
                                                        onChange={e => setStudentForm({ ...studentForm, [field.name]: e.target.value })}
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
        </div>
    );
};

export default ServiceRequests;
