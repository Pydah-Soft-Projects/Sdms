
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Megaphone, Calendar, BarChart2, CheckCircle, Clock, AlertCircle, X, RefreshCw, ChevronRight, Ticket, Users, Check, AlertTriangle, Send, User, Trophy, FileText, FileDown, ExternalLink, MapPin } from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import api from '../../config/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import EventPoster from '../../components/EventPoster';
import { downloadCircularPdf, getCircularNumberForCollege, parseCircularNumbers } from '../../utils/circularPdf';

const formatTarget = (val) => {
    if (!val) return 'Notice';
    if (Array.isArray(val)) return val[0] || 'Notice';
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
            return val;
        } catch {
            return val;
        }
    }
    return String(val);
};

const parseEventRegistrationFields = (fields) => {
    if (Array.isArray(fields)) return fields;
    if (typeof fields !== 'string' || !fields.trim()) return [];
    try {
        const parsed = JSON.parse(fields);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const parseAnnouncementObject = (value) => {
    if (value && typeof value === 'object') return value;
    if (typeof value !== 'string' || !value.trim()) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return {};
    }
};

const StudentAnnouncements = () => {
    const { user } = useAuthStore();
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'events' ? 'events' : 'announcements');
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState([]);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [polls, setPolls] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [eventRegistrationResponses, setEventRegistrationResponses] = useState({});
    const [eventRegistrationSubmitting, setEventRegistrationSubmitting] = useState(false);
    const [votingId, setVotingId] = useState(null);

    // Event Registration state
    const [registerModalAnnouncement, setRegisterModalAnnouncement] = useState(null);
    const [registerFormResponses, setRegisterFormResponses] = useState({});
    const [registerFormData, setRegisterFormData] = useState({
        student_name: '',
        pin_number: '',
        college: '',
        branch: '',
        year_sem: '',
        phone: '',
        email: ''
    });
    const [registerSubmitting, setRegisterSubmitting] = useState(false);
    const [cancellingRegId, setCancellingRegId] = useState(null);

    const handleCircularDownload = (announcement) => {
        try {
            downloadCircularPdf(announcement, user?.college);
        } catch (error) {
            toast.error(error.message || 'Unable to download circular');
        }
    };

    // Pagination & Caching states
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [dataFetched, setDataFetched] = useState({ announcements: false, polls: false, events: false });

    // Refs to eliminate stale closures and race conditions in infinite scroll
    const offsetRef = useRef(0);
    const hasMoreRef = useRef(true);
    const isFetchingRef = useRef(false);

    // Infinite scroll sentinel ref
    const sentinelRef = useRef(null);

    // Fetch announcements with deduplication and reliable offset tracking
    const fetchAnnouncements = useCallback(async (isRefresh = false, loadMore = false) => {
        if (isFetchingRef.current) return;
        if (loadMore && !hasMoreRef.current) return;

        isFetchingRef.current = true;
        if (!loadMore) setLoading(true);
        else setIsFetchingMore(true);

        try {
            const currentOffset = isRefresh ? 0 : (loadMore ? offsetRef.current : 0);
            const response = await api.get(`/announcements/student?limit=50&offset=${currentOffset}`);
            if (response.data.success) {
                const newData = response.data.data || [];
                const serverHasMore = Boolean(response.data.hasMore);

                if (isRefresh || !loadMore) {
                    const uniqueInitial = Array.from(new Map(newData.map(item => [item.id, item])).values());
                    setAnnouncements(uniqueInitial);
                    offsetRef.current = uniqueInitial.length;
                } else {
                    setAnnouncements(prev => {
                        const map = new Map();
                        prev.forEach(item => map.set(item.id, item));
                        newData.forEach(item => map.set(item.id, item));
                        return Array.from(map.values());
                    });
                    offsetRef.current += newData.length;
                }

                hasMoreRef.current = serverHasMore;
                setHasMore(serverHasMore);
                setDataFetched(prev => ({ ...prev, announcements: true }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load announcements');
        } finally {
            isFetchingRef.current = false;
            setLoading(false);
            setIsFetchingMore(false);
        }
    }, []);

    // IntersectionObserver for infinite scroll
    const observerRef = useRef(null);
    const setupObserver = useCallback(() => {
        if (observerRef.current) observerRef.current.disconnect();
        if (!sentinelRef.current) return;
        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreRef.current && !isFetchingRef.current) {
                    fetchAnnouncements(false, true);
                }
            },
            { threshold: 0.1 }
        );
        observerRef.current.observe(sentinelRef.current);
    }, [fetchAnnouncements]);

    useEffect(() => {
        if (activeTab === 'announcements' && dataFetched.announcements) {
            setupObserver();
        }
        return () => { if (observerRef.current) observerRef.current.disconnect(); };
    }, [activeTab, dataFetched.announcements, setupObserver]);

    useEffect(() => {
        if (activeTab === 'announcements' && !dataFetched.announcements) {
            fetchAnnouncements();
        } else if (activeTab === 'polls' && !dataFetched.polls) {
            fetchPolls();
        } else if (activeTab === 'events' && !dataFetched.events) {
            fetchEvents();
        }
    }, [activeTab, dataFetched.announcements, dataFetched.polls, dataFetched.events, fetchAnnouncements]);

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const response = await api.get('/events/student');
            if (response.data.success) {
                setEvents((response.data.data || [])
                    .filter(event => String(event.event_type || '').toLowerCase() === 'event')
                    .sort((a, b) => new Date(b.event_date) - new Date(a.event_date)));
                setDataFetched(prev => ({ ...prev, events: true }));
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to load events');
        } finally {
            setLoading(false);
        }
    };

    const fetchPolls = async (isRefresh = false) => {
        setLoading(true);
        try {
            const response = await api.get('/polls/student');
            if (response.data.success) {
                setPolls(response.data.data || []);
                setDataFetched(prev => ({ ...prev, polls: true }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load polls');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        if (activeTab === 'announcements') {
            fetchAnnouncements(true);
        } else if (activeTab === 'events') {
            fetchEvents();
        } else {
            fetchPolls(true);
        }
    };

    const openEventRegistration = (event) => {
        const initialResponses = {};
        const profileValues = {
            name: user?.student_name || user?.name || '',
            pin: user?.admission_number || user?.pin_no || '',
            college: user?.college || '',
            branch: user?.branch || '',
            year: [user?.current_year ? `Year ${user.current_year}` : '', user?.current_semester ? `Semester ${user.current_semester}` : ''].filter(Boolean).join(' / ') || user?.batch || '',
            phone: user?.student_mobile || user?.phone || '',
            email: user?.email || ''
        };
        parseEventRegistrationFields(event.registration_form_fields).forEach(field => {
            const identifier = `${field.id || ''} ${field.label || ''}`.toLowerCase();
            let value = '';
            if (identifier.includes('name')) value = profileValues.name;
            else if (identifier.includes('pin') || identifier.includes('roll')) value = profileValues.pin;
            else if (identifier.includes('college')) value = profileValues.college;
            else if (identifier.includes('branch') || identifier.includes('department')) value = profileValues.branch;
            else if (identifier.includes('year') || identifier.includes('semester')) value = profileValues.year;
            else if (identifier.includes('mobile') || identifier.includes('phone')) value = profileValues.phone;
            else if (identifier.includes('email')) value = profileValues.email;
            initialResponses[field.id || field.label] = value;
        });
        setEventRegistrationResponses(initialResponses);
    };

    const handleEventRegistration = async (e) => {
        e.preventDefault();
        if (!selectedEvent) return;
        const fields = parseEventRegistrationFields(selectedEvent.registration_form_fields);
        for (const field of fields) {
            if (field.required && !String(eventRegistrationResponses[field.id || field.label] || '').trim()) {
                toast.error(`Please complete: ${field.label}`);
                return;
            }
        }

        setEventRegistrationSubmitting(true);
        try {
            const response = await api.post(`/events/${selectedEvent.id}/register`, {
                form_responses: eventRegistrationResponses
            });
            toast.success(response.data?.message || 'Successfully registered for the event');
            setSelectedEvent(current => current ? {
                ...current,
                my_registration_id: current.my_registration_id || 'registered',
                registered_count: Number(current.registered_count || 0) + 1
            } : current);
            setEvents(current => current.map(event => event.id === selectedEvent.id ? {
                ...event,
                my_registration_id: event.my_registration_id || 'registered',
                registered_count: Number(event.registered_count || 0) + 1
            } : event));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to register for this event');
        } finally {
            setEventRegistrationSubmitting(false);
        }
    };

    const handleEventRegistrationCancel = async () => {
        if (!selectedEvent || !window.confirm('Cancel your registration for this event?')) return;
        setEventRegistrationSubmitting(true);
        try {
            const response = await api.delete(`/events/${selectedEvent.id}/register`);
            toast.success(response.data?.message || 'Registration cancelled');
            setSelectedEvent(current => current ? {
                ...current,
                my_registration_id: null,
                registered_count: Math.max(0, Number(current.registered_count || 0) - 1)
            } : current);
            setEvents(current => current.map(event => event.id === selectedEvent.id ? {
                ...event,
                my_registration_id: null,
                registered_count: Math.max(0, Number(event.registered_count || 0) - 1)
            } : event));
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to cancel registration');
        } finally {
            setEventRegistrationSubmitting(false);
        }
    };

    const handleVote = async (pollId, optionIndex) => {
        setVotingId(pollId);
        try {
            const response = await api.post(`/polls/${pollId}/vote`, { option_index: optionIndex });
            if (response.data.success) {
                toast.success('Vote recorded!');
                fetchPolls(true);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Vote failed');
        } finally {
            setVotingId(null);
        }
    };

    const handleAnnouncementPollVote = async (e, announcementId, optionIndex) => {
        e.stopPropagation();
        try {
            const res = await api.post(`/announcements/${announcementId}/vote`, { option_index: optionIndex });
            if (res.data.success) {
                toast.success('Your vote has been recorded!');
                setAnnouncements(prev => prev.map(ann => {
                    if (ann.id === announcementId) {
                        const newCounts = { ...(ann.poll_vote_counts || {}) };
                        newCounts[optionIndex] = (newCounts[optionIndex] || 0) + 1;
                        return {
                            ...ann,
                            has_voted: true,
                            voted_option_index: optionIndex,
                            total_votes: (ann.total_votes || 0) + 1,
                            poll_vote_counts: newCounts
                        };
                    }
                    return ann;
                }));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit vote');
        }
    };

    const handleOpenRegisterModal = (announcement) => {
        setRegisterModalAnnouncement(announcement);
        const yearSemStr = [
            user?.current_year ? `Yr ${user.current_year}` : '',
            user?.current_semester ? `Sem ${user.current_semester}` : ''
        ].filter(Boolean).join(' ') || (user?.batch || '');

        setRegisterFormData({
            student_name: user?.student_name || user?.name || '',
            pin_number: user?.admission_number || user?.pin_no || '',
            college: user?.college || '',
            branch: user?.branch || '',
            year_sem: yearSemStr,
            phone: user?.phone || user?.student_mobile || '',
            email: user?.email || ''
        });

        const initialResponses = {};
        if (Array.isArray(announcement.registration_form_fields)) {
            announcement.registration_form_fields.forEach(field => {
                if (!field.is_default) {
                    initialResponses[field.id || field.label] = '';
                }
            });
        }
        if (announcement.custom_registration_field) {
            initialResponses['custom_registration_field'] = '';
        }
        setRegisterFormResponses(initialResponses);
    };

    const handleSubmitRegistration = async (e) => {
        if (e) e.preventDefault();
        if (!registerModalAnnouncement) return;

        const formFields = Array.isArray(registerModalAnnouncement.registration_form_fields)
            ? registerModalAnnouncement.registration_form_fields
            : [];
        const defaultFields = formFields.filter(f => f.is_default);
        const customFields = formFields.filter(f => !f.is_default);

        // Default profile fields fallback if not explicitly defined
        const activeDefaultFields = defaultFields.length > 0
            ? defaultFields
            : [
                { key: 'student_name', label: 'Student Full Name', required: true, enabled: true },
                { key: 'pin_number', label: 'PIN / Roll Number', required: true, enabled: true },
                { key: 'college', label: 'College', required: false, enabled: true },
                { key: 'branch', label: 'Department / Branch', required: false, enabled: true },
                { key: 'year_sem', label: 'Year & Semester', required: false, enabled: true },
                { key: 'phone', label: 'Mobile Number', required: true, enabled: true },
                { key: 'email', label: 'Email ID', required: false, enabled: true },
            ];

        // Validate required default fields
        for (const def of activeDefaultFields) {
            if (def.enabled !== false && def.required) {
                const val = registerFormData[def.key];
                if (val === undefined || val === null || String(val).trim() === '') {
                    toast.error(`Please enter your ${def.label || 'required details'}`);
                    return;
                }
            }
        }

        // Validate required custom fields
        for (const field of customFields) {
            if (field.required) {
                const key = field.id || field.label;
                const val = registerFormResponses[key];
                if (val === undefined || val === null || String(val).trim() === '') {
                    toast.error(`Please provide an answer for "${field.label}"`);
                    return;
                }
            }
        }

        setRegisterSubmitting(true);
        try {
            const payload = {
                student_name: registerFormData.student_name,
                pin_number: registerFormData.pin_number,
                college: registerFormData.college,
                branch: registerFormData.branch,
                year_sem: registerFormData.year_sem,
                phone: registerFormData.phone,
                email: registerFormData.email,
                form_responses: registerFormResponses,
                custom_field_value: registerFormResponses['custom_registration_field'] || ''
            };

            const response = await api.post(`/announcements/${registerModalAnnouncement.id}/register`, payload);
            if (response.data.success) {
                const isForm = (registerModalAnnouncement.announcement_type || '').toLowerCase() === 'form';
                toast.success(isForm ? 'Your form response has been submitted' : 'Registration confirmed successfully!');
                const targetId = registerModalAnnouncement.id;
                
                // Update announcements list
                setAnnouncements(prev => prev.map(ann => {
                    if (ann.id === targetId) {
                        const newCount = (Number(ann.registered_count) || 0) + 1;
                        const newAvailable = ann.max_seats ? Math.max(0, Number(ann.max_seats) - newCount) : null;
                        const isFull = ann.max_seats ? newCount >= Number(ann.max_seats) : false;
                        return {
                            ...ann,
                            is_registered: true,
                            registered_count: newCount,
                            available_seats: newAvailable,
                            is_full: isFull,
                            my_registration: {
                                registered_at: new Date().toISOString(),
                                form_responses: registerFormResponses
                            }
                        };
                    }
                    return ann;
                }));

                // Update selectedAnnouncement if open
                setSelectedAnnouncement(prev => {
                    if (prev && prev.id === targetId) {
                        const newCount = (Number(prev.registered_count) || 0) + 1;
                        const newAvailable = prev.max_seats ? Math.max(0, Number(prev.max_seats) - newCount) : null;
                        const isFull = prev.max_seats ? newCount >= Number(prev.max_seats) : false;
                        return {
                            ...prev,
                            is_registered: true,
                            registered_count: newCount,
                            available_seats: newAvailable,
                            is_full: isFull,
                            my_registration: {
                                registered_at: new Date().toISOString(),
                                form_responses: registerFormResponses
                            }
                        };
                    }
                    return prev;
                });

                setRegisterModalAnnouncement(null);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to submit registration');
        } finally {
            setRegisterSubmitting(false);
        }
    };

    const handleCancelRegistration = async (announcementId) => {
        if (!window.confirm('Are you sure you want to cancel your registration? Your seat will be made available to other students.')) {
            return;
        }

        setCancellingRegId(announcementId);
        try {
            const response = await api.delete(`/announcements/${announcementId}/register`);
            if (response.data.success) {
                toast.success('Registration cancelled successfully');

                // Update announcements list
                setAnnouncements(prev => prev.map(ann => {
                    if (ann.id === announcementId) {
                        const newCount = Math.max(0, (Number(ann.registered_count) || 1) - 1);
                        const newAvailable = ann.max_seats ? Math.max(0, Number(ann.max_seats) - newCount) : null;
                        return {
                            ...ann,
                            is_registered: false,
                            registered_count: newCount,
                            available_seats: newAvailable,
                            is_full: false,
                            my_registration: null
                        };
                    }
                    return ann;
                }));

                // Update selectedAnnouncement if open
                setSelectedAnnouncement(prev => {
                    if (prev && prev.id === announcementId) {
                        const newCount = Math.max(0, (Number(prev.registered_count) || 1) - 1);
                        const newAvailable = prev.max_seats ? Math.max(0, Number(prev.max_seats) - newCount) : null;
                        return {
                            ...prev,
                            is_registered: false,
                            registered_count: newCount,
                            available_seats: newAvailable,
                            is_full: false,
                            my_registration: null
                        };
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to cancel registration');
        } finally {
            setCancellingRegId(null);
        }
    };

    if (loading && announcements.length === 0 && polls.length === 0 && events.length === 0) {
        return (
            <div className="animate-pulse bg-[var(--background)]/50 min-h-screen">
                <div className="sticky top-0 bg-[var(--surface)]/95 border-b border-border px-3 sm:px-6 py-2 flex items-center justify-center">
                    <div className="flex gap-1 w-full max-w-md bg-[var(--background)]/90 p-1 rounded-xl">
                        <SkeletonBox height="h-8" className="flex-1 rounded-lg" />
                        <SkeletonBox height="h-8" className="flex-1 rounded-lg" />
                        <SkeletonBox height="h-8" className="flex-1 rounded-lg" />
                    </div>
                </div>
                <div className="p-3 sm:p-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-surface rounded-xl border border-border p-3 flex flex-col space-y-2.5">
                                <SkeletonBox height="h-32" className="w-full rounded-lg" />
                                <SkeletonBox height="h-3.5" width="w-2/3" />
                                <SkeletonBox height="h-3" width="w-1/3" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in bg-[var(--background)]/50 min-h-screen">

            {/* ── Sticky Tab Bar ── */}
            <div className="sticky top-0 z-30 px-3 sm:px-6 py-2 flex items-center justify-center">
                <div className="bg-[var(--background)]/70 backdrop-blur-md border border-border rounded-xl p-1 flex gap-1 w-full max-w-md shadow-xs">
                    <button
                        id="tab-announcements"
                        onClick={() => setActiveTab('announcements')}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap min-w-0 ${activeTab === 'announcements' ? 'bg-primary text-white shadow-md shadow-primary/60' : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'}`}
                    >
                        <Megaphone size={13} className="shrink-0" />
                        <span className="truncate">Announcements</span>
                    </button>
                    <button
                        id="tab-events"
                        onClick={() => setActiveTab('events')}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap min-w-0 ${activeTab === 'events' ? 'bg-primary text-white shadow-md shadow-primary/60' : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'}`}
                    >
                        <Calendar size={13} className="shrink-0" />
                        <span className="truncate">Events</span>
                    </button>
                    <button
                        id="tab-polls"
                        onClick={() => setActiveTab('polls')}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap min-w-0 ${activeTab === 'polls' ? 'bg-primary text-white shadow-md shadow-primary/60' : 'text-sub hover:text-main hover:bg-[var(--surface)]/50'}`}
                    >
                        <BarChart2 size={13} className="shrink-0" />
                        <span className="truncate">Campus Polls</span>
                    </button>
                </div>
            </div>

            <div className="p-3 sm:p-6 lg:p-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6">

            {/* ══ ANNOUNCEMENTS ══ */}
            {activeTab === 'announcements' && (
                <div>
                    {announcements.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-2xl shadow-sm border border-border">
                            <div className="mx-auto w-14 h-14 bg-[var(--primary-light)] rounded-2xl flex items-center justify-center text-primary mb-3">
                                <Megaphone size={26} />
                            </div>
                            <h3 className="text-base font-black text-main tracking-tight">No Announcements</h3>
                            <p className="text-muted-text font-medium text-xs mt-1">Nothing new right now.</p>
                        </div>
                    ) : (
                        <>
                            {/* Announcements Responsive Card Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                {announcements.map((ann) => {
                                    const type = (ann.announcement_type || 'announcement').toLowerCase();
                                    const ach = parseAnnouncementObject(ann.achievement_data);
                                    const achievementStudents = Array.isArray(ach.students) && ach.students.length
                                        ? ach.students
                                        : [ach];

                                    return (
                                        <div
                                            key={ann.id}
                                            onClick={() => setSelectedAnnouncement(ann)}
                                            className={`rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full bg-surface ${type === 'achievement' ? 'border-[var(--warning-light)] bg-gradient-to-b from-[var(--warning-light)] to-surface' : ''}`}
                                        >
                                            {/* Type Banner / Image / PDF Showcase */}
                                            {type === 'circular' ? (
                                                <div className="w-full p-4 bg-gradient-to-br from-[var(--danger-light)] via-[var(--danger-light)] to-surface border-b border-[var(--danger-light)] shrink-0">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="inline-flex items-center gap-1 bg-danger text-white px-2.5 py-0.5 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-xs">
                                                            <FileText size={11} /> Official Circular
                                                        </span>
                                                        <span className="text-[10px] font-bold text-muted-text">
                                                            {formatTarget(ann.target_college)}
                                                        </span>
                                                    </div>
                                                    <div className="p-3 bg-surface border border-[var(--danger-light)] rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-9 h-9 rounded-lg bg-danger text-white flex items-center justify-center shrink-0 shadow-xs">
                                                                <FileText size={18} />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-main truncate">{ann.title}</p>
                                                                <span className="text-[9px] font-bold text-danger uppercase tracking-wider block">
                                                                    Circular No. {getCircularNumberForCollege(ann.circular_numbers, user?.college) || 'Generated PDF'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={e => { e.stopPropagation(); handleCircularDownload(ann); }}
                                                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 transition-colors"
                                                        >
                                                            <FileDown size={12} /> Download
                                                        </button>
                                                        {ann.file_url && (
                                                            <a
                                                                href={ann.file_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                onClick={e => e.stopPropagation()}
                                                                className="px-2.5 py-1.5 bg-surface border border-[var(--danger-light)] hover:bg-[var(--danger-light)] text-danger rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs shrink-0 transition-colors"
                                                            >
                                                                <ExternalLink size={12} /> Attachment
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : type === 'achievement' ? (
                                                <div className="w-full p-4 bg-gradient-to-r from-warning via-warning to-warning text-white shrink-0 shadow-xs">
                                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider mb-2">
                                                        <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full">
                                                            <Trophy size={11} /> Hackathon Topper
                                                        </span>
                                                        <span className="bg-[var(--surface)]/20 px-2 py-0.5 rounded-full">
                                                            {ach.rank_title || 'Champion'}
                                                        </span>
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {achievementStudents.map((student, index) => (
                                                            <div key={student.id || `${student.student_name}-${index}`} className="flex items-center gap-3 bg-[var(--surface)]/95 text-main p-3 rounded-xl shadow-xs">
                                                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-warning shrink-0 bg-[var(--warning-light)] shadow-xs">
                                                                    {student.student_photo || ann.image_url ? (
                                                                        <img src={student.student_photo || ann.image_url} alt={student.student_name || 'Student'} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-warning"><User size={22} /></div>
                                                                    )}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="font-black text-xs sm:text-sm text-main truncate leading-tight">{student.student_name || 'Student'}</h4>
                                                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                                        {student.branch && <span className="px-1.5 py-0.2 rounded bg-[var(--primary-light)] text-primary text-[10px] font-bold">{student.branch}</span>}
                                                                        {student.year_sem && <span className="px-1.5 py-0.2 rounded bg-[var(--primary-light)] text-secondary text-[10px] font-bold">{student.year_sem}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {ach.topper_prize && <p className="text-[10px] font-black text-warning sm:col-span-2">🏆 {ach.topper_prize}</p>}
                                                    </div>
                                                </div>
                                            ) : ann.image_url ? (
                                                <div className="w-full h-44 sm:h-48 bg-background overflow-hidden relative shrink-0">
                                                    <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                    <span className={`absolute top-2.5 right-2.5 text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm ${type === 'event' ? 'bg-[var(--primary-light)]' : type === 'poll' ? 'bg-[var(--success-light)]' : 'bg-[var(--primary-light)]'}`}>
                                                        {type === 'event' ? 'Event' : type === 'poll' ? 'Poll' : 'Announcement'}
                                                    </span>
                                                    <div className="absolute bottom-2.5 left-2.5 z-10">
                                                        <span className="bg-[var(--primary-light)] backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm">
                                                            {formatTarget(ann.target_college)}
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-44 sm:h-48 bg-sidebar overflow-hidden relative shrink-0">
                                                    <img src="/images/announcement-fallback.jpg" alt={ann.title} className="w-full h-full object-cover" />
                                                    <span className={`absolute top-2.5 right-2.5 text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm ${type === 'event' ? 'bg-[var(--primary-light)]' : type === 'poll' ? 'bg-[var(--success-light)]' : 'bg-[var(--primary-light)]'}`}>
                                                        {type === 'event' ? 'Event' : type === 'poll' ? 'Poll' : 'Announcement'}
                                                    </span>
                                                    <div className="absolute bottom-2.5 left-2.5 z-10">
                                                        <span className="bg-[var(--primary-light)] backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm">
                                                            {formatTarget(ann.target_college)}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="p-4 flex-1 flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-text mb-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Calendar size={12} className="text-primary shrink-0" />
                                                            <span>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                        </div>
                                                        {Boolean(ann.requires_registration) && (
                                                            ann.is_registered ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                                                    <CheckCircle size={10} /> Registered
                                                                </span>
                                                            ) : ann.is_full ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                                    Seats Full
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                                                    <Ticket size={10} /> {ann.available_seats !== null ? `${ann.available_seats} left` : 'Register'}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>

                                                    {/* Headline / Subject Line */}
                                                    <h3 className="text-sm sm:text-base font-extrabold text-main leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                                        {type === 'circular' && <span className="text-danger mr-1 text-xs uppercase font-mono">Sub:</span>}
                                                        {ann.title}
                                                    </h3>

                                                    {/* Type 2 Event Sub-Banner */}
                                                    {type === 'event' && (ann.event_date || ann.event_venue) && (
                                                        <div className="mt-2 p-2 bg-[var(--primary-light)] rounded-xl text-xs text-secondary font-semibold space-y-0.5">
                                                            {ann.event_date && (
                                                                <div className="flex items-center gap-1">
                                                                    <Calendar size={12} className="text-secondary" />
                                                                    <span>{ann.event_date} {ann.event_time ? `(${ann.event_time})` : ''}</span>
                                                                </div>
                                                            )}
                                                            {ann.event_venue && (
                                                                <div className="flex items-center gap-1 text-[11px] text-secondary">
                                                                    <MapPin size={11} className="text-secondary" />
                                                                    <span className="truncate">{ann.event_venue}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Type 3 Poll Interactive Voting in Feed */}
                                                    {type === 'poll' && Array.isArray(ann.poll_options) && ann.poll_options.length > 0 && (
                                                        <div className="mt-3 space-y-2 p-3 bg-[var(--success-light)] rounded-xl border border-[var(--success-light)]" onClick={e => e.stopPropagation()}>
                                                            {ann.has_voted ? (
                                                                <div className="space-y-1.5">
                                                                    <div className="text-[10px] font-bold text-success uppercase flex items-center justify-between">
                                                                        <span className="flex items-center gap-1"><CheckCircle size={11} /> You Voted</span>
                                                                        <span>{ann.total_votes || 0} Votes</span>
                                                                    </div>
                                                                    {ann.poll_options.map((opt, oIdx) => {
                                                                        const count = ann.poll_vote_counts?.[oIdx] || 0;
                                                                        const total = ann.total_votes || 1;
                                                                        const pct = Math.round((count / total) * 100);
                                                                        const isMyChoice = ann.voted_option_index === oIdx;
                                                                        return (
                                                                            <div key={oIdx} className="text-xs">
                                                                                <div className="flex justify-between text-[11px] mb-0.5">
                                                                                    <span className={`font-semibold ${isMyChoice ? 'text-success font-black' : 'text-sub'}`}>
                                                                                        {opt} {isMyChoice && '✓'}
                                                                                    </span>
                                                                                    <span className="font-mono text-muted-text">{pct}%</span>
                                                                                </div>
                                                                                <div className="h-1.5 w-full bg-[var(--success-light)] rounded-full overflow-hidden">
                                                                                    <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }}></div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-1.5">
                                                                    <span className="text-[10px] font-bold text-success uppercase block">Vote on this poll:</span>
                                                                    {ann.poll_options.map((opt, oIdx) => (
                                                                        <button
                                                                            key={oIdx}
                                                                            type="button"
                                                                            onClick={(e) => handleAnnouncementPollVote(e, ann.id, oIdx)}
                                                                            className="w-full text-left p-2 rounded-lg bg-surface hover:bg-[var(--success-light)] border border-[var(--success-light)] text-xs font-semibold text-sub hover:text-success transition-colors flex items-center justify-between"
                                                                        >
                                                                            <span className="truncate pr-2">{opt}</span>
                                                                            <span className="text-[10px] text-success font-bold">Vote</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {ann.content && (
                                                        <p className="text-xs text-muted-text line-clamp-2 mt-2 leading-relaxed">
                                                            {ann.content}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[10px] font-extrabold text-primary uppercase tracking-wider">
                                                    <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                                        {type === 'circular' ? (
                                                            <span className="text-danger flex items-center gap-1">Download Circular <FileDown size={12} /></span>
                                                        ) : Boolean(ann.requires_registration) && !ann.is_registered ? (
                                                            <span className="text-primary flex items-center gap-1">
                                                                {type === 'form' ? 'Respond Now' : 'Register Now'} <ChevronRight size={12} />
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1">Read More <ChevronRight size={12} /></span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Automatic pagination sentinel for every viewport */}
                            {hasMore ? (
                                <div ref={sentinelRef} className="flex justify-center py-5">
                                    {isFetchingMore && (
                                        <div className="flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin text-primary" />
                                            <span className="text-[11px] font-bold text-muted-text">Loading more...</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-[10px] font-bold text-muted-text uppercase tracking-widest py-4">All caught up</p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══ EVENTS ══ */}
            {activeTab === 'events' && (
                <div>
                    {loading && events.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="rounded-2xl border border-border bg-surface p-3 space-y-3">
                                    <SkeletonBox height="h-44" className="w-full rounded-xl" />
                                    <SkeletonBox height="h-4" width="w-2/3" />
                                    <SkeletonBox height="h-3" width="w-1/3" />
                                </div>
                            ))}
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-2xl shadow-sm border border-border">
                            <div className="mx-auto w-14 h-14 bg-[var(--primary-light)] rounded-2xl flex items-center justify-center text-primary mb-3">
                                <Calendar size={26} />
                            </div>
                            <h3 className="text-base font-black text-main tracking-tight">No Events</h3>
                            <p className="text-muted-text font-medium text-xs mt-1">There are no upcoming campus events right now.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                            {events.map(event => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedEvent(event);
                                        openEventRegistration(event);
                                    }}
                                    className="rounded-2xl border border-border shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full bg-surface text-left"
                                >
                                    <div className="w-full h-44 sm:h-48 overflow-hidden relative shrink-0">
                                        <EventPoster event={event} className="group-hover:scale-105 transition-transform duration-500" />
                                        <span className="absolute top-2.5 right-2.5 bg-[var(--primary-light)] text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm">Event</span>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase font-bold tracking-wider text-muted-text mb-2">
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-primary shrink-0" />
                                                    {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                                {Boolean(event.requires_registration) && (
                                                    event.my_registration_id
                                                        ? <span className="text-success">Registered</span>
                                                        : <span className="text-primary"><Ticket size={10} className="inline" /> Register</span>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-black text-main line-clamp-2 group-hover:text-primary">{event.title}</h3>
                                            <p className="mt-1 text-xs text-muted-text line-clamp-3">{event.description || 'No description provided.'}</p>
                                        </div>
                                        <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-[11px] font-semibold text-muted-text">
                                            <span>{event.start_time || 'All day'}</span>
                                            {Boolean(event.requires_registration) && <span>{event.registered_count || 0}{event.max_seats ? ` / ${event.max_seats}` : ''} registered</span>}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ══ POLLS ══ */}
            {activeTab === 'polls' && (
                <div>
                    {polls.length === 0 ? (
                        <div className="text-center py-16 bg-surface rounded-2xl shadow-sm border border-border">
                            <div className="mx-auto w-14 h-14 bg-[var(--primary-light)] rounded-2xl flex items-center justify-center text-primary mb-3">
                                <BarChart2 size={26} />
                            </div>
                            <h3 className="text-base font-black text-main tracking-tight">No Active Polls</h3>
                            <p className="text-muted-text font-medium text-xs mt-1">Check back later for new polls.</p>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE: Compact Poll Cards */}
                            <div className="md:hidden space-y-2.5">
                                {polls.map((poll) => {
                                    const timeLeft = poll.end_time ? new Date(poll.end_time) - new Date() : null;
                                    const isUrgent = timeLeft && timeLeft < 86400000;
                                    return (
                                        <div key={poll.id} className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
                                            <div className="flex items-start gap-2.5 px-3 py-2.5 border-b border-border">
                                                <div className="w-7 h-7 rounded-lg bg-[var(--primary-light)] flex items-center justify-center shrink-0 mt-0.5">
                                                    <BarChart2 size={13} className="text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-black text-main leading-snug line-clamp-2">{poll.question}</p>
                                                    <p className="text-[9px] text-muted-text font-bold uppercase tracking-wider mt-0.5">
                                                        {new Date(poll.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                        {poll.end_time && ` · Ends ${new Date(poll.end_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}
                                                    </p>
                                                </div>
                                                {poll.has_voted ? (
                                                    <span className="text-[9px] font-black text-success bg-[var(--success-light)] border border-[var(--success-light)] px-1.5 py-0.5 rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-0.5 mt-0.5">
                                                        <CheckCircle size={9} /> Done
                                                    </span>
                                                ) : (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-0.5 border mt-0.5 ${isUrgent ? 'text-danger bg-[var(--danger-light)] border-[var(--danger-light)] animate-pulse' : 'text-primary bg-[var(--primary-light)] border-[var(--primary-light)]'}`}>
                                                        {isUrgent ? <><Clock size={9} /> Soon</> : <><AlertCircle size={9} /> Vote</>}
                                                    </span>
                                                )}
                                            </div>
                                            {!poll.has_voted ? (
                                                <div className="p-2.5 space-y-1.5">
                                                    {poll.options.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleVote(poll.id, idx)}
                                                            disabled={votingId === poll.id}
                                                            className="w-full text-left px-3 py-2 rounded-xl border border-border bg-background hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)] transition-all text-[11px] font-bold text-sub flex items-center justify-between gap-2 active:scale-[0.98] relative overflow-hidden"
                                                        >
                                                            <span className="truncate">{opt}</span>
                                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0" />
                                                            {votingId === poll.id && (
                                                                <div className="absolute inset-0 bg-[var(--surface)]/80 flex items-center justify-center">
                                                                    <Loader2 className="animate-spin text-primary" size={13} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-2.5 text-success">
                                                    <CheckCircle size={13} />
                                                    <span className="text-[11px] font-black">Your vote has been recorded.</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* DESKTOP: Card Grid */}
                            <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
                                {polls.map((poll) => {
                                    const timeLeft = poll.end_time ? new Date(poll.end_time) - new Date() : null;
                                    const isUrgent = timeLeft && timeLeft < 86400000;
                                    return (
                                        <div key={poll.id} className="bg-surface rounded-[2rem] shadow-sm border border-border p-6 sm:p-8 hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative flex flex-col h-full group">
                                            <div className="absolute top-5 right-5">
                                                {poll.has_voted ? (
                                                    <span className="bg-[var(--success-light)] text-success px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm border border-[var(--success-light)]">
                                                        <CheckCircle size={13} /> Voted
                                                    </span>
                                                ) : (
                                                    <span className={`px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm border ${isUrgent ? 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)] animate-pulse' : 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]'}`}>
                                                        {isUrgent ? <Clock size={13} /> : <AlertCircle size={13} />}
                                                        {isUrgent ? 'Ending Soon' : 'Active'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mb-6 pr-24">
                                                <h3 className="text-xl font-black text-main mb-2 leading-tight tracking-tight group-hover:text-primary transition-colors">{poll.question}</h3>
                                                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-widest text-muted-text font-bold">
                                                    <span>{new Date(poll.created_at).toLocaleDateString()}</span>
                                                    {poll.end_time && (
                                                        <span className={`flex items-center gap-1.5 ${isUrgent ? 'text-danger' : ''}`}>
                                                            <Clock size={13} className="opacity-70" /> {new Date(poll.end_time).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {poll.has_voted ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center bg-[var(--success-light)] rounded-3xl border border-[var(--success-light)] mt-auto">
                                                    <div className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center text-success shadow-md mb-3">
                                                        <CheckCircle size={28} strokeWidth={2.5} />
                                                    </div>
                                                    <h3 className="text-base font-black text-success mb-1">Vote Confirmed</h3>
                                                    <p className="text-success font-semibold text-sm">Your response has been recorded.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5 mt-auto">
                                                    {poll.options.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleVote(poll.id, idx)}
                                                            disabled={votingId === poll.id}
                                                            className="w-full text-left p-4 rounded-2xl border-2 border-transparent bg-background hover:border-primary hover:bg-[var(--primary-light)] hover:shadow-md transition-all duration-300 text-sub font-bold group relative overflow-hidden active:scale-[0.98]"
                                                        >
                                                            <div className="flex items-center justify-between relative z-10">
                                                                <span className="pr-4 text-sm">{opt}</span>
                                                                <div className="w-5 h-5 rounded-full border-2 border-border-strong group-hover:border-primary group-hover:bg-primary transition-colors shrink-0 flex items-center justify-center">
                                                                    <div className="w-1.5 h-1.5 bg-surface rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                                </div>
                                                            </div>
                                                            {votingId === poll.id && (
                                                                <div className="absolute inset-0 bg-[var(--surface)]/80 backdrop-blur-sm flex items-center justify-center z-20">
                                                                    <Loader2 className="animate-spin text-primary" size={20} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                    <p className="text-[10px] font-bold tracking-widest uppercase text-center text-muted-text pt-2">Select an option to cast vote</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            </div>
            {/* ── Detail Modal (bottom-sheet on mobile, centered on desktop) ── */}
            {selectedEvent && (
                <div
                    className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center sm:p-4 bg-[var(--sidebar)]/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedEvent(null)}
                >
                    <div
                        className="bg-surface w-full sm:rounded-[2rem] sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-surface rounded-t-[2rem] shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-secondary text-[9px] uppercase font-black tracking-widest">Event</span>
                                <h2 className="mt-2 text-base sm:text-xl font-black text-main">{selectedEvent.title}</h2>
                                <p className="mt-1 text-xs text-muted-text">
                                    {new Date(selectedEvent.event_date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                    {selectedEvent.start_time ? ` · ${selectedEvent.start_time}` : ' · All day'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="p-2 rounded-xl bg-background text-muted-text hover:bg-background"
                                aria-label="Close event"
                            >
                                <X size={17} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            <div className="h-44 sm:h-56 overflow-hidden rounded-xl">
                                <EventPoster event={selectedEvent} />
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-sub">{selectedEvent.description || 'No description provided.'}</p>
                            {Boolean(selectedEvent.requires_registration) && (
                                <section className="rounded-2xl border border-[var(--primary-light)] bg-[var(--primary-light)] p-4 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h3 className="flex items-center gap-2 text-sm font-black text-main"><Ticket size={16} className="text-primary" /> Event Registration</h3>
                                            <p className="mt-1 text-xs text-muted-text">
                                                {selectedEvent.registered_count || 0}
                                                {selectedEvent.max_seats ? ` of ${selectedEvent.max_seats} seats filled` : ' registered'}
                                            </p>
                                        </div>
                                        {selectedEvent.registration_deadline && (
                                            <span className="text-right text-[10px] font-semibold text-muted-text">
                                                Deadline<br />{new Date(selectedEvent.registration_deadline).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    {selectedEvent.my_registration_id ? (
                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--success-light)] bg-[var(--success-light)] p-3">
                                            <span className="flex items-center gap-2 text-xs font-bold text-success"><CheckCircle size={15} /> You are registered.</span>
                                            <button
                                                type="button"
                                                disabled={eventRegistrationSubmitting}
                                                onClick={handleEventRegistrationCancel}
                                                className="rounded-lg px-3 py-1.5 text-xs font-bold text-danger hover:bg-[var(--danger-light)] disabled:opacity-50"
                                            >
                                                Cancel registration
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleEventRegistration} className="space-y-3">
                                            {parseEventRegistrationFields(selectedEvent.registration_form_fields).map((field, index) => (
                                                <label key={field.id || index} className="block text-xs font-bold text-sub">
                                                    {field.label}{field.required && <span className="text-danger"> *</span>}
                                                    {field.type === 'textarea' ? (
                                                        <textarea
                                                            required={Boolean(field.required)}
                                                            value={eventRegistrationResponses[field.id || field.label] || ''}
                                                            onChange={e => setEventRegistrationResponses(current => ({ ...current, [field.id || field.label]: e.target.value }))}
                                                            rows={3}
                                                            className="mt-1 w-full rounded-xl border border-border bg-surface p-2.5 text-sm font-normal"
                                                        />
                                                    ) : (
                                                        <input
                                                            required={Boolean(field.required)}
                                                            value={eventRegistrationResponses[field.id || field.label] || ''}
                                                            onChange={e => setEventRegistrationResponses(current => ({ ...current, [field.id || field.label]: e.target.value }))}
                                                            className="mt-1 w-full rounded-xl border border-border bg-surface p-2.5 text-sm font-normal"
                                                        />
                                                    )}
                                                </label>
                                            ))}
                                            {selectedEvent.registration_deadline && new Date(selectedEvent.registration_deadline) < new Date() ? (
                                                <p className="rounded-xl bg-[var(--danger-light)] p-3 text-xs font-semibold text-danger">Registration deadline has passed.</p>
                                            ) : selectedEvent.max_seats && Number(selectedEvent.registered_count) >= Number(selectedEvent.max_seats) ? (
                                                <p className="rounded-xl bg-[var(--danger-light)] p-3 text-xs font-semibold text-danger">Registration is full.</p>
                                            ) : (
                                                <button
                                                    type="submit"
                                                    disabled={eventRegistrationSubmitting}
                                                    className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white hover:bg-primary-hover disabled:opacity-50"
                                                >
                                                    {eventRegistrationSubmitting ? 'Please wait…' : 'Register for Event'}
                                                </button>
                                            )}
                                        </form>
                                    )}
                                </section>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedAnnouncement && (
                <div
                    className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-[var(--sidebar)]/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedAnnouncement(null)}
                >
                    <div
                        className="bg-surface w-full sm:rounded-[2rem] sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-surface rounded-t-[2rem] shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-background" />
                        </div>
                        {/* Header */}
                        <div className="px-4 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-border shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-sm sm:text-xl font-black text-main leading-snug flex-1 pr-2 tracking-tight">{selectedAnnouncement.title}</h2>
                                <button
                                    onClick={() => setSelectedAnnouncement(null)}
                                    className="p-1.5 sm:p-2 bg-background hover:bg-background rounded-xl transition-all shrink-0 text-muted-text hover:text-main active:scale-95"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-primary font-black mt-1.5">
                                <Calendar size={10} className="opacity-80 shrink-0" />
                                {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                            {selectedAnnouncement.image_url && (
                                <div className="w-full h-44 sm:h-56 bg-background overflow-hidden shrink-0">
                                    <img src={selectedAnnouncement.image_url} alt={selectedAnnouncement.title} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="p-4 sm:p-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-6 space-y-4">
                                {/* Type 1: Circular PDF Download Box in Detail Modal */}
                                {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'circular' &&
                                    (selectedAnnouncement.file_url || Object.keys(parseCircularNumbers(selectedAnnouncement.circular_numbers)).length > 0) && (
                                    <div className="p-4 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-2xl flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-11 h-11 rounded-xl bg-danger text-white flex items-center justify-center shrink-0 shadow-xs">
                                                <FileText size={22} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs sm:text-sm font-bold text-main truncate">{selectedAnnouncement.title}</h4>
                                                <span className="text-[10px] font-bold text-danger uppercase tracking-wider block">
                                                    Circular No. {getCircularNumberForCollege(selectedAnnouncement.circular_numbers, user?.college) || 'Generated PDF'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleCircularDownload(selectedAnnouncement)}
                                                className="px-4 py-2 bg-danger hover:bg-danger text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                                            >
                                                <FileDown size={14} /> Download PDF
                                            </button>
                                            {selectedAnnouncement.file_url && (
                                                <a
                                                    href={selectedAnnouncement.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-2 border border-[var(--danger-light)] bg-surface hover:bg-[var(--danger-light)] text-danger rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                                                >
                                                    <ExternalLink size={14} /> Attachment
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Type 5: Student Achievement Leader Board Topper Card in Modal */}
                                {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'achievement' && selectedAnnouncement.achievement_data && (() => {
                                    const ach = parseAnnouncementObject(selectedAnnouncement.achievement_data);
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
                                                            {student.student_photo || selectedAnnouncement.image_url
                                                                ? <img src={student.student_photo || selectedAnnouncement.image_url} alt={student.student_name} className="w-full h-full object-cover" />
                                                                : <div className="w-full h-full flex items-center justify-center text-amber-600 bg-amber-100"><User size={24} /></div>}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-sm font-black text-slate-900 leading-tight">{student.student_name}</h3>
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

                                {/* Type 2: Event Date & Venue Bar */}
                                {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'event' && (selectedAnnouncement.event_date || selectedAnnouncement.event_venue) && (
                                    <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-2xl text-xs space-y-1">
                                        {selectedAnnouncement.event_date && (
                                            <div className="flex items-center gap-1.5 font-bold text-secondary">
                                                <Calendar size={13} className="text-secondary" />
                                                <span>Event Date: {selectedAnnouncement.event_date} {selectedAnnouncement.event_time ? `(${selectedAnnouncement.event_time})` : ''}</span>
                                            </div>
                                        )}
                                        {selectedAnnouncement.event_venue && (
                                            <div className="flex items-center gap-1.5 text-secondary font-medium">
                                                <MapPin size={13} className="text-secondary" />
                                                <span>Venue: {selectedAnnouncement.event_venue}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <p className="whitespace-pre-wrap text-sub leading-relaxed text-[13px] sm:text-sm break-words font-medium">{selectedAnnouncement.content}</p>
                                {selectedAnnouncement.target_college && (
                                    <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black text-muted-text uppercase tracking-widest">Targeted to:</span>
                                        <span className="bg-[var(--primary-light)] text-primary px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{formatTarget(selectedAnnouncement.target_college)}</span>
                                        {selectedAnnouncement.target_course && <span className="bg-background text-sub px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-border">{formatTarget(selectedAnnouncement.target_course)}</span>}
                                        {selectedAnnouncement.target_branch && <span className="bg-background text-sub px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-border">{formatTarget(selectedAnnouncement.target_branch)}</span>}
                                    </div>
                                )}

                                {/* Event Registration & Seats Block */}
                                {Boolean(selectedAnnouncement.requires_registration) && (
                                    <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[var(--primary-light)] via-surface to-[var(--primary-light)] border border-[var(--primary-light)] shadow-xs space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                                                    <Ticket size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs sm:text-sm font-black text-main">
                                                        {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Form Response' : 'Event Registration & Seats'}
                                                    </h4>
                                                    <p className="text-[10px] text-muted-text font-medium">
                                                        {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Submit your response to the admin' : 'Reserve your seat to participate'}
                                                    </p>
                                                </div>
                                            </div>
                                            {selectedAnnouncement.is_registered ? (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--success-light)] text-success border border-[var(--success-light)] flex items-center gap-1">
                                                    <CheckCircle size={12} /> Registered
                                                </span>
                                            ) : selectedAnnouncement.is_full ? (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]">
                                                    Seats Full
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                                    Open
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                                            <div className="p-2.5 bg-surface rounded-xl border border-border shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-text block">Total Capacity</span>
                                                <span className="text-xs sm:text-sm font-black text-main">
                                                    {selectedAnnouncement.max_seats ? `${selectedAnnouncement.max_seats} Seats` : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="p-2.5 bg-surface rounded-xl border border-border shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-text block">Available</span>
                                                <span className="text-xs sm:text-sm font-black text-primary">
                                                    {selectedAnnouncement.available_seats !== null ? `${selectedAnnouncement.available_seats} Seats` : 'Open'}
                                                </span>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 p-2.5 bg-surface rounded-xl border border-border shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-muted-text block">Deadline</span>
                                                <span className="text-xs font-black text-main truncate block">
                                                    {selectedAnnouncement.registration_deadline
                                                        ? new Date(selectedAnnouncement.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                        : 'No Deadline'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status / Action */}
                                        {selectedAnnouncement.is_registered ? (
                                            <div className="p-3.5 bg-[var(--success-light)] border border-[var(--success-light)] rounded-xl flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <CheckCircle size={18} className="text-success shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-black text-success">
                                                            {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Your response has been submitted.' : 'Your registration is confirmed!'}
                                                        </p>
                                                        <p className="text-[10px] text-success font-medium">
                                                            {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'The admin can now review your response.' : 'Your seat is reserved for this event.'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleCancelRegistration(selectedAnnouncement.id)}
                                                    disabled={cancellingRegId === selectedAnnouncement.id}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-danger hover:text-danger hover:bg-[var(--danger-light)] border border-[var(--danger-light)] transition-all flex items-center gap-1 shrink-0"
                                                >
                                                    {cancellingRegId === selectedAnnouncement.id
                                                        ? <Loader2 size={12} className="animate-spin" />
                                                        : ((selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Withdraw Response' : 'Cancel Seat')}
                                                </button>
                                            </div>
                                        ) : (
                                            (() => {
                                                const isDeadlinePassed = selectedAnnouncement.registration_deadline && new Date(selectedAnnouncement.registration_deadline) < new Date();
                                                if (isDeadlinePassed) {
                                                    return (
                                                        <div className="p-3 bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-xl flex items-center gap-2 text-warning text-xs font-bold">
                                                            <Clock size={16} className="shrink-0" />
                                                            Registration closed: Deadline passed.
                                                        </div>
                                                    );
                                                }
                                                if (selectedAnnouncement.is_full) {
                                                    return (
                                                        <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-xl flex items-center gap-2 text-danger text-xs font-bold">
                                                            <AlertCircle size={16} className="shrink-0" />
                                                            Registration closed: All seats have been filled.
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        onClick={() => handleOpenRegisterModal(selectedAnnouncement)}
                                                        className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-primary transition-all"
                                                    >
                                                        <Ticket size={16} />
                                                        {(selectedAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Submit Form Response' : 'Register & Book Seat Now'}
                                                    </button>
                                                );
                                            })()
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Student Event Registration Modal ── */}
            {registerModalAnnouncement && (
                <div
                    className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-[var(--sidebar)]/70 backdrop-blur-sm animate-fade-in"
                    onClick={() => setRegisterModalAnnouncement(null)}
                >
                    <div
                        className="bg-surface w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-[var(--background)]/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-xs">
                                    <Ticket size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-main leading-tight">
                                        {(registerModalAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Submit Form Response' : 'Event Registration'}
                                    </h3>
                                    <p className="text-[11px] font-medium text-muted-text line-clamp-1">{registerModalAnnouncement.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setRegisterModalAnnouncement(null)}
                                className="p-1.5 hover:bg-background rounded-xl transition-all text-muted-text hover:text-sub"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        {(() => {
                            const formFields = Array.isArray(registerModalAnnouncement.registration_form_fields)
                                ? registerModalAnnouncement.registration_form_fields
                                : [];
                            const defaultFields = formFields.filter(f => f.is_default);
                            const customFields = formFields.filter(f => !f.is_default);

                            const activeDefaultFields = defaultFields.length > 0
                                ? defaultFields
                                : [
                                    { key: 'student_name', label: 'Student Full Name', required: true, enabled: true },
                                    { key: 'pin_number', label: 'PIN / Roll Number', required: true, enabled: true },
                                    { key: 'branch', label: 'Department / Branch', required: false, enabled: true },
                                    { key: 'college', label: 'College', required: false, enabled: true },
                                    { key: 'year_sem', label: 'Year & Semester', required: false, enabled: true },
                                    { key: 'phone', label: 'Mobile Number', required: true, enabled: true },
                                    { key: 'email', label: 'Email ID', required: false, enabled: true },
                                ];

                            const visibleDefaultFields = activeDefaultFields.filter(f => f.enabled !== false);

                            return (
                                <form onSubmit={handleSubmitRegistration} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                                    {/* Notice / Intro */}
                                    <div className="p-3 bg-[var(--primary-light)] rounded-xl border border-[var(--primary-light)] flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-6 h-6 rounded-lg bg-primary text-white flex items-center justify-center shrink-0">
                                                <Check size={13} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-primary">Student Profile Information</p>
                                                <p className="text-[11px] text-primary font-medium">
                                                    {(registerModalAnnouncement.announcement_type || '').toLowerCase() === 'form'
                                                        ? 'Complete the requested fields and submit your response.'
                                                        : 'Pre-filled from your profile. You can edit any details below if needed.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pre-filled & Editable Default Fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        {visibleDefaultFields.map(field => {
                                            const inputType = field.key === 'phone' ? 'tel' : field.key === 'email' ? 'email' : 'text';
                                            const placeholderMap = {
                                                student_name: 'e.g. John Doe',
                                                pin_number: 'e.g. 20230353',
                                                branch: 'e.g. CSE',
                                                college: 'e.g. Pydah College of Engineering',
                                                year_sem: 'e.g. Yr 4 Sem 1',
                                                phone: 'e.g. 9876543210',
                                                email: 'e.g. student@gmail.com'
                                            };

                                            return (
                                                <div key={field.key} className={field.key === 'student_name' || field.key === 'college' ? 'sm:col-span-2' : ''}>
                                                    <label className="block text-[11px] font-black text-sub uppercase tracking-wider mb-1">
                                                        {field.label} {field.required && <span className="text-danger font-bold">*</span>}
                                                    </label>
                                                    <input
                                                        type={inputType}
                                                        required={field.required}
                                                        value={registerFormData[field.key] ?? ''}
                                                        onChange={e => setRegisterFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                        placeholder={placeholderMap[field.key] || `Enter ${field.label}...`}
                                                        className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary text-main transition-colors"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Dynamic Questions configured by Admin */}
                                    {customFields.length > 0 && (
                                        <div className="space-y-3.5 pt-2 border-t border-border">
                                            <h4 className="text-xs font-black text-main uppercase tracking-wider">Registration Details</h4>
                                            {customFields.map((field) => {
                                                const fieldKey = field.id || field.label;
                                                const fieldValue = registerFormResponses[fieldKey] || '';
                                                const optionsList = field.options ? field.options.split(',').map(o => o.trim()).filter(Boolean) : [];

                                                return (
                                                    <div key={fieldKey} className="space-y-1">
                                                        <label className="block text-xs font-bold text-sub">
                                                            {field.label} {field.required && <span className="text-danger font-black">*</span>}
                                                        </label>

                                                        {field.type === 'select' ? (
                                                            <select
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                                            >
                                                                <option value="">Select an option...</option>
                                                                {optionsList.map(opt => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : field.type === 'boolean' ? (
                                                            <select
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                                            >
                                                                <option value="">Select Yes / No...</option>
                                                                <option value="Yes">Yes</option>
                                                                <option value="No">No</option>
                                                            </select>
                                                        ) : field.type === 'textarea' ? (
                                                            <textarea
                                                                rows={2}
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                placeholder={`Enter ${field.label}...`}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                                            />
                                                        ) : field.type === 'number' || field.type === 'date' ? (
                                                            <input
                                                                type={field.type}
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                placeholder={`Enter ${field.label}...`}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                placeholder={`Enter ${field.label}...`}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Legacy single custom field support */}
                                    {customFields.length === 0 && registerModalAnnouncement.custom_registration_field && (
                                        <div className="space-y-1 pt-2 border-t border-border">
                                            <label className="block text-xs font-bold text-sub">
                                                {registerModalAnnouncement.custom_registration_field}
                                            </label>
                                            <input
                                                type="text"
                                                value={registerFormResponses['custom_registration_field'] || ''}
                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, custom_registration_field: e.target.value }))}
                                                placeholder="Your answer..."
                                                className="w-full px-3 py-2 text-xs font-semibold bg-background border border-border rounded-xl focus:bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
                                            />
                                        </div>
                                    )}

                                    {/* Modal Footer */}
                                    <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setRegisterModalAnnouncement(null)}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-sub hover:bg-background transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={registerSubmitting}
                                            className="px-5 py-2 rounded-xl text-xs font-black bg-primary hover:bg-primary-hover active:scale-95 text-white shadow-md shadow-primary transition-all flex items-center gap-1.5"
                                        >
                                            {registerSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                                            {registerSubmitting
                                                ? ((registerModalAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Submitting...' : 'Registering...')
                                                : ((registerModalAnnouncement.announcement_type || '').toLowerCase() === 'form' ? 'Submit Response' : 'Confirm Registration')}
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentAnnouncements;
