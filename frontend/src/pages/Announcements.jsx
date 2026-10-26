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
    XCircle
} from 'lucide-react';
import api from '../config/api';
import toast from 'react-hot-toast';

import TargetSelector from '../components/TargetSelector';
import EventCalendar from './admin/EventCalendar';

const AnnouncementImage = ({ src, alt }) => {
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    if (hasError || !src) return null;

    return (
        <div className="mb-3 h-36 overflow-hidden rounded-lg bg-gray-100 relative">
            {!loaded && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <ImageIcon size={22} className="text-gray-400 opacity-60" />
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
        if (tab === 'events' || tab === 'calendar') return 'calendar';
        return 'announcements';
    };

    const [activeTab, setActiveTab] = useState(() => getTabFromUrl(searchParams));

    useEffect(() => {
        const target = getTabFromUrl(searchParams);
        setActiveTab(target);
    }, [searchParams]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        if (tabId === 'announcements') {
            setSearchParams({});
        } else if (tabId === 'calendar') {
            setSearchParams({ tab: 'events' });
        } else {
            setSearchParams({ tab: tabId });
        }
    };

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
        time_limit_option: '3', // '1', '3', '7', '30', 'none', 'custom'
        custom_expiry_date: '',
        // Event Registration & Seat Management
        requires_registration: false,
        max_seats: '',
        registration_deadline: '',
        custom_registration_field: '',
        default_profile_fields: INITIAL_DEFAULT_PROFILE_FIELDS.map(f => ({ ...f })), // Editable default profile fields
        registration_form_fields: [], // Dynamic Form Fields: [{ id, label, type, options, required }]
        // Poll specific
        question: '',
        options: ['', ''],
        start_time: '',
        end_time: '',
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
        if (activeTab === 'announcements') fetchAnnouncements();
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

    const openCreateModal = (type = 'announcements') => {
        setFormData(initialFormState);
        setEditId(null);
        setFormStep(1);
        handleTabChange(type);
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
        setFormStep(1);
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

            setFormData({
                ...initialFormState,
                title: item.title,
                content: item.content,
                time_limit_option: timeLimitOpt,
                custom_expiry_date: customExpiry,
                requires_registration: Boolean(item.requires_registration),
                max_seats: item.max_seats || '',
                registration_deadline: regDeadline,
                custom_registration_field: item.custom_registration_field || '',
                default_profile_fields: loadedDefaultFields,
                registration_form_fields: customFieldsFromItem,
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
            setFormData({
                ...initialFormState,
                question: item.question,
                options: Array.isArray(item.options) ? item.options : JSON.parse(item.options),
                start_time: formatDate(item.start_time),
                end_time: formatDate(item.end_time),
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
                    target_batch: onSmsBroadcast ? [] : formData.target_batch,
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
        if (!formData.title || !formData.content) return toast.error('Title and Content required');

        setLoading(true);
        const data = new FormData();
        data.append('title', formData.title);
        data.append('content', formData.content);
        if (formData.image) data.append('image', formData.image);
        if (editId && formData.existing_image_url && !formData.image) data.append('existing_image_url', formData.existing_image_url);

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
        data.append('requires_registration', formData.requires_registration ? '1' : '0');
        if (formData.requires_registration) {
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
        if (!formData.question || formData.options.filter(o => o.trim()).length < 2) return toast.error('Question and at least 2 options required');

        setLoading(true);
        const payload = {
            question: formData.question,
            options: formData.options.filter(o => o.trim()),
            start_time: formData.start_time || null,
            end_time: formData.end_time || null,
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
            fetchPolls();
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

        const formFields = announcement?.registration_form_fields || [];
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
                <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
                    <div className="flex justify-between items-start mb-3">
                        <div className="h-5 bg-gray-200 rounded w-2/3"></div>
                        <div className="flex gap-1">
                            <div className="w-8 h-8 bg-gray-100 rounded"></div>
                            <div className="w-8 h-8 bg-gray-100 rounded"></div>
                        </div>
                    </div>
                    <div className="h-32 bg-gray-100 rounded-lg mb-3"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-gray-50 rounded w-full"></div>
                        <div className="h-4 bg-gray-50 rounded w-5/6"></div>
                    </div>
                </div>
            ))}
        </div>
    );

    const PollSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-xl border p-6 animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="space-y-3 mb-6">
                        <div className="h-10 bg-gray-50 rounded"></div>
                        <div className="h-10 bg-gray-50 rounded"></div>
                    </div>
                    <div className="h-12 bg-gray-50 rounded-b-xl -mx-6 -mb-6"></div>
                </div>
            ))}
        </div>
    );

    const pageTitle = activeTab === 'polls' ? 'Polls' : activeTab === 'sms' ? 'SMS' : activeTab === 'calendar' ? 'Calendar' : 'Announcements';

    useEffect(() => {
        document.title = `${pageTitle} | Pydah Super Admin`;
    }, [pageTitle]);

    return (
        <div className="min-h-screen bg-transparent space-y-6 animate-fade-in relative">
            {/* Header with Page Name & Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-6 py-4 rounded-t-2xl shadow-sm overflow-hidden sticky top-0 z-30">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                        {pageTitle}
                    </h1>
                </div>

                {activeTab !== 'calendar' && activeTab !== 'sms' && (
                    <button
                        onClick={() => openCreateModal(activeTab)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transform transition-all hover:-translate-y-0.5"
                    >
                        <Plus size={18} strokeWidth={3} />
                        {activeTab === 'polls' ? 'Create New Poll' : 'Create New Announcement'}
                    </button>
                )}
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-b-2xl shadow-sm border border-gray-200 border-t-0 p-6 min-h-[400px]">
                {fetchingFeed && announcements.length === 0 && activeTab === 'announcements' && <AnnouncementSkeleton />}
                {fetchingFeed && activeTab === 'polls' && <PollSkeleton />}
                {fetchingFeed && (activeTab === 'sms' || activeTab === 'calendar') && (
                    <div className="flex justify-center py-10">
                        <Loader2 className="animate-spin text-blue-600" />
                    </div>
                )}

                {/* SMS View */}
                {activeTab === 'sms' && (
                    <div className="space-y-6">
                        {/* SMS Sub-tabs */}
                        <div className="flex gap-2 sm:gap-4 border-b pb-4 overflow-x-auto">
                            <button
                                onClick={() => setSmsMode('broadcast')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'broadcast' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Send size={16} /> Send Broadcast
                            </button>
                            <button
                                onClick={() => setSmsMode('templates')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'templates' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <LayoutTemplate size={16} /> Manage Templates
                            </button>
                            <button
                                onClick={() => {
                                    setSmsMode('history');
                                    fetchSmsHistory();
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${smsMode === 'history' ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <History size={16} /> SMS Sent Till Date
                            </button>
                        </div>

                        {smsMode === 'templates' ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold text-gray-800">SMS Templates</h3>
                                    <button
                                        onClick={() => openTemplateModal()}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
                                    >
                                        <Plus size={16} /> Create Template
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {smsTemplates.map(template => (
                                        <div key={template.id} className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-gray-900">{template.name}</h4>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => openTemplateModal(template)} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded"><Pencil size={14} /></button>
                                                    <button onClick={() => handleDeleteTemplate(template.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-500 mb-2 font-mono bg-gray-50 p-1 rounded w-fit">ID: {template.template_id}</div>
                                            <p className="text-sm text-gray-600 line-clamp-3">{template.content}</p>
                                        </div>
                                    ))}
                                    {smsTemplates.length === 0 && (
                                        <div className="col-span-full text-center py-10 text-gray-400">No templates found. Create one to get started.</div>
                                    )}
                                </div>
                            </div>
                        ) : smsMode === 'history' ? (
                            <div className="space-y-6">
                                {/* KPI Summary Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-gradient-to-br from-blue-50 to-white p-5 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
                                            <Smartphone size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-blue-900 uppercase tracking-wider">SMS Sent Till Date</div>
                                            <div className="text-2xl font-black text-gray-900 mt-0.5">
                                                {Number(smsHistory?.summary?.total_sent_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-0.5">All-time broadcast volume</div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-emerald-50 to-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-200">
                                            <CheckCircle2 size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Delivered</div>
                                            <div className="text-2xl font-black text-emerald-700 mt-0.5">
                                                {Number(smsHistory?.summary?.sent_count_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-emerald-600/80 mt-0.5">
                                                {smsHistory?.summary?.total_sent_all_time > 0
                                                    ? `${((smsHistory.summary.sent_count_all_time / smsHistory.summary.total_sent_all_time) * 100).toFixed(1)}% success rate`
                                                    : '100% success rate'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-rose-50 to-white p-5 rounded-2xl border border-rose-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200">
                                            <XCircle size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-rose-900 uppercase tracking-wider">Failed / Undelivered</div>
                                            <div className="text-2xl font-black text-rose-700 mt-0.5">
                                                {Number(smsHistory?.summary?.failed_count_all_time || 0).toLocaleString()}
                                            </div>
                                            <div className="text-[11px] text-rose-600/80 mt-0.5">
                                                {smsHistory?.summary?.total_sent_all_time > 0
                                                    ? `${((smsHistory.summary.failed_count_all_time / smsHistory.summary.total_sent_all_time) * 100).toFixed(1)}% failure rate`
                                                    : '0% failure rate'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
                                            <LayoutTemplate size={22} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Templates Used</div>
                                            <div className="text-2xl font-black text-indigo-700 mt-0.5">
                                                {smsHistory?.summary?.templates_used_all_time || 0}
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-0.5">Registered DLT templates</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Template Quick Stats Pills */}
                                {smsHistory?.perTemplate && smsHistory.perTemplate.length > 0 && (
                                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                                <LayoutTemplate size={14} className="text-blue-600" />
                                                SMS Sent Till Date by Template
                                            </span>
                                            <span className="text-xs text-slate-500 font-medium">
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
                                                                ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20 shadow-sm'
                                                                : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-1 mb-1">
                                                            <span className="font-semibold text-xs text-gray-900 truncate" title={pt.template_name}>
                                                                {pt.template_name}
                                                            </span>
                                                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                                                                {Number(pt.total_sent).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                                                            <span>ID: {pt.template_id}</span>
                                                            <span className="text-emerald-600 font-medium font-sans">
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
                                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <Filter size={16} className="text-blue-600" />
                                            <span className="text-sm font-bold text-gray-800">Filter Sent History</span>
                                        </div>
                                        {(historyFilters.date_from || historyFilters.date_to || historyFilters.template_id || historyFilters.search) && (
                                            <button
                                                type="button"
                                                onClick={handleResetHistoryFilters}
                                                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                                            >
                                                <RotateCcw size={12} /> Clear Filters
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Date From</label>
                                            <input
                                                type="date"
                                                value={historyFilters.date_from}
                                                onChange={(e) => handleHistoryFilterChange('date_from', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Date To</label>
                                            <input
                                                type="date"
                                                value={historyFilters.date_to}
                                                onChange={(e) => handleHistoryFilterChange('date_to', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Filter by Template</label>
                                            <select
                                                value={historyFilters.template_id}
                                                onChange={(e) => handleHistoryFilterChange('template_id', e.target.value)}
                                                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
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
                                            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">Search Keywords</label>
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
                                                    className="w-full text-xs p-2.5 pl-8 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action-wise Sent History Table */}
                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2 bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <History size={16} className="text-blue-600" />
                                            <h3 className="font-bold text-gray-800 text-sm">SMS Sent History by Action</h3>
                                            <span className="text-xs text-gray-500 font-medium">
                                                ({smsHistory?.pagination?.total || 0} broadcast actions)
                                            </span>
                                        </div>
                                        {historyLoading && (
                                            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold">
                                                <Loader2 size={14} className="animate-spin" /> Loading…
                                            </div>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-gray-50/80 text-[11px] uppercase tracking-wider font-bold text-gray-500 border-b border-gray-100">
                                                    <th className="py-3 px-4">Date & Time</th>
                                                    <th className="py-3 px-4">Template Used</th>
                                                    <th className="py-3 px-4">Count / Recipients</th>
                                                    <th className="py-3 px-4">Sent By</th>
                                                    <th className="py-3 px-4">Sample Message</th>
                                                    <th className="py-3 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 text-xs">
                                                {smsHistory?.history && smsHistory.history.length > 0 ? (
                                                    smsHistory.history.map((row, idx) => (
                                                        <tr key={`${row.action_date}-${row.template_id}-${idx}`} className="hover:bg-blue-50/40 transition-colors">
                                                            {/* Date & Time */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                                                    <Calendar size={13} className="text-blue-600" />
                                                                    {(row.first_sent_at || row.last_sent_at || row.action_date) ? new Date(row.first_sent_at || row.last_sent_at || row.action_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                                                </div>
                                                                <div className="text-[11px] text-gray-500 mt-0.5 pl-4">
                                                                    {row.last_sent_at ? new Date(row.last_sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}
                                                                </div>
                                                            </td>

                                                            {/* Template Used */}
                                                            <td className="py-3 px-4">
                                                                <div className="font-bold text-gray-900">{row.template_name || 'Direct / Custom Template'}</div>
                                                                <div className="text-[10px] text-gray-500 font-mono mt-0.5 bg-gray-100 px-1.5 py-0.5 rounded w-fit">
                                                                    DLT ID: {row.template_id || 'N/A'}
                                                                </div>
                                                            </td>

                                                            {/* Count / Recipients */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-gray-900 text-sm">
                                                                        {Number(row.total_count || 0).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-[10px] text-gray-400 font-medium">total</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                        <CheckCircle2 size={10} /> {Number(row.sent_count || 0).toLocaleString()}
                                                                    </span>
                                                                    {Number(row.failed_count || 0) > 0 && (
                                                                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                            <XCircle size={10} /> {Number(row.failed_count || 0).toLocaleString()}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Sent By */}
                                                            <td className="py-3 px-4 whitespace-nowrap">
                                                                <span className="inline-block px-2 py-1 rounded-lg text-[11px] font-medium bg-slate-100 text-slate-700">
                                                                    {row.sent_by || 'System Generated'}
                                                                </span>
                                                            </td>

                                                            {/* Sample Message Preview */}
                                                            <td className="py-3 px-4 max-w-xs">
                                                                <p className="text-gray-600 text-xs line-clamp-2 font-mono bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                                                    {row.sample_message || 'No content preview available'}
                                                                </p>
                                                            </td>

                                                            {/* Action */}
                                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedHistoryItem(row)}
                                                                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg text-xs transition-colors"
                                                                >
                                                                    View Details
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-12 text-gray-400">
                                                            <div className="flex flex-col items-center justify-center gap-2">
                                                                <History size={32} className="text-gray-300" />
                                                                <p className="text-sm font-medium text-gray-500">No SMS broadcast records found matching criteria.</p>
                                                                {(historyFilters.date_from || historyFilters.date_to || historyFilters.template_id || historyFilters.search) && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={handleResetHistoryFilters}
                                                                        className="text-xs text-blue-600 hover:underline mt-1 font-semibold"
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
                                        <div className="p-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3 bg-gray-50/50">
                                            <div className="text-xs text-gray-500">
                                                Showing Page <strong className="text-gray-800">{smsHistory.pagination.page}</strong> of{' '}
                                                <strong className="text-gray-800">{smsHistory.pagination.totalPages}</strong> ({smsHistory.pagination.total} total actions)
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={smsHistory.pagination.page <= 1 || historyLoading}
                                                    onClick={() => handleHistoryPageChange(smsHistory.pagination.page - 1)}
                                                    className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                                                >
                                                    <ChevronLeft size={14} /> Previous
                                                </button>
                                                <div className="text-xs font-bold text-gray-700 px-2">
                                                    {smsHistory.pagination.page} / {smsHistory.pagination.totalPages}
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={smsHistory.pagination.page >= smsHistory.pagination.totalPages || historyLoading}
                                                    onClick={() => handleHistoryPageChange(smsHistory.pagination.page + 1)}
                                                    className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
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
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start h-full">
                                            {/* Left Column: Template Selection & Preview */}
                                            <div className="lg:col-span-5 space-y-6 border-r border-gray-100 pr-8 overflow-y-auto scrollbar-hide">
                                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 sticky top-0 bg-white z-10 py-2">
                                                    <LayoutTemplate className="text-blue-500" size={20} />
                                                    Template Configuration
                                                </h3>

                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Template</label>
                                                        <div className="relative">
                                                            <select
                                                                className="w-full p-3 pl-4 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 hover:bg-white transition-all appearance-none cursor-pointer text-gray-700 font-medium shadow-sm"
                                                                value={selectedTemplate?.id || ''}
                                                                onChange={handleTemplateSelect}
                                                            >
                                                                <option value="">-- Choose a Template --</option>
                                                                {smsTemplates.map(t => (
                                                                    <option key={t.id} value={t.id}>{t.name} ({t.template_id})</option>
                                                                ))}
                                                            </select>
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                                <ChevronDown size={18} />
                                                            </div>
                                                        </div>

                                                        {/* Selected Template Sent Till Date Info */}
                                                        {selectedTemplate && (() => {
                                                            const tmplStats = smsHistory?.perTemplate?.find(t => String(t.template_id) === String(selectedTemplate.template_id));
                                                            if (!tmplStats) return null;
                                                            return (
                                                                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-2.5 text-xs text-blue-900 flex items-center justify-between mt-2">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                                                        <span>Sent till date: <strong className="font-bold">{Number(tmplStats.total_sent).toLocaleString()}</strong> SMS</span>
                                                                        <span className="text-blue-700/80">({Number(tmplStats.sent_count).toLocaleString()} sent{tmplStats.failed_count > 0 ? `, ${tmplStats.failed_count} failed` : ''})</span>
                                                                    </div>
                                                                    {tmplStats.last_used_at && (
                                                                        <span className="text-[10px] text-blue-600 font-medium">Last used: {new Date(tmplStats.last_used_at).toLocaleDateString()}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}

                                                        <div className="flex justify-end mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSmsMode('templates')}
                                                                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
                                                            >
                                                                <Settings size={12} /> Manage Templates
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {selectedTemplate && (
                                                        <div className="animate-fade-in space-y-4">
                                                            {/* Send-time variable values (editable; defaults from template) */}
                                                            {formData.variable_mappings.length > 0 ? (
                                                                <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Settings size={14} className="text-amber-700" />
                                                                        <label className="text-xs font-bold text-amber-800 uppercase">Set Variable Values Before Sending</label>
                                                                    </div>
                                                                    <p className="text-xs text-amber-700/80 mb-3">
                                                                        Defaults from the template are pre-filled. Change them here for this broadcast only — enter a static value or pick a student field.
                                                                    </p>
                                                                    <div className="space-y-3">
                                                                        {formData.variable_mappings.map((mapping, idx) => (
                                                                            <div key={idx} className="flex flex-wrap gap-2 items-center bg-white p-2.5 rounded-lg border border-amber-100 shadow-sm">
                                                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0">var#{idx + 1}</span>
                                                                                <select
                                                                                    className="p-1.5 border rounded-lg text-xs bg-white min-w-[90px]"
                                                                                    value={mapping.type || 'static'}
                                                                                    onChange={(e) => handleMappingChange(idx, 'type', e.target.value)}
                                                                                >
                                                                                    <option value="static">Static (enter now)</option>
                                                                                    <option value="field">Student field</option>
                                                                                </select>
                                                                                {mapping.type === 'field' ? (
                                                                                    <select
                                                                                        className="flex-1 min-w-[140px] p-1.5 border rounded-lg text-xs bg-white"
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
                                                                <p className="text-xs text-gray-500 bg-gray-50 border rounded-lg p-3">
                                                                    This template has no {'{#var#}'} placeholders — message will send as-is.
                                                                </p>
                                                            )}

                                                            {/* Message Preview */}
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Message Preview</label>
                                                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl rounded-tr-none border border-blue-100 shadow-sm relative">
                                                                    <div className="absolute -right-2 -top-2 bg-blue-600 text-white p-1 rounded-full shadow-md">
                                                                        <MessageSquare size={12} />
                                                                    </div>
                                                                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                                                                        {getSendTimePreview()}
                                                                    </p>
                                                                    <div className="mt-2 flex justify-end">
                                                                        <span className="text-[10px] text-gray-400 font-medium uppercase">SMS Preview</span>
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

                                                <div className="mt-auto pt-6 border-t border-gray-100 bg-white">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <div className="text-sm text-gray-500">
                                                            <p className="font-medium text-gray-700">Ready to broadcast?</p>
                                                            <p className="text-xs">
                                                                {!selectedTemplate
                                                                    ? 'Select a template first'
                                                                    : fetchingCount
                                                                        ? 'Estimate: counting…'
                                                                        : `Estimate: ${audienceCount ?? 0} students`}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={loading || !selectedTemplate}
                                                            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 flex items-center gap-3 shadow-lg hover:shadow-green-500/30 transform transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none min-w-[200px] justify-center"
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
                    activeTab === 'announcements' && (!fetchingFeed || announcements.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {announcements.map(ann => (
                                <div
                                    key={ann.id}
                                    onClick={() => handleOpenAnnouncementDetails(ann)}
                                    className={`bg-white rounded-2xl shadow-sm border p-4 group hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between ${!ann.is_active ? 'opacity-75 grayscale' : ''}`}
                                >
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-900 line-clamp-1 group-hover:text-blue-600 transition-colors">{ann.title}</h4>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleStatus(ann.id, ann.is_active, 'announcements'); }}
                                                    className="p-1.5 hover:bg-gray-100 rounded text-gray-500"
                                                    title={ann.is_active ? 'Active (Click to hide)' : 'Hidden (Click to show)'}
                                                >
                                                    {ann.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(ann, 'announcements'); }}
                                                    className="p-1.5 hover:bg-blue-50 text-blue-500 rounded"
                                                    title="Edit announcement"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(ann.id, 'announcements'); }}
                                                    className="p-1.5 hover:bg-red-50 text-red-500 rounded"
                                                    title="Delete announcement"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Registration Status Pill */}
                                        {ann.requires_registration ? (
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <Ticket size={12} className="text-indigo-600" />
                                                    <span>{ann.registered_count || 0}{ann.max_seats ? `/${ann.max_seats}` : ''} Registered</span>
                                                </span>
                                                {ann.is_full ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 uppercase tracking-wider">Seats Full</span>
                                                ) : ann.max_seats ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                                                        {ann.available_seats} seats left
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {ann.image_url ? (
                                            <AnnouncementImage src={ann.image_url} alt={ann.title} />
                                        ) : (
                                            <div className="mb-3 h-36 overflow-hidden rounded-lg bg-slate-900 relative">
                                                <img
                                                    src="/images/announcement-fallback.jpg"
                                                    alt="Announcement"
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <p className="text-sm text-gray-500 mb-3 line-clamp-2">{ann.content}</p>
                                    </div>

                                    <div>
                                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1.5 font-medium">
                                                <Clock size={12} className={ann.expires_at && new Date(ann.expires_at) < new Date() ? 'text-red-500' : 'text-blue-500'} />
                                                {ann.expires_at ? (
                                                    new Date(ann.expires_at) < new Date() ? (
                                                        <span className="text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">Expired</span>
                                                    ) : (
                                                        <span className="text-blue-600 font-semibold">Expires {new Date(ann.expires_at).toLocaleDateString()}</span>
                                                    )
                                                ) : (
                                                    <span className="text-gray-400">No Time Limit</span>
                                                )}
                                            </div>
                                            {ann.audience_count > 0 && (
                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold">{ann.audience_count} Reach</span>
                                            )}
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between text-xs text-blue-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                                            <span>{ann.requires_registration ? 'View Registered Candidates' : 'Click to View Details'}</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {announcements.length === 0 && !fetchingFeed && (
                                <div className="col-span-full text-center py-10 text-gray-500">No announcements found.</div>
                            )}
                        </div>
                    )
                }

                {/* Polls list */}
                {activeTab === 'polls' && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {polls.map(poll => (
                            <div key={poll.id} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 group hover:shadow-md transition-all ${!poll.is_active ? 'opacity-75' : ''}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-900 text-lg line-clamp-2">{poll.question}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-bold">
                                                {poll.audience_count || poll.stats?.assigned || 0} Students
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => toggleStatus(poll.id, poll.is_active, 'polls')} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                                            {poll.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button onClick={() => openEditModal(poll, 'polls')} className="p-1.5 hover:bg-blue-50 text-blue-500 rounded-lg"><Pencil size={16} /></button>
                                        <button onClick={() => handleDelete(poll.id, 'polls')} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
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
                                                    <span className="font-medium text-gray-700">{opt}</span>
                                                    <span className="text-gray-400 font-bold text-[10px]">{count} votes ({percent}%)</span>
                                                </div>
                                                <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-[10px] text-gray-500 mt-6 pt-4">
                                    <div className="flex gap-4">
                                        <span className="flex items-center gap-1 font-semibold" title="Assigned Students"><Users size={12} /> {poll.stats?.assigned || 0}</span>
                                        <span className="flex items-center gap-1 font-semibold" title="Total Votes"><BarChart2 size={12} /> {poll.stats?.votes || 0}</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
                                        <Clock size={12} className="text-amber-500" />
                                        {poll.end_time ? `Deadline: ${new Date(poll.end_time).toLocaleDateString()}` : 'No deadline'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {
                    activeTab === 'calendar' && (
                        <div className="-m-6">
                            <EventCalendar isEmbedded={true} />
                        </div>
                    )
                }
            </div >

            {/* General Modal (Announcements/Polls) */}
            {isCreateModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                                    {editId ? <Pencil size={24} /> : <PlusCircle size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {editId ? 'Edit Item' : (activeTab === 'announcements' ? 'New Announcement' : 'New Poll')}
                                        </h2>
                                        {activeTab === 'announcements' && formData.requires_registration && (
                                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                <Ticket size={12} /> Step {formStep} of 2
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        {activeTab === 'announcements' && formStep === 2
                                            ? 'Step 2: Configure Seat Capacity, Deadlines & Dynamic Registration Questions'
                                            : 'Configure your broadcast targets and content'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {/* Live Audience Indicator */}
                                <div className="hidden md:flex flex-col items-end px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Estimated Reach</span>
                                    <div className="flex items-center gap-2">
                                        {fetchingCount ? (
                                            <Loader2 size={12} className="animate-spin text-blue-500" />
                                        ) : (
                                            <Users size={12} className="text-blue-500" />
                                        )}
                                        <span className="text-sm font-black text-gray-900">{audienceCount ?? '...'} Students</span>
                                    </div>
                                </div>
                                <button onClick={handleCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Stepper Navigation Bar when registrations are enabled */}
                        {activeTab === 'announcements' && formData.requires_registration && (
                            <div className="px-6 py-2.5 bg-gray-50 border-b flex items-center gap-4 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setFormStep(1)}
                                    className={`flex items-center gap-2 py-1 px-3 rounded-lg transition-all ${
                                        formStep === 1
                                            ? 'bg-blue-600 text-white shadow-xs'
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
                                    Announcement Details & Audience
                                </button>
                                <ChevronRight size={14} className="text-gray-400" />
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
                                            ? 'bg-indigo-600 text-white shadow-xs'
                                            : 'text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
                                    Event Registration & Dynamic Form
                                </button>
                            </div>
                        )}

                        <div className="p-6 overflow-y-auto bg-gray-50/30">
                            <form onSubmit={activeTab === 'announcements' ? handleSubmitAnnouncement : handleSubmitPoll} className="space-y-6">
                                {activeTab === 'announcements' && formStep === 2 && formData.requires_registration ? (
                                    /* =================== STEP 2: DYNAMIC REGISTRATION FORM & SEATS =================== */
                                    <div className="space-y-6 animate-fade-in">
                                        {/* Step 2 Banner */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">2</div>
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-900">Configure Event Registration & Custom Questions</h3>
                                                    <p className="text-xs text-gray-500">Manage seat limits, registration deadline, and add custom fields for students to answer.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setFormStep(1)}
                                                className="text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-200 flex items-center gap-1 shadow-2xs self-start sm:self-auto transition-colors"
                                            >
                                                <ChevronLeft size={14} /> Back to Step 1
                                            </button>
                                        </div>

                                        {/* Seat Capacity & Registration Deadline */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-white rounded-2xl border border-gray-200 shadow-xs">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                    <Users size={14} className="text-indigo-600" />
                                                    Seat Capacity (Max Seats)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    placeholder="Leave empty for Unlimited seats"
                                                    value={formData.max_seats}
                                                    onChange={(e) => setFormData({ ...formData, max_seats: e.target.value })}
                                                    className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                                />
                                                <span className="text-[11px] text-gray-500 mt-1 block">Maximum number of candidate registrations allowed.</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-indigo-600" />
                                                    Registration Deadline
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.registration_deadline}
                                                    onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                                                    className="w-full text-sm p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                                                />
                                                <span className="text-[11px] text-gray-500 mt-1 block">Registration will automatically close after this date & time.</span>
                                            </div>
                                        </div>

                                        {/* Editable Default Student Profile Data Card */}
                                        <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                                        <h4 className="text-sm font-bold text-gray-900">Default Student Profile Fields</h4>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                            {(formData.default_profile_fields || INITIAL_DEFAULT_PROFILE_FIELDS).filter(f => f.enabled).length} of 7 Active
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Pre-filled from the student profile. You can edit field labels, toggle required, or uncheck fields you don't need.
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={resetDefaultFields}
                                                    className="text-xs font-semibold text-gray-500 hover:text-indigo-600 flex items-center gap-1 self-start sm:self-auto transition-colors"
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
                                                                ? 'bg-slate-50/80 border-slate-200 shadow-2xs'
                                                                : 'bg-gray-100/60 border-dashed border-gray-300 opacity-60'
                                                        }`}
                                                    >
                                                        {/* Enable / Disable Checkbox */}
                                                        <input
                                                            type="checkbox"
                                                            checked={field.enabled}
                                                            onChange={(e) => updateDefaultField(field.key, 'enabled', e.target.checked)}
                                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
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
                                                                        ? 'bg-white border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800'
                                                                        : 'bg-transparent border-transparent text-gray-400 cursor-not-allowed'
                                                                }`}
                                                            />
                                                            <span className="text-[10px] text-gray-400 block px-1 mt-0.5 font-medium truncate">
                                                                Auto-fills: <code className="text-gray-500">{field.key}</code>
                                                            </span>
                                                        </div>

                                                        {/* Required Toggle */}
                                                        <label className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer shrink-0 select-none ${
                                                            field.enabled ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 cursor-not-allowed'
                                                        }`}>
                                                            <input
                                                                type="checkbox"
                                                                disabled={!field.enabled}
                                                                checked={Boolean(field.required)}
                                                                onChange={(e) => updateDefaultField(field.key, 'required', e.target.checked)}
                                                                className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                                                            />
                                                            <span>Required</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Dynamic Registration Form Questions Builder */}
                                        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                                        <FileText size={16} className="text-indigo-600" />
                                                        Dynamic Registration Form Fields
                                                    </h4>
                                                    <p className="text-xs text-gray-500">Add custom questions to collect specific information for this event.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => addFormField()}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-xs transition-colors"
                                                >
                                                    <Plus size={14} /> Add Question
                                                </button>
                                            </div>

                                            {/* Questions list */}
                                            {(!formData.registration_form_fields || formData.registration_form_fields.length === 0) ? (
                                                <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-2xl">
                                                    <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2">
                                                        <FileText size={20} />
                                                    </div>
                                                    <p className="text-sm font-semibold text-gray-700">No custom questions added yet</p>
                                                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                                                        Click "+ Add Question" above to add event-specific questions (e.g. food preference, t-shirt size, project link).
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {formData.registration_form_fields.map((field, idx) => (
                                                        <div key={field.id || idx} className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-3 relative">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded-md border border-indigo-100">
                                                                    Field #{idx + 1}
                                                                </span>
                                                                <div className="flex items-center gap-3">
                                                                    <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(field.required)}
                                                                            onChange={(e) => updateFormField(idx, 'required', e.target.checked)}
                                                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                                                        />
                                                                        <span>Required field</span>
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeFormField(idx)}
                                                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Delete field"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                <div className="sm:col-span-2">
                                                                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                                                        Field Label / Question
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={field.label || ''}
                                                                        onChange={(e) => updateFormField(idx, 'label', e.target.value)}
                                                                        placeholder="e.g. Food Preference (Veg/Non-Veg)"
                                                                        className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                                                        Field Type
                                                                    </label>
                                                                    <select
                                                                        value={field.type || 'text'}
                                                                        onChange={(e) => updateFormField(idx, 'type', e.target.value)}
                                                                        className="w-full text-xs p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
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
                                                                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                                                                        Options (Separated by comma)
                                                                    </label>
                                                                    <input
                                                                        type="text"
                                                                        value={field.options || ''}
                                                                        onChange={(e) => updateFormField(idx, 'options', e.target.value)}
                                                                        placeholder="e.g. Veg, Non-Veg, Jain"
                                                                        className="w-full text-xs p-2.5 border border-indigo-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        onClick={() => addFormField()}
                                                        className="w-full py-2.5 border border-dashed border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
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
                                                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
                                            >
                                                <ChevronLeft size={16} /> Back to Announcement Details
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-70"
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                                <span>{loading ? 'Publishing...' : (editId ? 'Update Announcement & Form' : 'Publish Announcement & Registration')}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* =================== STEP 1: SAME OLD FLOW WITH REGISTRATION TOGGLE =================== */
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                {activeTab === 'announcements' ? (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                                placeholder="Enter title"
                                                                value={formData.title}
                                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                                            <textarea
                                                                className="w-full p-2 border border-gray-300 rounded-lg h-32 focus:ring-2 focus:ring-blue-500"
                                                                placeholder="Enter details..."
                                                                value={formData.content}
                                                                onChange={e => setFormData({ ...formData, content: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100 space-y-2">
                                                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5 uppercase tracking-wider">
                                                                <Clock size={14} className="text-blue-600" />
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
                                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                                        }`}
                                                                    >
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {formData.time_limit_option === 'custom' && (
                                                                <input
                                                                    type="datetime-local"
                                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white mt-2"
                                                                    value={formData.custom_expiry_date || ''}
                                                                    onChange={e => setFormData({ ...formData, custom_expiry_date: e.target.value })}
                                                                />
                                                            )}
                                                            <p className="text-[11px] text-gray-500 font-medium">
                                                                {formData.time_limit_option !== 'none' && formData.time_limit_option !== 'custom' && (
                                                                    <span>⏱️ Popup & feed notice will be active for <strong>{formData.time_limit_option} days</strong> and then automatically stop displaying to students.</span>
                                                                )}
                                                                {formData.time_limit_option === 'none' && (
                                                                    <span>♾️ Announcement will stay active until manually toggled or deleted.</span>
                                                                )}
                                                                {formData.time_limit_option === 'custom' && formData.custom_expiry_date && (
                                                                    <span>⏱️ Auto-expires on <strong>{new Date(formData.custom_expiry_date).toLocaleString()}</strong>.</span>
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Image (Optional)</label>
                                                            {formData.existing_image_url && !formData.image && (
                                                                <div className="mb-2 h-20 w-32 relative group">
                                                                    <img src={formData.existing_image_url} alt="Current" className="h-full w-full object-cover rounded border" />
                                                                    <button type="button" onClick={() => setFormData({ ...formData, existing_image_url: null })} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"><X size={12} /></button>
                                                                </div>
                                                            )}
                                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors relative">
                                                                <input type="file" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                                                <div className="flex flex-col items-center gap-2 text-gray-500">
                                                                    {formData.previewUrl ? (
                                                                        <div className="relative w-full h-48 mb-2">
                                                                            <img src={formData.previewUrl} alt="Preview" className="w-full h-full object-contain rounded-md" />
                                                                            <div className="text-xs mt-1 text-blue-600 font-semibold">Click to change</div>
                                                                        </div>
                                                                    ) : (
                                                                        <>
                                                                            <ImageIcon size={24} />
                                                                            <span className="text-sm">{formData.image ? formData.image.name : 'Click to update image'}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Poll Question</label>
                                                            <input
                                                                type="text"
                                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                                placeholder="Ask something..."
                                                                value={formData.question}
                                                                onChange={e => setFormData({ ...formData, question: e.target.value })}
                                                            />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-700 mb-1">Start Time</label>
                                                                <input
                                                                    type="datetime-local"
                                                                    className="w-full p-2 border rounded-lg text-sm"
                                                                    value={formData.start_time || ''}
                                                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-semibold text-gray-700 mb-1">End Time</label>
                                                                <input
                                                                    type="datetime-local"
                                                                    className="w-full p-2 border rounded-lg text-sm"
                                                                    value={formData.end_time || ''}
                                                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
                                                            <div className="space-y-2">
                                                                {formData.options.map((opt, idx) => (
                                                                    <div key={idx} className="flex gap-2">
                                                                        <input
                                                                            type="text"
                                                                            className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                                            placeholder={`Option ${idx + 1}`}
                                                                            value={opt}
                                                                            onChange={e => updateOption(idx, e.target.value)}
                                                                        />
                                                                        {formData.options.length > 2 && (
                                                                            <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded"><MinusCircle size={20} /></button>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                                {formData.options.length < 6 && (
                                                                    <button type="button" onClick={addOption} className="text-blue-600 text-sm font-semibold flex items-center gap-1 mt-2">
                                                                        <PlusCircle size={16} /> Add Option
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <TargetSelector formData={formData} setFormData={setFormData} />
                                        </div>

                                        <div className="flex justify-end pt-4 border-t gap-3">
                                            <button type="button" onClick={handleCancel} className="px-5 py-2.5 border rounded-xl text-gray-600 hover:bg-gray-50 font-medium">Cancel</button>
                                            {activeTab === 'announcements' && formData.requires_registration ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (!formData.title?.trim() || !formData.content?.trim()) {
                                                            return toast.error('Please enter Title and Content first');
                                                        }
                                                        setFormStep(2);
                                                    }}
                                                    className="bg-indigo-600 text-white px-7 py-2.5 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all"
                                                >
                                                    <span>Next: Configure Registration Form</span>
                                                    <ChevronRight size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-70"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                                                    {loading ? (formData.image ? 'Uploading post...' : 'Submitting...') : (editId ? 'Update' : (activeTab === 'announcements' ? 'Post' : 'Create Poll'))}
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Settings className="text-blue-600" size={20} />
                                {editId ? 'Edit SMS Template' : 'Create SMS Template'}
                            </h2>
                            <button onClick={handleCancel} className="p-2 hover:bg-gray-200 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSaveTemplate} className="space-y-4">
                                <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mb-4">
                                    <h4 className="font-bold flex items-center gap-1 mb-1"><MessageSquare size={14} /> Guide</h4>
                                    <p>Use <code>{'{#var#}'}</code> as placeholder for variables in content.</p>
                                    <p className="mt-1">Optional defaults below are pre-filled when sending. Final values can still be entered or changed on the <strong>Send Broadcast</strong> screen.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Template Name (Internal)</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded bg-white"
                                        placeholder="e.g. Absent Alert"
                                        value={formData.template_name}
                                        onChange={e => setFormData({ ...formData, template_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DLT Template ID</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full p-2 border rounded bg-white"
                                        placeholder="1007..."
                                        value={formData.template_id}
                                        onChange={e => setFormData({ ...formData, template_id: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                                    <textarea
                                        required
                                        className="w-full p-2 border rounded bg-white h-24"
                                        placeholder="Content with {#var#}..."
                                        value={formData.template_content}
                                        onChange={e => handleTemplateContentChange(e.target.value)}
                                    />
                                </div>

                                {formData.variable_mappings.length > 0 ? (
                                    <div className="space-y-3 bg-gray-50 p-3 rounded border">
                                        <label className="block text-xs font-bold text-gray-500 uppercase">Default Variable Mappings (optional)</label>
                                        <p className="text-xs text-gray-500">Detected {formData.variable_mappings.length} placeholder(s). These defaults appear on Send Broadcast — you can override them before sending.</p>
                                        {formData.variable_mappings.map((mapping, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <span className="text-xs font-mono text-gray-500 w-12">var#{idx + 1}</span>
                                                <select
                                                    className="p-1 border rounded text-xs bg-white"
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
                                                        className="flex-1 p-1 border rounded text-xs bg-white"
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
                                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded p-2">
                                            No {'{#var#}'} placeholders found yet. Add them in content to configure variable mapping.
                                        </p>
                                    )
                                )}

                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                                    <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded text-sm font-bold hover:bg-blue-700">
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
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                                <Smartphone className="text-green-600" size={20} />
                                Select Target Mobile Numbers
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsMobileTargetModalOpen(false)}
                                className="p-2 hover:bg-gray-200 rounded-full text-gray-500"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">
                                Choose one or more number types to receive this SMS broadcast.
                            </p>

                            <div className="space-y-2">
                                {[
                                    { key: 'student_mobile', label: 'Student Mobile Number' },
                                    { key: 'parent_mobile1', label: 'Parent 1 Mobile Number 1' },
                                    { key: 'parent_mobile2', label: 'Parent 1 Mobile Number 2' }
                                ].map((target) => (
                                    <label key={target.key} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedMobileTargets.includes(target.key)}
                                            onChange={() => toggleMobileTarget(target.key)}
                                            className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">{target.label}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsMobileTargetModalOpen(false)}
                                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmBroadcastSend}
                                    disabled={loading}
                                    className="bg-green-600 text-white px-5 py-2 rounded text-sm font-bold hover:bg-green-700 disabled:opacity-70 flex items-center gap-2"
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
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-scale-in flex flex-col border border-gray-100">
                        <div className="p-5 border-b flex justify-between items-center bg-gray-50/70">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                                    <History size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-base">Broadcast Action Details</h3>
                                    <p className="text-xs text-gray-500">
                                        Sent on {(selectedHistoryItem.first_sent_at || selectedHistoryItem.last_sent_at || selectedHistoryItem.action_date) ? new Date(selectedHistoryItem.first_sent_at || selectedHistoryItem.last_sent_at || selectedHistoryItem.action_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryItem(null)}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                            {/* Template Info Card */}
                            <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                                <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Template Used</div>
                                <div className="text-base font-bold text-gray-900">{selectedHistoryItem.template_name || 'Direct / Custom SMS'}</div>
                                <div className="text-xs text-gray-600 font-mono mt-1 bg-white px-2 py-0.5 rounded border border-blue-200 inline-block">
                                    DLT ID: {selectedHistoryItem.template_id || 'N/A'}
                                </div>
                            </div>

                            {/* Metrics 3-column grid */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-center">
                                    <div className="text-[10px] font-bold text-gray-500 uppercase">Total Count</div>
                                    <div className="text-xl font-bold text-gray-900 mt-0.5">
                                        {Number(selectedHistoryItem.total_count || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                                    <div className="text-[10px] font-bold text-emerald-700 uppercase">Delivered</div>
                                    <div className="text-xl font-bold text-emerald-700 mt-0.5">
                                        {Number(selectedHistoryItem.sent_count || 0).toLocaleString()}
                                    </div>
                                </div>
                                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
                                    <div className="text-[10px] font-bold text-rose-700 uppercase">Failed</div>
                                    <div className="text-xl font-bold text-rose-700 mt-0.5">
                                        {Number(selectedHistoryItem.failed_count || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Additional Details */}
                            <div className="space-y-2 text-xs border-t border-b border-gray-100 py-3">
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-500">Triggered / Raised By:</span>
                                    <span className="font-semibold text-gray-800">{selectedHistoryItem.sent_by || 'System Generated'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-500">First Sent At:</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedHistoryItem.first_sent_at ? new Date(selectedHistoryItem.first_sent_at).toLocaleString() : '—'}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-gray-500">Last Sent At:</span>
                                    <span className="font-semibold text-gray-800">
                                        {selectedHistoryItem.last_sent_at ? new Date(selectedHistoryItem.last_sent_at).toLocaleString() : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Message Preview */}
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Message Content / Sample</label>
                                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono leading-relaxed whitespace-pre-wrap border border-slate-800 shadow-inner">
                                    {selectedHistoryItem.sample_message || 'No sample message available'}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedHistoryItem(null)}
                                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
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
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl my-6 overflow-hidden animate-scale-in flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="p-6 border-b flex justify-between items-center bg-white z-10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedAnnouncementForView.requires_registration ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {selectedAnnouncementForView.requires_registration ? <Ticket size={24} /> : <Megaphone size={24} />}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{selectedAnnouncementForView.title}</h2>
                                        {selectedAnnouncementForView.requires_registration ? (
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                                                Event Registration
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                                                Broadcast Notice
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">
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
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                                    >
                                        <Download size={15} />
                                        <span>Export CSV</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedAnnouncementForView(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 bg-gray-50/50">
                            {/* Announcement Content & Image Preview */}
                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                {selectedAnnouncementForView.image_url && (
                                    <div className="max-h-72 w-full overflow-hidden rounded-xl bg-slate-900 relative">
                                        <img
                                            src={selectedAnnouncementForView.image_url}
                                            alt={selectedAnnouncementForView.title}
                                            className="w-full h-full object-contain max-h-72"
                                        />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <h3 className="text-base font-bold text-gray-900">Announcement Description</h3>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                        {selectedAnnouncementForView.content}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                                    <span className="flex items-center gap-1 font-medium">
                                        <Users size={14} className="text-blue-500" />
                                        {selectedAnnouncementForView.audience_count || 0} Target Students
                                    </span>
                                    <span className="flex items-center gap-1 font-medium">
                                        <Clock size={14} className="text-amber-500" />
                                        {selectedAnnouncementForView.expires_at ? `Expires: ${new Date(selectedAnnouncementForView.expires_at).toLocaleString()}` : 'No Expiry'}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${selectedAnnouncementForView.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                                        {selectedAnnouncementForView.is_active ? 'Active' : 'Hidden / Inactive'}
                                    </span>
                                </div>
                            </div>

                            {/* Event Registration & Seat Management Section */}
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
                                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Seat Capacity</span>
                                                        <span className="text-2xl font-black text-gray-900 mt-1 block">
                                                            {totalCapacity !== null ? totalCapacity : 'Unlimited'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">Total allowed</span>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                                                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Registered</span>
                                                        <span className="text-2xl font-black text-indigo-600 mt-1 block">
                                                            {registeredCount}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">Confirmed candidates</span>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Available</span>
                                                        <span className="text-2xl font-black text-emerald-600 mt-1 block">
                                                            {availableSeats}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">Seats remaining</span>
                                                    </div>
                                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                                                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Deadline</span>
                                                        <span className="text-xs font-bold text-gray-800 mt-2 block line-clamp-1">
                                                            {ann.registration_deadline ? new Date(ann.registration_deadline).toLocaleDateString() : 'No Deadline'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {ann.registration_deadline ? new Date(ann.registration_deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Open anytime'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Capacity Progress Bar */}
                                                {totalCapacity && (
                                                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs space-y-1.5">
                                                        <div className="flex justify-between items-center text-xs font-bold">
                                                            <span className="text-gray-700">Seat Occupancy</span>
                                                            <span className={percentFilled >= 100 ? 'text-red-600' : 'text-indigo-600'}>
                                                                {registeredCount} of {totalCapacity} booked ({percentFilled}%)
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    percentFilled >= 100 ? 'bg-red-500' : percentFilled >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
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
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                                        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <UserCheck className="text-indigo-600" size={18} />
                                                <h4 className="text-sm font-bold text-gray-900">
                                                    Registered Candidates List ({registrationDetails.registrations?.length || 0})
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search candidates..."
                                                        value={registrationSearch}
                                                        onChange={(e) => setRegistrationSearch(e.target.value)}
                                                        className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-48 sm:w-60"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => fetchAnnouncementRegistrations(selectedAnnouncementForView.id)}
                                                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                                                    title="Refresh list"
                                                >
                                                    <RefreshCw size={14} className={registrationsLoading ? 'animate-spin' : ''} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Table */}
                                        {registrationsLoading ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-gray-500">
                                                <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
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
                                                    (r.email && r.email.toLowerCase().includes(searchLower))
                                                );
                                            });

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="py-12 text-center text-gray-500 space-y-1">
                                                        <Ticket size={28} className="mx-auto text-gray-300 mb-2" />
                                                        <p className="text-sm font-semibold text-gray-700">No candidates found</p>
                                                        <p className="text-xs text-gray-400">
                                                            {registrationSearch ? 'No registrations matched your search query.' : 'No students have registered yet for this event.'}
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            const formFields = registrationDetails.announcement?.registration_form_fields || selectedAnnouncementForView.registration_form_fields || [];

                                            return (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse text-xs">
                                                        <thead>
                                                            <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
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
                                                        <tbody className="divide-y divide-gray-100">
                                                            {filtered.map((candidate, idx) => (
                                                                <tr key={candidate.id} className="hover:bg-indigo-50/30 transition-colors">
                                                                    <td className="py-3 px-4 font-mono text-gray-400">{idx + 1}</td>
                                                                    <td className="py-3 px-4 font-bold text-gray-900">
                                                                        {candidate.student_name}
                                                                        {candidate.college && (
                                                                            <span className="block text-[10px] font-normal text-gray-500">{candidate.college}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono font-medium text-gray-800">
                                                                        {candidate.pin_number}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-gray-700">
                                                                        <span className="font-semibold">{candidate.branch || 'N/A'}</span>
                                                                        <span className="block text-[10px] text-gray-500">
                                                                            {[candidate.current_year, candidate.current_semester].filter(Boolean).join(' • ') || '—'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 px-4 text-gray-700">
                                                                        <span className="font-medium">{candidate.phone || '—'}</span>
                                                                        <span className="block text-[10px] text-gray-500 truncate max-w-[140px]">{candidate.email || '—'}</span>
                                                                    </td>
                                                                    <td className="py-3 px-4">
                                                                        {candidate.form_responses && Object.keys(candidate.form_responses).length > 0 ? (
                                                                            <div className="space-y-1 max-w-xs">
                                                                                {Object.entries(candidate.form_responses).map(([k, v], rIdx) => {
                                                                                    const matchedField = formFields.find(f => f.id === k || f.label === k);
                                                                                    const displayLabel = matchedField?.label || k;
                                                                                    return (
                                                                                        <div key={rIdx} className="text-[11px] leading-tight">
                                                                                            <span className="text-gray-500 font-semibold">{displayLabel}: </span>
                                                                                            <span className="font-bold text-gray-800">{String(v)}</span>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        ) : candidate.custom_field_value ? (
                                                                            <span className="text-xs font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                                                                                {candidate.custom_field_value}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-gray-400 italic">None</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-[11px] text-gray-500">
                                                                        {candidate.registered_at ? new Date(candidate.registered_at).toLocaleString('en-IN') : '—'}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveCandidate(selectedAnnouncementForView.id, candidate.id, candidate.student_name)}
                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedAnnouncementForView(null)}
                                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition-colors"
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
