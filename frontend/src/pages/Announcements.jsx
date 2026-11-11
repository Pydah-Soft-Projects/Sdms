import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
    Megaphone,
    Send,
    Trash2,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Loader2,
    Users,
    X,
    Pencil,
    BarChart2,
    PlusCircle,
    MinusCircle,
    Calendar,
    Calendar as CalendarIcon,
    Clock,
    Plus,
    MessageSquare,
    Smartphone,
    FileText,
    Settings,
    LayoutTemplate,
    Ticket,
    Download,
    UserCheck,
    UserX,
    Maximize2,
    ChevronRight,
    ChevronLeft,
    CheckCircle2,
    Search,
    RefreshCw,
    Sparkles,
    Check,
    Filter,
    ChevronDown,
    Layers,
    RotateCcw,
    History,
    XCircle,
    Trophy,
    Award,
    LayoutGrid,
    List,
    FileDown,
    ExternalLink,
    MapPin,
    User,
    GraduationCap
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

import TargetSelector from '../components/TargetSelector';
import EventCalendar from './admin/EventCalendar';
import { downloadCircularPdf, parseCircularNumbers } from '../utils/circularPdf';

const AnnouncementImage = ({ src, alt }) => {
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (hasError || !src) return null;

    return (
        <div className="mb-3 h-36 overflow-hidden rounded-lg bg-background relative">
            {!loaded && (
                <div className="absolute inset-0 bg-background animate-pulse flex items-center justify-center">
                    <ImageIcon size={22} className="text-muted-text opacity-60" />
                </div>
            )}
            <img
                src={src}
                alt={alt || 'Announcement'}
                loading="lazy"
                decoding="async"
                onLoad={() => setLoaded(true)}
                onError={() => setHasError(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
        </div>
    );
};

const Announcements = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const getTabFromUrl = (params) => {
        const tab = params.get('tab');
        if (tab === 'polls') return 'polls';
        if (tab === 'sms') return 'sms';
        if (tab === 'events' || tab === 'calendar') return 'events';
        return 'announcements';
    };

    const [activeTab, setActiveTab] = useState(() => getTabFromUrl(searchParams));

    useEffect(() => {
        const target = getTabFromUrl(searchParams);
        setActiveTab(target);
    }, [searchParams]);

    const handleTabChange = (tabId) => {
        if (tabId === 'calendar') {
            tabId = 'events';
        }

        setActiveTab(tabId);
        if (tabId === 'announcements') {
            setSearchParams({});
        } else {
            setSearchParams({ tab: tabId });
        }
    };

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'list'
    const [topperSearchResults, setTopperSearchResults] = useState([]);
    const [isSearchingTopper, setIsSearchingTopper] = useState(false);
    const [topperSearchQuery, setTopperSearchQuery] = useState('');
    const [activeTopperIndex, setActiveTopperIndex] = useState(0);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

    // Data States with instant sessionStorage caching
    const [announcements, setAnnouncements] = useState(() => {
        try {
            const cached = sessionStorage.getItem('admin_announcements_cache');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [polls, setPolls] = useState([]);
    const [smsTemplates, setSmsTemplates] = useState([]);

    // SMS States
    const [smsMode, setSmsMode] = useState('broadcast'); // 'broadcast' | 'templates' | 'history'
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isMobileTargetModalOpen, setIsMobileTargetModalOpen] = useState(false);
    const [selectedMobileTargets, setSelectedMobileTargets] = useState(['parent_mobile1']);

    // SMS History States
    const [smsHistory, setSmsHistory] = useState({
        summary: {
            total_sent_all_time: 0,
            sent_count_all_time: 0,
            failed_count_all_time: 0,
            templates_used_all_time: 0
        },
        history: [],
        perTemplate: [],
        pagination: { total: 0, page: 1, limit: 15, totalPages: 1 }
    });
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyFilters, setHistoryFilters] = useState({
        date_from: '',
        date_to: '',
        template_id: '',
        search: '',
        page: 1,
        limit: 15
    });
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

    // Announcement Details & Registered Candidates Modal States
    const [selectedAnnouncementForView, setSelectedAnnouncementForView] = useState(null);
    const [registrationDetails, setRegistrationDetails] = useState({ announcement: null, registrations: [] });
    const [registrationsLoading, setRegistrationsLoading] = useState(false);
    const [registrationSearch, setRegistrationSearch] = useState('');
    const [formStep, setFormStep] = useState(1); // Step 1: Details & Audience, Step 2: Event Registration & Dynamic Form

    // UI States
    const [loading, setLoading] = useState(false);
    const [fetchingFeed, setFetchingFeed] = useState(true);
    const [editId, setEditId] = useState(null);
    const [audienceCount, setAudienceCount] = useState(null);
    const [fetchingCount, setFetchingCount] = useState(false);

    // Default student profile fields (editable by admin)
    const INITIAL_DEFAULT_PROFILE_FIELDS = [
        { key: 'student_name', label: 'Student Full Name', required: true, enabled: true },
        { key: 'pin_number', label: 'PIN / Roll Number', required: true, enabled: true },
        { key: 'college', label: 'College', required: true, enabled: true },
        { key: 'branch', label: 'Department / Branch', required: true, enabled: true },
        { key: 'year_sem', label: 'Year & Semester', required: true, enabled: true },
        { key: 'phone', label: 'Mobile Number', required: true, enabled: true },
        { key: 'email', label: 'Email ID', required: false, enabled: true }
    ];

    // Initial Form State
    const initialFormState = {
        title: '',
        content: '',
        announcement_type: 'announcement', // 'circular' | 'event' | 'poll' | 'announcement' | 'achievement'
        time_limit_option: '3', // '1', '3', '7', '30', 'none', 'custom'
        custom_expiry_date: '',
        // Circular specific
        circular_signatory: '',
        circular_designation: '',
        // Event specific
        event_date: '',
        event_time: '',
        event_venue: '',
        requires_registration: false,
        max_seats: '',
        registration_deadline: '',
        custom_registration_field: '',
        default_profile_fields: INITIAL_DEFAULT_PROFILE_FIELDS.map(f => ({ ...f })), // Editable default profile fields
        registration_form_fields: [], // Dynamic Form Fields: [{ id, label, type, options, required }]
        // Poll specific
        question: '',
        options: ['', ''],
        poll_options: ['', ''],
        start_time: '',
        end_time: '',
        // Achievement specific (Type 5: Student Achievement Leader board)
        hackathon_name: '',
        rank_title: '1st Place / Hackathon Topper',
        topper_prize: '',
        topper_name: '',
        topper_branch: '',
        topper_year_sem: '',
        topper_roll_no: '',
        topper_photo: null,
        topper_photo_preview: null,
        topper_students: [{ id: `topper_${Date.now()}`, student_id: '', student_name: '', branch: '', year_sem: '', roll_no: '', student_photo: '' }],
        // SMS Specific
        template_name: '', // For saving template
        template_id: '',
        template_content: '',
        variable_mappings: [], // Array of { type: 'static'|'field', value: '' }
        // Shared Targets
        target_type: 'filters',
        selected_student_ids: [],
        selected_students: [],
        target_college: [],
        target_batch: [],
        target_status: [],
        target_course: [],
        target_branch: [],
        target_year: [],
        target_semester: [],
        image: null,
        existing_image_url: null
    };

    const [formData, setFormData] = useState(initialFormState);

    // Helpers to manage default student profile fields
    const updateDefaultField = (key, prop, value) => {
        setFormData(prev => ({
            ...prev,
            default_profile_fields: (prev.default_profile_fields || INITIAL_DEFAULT_PROFILE_FIELDS).map(f =>
                f.key === key ? { ...f, [prop]: value } : f
            )
        }));
    };

    const resetDefaultFields = () => {
        setFormData(prev => ({
            ...prev,
            default_profile_fields: INITIAL_DEFAULT_PROFILE_FIELDS.map(f => ({ ...f }))
        }));
    };

    // Helpers to add, update, remove dynamic registration form questions
    const addFormField = () => {
        const newField = {
            id: 'field_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            label: '',
            type: 'text',
            options: '',
            required: false
        };
        setFormData(prev => ({
            ...prev,
            registration_form_fields: [...(prev.registration_form_fields || []), newField]
        }));
    };

    const updateFormField = (index, key, value) => {
        setFormData(prev => {
            const fields = [...(prev.registration_form_fields || [])];
            fields[index] = { ...fields[index], [key]: value };
            return { ...prev, registration_form_fields: fields };
        });
    };

    const removeFormField = (index) => {
        setFormData(prev => {
            const fields = [...(prev.registration_form_fields || [])];
            fields.splice(index, 1);
            return { ...prev, registration_form_fields: fields };
        });
    };

    useEffect(() => {
        if (activeTab === 'announcements' || activeTab === 'events') fetchAnnouncements();
        else if (activeTab === 'polls') fetchPolls();
        else if (activeTab === 'sms') {
            fetchSmsTemplates();
            fetchSmsHistory();
        }
    }, [activeTab]);

    const fetchAnnouncements = async () => {
        if (announcements.length === 0) setFetchingFeed(true);
        try {
            const response = await api.get('/announcements/admin');
            if (response.data.success) {
                const data = response.data.data || [];
                setAnnouncements(data);
                try {
                    sessionStorage.setItem('admin_announcements_cache', JSON.stringify(data));
                } catch (e) {
                    console.warn('Failed to cache announcements in sessionStorage:', e);
                }
            }
        } catch (error) { toast.error('Failed to load announcements'); }
        finally { setFetchingFeed(false); }
    };

    const fetchPolls = async () => {
        setFetchingFeed(true);
        try {
            const response = await api.get('/polls/admin');
            if (response.data.success) setPolls(response.data.data || []);
        } catch (error) { toast.error('Failed to load polls'); }
        finally { setFetchingFeed(false); }
    };

    const fetchSmsTemplates = async () => {
        setFetchingFeed(true);
        try {
            const response = await api.get('/sms-templates');
            if (response.data.success) setSmsTemplates(response.data.data || []);
        } catch (error) { console.error('Failed to load templates'); }
        finally { setFetchingFeed(false); }
    };

    const fetchSmsHistory = async (overrides = {}) => {
        setHistoryLoading(true);
        try {
            const queryParams = new URLSearchParams();
            const activeFilters = { ...historyFilters, ...overrides };
            if (activeFilters.page) queryParams.append('page', activeFilters.page);
            if (activeFilters.limit) queryParams.append('limit', activeFilters.limit);
            if (activeFilters.date_from) queryParams.append('date_from', activeFilters.date_from);
            if (activeFilters.date_to) queryParams.append('date_to', activeFilters.date_to);
            if (activeFilters.template_id) queryParams.append('template_id', activeFilters.template_id);
            if (activeFilters.search && activeFilters.search.trim()) queryParams.append('search', activeFilters.search.trim());

            const response = await api.get(`/announcements/sms/history?${queryParams.toString()}`);
            if (response.data && response.data.success) {
                setSmsHistory(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load SMS history:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleHistoryFilterChange = (key, value) => {
        const updated = { ...historyFilters, [key]: value, page: 1 };
        setHistoryFilters(updated);
        fetchSmsHistory(updated);
    };

    const handleHistoryPageChange = (newPage) => {
        const updated = { ...historyFilters, page: newPage };
        setHistoryFilters(updated);
        fetchSmsHistory(updated);
    };

    const handleResetHistoryFilters = () => {
        const resetFilters = {
            date_from: '',
            date_to: '',
            template_id: '',
            search: '',
            page: 1,
            limit: 15
        };
        setHistoryFilters(resetFilters);
        fetchSmsHistory(resetFilters);
    };

    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            const file = e.target.files[0];
            setFormData({
                ...formData,
                image: file,
                previewUrl: URL.createObjectURL(file) // Create local preview URL
            });
        }
    };

    // Strict PDF upload handler for Circular (Type 1)
    const handleCircularFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 200 * 1024) {
            toast.error('Student photos must be 200 KB or smaller');
            e.target.value = '';
            return;
        }

        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            toast.error('Only "PDF" files are allowed for circulars!');
            e.target.value = '';
            return;
        }

        setFormData(prev => ({
            ...prev,
            file: file,
            file_name: file.name,
            file_preview_url: URL.createObjectURL(file)
        }));
        toast.success(`Attached PDF: ${file.name}`);
    };

    // Topper photo upload handler for Student Achievement Leaderboard (Type 5)
    const handleTopperPhotoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const photo = String(reader.result || '');
            setFormData(prev => ({
                ...prev,
                topper_photo: file,
                topper_photo_preview: photo,
                topper_students: (prev.topper_students || []).map((topper, index) =>
                    index === 0 ? { ...topper, student_photo: photo } : topper
                )
            }));
        };
        reader.onerror = () => toast.error('Failed to read student photo');
        reader.readAsDataURL(file);
    };

    // Auto-search students from DB for Topper selection
    const handleSearchTopper = async (query, index) => {
        setActiveTopperIndex(index);
        setTopperSearchQuery(query);
        if (!query || query.trim().length < 2) {
            setTopperSearchResults([]);
            return;
        }
        setIsSearchingTopper(true);
        try {
            const res = await api.get('/students', {
                params: { search: query.trim(), limit: 10, lite: true }
            });
            if (res.data.success) {
                setTopperSearchResults(res.data.data || []);
            }
        } catch (e) {
            console.error('Error searching students:', e);
            toast.error('Unable to search students');
        } finally {
            setIsSearchingTopper(false);
        }
    };

    const handleSelectTopperStudent = (student, index = activeTopperIndex) => {
        const yearSem = [
            student.current_year ? `Year ${student.current_year}` : '',
            student.current_semester ? `Sem ${student.current_semester}` : ''
        ].filter(Boolean).join(' · ');
        const selectedTopper = {
            id: `topper_${student.id || Date.now()}`,
            student_id: student.id,
            student_name: student.student_name || '',
            branch: student.branch || '',
            year_sem: yearSem || '',
            roll_no: student.pin_no || student.admission_number || '',
            student_photo: typeof student.student_image === 'string' && student.student_image.length <= 2000
                ? student.student_image
                : ''
        };

        setFormData(prev => ({
            ...prev,
            topper_students: (prev.topper_students || []).map((topper, topperIndex) => topperIndex === index
                ? { ...topper, ...selectedTopper }
                : topper),
            ...(index === 0 ? {
                topper_name: selectedTopper.student_name,
                topper_branch: selectedTopper.branch,
                topper_year_sem: selectedTopper.year_sem,
                topper_roll_no: selectedTopper.roll_no,
                topper_photo_preview: selectedTopper.student_photo || prev.topper_photo_preview
            } : {})
        }));
        setTopperSearchResults([]);
        setTopperSearchQuery('');
        toast.success(`Selected student: ${student.student_name}`);
    };

    const addTopperStudent = () => {
        setFormData(prev => ({
            ...prev,
            topper_students: [
                ...(prev.topper_students || []),
                { id: `topper_${Date.now()}`, student_id: '', student_name: '', branch: '', year_sem: '', roll_no: '', student_photo: '' }
            ]
        }));
    };

    const updateTopperStudent = (index, key, value) => {
        setFormData(prev => ({
            ...prev,
            topper_students: (prev.topper_students || []).map((topper, topperIndex) =>
                topperIndex === index ? { ...topper, [key]: value } : topper
            ),
            ...(index === 0 ? {
                [key === 'student_name' ? 'topper_name' :
                    key === 'branch' ? 'topper_branch' :
                        key === 'year_sem' ? 'topper_year_sem' :
                            key === 'roll_no' ? 'topper_roll_no' : key]: value
            } : {})
        }));
    };

    const removeTopperStudent = (index) => {
        setFormData(prev => ({
            ...prev,
            topper_students: (prev.topper_students || []).filter((_, topperIndex) => topperIndex !== index)
        }));
        setTopperSearchResults([]);
        setTopperSearchQuery('');
    };

    const openCreateModal = (type = 'announcements', announcementType = null) => {
        setFormData({
            ...initialFormState,
            announcement_type: announcementType || (type === 'polls' ? 'poll' : '')
        });
        setEditId(null);
        setFormStep(announcementType ? 1 : 0);
        handleTabChange(type === 'polls' ? 'polls' : type === 'events' ? 'events' : 'announcements');
        setIsCreateModalOpen(true);
    };

    // Keep variable_mappings length in sync with {#var#} placeholders in content
    const syncVariableMappings = (content, existingMappings = []) => {
        const varCount = (content.match(/\{#var#\}/g) || []).length;
        const mappings = Array.isArray(existingMappings) ? [...existingMappings] : [];
        while (mappings.length < varCount) {
            mappings.push({ type: 'static', value: '' });
        }
        return mappings.slice(0, varCount);
    };

    const openTemplateModal = (template = null) => {
        if (template) {
            setEditId(template.id);
            const existingMappings = typeof template.variable_mappings === 'string'
                ? JSON.parse(template.variable_mappings)
                : (template.variable_mappings || []);
            const content = template.content || '';
            setFormData({
                ...initialFormState,
                template_name: template.name,
                template_id: template.template_id,
                template_content: content,
                variable_mappings: syncVariableMappings(content, existingMappings)
            });
        } else {
            setEditId(null);
            setFormData(initialFormState);
        }
        setIsTemplateModalOpen(true);
    };

    const handleTemplateContentChange = (content) => {
        setFormData(prev => ({
            ...prev,
            template_content: content,
            variable_mappings: syncVariableMappings(content, prev.variable_mappings)
        }));
    };

    const openEditModal = (item, type) => {
        setEditId(item.id);
        handleTabChange(type);

        const parseField = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);
        };

        if (type === 'announcements') {
            let timeLimitOpt = 'none';
            let customExpiry = '';
            if (item.expires_at) {
                timeLimitOpt = 'custom';
                try {
                    customExpiry = new Date(item.expires_at).toISOString().slice(0, 16);
                } catch (e) {
                    customExpiry = '';
                }
            }
            let regDeadline = '';
            if (item.registration_deadline) {
                try {
                    regDeadline = new Date(item.registration_deadline).toISOString().slice(0, 16);
                } catch (e) {
                    regDeadline = '';
                }
            }
            let parsedFormFields = [];
            if (item.registration_form_fields) {
                try {
                    parsedFormFields = typeof item.registration_form_fields === 'string'
                        ? JSON.parse(item.registration_form_fields)
                        : item.registration_form_fields;
                } catch (e) {
                    parsedFormFields = [];
                }
            }
            if (!Array.isArray(parsedFormFields)) parsedFormFields = [];

            // Separate default profile fields from custom questions
            const defaultFieldsFromItem = parsedFormFields.filter(f => f.is_default);
            const customFieldsFromItem = parsedFormFields.filter(f => !f.is_default);

            let loadedDefaultFields = INITIAL_DEFAULT_PROFILE_FIELDS.map(def => {
                const existing = defaultFieldsFromItem.find(f => (f.key === def.key || f.id === 'def_' + def.key));
                if (existing) {
                    return {
                        ...def,
                        label: existing.label || def.label,
                        required: existing.required !== undefined ? Boolean(existing.required) : def.required,
                        enabled: existing.enabled !== undefined ? Boolean(existing.enabled) : true
                    };
                }
                return def;
            });

            const itemType = item.announcement_type || 'announcement';
            const registrationEnabled = itemType === 'form'
                || item.requires_registration === true
                || Number(item.requires_registration) === 1;
            setFormStep(registrationEnabled ? 2 : 1);
            let achObj = {};
            if (item.achievement_data) {
                achObj = typeof item.achievement_data === 'string' ? JSON.parse(item.achievement_data) : item.achievement_data;
            }

            let pollOpts = ['', ''];
            if (item.poll_options) {
                pollOpts = typeof item.poll_options === 'string' ? JSON.parse(item.poll_options) : item.poll_options;
            }

            setFormData({
                ...initialFormState,
                announcement_type: itemType,
                title: item.title,
                content: item.content || '',
                file_name: item.file_name || '',
                existing_file_url: item.file_url || null,
                circular_signatory: item.circular_signatory || '',
                circular_designation: item.circular_designation || '',
                event_date: item.event_date || '',
                event_time: item.event_time || '',
                event_venue: item.event_venue || '',
                poll_options: Array.isArray(pollOpts) && pollOpts.length > 0 ? pollOpts : ['', ''],
                rank_title: achObj.rank_title || '1st Place / Hackathon Topper',
                topper_name: achObj.student_name || '',
                topper_branch: achObj.branch || '',
                topper_year_sem: achObj.year_sem || '',
                topper_roll_no: achObj.roll_no || '',
                topper_prize: achObj.topper_prize || '',
                topper_photo_preview: achObj.student_photo || item.image_url || null,
                topper_students: Array.isArray(achObj.students) && achObj.students.length
                    ? achObj.students.map((student, index) => ({ id: student.id || `topper_${index}`, ...student }))
                    : [{
                        id: `topper_${Date.now()}`,
                        student_id: achObj.student_id || '',
                        student_name: achObj.student_name || '',
                        branch: achObj.branch || '',
                        year_sem: achObj.year_sem || '',
                        roll_no: achObj.roll_no || '',
                        student_photo: achObj.student_photo || item.image_url || ''
                    }],
                time_limit_option: timeLimitOpt,
                custom_expiry_date: customExpiry,
                requires_registration: registrationEnabled,
                max_seats: item.max_seats || '',
                registration_deadline: regDeadline,
                custom_registration_field: item.custom_registration_field || '',
                default_profile_fields: loadedDefaultFields,
                registration_form_fields: customFieldsFromItem,
                target_type: item.target_type || (Array.isArray(item.target_student_ids) && item.target_student_ids.length ? 'individual' : 'filters'),
                selected_student_ids: Array.isArray(item.target_student_ids) ? item.target_student_ids : [],
                selected_students: (Array.isArray(item.target_student_ids) ? item.target_student_ids : [])
                    .map(studentId => ({ id: studentId, student_name: `Student #${studentId}` })),
                target_college: parseField(item.target_college),
                target_batch: parseField(item.target_batch),
                target_course: parseField(item.target_course),
                target_branch: parseField(item.target_branch),
                target_year: parseField(item.target_year),
                target_semester: parseField(item.target_semester),
                existing_image_url: item.image_url
            });
        } else {
            // Poll
            const formatDate = (dateStr) => dateStr ? new Date(dateStr).toISOString().slice(0, 16) : '';
            const pollOptions = parseField(item.options);
            setFormData({
                ...initialFormState,
                announcement_type: 'poll',
                title: item.question || '',
                poll_options: pollOptions.length > 0 ? pollOptions : ['', ''],
                custom_expiry_date: formatDate(item.end_time),
                target_college: parseField(item.target_college),
                target_batch: parseField(item.target_batch),
                target_course: parseField(item.target_course),
                target_branch: parseField(item.target_branch),
                target_year: parseField(item.target_year),
                target_semester: parseField(item.target_semester),
            });
        }
        setIsCreateModalOpen(true);
    };

    const handleCancel = () => {
        setIsCreateModalOpen(false);
        setIsTemplateModalOpen(false);
        setEditId(null);
        setFormStep(1);
        setFormData(initialFormState);
    };

    // Fetch audience count when targets change (create/poll modal OR SMS broadcast)
    useEffect(() => {
        const onSmsBroadcast = activeTab === 'sms' && smsMode === 'broadcast';
        if (!isCreateModalOpen && !isTemplateModalOpen && !onSmsBroadcast) return;

        if (formData.target_type === 'individual') {
            setAudienceCount((formData.selected_students || []).length);
            setFetchingCount(false);
            return;
        }

        const timer = setTimeout(async () => {
            setFetchingCount(true);
            try {
                const response = await api.post('/announcements/count', {
                    target_type: formData.target_type,
                    selected_student_ids: (formData.selected_students || []).map(s => s.id),
                    target_college: formData.target_college,
                    target_batch: formData.target_batch,
                    target_status: formData.target_status || [],
                    target_course: formData.target_course,
                    target_branch: formData.target_branch,
                    target_year: formData.target_year,
                    target_semester: formData.target_semester
                });
                if (response.data.success) {
                    setAudienceCount(response.data.count);
                }
            } catch (error) {
                console.error('Failed to fetch audience count');
                setAudienceCount(null);
            } finally {
                setFetchingCount(false);
            }
        }, 400); // Debounce target changes

        return () => clearTimeout(timer);
    }, [
        formData.target_type,
        formData.selected_students,
        formData.target_college,
        formData.target_batch,
        formData.target_status,
        formData.target_course,
        formData.target_branch,
        formData.target_year,
        formData.target_semester,
        isCreateModalOpen,
        isTemplateModalOpen,
        activeTab,
        smsMode
    ]);

    // Handle Template Selection for Broadcast — load template defaults, allow override before send
    const handleTemplateSelect = (e) => {
        const tId = e.target.value;
        const template = smsTemplates.find(t => t.id.toString() === tId);
        setSelectedTemplate(template || null);
        if (template) {
            const existingMappings = typeof template.variable_mappings === 'string'
                ? JSON.parse(template.variable_mappings)
                : (template.variable_mappings || []);
            const content = template.content || '';
            setFormData(prev => ({
                ...prev,
                template_id: template.template_id,
                template_content: content,
                // Defaults from template; user can edit these at send time
                variable_mappings: syncVariableMappings(content, existingMappings)
            }));
        } else {
            setFormData(prev => ({ ...prev, template_id: '', template_content: '', variable_mappings: [] }));
        }
    };

    const handleMappingChange = (index, key, value) => {
        const newMappings = [...formData.variable_mappings];
        if (key === 'type') {
            // Switching Static <-> Field clears the value so user re-enters / re-selects
            newMappings[index] = { type: value, value: '' };
        } else {
            newMappings[index] = { ...newMappings[index], [key]: value };
        }
        setFormData({ ...formData, variable_mappings: newMappings });
    };

    /** Preview message with static values filled; field placeholders show [Field Label] */
    const getSendTimePreview = () => {
        let varIndex = 0;
        return (formData.template_content || '').replace(/\{#var#\}/g, () => {
            const mapping = formData.variable_mappings[varIndex++];
            if (!mapping || !mapping.value) return '{#var#}';
            if (mapping.type === 'field') {
                const field = studentFields.find(f => f.value === mapping.value);
                return `[${field?.label || mapping.value}]`;
            }
            return mapping.value;
        });
    };

    const handleSubmitAnnouncement = async (e) => {
        e.preventDefault();
        const type = (formData.announcement_type || 'announcement').toLowerCase();

        // Type-specific field validations
        if (type === 'circular') {
            if (!formData.title || !formData.title.trim()) {
                return toast.error('Please enter the Subject Line for the circular');
            }
            if (!formData.content || !formData.content.trim()) {
                return toast.error('Please enter the circular content');
            }
            if (!formData.circular_signatory.trim() || !formData.circular_designation.trim()) {
                return toast.error('Please enter the signatory name and designation');
            }
        } else if (type === 'event') {
            if (!formData.title || !formData.title.trim()) {
                return toast.error('Please enter the Event Title');
            }
        } else if (type === 'form') {
            if (!formData.title.trim() || !formData.content.trim()) {
                return toast.error('Please enter a form title and description');
            }
            if (!(formData.registration_form_fields || []).some(field => field.label?.trim())) {
                return toast.error('Add at least one form field');
            }
        } else if (type === 'poll') {
            if (!formData.title || !formData.title.trim()) {
                return toast.error('Please enter the Poll Question');
            }
            const validOptions = (formData.poll_options || []).filter(o => o && o.trim());
            if (validOptions.length < 2) {
                return toast.error('Please enter at least 2 poll options');
            }
        } else if (type === 'achievement') {
            if (!formData.title || !formData.title.trim()) {
                return toast.error('Please enter the Hackathon / Competition Name');
            }
            const students = (formData.topper_students || []).filter(student => student.student_name.trim());
            if (!students.length) {
                return toast.error('Add at least one student to the leadership board');
            }
            if (students.some(student => !student.branch.trim() || !student.year_sem.trim())) {
                return toast.error('Each student needs a branch and year/semester');
            }
        } else {
            if (!formData.title || !formData.title.trim()) return toast.error('Title is required');
            if (!formData.content || !formData.content.trim()) return toast.error('Content is required');
        }

        setLoading(true);
        const data = new FormData();
        data.append('announcement_type', type);
        data.append('title', formData.title.trim());
        data.append('content', formData.content || '');

        if (type === 'circular') {
            data.append('circular_signatory', formData.circular_signatory.trim());
            data.append('circular_designation', formData.circular_designation.trim());
        } else if (type === 'event') {
            if (formData.image) data.append('image', formData.image);
        } else if (type === 'poll') {
            const validOptions = (formData.poll_options || []).filter(o => o && o.trim());
            data.append('poll_options', JSON.stringify(validOptions));
        } else if (type === 'achievement') {
            const topperStudents = (formData.topper_students || [])
                .filter(student => student.student_name.trim())
                .map(student => ({
                    id: student.student_id || '',
                    student_name: student.student_name.trim(),
                    branch: student.branch.trim(),
                    year_sem: student.year_sem.trim(),
                    roll_no: student.roll_no || '',
                    student_photo: student.student_photo || ''
                }));
            const achievementPayload = {
                hackathon_name: formData.title.trim(),
                rank_title: formData.rank_title || '1st Place / Hackathon Topper',
                topper_prize: formData.topper_prize || '',
                students: topperStudents,
                ...topperStudents[0]
            };
            data.append('achievement_data', JSON.stringify(achievementPayload));
        } else {
            if (formData.image) data.append('image', formData.image);
        }

        if (type === 'event') {
            data.append('event_date', formData.event_date || '');
            data.append('event_time', formData.event_time || '');
            data.append('event_venue', formData.event_venue || '');
        }

        if (editId && formData.existing_image_url && !formData.image && !formData.topper_photo) {
            data.append('existing_image_url', formData.existing_image_url);
        }

        let computedExpiresAt = null;
        if (formData.time_limit_option === 'custom' && formData.custom_expiry_date) {
            computedExpiresAt = new Date(formData.custom_expiry_date).toISOString().slice(0, 19).replace('T', ' ');
        } else if (formData.time_limit_option && formData.time_limit_option !== 'none') {
            const days = parseInt(formData.time_limit_option, 10);
            if (!isNaN(days) && days > 0) {
                const expDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                computedExpiresAt = expDate.toISOString().slice(0, 19).replace('T', ' ');
            }
        }
        if (computedExpiresAt) {
            data.append('expires_at', computedExpiresAt);
        } else {
            data.append('expires_at', '');
        }

        // Registration & Seat Management Fields
        const requiresRegistration = type === 'form' || Boolean(formData.requires_registration);
        data.append('requires_registration', requiresRegistration ? '1' : '0');
        if (requiresRegistration) {
            data.append('max_seats', formData.max_seats || '');
            if (formData.registration_deadline) {
                const regDl = new Date(formData.registration_deadline).toISOString().slice(0, 19).replace('T', ' ');
                data.append('registration_deadline', regDl);
            } else {
                data.append('registration_deadline', '');
            }
            const combinedFormFields = [
                ...(formData.default_profile_fields || INITIAL_DEFAULT_PROFILE_FIELDS).map(f => ({
                    id: 'def_' + f.key,
                    key: f.key,
                    label: (f.label || '').trim(),
                    type: 'text',
                    required: Boolean(f.required),
                    enabled: Boolean(f.enabled),
                    is_default: true
                })),
                ...(formData.registration_form_fields || [])
                    .filter(f => f.label && f.label.trim())
                    .map(f => ({
                        id: f.id || ('field_' + Date.now()),
                        label: f.label.trim(),
                        type: f.type || 'text',
                        options: f.options || '',
                        required: Boolean(f.required),
                        is_default: false,
                        enabled: true
                    }))
            ];
            data.append('registration_form_fields', JSON.stringify(combinedFormFields));
            const firstCustom = (formData.registration_form_fields || []).find(f => f.label && f.label.trim());
            data.append('custom_registration_field', firstCustom?.label || formData.custom_registration_field || '');
        } else {
            data.append('max_seats', '');
            data.append('registration_deadline', '');
            data.append('custom_registration_field', '');
            data.append('registration_form_fields', '[]');
        }

        data.append('target_type', formData.target_type || 'filters');
        if (formData.target_type === 'individual') {
            data.append('selected_student_ids', JSON.stringify((formData.selected_students || []).map(student => (
                typeof student === 'object' ? student.id : student
            ))));
        }

        ['target_college', 'target_batch', 'target_course', 'target_branch', 'target_year', 'target_semester'].forEach(key => {
            if (formData[key].length) data.append(key, JSON.stringify(formData[key]));
        });

        try {
            const url = editId ? `/announcements/${editId}` : '/announcements';
            const method = editId ? api.put : api.post;
            await method(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success(editId ? 'Updated' : 'Posted');
            handleCancel();
            fetchAnnouncements();
        } catch (error) { console.error(error); toast.error('Failed'); }
        finally { setLoading(false); }
    };

    const handleSubmitPoll = async (e) => {
        e.preventDefault();
        const question = formData.title.trim();
        const options = (formData.poll_options || []).filter(option => option.trim());
        if (!question || options.length < 2) return toast.error('Question and at least 2 options required');

        setLoading(true);
        const payload = {
            question,
            options,
            start_time: formData.start_time || null,
            end_time: formData.custom_expiry_date || null,
            target_college: formData.target_college,
            target_batch: formData.target_batch,
            target_course: formData.target_course,
            target_branch: formData.target_branch,
            target_year: formData.target_year,
            target_semester: formData.target_semester
        };

        try {
            if (editId) {
                await api.put(`/polls/${editId}`, payload);
                toast.success('Poll updated successfully');
            } else {
                await api.post('/polls', payload);
                toast.success('Poll created successfully');
            }
            handleCancel();
            if (activeTab === 'polls') {
                fetchPolls();
            } else {
                handleTabChange('polls');
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to save poll');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTemplate = async (e) => {
        e.preventDefault();
        if (!formData.template_name || !formData.template_id || !formData.template_content) return toast.error('All fields required');

        // Defaults are optional here — final values are set/confirmed at send time
        const syncedMappings = syncVariableMappings(formData.template_content, formData.variable_mappings);

        setLoading(true);
        try {
            const payload = {
                name: formData.template_name,
                template_id: formData.template_id,
                content: formData.template_content,
                variable_mappings: syncedMappings
            };

            if (editId) {
                await api.put(`/sms-templates/${editId}`, payload);
                toast.success('Template updated');
            } else {
                await api.post('/sms-templates', payload);
                toast.success('Template created');
            }
            handleCancel();
            fetchSmsTemplates();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save template');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await api.delete(`/sms-templates/${id}`);
            toast.success('Template deleted');
            fetchSmsTemplates();
        } catch (e) { toast.error('Failed to delete'); }
    };

    const validateBroadcastBeforeSend = () => {
        if (!selectedTemplate) return toast.error('Please select a template');

        const sendMappings = syncVariableMappings(formData.template_content, formData.variable_mappings);
        if (sendMappings.length === 0 && /\{#var#\}/.test(formData.template_content || '')) {
            toast.error('Could not detect variables — check template content');
            return null;
        }
        if (sendMappings.some(m => !m.value || !String(m.value).trim())) {
            toast.error('Please enter or select a value for every variable before sending');
            return null;
        }
        return sendMappings;
    };

    const handleSendBroadcast = async (e) => {
        e.preventDefault();
        const sendMappings = validateBroadcastBeforeSend();
        if (!sendMappings) return;
        setIsMobileTargetModalOpen(true);
    };

    const handleConfirmBroadcastSend = async () => {
        const sendMappings = validateBroadcastBeforeSend();
        if (!sendMappings) return;
        if (selectedMobileTargets.length === 0) {
            return toast.error('Please select at least one mobile number target');
        }

        setLoading(true);
        try {
            const payload = {
                template_id: formData.template_id,
                template_content: formData.template_content,
                variable_mappings: sendMappings,
                selected_mobile_targets: selectedMobileTargets,
                target_type: formData.target_type || 'filters',
                selected_student_ids: (formData.selected_students || []).map(s => typeof s === 'object' ? s.id : s),
                target_college: formData.target_college,
                target_batch: formData.target_batch,
                target_status: formData.target_status || [],
                target_course: formData.target_course,
                target_branch: formData.target_branch,
                target_year: formData.target_year,
                target_semester: formData.target_semester
            };

            const response = await api.post('/announcements/sms', payload);
            if (response.data.success) {
                toast.success(response.data.message || 'SMS Sending Initiated');
                setIsMobileTargetModalOpen(false);
                // Reset form but keep mode
                setFormData(prev => ({
                    ...initialFormState,
                    target_college: [],
                    target_batch: [],
                    target_status: []
                }));
                setSelectedTemplate(null);
                fetchSmsHistory();
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to send SMS');
        } finally {
            setLoading(false);
        }
    };

    const toggleMobileTarget = (targetKey) => {
        setSelectedMobileTargets(prev => (
            prev.includes(targetKey)
                ? prev.filter(item => item !== targetKey)
                : [...prev, targetKey]
        ));
    };

    const handleDelete = async (id, type) => {
        if (!window.confirm('Delete this item?')) return;
        try {
            await api.delete(`/${type}/${id}`);
            toast.success('Deleted');
            if (type === 'announcements') fetchAnnouncements(); else fetchPolls();
        } catch (e) { toast.error('Failed to delete'); }
    };

    const toggleStatus = async (id, currentStatus, type) => {
        try {
            await api.patch(`/${type}/${id}/status`, { is_active: !currentStatus });
            toast.success('Status updated');
            if (type === 'announcements') fetchAnnouncements(); else fetchPolls();
        } catch (e) { toast.error('Failed update'); }
    };

    // Open Announcement Details & Registered Candidates Modal
    const handleOpenAnnouncementDetails = (ann) => {
        setSelectedAnnouncementForView(ann);
        setRegistrationSearch('');
        if (ann.requires_registration) {
            fetchAnnouncementRegistrations(ann.id);
        } else {
            setRegistrationDetails({ announcement: ann, registrations: [] });
        }
    };

    const handleCircularDownload = (announcement, college) => {
        try {
            downloadCircularPdf(announcement, college);
        } catch (error) {
            toast.error(error.message || 'Unable to download circular');
        }
    };

    const fetchAnnouncementRegistrations = async (annId) => {
        setRegistrationsLoading(true);
        try {
            const response = await api.get(`/announcements/${annId}/registrations`);
            if (response.data && response.data.success) {
                setRegistrationDetails(response.data.data);
            }
        } catch (error) {
            console.error('Failed to load registrations:', error);
            toast.error('Failed to load candidate registrations');
        } finally {
            setRegistrationsLoading(false);
        }
    };

    const handleRemoveCandidate = async (annId, registrationId, candidateName) => {
        if (!window.confirm(`Are you sure you want to remove registration for ${candidateName || 'this student'}? This will free up a seat.`)) return;
        try {
            await api.delete(`/announcements/${annId}/registrations/${registrationId}`);
            toast.success('Registration removed');
            fetchAnnouncementRegistrations(annId);
            fetchAnnouncements();
        } catch (error) {
            toast.error('Failed to remove registration');
        }
    };

    const exportRegistrationsToCSV = (announcement, registrations) => {
        if (!registrations || registrations.length === 0) {
            return toast.error('No registrations to export');
        }

        const formFields = (announcement?.registration_form_fields || []).filter(field => !field.is_default);
        const dynamicHeaders = formFields.map(f => `"${(f.label || 'Question').replace(/"/g, '""')}"`);
        const headers = ['S.No', 'Student Name', 'PIN / Roll No', 'College', 'Branch', 'Year', 'Semester', 'Mobile', 'Email', 'Registered At', ...dynamicHeaders, 'Additional Info', 'Status'];
        
        const rows = registrations.map((r, idx) => {
            const dynamicResponses = formFields.map(f => {
                const val = r.form_responses?.[f.id] ?? r.form_responses?.[f.label] ?? '';
                return `"${String(val).replace(/"/g, '""')}"`;
            });

            return [
                idx + 1,
                `"${(r.student_name || '').replace(/"/g, '""')}"`,
                `"${(r.pin_number || '').replace(/"/g, '""')}"`,
                `"${(r.college || '').replace(/"/g, '""')}"`,
                `"${(r.branch || '').replace(/"/g, '""')}"`,
                `"${(r.current_year || '').replace(/"/g, '""')}"`,
                `"${(r.current_semester || '').replace(/"/g, '""')}"`,
                `"${(r.phone || '').replace(/"/g, '""')}"`,
                `"${(r.email || '').replace(/"/g, '""')}"`,
                `"${r.registered_at ? new Date(r.registered_at).toLocaleString('en-IN') : ''}"`,
                ...dynamicResponses,
                `"${(r.custom_field_value || '').replace(/"/g, '""')}"`,
                `"${r.status || 'confirmed'}"`
            ];
        });

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Registrations_${(announcement?.title || 'event').replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Downloaded candidate registration list');
    };

    // Poll Option Helpers
    const addOption = () => {
        if (formData.options.length < 6) setFormData({ ...formData, options: [...formData.options, ''] });
    };
    const removeOption = (idx) => {
        if (formData.options.length > 2) {
            const newOpts = [...formData.options];
            newOpts.splice(idx, 1);
            setFormData({ ...formData, options: newOpts });
        }
    };
    const updateOption = (idx, val) => {
        const newOpts = [...formData.options];
        newOpts[idx] = val;
        setFormData({ ...formData, options: newOpts });
    };

    // Student Fields for Mapping
    const studentFields = [
        { label: 'Student Name', value: 'student_name' },
        { label: 'Admission Number', value: 'admission_number' },
        { label: 'User Name', value: 'admission_number' },
        { label: 'User Type (Student/Parent)', value: 'user_type' },
        { label: 'Login Link', value: 'login_link' },
        { label: 'Default Password', value: 'default_password' },
        { label: 'Parent Name', value: 'father_name' },
        { label: 'Parent Mobile', value: 'parent_mobile1' },
        { label: 'Student Mobile', value: 'student_mobile' },
        { label: 'College Name', value: 'college' },
        { label: 'Branch', value: 'branch' },
        { label: 'Current Year', value: 'current_year' },
        { label: 'Current Semester', value: 'current_semester' },
        { label: 'Total Due Amount', value: 'total_due' },
        { label: 'Attendance %', value: 'attendance_percentage' },
        { label: 'Current Date', value: 'current_date' }
    ];



    const AnnouncementSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-surface rounded-xl border p-4 animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                        <div className="h-5 bg-background rounded w-2/3"></div>
                        <div className="flex gap-1">
                            <div className="w-8 h-8 bg-background rounded"></div>
                            <div className="w-8 h-8 bg-background rounded"></div>
                        </div>
                    </div>
                    <div className="h-32 bg-background rounded-lg mb-3"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-background rounded w-full"></div>
                        <div className="h-4 bg-background rounded w-5/6"></div>
                    </div>
                </div>
            ))}
        </div>
    );

    const PollSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-surface rounded-xl border p-6 animate-pulse">
                    <div className="h-6 bg-background rounded w-3/4 mb-4"></div>
                    <div className="space-y-3 mb-6">
                        <div className="h-10 bg-background rounded"></div>
                        <div className="h-10 bg-background rounded"></div>
                    </div>
                    <div className="h-12 bg-background rounded-b-xl -mx-6 -mb-6"></div>
                </div>
            ))}
        </div>
    );

    const visibleAnnouncements = announcements.filter(announcement => {
        const isEvent = String(announcement.announcement_type || 'announcement').toLowerCase() === 'event';
        return activeTab === 'events' ? isEvent : !isEvent;
    });
    const pageTitle = activeTab === 'polls' ? 'Polls' : activeTab === 'sms' ? 'SMS' : activeTab === 'events' ? 'Events' : 'Announcements';

    useEffect(() => {
        document.title = `${pageTitle} | CAMPO SD Admin`;
    }, [pageTitle]);

    return (
        <div className="min-h-screen bg-transparent space-y-6 animate-fade-in relative">
            {/* Header with Page Name & Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border bg-[var(--surface)]/80 backdrop-blur-md px-6 py-4 rounded-t-2xl shadow-sm overflow-hidden sticky top-0 z-30">
                <div className="flex flex-col items-start gap-3 lg:flex-row lg:items-center">
                    <h1 className="text-xl sm:text-2xl font-bold text-main tracking-tight">
                        {pageTitle}
                    </h1>
                    {activeTab !== 'sms' && (
                        <div
                            role="tablist"
                            aria-label="Announcements sections"
                            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1"
                        >
                            {[
                                { id: 'announcements', label: 'Announcements', icon: Megaphone },
                                { id: 'polls', label: 'Polls', icon: BarChart2 },
                                { id: 'events', label: 'Events', icon: CalendarIcon }
                            ].map(({ id, label, icon: Icon }) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === id}
                                    onClick={() => handleTabChange(id)}
                                    className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                                        activeTab === id
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-gray-600 hover:bg-white/70 hover:text-gray-900'
                                    }`}
                                >
                                    <Icon size={16} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* View Mode Setup: Both Cards and List page setup in the right top corner */}
                    {(activeTab === 'announcements' || activeTab === 'events') && (
                        <div className="bg-background p-1 rounded-xl flex items-center border border-border shadow-2xs">
                            <button
                                type="button"
                                onClick={() => setViewMode('cards')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'cards'
                                        ? 'bg-surface text-primary shadow-xs'
                                        : 'text-muted-text hover:text-main'
                                }`}
                                title="Cards View"
                            >
                                <LayoutGrid size={15} />
                                <span className="hidden sm:inline">Cards View</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    viewMode === 'list'
                                        ? 'bg-surface text-primary shadow-xs'
                                        : 'text-muted-text hover:text-main'
                                }`}
                                title="List View"
                            >
                                <List size={15} />
                                <span className="hidden sm:inline">List View</span>
                            </button>
                        </div>
                    )}

                    {activeTab !== 'sms' && (
                        <button
                            onClick={() => openCreateModal(activeTab, activeTab === 'events' ? 'event' : null)}
                            className="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-primary/20 hover:shadow-primary/40 transform transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={18} strokeWidth={3} />
                            {activeTab === 'polls' ? 'Create New Poll' : activeTab === 'events' ? 'Create New Event' : 'Create New Announcement'}
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-surface rounded-b-2xl shadow-sm border border-border border-t-0 p-6 min-h-[400px]">
                {fetchingFeed && announcements.length === 0 && (activeTab === 'announcements' || activeTab === 'events') && <AnnouncementSkeleton />}
                {fetchingFeed && activeTab === 'polls' && <PollSkeleton />}
                {fetchingFeed && activeTab === 'sms' && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-primary" />
                    </div>
                )}

                {/* SMS View */}
                {activeTab === 'sms' && (
                    <div className="space-y-6">
                        {/* SMS Sub-tabs */}
                        <div className="flex gap-2 sm:gap-4 border-b pb-4 overflow-x-auto">
                            <button
                                onClick={() => setSmsMode('broadcast')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'broadcast' ? 'bg-[var(--primary-light)] text-primary font-bold' : 'text-sub hover:bg-background'}`}
                            >
                                <Send size={16} /> Send Broadcast
                            </button>
                            <button
                                onClick={() => setSmsMode('templates')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'templates' ? 'bg-[var(--primary-light)] text-primary font-bold' : 'text-sub hover:bg-background'}`}
                            >
                                <LayoutTemplate size={16} /> Manage Templates
                            </button>
                            <button
                                onClick={() => {
                                    setSmsMode('history');
                                    fetchSmsHistory();
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'history' ? 'bg-[var(--primary-light)] text-primary font-bold' : 'text-sub hover:bg-background'}`}
                            >
                                <History size={16} /> SMS Sent Till Date
                            </button>
                        </div>

                        {smsMode === 'templates' ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-main">SMS Templates</h3>
                                    <button
                                        onClick={() => openTemplateModal()}
                                        className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Create Template
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {smsTemplates.map(template => (
                                        <div key={template.id} className="bg-surface border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-main">{template.name}</h4>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openTemplateModal(template)} className="p-1.5 hover:bg-[var(--primary-light)] text-primary rounded"><Pencil size={14} /></button>
                                                    <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 hover:bg-[var(--danger-light)] text-danger rounded"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-muted-text mb-2 font-mono bg-background p-1 rounded w-fit">ID: {template.template_id}</div>
                                            <p className="text-sm text-sub line-clamp-3">{template.content}</p>
                                        </div>
                                    ))}
                                    {smsTemplates.length === 0 && (
                                        <div className="col-span-full text-center py-10 text-muted-text">No templates found. Create one to get started.</div>
                                    )}
                                </div>
                            </div>
                        ) : smsMode === 'history' ? (
                            <div className="space-y-6">
                                {/* KPI Summary Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-br from-[var(--primary-light)] to-surface p-5 rounded-2xl border border-[var(--primary-light)] shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary">
                                            <Smartphone size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-primary uppercase tracking-wider">SMS Sent Till Date</div>
                                            <div className="text-2xl font-black text-main mt-0.5">
                                                {Number(smsHistory?.summary?.total_sent_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-muted-text mt-0.5">All-time broadcast volume</div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-[var(--success-light)] to-surface p-5 rounded-2xl border border-[var(--success-light)] shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-success text-white flex items-center justify-center shrink-0 shadow-md shadow-success">
                                            <CheckCircle2 size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-success uppercase tracking-wider">Delivered</div>
                                            <div className="text-2xl font-black text-success mt-0.5">
                                                {Number(smsHistory?.summary?.sent_count_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-success mt-0.5">
                                                {smsHistory?.summary?.total_sent_all_time > 0
                                                    ? `${((smsHistory.summary.sent_count_all_time / smsHistory.summary.total_sent_all_time) * 100).toFixed(1)}% success rate`
                                                    : '100% success rate'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-[var(--danger-light)] to-surface p-5 rounded-2xl border border-[var(--danger-light)] shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 shadow-md shadow-danger">
                                            <XCircle size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-danger uppercase tracking-wider">Failed / Undelivered</div>
                                            <div className="text-2xl font-black text-danger mt-0.5">
                                                {Number(smsHistory?.summary?.failed_count_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-danger mt-0.5">
                                                {smsHistory?.summary?.total_sent_all_time > 0
                                                    ? `${((smsHistory.summary.failed_count_all_time / smsHistory.summary.total_sent_all_time) * 100).toFixed(1)}% failure rate`
                                                    : '0% failure rate'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-[var(--primary-light)] to-surface p-5 rounded-2xl border border-[var(--primary-light)] shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary">
                                            <LayoutTemplate size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-primary uppercase tracking-wider">Templates Used</div>
                                            <div className="text-2xl font-black text-primary mt-0.5">
                                                {smsHistory?.summary?.templates_used_all_time || 0}
                                            </div>
                                            <div className="text-[11px] text-muted-text mt-0.5">Registered DLT templates</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Template Quick Stats Pills */}
                                {smsHistory?.perTemplate && smsHistory.perTemplate.length > 0 && (
                                    <div className="bg-[var(--background)]/70 border border-border rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-sub uppercase tracking-wider flex items-center gap-1.5">
                                                <LayoutTemplate size={14} className="text-primary" />
                                                SMS Sent Till Date by Template
                                            </span>
                                            <span className="text-xs text-muted-text font-medium">
                                                Click a template to filter actions
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {smsHistory.perTemplate.map(pt => {
                                                const isSelected = String(historyFilters.template_id) === String(pt.template_id);
                                                return (
                                                    <button
                                                        key={pt.template_id}
                                                        type="button"
                                                        onClick={() => handleHistoryFilterChange('template_id', isSelected ? '' : pt.template_id)}
                                                        className={`p-3 rounded-xl border text-left transition-all ${
                                                            isSelected
                                                                ? 'bg-[var(--primary-light)] border-primary ring-2 ring-[var(--primary-light)] shadow-sm'
                                                                : 'bg-surface border-border hover:border-[var(--primary-light)] hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-1 mb-1">
                                                            <span className="font-semibold text-xs text-main truncate" title={pt.template_name}>
                                                                {pt.template_name}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded-full shrink-0">
                                                                {Number(pt.total_sent).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px] text-muted-text font-mono">
                                                            <span>ID: {pt.template_id}</span>
                                                            <span className="text-success font-medium font-sans">
                                                                {Number(pt.sent_count).toLocaleString()} sent
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Filter and Search Bar */}
                                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
                                        <div className="flex items-center gap-2">
                                            <Filter size={16} className="text-primary" />
                                            <span className="text-sm font-bold text-main">Filter Sent History</span>
                                        </div>
                                        {(historyFilters.date_from || historyFilters.date_to || historyFilters.template_id || historyFilters.search) && (
                                            <button
                                                type="button"
                                                onClick={handleResetHistoryFilters}
                                                className="text-xs font-semibold text-danger hover:text-danger hover:bg-[var(--danger-light)] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <RotateCcw size={12} /> Clear Filters
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-sub uppercase mb-1">Date From</label>
                                            <input
                                                type="date"
                                                value={historyFilters.date_from}
                                                onChange={(e) => handleHistoryFilterChange('date_from', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-border rounded-xl bg-background hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-sub uppercase mb-1">Date To</label>
                                            <input
                                                type="date"
                                                value={historyFilters.date_to}
                                                onChange={(e) => handleHistoryFilterChange('date_to', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-border rounded-xl bg-background hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-sub uppercase mb-1">Filter by Template</label>
                                            <select
                                                value={historyFilters.template_id}
                                                onChange={(e) => handleHistoryFilterChange('template_id', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-border rounded-xl bg-background hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                                            >
                                                <option value="">All Templates</option>
                                                {smsTemplates.map(t => (
                                                    <option key={t.id} value={t.template_id}>
                                                        {t.name} ({t.template_id})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-sub uppercase mb-1">Search Keywords</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    placeholder="Template name, ID or text..."
                                                    value={historyFilters.search}
                                                    onChange={(e) => setHistoryFilters(prev => ({ ...prev, search: e.target.value }))}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleHistoryFilterChange('search', historyFilters.search);
                                                        }
                                                    }}
                                                    className="w-full text-xs p-2.5 pl-8 border border-border rounded-xl bg-background hover:bg-surface focus:bg-surface focus:ring-2 focus:ring-primary outline-none"
                                                />
                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action-wise Sent History Table */}
                                <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-2 bg-[var(--background)]/50">
                                        <div className="flex items-center gap-2">
                                            <History size={16} className="text-primary" />
                                            <h3 className="font-bold text-main text-sm">SMS Sent History by Action</h3>
                                            <span className="text-xs text-muted-text font-medium">
                                                ({smsHistory?.pagination?.total || 0} broadcast actions)
                                            </span>
                                        </div>
                                        {historyLoading && (
                                            <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                                                <Loader2 size={14} className="animate-spin" /> Loading…
                                            </div>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-[var(--background)]/80 text-[11px] uppercase tracking-wider font-bold text-muted-text border-b border-border">
                                                    <th className="py-3 px-4">Date & Time</th>
                                                    <th className="py-3 px-4">Template Used</th>
                                                    <th className="py-3 px-4">Count / Recipients</th>
                                                    <th className="py-3 px-4">Sent By</th>
                                                    <th className="py-3 px-4">Sample Message</th>
                                                    <th className="py-3 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border text-xs">
                                                {smsHistory?.history && smsHistory.history.length > 0 ? (
                                                    smsHistory.history.map((row, idx) => (
                                                        <tr key={`${row.action_date}-${row.template_id}-${idx}`} className="hover:bg-[var(--primary-light)] transition-colors">
                                                            {/* Date & Time */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <div className="font-bold text-main flex items-center gap-1.5">
                                                                    <Calendar size={13} className="text-primary" />
                                                                    {(row.first_sent_at || row.last_sent_at || row.action_date) ? new Date(row.first_sent_at || row.last_sent_at || row.action_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                                </div>
                                                                <div className="text-[11px] text-muted-text mt-0.5 pl-4">
                                                                    {row.last_sent_at ? new Date(row.last_sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                                                                </div>
                                                            </td>

                                                            {/* Template Used */}
                                                            <td className="py-3 px-4">
                                                                <div className="font-bold text-main">{row.template_name || 'Direct / Custom Template'}</div>
                                                                <div className="text-[10px] text-muted-text font-mono mt-0.5 bg-background px-1.5 py-0.5 rounded w-fit">
                                                                    DLT ID: {row.template_id || 'N/A'}
                                                                </div>
                                                            </td>

                                                            {/* Count / Recipients */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-main text-sm">
                                                                        {Number(row.total_count || 0).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-[10px] text-muted-text font-medium">total</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-semibold text-success bg-[var(--success-light)] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                        <CheckCircle2 size={10} /> {Number(row.sent_count || 0).toLocaleString()}
                                                                    </span>
                                                                    {Number(row.failed_count || 0) > 0 && (
                                                                        <span className="text-[10px] font-semibold text-danger bg-[var(--danger-light)] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                            <XCircle size={10} /> {Number(row.failed_count || 0).toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Sent By */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <span className="inline-block px-2 py-1 rounded-lg text-[11px] font-medium bg-background text-sub">
                                                                    {row.sent_by || 'System Generated'}
                                                                </span>
                                                            </td>

                                                            {/* Sample Message Preview */}
                                                            <td className="py-3 px-4 max-w-xs">
                                                                <p className="text-sub text-xs line-clamp-2 font-mono bg-background p-1.5 rounded-lg border border-border">
                                                                    {row.sample_message || 'No content preview available'}
                                                                </p>
                                                            </td>

                                                            {/* Action */}
                                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedHistoryItem(row)}
                                                                    className="px-3 py-1.5 bg-[var(--primary-light)] hover:bg-[var(--primary-light)] text-primary font-semibold rounded-lg text-xs transition-colors"
                                                                >
                                                                    View Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-12 text-muted-text">
                                                            <div className="flex flex-col items-center justify-center gap-2">
                                                                <History size={32} className="text-muted-text" />
                                                                <p className="text-sm font-medium text-muted-text">No SMS broadcast records found matching criteria.</p>
                                                                {(historyFilters.date_from || historyFilters.date_to || historyFilters.template_id || historyFilters.search) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleResetHistoryFilters}
                                                                        className="text-xs text-primary hover:underline mt-1 font-semibold"
                                                                    >
                                                                        Clear filters and view all
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {smsHistory?.pagination && smsHistory.pagination.totalPages > 1 && (
                                        <div className="p-4 border-t border-border flex items-center justify-between flex-wrap gap-3 bg-[var(--background)]/50">
                                            <div className="text-xs text-muted-text">
                                                Showing Page <strong className="text-main">{smsHistory.pagination.page}</strong> of{' '}
                                                <strong className="text-main">{smsHistory.pagination.totalPages}</strong> ({smsHistory.pagination.total} total actions)
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={smsHistory.pagination.page <= 1 || historyLoading}
                                                    onClick={() => handleHistoryPageChange(smsHistory.pagination.page - 1)}
                                                    className="px-3 py-1.5 border border-border bg-surface rounded-lg text-xs font-semibold text-sub hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                                                >
                                                    <ChevronLeft size={14} /> Previous
                                                </button>
                                                <div className="text-xs font-bold text-sub px-2">
                                                    {smsHistory.pagination.page} / {smsHistory.pagination.totalPages}
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={smsHistory.pagination.page >= smsHistory.pagination.totalPages || historyLoading}
                                                    onClick={() => handleHistoryPageChange(smsHistory.pagination.page + 1)}
                                                    className="px-3 py-1.5 border border-border bg-surface rounded-lg text-xs font-semibold text-sub hover:bg-background disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                                                >
                                                    Next <ChevronRight size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-full">
                                <form onSubmit={handleSendBroadcast} className="block w-full">
                                    <div className="bg-surface p-6 rounded-2xl shadow-sm border border-border flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full">
                                            {/* Left Column: Template Selection & Preview */}
                                            <div className="lg:col-span-5 space-y-6 border-r border-border pr-8 overflow-y-auto scrollbar-hide">
                                                <h3 className="text-lg font-bold text-main mb-4 flex items-center gap-2 sticky top-0 bg-surface z-10 py-2">
                                                    <LayoutTemplate className="text-primary" size={20} />
                                                    Template Configuration
                                                </h3>

                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-semibold text-sub mb-2">Select Template</label>
                                                        <div className="relative">
                                                            <select
                                                                className="w-full p-3 pl-4 pr-10 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent bg-background hover:bg-surface transition-all appearance-none cursor-pointer text-sub font-medium shadow-sm"
                                                                value={selectedTemplate?.id || ''}
                                                                onChange={handleTemplateSelect}
                                                            >
                                                                <option value="">-- Choose a Template --</option>
                                                                {smsTemplates.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name} ({t.template_id})</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-text">
                                                                <ChevronDown size={18} />
                                                            </div>
                                                        </div>

                                                        {/* Selected Template Sent Till Date Info */}
                                                        {selectedTemplate && (() => {
                                                            const tmplStats = smsHistory?.perTemplate?.find(t => String(t.template_id) === String(selectedTemplate.template_id));
                                                            if (!tmplStats) return null;
                                                            return (
                                                                <div className="bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl p-2.5 text-xs text-primary flex items-center justify-between mt-2">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full bg-success shrink-0"></span>
                                                                        <span>Sent till date: <strong className="font-bold">{Number(tmplStats.total_sent).toLocaleString()}</strong> SMS</span>
                                                                        <span className="text-primary">({Number(tmplStats.sent_count).toLocaleString()} sent{tmplStats.failed_count > 0 ? `, ${tmplStats.failed_count} failed` : ''})</span>
                                                                    </div>
                                                                    {tmplStats.last_used_at && (
                                                                        <span className="text-[10px] text-primary font-medium">Last used: {new Date(tmplStats.last_used_at).toLocaleDateString()}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        <div className="flex justify-end mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSmsMode('templates')}
                                                                className="text-xs font-semibold text-primary hover:text-primary hover:underline flex items-center gap-1 transition-colors"
                                                            >
                                                                <Settings size={12} /> Manage Templates
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {selectedTemplate && (
                                                        <div className="animate-fade-in space-y-4">
                                                            {/* Send-time variable values (editable; defaults from template) */}
                                                            {formData.variable_mappings.length > 0 ? (
                                                                <div className="bg-[var(--warning-light)] p-5 rounded-xl border border-[var(--warning-light)]">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Settings size={14} className="text-warning" />
                                                                        <label className="text-xs font-bold text-warning uppercase">Set Variable Values Before Sending</label>
                                                                    </div>
                                                                    <p className="text-xs text-warning mb-3">
                                                                        Defaults from the template are pre-filled. Change them here for this broadcast only — enter a static value or pick a student field.
                                                                    </p>
                                                                    <div className="space-y-3">
                                                                        {formData.variable_mappings.map((mapping, idx) => (
                                                                            <div key={idx} className="flex flex-wrap gap-2 items-center bg-surface p-2.5 rounded-lg border border-[var(--warning-light)] shadow-sm">
                                                                                <span className="bg-[var(--primary-light)] text-primary px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0">var#{idx + 1}</span>
                                                                                <select
                                                                                    className="p-1.5 border rounded-lg text-xs bg-surface min-w-[90px]"
                                                                                    value={mapping.type || 'static'}
                                                                                    onChange={(e) => handleMappingChange(idx, 'type', e.target.value)}
                                                                                >
                                                                                    <option value="static">Static (enter now)</option>
                                                                                    <option value="field">Student field</option>
                                                                                </select>
                                                                                {mapping.type === 'field' ? (
                                                                                    <select
                                                                                        className="flex-1 min-w-[140px] p-1.5 border rounded-lg text-xs bg-surface"
                                                                                        value={mapping.value || ''}
                                                                                        onChange={(e) => handleMappingChange(idx, 'value', e.target.value)}
                                                                                    >
                                                                                        <option value="">Select field...</option>
                                                                                        {studentFields.map(f => (
                                                                                            <option key={`${f.label}-${f.value}`} value={f.value}>{f.label}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                ) : (
                                                                                    <input
                                                                                        type="text"
                                                                                        className="flex-1 min-w-[140px] p-1.5 border rounded-lg text-xs"
                                                                                        placeholder="Enter value for this SMS..."
                                                                                        value={mapping.value || ''}
                                                                                        onChange={(e) => handleMappingChange(idx, 'value', e.target.value)}
                                                                                    />
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-text bg-background border rounded-lg p-3">
                                                                    This template has no {'{#var#}'} placeholders — message will send as-is.
                                                                </p>
                                                            )}

                                                            {/* Message Preview */}
                                                            <div>
                                                                <label className="block text-xs font-bold text-muted-text uppercase tracking-wider mb-2">Message Preview</label>
                                                                <div className="bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary-light)] p-4 rounded-2xl rounded-tr-none border border-[var(--primary-light)] shadow-sm relative">
                                                                    <div className="absolute -right-2 -top-2 bg-primary text-white p-1 rounded-full shadow-md">
                                                                        <MessageSquare size={12} />
                                                                    </div>
                                                                    <p className="text-sm text-main whitespace-pre-wrap leading-relaxed font-medium">
                                                                        {getSendTimePreview()}
                                                                    </p>
                                                                    <div className="mt-2 flex justify-end">
                                                                        <span className="text-[10px] text-muted-text font-medium uppercase">SMS Preview</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Column: Audience & Action */}
                                            <div className="lg:col-span-7 flex flex-col h-full pl-4 overflow-hidden">
                                                <div className="flex-1 min-h-0 flex flex-col pt-2">
                                                    <TargetSelector formData={formData} setFormData={setFormData} hideTitle={true} isSms={true} />
                                                </div>

                                                {/* On-Page Mobile Target Selection */}
                                                <div className="mt-3 p-3.5 bg-background border border-border rounded-2xl shrink-0 space-y-2.5">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Smartphone size={16} className="text-primary" />
                                                            <span className="text-xs font-bold text-main uppercase tracking-wider">
                                                                Send SMS To (Recipient Numbers)
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedMobileTargets(['student_mobile', 'parent_mobile1'])}
                                                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                                                    selectedMobileTargets.includes('student_mobile') && selectedMobileTargets.includes('parent_mobile1')
                                                                        ? 'bg-primary text-white border-primary shadow-2xs'
                                                                        : 'bg-surface text-sub hover:bg-background border-border'
                                                                }`}
                                                            >
                                                                Both at a time
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedMobileTargets(['parent_mobile1'])}
                                                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                                                    selectedMobileTargets.length === 1 && selectedMobileTargets.includes('parent_mobile1')
                                                                        ? 'bg-primary text-white border-primary shadow-2xs'
                                                                        : 'bg-surface text-sub hover:bg-background border-border'
                                                                }`}
                                                            >
                                                                Parent Preferred Only
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedMobileTargets(['student_mobile'])}
                                                                className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                                                    selectedMobileTargets.length === 1 && selectedMobileTargets.includes('student_mobile')
                                                                        ? 'bg-primary text-white border-primary shadow-2xs'
                                                                        : 'bg-surface text-sub hover:bg-background border-border'
                                                                }`}
                                                            >
                                                                Student Only
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                        {[
                                                            { key: 'student_mobile', label: 'Student Mobile', desc: 'Send to student' },
                                                            { key: 'parent_mobile1', label: 'Parent Preferred Number', desc: 'Primary parent contact' },
                                                            { key: 'parent_mobile2', label: 'Parent Alternate Number', desc: 'Secondary parent contact' }
                                                        ].map(target => {
                                                            const isChecked = selectedMobileTargets.includes(target.key);
                                                            return (
                                                                <label
                                                                    key={target.key}
                                                                    className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                                                                        isChecked
                                                                            ? 'bg-[var(--primary-light)] border-[var(--primary-light)] ring-1 ring-[var(--primary-light)] shadow-2xs'
                                                                            : 'bg-surface border-border hover:bg-background'
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => toggleMobileTarget(target.key)}
                                                                        className="mt-0.5 h-4 w-4 text-primary rounded border-border-strong focus:ring-primary"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <span className="text-xs font-bold text-main block truncate leading-tight">
                                                                            {target.label}
                                                                        </span>
                                                                        <span className="text-[10px] text-muted-text block truncate">
                                                                            {target.desc}
                                                                        </span>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="mt-auto pt-4 border-t border-border bg-surface">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-sm text-muted-text">
                                                            <p className="font-medium text-sub">Ready to broadcast?</p>
                                                            <p className="text-xs">
                                                                {!selectedTemplate
                                                                    ? 'Select a template first'
                                                                    : fetchingCount
                                                                        ? 'Estimate: counting…'
                                                                        : `Estimate: ${audienceCount ?? 0} students (${selectedMobileTargets.length > 0 ? selectedMobileTargets.map(t => t === 'student_mobile' ? 'Student' : t === 'parent_mobile1' ? 'Parent Preferred' : 'Parent Alternate').join(' + ') : 'No recipient selected'})`}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={loading || !selectedTemplate || selectedMobileTargets.length === 0}
                                                            className="bg-gradient-to-r from-success to-success text-white px-8 py-3.5 rounded-xl font-bold hover:from-success hover:to-success flex items-center gap-3 shadow-lg hover:shadow-success/30 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none min-w-[200px] justify-center"
                                                        >
                                                            {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                                                            <span>Send Broadcast</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}
                    </div>
                )}


                {
                    activeTab === 'announcements'
                    && (!fetchingFeed || visibleAnnouncements.length > 0) && (
                        viewMode === 'cards' ? (
                            /* ================= CARDS VIEW (GRID) ================= */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {visibleAnnouncements.map(ann => {
                                    const type = (ann.announcement_type || 'announcement').toLowerCase();
                                    const ach = ann.achievement_data || {};

                                    return (
                                        <div
                                            key={ann.id}
                                            onClick={() => handleOpenAnnouncementDetails(ann)}
                                            className={`bg-surface rounded-2xl shadow-sm border p-4 group hover:shadow-lg hover:border-[var(--primary-light)] transition-all cursor-pointer flex flex-col justify-between ${!ann.is_active ? 'opacity-75 grayscale' : ''} ${type === 'achievement' ? 'border-[var(--warning-light)] bg-gradient-to-b from-[var(--warning-light)] to-surface' : ''}`}
                                        >
                                            <div>
                                                {/* Card Header & Type Badge */}
                                                <div className="flex justify-between items-start mb-2 gap-2">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {type === 'circular' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                <FileText size={11} /> Circular
                                                            </span>
                                                        ) : type === 'event' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--primary-light)] text-secondary border border-[var(--primary-light)]">
                                                                <Calendar size={11} /> Event
                                                            </span>
                                                        ) : type === 'poll' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                <BarChart2 size={11} /> Poll
                                                            </span>
                                                        ) : type === 'achievement' ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] shadow-2xs">
                                                                <Trophy size={11} className="text-warning" /> Leaderboard
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                                                <Megaphone size={11} /> Notice
                                                            </span>
                                                        )}

                                                        {type === 'achievement' && ach.rank_title && (
                                                            <span className="text-[10px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] px-2 py-0.5 rounded-full">
                                                                {ach.rank_title}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleStatus(ann.id, ann.is_active, 'announcements'); }}
                                                            className="p-1.5 hover:bg-background rounded text-muted-text"
                                                            title={ann.is_active ? 'Active (Click to hide)' : 'Hidden (Click to show)'}
                                                        >
                                                            {ann.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openEditModal(ann, 'announcements'); }}
                                                            className="p-1.5 hover:bg-[var(--primary-light)] text-primary rounded"
                                                            title="Edit announcement"
                                                        >
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(ann.id, 'announcements'); }}
                                                            className="p-1.5 hover:bg-[var(--danger-light)] text-danger rounded"
                                                            title="Delete announcement"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Headline / Subject Line */}
                                                <h4 className="font-extrabold text-main line-clamp-2 group-hover:text-primary transition-colors mb-2">
                                                    {type === 'circular' && <span className="text-danger mr-1 font-mono text-xs uppercase">Sub:</span>}
                                                    {ann.title}
                                                </h4>

                                                {/* Type 1: Circular Card Body (PDF Attachment Box) */}
                                                {type === 'circular' && (
                                                    <div className="mb-3 p-3 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-xl space-y-3">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-10 h-10 rounded-lg bg-danger text-white flex items-center justify-center shrink-0 shadow-xs">
                                                                <FileText size={20} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-main truncate">
                                                                    {Object.values(parseCircularNumbers(ann.circular_numbers)).join(' · ') || ann.file_name || 'Circular PDF'}
                                                                </p>
                                                                <span className="text-[10px] text-danger font-bold uppercase tracking-wider block">College-wise numbered PDF</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {Object.entries(parseCircularNumbers(ann.circular_numbers)).map(([college, number]) => (
                                                                <button
                                                                    key={college}
                                                                    type="button"
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        handleCircularDownload(ann, college);
                                                                    }}
                                                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
                                                                >
                                                                    <FileDown size={13} /> Download {college}
                                                                </button>
                                                            ))}
                                                        {ann.file_url && (
                                                            <a
                                                                href={ann.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="px-3 py-1.5 bg-surface border border-[var(--danger-light)] hover:bg-[var(--danger-light)] text-danger rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 transition-colors"
                                                            >
                                                                <ExternalLink size={13} /> Attachment
                                                            </a>
                                                        )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Type 2: Event Details Banner */}
                                                {type === 'event' && (ann.event_date || ann.event_venue) && (
                                                    <div className="mb-3 p-2.5 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl space-y-1 text-xs">
                                                        {ann.event_date && (
                                                            <div className="flex items-center gap-1.5 font-bold text-secondary">
                                                                <Calendar size={13} className="text-secondary shrink-0" />
                                                                <span>{ann.event_date} {ann.event_time ? `(${ann.event_time})` : ''}</span>
                                                            </div>
                                                        )}
                                                        {ann.event_venue && (
                                                            <div className="flex items-center gap-1.5 text-secondary font-medium">
                                                                <MapPin size={13} className="text-secondary shrink-0" />
                                                                <span className="truncate">{ann.event_venue}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Type 3: Poll Live Options Preview */}
                                                {type === 'poll' && Array.isArray(ann.poll_options) && ann.poll_options.length > 0 && (
                                                    <div className="mb-3 space-y-2 p-3 bg-[var(--success-light)] border border-[var(--success-light)] rounded-xl">
                                                        <div className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center justify-between">
                                                            <span>Poll Options</span>
                                                            <span>{ann.total_votes || 0} Total Votes</span>
                                                        </div>
                                                        {ann.poll_options.slice(0, 3).map((opt, optIdx) => {
                                                            const count = ann.poll_vote_counts?.[optIdx] || 0;
                                                            const total = ann.total_votes || 1;
                                                            const percent = ann.total_votes ? Math.round((count / total) * 100) : 0;
                                                            return (
                                                                <div key={optIdx} className="text-xs">
                                                                    <div className="flex justify-between text-[11px] mb-0.5 text-sub">
                                                                        <span className="font-semibold truncate pr-2">{opt}</span>
                                                                        <span className="font-mono text-muted-text shrink-0">{count} ({percent}%)</span>
                                                                    </div>
                                                                    <div className="h-1.5 w-full bg-[var(--success-light)] rounded-full overflow-hidden">
                                                                        <div className="h-full bg-success rounded-full" style={{ width: `${percent}%` }}></div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        {ann.poll_options.length > 3 && (
                                                            <span className="text-[10px] text-muted-text font-medium">+{ann.poll_options.length - 3} more options</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Type 5: Student Achievement Leader Board Card */}
                                                {type === 'achievement' && (
                                                    <div className="mb-3 p-3.5 bg-gradient-to-r from-[var(--warning-light)] to-[var(--warning-light)] border border-[var(--warning-light)] rounded-2xl flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-warning shadow-md bg-surface">
                                                                {ach.student_photo || ann.image_url ? (
                                                                    <img
                                                                        src={ach.student_photo || ann.image_url}
                                                                        alt={ach.student_name || 'Topper'}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center bg-[var(--warning-light)] text-warning">
                                                                        <User size={24} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-warning text-white flex items-center justify-center shadow-xs">
                                                                <Trophy size={11} />
                                                            </div>
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <h5 className="font-black text-main text-sm truncate leading-tight">
                                                                {ach.student_name || 'Student Topper'}
                                                            </h5>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                {ach.branch && (
                                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--primary-light)] text-primary">
                                                                        {ach.branch}
                                                                    </span>
                                                                )}
                                                                {ach.year_sem && (
                                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--primary-light)] text-secondary">
                                                                        {ach.year_sem}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ach.topper_prize && (
                                                                <span className="text-[11px] font-black text-warning block mt-1">
                                                                    🏆 {ach.topper_prize}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Registration Status Pill if enabled */}
                                                {ann.requires_registration ? (
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                                            <Ticket size={12} className="text-primary" />
                                                            <span>{ann.registered_count || 0}{ann.max_seats ? `/${ann.max_seats}` : ''} Registered</span>
                                                        </span>
                                                        {ann.is_full ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--danger-light)] text-danger uppercase tracking-wider">Seats Full</span>
                                                        ) : ann.max_seats ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--success-light)] text-success">
                                                                {ann.available_seats} seats left
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                ) : null}

                                                {/* Image Banner (for Standard Announcement, Events without custom poster, etc.) */}
                                                {type !== 'circular' && type !== 'achievement' && ann.image_url && (
                                                    <AnnouncementImage src={ann.image_url} alt={ann.title} />
                                                )}

                                                {/* Text Content */}
                                                {ann.content && (
                                                    <p className="text-sm text-muted-text mb-3 line-clamp-2">{ann.content}</p>
                                                )}
                                            </div>

                                            <div>
                                                <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
                                                    <div className="flex items-center gap-1.5 font-medium">
                                                        <Clock size={12} className={ann.expires_at && new Date(ann.expires_at) < new Date() ? 'text-danger' : 'text-primary'} />
                                                        {ann.expires_at ? (
                                                            new Date(ann.expires_at) < new Date() ? (
                                                                <span className="text-danger font-bold bg-[var(--danger-light)] px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">Expired</span>
                                                            ) : (
                                                                <span className="text-primary font-semibold">Expires {new Date(ann.expires_at).toLocaleDateString()}</span>
                                                            )
                                                        ) : (
                                                            <span className="text-muted-text">No Time Limit</span>
                                                        )}
                                                    </div>
                                                    {ann.audience_count > 0 && (
                                                        <span className="text-[10px] bg-background text-sub px-2 py-0.5 rounded font-bold">{ann.audience_count} Reach</span>
                                                    )}
                                                </div>
                                                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs text-primary font-semibold group-hover:translate-x-0.5 transition-transform">
                                                    <span>{ann.requires_registration ? 'View Registered Candidates' : 'Click to View Details'}</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {visibleAnnouncements.length === 0 && !fetchingFeed && (
                                    <div className="col-span-full text-center py-10 text-muted-text">
                                        {activeTab === 'events' ? 'No events found.' : 'No announcements found.'}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ================= LIST VIEW (TABLE SETUP) ================= */
                            <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-[var(--background)]/80 border-b border-border text-muted-text font-bold uppercase tracking-wider text-[11px]">
                                                <th className="py-3.5 px-4">Type</th>
                                                <th className="py-3.5 px-4">Headline / Subject / Topper</th>
                                                <th className="py-3.5 px-4">Key Details & Attachments</th>
                                                <th className="py-3.5 px-4">Audience Reach</th>
                                                <th className="py-3.5 px-4">Expiry / Date</th>
                                                <th className="py-3.5 px-4">Status</th>
                                                <th className="py-3.5 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {visibleAnnouncements.map(ann => {
                                                const type = (ann.announcement_type || 'announcement').toLowerCase();
                                                const ach = ann.achievement_data || {};

                                                return (
                                                    <tr
                                                        key={ann.id}
                                                        onClick={() => handleOpenAnnouncementDetails(ann)}
                                                        className="hover:bg-[var(--primary-light)] transition-colors cursor-pointer group"
                                                    >
                                                        {/* Type Badge */}
                                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                                            {type === 'circular' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                    <FileText size={11} /> Circular
                                                                </span>
                                                            ) : type === 'event' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[var(--primary-light)] text-secondary border border-[var(--primary-light)]">
                                                                    <Calendar size={11} /> Event
                                                                </span>
                                                            ) : type === 'poll' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                    <BarChart2 size={11} /> Poll
                                                                </span>
                                                            ) : type === 'achievement' ? (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                                                    <Trophy size={11} /> Leaderboard
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                                                    <Megaphone size={11} /> Notice
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Title / Subject / Headline */}
                                                        <td className="py-3.5 px-4 max-w-xs">
                                                            <div className="font-extrabold text-main group-hover:text-primary transition-colors line-clamp-1">
                                                                {ann.title}
                                                            </div>
                                                            {type === 'achievement' && ach.student_name && (
                                                                <div className="text-[11px] font-bold text-warning flex items-center gap-1 mt-0.5">
                                                                    <span>Topper:</span> <strong>{ach.student_name}</strong> ({ach.branch || ''} {ach.year_sem ? `· ${ach.year_sem}` : ''})
                                                                </div>
                                                            )}
                                                            {ann.content && type !== 'achievement' && (
                                                                <p className="text-[11px] text-muted-text line-clamp-1 mt-0.5">{ann.content}</p>
                                                            )}
                                                        </td>

                                                        {/* Key Details & Attachments */}
                                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                                            {type === 'circular' ? (
                                                                ann.file_url ? (
                                                                    <a
                                                                        href={ann.file_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--danger-light)] text-danger hover:bg-[var(--danger-light)] border border-[var(--danger-light)] font-bold text-[11px]"
                                                                    >
                                                                        <FileDown size={12} /> {ann.file_name || 'Download PDF'}
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-muted-text">PDF Attached</span>
                                                                )
                                                            ) : type === 'event' ? (
                                                                <div className="text-[11px] text-sub">
                                                                    <div className="font-semibold text-secondary">{ann.event_date || 'Date TBA'}</div>
                                                                    {ann.event_venue && <div className="text-muted-text text-[10px] truncate max-w-[150px]">{ann.event_venue}</div>}
                                                                </div>
                                                            ) : type === 'poll' ? (
                                                                <span className="font-semibold text-success bg-[var(--success-light)] px-2 py-0.5 rounded text-[11px]">
                                                                    {ann.total_votes || 0} votes · {(ann.poll_options || []).length} options
                                                                </span>
                                                            ) : type === 'achievement' ? (
                                                                <span className="font-bold text-warning bg-[var(--warning-light)] px-2 py-0.5 rounded text-[11px]">
                                                                    {ach.rank_title || 'Topper'} {ach.topper_prize ? `· ${ach.topper_prize}` : ''}
                                                                </span>
                                                            ) : (
                                                                ann.has_image ? <span className="text-primary font-medium">Image attached</span> : <span className="text-muted-text">—</span>
                                                            )}
                                                        </td>

                                                        {/* Audience Reach */}
                                                        <td className="py-3.5 px-4 whitespace-nowrap font-bold text-main">
                                                            {ann.audience_count ? `${Number(ann.audience_count).toLocaleString()} Students` : 'All Students'}
                                                        </td>

                                                        {/* Expiry / Date */}
                                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                                            <div className="text-sub font-medium">
                                                                {new Date(ann.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                            </div>
                                                            {ann.expires_at ? (
                                                                new Date(ann.expires_at) < new Date() ? (
                                                                    <span className="text-[10px] text-danger font-bold uppercase">Expired</span>
                                                                ) : (
                                                                    <span className="text-[10px] text-primary">Expires {new Date(ann.expires_at).toLocaleDateString()}</span>
                                                                )
                                                            ) : (
                                                                <span className="text-[10px] text-muted-text">No Expiry</span>
                                                            )}
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${ann.is_active ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]' : 'bg-background text-muted-text'}`}>
                                                                {ann.is_active ? 'Active' : 'Hidden'}
                                                            </span>
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                            <div className="flex items-center justify-end gap-1">
                                                                <button
                                                                    onClick={() => toggleStatus(ann.id, ann.is_active, 'announcements')}
                                                                    className="p-1.5 hover:bg-background rounded text-muted-text"
                                                                    title={ann.is_active ? 'Hide' : 'Show'}
                                                                >
                                                                    {ann.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => openEditModal(ann, 'announcements')}
                                                                    className="p-1.5 hover:bg-[var(--primary-light)] text-primary rounded"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil size={15} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDelete(ann.id, 'announcements')}
                                                                    className="p-1.5 hover:bg-[var(--danger-light)] text-danger rounded"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {visibleAnnouncements.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center py-10 text-muted-text">
                                                        {activeTab === 'events' ? 'No events found.' : 'No announcements found.'}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )
                    )
                }

                {/* Polls list */}
                {activeTab === 'polls' && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {polls.map(poll => (
                            <div key={poll.id} className={`bg-surface rounded-2xl shadow-sm border border-border p-6 group hover:shadow-md transition-all ${!poll.is_active ? 'opacity-75' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-main text-lg line-clamp-2">{poll.question}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] bg-[var(--primary-light)] text-primary px-2 py-0.5 rounded-full font-bold">
                                                {poll.audience_count || poll.stats?.assigned || 0} Students
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleStatus(poll.id, poll.is_active, 'polls')} className="p-1.5 hover:bg-background rounded-lg text-muted-text">
                                            {poll.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button onClick={() => openEditModal(poll, 'polls')} className="p-1.5 hover:bg-[var(--primary-light)] text-primary rounded-lg"><Pencil size={16} /></button>
                                        <button onClick={() => handleDelete(poll.id, 'polls')} className="p-1.5 hover:bg-[var(--danger-light)] text-danger rounded-lg"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                                <div className="mb-4 space-y-3">
                                    {(poll.options || []).map((opt, i) => {
                                        const count = poll.vote_counts?.[i] || 0;
                                        const total = poll.stats?.votes || 1;
                                        const percent = Math.round((count / total) * 100);
                                        return (
                                            <div key={i} className="text-sm">
                                                <div className="flex justify-between mb-1.5">
                                                    <span className="font-medium text-sub">{opt}</span>
                                                    <span className="text-muted-text font-bold text-[10px]">{count} votes ({percent}%)</span>
                                                </div>
                                                <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border">
                                                    <div className="h-full bg-gradient-to-r from-primary to-primary rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pt-4 border-t border-border flex items-center justify-between text-[10px] text-muted-text mt-6 pt-4">
                                    <div className="flex gap-4">
                                        <span className="flex items-center gap-1 font-semibold" title="Assigned Students"><Users size={12} /> {poll.stats?.assigned || 0}</span>
                                        <span className="flex items-center gap-1 font-semibold" title="Total Votes"><BarChart2 size={12} /> {poll.stats?.votes || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-background px-2 py-1 rounded-lg">
                                        <Clock size={12} className="text-warning" />
                                        {poll.end_time ? `Deadline: ${new Date(poll.end_time).toLocaleDateString()}` : 'No deadline'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'events' && (
                    <EventCalendar
                        isEmbedded={true}
                        announcementEvents={visibleAnnouncements}
                        onOpenAnnouncement={handleOpenAnnouncementDetails}
                        onEditAnnouncement={announcement => openEditModal(announcement, 'announcements')}
                        onToggleAnnouncement={announcement => toggleStatus(announcement.id, announcement.is_active, 'announcements')}
                        onDeleteAnnouncement={announcement => handleDelete(announcement.id, 'announcements')}
                    />
                )}
            </div >

            {/* General Modal (Announcements/Polls) */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-surface z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--primary-light)] flex items-center justify-center text-primary">
                                    {editId ? <Pencil size={24} /> : <PlusCircle size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-main">
                                            {editId ? 'Edit Announcement' : formStep === 0 ? 'Create Announcement' : `Create ${
                                                formData.announcement_type === 'circular' ? 'Circular' :
                                                formData.announcement_type === 'event' ? 'Event' :
                                                formData.announcement_type === 'poll' ? 'Poll' :
                                                formData.announcement_type === 'achievement' ? 'Student Achievement Leader board' :
                                                'Announcement'
                                            }`}
                                        </h2>
                                        {(activeTab === 'announcements' || activeTab === 'events') && formData.requires_registration && (
                                            <span className="text-xs bg-[var(--primary-light)] text-primary px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <Ticket size={12} /> Step {formStep} of 2
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-text">
                                        {formStep === 0
                                            ? 'Step 1: Select the announcement type'
                                            : formStep === 2 && formData.requires_registration
                                            ? 'Step 2: Configure Seat Capacity, Deadlines & Dynamic Registration Questions'
                                            : 'Configure announcement fields, media attachments, and audience reach'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Live Audience Indicator */}
                                <div className="hidden md:flex flex-col items-end px-4 py-2 bg-background rounded-2xl border border-border">
                                    <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Estimated Reach</span>
                                    <div className="flex items-center gap-2">
                                        {fetchingCount ? (
                                            <Loader2 size={12} className="animate-spin text-primary" />
                                        ) : (
                                            <Users size={12} className="text-primary" />
                                        )}
                                        <span className="text-sm font-black text-main">{audienceCount ?? '...'} Students</span>
                                    </div>
                                </div>
                                <button onClick={handleCancel} className="p-2 hover:bg-background rounded-full text-muted-text transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Stepper Navigation Bar when registrations are enabled */}
                        {(activeTab === 'announcements' || activeTab === 'events') && formData.requires_registration && (
                            <div className="px-6 py-2.5 bg-background border-b flex items-center gap-4 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setFormStep(1)}
                                    className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
                                        formStep === 1
                                            ? 'bg-primary text-white shadow-xs'
                                            : 'text-sub hover:bg-background'
                                    }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-[var(--surface)]/20 flex items-center justify-center text-[10px]">1</span>
                                    Announcement Details & Audience
                                </button>
                                <ChevronRight size={14} className="text-muted-text" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!formData.title?.trim() || !formData.content?.trim()) {
                                            return toast.error('Please enter Title and Content first');
                                        }
                                        setFormStep(2);
                                    }}
                                    className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
                                        formStep === 2
                                            ? 'bg-primary text-white shadow-xs'
                                            : 'text-sub hover:bg-background'
                                    }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-[var(--surface)]/20 flex items-center justify-center text-[10px]">2</span>
                                    Event Registration & Dynamic Form
                                </button>
                            </div>
                        )}

                        <div className="p-6 overflow-y-auto bg-[var(--background)]/30">
                            <form onSubmit={activeTab === 'polls' || formData.announcement_type === 'poll' ? handleSubmitPoll : handleSubmitAnnouncement} className="space-y-6">
                                {(activeTab === 'announcements' || activeTab === 'events') && formStep === 2 && formData.requires_registration ? (
                                    /* =================== STEP 2: DYNAMIC REGISTRATION FORM & SEATS =================== */
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Step 2 Banner */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-[var(--primary-light)] to-[var(--primary-light)] border border-[var(--primary-light)] rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black">2</div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-main">Configure Event Registration & Custom Questions</h3>
                                                    <p className="text-xs text-muted-text">Manage seat limits, registration deadline, and add custom fields for students to answer.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormStep(1)}
                                                className="text-xs font-semibold text-primary bg-surface hover:bg-[var(--primary-light)] px-3 py-1.5 rounded-xl border border-[var(--primary-light)] flex items-center gap-1 shadow-2xs self-start sm:self-auto transition-colors"
                                            >
                                                <ChevronLeft size={14} /> Back to Step 1
                                            </button>
                                        </div>

                                        {/* Seat Capacity & Registration Deadline */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-surface rounded-2xl border border-border shadow-xs">
                                            <div>
                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                    <Users size={14} className="text-primary" />
                                                    Seat Capacity (Max Seats)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Leave empty for Unlimited seats"
                                                    value={formData.max_seats}
                                                    onChange={(e) => setFormData({ ...formData, max_seats: e.target.value })}
                                                    className="w-full text-sm p-3 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary outline-none bg-surface font-medium"
                                                />
                                                <span className="text-[11px] text-muted-text mt-1 block">Maximum number of candidate registrations allowed.</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-primary" />
                                                    Registration Deadline
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.registration_deadline}
                                                    onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                                                    className="w-full text-sm p-3 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary outline-none bg-surface font-medium"
                                                />
                                                <span className="text-[11px] text-muted-text mt-1 block">Registration will automatically close after this date & time.</span>
                                            </div>
                                        </div>

                                        {/* Editable Default Student Profile Data Card */}
                                        <div className="p-5 bg-surface border border-border rounded-2xl shadow-xs space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-success shrink-0" />
                                                        <h4 className="text-sm font-bold text-main">Default Student Profile Fields</h4>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                            {(formData.default_profile_fields || INITIAL_DEFAULT_PROFILE_FIELDS).filter(f => f.enabled).length} of 7 Active
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-muted-text mt-0.5">
                                                        Pre-filled from the student profile. You can edit field labels, toggle required, or uncheck fields you don't need.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={resetDefaultFields}
                                                    className="text-xs font-semibold text-muted-text hover:text-primary flex items-center gap-1 self-start sm:self-auto transition-colors"
                                                    title="Reset to default labels and settings"
                                                >
                                                    <RotateCcw size={13} /> Reset Defaults
                                                </button>
                                            </div>

                                            {/* List of 7 default fields as editable items */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                {(formData.default_profile_fields || INITIAL_DEFAULT_PROFILE_FIELDS).map((field) => (
                                                    <div
                                                        key={field.key}
                                                        className={`p-3 rounded-xl border transition-all flex items-center gap-3 ${
                                                            field.enabled
                                                                ? 'bg-[var(--background)]/80 border-border shadow-2xs'
                                                                : 'bg-[var(--background)]/60 border-dashed border-border-strong opacity-60'
                                                        }`}
                                                    >
                                                        {/* Enable / Disable Checkbox */}
                                                        <input
                                                            type="checkbox"
                                                            checked={field.enabled}
                                                            onChange={(e) => updateDefaultField(field.key, 'enabled', e.target.checked)}
                                                            className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                                            title={field.enabled ? 'Uncheck to exclude this field' : 'Check to include this field'}
                                                        />

                                                        {/* Editable Label */}
                                                        <div className="flex-1 min-w-0">
                                                            <input
                                                                type="text"
                                                                value={field.label}
                                                                disabled={!field.enabled}
                                                                onChange={(e) => updateDefaultField(field.key, 'label', e.target.value)}
                                                                placeholder="Field label..."
                                                                className={`w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border outline-none transition-colors ${
                                                                    field.enabled
                                                                        ? 'bg-surface border-border focus:border-primary focus:ring-1 focus:ring-primary text-main'
                                                                        : 'bg-transparent border-transparent text-muted-text cursor-not-allowed'
                                                                }`}
                                                            />
                                                            <span className="text-[10px] text-muted-text block px-1 mt-0.5 font-medium truncate">
                                                                Auto-fills: <code className="text-muted-text">{field.key}</code>
                                                            </span>
                                                        </div>

                                                        {/* Required Toggle */}
                                                        <label className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer shrink-0 select-none ${
                                                            field.enabled ? 'text-sub hover:text-main' : 'text-muted-text cursor-not-allowed'
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                disabled={!field.enabled}
                                                                checked={Boolean(field.required)}
                                                                onChange={(e) => updateDefaultField(field.key, 'required', e.target.checked)}
                                                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                                                            />
                                                            <span>Required</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dynamic Registration Form Questions Builder */}
                                        <div className="p-5 bg-surface rounded-2xl border border-border shadow-xs space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                                <div>
                                                    <h4 className="text-sm font-bold text-main flex items-center gap-2">
                                                        <FileText size={16} className="text-primary" />
                                                        Dynamic Registration Form Fields
                                                    </h4>
                                                    <p className="text-xs text-muted-text">Add custom questions to collect specific information for this event.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addFormField()}
                                                    className="bg-primary hover:bg-primary-hover text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition-colors"
                                                >
                                                    <Plus size={14} /> Add Question
                                                </button>
                                            </div>

                                            {/* Questions list */}
                                            {(!formData.registration_form_fields || formData.registration_form_fields.length === 0) ? (
                                                <div className="py-8 text-center border-2 border-dashed border-border rounded-2xl">
                                                    <div className="w-12 h-12 mx-auto rounded-full bg-[var(--primary-light)] flex items-center justify-center text-primary mb-2">
                                                        <FileText size={20} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-sub">No custom questions added yet</p>
                                                    <p className="text-xs text-muted-text mt-1 max-w-sm mx-auto">
                                                        Click "+ Add Question" above to add event-specific questions (e.g. food preference, t-shirt size, project link).
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {formData.registration_form_fields.map((field, idx) => (
                                                        <div key={field.id || idx} className="p-4 bg-[var(--background)]/80 rounded-2xl border border-border space-y-3 relative">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-primary bg-surface px-2.5 py-0.5 rounded-md border border-[var(--primary-light)]">
                                                                    Field #{idx + 1}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <label className="flex items-center gap-1.5 text-xs font-medium text-sub cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(field.required)}
                                                                            onChange={(e) => updateFormField(idx, 'required', e.target.checked)}
                                                                            className="rounded text-primary focus:ring-primary h-4 w-4"
                                                                        />
                                                                        <span>Required field</span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeFormField(idx)}
                                                                        className="p-1 text-muted-text hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                                        title="Delete field"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div className="sm:col-span-2">
                                                                    <label className="block text-[11px] font-bold text-sub uppercase mb-1">
                                                                        Field Label / Question
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={field.label || ''}
                                                                        onChange={(e) => updateFormField(idx, 'label', e.target.value)}
                                                                        placeholder="e.g. Food Preference (Veg/Non-Veg)"
                                                                        className="w-full text-xs p-2.5 border border-border-strong rounded-xl bg-surface focus:ring-2 focus:ring-primary outline-none font-medium"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-bold text-sub uppercase mb-1">
                                                                        Field Type
                                                                    </label>
                                                                    <select
                                                                        value={field.type || 'text'}
                                                                        onChange={(e) => updateFormField(idx, 'type', e.target.value)}
                                                                        className="w-full text-xs p-2.5 border border-border-strong rounded-xl bg-surface focus:ring-2 focus:ring-primary outline-none font-medium"
                                                                    >
                                                                        <option value="text">Short Text</option>
                                                                        <option value="textarea">Paragraph / Long Text</option>
                                                                        <option value="select">Dropdown Options</option>
                                                                        <option value="number">Number</option>
                                                                        <option value="boolean">Yes / No</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            {field.type === 'select' && (
                                                                <div className="pt-1">
                                                                    <label className="block text-[11px] font-bold text-sub uppercase mb-1">
                                                                        Options (Separated by comma)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={field.options || ''}
                                                                        onChange={(e) => updateFormField(idx, 'options', e.target.value)}
                                                                        placeholder="e.g. Veg, Non-Veg, Jain"
                                                                        className="w-full text-xs p-2.5 border border-[var(--primary-light)] rounded-xl bg-surface focus:ring-2 focus:ring-primary outline-none"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addFormField()}
                                                        className="w-full py-2.5 border border-dashed border-[var(--primary-light)] text-primary bg-[var(--primary-light)] hover:bg-[var(--primary-light)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                                    >
                                                        <Plus size={14} /> Add Another Question
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Step 2 Bottom Actions */}
                                        <div className="flex items-center justify-between pt-4 border-t gap-3">
                                            <button
                                                type="button"
                                                onClick={() => setFormStep(1)}
                                                className="px-5 py-2.5 bg-background hover:bg-background text-sub rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
                                            >
                                                <ChevronLeft size={16} /> Back to Announcement Details
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/25 transition-all disabled:opacity-70"
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                                <span>{loading ? 'Publishing...' : (editId ? 'Update Announcement & Form' : 'Publish Announcement & Registration')}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : formStep === 0 ? (
                                    /* =================== STEP 0: ASK ANNOUNCEMENT TYPE FIRST =================== */
                                    <div className="space-y-6 py-4 animate-fade-in">
                                        <div className="text-center max-w-xl mx-auto space-y-2">
                                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] uppercase tracking-wider">
                                                Step 1 of 2: Select Type
                                            </span>
                                            <h3 className="text-2xl font-black text-main">What would you like to create?</h3>
                                            <p className="text-sm text-muted-text">
                                                Choose an announcement type below. Form fields and layout will automatically adjust for your selection.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto pt-2">
                                            {/* Type 1: Circular */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, announcement_type: 'circular' }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-border hover:border-danger bg-surface hover:bg-[var(--danger-light)] text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-[var(--danger-light)] text-danger flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-main text-base group-hover:text-danger">Type 1: Circular</h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--danger-light)] text-danger">Generated PDF</span>
                                                    </div>
                                                    <p className="text-xs text-muted-text leading-relaxed mt-1">
                                                        Write the circular content and signatory details. A college-wise numbered PDF is generated for students to download.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-danger">
                                                    <span>Create Circular</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>

                                            {/* Type 2: Events */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, announcement_type: 'event' }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-border hover:border-secondary bg-surface hover:bg-[var(--primary-light)] text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-[var(--primary-light)] text-secondary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <Calendar size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-main text-base group-hover:text-secondary">Type 2: Events</h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary-light)] text-secondary">Date & Venue</span>
                                                    </div>
                                                    <p className="text-xs text-muted-text leading-relaxed mt-1">
                                                        Campus events, seminars, fests, workshops with date, time, venue, poster, and optional student seat registration.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-secondary">
                                                    <span>Create Event</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>

                                            {/* Type 3: Polls */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, announcement_type: 'poll' }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-border hover:border-success bg-surface hover:bg-[var(--success-light)] text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-[var(--success-light)] text-success flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <BarChart2 size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-main text-base group-hover:text-success">Type 3: Polls</h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--success-light)] text-success">Interactive</span>
                                                    </div>
                                                    <p className="text-xs text-muted-text leading-relaxed mt-1">
                                                        Interactive campus polls with question, customizable options, voting timeline, and live vote percentage charts.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-success">
                                                    <span>Create Poll</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>

                                            {/* Type 4: Announcement */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, announcement_type: 'announcement' }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-border hover:border-primary bg-surface hover:bg-[var(--primary-light)] text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-[var(--primary-light)] text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <Megaphone size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-main text-base group-hover:text-primary">Type 4: Announcement</h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary-light)] text-primary">Standard</span>
                                                    </div>
                                                    <p className="text-xs text-muted-text leading-relaxed mt-1">
                                                        Standard college announcement with title, rich message body, image poster attachment, and auto-expiry options.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-primary">
                                                    <span>Create Announcement</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>

                                            {/* Type 5: Student Achievement Leader board */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, announcement_type: 'achievement' }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-[var(--warning-light)] hover:border-warning bg-gradient-to-br from-[var(--warning-light)] via-surface to-[var(--warning-light)] text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-warning text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-md shadow-warning">
                                                        <Trophy size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-main text-base group-hover:text-warning flex items-center gap-1.5">
                                                            Type 5: Student Achievement Leader board
                                                        </h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                                            🏆 Hackathon Topper
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-sub leading-relaxed mt-1">
                                                        Showcase the student topper in hackathons and competitions! Displays their <strong>Photo, Name, Branch, Year & Semester</strong>, prize, and rank.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-[var(--warning-light)] flex items-center justify-between text-xs font-bold text-warning">
                                                    <span>Create Leaderboard Spotlight</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        announcement_type: 'form',
                                                        requires_registration: true,
                                                        max_seats: '',
                                                        registration_deadline: '',
                                                        default_profile_fields: INITIAL_DEFAULT_PROFILE_FIELDS.map(field => ({ ...field }))
                                                    }));
                                                    setFormStep(1);
                                                }}
                                                className="p-5 rounded-2xl border-2 border-indigo-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 text-left transition-all duration-200 shadow-xs hover:shadow-md group flex flex-col justify-between"
                                            >
                                                <div>
                                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-bold text-gray-900 text-base group-hover:text-indigo-700">Type 6: Forms</h4>
                                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">Collect Responses</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 leading-relaxed mt-1">
                                                        Build a form with custom fields, share it with selected students, and review or export their responses.
                                                    </p>
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-indigo-100 flex items-center justify-between text-xs font-bold text-indigo-700">
                                                    <span>Create Form</span>
                                                    <ChevronRight size={14} />
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* =================== STEP 1: DYNAMIC FORM FIELDS BY TYPE =================== */
                                    <>
                                        {/* Type Selector Pill Header */}
                                        <div className="flex items-center justify-between p-3.5 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-2xl mb-4">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-xs font-black uppercase tracking-wider text-primary bg-surface px-2.5 py-1 rounded-lg border border-[var(--primary-light)] shadow-2xs">
                                                    {formData.announcement_type === 'circular' ? 'Type 1: Circular' :
                                                     formData.announcement_type === 'event' ? 'Type 2: Event' :
                                                     formData.announcement_type === 'poll' ? 'Type 3: Poll' :
                                                     formData.announcement_type === 'achievement' ? 'Type 5: Student Achievement Leader board' :
                                                     formData.announcement_type === 'form' ? 'Type 6: Forms' :
                                                     'Type 4: Announcement'}
                                                </span>
                                                <span className="text-xs text-primary hidden sm:inline font-medium">
                                                    {formData.announcement_type === 'circular' ? 'Enter circular content · College-wise numbers and downloadable PDFs are generated automatically' :
                                                     formData.announcement_type === 'event' ? 'Event details with date, time, venue and optional seat registration' :
                                                     formData.announcement_type === 'poll' ? 'Campus poll with interactive student options' :
                                                     formData.announcement_type === 'achievement' ? 'Spotlight hackathon topper with Photo, Name, Branch, Year & Sem' :
                                                     formData.announcement_type === 'form' ? 'Create a custom form and collect student responses' :
                                                     'Standard general campus announcement'}
                                                </span>
                                            </div>
                                            {!editId && (
                                                <button
                                                    type="button"
                                                    onClick={() => setFormStep(0)}
                                                    className="text-xs font-bold text-primary hover:text-primary bg-surface hover:bg-[var(--primary-light)] px-3 py-1 rounded-lg border border-[var(--primary-light)] transition-colors flex items-center gap-1 shadow-2xs"
                                                >
                                                    <ChevronLeft size={13} /> Change Type
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                {/* ================= TYPE 1: CIRCULAR ================= */}
                                                {formData.announcement_type === 'circular' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Subject Line (Headline) <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-danger outline-none font-medium text-sm"
                                                                placeholder="e.g. Schedule for B.Tech Semester End Regular & Supplementary Examinations"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                            <span className="text-[11px] text-muted-text mt-1 block">
                                                                The subject line will be prominently displayed as the headline.
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                Circular Content <span className="text-danger">*</span>
                                                            </label>
                                                            <textarea
                                                                className="w-full p-3 border border-border-strong rounded-xl min-h-48 focus:ring-2 focus:ring-danger outline-none font-medium text-sm"
                                                                placeholder="Write the complete circular content here..."
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                                    Signatory Name <span className="text-rose-500">*</span>
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.circular_signatory}
                                                                    onChange={e => setFormData({ ...formData, circular_signatory: e.target.value })}
                                                                    placeholder="Name of the concerned authority"
                                                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                                    Designation <span className="text-rose-500">*</span>
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.circular_designation}
                                                                    onChange={e => setFormData({ ...formData, circular_designation: e.target.value })}
                                                                    placeholder="e.g. Principal"
                                                                    className="w-full p-2.5 border border-gray-300 rounded-xl text-sm"
                                                                />
                                                            </div>
                                                            <p className="sm:col-span-2 text-[11px] text-rose-800">
                                                                A college-wise circular number and downloadable PDF will be generated automatically.
                                                            </p>
                                                        </div>

                                                        {/* Auto-expire */}
                                                        <div className="bg-background p-3 rounded-xl border border-border space-y-2">
                                                            <label className="block text-xs font-bold text-sub flex items-center gap-1.5 uppercase tracking-wider">
                                                                <Clock size={13} className="text-sub" />
                                                                Display Time Limit (Auto-Expire)
                                                            </label>
                                                            <div className="grid grid-cols-5 gap-1.5">
                                                                {[
                                                                    { id: '1', label: '1 Day' },
                                                                    { id: '3', label: '3 Days' },
                                                                    { id: '7', label: '7 Days' },
                                                                    { id: 'none', label: 'No Limit' },
                                                                    { id: 'custom', label: 'Custom' }
                                                                ].map(opt => (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        onClick={() => setFormData({ ...formData, time_limit_option: opt.id })}
                                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center ${
                                                                            formData.time_limit_option === opt.id
                                                                                ? 'bg-danger text-white border-danger shadow-2xs'
                                                                                : 'bg-surface text-sub border-border hover:bg-background'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {formData.time_limit_option === 'custom' && (
                                                                <input
                                                                    type="datetime-local"
                                                                    className="w-full p-2 border border-border-strong rounded-lg text-xs font-medium focus:ring-2 focus:ring-danger bg-surface mt-2"
                                                                    value={formData.custom_expiry_date || ''}
                                                                    onChange={e => setFormData({ ...formData, custom_expiry_date: e.target.value })}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ================= TYPE 2: EVENTS ================= */}
                                                {formData.announcement_type === 'event' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Event Title <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-secondary outline-none font-medium text-sm"
                                                                placeholder="e.g. National Technical Symposium & Workshop 2026"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                    Event Date
                                                                </label>
                                                                <input
                                                                    type="date"
                                                                    className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-secondary outline-none font-medium text-xs bg-surface"
                                                                    value={formData.event_date || ''}
                                                                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                    Event Time
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-secondary outline-none font-medium text-xs bg-surface"
                                                                    placeholder="e.g. 10:00 AM - 04:30 PM"
                                                                    value={formData.event_time || ''}
                                                                    onChange={e => setFormData({ ...formData, event_time: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                <MapPin size={13} className="text-secondary" /> Event Venue / Location
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-secondary outline-none font-medium text-xs"
                                                                placeholder="e.g. Central Auditorium / Seminar Hall B"
                                                                value={formData.event_venue || ''}
                                                                onChange={e => setFormData({ ...formData, event_venue: e.target.value })}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                Event Description / Agenda
                                                            </label>
                                                            <textarea
                                                                className="w-full p-2.5 border border-border-strong rounded-xl h-24 focus:ring-2 focus:ring-secondary outline-none font-medium text-xs"
                                                                placeholder="Event details, schedule, chief guests, topics covered..."
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                Event Poster / Banner Image
                                                            </label>
                                                            {formData.existing_image_url && !formData.image && (
                                                                <div className="mb-2 h-20 w-32 relative group">
                                                                    <img src={formData.existing_image_url} alt="Current" className="h-full w-full object-cover rounded border" />
                                                                    <button type="button" onClick={() => setFormData({ ...formData, existing_image_url: null })} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-0.5"><X size={12} /></button>
                                                                </div>
                                                            )}
                                                            <div className="border-2 border-dashed border-border-strong rounded-xl p-3 text-center cursor-pointer hover:bg-background transition-colors relative">
                                                                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                                                <div className="flex flex-col items-center gap-1 text-muted-text">
                                                                    <ImageIcon size={20} />
                                                                    <span className="text-xs">{formData.image ? formData.image.name : 'Click to upload event banner'}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Registration Toggle */}
                                                        <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl flex items-center justify-between">
                                                            <div>
                                                                <span className="text-xs font-bold text-secondary block">Candidate Registration & Seat Booking</span>
                                                                <span className="text-[11px] text-secondary">Allow students to book tickets / seats for this event</span>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(formData.requires_registration)}
                                                                onChange={e => setFormData({ ...formData, requires_registration: e.target.checked })}
                                                                className="h-5 w-5 rounded text-secondary focus:ring-secondary"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ================= TYPE 3: POLLS ================= */}
                                                {formData.announcement_type === 'poll' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Poll Question <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-success outline-none font-medium text-sm"
                                                                placeholder="e.g. Which programming language should be prioritized for the upcoming winter bootcamp?"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-2 flex items-center justify-between">
                                                                <span>Poll Options (At least 2 options) <span className="text-danger">*</span></span>
                                                                <span className="text-[10px] text-muted-text font-mono">{(formData.poll_options || []).length} Options</span>
                                                            </label>
                                                            <div className="space-y-2">
                                                                {(formData.poll_options || ['', '']).map((opt, optIdx) => (
                                                                    <div key={optIdx} className="flex gap-2 items-center">
                                                                        <span className="w-6 h-6 rounded-lg bg-[var(--success-light)] text-success flex items-center justify-center text-xs font-bold shrink-0">
                                                                            {optIdx + 1}
                                                                        </span>
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 p-2 border border-border-strong rounded-xl focus:ring-2 focus:ring-success outline-none text-xs font-medium"
                                                                            placeholder={`Option ${optIdx + 1} text...`}
                                                                            value={opt}
                                                                            onChange={e => {
                                                                                const newOpts = [...(formData.poll_options || ['', ''])];
                                                                                newOpts[optIdx] = e.target.value;
                                                                                setFormData({ ...formData, poll_options: newOpts });
                                                                            }}
                                                                        />
                                                                        {(formData.poll_options || []).length > 2 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const newOpts = (formData.poll_options || []).filter((_, idx) => idx !== optIdx);
                                                                                    setFormData({ ...formData, poll_options: newOpts });
                                                                                }}
                                                                                className="p-1.5 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                                                title="Remove option"
                                                                            >
                                                                                <MinusCircle size={16} />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {(formData.poll_options || []).length < 6 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                poll_options: [...(prev.poll_options || ['', '']), '']
                                                                            }));
                                                                        }}
                                                                        className="w-full py-2 border border-dashed border-[var(--success-light)] text-success bg-[var(--success-light)] hover:bg-[var(--success-light)] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 mt-2 transition-colors"
                                                                    >
                                                                        <Plus size={14} /> Add Another Option
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                Poll Expiry / Deadline
                                                            </label>
                                                            <input
                                                                type="datetime-local"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-success outline-none font-medium text-xs bg-surface"
                                                                value={formData.custom_expiry_date || ''}
                                                                onChange={e => setFormData({ ...formData, custom_expiry_date: e.target.value })}
                                                            />
                                                            <span className="text-[11px] text-muted-text mt-1 block">Students cannot vote after this date & time.</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ================= TYPE 4: ANNOUNCEMENT (STANDARD) ================= */}
                                                {formData.announcement_type === 'announcement' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Headline / Title <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium text-sm"
                                                                placeholder="Enter announcement headline"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Content / Message <span className="text-danger">*</span>
                                                            </label>
                                                            <textarea
                                                                className="w-full p-2.5 border border-border-strong rounded-xl h-28 focus:ring-2 focus:ring-primary outline-none font-medium text-xs"
                                                                placeholder="Enter complete announcement details..."
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="bg-[var(--primary-light)] p-3.5 rounded-xl border border-[var(--primary-light)] space-y-2">
                                                            <label className="block text-xs font-bold text-sub flex items-center gap-1.5 uppercase tracking-wider">
                                                                <Clock size={13} className="text-primary" />
                                                                Display Time Limit (Auto-Expire)
                                                            </label>
                                                            <div className="grid grid-cols-5 gap-1.5">
                                                                {[
                                                                    { id: '1', label: '1 Day' },
                                                                    { id: '3', label: '3 Days' },
                                                                    { id: '7', label: '7 Days' },
                                                                    { id: 'none', label: 'No Limit' },
                                                                    { id: 'custom', label: 'Custom' }
                                                                ].map(opt => (
                                                                    <button
                                                                        key={opt.id}
                                                                        type="button"
                                                                        onClick={() => setFormData({ ...formData, time_limit_option: opt.id })}
                                                                        className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center ${
                                                                            formData.time_limit_option === opt.id
                                                                                ? 'bg-primary text-white border-primary shadow-sm'
                                                                                : 'bg-surface text-sub border-border hover:bg-background'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {formData.time_limit_option === 'custom' && (
                                                                <input
                                                                    type="datetime-local"
                                                                    className="w-full p-2 border border-border-strong rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary bg-surface mt-2"
                                                                    value={formData.custom_expiry_date || ''}
                                                                    onChange={e => setFormData({ ...formData, custom_expiry_date: e.target.value })}
                                                                />
                                                            )}
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">Image (Optional)</label>
                                                            {formData.existing_image_url && !formData.image && (
                                                                <div className="mb-2 h-20 w-32 relative group">
                                                                    <img src={formData.existing_image_url} alt="Current" className="h-full w-full object-cover rounded border" />
                                                                    <button type="button" onClick={() => setFormData({ ...formData, existing_image_url: null })} className="absolute -top-2 -right-2 bg-danger text-white rounded-full p-0.5"><X size={12} /></button>
                                                                </div>
                                                            )}
                                                            <div className="border-2 border-dashed border-border-strong rounded-xl p-3 text-center cursor-pointer hover:bg-background transition-colors relative">
                                                                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                                                <div className="flex flex-col items-center gap-1 text-muted-text">
                                                                    <ImageIcon size={20} />
                                                                    <span className="text-xs">{formData.image ? formData.image.name : 'Click to attach image'}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ================= TYPE 5: STUDENT ACHIEVEMENT LEADER BOARD ================= */}
                                                {formData.announcement_type === 'achievement' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1 flex items-center gap-1">
                                                                Hackathon / Competition Name <span className="text-danger">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-warning outline-none font-medium text-sm"
                                                                placeholder="e.g. Smart India Hackathon 2026 / National Coding Championship"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            <div>
                                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                    Rank / Position Title
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-warning outline-none font-medium text-xs"
                                                                    placeholder="e.g. 1st Place / Hackathon Topper / Gold Medal"
                                                                    value={formData.rank_title || ''}
                                                                    onChange={e => setFormData({ ...formData, rank_title: e.target.value })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                    Cash Prize / Award Details
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full p-2.5 border border-border-strong rounded-xl focus:ring-2 focus:ring-warning outline-none font-medium text-xs"
                                                                    placeholder="e.g. ₹50,000 Cash Prize & Trophy"
                                                                    value={formData.topper_prize || ''}
                                                                    onChange={e => setFormData({ ...formData, topper_prize: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Topper Spotlight Box */}
                                                        <div className="p-4 bg-gradient-to-br from-[var(--warning-light)] to-[var(--warning-light)] border-2 border-[var(--warning-light)] rounded-2xl space-y-3">
                                                            <div className="flex items-center justify-between border-b border-[var(--warning-light)] pb-2">
                                                                <h5 className="text-xs font-black text-warning uppercase tracking-wider flex items-center gap-1.5">
                                                                    <Trophy size={14} className="text-warning" /> Student Topper Details (Photo, Name, Branch, Year & Sem)
                                                                </h5>
                                                                <span className="text-[10px] font-bold text-warning bg-[var(--warning-light)] px-2 py-0.5 rounded-full">
                                                                    Required
                                                                </span>
                                                            </div>

                                                            {/* Quick Database Search */}
                                                            <div className="relative">
                                                                <label className="block text-[11px] font-bold text-sub mb-1">
                                                                    🔍 Quick Student Auto-Fill (Search by Name or PIN):
                                                                </label>
                                                                <div className="relative">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Type student name or roll number to auto-fill..."
                                                                        value={topperSearchQuery}
                                                                        onChange={e => handleSearchTopper(e.target.value, 0)}
                                                                        className="w-full text-xs p-2 pl-3 pr-8 border border-[var(--warning-light)] rounded-xl bg-surface focus:ring-2 focus:ring-warning outline-none"
                                                                    />
                                                                    {isSearchingTopper && (
                                                                        <Loader2 size={13} className="animate-spin text-warning absolute right-2.5 top-2.5" />
                                                                    )}
                                                                </div>

                                                                {topperSearchResults.length > 0 && (
                                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-lg z-30 max-h-48 overflow-y-auto divide-y divide-border">
                                                                        {topperSearchResults.map(s => (
                                                                            <div
                                                                                key={s.id}
                                                                                onClick={() => handleSelectTopperStudent(s, 0)}
                                                                                className="p-2.5 hover:bg-[var(--warning-light)] cursor-pointer flex items-center justify-between text-xs"
                                                                            >
                                                                                <div>
                                                                                    <span className="font-bold text-main block">{s.student_name}</span>
                                                                                    <span className="text-[10px] text-muted-text">PIN: {s.pin_no || s.admission_number} · {s.branch} · Year {s.current_year}</span>
                                                                                </div>
                                                                                <span className="text-[10px] font-bold text-warning bg-[var(--warning-light)] px-2 py-0.5 rounded">Select</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Photo & Inputs Row */}
                                                            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                                                                <div className="flex flex-col items-center shrink-0">
                                                                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-warning shadow-md bg-surface relative group">
                                                                        {formData.topper_photo_preview ? (
                                                                            <img src={formData.topper_photo_preview} alt="Topper" className="w-full h-full object-cover" />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center bg-[var(--warning-light)] text-warning">
                                                                                <User size={28} />
                                                                            </div>
                                                                        )}
                                                                        <label className="absolute inset-0 bg-black/40 text-white flex items-center justify-center text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-center p-1">
                                                                            Change Photo
                                                                            <input type="file" accept="image/*" onChange={handleTopperPhotoChange} className="hidden" />
                                                                        </label>
                                                                    </div>
                                                                    <label className="text-[10px] font-bold text-warning mt-1 cursor-pointer hover:underline">
                                                                        Upload Photo
                                                                        <input type="file" accept="image/*" onChange={handleTopperPhotoChange} className="hidden" />
                                                                    </label>
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 w-full">
                                                                    <div>
                                                                        <label className="block text-[11px] font-bold text-sub mb-0.5">
                                                                            Student Full Name <span className="text-danger">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border border-[var(--warning-light)] rounded-xl bg-surface text-xs font-semibold"
                                                                            placeholder="e.g. K. Rajesh Kumar"
                                                                            value={formData.topper_name || ''}
                                                                            onChange={e => updateTopperStudent(0, 'student_name', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[11px] font-bold text-sub mb-0.5">
                                                                            Branch / Department <span className="text-danger">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border border-[var(--warning-light)] rounded-xl bg-surface text-xs font-semibold"
                                                                            placeholder="e.g. CSE / ECE / AI&DS"
                                                                            value={formData.topper_branch || ''}
                                                                            onChange={e => updateTopperStudent(0, 'branch', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[11px] font-bold text-sub mb-0.5">
                                                                            Year & Semester <span className="text-danger">*</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border border-[var(--warning-light)] rounded-xl bg-surface text-xs font-semibold"
                                                                            placeholder="e.g. 3rd Year, 1st Sem (III-I)"
                                                                            value={formData.topper_year_sem || ''}
                                                                            onChange={e => updateTopperStudent(0, 'year_sem', e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[11px] font-bold text-sub mb-0.5">
                                                                            Roll No / PIN (Optional)
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            className="w-full p-2 border border-[var(--warning-light)] rounded-xl bg-surface text-xs font-semibold"
                                                                            placeholder="e.g. 21A91A0501"
                                                                            value={formData.topper_roll_no || ''}
                                                                            onChange={e => updateTopperStudent(0, 'roll_no', e.target.value)}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-3">
                                                            {(formData.topper_students || []).slice(1).map((student, index) => {
                                                                const studentIndex = index + 1;
                                                                return (
                                                                    <div key={student.id} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <h6 className="text-xs font-black uppercase tracking-wide text-amber-900">Student {studentIndex + 1}</h6>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeTopperStudent(studentIndex)}
                                                                                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                                                                                aria-label={`Remove student ${studentIndex + 1}`}
                                                                            >
                                                                                <Trash2 size={15} />
                                                                            </button>
                                                                        </div>
                                                                        <div className="relative">
                                                                            <input
                                                                                type="search"
                                                                                value={activeTopperIndex === studentIndex ? topperSearchQuery : ''}
                                                                                onChange={e => handleSearchTopper(e.target.value, studentIndex)}
                                                                                placeholder="Search student by name or PIN"
                                                                                className="w-full rounded-xl border border-amber-200 bg-white p-2.5 text-xs"
                                                                            />
                                                                            {activeTopperIndex === studentIndex && topperSearchResults.length > 0 && (
                                                                                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-xl border bg-white shadow-lg">
                                                                                    {topperSearchResults.map(result => (
                                                                                        <button
                                                                                            key={result.id}
                                                                                            type="button"
                                                                                            onClick={() => handleSelectTopperStudent(result, studentIndex)}
                                                                                            className="flex w-full items-center justify-between border-b p-2.5 text-left text-xs hover:bg-amber-50"
                                                                                        >
                                                                                            <span>
                                                                                                <strong className="block text-gray-900">{result.student_name}</strong>
                                                                                                <span className="text-[10px] text-gray-500">
                                                                                                    PIN: {result.pin_no || result.admission_number || '—'} · {result.branch || '—'} · Year {result.current_year || '—'} / Sem {result.current_semester || '—'}
                                                                                                </span>
                                                                                            </span>
                                                                                            {result.student_image && <img src={result.student_image} alt="" className="h-8 w-8 rounded-full object-cover" />}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                                            {[
                                                                                ['student_name', 'Student Full Name'],
                                                                                ['branch', 'Branch / Department'],
                                                                                ['year_sem', 'Year & Semester'],
                                                                                ['roll_no', 'Roll No / PIN']
                                                                            ].map(([key, label]) => (
                                                                                <label key={key} className="text-[11px] font-bold text-gray-700">
                                                                                    {label}
                                                                                    <input
                                                                                        type="text"
                                                                                        value={student[key] || ''}
                                                                                        onChange={e => updateTopperStudent(studentIndex, key, e.target.value)}
                                                                                        className="mt-1 w-full rounded-xl border border-amber-200 bg-white p-2 text-xs font-medium"
                                                                                    />
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            <button
                                                                type="button"
                                                                onClick={addTopperStudent}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-amber-400 bg-white px-4 py-2.5 text-xs font-black text-amber-800 hover:bg-amber-50"
                                                            >
                                                                <Plus size={15} /> AddStudent
                                                            </button>
                                                        </div>

                                                        <div>
                                                            <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-1">
                                                                Project Name & Achievement Description
                                                            </label>
                                                            <textarea
                                                                className="w-full p-2.5 border border-border-strong rounded-xl h-20 focus:ring-2 focus:ring-warning outline-none font-medium text-xs"
                                                                placeholder="Project title, mentor, problem statement solved, key highlights..."
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {formData.announcement_type === 'form' && (
                                                    <div className="space-y-4 animate-fade-in">
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                                Form Title <span className="text-rose-500">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                                placeholder="e.g. Student Feedback Form"
                                                                className="w-full p-2.5 border border-gray-300 rounded-xl text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                                Form Description <span className="text-rose-500">*</span>
                                                            </label>
                                                            <textarea
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                                placeholder="Explain what information this form collects."
                                                                className="w-full p-3 border border-gray-300 rounded-xl min-h-24 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-indigo-950">Custom Form Fields</h4>
                                                                    <p className="text-xs text-indigo-800">Students submit answers that admins can review and export.</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={addFormField}
                                                                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                                                                >
                                                                    <Plus size={14} /> Add Field
                                                                </button>
                                                            </div>
                                                            {(formData.registration_form_fields || []).map((field, index) => (
                                                                <div key={field.id || index} className="grid grid-cols-1 gap-2 rounded-xl border border-indigo-100 bg-white p-3 sm:grid-cols-[1fr_150px_auto_auto] sm:items-center">
                                                                    <input
                                                                        type="text"
                                                                        value={field.label}
                                                                        onChange={e => updateFormField(index, 'label', e.target.value)}
                                                                        placeholder={`Field ${index + 1} label`}
                                                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                                                                    />
                                                                    <select
                                                                        value={field.type || 'text'}
                                                                        onChange={e => updateFormField(index, 'type', e.target.value)}
                                                                        className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs"
                                                                    >
                                                                        <option value="text">Short answer</option>
                                                                        <option value="textarea">Long answer</option>
                                                                        <option value="number">Number</option>
                                                                        <option value="date">Date</option>
                                                                        <option value="select">Dropdown</option>
                                                                        <option value="boolean">Yes / No</option>
                                                                    </select>
                                                                    <label className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(field.required)}
                                                                            onChange={e => updateFormField(index, 'required', e.target.checked)}
                                                                        />
                                                                        Required
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeFormField(index)}
                                                                        className="inline-flex items-center justify-center rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                                                                        aria-label={`Remove field ${index + 1}`}
                                                                    >
                                                                        <Trash2 size={15} />
                                                                    </button>
                                                                    {field.type === 'select' && (
                                                                        <input
                                                                            type="text"
                                                                            value={field.options || ''}
                                                                            onChange={e => updateFormField(index, 'options', e.target.value)}
                                                                            placeholder="Dropdown options, separated by commas"
                                                                            className="sm:col-span-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
                                                                        />
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <TargetSelector formData={formData} setFormData={setFormData} />
                                        </div>

                                        <div className="flex justify-end pt-4 border-t gap-3">
                                            <button type="button" onClick={handleCancel} className="px-5 py-2.5 border border-border rounded-xl text-sub hover:bg-background font-medium">Cancel</button>
                                            {(activeTab === 'announcements' || activeTab === 'events') && formData.requires_registration && formData.announcement_type !== 'form' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!formData.title?.trim()) {
                                                            return toast.error('Please enter Title first');
                                                        }
                                                        setFormStep(2);
                                                    }}
                                                    className="bg-primary text-white px-7 py-2.5 rounded-xl font-bold hover:bg-primary-hover flex items-center gap-2 shadow-lg shadow-primary/25 transition-all"
                                                >
                                                    <span>Next: Configure Registration Form</span>
                                                    <ChevronRight size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="bg-primary text-white px-8 py-2.5 rounded-xl font-bold hover:bg-primary-hover flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                                    {loading ? (formData.image || formData.file ? 'Uploading...' : 'Submitting...') : (editId ? 'Update' : 'Publish')}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* SMS Template Modal */}
            {isTemplateModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center bg-background">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Settings className="text-primary" size={20} />
                                {editId ? 'Edit SMS Template' : 'Create SMS Template'}
                            </h2>
                            <button onClick={handleCancel} className="p-2 hover:bg-background rounded-full text-muted-text">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSaveTemplate} className="space-y-4">
                                <div className="bg-[var(--primary-light)] p-3 rounded text-xs text-primary mb-4">
                                    <h4 className="font-bold flex items-center gap-1 mb-1"><MessageSquare size={14} /> Guide</h4>
                                    <p>Use <code>{'{#var#}'}</code> as placeholder for variables in content.</p>
                                    <p className="mt-1">Optional defaults below are pre-filled when sending. Final values can still be entered or changed on the <strong>Send Broadcast</strong> screen.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-sub mb-1">Template Name (Internal)</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded bg-surface"
                                        placeholder="e.g. Absent Alert"
                                        value={formData.template_name}
                                        onChange={e => setFormData({ ...formData, template_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-sub mb-1">DLT Template ID</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded bg-surface"
                                        placeholder="1007..."
                                        value={formData.template_id}
                                        onChange={e => setFormData({ ...formData, template_id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-sub mb-1">Content</label>
                                    <textarea
                                        required
                                        className="w-full p-2 border rounded bg-surface h-24"
                                        placeholder="Content with {#var#}..."
                                        value={formData.template_content}
                                        onChange={e => handleTemplateContentChange(e.target.value)}
                                    />
                                </div>

                                {formData.variable_mappings.length > 0 ? (
                                    <div className="space-y-3 bg-background p-3 rounded border">
                                        <label className="block text-xs font-bold text-muted-text uppercase">Default Variable Mappings (optional)</label>
                                        <p className="text-xs text-muted-text">Detected {formData.variable_mappings.length} placeholder(s). These defaults appear on Send Broadcast — you can override them before sending.</p>
                                        {formData.variable_mappings.map((mapping, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="text-xs font-mono text-muted-text w-12">var#{idx + 1}</span>
                                                <select
                                                    className="p-1 border rounded text-xs bg-surface"
                                                    value={mapping.type}
                                                    onChange={(e) => handleMappingChange(idx, 'type', e.target.value)}
                                                >
                                                    <option value="static">Static</option>
                                                    <option value="field">Field</option>
                                                </select>
                                                {mapping.type === 'static' ? (
                                                    <input
                                                        type="text"
                                                        className="flex-1 p-1 border rounded text-xs"
                                                        placeholder="Value"
                                                        value={mapping.value}
                                                        onChange={(e) => handleMappingChange(idx, 'value', e.target.value)}
                                                    />
                                                ) : (
                                                    <select
                                                        className="flex-1 p-1 border rounded text-xs bg-surface"
                                                        value={mapping.value}
                                                        onChange={(e) => handleMappingChange(idx, 'value', e.target.value)}
                                                    >
                                                        <option value="">Select Field...</option>
                                                        {studentFields.map(f => (
                                                            <option key={`${f.label}-${f.value}`} value={f.value}>{f.label}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    formData.template_content && (
                                        <p className="text-xs text-warning bg-[var(--warning-light)] border border-[var(--warning-light)] rounded p-2">
                                            No {'{#var#}'} placeholders found yet. Add them in content to configure variable mapping.
                                        </p>
                                    )
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm text-sub hover:bg-background rounded">Cancel</button>
                                    <button type="submit" disabled={loading} className="bg-primary text-white px-6 py-2 rounded text-sm font-bold hover:bg-primary-hover">
                                        {editId ? 'Save Changes' : 'Create Template'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Mobile Target Selection Modal */}
            {isMobileTargetModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-5 border-b flex justify-between items-center bg-background">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-main">
                                <Smartphone className="text-success" size={20} />
                                Select Target Mobile Numbers
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsMobileTargetModalOpen(false)}
                                className="p-2 hover:bg-background rounded-full text-muted-text"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-sub">
                                Choose one or more number types to receive this SMS broadcast:
                            </p>

                            <div className="flex items-center justify-end gap-1 mb-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setSelectedMobileTargets(['student_mobile', 'parent_mobile1'])}
                                    className="text-xs font-semibold text-primary hover:underline px-1.5"
                                >
                                    Both at a time
                                </button>
                                <span className="text-muted-text">|</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMobileTargets(['parent_mobile1'])}
                                    className="text-xs font-semibold text-primary hover:underline px-1.5"
                                >
                                    Parent Only
                                </button>
                                <span className="text-muted-text">|</span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedMobileTargets(['student_mobile'])}
                                    className="text-xs font-semibold text-primary hover:underline px-1.5"
                                >
                                    Student Only
                                </button>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { key: 'student_mobile', label: 'Student Mobile Number (Student)' },
                                    { key: 'parent_mobile1', label: 'Parent Preferred Number (Parent Mobile 1)' },
                                    { key: 'parent_mobile2', label: 'Parent Alternate Number (Parent Mobile 2)' }
                                ].map((target) => (
                                    <label key={target.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-background cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedMobileTargets.includes(target.key)}
                                            onChange={() => toggleMobileTarget(target.key)}
                                            className="h-4 w-4 text-success rounded border-border-strong focus:ring-success"
                                        />
                                        <span className="text-sm font-medium text-sub">{target.label}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileTargetModalOpen(false)}
                                    className="px-4 py-2 text-sm text-sub hover:bg-background rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmBroadcastSend}
                                    disabled={loading}
                                    className="bg-success text-white px-5 py-2 rounded text-sm font-bold hover:bg-success disabled:opacity-70 flex items-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                                    Confirm & Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Broadcast Action Details Modal */}
            {selectedHistoryItem && createPortal(
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in flex flex-col border border-border">
                        <div className="p-5 border-b flex justify-between items-center bg-[var(--background)]/70">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-[var(--primary-light)] text-primary rounded-xl">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-main text-base">Broadcast Action Details</h3>
                                    <p className="text-xs text-muted-text">
                                        Sent on {(selectedHistoryItem.first_sent_at || selectedHistoryItem.last_sent_at || selectedHistoryItem.action_date) ? new Date(selectedHistoryItem.first_sent_at || selectedHistoryItem.last_sent_at || selectedHistoryItem.action_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryItem(null)}
                                className="p-2 text-muted-text hover:text-sub rounded-xl hover:bg-background transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                            {/* Template Info Card */}
                            <div className="p-4 rounded-2xl bg-[var(--primary-light)] border border-[var(--primary-light)]">
                                <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Template Used</div>
                                <div className="text-base font-bold text-main">{selectedHistoryItem.template_name || 'Direct / Custom SMS'}</div>
                                <div className="text-xs text-sub font-mono mt-1 bg-surface px-2 py-0.5 rounded border border-[var(--primary-light)] inline-block">
                                    DLT ID: {selectedHistoryItem.template_id || 'N/A'}
                                </div>
                            </div>

                            {/* Metrics 3-column grid */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-background rounded-xl border border-border text-center">
                                    <div className="text-[10px] font-bold text-muted-text uppercase">Total Count</div>
                                    <div className="text-xl font-bold text-main mt-0.5">
                                        {Number(selectedHistoryItem.total_count || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--success-light)] rounded-xl border border-[var(--success-light)] text-center">
                                    <div className="text-[10px] font-bold text-success uppercase">Delivered</div>
                                    <div className="text-xl font-bold text-success mt-0.5">
                                        {Number(selectedHistoryItem.sent_count || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-3 bg-[var(--danger-light)] rounded-xl border border-[var(--danger-light)] text-center">
                                    <div className="text-[10px] font-bold text-danger uppercase">Failed</div>
                                    <div className="text-xl font-bold text-danger mt-0.5">
                                        {Number(selectedHistoryItem.failed_count || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="space-y-2 text-xs border-t border-b border-border py-3">
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-text">Triggered / Raised By:</span>
                                    <span className="font-semibold text-main">{selectedHistoryItem.sent_by || 'System Generated'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-text">First Sent At:</span>
                                    <span className="font-semibold text-main">
                                        {selectedHistoryItem.first_sent_at ? new Date(selectedHistoryItem.first_sent_at).toLocaleString() : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-muted-text">Last Sent At:</span>
                                    <span className="font-semibold text-main">
                                        {selectedHistoryItem.last_sent_at ? new Date(selectedHistoryItem.last_sent_at).toLocaleString() : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Message Preview */}
                            <div>
                                <label className="block text-xs font-bold text-sub uppercase tracking-wider mb-2">Message Content / Sample</label>
                                <div className="p-4 bg-sidebar text-muted-text rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap border border-border-strong shadow-inner">
                                    {selectedHistoryItem.sample_message || 'No sample message available'}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-background border-t flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryItem(null)}
                                className="px-5 py-2 bg-background hover:bg-background text-sub rounded-xl text-sm font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Announcement Details & Registered Candidates Modal */}
            {selectedAnnouncementForView && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-5xl my-6 overflow-hidden animate-scale-in flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-center bg-surface z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--primary-light)] text-primary">
                                    {selectedAnnouncementForView.requires_registration
                                        ? <Ticket size={24} />
                                        : (selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'event'
                                            ? <Calendar size={24} />
                                            : <Megaphone size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-main line-clamp-1">{selectedAnnouncementForView.title}</h2>
                                        {selectedAnnouncementForView.requires_registration ? (
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-primary shrink-0">
                                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Student Form' : 'Event Registration'}
                                            </span>
                                        ) : (selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'event' ? (
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-secondary shrink-0">
                                                Event
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-primary shrink-0">
                                                Broadcast Notice
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-text">
                                        Posted on {new Date(selectedAnnouncementForView.created_at).toLocaleDateString()} • {selectedAnnouncementForView.audience_count || 0} Targeted Students
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedAnnouncementForView.requires_registration && (
                                    <button
                                        type="button"
                                        onClick={() => exportRegistrationsToCSV(
                                            registrationDetails.announcement || selectedAnnouncementForView,
                                            registrationDetails.registrations || []
                                        )}
                                        className="bg-success hover:bg-success text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                                    >
                                        <Download size={15} />
                                        <span>Export CSV</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedAnnouncementForView(null)}
                                    className="p-2 hover:bg-background rounded-full text-muted-text hover:text-sub transition-colors"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 bg-[var(--background)]/50">
                            {/* Announcement Content & Image Preview */}
                            <div className="bg-surface p-5 rounded-2xl border border-border shadow-2xs space-y-4">
                                {/* Type 1: Circular PDF Preview Box */}
                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'circular' && selectedAnnouncementForView.file_url && (
                                    <div className="p-4 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 shadow-xs">
                                                <FileText size={24} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-main truncate">
                                                    {selectedAnnouncementForView.file_name || 'Attached_Circular.pdf'}
                                                </h4>
                                                <span className="text-xs text-danger font-semibold uppercase tracking-wider block">Official Circular PDF Attachment</span>
                                            </div>
                                        </div>
                                        <a
                                            href={selectedAnnouncementForView.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-4 py-2 bg-danger hover:bg-danger text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 transition-colors"
                                        >
                                            <FileDown size={14} /> Open / Download PDF
                                        </a>
                                    </div>
                                )}

                                {/* Type 5: Student Achievement Leader Board Card */}
                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'achievement' && selectedAnnouncementForView.achievement_data && (() => {
                                    const ach = typeof selectedAnnouncementForView.achievement_data === 'string' ? JSON.parse(selectedAnnouncementForView.achievement_data) : selectedAnnouncementForView.achievement_data;
                                    const students = Array.isArray(ach.students) && ach.students.length ? ach.students : [ach];
                                    return (
                                        <div className="p-4 bg-gradient-to-r from-[var(--warning-light)] to-[var(--warning-light)] border-2 border-[var(--warning-light)] rounded-2xl space-y-3">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-wider text-warning bg-[var(--warning-light)] px-2 py-0.5 rounded-full inline-block mb-1">
                                                    🏆 {ach.rank_title || 'Hackathon Topper'}
                                                </span>
                                                {ach.topper_prize && (
                                                    <p className="text-xs font-black text-warning mt-1">Award: {ach.topper_prize}</p>
                                                )}
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                {students.map((student, index) => (
                                                    <div key={student.id || `${student.student_name}-${index}`} className="flex items-center gap-3 rounded-xl bg-white/80 p-3">
                                                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 bg-white shrink-0 shadow-md">
                                                            {student.student_photo || selectedAnnouncementForView.image_url
                                                                ? <img src={student.student_photo || selectedAnnouncementForView.image_url} alt={student.student_name} className="w-full h-full object-cover" />
                                                                : <div className="w-full h-full flex items-center justify-center text-amber-600 bg-amber-100"><User size={24} /></div>}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-sm font-black text-slate-900">{student.student_name}</h3>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                                {student.branch && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">{student.branch}</span>}
                                                                {student.year_sem && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800">{student.year_sem}</span>}
                                                                {student.roll_no && <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 font-mono">{student.roll_no}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Type 2: Event Details Banner */}
                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'event' && (selectedAnnouncementForView.event_date || selectedAnnouncementForView.event_venue) && (
                                    <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-2xl text-xs space-y-1">
                                        {selectedAnnouncementForView.event_date && (
                                            <div className="flex items-center gap-1.5 font-bold text-secondary">
                                                <Calendar size={13} className="text-secondary" />
                                                <span>Event Date: {selectedAnnouncementForView.event_date} {selectedAnnouncementForView.event_time ? `(${selectedAnnouncementForView.event_time})` : ''}</span>
                                            </div>
                                        )}
                                        {selectedAnnouncementForView.event_venue && (
                                            <div className="flex items-center gap-1.5 text-secondary font-medium">
                                                <MapPin size={13} className="text-secondary" />
                                                <span>Venue: {selectedAnnouncementForView.event_venue}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {selectedAnnouncementForView.image_url && (selectedAnnouncementForView.announcement_type || '').toLowerCase() !== 'circular' && (
                                    <div className="max-h-72 w-full overflow-hidden rounded-xl bg-sidebar relative">
                                        <img
                                            src={selectedAnnouncementForView.image_url}
                                            alt={selectedAnnouncementForView.title}
                                            className="w-full h-full object-contain max-h-72"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <h3 className="text-base font-bold text-main">
                                        {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'circular' ? 'Circular Remarks / Summary' : 'Announcement Description'}
                                    </h3>
                                    <p className="text-sm text-sub whitespace-pre-wrap leading-relaxed">
                                        {selectedAnnouncementForView.content}
                                    </p>
                                </div>
                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'circular' && (
                                    <div className="space-y-3 rounded-2xl border border-[var(--danger-light)] bg-[var(--danger-light)] p-4">
                                        <h3 className="text-sm font-bold text-danger">College-wise circular PDFs</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(parseCircularNumbers(selectedAnnouncementForView.circular_numbers)).map(([college, number]) => (
                                                <button
                                                    key={college}
                                                    type="button"
                                                    onClick={() => handleCircularDownload(selectedAnnouncementForView, college)}
                                                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--danger-light)] bg-surface px-3 py-2 text-xs font-semibold text-danger hover:bg-background"
                                                >
                                                    <FileDown size={14} /> {college} · {number}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-danger">
                                            {selectedAnnouncementForView.circular_signatory}
                                            {selectedAnnouncementForView.circular_designation ? ` · ${selectedAnnouncementForView.circular_designation}` : ''}
                                        </p>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-border text-xs text-muted-text">
                                    <span className="flex items-center gap-1 font-medium">
                                        <Users size={14} className="text-primary" />
                                        {selectedAnnouncementForView.audience_count || 0} Target Students
                                    </span>
                                    <span className="flex items-center gap-1 font-medium">
                                        <Clock size={14} className="text-warning" />
                                        {selectedAnnouncementForView.expires_at ? `Expires: ${new Date(selectedAnnouncementForView.expires_at).toLocaleString()}` : 'No Expiry'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${selectedAnnouncementForView.is_active ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'}`}>
                                        {selectedAnnouncementForView.is_active ? 'Active' : 'Hidden / Inactive'}
                                    </span>
                                </div>
                            </div>

                            {/* Event Registrations and Form Responses */}
                            {selectedAnnouncementForView.requires_registration && (
                                <div className="space-y-4">
                                    {/* Metrics Cards */}
                                    {(() => {
                                        const ann = registrationDetails.announcement || selectedAnnouncementForView;
                                        const totalCapacity = ann.max_seats ? Number(ann.max_seats) : null;
                                        const registeredCount = Number(ann.registered_count || (registrationDetails.registrations || []).length);
                                        const availableSeats = totalCapacity !== null ? Math.max(0, totalCapacity - registeredCount) : 'Unlimited';
                                        const percentFilled = totalCapacity ? Math.min(100, Math.round((registeredCount / totalCapacity) * 100)) : null;

                                        return (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs">
                                                        <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider block">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Response Limit' : 'Seat Capacity'}
                                                        </span>
                                                        <span className="text-2xl font-black text-main mt-1 block">
                                                            {totalCapacity !== null ? totalCapacity : 'Unlimited'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-text">Total allowed</span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs">
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Responses' : 'Registered'}
                                                        </span>
                                                        <span className="text-2xl font-black text-primary mt-1 block">
                                                            {registeredCount}
                                                        </span>
                                                        <span className="text-[10px] text-muted-text">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Student submissions' : 'Confirmed candidates'}
                                                        </span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs">
                                                        <span className="text-[10px] font-bold text-success uppercase tracking-wider block">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Remaining' : 'Available'}
                                                        </span>
                                                        <span className="text-2xl font-black text-success mt-1 block">
                                                            {availableSeats}
                                                        </span>
                                                        <span className="text-[10px] text-muted-text">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Response slots' : 'Seats remaining'}
                                                        </span>
                                                    </div>
                                                    <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs">
                                                        <span className="text-[10px] font-bold text-warning uppercase tracking-wider block">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Closing Date' : 'Deadline'}
                                                        </span>
                                                        <span className="text-xs font-bold text-main mt-2 block line-clamp-1">
                                                            {ann.registration_deadline ? new Date(ann.registration_deadline).toLocaleDateString() : 'No Deadline'}
                                                        </span>
                                                        <span className="text-[10px] text-muted-text">
                                                            {ann.registration_deadline ? new Date(ann.registration_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open anytime'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Capacity Progress Bar */}
                                                {totalCapacity && (
                                                    <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs space-y-1.5">
                                                        <div className="flex justify-between items-center text-xs font-bold">
                                                            <span className="text-sub">
                                                                {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Response Limit' : 'Seat Occupancy'}
                                                            </span>
                                                            <span className={percentFilled >= 100 ? 'text-danger' : 'text-primary'}>
                                                                {registeredCount} of {totalCapacity} ({percentFilled}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-background h-2.5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    percentFilled >= 100 ? 'bg-danger' : percentFilled >= 80 ? 'bg-warning' : 'bg-primary'
                                                                }`}
                                                                style={{ width: `${percentFilled}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Candidates Management Toolbar & Table */}
                                    <div className="bg-surface rounded-2xl border border-border shadow-2xs overflow-hidden">
                                        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="text-primary" size={18} />
                                                <h4 className="text-sm font-bold text-main">
                                                    {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Form Responses' : 'Registered Candidates'} ({registrationDetails.registrations?.length || 0})
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
                                                    <input
                                                        type="text"
                                                        placeholder={(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'Search responses...' : 'Search candidates...'}
                                                        value={registrationSearch}
                                                        onChange={(e) => setRegistrationSearch(e.target.value)}
                                                        className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none w-48 sm:w-60"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => fetchAnnouncementRegistrations(selectedAnnouncementForView.id)}
                                                    className="p-1.5 hover:bg-background rounded-lg text-muted-text"
                                                    title="Refresh list"
                                                >
                                                    <RefreshCw size={14} className={registrationsLoading ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Table */}
                                        {registrationsLoading ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-muted-text">
                                                <Loader2 size={24} className="animate-spin text-primary mb-2" />
                                                <span className="text-xs">Loading candidates...</span>
                                            </div>
                                        ) : (() => {
                                            const searchLower = registrationSearch.toLowerCase().trim();
                                            const filtered = (registrationDetails.registrations || []).filter(r => {
                                                if (!searchLower) return true;
                                                return (
                                                    (r.student_name && r.student_name.toLowerCase().includes(searchLower)) ||
                                                    (r.pin_number && r.pin_number.toLowerCase().includes(searchLower)) ||
                                                    (r.branch && r.branch.toLowerCase().includes(searchLower)) ||
                                                    (r.phone && r.phone.toLowerCase().includes(searchLower)) ||
                                                    (r.email && r.email.toLowerCase().includes(searchLower)) ||
                                                    JSON.stringify(r.form_responses || {}).toLowerCase().includes(searchLower)
                                                );
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="py-12 text-center text-muted-text space-y-1">
                                                        <Ticket size={28} className="mx-auto text-muted-text mb-2" />
                                                        <p className="text-sm font-semibold text-sub">
                                                            {(selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'No responses found' : 'No candidates found'}
                                                        </p>
                                                        <p className="text-xs text-muted-text">
                                                            {registrationSearch
                                                                ? ((selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'No responses matched your search.' : 'No registrations matched your search query.')
                                                                : ((selectedAnnouncementForView.announcement_type || '').toLowerCase() === 'form' ? 'No students have submitted a response yet.' : 'No students have registered yet for this event.')}
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            const formFields = registrationDetails.announcement?.registration_form_fields || selectedAnnouncementForView.registration_form_fields || [];

                                            return (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-[var(--background)]/80 border-b border-border text-muted-text font-bold uppercase tracking-wider text-[10px]">
                                                                <th className="py-3 px-4">#</th>
                                                                <th className="py-3 px-4">Student Name</th>
                                                                <th className="py-3 px-4">PIN / Roll No</th>
                                                                <th className="py-3 px-4">Branch & Year</th>
                                                                <th className="py-3 px-4">Contact</th>
                                                                <th className="py-3 px-4">Custom Responses</th>
                                                                <th className="py-3 px-4">Registered At</th>
                                                                <th className="py-3 px-4 text-center">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border">
                                                            {filtered.map((candidate, idx) => (
                                                                <tr key={candidate.id} className="hover:bg-[var(--primary-light)] transition-colors">
                                                                    <td className="py-3 px-4 font-mono text-muted-text">{idx + 1}</td>
                                                                    <td className="py-3 px-4 font-bold text-main">
                                                                        {candidate.student_name}
                                                                        {candidate.college && (
                                                                            <span className="block text-[10px] font-normal text-muted-text">{candidate.college}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono font-medium text-main">
                                                                        {candidate.pin_number}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-sub">
                                                                        <span className="font-semibold">{candidate.branch || 'N/A'}</span>
                                                                        <span className="block text-[10px] text-muted-text">
                                                                            {[candidate.current_year, candidate.current_semester].filter(Boolean).join(' • ') || '—'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-sub">
                                                                        <span className="font-medium">{candidate.phone || '—'}</span>
                                                                        <span className="block text-[10px] text-muted-text truncate max-w-[140px]">{candidate.email || '—'}</span>
                                                                    </td>
                                                                    <td className="py-3 px-4">
                                                                        {candidate.form_responses && Object.keys(candidate.form_responses).length > 0 ? (
                                                                            <div className="space-y-1 max-w-xs">
                                                                                {Object.entries(candidate.form_responses).map(([k, v], rIdx) => {
                                                                                    const matchedField = formFields.find(f => f.id === k || f.label === k);
                                                                                    const displayLabel = matchedField?.label || k;
                                                                                    return (
                                                                                        <div key={rIdx} className="text-[11px] leading-tight">
                                                                                            <span className="text-muted-text font-semibold">{displayLabel}: </span>
                                                                                            <span className="font-bold text-main">{String(v)}</span>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : candidate.custom_field_value ? (
                                                                            <span className="text-xs font-medium text-main bg-background px-2 py-0.5 rounded">
                                                                                {candidate.custom_field_value}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-muted-text italic">None</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-[11px] text-muted-text">
                                                                        {candidate.registered_at ? new Date(candidate.registered_at).toLocaleString('en-IN') : '—'}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveCandidate(selectedAnnouncementForView.id, candidate.id, candidate.student_name)}
                                                                            className="p-1.5 text-muted-text hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                                            title="Remove candidate registration (frees seat)"
                                                                        >
                                                                            <Trash2 size={15} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-background border-t flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedAnnouncementForView(null)}
                                className="px-5 py-2.5 bg-background hover:bg-background text-sub rounded-xl text-xs font-bold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
};

export default Announcements;
