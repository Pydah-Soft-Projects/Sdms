import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Users, BookOpen, CheckCircle, Clock, AlertCircle, MessageSquare, Send,
    ChevronLeft, ChevronRight, Sparkles, UserPlus, Wallet, ShieldCheck, Info,
    CreditCard, ArrowRight, DollarSign
} from 'lucide-react';

const formatChatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    if (isToday) return 'Today';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const formatMessageTime = (dateStr) => new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
import { SkeletonBox } from '../../components/SkeletonLoader';
import clubService from '../../services/clubService';
import chatService from '../../services/chatService';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';

const StudentClubs = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClub, setSelectedClub] = useState(null); // For join modal
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'details'
    const [activeClub, setActiveClub] = useState(null); // The club currently being viewed in detail
    const [listSegment, setListSegment] = useState('all'); // 'joined' | 'all' - for list view
    const [detailTab, setDetailTab] = useState('about'); // 'about' | 'activities' | 'chat' - for detail view

    // Eligibility
    const { user } = useAuthStore();
    const [studentData, setStudentData] = useState(null);

    // Club Communication (Chat)
    const [clubChannel, setClubChannel] = useState(null);
    const [clubMessages, setClubMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [studentsCanSend, setStudentsCanSend] = useState(true); // from channel settings; hide input when false
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const loadSafe = async () => {
            setLoading(true);
            try {
                // Parallel fetch
                const [clubsRes, studentRes] = await Promise.all([
                    clubService.getClubs(),
                    user?.admission_number ? api.get(`/students/${user.admission_number}`) : Promise.resolve({ data: { success: false } })
                ]);

                if (studentRes.data?.success) {
                    setStudentData(studentRes.data.data);
                }

                if (clubsRes.success) {
                    setClubs(clubsRes.data);
                    const requestedClubId = location.state?.selectedClubId;
                    const requestedClub = clubsRes.data.find(club => String(club.id) === String(requestedClubId));
                    if (requestedClub) {
                        setActiveClub(requestedClub);
                        setViewMode('details');
                    } else {
                        setActiveClub(null);
                        setViewMode('list');
                    }
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load clubs');
            } finally {
                setLoading(false);
            }
        };
        loadSafe();
    }, [user, location.state?.selectedClubId]);

    // Load club chat channel when viewing club details (only for approved members without payment due)
    useEffect(() => {
        if (!activeClub?.id || activeClub.userStatus !== 'approved' || activeClub.payment_status === 'payment_due') {
            setClubChannel(null);
            setClubMessages([]);
            setStudentsCanSend(true);
            return;
        }
        const load = async () => {
            try {
                const res = await chatService.listChannels();
                if (res.success && res.data) {
                    const chan = res.data.find((c) => c.club_id === activeClub.id || c.club_id === Number(activeClub.id));
                    if (chan) {
                        setClubChannel(chan);
                        setMessagesLoading(true);
                        const [msgRes, settingsRes] = await Promise.all([
                            chatService.getMessages(chan.id),
                            chatService.getChannelSettings(chan.id),
                        ]);
                        if (msgRes.success && msgRes.data) setClubMessages(msgRes.data);
                        if (settingsRes.success && settingsRes.data && settingsRes.data.students_can_send === false) {
                            setStudentsCanSend(false);
                        } else {
                            setStudentsCanSend(true);
                        }
                    } else {
                        setClubChannel(null);
                        setStudentsCanSend(true);
                    }
                }
            } catch {
                setClubChannel(null);
                setStudentsCanSend(true);
            } finally {
                setMessagesLoading(false);
            }
        };
        load();
    }, [activeClub?.id, activeClub?.userStatus, activeClub?.payment_status]);

    const handlePostClubMessage = async (e) => {
        e.preventDefault();
        if (!clubChannel?.id || !newMessage?.trim()) return;
        try {
            await chatService.postMessage(clubChannel.id, newMessage.trim());
            setNewMessage('');
            const res = await chatService.getMessages(clubChannel.id);
            if (res.success && res.data) setClubMessages(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send message');
        }
    };

    const handleVotePoll = async (msgId, optionIndex) => {
        try {
            await chatService.votePoll(msgId, optionIndex);
            const res = await chatService.getMessages(clubChannel.id);
            if (res.success && res.data) setClubMessages(res.data);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to vote');
        }
    };

    useEffect(() => {
        if (clubMessages.length && clubChannel?.id) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [clubMessages.length, clubChannel?.id]);

    const isEligible = (club) => {
        if (!studentData) return { eligible: true }; // Fallback if load fails or during load
        if (!club.target_audience) return { eligible: true };

        let audience = club.target_audience;
        if (typeof audience === 'string') {
            try { audience = JSON.parse(audience); } catch (e) { return { eligible: true }; }
        }

        const { colleges, courses, branches, years, semesters } = audience;

        if (colleges?.length > 0 && !colleges.includes(studentData.college)) return { eligible: false, reason: 'Restricted' };
        if (courses?.length > 0 && !courses.includes(studentData.course)) return { eligible: false, reason: 'Program Restricted' };
        if (branches?.length > 0 && !branches.includes(studentData.branch)) return { eligible: false, reason: 'Branch Restricted' };
        if (years?.length > 0 && !years.some(y => y == studentData.current_year)) return { eligible: false, reason: `Year ${studentData.current_year} Ineligible` };
        if (semesters?.length > 0 && !semesters.some(s => s == studentData.current_semester)) return { eligible: false, reason: `Semester ${studentData.current_semester} Ineligible` };

        return { eligible: true };
    };

    const handleJoinClick = (club) => {
        setSelectedClub(club);
    };

    const handleViewClub = (club) => {
        setActiveClub(club);
        setDetailTab('about');
        setViewMode('details');
        window.scrollTo(0, 0);
    };

    const handleBackToList = () => {
        setViewMode('list');
        setActiveClub(null);
    };

    const handleSubmitJoin = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!selectedClub) return;
        const targetId = selectedClub.id;
        try {
            await clubService.joinClub(targetId);
            toast.success('Join request sent successfully!');
            setSelectedClub(null);
            // Refresh clubs to show updated status
            const clubsRes = await clubService.getClubs();
            if (clubsRes.success && Array.isArray(clubsRes.data)) {
                setClubs(clubsRes.data);
                const updated = clubsRes.data.find(c => c.id === targetId || String(c.id) === String(targetId));
                if (updated) {
                    setActiveClub(updated);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to join club');
        }
    };

    const renderStatusBadge = (status) => {
        switch (status) {
            case 'approved': return <span className="bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1 font-bold shadow-2xs whitespace-nowrap"><CheckCircle size={11} className="sm:w-3 sm:h-3" /> Active Member</span>;
            case 'pending': return <span className="bg-amber-100 text-amber-800 text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1 font-bold shadow-2xs animate-pulse whitespace-nowrap"><Clock size={11} className="sm:w-3 sm:h-3" /> Pending</span>;
            case 'rejected': return <span className="bg-rose-100 text-rose-800 text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1 font-bold shadow-2xs whitespace-nowrap"><AlertCircle size={11} className="sm:w-3 sm:h-3" /> Restricted</span>;
            default: return <span className="bg-indigo-50 text-indigo-700 text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1 font-bold shadow-2xs whitespace-nowrap"><Sparkles size={11} className="sm:w-3 sm:h-3" /> Open to Join</span>;
        }
    };

    const joinedClubs = clubs.filter(c => c.userStatus === 'approved' || c.userStatus === 'pending');
    const displayClubs = listSegment === 'joined' ? joinedClubs : clubs;

    return (
        <div className="min-h-0 bg-slate-50 flex flex-col no-scrollbar">
            <div
                className={`p-3 sm:p-6 mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[80rem] flex-1 flex flex-col min-h-0 no-scrollbar ${viewMode === 'list' ? 'space-y-4 sm:space-y-6' : 'max-h-[calc(100dvh-7rem)] lg:max-h-[calc(100vh-2rem)]'}`}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {viewMode === 'list' ? (
                    <>
                        {/* Segment tabs: My Clubs | Discover */}
                        {joinedClubs.length > 0 && (
                            <div className="flex rounded-lg sm:rounded-[1.5rem] bg-white/60 backdrop-blur-md p-0.5 sm:p-1 shadow-sm sm:shadow-xl shadow-slate-200/40 border border-white">
                                <button
                                    onClick={() => setListSegment('joined')}
                                    className={`flex-1 min-w-0 py-1 px-1.5 sm:py-3 sm:px-6 rounded-md sm:rounded-2xl text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 ${listSegment === 'joined' ? 'bg-indigo-600 text-white shadow-sm sm:shadow-lg shadow-indigo-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/80'}`}
                                >
                                    <CheckCircle size={12} className="shrink-0 sm:w-3.5 sm:h-3.5" /> My Territories ({joinedClubs.length})
                                </button>
                                <button
                                    onClick={() => setListSegment('all')}
                                    className={`flex-1 min-w-0 py-1 px-1.5 sm:py-3 sm:px-6 rounded-md sm:rounded-2xl text-[9px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-widest transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 ${listSegment === 'all' ? 'bg-indigo-600 text-white shadow-md sm:shadow-lg shadow-indigo-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-white/80'}`}
                                >
                                    <Sparkles size={12} className="shrink-0 sm:w-3.5 sm:h-3.5" /> Discover All
                                </button>
                            </div>
                        )}

                        {loading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6 animate-pulse">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-48 sm:h-72">
                                        <SkeletonBox height="h-24 sm:h-36" width="w-full" />
                                        <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between">
                                            <div className="space-y-1.5 sm:space-y-2">
                                                <SkeletonBox height="h-4 sm:h-6" width="w-3/4" />
                                                <SkeletonBox height="h-3 sm:h-4" width="w-full" />
                                            </div>
                                            <SkeletonBox height="h-7 sm:h-11" width="w-full" className="rounded-lg sm:rounded-xl" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                {displayClubs.length === 0 ? (
                                    <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-8 sm:p-12 text-center">
                                        <Users size={36} className="mx-auto text-gray-300 mb-3 sm:w-12 sm:h-12 sm:mb-4" />
                                        <p className="text-gray-600 font-medium text-xs sm:text-base">{listSegment === 'joined' ? 'You haven’t joined any clubs yet' : 'No clubs available'}</p>
                                        <p className="text-[11px] sm:text-sm text-gray-500 mt-1">{listSegment === 'joined' ? 'Switch to Discover to browse and join.' : 'Check back later for new clubs.'}</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
                                        {displayClubs.map(club => (
                                            <div
                                                key={club.id}
                                                onClick={() => handleViewClub(club)}
                                                className="group/card bg-white rounded-xl sm:rounded-[2.2rem] shadow-sm sm:shadow-lg shadow-slate-200/50 border border-slate-200/80 overflow-hidden hover:shadow-2xl hover:-translate-y-1 sm:hover:-translate-y-1.5 hover:border-indigo-300 transition-all duration-300 flex flex-col relative cursor-pointer"
                                            >
                                                <div className="h-32 sm:h-52 relative overflow-hidden shrink-0 bg-slate-100">
                                                    {club.image_url ? (
                                                        <img src={club.image_url} alt={club.name} className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-700 ease-out" />
                                                    ) : (
                                                        <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center text-indigo-300">
                                                            <Users size={36} className="sm:w-16 sm:h-16" />
                                                        </div>
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent z-10 opacity-70 group-hover/card:opacity-50 transition-opacity duration-300" />
                                                    {club.userStatus && (
                                                        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20">
                                                            {club.userStatus === 'approved' ? (
                                                                <span className="bg-emerald-500 text-white text-[8px] sm:text-[10px] px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-white/20">
                                                                    <CheckCircle size={11} /> Member
                                                                </span>
                                                            ) : club.userStatus === 'pending' ? (
                                                                <span className="bg-amber-500 text-white text-[8px] sm:text-[10px] px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-white/20 animate-pulse">
                                                                    <Clock size={11} /> Pending
                                                                </span>
                                                            ) : (
                                                                <span className="bg-rose-500 text-white text-[8px] sm:text-[10px] px-2 py-0.5 sm:px-3 sm:py-1 rounded-full font-black uppercase tracking-wider shadow-md flex items-center gap-1 border border-white/20">
                                                                    <AlertCircle size={11} /> Denied
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-3.5 sm:p-6 flex-1 flex flex-col justify-between">
                                                    <div>
                                                        <h3 className="text-base sm:text-xl font-black text-slate-900 leading-tight mb-1.5 sm:mb-2 group-hover/card:text-indigo-600 transition-colors tracking-tight line-clamp-1">{club.name}</h3>
                                                        <p className="text-slate-500 text-[11px] sm:text-[13px] line-clamp-2 font-medium leading-relaxed mb-3 sm:mb-4">{club.description || 'Discover activities, workshops, and build connections.'}</p>
                                                    </div>

                                                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-indigo-600 font-bold text-xs sm:text-sm group-hover/card:text-indigo-700">
                                                        <span className="flex items-center gap-1.5 font-extrabold">
                                                            {club.userStatus === 'approved' ? (
                                                                <span className="text-emerald-700 flex items-center gap-1">
                                                                    <CheckCircle size={14} className="text-emerald-600" /> Member • View Portal
                                                                </span>
                                                            ) : club.userStatus === 'pending' ? (
                                                                <span className="text-amber-700 flex items-center gap-1">
                                                                    <Clock size={14} className="text-amber-600 animate-pulse" /> Request Pending • View Status
                                                                </span>
                                                            ) : club.userStatus === 'rejected' ? (
                                                                <span className="text-rose-700 flex items-center gap-1">
                                                                    <AlertCircle size={14} className="text-rose-600" /> Entry Restricted • View Club
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-indigo-600">
                                                                    View Club Details
                                                                </span>
                                                            )}
                                                        </span>
                                                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-50 group-hover/card:bg-indigo-600 group-hover/card:text-white flex items-center justify-center transition-all duration-300">
                                                            <ChevronRight size={16} className="group-hover/card:translate-x-0.5 transition-transform" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    /* DETAILS VIEW - fills height on large screens; only chat messages scroll */
                    <div className="animate-in fade-in duration-300 flex-1 flex flex-col min-h-0 overflow-hidden no-scrollbar">
                        {activeClub && (
                            <>
                                {/* Sticky back + club header (mobile friendly) */}
                                <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-100 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2.5 sm:py-3.5">
                                    <div className="flex items-center justify-between gap-3 max-w-6xl mx-auto">
                                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                                            <button onClick={handleBackToList} className="shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors touch-manipulation" aria-label="Back to clubs">
                                                <ChevronLeft size={18} />
                                            </button>
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                                {activeClub.image_url ? <img src={activeClub.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Users size={16} /></div>}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate leading-snug">{activeClub.name}</h2>
                                                <div className="flex items-center gap-1.5 mt-0.5">{renderStatusBadge(activeClub.userStatus)}</div>
                                            </div>
                                        </div>

                                        {/* Top Header Status Indicator (if payment due) */}
                                        {activeClub.userStatus === 'approved' && activeClub.payment_status === 'payment_due' && (
                                            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                                                <span className="py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[10px] sm:text-xs flex items-center gap-1">
                                                    <AlertCircle size={13} className="text-rose-600" /> <span>Fee Pending</span>
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Tab bar: Overview | Activities | Chat (Full Mobile Width & Cleanly Aligned) */}
                                <div className="border-b border-gray-200/80 bg-white -mx-3 sm:-mx-6 px-0 sm:px-6">
                                    <div className="grid grid-cols-3 w-full sm:flex sm:w-auto sm:items-center sm:gap-8 max-w-6xl mx-auto">
                                        {[
                                            { id: 'about', label: 'Overview', icon: Users },
                                            { id: 'activities', label: 'Activities', icon: BookOpen },
                                            { id: 'chat', label: 'Chat', icon: MessageSquare },
                                        ].map(({ id, label, icon: Icon }) => (
                                            <button
                                                key={id}
                                                onClick={() => setDetailTab(id)}
                                                className={`relative py-3 sm:py-3.5 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold transition-all touch-manipulation border-b-2 -mb-px ${detailTab === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                                            >
                                                <Icon size={16} className={detailTab === id ? 'text-indigo-600' : 'text-gray-400'} />
                                                <span>{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div
                                    className={`py-4 sm:py-6 pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-6 w-full flex-1 flex flex-col min-h-0 no-scrollbar ${detailTab === 'chat' ? 'overflow-hidden' : 'overflow-y-auto'}`}
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                >
                                    {detailTab === 'about' && (
                                        <div className="space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto">
                                            {/* Hero Banner inside Club Home Page */}
                                            <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 min-h-[190px] sm:h-64 flex flex-col justify-end p-4 sm:p-6">
                                                {activeClub.image_url ? (
                                                    <img src={activeClub.image_url} alt={activeClub.name} className="absolute inset-0 w-full h-full object-cover opacity-40 sm:opacity-50" />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-15">
                                                        <Users size={120} className="text-white" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-transparent" />
                                                <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3.5 sm:gap-4">
                                                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                                        <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-white p-1 shadow-xl shrink-0 overflow-hidden border-2 border-white">
                                                            {activeClub.image_url ? (
                                                                <img src={activeClub.image_url} alt="" className="w-full h-full object-cover rounded-lg sm:rounded-xl" />
                                                            ) : (
                                                                <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-lg sm:text-2xl rounded-lg sm:rounded-xl">
                                                                    {activeClub.name?.charAt(0) || 'C'}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 text-white flex-1">
                                                            <h1 className="text-base sm:text-2xl lg:text-3xl font-black tracking-tight drop-shadow-md leading-tight line-clamp-2">{activeClub.name}</h1>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {renderStatusBadge(activeClub.userStatus)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Hero Join Button if not yet joined */}
                                                    {!activeClub.userStatus && (
                                                        <button
                                                            onClick={() => handleJoinClick(activeClub)}
                                                            className="w-full sm:w-auto py-2.5 px-5 sm:py-3 sm:px-6 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-indigo-950/40 flex items-center justify-center gap-2 transition-all shrink-0 hover:scale-[1.02] active:scale-95"
                                                        >
                                                            <UserPlus size={16} />
                                                            <span>Join the Club</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Membership Fee Card (Displayed inside Club Home Page) */}
                                            <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 rounded-xl sm:rounded-2xl border border-indigo-100 p-4 sm:p-6 shadow-xs space-y-3">
                                                <div className="flex items-center gap-3.5">
                                                    <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200 shrink-0">
                                                        <Wallet size={20} className="sm:w-6 sm:h-6" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400">Membership Fee</p>
                                                        <div className="flex items-baseline gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                                                            {activeClub.membership_fee > 0 ? (
                                                                <>
                                                                    <span className="text-xl sm:text-3xl font-black text-slate-900">₹{activeClub.membership_fee}</span>
                                                                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                                        / {activeClub.fee_type === 'Semesterly' ? 'Semester' : 'Year'}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-lg sm:text-2xl font-black text-emerald-700">Free Membership</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="text-[11px] sm:text-xs text-slate-500 font-medium pt-2 border-t border-indigo-100/70 leading-relaxed">
                                                    {activeClub.membership_fee > 0
                                                        ? `A membership fee of ₹${activeClub.membership_fee} will be registered under your Student Fee Management upon membership request. Payment can be completed from Fee Management to finalize your club registration.`
                                                        : 'No membership fee is required for this club. All eligible students are welcome to participate freely upon coordinator approval.'
                                                    }
                                                </p>

                                                {activeClub.payment_status === 'payment_due' && (
                                                    <div className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs text-rose-800 font-semibold mt-2">
                                                        <AlertCircle size={15} className="text-rose-600 shrink-0" />
                                                        <span>Fee Pending: ₹{activeClub.balance_due || activeClub.membership_fee}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* About & Mission Section */}
                                            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-3 sm:space-y-4">
                                                <div className="flex items-center gap-2 text-indigo-900 border-b border-slate-100 pb-2.5 sm:pb-3">
                                                    <Users size={18} className="sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                                                    <h3 className="text-sm sm:text-lg font-black tracking-tight">About {activeClub.name}</h3>
                                                </div>
                                                <p className="text-slate-600 text-xs sm:text-sm sm:leading-relaxed leading-normal whitespace-pre-wrap">
                                                    {activeClub.description || 'No detailed description provided for this club.'}
                                                </p>
                                            </div>

                                            {/* Eligibility & Target Audience */}
                                            {(() => {
                                                const audience = typeof activeClub.target_audience === 'string'
                                                    ? (() => { try { return JSON.parse(activeClub.target_audience); } catch (e) { return null; } })()
                                                    : activeClub.target_audience;
                                                const eligibleInfo = isEligible(activeClub);

                                                return (
                                                    <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-3 sm:space-y-4">
                                                        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 sm:pb-3">
                                                            <div className="flex items-center gap-2 text-indigo-900">
                                                                <ShieldCheck size={18} className="sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
                                                                <h3 className="text-sm sm:text-lg font-black tracking-tight">Eligibility &amp; Target Audience</h3>
                                                            </div>
                                                            <span className={`self-start xs:self-auto text-[10px] font-black uppercase px-2.5 py-0.5 sm:py-1 rounded-full whitespace-nowrap ${eligibleInfo.eligible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                                                {eligibleInfo.eligible ? 'You Are Eligible' : eligibleInfo.reason}
                                                            </span>
                                                        </div>

                                                        {audience && (audience.courses?.length > 0 || audience.branches?.length > 0 || audience.years?.length > 0) ? (
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-xs">
                                                                {audience.courses?.length > 0 && (
                                                                    <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                                        <span className="font-extrabold uppercase text-[9px] sm:text-[10px] text-slate-400 block mb-0.5 sm:mb-1">Eligible Courses</span>
                                                                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-words">{audience.courses.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                                {audience.branches?.length > 0 && (
                                                                    <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                                        <span className="font-extrabold uppercase text-[9px] sm:text-[10px] text-slate-400 block mb-0.5 sm:mb-1">Target Branches</span>
                                                                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-words">{audience.branches.join(', ')}</span>
                                                                    </div>
                                                                )}
                                                                {audience.years?.length > 0 && (
                                                                    <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-100">
                                                                        <span className="font-extrabold uppercase text-[9px] sm:text-[10px] text-slate-400 block mb-0.5 sm:mb-1">Eligible Years</span>
                                                                        <span className="font-bold text-slate-800 text-xs sm:text-sm break-words">{audience.years.map(y => `Year ${y}`).join(', ')}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium">This club is open to all enrolled students across all departments and years.</p>
                                                        )}
                                                    </div>
                                                );
                                            })()}

                                            {/* Membership Status Notice (if submitted or active) */}
                                            {activeClub.userStatus === 'pending' ? (
                                                <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3">
                                                    <Clock size={22} className="text-amber-600 shrink-0 sm:w-6 sm:h-6" />
                                                    <div className="min-w-0">
                                                        <p className="font-extrabold text-xs sm:text-sm">Join Request Submitted</p>
                                                        <p className="text-[11px] sm:text-xs text-amber-700 mt-0.5">Your request is currently awaiting review by the club coordinator. You will be notified once approved.</p>
                                                    </div>
                                                </div>
                                            ) : activeClub.userStatus === 'approved' ? (
                                                <div className="rounded-xl sm:rounded-2xl p-3.5 sm:p-5 bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
                                                    <CheckCircle size={22} className="text-emerald-600 shrink-0 sm:w-6 sm:h-6" />
                                                    <div className="min-w-0">
                                                        <p className="font-extrabold text-xs sm:text-sm">Active Member</p>
                                                        <p className="text-[11px] sm:text-xs text-emerald-700 mt-0.5">You are an active member of this club. Check the Activities tab and Chat tab to engage with fellow members.</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    {detailTab === 'activities' && (
                                        <div className="space-y-4 sm:space-y-6 w-full max-w-5xl mx-auto">
                                            <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                                                <BookOpen className="text-indigo-600 sm:w-5 sm:h-5" size={18} /> Activities
                                            </h3>
                                            {(!activeClub.activities || activeClub.activities.length === 0) ? (
                                                <div className="bg-white rounded-2xl border border-gray-100 p-8 sm:p-12 text-center text-gray-500">
                                                    <BookOpen size={36} className="mx-auto mb-2.5 sm:mb-3 text-gray-300 sm:w-10 sm:h-10" />
                                                    <p className="text-xs sm:text-sm font-medium">No activities posted yet.</p>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                                    {[...activeClub.activities].reverse().map((activity, idx) => (
                                                        <div key={idx} className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                                            {activity.image_url && (
                                                                <div className="h-40 sm:h-56 bg-gray-100">
                                                                    <img src={activity.image_url} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                            )}
                                                            <div className="p-4 sm:p-6">
                                                                <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                                                                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold overflow-hidden shrink-0 text-xs sm:text-sm">
                                                                        {activeClub.image_url ? <img src={activeClub.image_url} alt="" className="w-full h-full object-cover" /> : activeClub.name.charAt(0)}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-gray-900 text-xs sm:text-sm truncate">{activeClub.name}</p>
                                                                        <p className="text-[10px] sm:text-xs text-gray-500">{new Date(activity.posted_at).toLocaleDateString()}</p>
                                                                    </div>
                                                                </div>
                                                                <h4 className="text-sm sm:text-lg font-bold text-gray-900 mb-1.5">{activity.title}</h4>
                                                                <p className="text-gray-600 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">{activity.description}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {detailTab === 'chat' && (
                                        <div className={`w-full flex-1 flex flex-col min-h-0 ${clubChannel ? 'min-h-0' : 'space-y-4'}`}>
                                            {activeClub.userStatus !== 'approved' || activeClub.payment_status === 'payment_due' ? (
                                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-800">
                                                    <MessageSquare size={32} className="mx-auto mb-2 text-amber-500" />
                                                    <p className="font-medium">Chat is available after you’re approved and fee is paid.</p>
                                                </div>
                                            ) : !clubChannel ? (
                                                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500">
                                                    <MessageSquare size={40} className="mx-auto mb-3 text-gray-300" />
                                                    <p>No chat channel for this club yet.</p>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col min-h-0 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                                    <div className="py-3 px-4 bg-[#075e54] text-white flex items-center gap-2 shrink-0">
                                                        <MessageSquare size={22} className="text-white/90" />
                                                        <span className="font-semibold">{clubChannel.name || 'Club Chat'}</span>
                                                    </div>
                                                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 bg-[#efeae2] flex flex-col gap-1">
                                                        {messagesLoading ? (
                                                            <div className="text-center text-gray-500 py-8">Loading messages...</div>
                                                        ) : clubMessages.filter((m) => !m.is_hidden).length === 0 ? (
                                                            <div className="text-center text-gray-500 py-8">No messages yet. Say hello!</div>
                                                        ) : (
                                                            (() => {
                                                                const items = [];
                                                                let lastDate = null;
                                                                clubMessages.filter((m) => !m.is_hidden).forEach((msg) => {
                                                                    const d = formatChatTime(msg.created_at);
                                                                    if (d !== lastDate) { items.push({ type: 'date', key: `d-${msg.id}`, label: d }); lastDate = d; }
                                                                    items.push({ type: 'msg', key: msg.id, msg });
                                                                });
                                                                return items.map((item) => {
                                                                    if (item.type === 'date') return <div key={item.key} className="flex justify-center my-2"><span className="text-xs text-gray-600 bg-white/80 px-3 py-1 rounded-full shadow-sm">{item.label}</span></div>;
                                                                    const msg = item.msg;
                                                                    const isOwn = msg.is_own;
                                                                    return (
                                                                        <div key={item.key} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                                                            <div className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-md ${msg.is_deleted ? 'bg-gray-200' : isOwn ? 'bg-[#dcf8c6] rounded-br-md' : 'bg-white rounded-bl-md'}`}>
                                                                                {!isOwn && <p className="text-xs font-semibold text-[#075e54] mb-0.5">{msg.sender_name || 'Unknown'}</p>}
                                                                                {msg.is_deleted ? (
                                                                                    <p className="text-sm text-gray-600 italic">This message was deleted{msg.deleted_by_name ? ` by ${msg.deleted_by_name}` : ''}.</p>
                                                                                ) : msg.message_type === 'poll' ? (
                                                                                    <div className="space-y-1.5">
                                                                                        <p className="text-sm font-medium text-gray-900">{msg.message}</p>
                                                                                        <div className="flex flex-col gap-2 mt-1">
                                                                                            {(msg.poll_options || ['Yes', 'No']).map((optLabel, idx) => {
                                                                                                const count = (msg.poll_option_counts && msg.poll_option_counts[idx]) != null ? msg.poll_option_counts[idx] : (idx === 0 ? msg.poll_yes_count : msg.poll_no_count);
                                                                                                const voters = (msg.voters_by_option && msg.voters_by_option[idx]) || [];
                                                                                                const totalVoters = (msg.voters_count_by_option && msg.voters_count_by_option[idx]) != null ? msg.voters_count_by_option[idx] : voters.length;
                                                                                                const isSelected = msg.current_user_option_index === idx || (msg.current_user_vote === 'yes' && idx === 0) || (msg.current_user_vote === 'no' && idx === 1);
                                                                                                const moreCount = totalVoters > voters.length ? totalVoters - voters.length : 0;
                                                                                                const voterLabel = voters.length > 0 ? (voters.join(', ') + (moreCount > 0 ? ` and ${moreCount} more` : '')) : '';
                                                                                                return (
                                                                                                    <div key={idx} className="flex flex-col gap-0.5 min-w-0">
                                                                                                        <button type="button" onClick={() => handleVotePoll(msg.id, idx)} disabled={msg.current_user_vote != null || msg.current_user_option_index != null} className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium ${isSelected ? 'bg-[#075e54] text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>{optLabel} {count != null ? `(${count})` : ''}</button>
                                                                                                        {voterLabel && <span className="text-[10px] text-gray-500 pl-1 truncate" title={voterLabel}>— {voterLabel}</span>}
                                                                                                    </div>
                                                                                                );
                                                                                            })}
                                                                                        </div>
                                                                                        {(msg.current_user_vote != null || msg.current_user_option_index != null) && <span className="text-[10px] text-gray-500 block mt-0.5">You voted: {(msg.poll_options || ['Yes', 'No'])[msg.current_user_option_index ?? (msg.current_user_vote === 'yes' ? 0 : 1)]}</span>}
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        {msg.attachment_url && (msg.attachment_type === 'image' ? <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block mb-1"><img src={msg.attachment_url} alt="" className="max-w-[220px] max-h-36 rounded-lg object-cover" /></a> : <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#075e54] hover:underline block mb-1">View attachment</a>)}
                                                                                        {(msg.message && msg.message.trim()) && <p className="text-sm text-gray-900">{msg.message}</p>}
                                                                                    </>
                                                                                )}
                                                                                <div className="flex items-center justify-end gap-1 mt-0.5">
                                                                                    {msg.edited_at && <span className="text-[10px] text-gray-500">(edited)</span>}
                                                                                    <span className="text-[10px] text-gray-500">{formatMessageTime(msg.created_at)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()
                                                        )}
                                                        <div ref={messagesEndRef} className="h-0" />
                                                    </div>
                                                    {studentsCanSend ? (
                                                        <form onSubmit={handlePostClubMessage} className="shrink-0 p-2 bg-white border-t border-gray-200 flex items-center gap-2">
                                                            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message" className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-[#075e54]/30 focus:border-[#075e54] outline-none text-sm" />
                                                            <button type="submit" className="shrink-0 w-10 h-10 rounded-full bg-[#075e54] text-white flex items-center justify-center hover:bg-[#064e47] transition-colors" title="Send">
                                                                <Send size={18} className="ml-0.5" />
                                                            </button>
                                                        </form>
                                                    ) : (
                                                        <div className="shrink-0 py-3 px-4 bg-gray-100 border-t border-gray-200 text-center text-sm text-gray-500">
                                                            Only admins can send messages in this chat.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
                {selectedClub && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl max-h-[calc(100dvh-2rem)] max-w-md w-full overflow-y-auto shadow-2xl">
                            <div className="p-4 sm:p-8">
                                <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                                            {selectedClub.image_url ? <img src={selectedClub.image_url} alt="" className="w-full h-full object-cover" /> : <Users size={22} className="text-indigo-600 sm:w-7 sm:h-7" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">Join {selectedClub.name}</h2>
                                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Request membership</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setSelectedClub(null)} className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg leading-none" aria-label="Close">×</button>
                                </div>

                                {selectedClub.membership_fee > 0 && (
                                    <div className="bg-emerald-50 p-3.5 sm:p-4 rounded-xl flex items-center justify-between text-emerald-800 border border-emerald-100 mb-3 sm:mb-4">
                                        <span className="font-semibold text-xs sm:text-sm">Membership fee</span>
                                        <div className="text-right">
                                            <p className="text-lg sm:text-xl font-bold">₹{selectedClub.membership_fee}</p>
                                            <p className="text-[10px] sm:text-xs opacity-80">{selectedClub.fee_type}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-indigo-50 p-3.5 sm:p-4 rounded-xl flex gap-2.5 sm:gap-3 text-indigo-900 border border-indigo-100 text-xs sm:text-sm">
                                    <div className="flex-shrink-0 mt-0.5"><AlertCircle size={18} className="text-indigo-600 sm:w-5 sm:h-5" /></div>
                                    <div>
                                        <p className="font-semibold">Confirm request</p>
                                        <p className="mt-0.5 sm:mt-1 text-indigo-800/90 leading-relaxed text-[11px] sm:text-xs">
                                            Your profile will be shared with the club. {selectedClub.membership_fee > 0 && <>A fee record of <strong>₹{selectedClub.membership_fee}</strong> will be added to your Fee Management.</>}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2.5 sm:gap-3 mt-5 sm:mt-6">
                                    <button type="button" onClick={() => setSelectedClub(null)} className="flex-1 px-3 py-2.5 sm:py-3 border border-gray-200 rounded-xl font-semibold text-xs sm:text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancel</button>
                                    <button onClick={handleSubmitJoin} className="flex-1 px-3 py-2.5 sm:py-3 bg-indigo-600 text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                                        Send request
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentClubs;
