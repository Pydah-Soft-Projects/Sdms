
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Megaphone, Calendar, BarChart2, CheckCircle, Clock, AlertCircle, X, RefreshCw, ChevronRight, Ticket, Users, Check, AlertTriangle, Send, User } from 'lucide-react';
import { SkeletonBox } from '../../components/SkeletonLoader';
import api from '../../config/api';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

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

const StudentAnnouncements = () => {
    const { user } = useAuthStore();
    const [activeTab, setActiveTab] = useState('announcements');
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState([]);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [polls, setPolls] = useState([]);
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

    // Pagination & Caching states
    const [hasMore, setHasMore] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const [dataFetched, setDataFetched] = useState({ announcements: false, polls: false });

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
        }
    }, [activeTab, dataFetched.announcements, dataFetched.polls, fetchAnnouncements]);

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
        } else {
            fetchPolls(true);
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
                toast.success('Registration confirmed successfully!');
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

    if (loading && announcements.length === 0 && polls.length === 0) {
        return (
            <div className="animate-pulse bg-gray-50/50 min-h-screen">
                <div className="sticky top-0 bg-white/95 border-b border-slate-100 px-3 sm:px-6 py-2 flex items-center justify-center">
                    <div className="flex gap-1 w-full max-w-md bg-slate-100/90 p-1 rounded-xl">
                        <SkeletonBox height="h-8" className="flex-1 rounded-lg" />
                        <SkeletonBox height="h-8" className="flex-1 rounded-lg" />
                    </div>
                </div>
                <div className="p-3 sm:p-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-xl border border-slate-100 p-3 flex flex-col space-y-2.5">
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
        <div className="animate-fade-in bg-gray-50/50 min-h-screen">

            {/* ── Sticky Tab Bar ── */}
            <div className="sticky top-0 z-30 px-3 sm:px-6 py-2 flex items-center justify-center">
                <div className="bg-slate-200/70 backdrop-blur-md border border-slate-200/80 rounded-xl p-1 flex gap-1 w-full max-w-md shadow-xs">
                    <button
                        id="tab-announcements"
                        onClick={() => setActiveTab('announcements')}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap min-w-0 ${activeTab === 'announcements' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
                    >
                        <Megaphone size={13} className="shrink-0" />
                        <span className="truncate">Announcements</span>
                    </button>
                    <button
                        id="tab-polls"
                        onClick={() => setActiveTab('polls')}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all duration-200 whitespace-nowrap min-w-0 ${activeTab === 'polls' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200/60' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'}`}
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
                        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-400 mb-3">
                                <Megaphone size={26} />
                            </div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">No Announcements</h3>
                            <p className="text-slate-400 font-medium text-xs mt-1">Nothing new right now.</p>
                        </div>
                    ) : (
                        <>
                            {/* Announcements Responsive Card Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                {announcements.map((ann) => (
                                    <div
                                        key={ann.id}
                                        onClick={() => setSelectedAnnouncement(ann)}
                                        className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group cursor-pointer flex flex-col h-full bg-white"
                                    >
                                        {/* Image / Fallback */}
                                        {ann.image_url ? (
                                            <div className="w-full h-44 sm:h-48 bg-slate-100 overflow-hidden relative shrink-0">
                                                <img src={ann.image_url} alt={ann.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                <div className="absolute bottom-2.5 left-2.5 z-10">
                                                    <span className="bg-indigo-600/95 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm">
                                                        {formatTarget(ann.target_college)}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-44 sm:h-48 bg-slate-900 overflow-hidden relative shrink-0">
                                                <img src="/images/announcement-fallback.jpg" alt={ann.title} className="w-full h-full object-cover" />
                                                <div className="absolute bottom-2.5 left-2.5 z-10">
                                                    <span className="bg-indigo-600/95 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[9px] uppercase font-black tracking-widest shadow-sm">
                                                        {formatTarget(ann.target_college)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Content */}
                                        <div className="p-4 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center justify-between gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={12} className="text-indigo-500 shrink-0" />
                                                        <span>{new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                    </div>
                                                    {ann.requires_registration && (
                                                        ann.is_registered ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                <CheckCircle size={10} /> Registered
                                                            </span>
                                                        ) : ann.is_full ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                                                Seats Full
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                <Ticket size={10} /> {ann.available_seats !== null ? `${ann.available_seats} left` : 'Register'}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
                                                    {ann.title}
                                                </h3>
                                                {ann.content && (
                                                    <p className="text-xs text-slate-500 line-clamp-2 mt-2 leading-relaxed">
                                                        {ann.content}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                                                <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                                    {ann.requires_registration && !ann.is_registered ? (
                                                        <span className="text-indigo-600 flex items-center gap-1">Register Now <ChevronRight size={12} /></span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">Read More <ChevronRight size={12} /></span>
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Automatic pagination sentinel for every viewport */}
                            {hasMore ? (
                                <div ref={sentinelRef} className="flex justify-center py-5">
                                    {isFetchingMore && (
                                        <div className="flex items-center gap-2">
                                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                                            <span className="text-[11px] font-bold text-slate-400">Loading more...</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest py-4">All caught up</p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* ══ POLLS ══ */}
            {activeTab === 'polls' && (
                <div>
                    {polls.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-slate-100">
                            <div className="mx-auto w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-3">
                                <BarChart2 size={26} />
                            </div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">No Active Polls</h3>
                            <p className="text-slate-400 font-medium text-xs mt-1">Check back later for new polls.</p>
                        </div>
                    ) : (
                        <>
                            {/* MOBILE: Compact Poll Cards */}
                            <div className="md:hidden space-y-2.5">
                                {polls.map((poll) => {
                                    const timeLeft = poll.end_time ? new Date(poll.end_time) - new Date() : null;
                                    const isUrgent = timeLeft && timeLeft < 86400000;
                                    return (
                                        <div key={poll.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                            <div className="flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-50">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                                                    <BarChart2 size={13} className="text-indigo-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-black text-slate-800 leading-snug line-clamp-2">{poll.question}</p>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                        {new Date(poll.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                                        {poll.end_time && ` · Ends ${new Date(poll.end_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`}
                                                    </p>
                                                </div>
                                                {poll.has_voted ? (
                                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-0.5 mt-0.5">
                                                        <CheckCircle size={9} /> Done
                                                    </span>
                                                ) : (
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-wider shrink-0 flex items-center gap-0.5 border mt-0.5 ${isUrgent ? 'text-rose-600 bg-rose-50 border-rose-100 animate-pulse' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}>
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
                                                            className="w-full text-left px-3 py-2 rounded-xl border border-slate-100 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/60 transition-all text-[11px] font-bold text-slate-700 flex items-center justify-between gap-2 active:scale-[0.98] relative overflow-hidden"
                                                        >
                                                            <span className="truncate">{opt}</span>
                                                            <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 shrink-0" />
                                                            {votingId === poll.id && (
                                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                                    <Loader2 className="animate-spin text-indigo-600" size={13} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 px-3 py-2.5 text-emerald-600">
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
                                        <div key={poll.id} className="bg-white rounded-[2rem] shadow-sm border border-gray-100 p-6 sm:p-8 hover:shadow-md hover:-translate-y-1 transition-all duration-300 relative flex flex-col h-full group">
                                            <div className="absolute top-5 right-5">
                                                {poll.has_voted ? (
                                                    <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm border border-green-200/50">
                                                        <CheckCircle size={13} /> Voted
                                                    </span>
                                                ) : (
                                                    <span className={`px-3 py-1.5 rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 shadow-sm border ${isUrgent ? 'bg-rose-50 text-rose-600 border-rose-200/50 animate-pulse' : 'bg-indigo-50 text-indigo-600 border-indigo-200/50'}`}>
                                                        {isUrgent ? <Clock size={13} /> : <AlertCircle size={13} />}
                                                        {isUrgent ? 'Ending Soon' : 'Active'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mb-6 pr-24">
                                                <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight tracking-tight group-hover:text-indigo-600 transition-colors">{poll.question}</h3>
                                                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-widest text-gray-400 font-bold">
                                                    <span>{new Date(poll.created_at).toLocaleDateString()}</span>
                                                    {poll.end_time && (
                                                        <span className={`flex items-center gap-1.5 ${isUrgent ? 'text-rose-500' : ''}`}>
                                                            <Clock size={13} className="opacity-70" /> {new Date(poll.end_time).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {poll.has_voted ? (
                                                <div className="flex flex-col items-center justify-center py-8 text-center bg-green-50/50 rounded-3xl border border-green-100 mt-auto">
                                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-green-500 shadow-md mb-3">
                                                        <CheckCircle size={28} strokeWidth={2.5} />
                                                    </div>
                                                    <h3 className="text-base font-black text-green-800 mb-1">Vote Confirmed</h3>
                                                    <p className="text-green-600/80 font-semibold text-sm">Your response has been recorded.</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5 mt-auto">
                                                    {poll.options.map((opt, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleVote(poll.id, idx)}
                                                            disabled={votingId === poll.id}
                                                            className="w-full text-left p-4 rounded-2xl border-2 border-transparent bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50 hover:shadow-md transition-all duration-300 text-gray-700 font-bold group relative overflow-hidden active:scale-[0.98]"
                                                        >
                                                            <div className="flex items-center justify-between relative z-10">
                                                                <span className="pr-4 text-sm">{opt}</span>
                                                                <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-indigo-600 group-hover:bg-indigo-600 transition-colors shrink-0 flex items-center justify-center">
                                                                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                                                </div>
                                                            </div>
                                                            {votingId === poll.id && (
                                                                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
                                                                    <Loader2 className="animate-spin text-indigo-600" size={20} />
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                    <p className="text-[10px] font-bold tracking-widest uppercase text-center text-gray-400 pt-2">Select an option to cast vote</p>
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
            {selectedAnnouncement && (
                <div
                    className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedAnnouncement(null)}
                >
                    <div
                        className="bg-white w-full sm:rounded-[2rem] sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col overflow-hidden border border-white/80 rounded-t-[2rem] shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag Handle */}
                        <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-slate-200" />
                        </div>
                        {/* Header */}
                        <div className="px-4 sm:px-6 pt-2 sm:pt-5 pb-3 sm:pb-4 border-b border-slate-100 shrink-0">
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-sm sm:text-xl font-black text-slate-900 leading-snug flex-1 pr-2 tracking-tight">{selectedAnnouncement.title}</h2>
                                <button
                                    onClick={() => setSelectedAnnouncement(null)}
                                    className="p-1.5 sm:p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all shrink-0 text-slate-500 hover:text-slate-900 active:scale-95"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-indigo-500 font-black mt-1.5">
                                <Calendar size={10} className="opacity-80 shrink-0" />
                                {new Date(selectedAnnouncement.created_at).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                            {selectedAnnouncement.image_url && (
                                <div className="w-full h-44 sm:h-56 bg-slate-100 overflow-hidden shrink-0">
                                    <img src={selectedAnnouncement.image_url} alt={selectedAnnouncement.title} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="p-4 sm:p-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-6">
                                <p className="whitespace-pre-wrap text-slate-600 leading-relaxed text-[13px] sm:text-sm break-words font-medium">{selectedAnnouncement.content}</p>
                                {selectedAnnouncement.target_college && (
                                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Targeted to:</span>
                                        <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">{formatTarget(selectedAnnouncement.target_college)}</span>
                                        {selectedAnnouncement.target_course && <span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-100">{formatTarget(selectedAnnouncement.target_course)}</span>}
                                        {selectedAnnouncement.target_branch && <span className="bg-slate-50 text-slate-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-slate-100">{formatTarget(selectedAnnouncement.target_branch)}</span>}
                                    </div>
                                )}

                                {/* Event Registration & Seats Block */}
                                {selectedAnnouncement.requires_registration && (
                                    <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 border border-indigo-100/90 shadow-xs space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                                    <Ticket size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs sm:text-sm font-black text-slate-900">Event Registration & Seats</h4>
                                                    <p className="text-[10px] text-slate-500 font-medium">Reserve your seat to participate</p>
                                                </div>
                                            </div>
                                            {selectedAnnouncement.is_registered ? (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                                                    <CheckCircle size={12} /> Registered
                                                </span>
                                            ) : selectedAnnouncement.is_full ? (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                                    Seats Full
                                                </span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                                                    Open
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats Row */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Total Capacity</span>
                                                <span className="text-xs sm:text-sm font-black text-slate-800">
                                                    {selectedAnnouncement.max_seats ? `${selectedAnnouncement.max_seats} Seats` : 'Unlimited'}
                                                </span>
                                            </div>
                                            <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Available</span>
                                                <span className="text-xs sm:text-sm font-black text-indigo-600">
                                                    {selectedAnnouncement.available_seats !== null ? `${selectedAnnouncement.available_seats} Seats` : 'Open'}
                                                </span>
                                            </div>
                                            <div className="col-span-2 sm:col-span-1 p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
                                                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Deadline</span>
                                                <span className="text-xs font-black text-slate-800 truncate block">
                                                    {selectedAnnouncement.registration_deadline
                                                        ? new Date(selectedAnnouncement.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                        : 'No Deadline'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Status / Action */}
                                        {selectedAnnouncement.is_registered ? (
                                            <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5">
                                                    <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-black text-emerald-900">Your registration is confirmed!</p>
                                                        <p className="text-[10px] text-emerald-700 font-medium">Your seat is reserved for this event.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleCancelRegistration(selectedAnnouncement.id)}
                                                    disabled={cancellingRegId === selectedAnnouncement.id}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition-all flex items-center gap-1 shrink-0"
                                                >
                                                    {cancellingRegId === selectedAnnouncement.id ? <Loader2 size={12} className="animate-spin" /> : 'Cancel Seat'}
                                                </button>
                                            </div>
                                        ) : (
                                            (() => {
                                                const isDeadlinePassed = selectedAnnouncement.registration_deadline && new Date(selectedAnnouncement.registration_deadline) < new Date();
                                                if (isDeadlinePassed) {
                                                    return (
                                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs font-bold">
                                                            <Clock size={16} className="shrink-0" />
                                                            Registration closed: Deadline passed.
                                                        </div>
                                                    );
                                                }
                                                if (selectedAnnouncement.is_full) {
                                                    return (
                                                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-bold">
                                                            <AlertCircle size={16} className="shrink-0" />
                                                            Registration closed: All seats have been filled.
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <button
                                                        onClick={() => handleOpenRegisterModal(selectedAnnouncement)}
                                                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-200 transition-all"
                                                    >
                                                        <Ticket size={16} />
                                                        Register & Book Seat Now
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
                    className="fixed inset-0 z-[95] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in"
                    onClick={() => setRegisterModalAnnouncement(null)}
                >
                    <div
                        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                                    <Ticket size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">Event Registration</h3>
                                    <p className="text-[11px] font-medium text-slate-500 line-clamp-1">{registerModalAnnouncement.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setRegisterModalAnnouncement(null)}
                                className="p-1.5 hover:bg-slate-200 rounded-xl transition-all text-slate-400 hover:text-slate-700"
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
                                    <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                                                <Check size={13} strokeWidth={3} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-indigo-950">Student Profile Information</p>
                                                <p className="text-[11px] text-indigo-700/80 font-medium">Pre-filled from your profile. You can edit any details below if needed.</p>
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
                                                    <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                                        {field.label} {field.required && <span className="text-rose-500 font-bold">*</span>}
                                                    </label>
                                                    <input
                                                        type={inputType}
                                                        required={field.required}
                                                        value={registerFormData[field.key] ?? ''}
                                                        onChange={e => setRegisterFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                                                        placeholder={placeholderMap[field.key] || `Enter ${field.label}...`}
                                                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 transition-colors"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Dynamic Questions configured by Admin */}
                                    {customFields.length > 0 && (
                                        <div className="space-y-3.5 pt-2 border-t border-slate-100">
                                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Registration Details</h4>
                                            {customFields.map((field) => {
                                                const fieldKey = field.id || field.label;
                                                const fieldValue = registerFormResponses[fieldKey] || '';
                                                const optionsList = field.options ? field.options.split(',').map(o => o.trim()).filter(Boolean) : [];

                                                return (
                                                    <div key={fieldKey} className="space-y-1">
                                                        <label className="block text-xs font-bold text-slate-700">
                                                            {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
                                                        </label>

                                                        {field.type === 'select' ? (
                                                            <select
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        ) : field.type === 'number' ? (
                                                            <input
                                                                type="number"
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                placeholder={`Enter ${field.label}...`}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                required={field.required}
                                                                value={fieldValue}
                                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                                                placeholder={`Enter ${field.label}...`}
                                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Legacy single custom field support */}
                                    {customFields.length === 0 && registerModalAnnouncement.custom_registration_field && (
                                        <div className="space-y-1 pt-2 border-t border-slate-100">
                                            <label className="block text-xs font-bold text-slate-700">
                                                {registerModalAnnouncement.custom_registration_field}
                                            </label>
                                            <input
                                                type="text"
                                                value={registerFormResponses['custom_registration_field'] || ''}
                                                onChange={e => setRegisterFormResponses(prev => ({ ...prev, custom_registration_field: e.target.value }))}
                                                placeholder="Your answer..."
                                                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    )}

                                    {/* Modal Footer */}
                                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => setRegisterModalAnnouncement(null)}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={registerSubmitting}
                                            className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-md shadow-indigo-200 transition-all flex items-center gap-1.5"
                                        >
                                            {registerSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                                            {registerSubmitting ? 'Registering...' : 'Confirm Registration'}
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
