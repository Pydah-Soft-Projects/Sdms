import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Plus, Users, X, Trash2, Check, Edit2, Shield, Wallet,
    ArrowRight, Zap, Search, Settings, UserCheck, CheckCircle,
    AlertTriangle, UserPlus, RefreshCw, Eye, Bell, BellOff,
    MessageSquare, Calendar, Clock, Send, Hash, Paperclip, ChevronDown,
    DollarSign, AlertCircle, CheckCircle2, Filter, Upload, Image, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import clubService from '../services/clubService';
import chatService from '../services/chatService';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission } from '../constants/rbac';
import toast from 'react-hot-toast';

const CLUB_ADMIN_PAGES = [
    { key: 'management', label: 'Club Management' },
    { key: 'students', label: 'Members' },
    { key: 'settings', label: 'Club Settings' }
];
const DEFAULT_CLUB_ADMIN_PAGES = CLUB_ADMIN_PAGES.map(page => page.key);
const getPagePermissions = (assignment = {}) => {
    const legacyPages = Array.isArray(assignment.pages) ? assignment.pages : DEFAULT_CLUB_ADMIN_PAGES;
    return Object.fromEntries(CLUB_ADMIN_PAGES.map(({ key }) => {
        const configured = assignment.pagePermissions?.[key];
        if (configured && typeof configured === 'object') {
            const write = configured.write === true;
            return [key, { read: configured.read === true || write, write }];
        }
        const allowed = legacyPages.includes(key);
        return [key, { read: allowed, write: allowed }];
    }));
};
const pagesFromPermissions = permissions => CLUB_ADMIN_PAGES
    .map(page => page.key)
    .filter(key => permissions[key]?.read || permissions[key]?.write);
const DEFAULT_USER_ROLE_OPTIONS = [
    { value: 'college_principal', label: 'College Principal' },
    { value: 'college_ao', label: 'College AO' },
    { value: 'college_attender', label: 'College Attender' },
    { value: 'branch_hod', label: 'Branch HOD' },
    { value: 'office_assistant', label: 'Office Assistant' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'faculty', label: 'Faculty' },
    { value: 'course_principal', label: 'Course Principal' },
    { value: 'course_hod', label: 'Course HOD' },
    { value: 'branch_clerk', label: 'Branch Clerk' },
    { value: 'branch_counselor', label: 'Branch Counselor' },
    { value: 'branch_faculty', label: 'Branch Faculty' },
    { value: 'support_staff', label: 'Support Staff' }
];
const formatMembershipFee = (amount) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(Number(amount) || 0);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   INLINE CLUB CHAT BOX
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ClubChatBox = ({ club }) => {
    const [channel, setChannel] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    const currentUserId = localStorage.getItem('userId');
    const currentUserName = localStorage.getItem('userName') || localStorage.getItem('username') || 'You';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = useCallback(async (ch) => {
        const activeChannel = ch || channel;
        if (!activeChannel) return;
        try {
            const res = await chatService.getMessages(activeChannel.id, { limit: 80 });
            if (res.success && res.data) {
                setMessages(res.data);
                setTimeout(scrollToBottom, 50);
            }
        } catch (e) {
            // silent poll failure
        }
    }, [channel]);

    useEffect(() => {
        if (!club?.id) return;
        setLoading(true);
        setError(null);
        chatService.getChannelByClub(club.id)
            .then(res => {
                if (res.success && res.data) {
                    setChannel(res.data);
                    return chatService.getMessages(res.data.id, { limit: 80 })
                        .then(msgRes => {
                            if (msgRes.success && msgRes.data) {
                                setMessages(msgRes.data);
                                setTimeout(scrollToBottom, 80);
                            }
                        });
                } else {
                    // create channel if not found
                    return chatService.createChannel({ club_id: club.id, name: club.name, type: 'club' })
                        .then(createRes => {
                            if (createRes.success && createRes.data) {
                                setChannel(createRes.data);
                            } else {
                                setError('Could not load or create chat channel.');
                            }
                        });
                }
            })
            .catch(() => setError('Failed to connect to chat.'))
            .finally(() => setLoading(false));
    }, [club?.id]);

    // Poll every 6 seconds
    useEffect(() => {
        if (!channel) return;
        pollRef.current = setInterval(() => loadMessages(channel), 6000);
        return () => clearInterval(pollRef.current);
    }, [channel, loadMessages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim() || !channel || sending) return;
        setSending(true);
        const optimistic = {
            id: `opt-${Date.now()}`,
            message: input.trim(),
            sender_name: currentUserName,
            sender_id: currentUserId,
            created_at: new Date().toISOString(),
            _optimistic: true
        };
        setMessages(prev => [...prev, optimistic]);
        setInput('');
        setTimeout(scrollToBottom, 50);
        try {
            await chatService.postMessage(channel.id, optimistic.message);
            await loadMessages(channel);
        } catch (err) {
            toast.error('Failed to send message');
            setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        } finally {
            setSending(false);
        }
    };

    const formatTime = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Today';
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return d.toLocaleDateString();
    };

    // Group messages by date
    const groupedMessages = messages.reduce((acc, msg) => {
        const dateKey = formatDate(msg.created_at);
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(msg);
        return acc;
    }, {});

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-72 gap-3 text-muted-text">
            <RefreshCw size={24} className="animate-spin text-primary" />
            <p className="text-sm">Loading chatâ€¦</p>
        </div>
    );

    if (error) return (
        <div className="flex flex-col items-center justify-center h-72 gap-3 text-danger">
            <AlertTriangle size={28} />
            <p className="text-sm font-medium">{error}</p>
        </div>
    );

    return (
        <div className="flex flex-col" style={{ height: '520px' }}>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-gradient-to-r from-[var(--primary-light)] to-[var(--primary-light)] rounded-t-xl">
                <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center">
                    <Hash size={18} />
                </div>
                <div>
                    <p className="text-sm font-bold text-main">{club?.name} â€” Club Chat</p>
                    <p className="text-[11px] text-muted-text">{messages.length} messages Â· Updates every 6s</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-[var(--background)]/50">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-text">
                        <MessageSquare size={40} className="opacity-30" />
                        <p className="text-sm">No messages yet. Say hi! ðŸ‘‹</p>
                    </div>
                ) : (
                    Object.entries(groupedMessages).map(([date, dayMsgs]) => (
                        <div key={date}>
                            <div className="flex items-center gap-3 my-3">
                                <div className="flex-1 h-px bg-background" />
                                <span className="text-[10px] text-muted-text font-semibold px-2 py-0.5 bg-surface border rounded-full">{date}</span>
                                <div className="flex-1 h-px bg-background" />
                            </div>
                            {dayMsgs.map((msg, idx) => {
                                const isOwn = String(msg.sender_id) === String(currentUserId);
                                return (
                                    <div key={msg.id || idx} className={`flex gap-2 mb-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                            isOwn ? 'bg-primary text-white' : 'bg-[var(--primary-light)] text-primary'
                                        }`}>
                                            {(msg.sender_name || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                                            {!isOwn && (
                                                <p className="text-[10px] text-muted-text font-semibold mb-0.5 px-1">{msg.sender_name}</p>
                                            )}
                                            <div className={`px-3.5 py-2.5 rounded-2xl text-sm break-words ${
                                                isOwn
                                                    ? 'bg-primary text-white rounded-tr-sm'
                                                    : 'bg-surface border border-border text-main rounded-tl-sm shadow-xs'
                                            } ${msg._optimistic ? 'opacity-70' : ''}`}>
                                                {msg.message}
                                            </div>
                                            <p className="text-[10px] text-muted-text mt-0.5 px-1">{formatTime(msg.created_at)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2.5 border-t bg-surface rounded-b-xl">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`Message #${club?.name}â€¦`}
                    disabled={sending}
                    className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary bg-background placeholder:text-muted-text"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    className="p-2.5 bg-primary hover:bg-primary-hover disabled:opacity-40 text-white rounded-xl transition-all shadow-sm"
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

const ClubCard = ({ club, onViewDetails, isAdmin, canEdit = isAdmin, onToggleStatus, onEdit }) => {
    const memberCount = club.memberCount ?? (club.members || []).filter(m => m.status === 'approved').length;
    const initials = club.name ? club.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
    const gradients = [
        'from-primary to-primary',
        'from-secondary to-secondary',
        'from-success to-primary',
        'from-warning to-danger',
        'from-info to-info',
        'from-accent to-accent',
    ];
    const gradient = gradients[club.id % gradients.length] || gradients[0];

    return (
        <div
            onClick={() => onViewDetails(club)}
            className={`relative rounded-2xl overflow-hidden flex flex-col cursor-pointer group transition-all duration-200 hover:-translate-y-1 hover:shadow-xl shadow-md ${
                club.is_active ? '' : 'opacity-60 grayscale'
            }`}
            style={{ background: 'white', border: '1px solid var(--border)' }}
        >
            {/* Gradient Banner */}
            <div className={`h-24 bg-gradient-to-br ${gradient} relative flex items-end px-4 pb-3 shrink-0`}>
                {!club.is_active && (
                    <div className="absolute top-2 left-2 bg-black/40 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Inactive
                    </div>
                )}
                {/* Quick action buttons */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                    {canEdit && onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(club); }}
                            className="p-1.5 rounded-lg bg-[var(--surface)]/20 backdrop-blur-sm text-white hover:bg-[var(--surface)]/40 transition-all"
                            title="Edit Club"
                        >
                            <Edit2 size={13} />
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleStatus(club.id, club.is_active); }}
                            className={`p-1.5 rounded-lg backdrop-blur-sm transition-all ${
                                club.is_active
                                    ? 'bg-[var(--surface)]/20 text-white hover:bg-[var(--danger-light)]'
                                    : 'bg-[var(--surface)]/20 text-white hover:bg-[var(--success-light)]'
                            }`}
                            title={club.is_active ? 'Deactivate' : 'Activate'}
                        >
                            <Zap size={13} className="fill-current" />
                        </button>
                    )}
                </div>
                {/* Avatar */}
                <div className="w-14 h-14 rounded-xl border-2 border-surface overflow-hidden bg-[var(--surface)]/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-md">
                    {club.image_url ? (
                        <img src={club.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white font-extrabold text-lg leading-none">{initials}</span>
                    )}
                </div>
            </div>

            {/* Card Body */}
            <div className="flex flex-col flex-1 p-4 gap-2">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-main text-base leading-snug group-hover:text-primary transition-colors line-clamp-1">{club.name}</h3>
                    {club.membership_fee > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--success-light)] text-success border border-[var(--success-light)] whitespace-nowrap shrink-0">
                            {formatMembershipFee(club.membership_fee)}
                        </span>
                    ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] whitespace-nowrap shrink-0">Free</span>
                    )}
                </div>

                <p className="text-xs text-muted-text line-clamp-2 leading-relaxed">{club.description || 'No description provided.'}</p>

                {/* Members count + fee type */}
                <div className="flex items-center gap-3 text-xs text-muted-text">
                    <span className="flex items-center gap-1">
                        <Users size={12} className="text-primary" />
                        <span className="font-semibold text-sub">{memberCount}</span> Members
                    </span>
                    {club.fee_type && (
                        <span className="flex items-center gap-1">
                            <Clock size={12} className="text-secondary" /> {club.fee_type}
                        </span>
                    )}
                </div>

                {/* Admin roles chips */}
                {club.admin_roles && club.admin_roles.length > 0 ? (
                    <div className="flex flex-wrap gap-1 pt-1">
                        {club.admin_roles.slice(0, 2).map((roleItem, idx) => (
                            <span key={idx} className="text-[10px] font-semibold bg-[var(--primary-light)] text-primary px-2 py-0.5 rounded-full border border-[var(--primary-light)]">
                                {roleItem.roleName}: {roleItem.name?.split(' ')[0]}
                            </span>
                        ))}
                        {club.admin_roles.length > 2 && (
                            <span className="text-[10px] font-semibold bg-background text-muted-text px-2 py-0.5 rounded-full">+{club.admin_roles.length - 2} more</span>
                        )}
                    </div>
                ) : (
                    <p className="text-[10px] text-muted-text italic">No officers assigned</p>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 pb-4">
                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(club); }}
                    className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all bg-background text-sub border border-border group-hover:bg-primary group-hover:text-white group-hover:border-primary"
                >
                    <Eye size={13} /> View Details
                </button>
            </div>
        </div>
    );
};

const Modal = ({ show, onClose, title, children, size = 'default' }) => (
    <AnimatePresence>
        {show && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`bg-surface rounded-2xl w-full shadow-2xl overflow-hidden my-4 ${size === 'tall' ? 'max-w-5xl min-h-[92vh] max-h-[96vh] flex flex-col' : 'max-w-3xl'}`}
                >
                    <div className="flex shrink-0 justify-between items-center p-6 border-b border-border bg-[var(--background)]/50">
                        <h2 className="text-xl font-bold text-main">{title}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-background rounded-full text-muted-text hover:text-sub">
                            <X size={20} />
                        </button>
                    </div>
                    <div className={`p-6 ${size === 'tall' ? 'min-h-0 flex-1 overflow-y-auto' : 'max-h-[80vh] overflow-y-auto'}`}>
                        {children}
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
);

const MultiSelectDropdown = ({ label, options, value, onChange, placeholder, disabled = false, headerAccessory = null }) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedValues = value || [];
    const selectedLabels = options.filter(option => selectedValues.includes(String(option.value))).map(option => option.label);
    const summary = selectedLabels.length > 0
        ? selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels[0]} +${selectedLabels.length - 1}`
        : placeholder;

    useEffect(() => {
        if (!open) return undefined;
        const closeOnOutsideClick = (event) => {
            if (!containerRef.current?.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutsideClick);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <div ref={containerRef} className="relative min-w-0">
            <div className="mb-1 flex min-h-4 items-center justify-between gap-2">
                <span className="text-xs font-bold text-sub">{label}</span>
                {headerAccessory}
            </div>
            <button
                type="button"
                disabled={disabled}
                aria-expanded={open}
                onClick={() => setOpen(current => !current)}
                className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface px-3 py-2 text-left text-xs text-sub shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:bg-background disabled:text-muted-text"
            >
                <span className="truncate">{summary}</span>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-text">
                    {selectedValues.length ? `${selectedValues.length} selected` : ''}
                    <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
            </button>
            {open && !disabled && (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-xl">
                    {options.length > 0 ? options.map(option => {
                        const optionValue = String(option.value);
                        const checked = selectedValues.includes(optionValue);
                        return (
                            <label key={optionValue} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sub hover:bg-[var(--primary-light)]">
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onChange(checked
                                        ? selectedValues.filter(item => item !== optionValue)
                                        : [...selectedValues, optionValue]
                                    )}
                                    className="rounded border-border-strong text-primary focus:ring-primary"
                                />
                                <span className="truncate">{option.label}</span>
                            </label>
                        );
                    }) : <p className="px-3 py-2 text-xs text-muted-text">No options available</p>}
                </div>
            )}
        </div>
    );
};

const Clubs = ({ initialSubPage }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore(state => state.user);
    const isAdmin = ['admin', 'super_admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());
    const getClubPageAccess = (clubId, pageKey) => {
        if (isAdmin) return { read: true, write: true };
        const pageActions = {
            management: { read: ['view', 'manage'], write: ['manage'] },
            students: { read: ['view_students', 'manage_students'], write: ['manage_students'] },
            settings: {
                read: ['view_settings', 'manage_settings', 'manage_club_admins', 'manage_club_roles'],
                write: ['manage_settings', 'manage_club_admins', 'manage_club_roles']
            }
        }[pageKey];
        const globalRead = pageActions?.read.some(action => hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, action)) || false;
        const globalWrite = pageActions?.write.some(action => hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, action)) || false;
        const assignments = (user?.clubRoles || []).filter(role => clubId == null || String(role.clubId) === String(clubId));
        return assignments.reduce((access, assignment) => {
            const pageAccess = getPagePermissions(assignment)[pageKey] || { read: false, write: false };
            return {
                read: access.read || pageAccess.read || pageAccess.write,
                write: access.write || pageAccess.write
            };
        }, { read: globalRead || globalWrite, write: globalWrite });
    };

    const canManageClubAdmins = isAdmin ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage_club_admins') ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage_settings') ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage') ||
        getClubPageAccess(null, 'settings').write;

    const canManageClubRoles = isAdmin ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage_club_roles') ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage_settings') ||
        hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage') ||
        getClubPageAccess(null, 'settings').write;
    const hasUserManagementControl = isAdmin ||
        hasPermission(user?.permissions, BACKEND_MODULES.USER_MANAGEMENT, 'control');
    const canCreateUserAccounts = hasUserManagementControl ||
        (user?.clubRoles || []).some(role => role.canCreateUsers === true);

    // Determine subPage directly from pathname or initialSubPage prop
    const getSubPageFromPath = () => {
        if (location.pathname.endsWith('/students')) return 'students';
        if (location.pathname.endsWith('/settings')) return 'settings';
        return initialSubPage || 'management';
    };

    const [subPage, setSubPage] = useState(getSubPageFromPath());

    useEffect(() => {
        setSubPage(getSubPageFromPath());
    }, [location.pathname]);

    useEffect(() => {
        if (!user?.clubRoles?.length || isAdmin || getClubPageAccess(null, subPage).read) return;
        const availablePages = [...new Set(user.clubRoles.flatMap(role => pagesFromPermissions(getPagePermissions(role))))];
        if (availablePages.includes(subPage)) return;
        const fallbackPage = availablePages[0];
        navigate(fallbackPage ? (fallbackPage === 'management' ? '/clubs' : `/clubs/${fallbackPage}`) : '/', { replace: true });
    }, [user, subPage, navigate, isAdmin]);

    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'details'
    const [selectedClub, setSelectedClub] = useState(null);
    const [detailsTab, setDetailsTab] = useState('overview'); // 'overview' | 'members' | 'requests' | 'activities' | 'chat' | 'settings'

    useEffect(() => {
        if (viewMode !== 'details' || !selectedClub || isAdmin) return;
        const tabPage = { overview: 'management', activities: 'management', chat: 'management', members: 'students', pending: 'students', admins: 'settings', settings: 'settings' };
        if (getClubPageAccess(selectedClub.id, tabPage[detailsTab]).read) return;
        const firstAvailableTab = [
            ['management', 'overview'],
            ['students', 'members'],
            ['settings', 'settings']
        ].find(([page]) => getClubPageAccess(selectedClub.id, page).read)?.[1];
        if (firstAvailableTab) setDetailsTab(firstAvailableTab);
    }, [viewMode, selectedClub, detailsTab, user, isAdmin]);

    // Notification Toggles State
    const [announcementNotify, setAnnouncementNotify] = useState(localStorage.getItem('club_announcement_notify') !== 'false');
    const [feeNotify, setFeeNotify] = useState(localStorage.getItem('club_fee_notify') !== 'false');
    const [activityNotify, setActivityNotify] = useState(localStorage.getItem('club_activity_notify') !== 'false');

    // Dynamic Roles & HRMS Data
    const [dynamicRoles, setDynamicRoles] = useState([]);
    const [studentsList, setStudentsList] = useState([]);
    const [studentsLoading, setStudentsLoading] = useState(false);

    // Filter states for Students tab
    const [studentSearch, setStudentSearch] = useState('');
    const [studentClubFilter, setStudentClubFilter] = useState('');
    const [studentStatusFilter, setStudentStatusFilter] = useState('');

    // Filter states for Pending Students tab in Details view
    const [pendingSearch, setPendingSearch] = useState('');
    const [pendingCollege, setPendingCollege] = useState('');
    const [pendingCourse, setPendingCourse] = useState('');
    const [pendingBranch, setPendingBranch] = useState('');
    const [pendingYear, setPendingYear] = useState('');

    // Filter states for Members tab in Details view
    const [memberSearch, setMemberSearch] = useState('');
    const [memberCollege, setMemberCollege] = useState('');
    const [memberCourse, setMemberCourse] = useState('');
    const [memberBranch, setMemberBranch] = useState('');
    const [memberYear, setMemberYear] = useState('');

    // Modal States
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [pageAssignmentToEdit, setPageAssignmentToEdit] = useState(null);
    const [pageAccessDraft, setPageAccessDraft] = useState(() => getPagePermissions());
    const [clubRoleDraft, setClubRoleDraft] = useState({ roleCode: '', roleName: '' });
    const [savingPageAccess, setSavingPageAccess] = useState(false);

    // Form Data for Club
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        image: null,
        membership_fee: '',
        fee_type: 'Yearly',
        admin_roles: [] // Array of multiple assigned admin roles [{ userId, hrmsId, empNo, name, email, roleCode, roleName }]
    });

    // Temp state for adding multiple dynamic admin roles inside Club Creation/Edit modal
    const [selectedRoleCode, setSelectedRoleCode] = useState('');
    const [hrmsSearchQuery, setHrmsSearchQuery] = useState('');
    const [hrmsSearchResults, setHrmsSearchResults] = useState([]);
    const [searchingHrms, setSearchingHrms] = useState(false);
    const [selectedHrmsEmployee, setSelectedHrmsEmployee] = useState(null);
    const [hrmsUserStatus, setHrmsUserStatus] = useState(null);

    // Club Logo Update in Settings Tab & Modal
    const [clubLogoFile, setClubLogoFile] = useState(null);
    const [clubLogoPreview, setClubLogoPreview] = useState(null);
    const [updatingLogo, setUpdatingLogo] = useState(false);
    const [formLogoPreview, setFormLogoPreview] = useState(null);

    // Direct Add Student Member Modal State
    const [showAddStudentMemberModal, setShowAddStudentMemberModal] = useState(false);
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [studentSearchResults, setStudentSearchResults] = useState([]);
    const [searchingStudentsForAdd, setSearchingStudentsForAdd] = useState(false);
    const [addingMember, setAddingMember] = useState(false);

    // Role Assignee Type & Student Role Search inside Creation/Edit Modal
    const [roleAssigneeType, setRoleAssigneeType] = useState('student'); // 'student' | 'hrms'
    const [studentRoleSearchQuery, setStudentRoleSearchQuery] = useState('');
    const [studentRoleSearchResults, setStudentRoleSearchResults] = useState([]);
    const [searchingRoleStudent, setSearchingRoleStudent] = useState(false);
    const [selectedStudentRole, setSelectedStudentRole] = useState(null);

    // New/Edit Role Form Data
    const [roleForm, setRoleForm] = useState({
        role_name: '',
        description: '',
        pages: [...DEFAULT_CLUB_ADMIN_PAGES],
        can_create_users: false
    });

    // Inline Create User Form Data (for HRMS employee without SDMS user account)
    // Uses HRMS credentials — no manual password needed
    const [collegesList, setCollegesList] = useState([]);
    const [createUserRoleOptions, setCreateUserRoleOptions] = useState(DEFAULT_USER_ROLE_OPTIONS);
    const effectiveCreateUserRoleOptions = hasUserManagementControl
        ? createUserRoleOptions
        : (canCreateUserAccounts ? [{ value: 'faculty', label: 'Faculty' }] : []);
    const [createUserCourses, setCreateUserCourses] = useState([]);
    const [createUserBranches, setCreateUserBranches] = useState([]);
    const [loadingCreateUserCourses, setLoadingCreateUserCourses] = useState(false);
    const [loadingCreateUserBranches, setLoadingCreateUserBranches] = useState(false);
    const [createUserForm, setCreateUserForm] = useState({
        name: '',
        email: '',
        phone: '',
        role: 'faculty',
        college_id: '',
        collegeIds: [],
        courseIds: [],
        branchIds: [],
        allCourses: false,
        allBranches: false,
        hodYears: [],
        allHodYears: true,
        hrms_id: ''
    });
    const [creatingUser, setCreatingUser] = useState(false);

    // Activity Modal State
    const [showActivityModal, setShowActivityModal] = useState(false);
    const [editingActivityId, setEditingActivityId] = useState(null);
    const [activityForm, setActivityForm] = useState({ title: '', description: '', date: '', location: '' });
    const [activityImageFiles, setActivityImageFiles] = useState([]);
    const [existingActivityImages, setExistingActivityImages] = useState([]);
    const [savingActivity, setSavingActivity] = useState(false);
    const [previewModalImage, setPreviewModalImage] = useState(null);

    useEffect(() => {
        fetchClubs();
        if (isAdmin || canManageClubRoles || canManageClubAdmins || getClubPageAccess(null, 'settings').read) fetchDynamicRoles();
        api.get('/colleges?includeInactive=false')
            .then(r => {
                if (r.data?.success && r.data?.data) {
                    setCollegesList(r.data.data);
                }
            })
            .catch(() => {});
        api.get('/rbac/users/roles/available')
            .then(r => {
                if (r.data?.success && Array.isArray(r.data?.data) && r.data.data.length > 0) {
                    setCreateUserRoleOptions(r.data.data);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (subPage === 'students') {
            fetchStudents();
        }
    }, [subPage]);

    const fetchClubs = async () => {
        setLoading(true);
        try {
            const response = await clubService.getClubs();
            if (response.success && response.data) {
                setClubs(response.data);
            }
        } catch (error) {
            toast.error('Failed to fetch clubs');
        } finally {
            setLoading(false);
        }
    };

    const fetchDynamicRoles = async () => {
        try {
            const res = await clubService.getClubRoles();
            if (res.success && res.data) {
                setDynamicRoles(res.data);
                if (res.data.length > 0 && !selectedRoleCode) {
                    setSelectedRoleCode(res.data[0].role_code);
                }
            }
        } catch (error) {
            console.error('Failed to fetch club roles:', error);
        }
    };

    const fetchStudents = async () => {
        setStudentsLoading(true);
        try {
            const res = await clubService.getAllClubStudents({
                club_id: studentClubFilter || undefined,
                status: studentStatusFilter || undefined
            });
            if (res.success && res.data) {
                setStudentsList(res.data);
            }
        } catch (error) {
            toast.error('Failed to load club students');
        } finally {
            setStudentsLoading(false);
        }
    };

    const selectedHodBranches = createUserBranches.filter(branch => createUserForm.branchIds.includes(String(branch.id)));
    const selectedHodCourses = createUserCourses.filter(course => createUserForm.courseIds.includes(String(course.id)));
    const branchYearCount = Math.max(0, ...selectedHodBranches.map(branch => Number(branch.totalYears || branch.total_years || branch.structure?.totalYears) || 0));
    const courseYearCount = Math.max(0, ...selectedHodCourses.map(course => Number(course.totalYears || course.total_years || course.structure?.totalYears) || 0));
    const createUserHodYearCount = Math.min(10, branchYearCount || courseYearCount || 4);

    // --- Dynamic Employee / HRMS Search ---
    const handleSearchHrms = async (query) => {
        setHrmsSearchQuery(query);
        if (!query || !query.trim()) {
            setHrmsSearchResults([]);
            return;
        }
        setSearchingHrms(true);
        try {
            const res = await clubService.searchHrmsEmployees(query.trim());
            if (res.success && res.data) {
                setHrmsSearchResults(res.data);
            }
        } catch (error) {
            console.error('Employee Search Error:', error);
        } finally {
            setSearchingHrms(false);
        }
    };

    const handleSelectHrmsEmployee = async (emp) => {
        setSelectedHrmsEmployee(emp);
        setHrmsSearchResults([]);

        if (emp.hasUserAccount) {
            setHrmsUserStatus({
                checking: false,
                hasUserAccount: true,
                userAccount: emp.userAccount || { id: emp._id, username: emp.emp_no }
            });
            return;
        }

        setHrmsUserStatus({ checking: true });
        try {
            const checkRes = await clubService.checkHrmsUserAccount({
                hrms_id: emp._id,
                email: emp.email,
                emp_no: emp.emp_no
            });

            if (checkRes.success) {
                setHrmsUserStatus({
                    checking: false,
                    hasUserAccount: checkRes.hasUserAccount,
                    userAccount: checkRes.userAccount
                });
            }
        } catch (err) {
            console.error('Error checking user account:', err);
            setHrmsUserStatus({ checking: false, hasUserAccount: false, userAccount: null });
        }
    };

    const loadCreateUserCourses = async (collegeIds) => {
        if (!collegeIds.length) {
            setCreateUserCourses([]);
            return;
        }
        setLoadingCreateUserCourses(true);
        try {
            const responses = await Promise.all(collegeIds.map(id => api.get(`/colleges/${id}/courses?includeInactive=false`)));
            setCreateUserCourses(responses.flatMap((response, index) =>
                (response.data?.data || []).map(course => ({ ...course, collegeId: collegeIds[index] }))
            ));
        } catch (error) {
            toast.error('Failed to load courses');
            setCreateUserCourses([]);
        } finally {
            setLoadingCreateUserCourses(false);
        }
    };

    const loadCreateUserBranches = async (courseIds) => {
        if (!courseIds.length) {
            setCreateUserBranches([]);
            return;
        }
        setLoadingCreateUserBranches(true);
        try {
            const responses = await Promise.all(courseIds.map(id => api.get(`/courses/${id}/branches?includeInactive=false`)));
            setCreateUserBranches(responses.flatMap((response, index) =>
                (response.data?.data || []).map(branch => ({
                    ...branch,
                    courseId: courseIds[index],
                    courseName: createUserCourses.find(course => String(course.id) === String(courseIds[index]))?.name || ''
                }))
            ));
        } catch (error) {
            toast.error('Failed to load branches');
            setCreateUserBranches([]);
        } finally {
            setLoadingCreateUserBranches(false);
        }
    };

    const handleCreateUserCollegeChange = async (collegeIds) => {
        setCreateUserForm(prev => ({
            ...prev,
            college_id: collegeIds[0] || '',
            collegeIds,
            courseIds: [],
            branchIds: [],
            allCourses: false,
            allBranches: false
        }));
        setCreateUserBranches([]);
        await loadCreateUserCourses(collegeIds);
    };

    const handleCreateUserCourseChange = async (courseIds) => {
        setCreateUserForm(prev => ({ ...prev, courseIds, branchIds: [], allBranches: false }));
        await loadCreateUserBranches(courseIds);
    };

    // Open inline modal to create SDMS user account for HRMS employee
    const handleOpenCreateUserModal = () => {
        if (!canCreateUserAccounts) {
            return toast.error('Your club role does not have user creation access');
        }
        if (!selectedHrmsEmployee) return;
        const defaultCol = collegesList.length > 0 ? collegesList[0].id : '';
        setCreateUserForm({
            name: selectedHrmsEmployee.name || '',
            email: selectedHrmsEmployee.email && !selectedHrmsEmployee.email.includes('@hrms') ? selectedHrmsEmployee.email : `${selectedHrmsEmployee.emp_no}@pydah.edu.in`,
            phone: selectedHrmsEmployee.phone || '',
            role: 'faculty',
            college_id: defaultCol,
            collegeIds: defaultCol ? [String(defaultCol)] : [],
            courseIds: [],
            branchIds: [],
            allCourses: false,
            allBranches: false,
            hodYears: [],
            allHodYears: true,
            hrms_id: selectedHrmsEmployee._id || ''
        });
        setCreateUserCourses([]);
        setCreateUserBranches([]);
        if (defaultCol) loadCreateUserCourses([String(defaultCol)]);
        setShowCreateUserModal(true);
    };

    const handleCreateSDMSUserAccount = async (e) => {
        e.preventDefault();
        if (!createUserForm.collegeIds.length) return toast.error('Select at least one college');
        if (createUserForm.role === 'branch_hod' && createUserForm.courseIds.length === 0) {
            return toast.error('Select at least one course for a Branch HOD');
        }
        if (createUserForm.role === 'branch_hod' && createUserForm.branchIds.length === 0) {
            return toast.error('Select at least one branch for a Branch HOD');
        }
        if (createUserForm.role === 'branch_hod' && !createUserForm.allHodYears && createUserForm.hodYears.length === 0) {
            return toast.error('Select at least one year or choose All Years');
        }
        setCreatingUser(true);
        try {
            // Use emp_no as username and HRMS-linked credentials (no manual password)
            const payload = {
                ...createUserForm,
                college_id: createUserForm.college_id,
                collegeIds: createUserForm.collegeIds,
                courseIds: createUserForm.role === 'branch_hod' || !createUserForm.allCourses ? createUserForm.courseIds : [],
                branchIds: createUserForm.role === 'branch_hod' || !createUserForm.allBranches ? createUserForm.branchIds : [],
                allCourses: createUserForm.role !== 'branch_hod' && createUserForm.allCourses,
                allBranches: createUserForm.role !== 'branch_hod' && createUserForm.allBranches,
                hodYears: createUserForm.role === 'branch_hod' ? createUserForm.hodYears : [],
                allHodYears: createUserForm.role === 'branch_hod' ? !!createUserForm.allHodYears : false,
                username: selectedHrmsEmployee?.emp_no || createUserForm.email,
                use_hrms_credentials: true  // backend will derive password from HRMS link
            };
            const response = await api.post('/rbac/users/from-club-admin', payload);
            if (response.data && response.data.success) {
                toast.success(`SDMS User Account created for ${createUserForm.name}`);
                setShowCreateUserModal(false);
                const newUser = response.data.data;
                setHrmsUserStatus({
                    checking: false,
                    hasUserAccount: true,
                    userAccount: newUser
                });
            } else {
                toast.error(response.data?.message || 'Failed to create user account');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create user account');
        } finally {
            setCreatingUser(false);
        }
    };

    // Activity handlers: Create, Edit, Delete
    const handleOpenCreateActivity = () => {
        setEditingActivityId(null);
        setActivityForm({ title: '', description: '', date: new Date().toISOString().split('T')[0], location: '' });
        setActivityImageFiles([]);
        setExistingActivityImages([]);
        setShowActivityModal(true);
    };

    const handleOpenEditActivity = (act) => {
        setEditingActivityId(act.id);
        setActivityForm({
            title: act.title || '',
            description: act.description || '',
            date: act.date || (act.posted_at ? new Date(act.posted_at).toISOString().split('T')[0] : ''),
            location: act.location || ''
        });
        const currentImages = Array.isArray(act.images) && act.images.length > 0
            ? act.images
            : (act.image_url ? [act.image_url] : []);
        setExistingActivityImages(currentImages);
        setActivityImageFiles([]);
        setShowActivityModal(true);
    };

    const handleDeleteActivity = async (activityId) => {
        if (!activityId) return;
        if (!window.confirm('Are you sure you want to delete this activity? This action cannot be undone.')) {
            return;
        }
        try {
            const res = await clubService.deleteActivity(selectedClub.id, activityId);
            if (res.success) {
                toast.success('Activity deleted successfully');
                const updated = await clubService.getClubDetails(selectedClub.id);
                if (updated.success) setSelectedClub(updated.data);
            } else {
                toast.error(res.message || 'Failed to delete activity');
            }
        } catch (err) {
            toast.error('Failed to delete activity');
        }
    };

    const handleSaveActivity = async (e) => {
        e.preventDefault();
        if (!selectedClub?.id) return;
        setSavingActivity(true);
        try {
            const formData = new FormData();
            formData.append('title', activityForm.title);
            formData.append('description', activityForm.description || '');
            formData.append('date', activityForm.date || '');
            formData.append('location', activityForm.location || '');

            if (editingActivityId) {
                formData.append('existing_images', JSON.stringify(existingActivityImages));
            }

            // Append newly selected images (single or group)
            activityImageFiles.forEach(file => {
                formData.append('images', file);
            });

            let res;
            if (editingActivityId) {
                res = await clubService.updateActivity(selectedClub.id, editingActivityId, formData);
            } else {
                res = await clubService.createActivity(selectedClub.id, formData);
            }

            if (res.success) {
                toast.success(editingActivityId ? 'Activity updated successfully' : 'Activity added successfully');
                setShowActivityModal(false);
                setEditingActivityId(null);
                setActivityForm({ title: '', description: '', date: '', location: '' });
                setActivityImageFiles([]);
                setExistingActivityImages([]);
                const updated = await clubService.getClubDetails(selectedClub.id);
                if (updated.success) setSelectedClub(updated.data);
            } else {
                toast.error(res.message || 'Failed to save activity');
            }
        } catch (err) {
            toast.error('Failed to save activity');
        } finally {
            setSavingActivity(false);
        }
    };

    const handleAddAdminRoleAssignment = () => {
        if (!selectedRoleCode) return toast.error('Please select a role');
        if (!selectedHrmsEmployee) return toast.error('Please select an employee');
        if (!hrmsUserStatus?.hasUserAccount) {
            return toast.error('Employee must have an active SDMS User Account before assignment.');
        }

        const roleObj = dynamicRoles.find(r => r.role_code === selectedRoleCode) || { role_name: selectedRoleCode };
        const isSuperAdmin = ['admin', 'super_admin', 'superadmin'].includes(String(hrmsUserStatus.userAccount?.role || '').toLowerCase());
        const pagePermissions = isSuperAdmin
            ? getPagePermissions()
            : getPagePermissions({ pages: roleObj.pages || DEFAULT_CLUB_ADMIN_PAGES });

        const newAssignment = {
            userId: hrmsUserStatus.userAccount?.id,
            hrmsId: selectedHrmsEmployee._id,
            empNo: selectedHrmsEmployee.emp_no,
            name: selectedHrmsEmployee.name,
            email: selectedHrmsEmployee.email,
            roleCode: selectedRoleCode,
            roleName: roleObj.role_name,
            pages: pagesFromPermissions(pagePermissions),
            pagePermissions,
            isSuperAdmin
        };

        setFormData(prev => ({
            ...prev,
            admin_roles: [...(prev.admin_roles || []), newAssignment]
        }));

        setSelectedHrmsEmployee(null);
        setHrmsSearchQuery('');
        setHrmsUserStatus(null);
        toast.success(`Assigned ${newAssignment.name} as ${newAssignment.roleName}`);
    };

    const handleSearchRoleStudent = async (query) => {
        setStudentRoleSearchQuery(query);
        if (!query || !query.trim()) {
            setStudentRoleSearchResults([]);
            return;
        }
        setSearchingRoleStudent(true);
        try {
            const res = await clubService.searchStudents(query.trim());
            if (res.success && res.data) {
                setStudentRoleSearchResults(res.data);
            }
        } catch (err) {
            console.error('Error searching students for role:', err);
        } finally {
            setSearchingRoleStudent(false);
        }
    };

    const handleAddStudentRoleAssignment = () => {
        if (!selectedRoleCode) return toast.error('Please select a role');
        if (!selectedStudentRole) return toast.error('Please select a student');

        const roleObj = dynamicRoles.find(r => r.role_code === selectedRoleCode) || { role_name: selectedRoleCode };
        const pagePermissions = getPagePermissions({ pages: roleObj.pages || DEFAULT_CLUB_ADMIN_PAGES });

        const newAssignment = {
            userId: selectedStudentRole.admission_number,
            studentId: selectedStudentRole.id,
            empNo: selectedStudentRole.admission_number,
            name: selectedStudentRole.student_name,
            email: selectedStudentRole.email || `${selectedStudentRole.admission_number}@student.pydah.edu.in`,
            roleCode: selectedRoleCode,
            roleName: roleObj.role_name,
            isStudent: true,
            pages: pagesFromPermissions(pagePermissions),
            pagePermissions,
            isSuperAdmin: false
        };

        setFormData(prev => ({
            ...prev,
            admin_roles: [...(prev.admin_roles || []), newAssignment]
        }));

        setSelectedStudentRole(null);
        setStudentRoleSearchQuery('');
        setStudentRoleSearchResults([]);
        toast.success(`Assigned ${newAssignment.name} as ${newAssignment.roleName}`);
    };

    const handleUpdateClubLogo = async (file) => {
        if (!file || !selectedClub?.id) return;
        setUpdatingLogo(true);
        try {
            const data = new FormData();
            data.append('image', file);
            const res = await clubService.updateClub(selectedClub.id, data);
            if (res.success) {
                toast.success('Club logo updated successfully');
                setClubLogoFile(null);
                setClubLogoPreview(null);
                fetchClubs();
                const updated = await clubService.getClubDetails(selectedClub.id);
                if (updated?.success && updated?.data) {
                    setSelectedClub(updated.data);
                }
            } else {
                toast.error(res.message || 'Failed to update club logo');
            }
        } catch (err) {
            toast.error('Failed to update club logo');
        } finally {
            setUpdatingLogo(false);
        }
    };

    const handleSearchStudentsForAdd = async (query) => {
        setStudentSearchQuery(query);
        if (!query || !query.trim()) {
            setStudentSearchResults([]);
            return;
        }
        setSearchingStudentsForAdd(true);
        try {
            const res = await clubService.searchStudents(query.trim());
            if (res.success && res.data) {
                setStudentSearchResults(res.data);
            }
        } catch (err) {
            console.error('Error searching students:', err);
        } finally {
            setSearchingStudentsForAdd(false);
        }
    };

    const handleAddStudentToClub = async (student) => {
        if (!student || !selectedClub?.id) return;
        setAddingMember(true);
        try {
            const res = await clubService.addClubMember(selectedClub.id, {
                studentId: student.id,
                admission_number: student.admission_number,
                status: 'approved'
            });
            if (res.success) {
                toast.success(res.message || `${student.student_name} added to club successfully`);
                fetchClubs();
                const updated = await clubService.getClubDetails(selectedClub.id);
                if (updated?.success && updated?.data) {
                    setSelectedClub(updated.data);
                }
                fetchStudents();
            } else {
                toast.error(res.message || 'Failed to add student to club');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add student to club');
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!confirm('Are you sure you want to remove this member from the club?')) return;
        try {
            const res = await clubService.removeClubMember(selectedClub.id, memberId);
            if (res.success) {
                toast.success('Member removed from club');
                const updated = await clubService.getClubDetails(selectedClub.id);
                if (updated?.success && updated?.data) {
                    setSelectedClub(updated.data);
                }
                fetchClubs();
                fetchStudents();
            } else {
                toast.error(res.message || 'Failed to remove member');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to remove member');
        }
    };

    const handleRemoveAdminRoleAssignment = (index) => {
        setFormData(prev => ({
            ...prev,
            admin_roles: prev.admin_roles.filter((_, i) => i !== index)
        }));
    };

    const handleChangeAssignedClubRole = (assignmentIndex, roleCode) => {
        const selectedRole = dynamicRoles.find(role => role.role_code === roleCode);
        if (!selectedRole) return;
        setFormData(prev => ({
            ...prev,
            admin_roles: prev.admin_roles.map((assignment, index) => {
                if (index !== assignmentIndex) return assignment;
                const pagePermissions = assignment.isSuperAdmin
                    ? getPagePermissions()
                    : getPagePermissions({ pages: selectedRole.pages || DEFAULT_CLUB_ADMIN_PAGES });
                return {
                    ...assignment,
                    roleCode: selectedRole.role_code,
                    roleName: selectedRole.role_name,
                    pagePermissions,
                    pages: pagesFromPermissions(pagePermissions)
                };
            })
        }));
    };

    const handleToggleAdminRolePage = (assignmentIndex, pageKey, accessType) => {
        setFormData(prev => ({
            ...prev,
            admin_roles: prev.admin_roles.map((assignment, index) => {
                if (index !== assignmentIndex || assignment.isSuperAdmin) return assignment;
                const pagePermissions = getPagePermissions(assignment);
                const current = pagePermissions[pageKey];
                const next = { ...current, [accessType]: !current[accessType] };
                if (accessType === 'write' && next.write) next.read = true;
                if (accessType === 'read' && !next.read) next.write = false;
                pagePermissions[pageKey] = next;
                return {
                    ...assignment,
                    pagePermissions,
                    pages: pagesFromPermissions(pagePermissions)
                };
            })
        }));
    };

    const openClubUserEditor = (club, assignment, assignmentIndex) => {
        setPageAssignmentToEdit({ club, assignment, assignmentIndex });
        setPageAccessDraft(assignment.isSuperAdmin ? getPagePermissions() : getPagePermissions(assignment));
        setClubRoleDraft({
            roleCode: assignment.roleCode || '',
            roleName: assignment.roleName || assignment.roleCode || ''
        });
    };

    const handleSavePageAccess = async () => {
        if (!pageAssignmentToEdit) return;
        const { club, assignmentIndex } = pageAssignmentToEdit;
        const adminRoles = (club.admin_roles || []).map((assignment, index) =>
            index === assignmentIndex ? (() => {
                const pagePermissions = assignment.isSuperAdmin ? getPagePermissions() : pageAccessDraft;
                return {
                    ...assignment,
                    roleCode: clubRoleDraft.roleCode || assignment.roleCode,
                    roleName: clubRoleDraft.roleName || assignment.roleName,
                    pagePermissions,
                    pages: pagesFromPermissions(pagePermissions)
                };
            })() : assignment
        );
        const updateData = new FormData();
        updateData.append('name', club.name || '');
        updateData.append('description', club.description || '');
        updateData.append('membership_fee', club.membership_fee || 0);
        updateData.append('fee_type', club.fee_type || 'Yearly');
        updateData.append('admin_roles', JSON.stringify(adminRoles));

        setSavingPageAccess(true);
        try {
            const response = await clubService.updateClub(club.id, updateData);
            if (!response.success) throw new Error(response.message || 'Could not update page access');
            toast.success('Club role and page access updated');
            setPageAssignmentToEdit(null);
            await fetchClubs();
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to update page access');
        } finally {
            setSavingPageAccess(false);
        }
    };

    // --- Dynamic Club Roles Management ---
    const handleSaveDynamicRole = async (e) => {
        e.preventDefault();
        try {
            if (editingRole) {
                const res = await clubService.updateClubRole(editingRole.id, roleForm);
                if (res.success) {
                    toast.success('Dynamic role updated');
                    setShowRoleModal(false);
                    setEditingRole(null);
                    setRoleForm({
                        role_name: '',
                        description: '',
                        pages: [...DEFAULT_CLUB_ADMIN_PAGES],
                        can_create_users: false
                    });
                    fetchDynamicRoles();
                } else {
                    toast.error(res.message || 'Failed to update role');
                }
            } else {
                const res = await clubService.createClubRole(roleForm);
                if (res.success) {
                    toast.success('Dynamic role created');
                    setShowRoleModal(false);
                    setRoleForm({
                        role_name: '',
                        description: '',
                        pages: [...DEFAULT_CLUB_ADMIN_PAGES],
                        can_create_users: false
                    });
                    fetchDynamicRoles();
                } else {
                    toast.error(res.message || 'Failed to create role');
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving dynamic role');
        }
    };

    const handleOpenEditRole = (role) => {
        setEditingRole(role);
        setRoleForm({
            role_name: role.role_name || '',
            description: role.description || '',
            pages: [...(role.pages || DEFAULT_CLUB_ADMIN_PAGES)],
            can_create_users: role.can_create_users === true || Number(role.can_create_users) === 1
        });
        setShowRoleModal(true);
    };

    const handleToggleRolePage = (pageKey) => {
        setRoleForm(prev => ({
            ...prev,
            pages: (prev.pages || DEFAULT_CLUB_ADMIN_PAGES).includes(pageKey)
                ? (prev.pages || DEFAULT_CLUB_ADMIN_PAGES).filter(page => page !== pageKey)
                : [...(prev.pages || DEFAULT_CLUB_ADMIN_PAGES), pageKey]
        }));
    };

    const handleDeleteDynamicRole = async (roleId) => {
        if (!window.confirm('Are you sure you want to delete this dynamic role?')) return;
        try {
            const res = await clubService.deleteClubRole(roleId);
            if (res.success) {
                toast.success('Role deleted');
                fetchDynamicRoles();
            } else {
                toast.error(res.message || 'Failed to delete role');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting role');
        }
    };

    // --- Club Actions ---
    const handleCreateClub = async (e) => {
        e.preventDefault();
        try {
            if (!formData.name) return toast.error('Club name is required');
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('membership_fee', formData.membership_fee);
            data.append('fee_type', formData.fee_type);
            data.append('admin_roles', JSON.stringify(formData.admin_roles || []));

            if (formData.image) {
                data.append('image', formData.image);
            }

            const response = await clubService.createClub(data);
            if (response.success) {
                toast.success('Student Club created successfully');
                setShowCreateModal(false);
                resetForm();
                fetchClubs();
            } else {
                toast.error(response.message || 'Failed to create club');
            }
        } catch (error) {
            console.error('Failed to create club:', error.response?.data || error);
            toast.error(error.response?.data?.message || 'Failed to create club');
        }
    };

    const handleUpdateClub = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('description', formData.description);
            data.append('membership_fee', formData.membership_fee);
            data.append('fee_type', formData.fee_type);
            data.append('admin_roles', JSON.stringify(formData.admin_roles || []));

            if (formData.image) {
                data.append('image', formData.image);
            }

            const response = await clubService.updateClub(selectedClub.id, data);
            if (response.success) {
                toast.success('Club updated successfully');
                setShowEditModal(false);
                fetchClubs();
                if (selectedClub) {
                    const updated = await clubService.getClubDetails(selectedClub.id);
                    if (updated.success) setSelectedClub(updated.data);
                }
            }
        } catch (error) {
            toast.error('Failed to update club');
        }
    };

    const handleToggleStatus = async (clubId, currentStatus) => {
        try {
            const response = await clubService.toggleClubStatus(clubId, !currentStatus);
            if (response.success) {
                toast.success(response.message);
                fetchClubs();
            }
        } catch (error) {
            toast.error('Failed to toggle club status');
        }
    };

    const handleApprovalAction = async (clubId, studentId, status) => {
        try {
            const res = await clubService.updateMembershipStatus(clubId, studentId, status);
            if (res.success) {
                toast.success(`Request ${status} successfully`);
                fetchClubs();
                fetchStudents();
                if (selectedClub && selectedClub.id === clubId) {
                    const updatedClub = await clubService.getClubDetails(clubId);
                    if (updatedClub?.success && updatedClub?.data) {
                        setSelectedClub(updatedClub.data);
                    }
                }
            }
        } catch (error) {
            toast.error(`Failed to ${status} request`);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            image: null,
            membership_fee: '',
            fee_type: 'Yearly',
            admin_roles: []
        });
        setFormLogoPreview(null);
        setSelectedHrmsEmployee(null);
        setHrmsSearchQuery('');
        setHrmsUserStatus(null);
        setSelectedStudentRole(null);
        setStudentRoleSearchQuery('');
        setStudentRoleSearchResults([]);
    };

    const prepareEdit = (club) => {
        setSelectedClub(club);
        setFormData({
            name: club.name || '',
            description: club.description || '',
            image: null,
            membership_fee: club.membership_fee || '',
            fee_type: club.fee_type || 'Yearly',
            admin_roles: club.admin_roles || []
        });
        setFormLogoPreview(club.image_url || null);
        setSelectedHrmsEmployee(null);
        setHrmsSearchQuery('');
        setHrmsUserStatus(null);
        setSelectedStudentRole(null);
        setStudentRoleSearchQuery('');
        setStudentRoleSearchResults([]);
        setShowEditModal(true);
    };

    const handleViewDetails = async (club) => {
        if (!club) return;
        setSelectedClub(club);
        setDetailsTab('overview');
        setViewMode('details');
        try {
            const res = await clubService.getClubDetails(club.id);
            if (res.success && res.data) {
                setSelectedClub(res.data);
            }
        } catch (error) {
            console.error('Failed to load full club details:', error);
        }
    };

    const filteredStudents = studentsList.filter(s => {
        const matchesSearch = !studentSearch || 
            s.student_name?.toLowerCase().includes(studentSearch.toLowerCase()) || 
            s.admission_number?.toLowerCase().includes(studentSearch.toLowerCase());
        const matchesClub = !studentClubFilter || String(s.club_id) === String(studentClubFilter);
        const matchesStatus = !studentStatusFilter || s.status === studentStatusFilter;
        return matchesSearch && matchesClub && matchesStatus;
    });

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">

            {/* ================= 1. SUBPAGE: CLUB MANAGEMENT ================= */}
            {subPage === 'management' && (
                <>
                    {viewMode === 'list' ? (
                        <div className="space-y-4">
                            {/* Top Bar */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center shadow-sm">
                                        <Users size={20} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-extrabold text-main leading-tight">Student Clubs</h2>
                                        <p className="text-xs text-muted-text">{clubs.length} {clubs.length === 1 ? 'club' : 'clubs'} registered</p>
                                    </div>
                                </div>
                                {(isAdmin || canManageClubAdmins || hasPermission(user?.permissions, BACKEND_MODULES.CLUBS, 'manage')) && (
                                    <button
                                        onClick={() => { resetForm(); setShowCreateModal(true); }}
                                        className="w-full sm:w-auto px-4 py-2.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm"
                                    >
                                        <Plus size={16} strokeWidth={2.5} /> Create Club
                                    </button>
                                )}
                            </div>

                            {/* Clubs Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {clubs.map(club => (
                                    <ClubCard
                                        key={club.id}
                                        club={club}
                                        onViewDetails={handleViewDetails}
                                        isAdmin={isAdmin}
                                        canEdit={isAdmin || canManageClubAdmins || getClubPageAccess(club.id, 'settings').write}
                                        onToggleStatus={handleToggleStatus}
                                        onEdit={prepareEdit}
                                    />
                                ))}
                                {clubs.length === 0 && !loading && (
                                    <div className="col-span-full py-20 text-center text-muted-text bg-surface rounded-xl border border-dashed border-border-strong">
                                        <Shield size={48} className="mx-auto mb-4 opacity-20" />
                                        <p className="text-lg font-medium text-muted-text">No student clubs found</p>
                                        <p className="text-sm">Click "Create New Club" to register a new student club</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Club Details View */
                        <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-sm">
                            {/* Gradient Banner Header */}
                            {(() => {
                                const gradients = [
                                    'from-primary to-primary',
                                    'from-secondary to-secondary',
                                    'from-success to-primary',
                                    'from-warning to-danger',
                                    'from-info to-info',
                                    'from-accent to-accent',
                                ];
                                const gradient = gradients[(selectedClub?.id || 0) % gradients.length];
                                const initials = selectedClub?.name ? selectedClub.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
                                return (
                                    <div className={`bg-gradient-to-br ${gradient} px-6 pt-6 pb-4 relative`}>
                                        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
                                            <div className="flex items-end gap-4">
                                                <button
                                                    onClick={() => setViewMode('list')}
                                                    className="p-2 rounded-xl bg-[var(--surface)]/20 backdrop-blur-sm text-white hover:bg-[var(--surface)]/30 transition-all mb-0.5"
                                                >
                                                    <ArrowRight size={18} className="rotate-180" />
                                                </button>
                                                <div className="w-16 h-16 rounded-2xl border-2 border-surface overflow-hidden bg-[var(--surface)]/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                                    {selectedClub?.image_url ? (
                                                        <img src={selectedClub.image_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-white font-extrabold text-xl">{initials}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h2 className="text-2xl font-extrabold text-white">{selectedClub?.name}</h2>
                                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
                                                            selectedClub?.is_active ? 'bg-[var(--surface)]/20 text-white' : 'bg-[var(--danger-light)] text-danger'
                                                        }`}>
                                                            {selectedClub?.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-white/80 mt-0.5 max-w-xl line-clamp-1">{selectedClub?.description}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 pb-1">
                                                {getClubPageAccess(selectedClub?.id, 'settings').write && (
                                                    <button
                                                        onClick={() => prepareEdit(selectedClub)}
                                                        className="px-3.5 py-2 bg-[var(--surface)]/20 backdrop-blur-sm text-white hover:bg-[var(--surface)]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-surface"
                                                    >
                                                        <Edit2 size={14} /> Edit Club
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setDetailsTab('chat')}
                                                    disabled={!getClubPageAccess(selectedClub?.id, 'management').read}
                                                    title={!getClubPageAccess(selectedClub?.id, 'management').read ? 'Management read access required' : 'Open club chat'}
                                                    className="px-3.5 py-2 bg-[var(--surface)]/20 backdrop-blur-sm text-white hover:bg-[var(--surface)]/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border border-surface"
                                                >
                                                    <MessageSquare size={14} /> Chat
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Inner Navigation Tabs Bar */}
                            {(() => {
                                const approvedMembers = (selectedClub?.members || []).filter(m => m.status === 'approved');
                                const pendingFeeStudents = (selectedClub?.members || []).filter(m =>
                                    m.payment_status === 'payment_due' || Number(m.due_amount) > 0 || (Number(selectedClub?.membership_fee) > 0 && m.status !== 'approved')
                                );
                                const clubActivities = selectedClub?.activities || [];

                                return (
                                    <>
                                        {/* Tab Strip */}
                                        <div className="border-b border-border bg-surface">
                                            <div className="flex items-center gap-0 overflow-x-auto px-6 scrollbar-hide">
                                                {[
                                                    { key: 'overview', label: 'Overview', pageKey: 'management', icon: Shield },
                                                    { key: 'members', label: `Members`, pageKey: 'students', count: approvedMembers.length, icon: Users },
                                                    { key: 'pending', label: `Pending`, pageKey: 'students', count: pendingFeeStudents.length, icon: Clock },
                                                    { key: 'activities', label: `Activities`, pageKey: 'management', count: clubActivities.length, icon: Calendar },
                                                    { key: 'chat', label: 'Chat', pageKey: 'management', icon: MessageSquare },
                                                    { key: 'admins', label: 'Club Admins', pageKey: 'settings', count: selectedClub?.admin_roles?.length || 0, icon: UserCheck },
                                                    { key: 'settings', label: 'Settings', pageKey: 'settings', icon: Settings }
                                                ].filter(tab => getClubPageAccess(selectedClub?.id, tab.pageKey).read).map(tab => {
                                                    const Icon = tab.icon;
                                                    const isActive = detailsTab === tab.key;
                                                    return (
                                                        <button
                                                            key={tab.key}
                                                            onClick={() => setDetailsTab(tab.key)}
                                                            className={`flex items-center gap-2 px-4 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                                                                isActive
                                                                    ? 'border-primary text-primary'
                                                                    : 'border-transparent text-muted-text hover:text-main hover:border-border-strong'
                                                            }`}
                                                        >
                                                            <Icon size={14} />
                                                            {tab.label}
                                                            {tab.count !== undefined && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                                                                    isActive
                                                                        ? 'bg-[var(--primary-light)] text-primary'
                                                                        : tab.count > 0
                                                                            ? 'bg-[var(--warning-light)] text-warning'
                                                                            : 'bg-background text-muted-text'
                                                                }`}>
                                                                    {tab.count}
                                                                </span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Tab Content */}
                                        <div className="p-6 space-y-6">

                                        {/* TAB 1: OVERVIEW */}
                                        {detailsTab === 'overview' && (
                                            <div className="space-y-6 pt-2">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                    {getClubPageAccess(selectedClub?.id, 'students').read && <div className="p-4 rounded-xl border border-border bg-[var(--primary-light)]">
                                                        <p className="text-xs text-primary font-medium">Approved Members</p>
                                                        <p className="text-2xl font-bold text-main mt-1">{approvedMembers.length}</p>
                                                    </div>}
                                                    {getClubPageAccess(selectedClub?.id, 'students').read && <div className="p-4 rounded-xl border border-border bg-[var(--warning-light)]">
                                                        <p className="text-xs text-warning font-medium">Fee Pending Students</p>
                                                        <p className="text-2xl font-bold text-main mt-1">{pendingFeeStudents.length}</p>
                                                    </div>}
                                                    <div className="p-4 rounded-xl border border-border bg-[var(--success-light)]">
                                                        <p className="text-xs text-success font-medium">Membership Fee</p>
                                                        <p className="text-2xl font-bold text-main mt-1">{formatMembershipFee(selectedClub?.membership_fee)}</p>
                                                    </div>
                                                    <div className="p-4 rounded-xl border border-border bg-[var(--primary-light)]">
                                                        <p className="text-xs text-secondary font-medium">Fee Schedule</p>
                                                        <p className="text-2xl font-bold text-main mt-1">{selectedClub?.fee_type || 'Yearly'}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-background p-5 rounded-2xl border border-border space-y-4">
                                                    <h3 className="text-sm font-bold text-main flex items-center gap-2">
                                                        <Shield size={18} className="text-primary" /> Club Officers & Dynamic Admin Roles
                                                    </h3>
                                                    {selectedClub?.admin_roles && selectedClub.admin_roles.length > 0 ? (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                            {selectedClub.admin_roles.map((roleItem, i) => (
                                                                <div key={i} className="bg-surface p-3.5 rounded-xl border border-border text-xs shadow-xs">
                                                                    <p className="font-extrabold text-primary">{roleItem.roleName}</p>
                                                                    <p className="font-semibold text-main mt-1">{roleItem.name}</p>
                                                                    <p className="text-[11px] text-muted-text truncate mt-0.5">{roleItem.email}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-muted-text italic">No admin leadership roles assigned yet. Go to Settings tab to manage officers.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {detailsTab === 'admins' && (
                                            <div className="space-y-4 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="text-base font-bold text-main">Club Admins ({selectedClub?.admin_roles?.length || 0})</h3>
                                                        <p className="text-xs text-muted-text">People assigned to manage this club and their page access.</p>
                                                    </div>
                                                    {(isAdmin || canManageClubAdmins || getClubPageAccess(selectedClub?.id, 'settings').write) && (
                                                        <button
                                                            onClick={() => prepareEdit(selectedClub)}
                                                            className="px-3.5 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <Edit2 size={13} /> Edit Club Admins & Roles
                                                        </button>
                                                    )}
                                                </div>
                                                {selectedClub?.admin_roles?.length ? (
                                                    <div className="overflow-x-auto rounded-xl border border-border">
                                                        <table className="w-full text-left text-xs">
                                                            <thead className="border-b bg-background font-semibold uppercase text-sub">
                                                                <tr>
                                                                    <th className="p-3">Name</th>
                                                                    <th className="p-3">Email / Username</th>
                                                                    <th className="p-3">Club Role</th>
                                                                    <th className="p-3">Page Access</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {selectedClub.admin_roles.map((assignment, index) => (
                                                                    <tr key={`${assignment.userId || assignment.email || assignment.empNo}-${index}`}>
                                                                        <td className="p-3 font-semibold text-main">{assignment.name || 'Club Admin'}</td>
                                                                        <td className="p-3 text-sub">{assignment.email || assignment.empNo || '—'}</td>
                                                                        <td className="p-3 text-sub">{assignment.roleName || assignment.roleCode || 'Club Admin'}</td>
                                                                        <td className="p-3">
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {CLUB_ADMIN_PAGES.flatMap(page => {
                                                                                    const access = getPagePermissions(assignment)[page.key];
                                                                                    if (!access.read && !access.write) return [];
                                                                                    return [(
                                                                                        <span key={page.key} className="rounded border border-[var(--success-light)] bg-[var(--success-light)] px-2 py-0.5 text-[10px] font-semibold text-success">
                                                                                            {page.label}: {access.write ? 'Read/Write' : 'Read'}
                                                                                        </span>
                                                                                    )];
                                                                                })}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl border border-dashed border-border-strong bg-background py-12 text-center text-sm text-muted-text">
                                                        No admins are assigned to this club yet.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* TAB 2: MEMBERS */}
                                        {detailsTab === 'members' && (() => {
                                            const memberColleges = Array.from(new Set(approvedMembers.map(m => m.college).filter(Boolean))).sort();
                                            const memberCourses = Array.from(new Set(approvedMembers.map(m => m.course).filter(Boolean))).sort();
                                            const memberBranches = Array.from(new Set(approvedMembers.map(m => m.branch).filter(Boolean))).sort();
                                            const memberYears = Array.from(new Set(approvedMembers.map(m => m.current_year).filter(Boolean))).sort((a, b) => Number(a) - Number(b));

                                            const filteredMembers = approvedMembers.filter(m => {
                                                if (memberCollege && String(m.college || '').toLowerCase() !== memberCollege.toLowerCase()) return false;
                                                if (memberCourse && String(m.course || '').toLowerCase() !== memberCourse.toLowerCase()) return false;
                                                if (memberBranch && String(m.branch || '').toLowerCase() !== memberBranch.toLowerCase()) return false;
                                                if (memberYear && String(m.current_year || '') !== String(memberYear)) return false;
                                                if (memberSearch.trim()) {
                                                    const q = memberSearch.toLowerCase().trim();
                                                    const name = String(m.student_name || m.name || '').toLowerCase();
                                                    const adm = String(m.admission_number || m.pin_no || '').toLowerCase();
                                                    const email = String(m.email || '').toLowerCase();
                                                    const phone = String(m.student_mobile || m.phone_number || '').toLowerCase();
                                                    const branch = String(m.branch || '').toLowerCase();
                                                    const course = String(m.course || '').toLowerCase();
                                                    const college = String(m.college || '').toLowerCase();
                                                    if (!name.includes(q) && !adm.includes(q) && !email.includes(q) && !phone.includes(q) && !branch.includes(q) && !course.includes(q) && !college.includes(q)) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });

                                            const hasActiveMemberFilters = memberSearch || memberCollege || memberCourse || memberBranch || memberYear;

                                            return (
                                                <div className="space-y-4 pt-2">
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                        <div>
                                                            <h3 className="text-base font-bold text-main">
                                                                Approved Student Members ({filteredMembers.length}{hasActiveMemberFilters ? ` of ${approvedMembers.length}` : ''})
                                                            </h3>
                                                            <p className="text-xs text-muted-text">View and manage enrolled student club members.</p>
                                                        </div>
                                                        {getClubPageAccess(selectedClub?.id, 'students').write && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setStudentSearchQuery('');
                                                                    setStudentSearchResults([]);
                                                                    setShowAddStudentMemberModal(true);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                                                            >
                                                                <UserPlus size={14} /> Add Student Member
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Filter Toolbar for Members */}
                                                    <div className="flex flex-wrap items-center gap-2.5 bg-surface p-3 rounded-xl border border-border">
                                                        {/* Search Box */}
                                                        <div className="relative flex-1 min-w-[200px]">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
                                                            <input
                                                                type="text"
                                                                value={memberSearch}
                                                                onChange={(e) => setMemberSearch(e.target.value)}
                                                                placeholder="Search by name, PIN, branch..."
                                                                className="w-full pl-9 pr-7 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary"
                                                            />
                                                            {memberSearch && (
                                                                <button
                                                                    onClick={() => setMemberSearch('')}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* College */}
                                                        <select
                                                            value={memberCollege}
                                                            onChange={(e) => setMemberCollege(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Colleges</option>
                                                            {memberColleges.map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>

                                                        {/* Course */}
                                                        <select
                                                            value={memberCourse}
                                                            onChange={(e) => setMemberCourse(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Courses</option>
                                                            {memberCourses.map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>

                                                        {/* Branch */}
                                                        <select
                                                            value={memberBranch}
                                                            onChange={(e) => setMemberBranch(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Branches</option>
                                                            {memberBranches.map(b => (
                                                                <option key={b} value={b}>{b}</option>
                                                            ))}
                                                        </select>

                                                        {/* Year */}
                                                        <select
                                                            value={memberYear}
                                                            onChange={(e) => setMemberYear(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Years</option>
                                                            {(memberYears.length > 0 ? memberYears : [1, 2, 3, 4]).map(y => (
                                                                <option key={y} value={y}>Year {y}</option>
                                                            ))}
                                                        </select>

                                                        {hasActiveMemberFilters && (
                                                            <button
                                                                onClick={() => {
                                                                    setMemberSearch('');
                                                                    setMemberCollege('');
                                                                    setMemberCourse('');
                                                                    setMemberBranch('');
                                                                    setMemberYear('');
                                                                }}
                                                                className="px-2.5 py-1.5 text-xs font-semibold text-danger hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                <X size={12} /> Clear
                                                            </button>
                                                        )}
                                                    </div>

                                                    <div className="overflow-x-auto border rounded-xl bg-surface shadow-xs">
                                                        <table className="w-full text-left text-xs">
                                                            <thead className="bg-background border-b text-sub uppercase font-semibold">
                                                                <tr>
                                                                    <th className="p-3">Student Name</th>
                                                                    <th className="p-3">Admission No</th>
                                                                    <th className="p-3">Academic Info</th>
                                                                    <th className="p-3">Contact</th>
                                                                    <th className="p-3">Joined Date</th>
                                                                    <th className="p-3">Payment Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {filteredMembers.map((m, idx) => (
                                                                    <tr key={m.id || m.student_id || idx} className="hover:bg-[var(--background)]/50 transition-colors">
                                                                        <td className="p-3 font-semibold text-main">{m.student_name || m.name}</td>
                                                                        <td className="p-3 font-mono text-sub">{m.admission_number || m.student_id || '—'}</td>
                                                                        <td className="p-3 text-sub">
                                                                            {m.course || m.branch ? (
                                                                                <div>
                                                                                    <p className="font-medium">{[m.course, m.branch].filter(Boolean).join(' • ')}</p>
                                                                                    <p className="text-[11px] text-muted-text">
                                                                                        {m.college ? `${m.college} • ` : ''}{m.current_year ? `Year ${m.current_year}` : ''}
                                                                                    </p>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-muted-text italic">Not available</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-muted-text">{m.email || m.phone_number || m.student_mobile || '—'}</td>
                                                                        <td className="p-3 text-muted-text">{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}</td>
                                                                        <td className="p-3">
                                                                            <span className="px-2 py-0.5 bg-[var(--success-light)] text-success rounded-full font-bold text-[10px]">
                                                                                {m.payment_status || 'Paid'}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {filteredMembers.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={6} className="p-8 text-center text-muted-text">
                                                                            {hasActiveMemberFilters
                                                                                ? 'No approved members match the selected filters.'
                                                                                : 'No approved members found for this club yet.'}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* TAB: PENDING STUDENTS & CLUB FEE PENDING */}
                                        {detailsTab === 'pending' && (() => {
                                            const pendingColleges = Array.from(new Set(pendingFeeStudents.map(m => m.college).filter(Boolean))).sort();
                                            const pendingCourses = Array.from(new Set(pendingFeeStudents.map(m => m.course).filter(Boolean))).sort();
                                            const pendingBranches = Array.from(new Set(pendingFeeStudents.map(m => m.branch).filter(Boolean))).sort();
                                            const pendingYears = Array.from(new Set(pendingFeeStudents.map(m => m.current_year).filter(Boolean))).sort((a, b) => Number(a) - Number(b));

                                            const filteredPending = pendingFeeStudents.filter(m => {
                                                if (pendingCollege && String(m.college || '').toLowerCase() !== pendingCollege.toLowerCase()) return false;
                                                if (pendingCourse && String(m.course || '').toLowerCase() !== pendingCourse.toLowerCase()) return false;
                                                if (pendingBranch && String(m.branch || '').toLowerCase() !== pendingBranch.toLowerCase()) return false;
                                                if (pendingYear && String(m.current_year || '') !== String(pendingYear)) return false;
                                                if (pendingSearch.trim()) {
                                                    const q = pendingSearch.toLowerCase().trim();
                                                    const name = String(m.student_name || m.name || '').toLowerCase();
                                                    const adm = String(m.admission_number || m.pin_no || '').toLowerCase();
                                                    const email = String(m.email || '').toLowerCase();
                                                    const phone = String(m.student_mobile || m.phone_number || '').toLowerCase();
                                                    const branch = String(m.branch || '').toLowerCase();
                                                    const course = String(m.course || '').toLowerCase();
                                                    const college = String(m.college || '').toLowerCase();
                                                    if (!name.includes(q) && !adm.includes(q) && !email.includes(q) && !phone.includes(q) && !branch.includes(q) && !course.includes(q) && !college.includes(q)) {
                                                        return false;
                                                    }
                                                }
                                                return true;
                                            });

                                            const hasActivePendingFilters = pendingSearch || pendingCollege || pendingCourse || pendingBranch || pendingYear;

                                            return (
                                                <div className="space-y-4 pt-2">
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                        <div>
                                                            <h3 className="text-base font-bold text-main">
                                                                Pending Students ({filteredPending.length}{hasActivePendingFilters ? ` of ${pendingFeeStudents.length}` : ''})
                                                            </h3>
                                                            <p className="text-xs text-muted-text">
                                                                Students are automatically added as approved members once their club fee is paid.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Filter Toolbar for Pending Students */}
                                                    <div className="flex flex-wrap items-center gap-2.5 bg-surface p-3 rounded-xl border border-border">
                                                        {/* Search Box */}
                                                        <div className="relative flex-1 min-w-[200px]">
                                                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
                                                            <input
                                                                type="text"
                                                                value={pendingSearch}
                                                                onChange={(e) => setPendingSearch(e.target.value)}
                                                                placeholder="Search by name, PIN, branch..."
                                                                className="w-full pl-9 pr-7 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary"
                                                            />
                                                            {pendingSearch && (
                                                                <button
                                                                    onClick={() => setPendingSearch('')}
                                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* College */}
                                                        <select
                                                            value={pendingCollege}
                                                            onChange={(e) => setPendingCollege(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Colleges</option>
                                                            {pendingColleges.map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>

                                                        {/* Course */}
                                                        <select
                                                            value={pendingCourse}
                                                            onChange={(e) => setPendingCourse(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Courses</option>
                                                            {pendingCourses.map(c => (
                                                                <option key={c} value={c}>{c}</option>
                                                            ))}
                                                        </select>

                                                        {/* Branch */}
                                                        <select
                                                            value={pendingBranch}
                                                            onChange={(e) => setPendingBranch(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Branches</option>
                                                            {pendingBranches.map(b => (
                                                                <option key={b} value={b}>{b}</option>
                                                            ))}
                                                        </select>

                                                        {/* Year */}
                                                        <select
                                                            value={pendingYear}
                                                            onChange={(e) => setPendingYear(e.target.value)}
                                                            className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary text-sub"
                                                        >
                                                            <option value="">All Years</option>
                                                            {(pendingYears.length > 0 ? pendingYears : [1, 2, 3, 4]).map(y => (
                                                                <option key={y} value={y}>Year {y}</option>
                                                            ))}
                                                        </select>

                                                        {hasActivePendingFilters && (
                                                            <button
                                                                onClick={() => {
                                                                    setPendingSearch('');
                                                                    setPendingCollege('');
                                                                    setPendingCourse('');
                                                                    setPendingBranch('');
                                                                    setPendingYear('');
                                                                }}
                                                                className="px-2.5 py-1.5 text-xs font-semibold text-danger hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors flex items-center gap-1"
                                                            >
                                                                <X size={12} /> Clear
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Pending Students Table */}
                                                    <div className="overflow-x-auto border border-border rounded-xl bg-surface shadow-xs">
                                                        <table className="w-full text-left text-xs">
                                                            <thead className="bg-[var(--background)]/90 border-b border-border text-sub uppercase font-semibold">
                                                                <tr>
                                                                    <th className="p-3">Student Details</th>
                                                                    <th className="p-3">Academic Info</th>
                                                                    <th className="p-3">Club Fee Dues</th>
                                                                    <th className="p-3">Membership Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-border">
                                                                {filteredPending.map((m, idx) => {
                                                                    const feeAmount = m.due_amount !== undefined && m.due_amount !== null
                                                                        ? Number(m.due_amount)
                                                                        : (Number(selectedClub?.membership_fee) || 0);

                                                                    return (
                                                                        <tr key={m.id || m.student_id || idx} className="hover:bg-[var(--background)]/80 transition-colors">
                                                                            {/* Student Details */}
                                                                            <td className="p-3">
                                                                                <div className="flex items-center gap-2.5">
                                                                                    <div className="w-8 h-8 rounded-full bg-[var(--warning-light)] text-warning font-bold flex items-center justify-center text-xs shrink-0">
                                                                                        {(m.student_name || m.name || 'S').charAt(0).toUpperCase()}
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="font-bold text-main leading-tight">
                                                                                            {m.student_name || m.name || 'Unknown Student'}
                                                                                        </p>
                                                                                        <p className="text-[11px] font-mono text-muted-text mt-0.5">
                                                                                            {m.admission_number || m.student_id || '—'}
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </td>

                                                                            {/* Academic Info */}
                                                                            <td className="p-3 text-sub">
                                                                                {m.course || m.branch ? (
                                                                                    <div>
                                                                                        <p className="font-medium">{[m.course, m.branch].filter(Boolean).join(' • ')}</p>
                                                                                        <p className="text-[11px] text-muted-text">
                                                                                            {m.college ? `${m.college} • ` : ''}{m.current_year ? `Year ${m.current_year}` : ''} {m.current_semester ? `(Sem ${m.current_semester})` : ''}
                                                                                        </p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-muted-text italic">Not available</span>
                                                                                )}
                                                                            </td>

                                                                            {/* Club Fee Dues */}
                                                                            <td className="p-3">
                                                                                <div className="space-y-0.5">
                                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[var(--danger-light)] text-danger rounded-full font-bold text-[10px]">
                                                                                        <AlertCircle size={10} /> Fee Pending: ₹{feeAmount.toLocaleString('en-IN')}
                                                                                    </span>
                                                                                    {Number(m.paid_amount) > 0 && (
                                                                                        <p className="text-[10px] text-muted-text">Paid: ₹{Number(m.paid_amount).toLocaleString('en-IN')}</p>
                                                                                    )}
                                                                                </div>
                                                                            </td>

                                                                            {/* Membership Status */}
                                                                            <td className="p-3">
                                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] rounded-full font-bold text-[10px]">
                                                                                    <Clock size={10} /> Activates on Payment
                                                                                </span>
                                                                                <p className="text-[10px] text-muted-text mt-1">
                                                                                    Joined: {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}
                                                                                </p>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}

                                                                {filteredPending.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={4} className="py-12 text-center">
                                                                            <div className="flex flex-col items-center justify-center text-muted-text space-y-2">
                                                                                <CheckCircle size={32} className="text-success opacity-60" />
                                                                                <p className="text-sm font-semibold text-sub">
                                                                                    {hasActivePendingFilters ? 'No pending students match the selected filters' : 'No students with fee pending'}
                                                                                </p>
                                                                                <p className="text-xs text-muted-text max-w-sm">
                                                                                    {hasActivePendingFilters
                                                                                        ? 'Try clearing or changing your filters to see more results.'
                                                                                        : 'All students have paid their club membership fees and are active members!'}
                                                                                </p>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* TAB 3: ACTIVITIES */}
                                        {detailsTab === 'activities' && (
                                            <div className="space-y-4 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="text-base font-bold text-main">Club Activities ({clubActivities.length})</h3>
                                                        <p className="text-xs text-muted-text">Events, workshops and programs organized by this club.</p>
                                                    </div>
                                                    {getClubPageAccess(selectedClub?.id, 'management').write && (
                                                        <button
                                                            onClick={handleOpenCreateActivity}
                                                            className="px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 shadow-sm transition-all"
                                                        >
                                                            <Plus size={14} /> Add Activity
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {clubActivities.map((act, i) => {
                                                        const imagesList = Array.isArray(act.images) && act.images.length > 0
                                                            ? act.images
                                                            : (act.image_url ? [act.image_url] : []);
                                                        const canManage = getClubPageAccess(selectedClub?.id, 'management').write;

                                                        return (
                                                            <div key={act.id || i} className="border border-border rounded-2xl bg-surface shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-all">
                                                                {/* Image or Group of Images Preview */}
                                                                {imagesList.length > 0 && (
                                                                    <div className="relative bg-background border-b border-border">
                                                                        {imagesList.length === 1 ? (
                                                                            <div
                                                                                onClick={() => setPreviewModalImage(imagesList[0])}
                                                                                className="h-48 w-full overflow-hidden cursor-pointer group"
                                                                            >
                                                                                <img
                                                                                    src={imagesList[0]}
                                                                                    alt={act.title}
                                                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <div className="p-2 bg-[var(--background)]/70">
                                                                                <div className="grid grid-cols-3 gap-1.5 h-44 rounded-xl overflow-hidden">
                                                                                    {imagesList.slice(0, 3).map((imgUrl, imgIdx) => (
                                                                                        <div
                                                                                            key={imgIdx}
                                                                                            onClick={() => setPreviewModalImage(imgUrl)}
                                                                                            className="relative h-full overflow-hidden cursor-pointer group bg-background"
                                                                                        >
                                                                                            <img
                                                                                                src={imgUrl}
                                                                                                alt=""
                                                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                                                            />
                                                                                            {imgIdx === 2 && imagesList.length > 3 && (
                                                                                                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-white font-black text-xs sm:text-sm">
                                                                                                    +{imagesList.length - 3} more
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="flex items-center justify-between px-1 pt-1.5 text-[11px] text-muted-text font-medium">
                                                                                    <span className="flex items-center gap-1">
                                                                                        <Image size={12} className="text-primary" />
                                                                                        {imagesList.length} photos attached
                                                                                    </span>
                                                                                    <span
                                                                                        className="text-primary text-[10px] hover:underline cursor-pointer"
                                                                                        onClick={() => setPreviewModalImage(imagesList[0])}
                                                                                    >
                                                                                        Click to preview
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                                                    <div className="space-y-1.5">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <h4 className="font-bold text-sm text-main leading-snug">{act.title}</h4>
                                                                            {canManage && (
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleOpenEditActivity(act)}
                                                                                        className="p-1.5 text-muted-text hover:text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors"
                                                                                        title="Edit Activity"
                                                                                    >
                                                                                        <Edit2 size={14} />
                                                                                    </button>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => handleDeleteActivity(act.id)}
                                                                                        className="p-1.5 text-muted-text hover:text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                                                        title="Delete Activity"
                                                                                    >
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {act.description && (
                                                                            <p className="text-xs text-sub leading-relaxed whitespace-pre-wrap line-clamp-3">
                                                                                {act.description}
                                                                            </p>
                                                                        )}
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-text pt-2.5 border-t border-border">
                                                                        <div className="flex items-center gap-3">
                                                                            {(act.date || act.posted_at) && (
                                                                                <span className="flex items-center gap-1 font-medium">
                                                                                    <Calendar size={13} className="text-primary" />
                                                                                    {act.date || new Date(act.posted_at).toLocaleDateString()}
                                                                                </span>
                                                                            )}
                                                                            {act.location && (
                                                                                <span className="flex items-center gap-1 font-medium text-sub">
                                                                                    ?? {act.location}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {act.posted_at && (
                                                                            <span className="text-[10px] text-muted-text">
                                                                                Posted {new Date(act.posted_at).toLocaleDateString()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                    {clubActivities.length === 0 && (
                                                        <div className="col-span-full py-10 text-center text-muted-text bg-background rounded-xl border border-dashed">
                                                            <p className="text-sm">No activities published for this club yet.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* TAB 5: CHAT */}
                                        {detailsTab === 'chat' && (
                                            <div className="rounded-2xl border border-border overflow-hidden shadow-sm mt-2">
                                                <ClubChatBox club={selectedClub} />
                                            </div>
                                        )}

                                        {/* TAB 6: SETTINGS */}
                                        {detailsTab === 'settings' && (
                                            <div className="space-y-6 pt-2">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <h3 className="text-base font-bold text-main">Club Configuration & Admin Roles</h3>
                                                        <p className="text-xs text-muted-text">Edit club details, upload logo, and assign dynamic leadership roles.</p>
                                                    </div>
                                                    {(isAdmin || canManageClubAdmins || getClubPageAccess(selectedClub?.id, 'settings').write) && (
                                                        <button
                                                            onClick={() => prepareEdit(selectedClub)}
                                                            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 shadow-sm"
                                                        >
                                                            <Edit2 size={14} /> Update Settings & Assign Roles
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Dedicated Club Logo & Image Update Section */}
                                                <div className="bg-surface p-5 rounded-2xl border border-border shadow-xs space-y-4">
                                                    <div className="flex items-center gap-2">
                                                        <Image size={18} className="text-primary" />
                                                        <h4 className="text-sm font-bold text-main">Club Logo / Profile Image</h4>
                                                    </div>
                                                    <p className="text-xs text-muted-text">Upload or change the official logo/image for this club. It will be displayed across student portals, club cards, and headers.</p>

                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-1">
                                                        {/* Current or Preview Image */}
                                                        <div className="relative group">
                                                            <div className="w-24 h-24 rounded-2xl border-2 border-border overflow-hidden bg-background flex items-center justify-center shadow-inner">
                                                                {clubLogoPreview ? (
                                                                    <img src={clubLogoPreview} alt="Preview" className="w-full h-full object-cover" />
                                                                ) : selectedClub?.image_url ? (
                                                                    <img src={selectedClub.image_url} alt={selectedClub.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center justify-center text-muted-text">
                                                                        <Users size={28} className="opacity-40 mb-1" />
                                                                        <span className="text-[10px] font-bold">No Logo</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {clubLogoPreview && (
                                                                <span className="absolute -top-2 -right-2 px-1.5 py-0.5 bg-warning text-white text-[9px] font-extrabold rounded-full shadow-xs">
                                                                    New
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="space-y-3 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 bg-background hover:bg-background text-sub rounded-xl text-xs font-bold transition-all border border-border-strong">
                                                                    <Upload size={14} />
                                                                    <span>{clubLogoFile ? 'Choose Different Image' : 'Select Club Logo'}</span>
                                                                    <input
                                                                        type="file"
                                                                        accept="image/*"
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                setClubLogoFile(file);
                                                                                setClubLogoPreview(URL.createObjectURL(file));
                                                                            }
                                                                        }}
                                                                    />
                                                                </label>

                                                                {clubLogoFile && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleUpdateClubLogo(clubLogoFile)}
                                                                            disabled={updatingLogo}
                                                                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
                                                                        >
                                                                            {updatingLogo ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                                                            <span>{updatingLogo ? 'Uploading...' : 'Save & Update Logo'}</span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setClubLogoFile(null);
                                                                                setClubLogoPreview(null);
                                                                            }}
                                                                            className="px-2.5 py-2 text-xs font-bold text-muted-text hover:text-danger rounded-xl hover:bg-[var(--danger-light)]"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-muted-text">Supported formats: JPG, PNG, WEBP, SVG. Recommended square resolution: 400x400px.</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-background p-5 rounded-2xl border border-border space-y-3 text-xs">
                                                    <p className="text-sub">Membership Fee: <b>{formatMembershipFee(selectedClub?.membership_fee)}</b> ({selectedClub?.fee_type || 'Yearly'})</p>
                                                    <p className="text-sub">Active Status: <b>{selectedClub?.is_active ? 'Active' : 'Inactive'}</b></p>
                                                    <p className="text-sub">Total Officers: <b>{selectedClub?.admin_roles?.length || 0}</b></p>
                                                </div>
                                            </div>
                                        )}
                                        </div>

                                    </>
                                );
                            })()}
                        </div>
                    )}
                </>
            )}

            {/* ================= 2. SUBPAGE: STUDENTS ================= */}
            {subPage === 'students' && (
                <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-main">Student Club Members</h2>
                            <p className="text-xs text-muted-text">View and manage all registered student club members across clubs.</p>
                        </div>
                        <button onClick={fetchStudents} className="px-3 py-2 bg-background text-sub hover:bg-background rounded-lg text-xs font-bold flex items-center gap-1.5">
                            <RefreshCw size={14} /> Refresh
                        </button>
                    </div>

                    {/* Filter controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-muted-text" size={16} />
                            <input
                                type="text"
                                placeholder="Search student name / admission no..."
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <select
                            value={studentClubFilter}
                            onChange={(e) => setStudentClubFilter(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All Student Clubs</option>
                            {clubs.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <select
                            value={studentStatusFilter}
                            onChange={(e) => setStudentStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">All Statuses</option>
                            <option value="approved">Approved</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    {/* Students Table */}
                    <div className="overflow-x-auto border rounded-xl">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-background border-b text-sub uppercase font-semibold">
                                <tr>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Admission No</th>
                                    <th className="p-3">Club</th>
                                    <th className="p-3">Membership Status</th>
                                    <th className="p-3">Payment Status</th>
                                    <th className="p-3">Joined Date</th>
                                    <th className="p-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredStudents.map((s) => (
                                    <tr key={s.membership_id} className="hover:bg-[var(--background)]/50">
                                        <td className="p-3 font-semibold text-main">{s.student_name}</td>
                                        <td className="p-3 text-sub">{s.admission_number}</td>
                                        <td className="p-3 font-medium text-primary">{s.club_name}</td>
                                        <td className="p-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                s.status === 'approved' ? 'bg-[var(--success-light)] text-success' : 'bg-[var(--warning-light)] text-warning'
                                            }`}>
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                s.payment_status === 'paid' ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'
                                            }`}>
                                                {s.payment_status || 'free'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-muted-text">{new Date(s.joined_at).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            {s.status === 'pending' && getClubPageAccess(s.club_id, 'students').write ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprovalAction(s.club_id, s.student_id, 'approved')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-[var(--success-light)] px-2 py-1 font-semibold text-success hover:bg-[var(--success-light)]"
                                                    ><Check size={12} /> Approve</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleApprovalAction(s.club_id, s.student_id, 'rejected')}
                                                        className="inline-flex items-center gap-1 rounded-md bg-[var(--danger-light)] px-2 py-1 font-semibold text-danger hover:bg-[var(--danger-light)]"
                                                    ><X size={12} /> Reject</button>
                                                </div>
                                            ) : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-muted-text">
                                            {studentsLoading ? 'Loading members...' : 'No club students found.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ================= 3. SUBPAGE: CLUB SETTINGS & DYNAMIC ROLES ================= */}
            {subPage === 'settings' && (
                <div className="space-y-6">
                    {/* Dynamic Roles Creation & Management Card */}
                    <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-main">Dynamic Club Admin Roles</h2>
                                <p className="text-xs text-muted-text">Define dynamic leadership and coordinator roles for student clubs with full edit and delete capabilities.</p>
                            </div>
                            {(isAdmin || canManageClubRoles) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingRole(null);
                                        setRoleForm({
                                            role_name: '',
                                            description: '',
                                            pages: [...DEFAULT_CLUB_ADMIN_PAGES],
                                            can_create_users: false
                                        });
                                        setShowRoleModal(true);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-hover"
                                >
                                    <Plus size={14} /> Add Role
                                </button>
                            )}
                        </div>

                        {/* Roles Grid with Edit and Delete Buttons for ALL roles */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {dynamicRoles.map(role => (
                                <div key={role.id} className="p-4 rounded-xl border border-border bg-[var(--background)]/50 space-y-2 relative group hover:bg-surface hover:shadow-md transition-all flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-sm text-main">{role.role_name}</h3>
                                            <span className="text-[10px] font-extrabold uppercase bg-[var(--primary-light)] text-primary px-2 py-0.5 rounded shrink-0">
                                                Dynamic Role
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-text mt-1 line-clamp-2">{role.description || 'No description provided.'}</p>
                                        {(role.can_create_users === true || Number(role.can_create_users) === 1) && (
                                            <span className="mt-2 inline-flex rounded-full bg-[var(--success-light)] px-2 py-0.5 text-[10px] font-semibold text-success">
                                                Can create users
                                            </span>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                                        <span className="text-[10px] font-mono text-muted-text">
                                            {role.role_code}
                                        </span>
                                        {(isAdmin || canManageClubRoles) && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenEditRole(role)}
                                                    className="p-1.5 text-primary hover:bg-[var(--primary-light)] rounded-lg transition-colors"
                                                    title="Edit Role"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteDynamicRole(role.id)}
                                                    className="p-1.5 text-danger hover:bg-[var(--danger-light)] rounded-lg transition-colors"
                                                    title="Delete Role"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Announcements & Notifications Configuration */}
                    {getClubPageAccess(null, 'settings').write && (
                    <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm space-y-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-main flex items-center gap-2">
                                    <Bell size={20} className="text-primary" /> Club Announcements & Push Notifications
                                </h2>
                                <p className="text-xs text-muted-text">Configure global automated notification preferences for student club events and announcements.</p>
                            </div>
                        </div>

                        <div className="space-y-4 divide-y divide-border">
                            <div className="flex justify-between items-center pt-2">
                                <div>
                                    <p className="text-sm font-bold text-main">Club Announcements Notifications</p>
                                    <p className="text-xs text-muted-text">Automatically notify registered members when new club announcements are posted.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = !announcementNotify;
                                        setAnnouncementNotify(newVal);
                                        localStorage.setItem('club_announcement_notify', String(newVal));
                                        toast.success(`Announcement notifications ${newVal ? 'ENABLED' : 'DISABLED'}`);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        announcementNotify ? 'bg-success text-white' : 'bg-background text-sub'
                                    }`}
                                >
                                    {announcementNotify ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <div>
                                    <p className="text-sm font-bold text-main">Fee Payment Alert Notifications</p>
                                    <p className="text-xs text-muted-text">Send push reminders to students when club membership fee payments are due.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = !feeNotify;
                                        setFeeNotify(newVal);
                                        localStorage.setItem('club_fee_notify', String(newVal));
                                        toast.success(`Fee notifications ${newVal ? 'ENABLED' : 'DISABLED'}`);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        feeNotify ? 'bg-success text-white' : 'bg-background text-sub'
                                    }`}
                                >
                                    {feeNotify ? 'ON' : 'OFF'}
                                </button>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <div>
                                    <p className="text-sm font-bold text-main">Member Activity Push Notifications</p>
                                    <p className="text-xs text-muted-text">Notify club members when new events, activities, or schedule changes are published.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newVal = !activityNotify;
                                        setActivityNotify(newVal);
                                        localStorage.setItem('club_activity_notify', String(newVal));
                                        toast.success(`Activity notifications ${newVal ? 'ENABLED' : 'DISABLED'}`);
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                        activityNotify ? 'bg-success text-white' : 'bg-background text-sub'
                                    }`}
                                >
                                    {activityNotify ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* User Access Management for Club Pages Only */}
                    {(isAdmin || canManageClubAdmins || canManageClubRoles) && (
                    <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm space-y-5">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-main flex items-center gap-2">
                                    <Shield size={20} className="text-primary" /> User Access Management (Club Pages Only)
                                </h2>
                                <p className="text-xs text-muted-text">
                                    Grant or manage user access permissions and dynamic leadership roles specifically for Club Management and Club Pages.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/users')}
                                className="px-4 py-2 bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary text-xs font-bold rounded-xl hover:bg-[var(--primary-light)] transition-all flex items-center gap-1.5 shrink-0"
                            >
                                <UserCheck size={14} /> Full User Management
                            </button>
                        </div>

                        {/* Quick Employee / User Access Search & Grant */}
                        <div className="bg-background p-4 rounded-xl border border-border space-y-3">
                            <h3 className="text-xs font-bold text-main uppercase tracking-wider flex items-center gap-1.5">
                                <UserPlus size={14} className="text-primary" /> Grant Club Admin Access to Employee / User
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={hrmsSearchQuery}
                                            onChange={(e) => handleSearchHrms(e.target.value)}
                                            placeholder="Search HRMS employee by name, emp ID or email..."
                                            className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary bg-surface"
                                        />
                                        {searchingHrms && (
                                            <div className="absolute right-3 top-2.5">
                                                <RefreshCw size={14} className="animate-spin text-primary" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleSearchHrms(hrmsSearchQuery)}
                                    disabled={searchingHrms}
                                    className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Search size={14} /> Search Employee
                                </button>
                            </div>

                            {/* HRMS Search Results in Access Management */}
                            {hrmsSearchResults.length > 0 && (
                                <div className="mt-2 bg-surface rounded-lg border border-border divide-y max-h-48 overflow-y-auto shadow-sm">
                                    {hrmsSearchResults.map(emp => (
                                        <div
                                            key={emp._id}
                                            onClick={() => handleSelectHrmsEmployee(emp)}
                                            className={`p-2.5 text-xs flex justify-between items-center cursor-pointer hover:bg-[var(--primary-light)] transition-colors ${selectedHrmsEmployee?._id === emp._id ? 'bg-[var(--primary-light)] border-l-4 border-primary' : ''}`}
                                        >
                                            <div>
                                                <p className="font-bold text-main">{emp.name}</p>
                                                <p className="text-[10px] text-muted-text">{emp.emp_no} • {emp.email || 'No email'}</p>
                                            </div>
                                            <span className="text-[10px] font-bold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded">
                                                Select for Club Access
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {selectedHrmsEmployee && (
                                <div className="mt-3 p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="text-xs">
                                        <p className="font-bold text-primary">Selected: {selectedHrmsEmployee.name} ({selectedHrmsEmployee.emp_no})</p>
                                        <p className="text-[11px] text-primary">
                                            {hrmsUserStatus?.checking ? 'Checking SDMS Account...' : hrmsUserStatus?.hasUserAccount ? '✓ Active SDMS Account Linked' : '⚠ No SDMS Account found.'}
                                        </p>
                                    </div>
                                    {!hrmsUserStatus?.checking && !hrmsUserStatus?.hasUserAccount && canCreateUserAccounts && (
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateUserModal}
                                            className="px-3 py-1.5 bg-success text-white font-bold text-xs rounded-lg hover:bg-success transition-colors shadow-sm"
                                        >
                                            + Create SDMS Account (With College)
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Table of Active Club Officers / Admins */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-main uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={14} className="text-primary" /> Active Club Heads & Officers ({
                                    clubs.reduce((acc, c) => acc + (c.admin_roles ? c.admin_roles.length : 0), 0)
                                })
                            </h3>

                            <div className="overflow-x-auto border border-border rounded-xl shadow-sm bg-surface">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-background text-sub font-bold border-b border-border">
                                        <tr>
                                            <th className="p-3">Club Name</th>
                                            <th className="p-3">Officer Name</th>
                                            <th className="p-3">Club Role</th>
                                            <th className="p-3">Emp ID / Username</th>
                                            <th className="p-3">Page Access</th>
                                            <th className="p-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {clubs.flatMap(c => (c.admin_roles || []).map((r, i) => ({ club: c, role: r, key: `${c.id}_${i}` }))).length > 0 ? (
                                            clubs.flatMap(c => (c.admin_roles || []).map((r, i) => (
                                                <tr key={`${c.id}_${i}`} className="hover:bg-background transition-colors">
                                                    <td className="p-3 font-bold text-main">{c.name}</td>
                                                    <td className="p-3 text-main font-medium">{r.name || r.email || 'Assigned Officer'}</td>
                                                    <td className="p-3">
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary-light)] text-secondary border border-[var(--primary-light)]">
                                                            🏆 {r.roleName || r.roleCode || 'Club Admin'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-muted-text font-mono">{r.empNo || r.userId || '—'}</td>
                                                    <td className="p-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {CLUB_ADMIN_PAGES.flatMap(page => {
                                                                const access = getPagePermissions(r)[page.key];
                                                                if (!access.read && !access.write) return [];
                                                                return [(
                                                                    <span key={page.key} title={`${page.label}: ${access.write ? 'Read and write' : 'Read only'}`} className="px-2 py-0.5 rounded bg-[var(--success-light)] text-success border border-[var(--success-light)] text-[10px] font-bold">
                                                                        {page.label}: {access.write ? 'Read/Write' : 'Read'}
                                                                    </span>
                                                                )];
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => openClubUserEditor(c, r, i)}
                                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[var(--primary-light)] bg-[var(--primary-light)] text-primary hover:bg-[var(--primary-light)] font-semibold"
                                                                title={`Edit club role for ${r.name || r.email || ''}`}
                                                            >
                                                                <Edit2 size={12} /> Edit Club Role
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )))
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="p-6 text-center text-muted-text italic">
                                                    No club admin officers assigned yet. Edit any club to assign dynamic club roles.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            )}

            {/* ================= MODAL: CREATE / EDIT CLUB WITH MULTIPLE DYNAMIC ADMIN ROLES & HRMS USER CHECK ================= */}
            <Modal
                show={showCreateModal || showEditModal}
                onClose={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}
                title={showEditModal ? 'Edit Student Club & Admin Roles' : 'Create New Student Club'}
            >
                <form onSubmit={showEditModal ? handleUpdateClub : handleCreateClub} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold text-sub">Club Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Robotics & Innovation Club"
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold text-sub">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the objectives and activities of this student club..."
                                rows={3}
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                            <label className="text-xs font-bold text-sub flex items-center gap-1.5">
                                <Image size={14} className="text-primary" /> Club Logo / Image
                            </label>
                            <div className="flex items-center gap-4 p-3 bg-background border rounded-xl">
                                <div className="w-14 h-14 rounded-xl border bg-surface overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                    {formLogoPreview ? (
                                        <img src={formLogoPreview} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <Users size={22} className="text-muted-text" />
                                    )}
                                </div>
                                <div className="space-y-1 flex-1">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                setFormData({ ...formData, image: file });
                                                setFormLogoPreview(URL.createObjectURL(file));
                                            }
                                        }}
                                        className="text-xs text-sub file:mr-2.5 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--primary-light)] file:text-primary hover:file:bg-[var(--primary-light)] cursor-pointer"
                                    />
                                    <p className="text-[10px] text-muted-text">Upload or replace the official club emblem/logo (PNG, JPG, WEBP, SVG)</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-sub">Membership Fee (INR)</label>
                            <input
                                type="number"
                                value={formData.membership_fee}
                                onChange={(e) => setFormData({ ...formData, membership_fee: e.target.value })}
                                placeholder="0 for free club"
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-sub">Fee Frequency</label>
                            <select
                                value={formData.fee_type}
                                onChange={(e) => setFormData({ ...formData, fee_type: e.target.value })}
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            >
                                <option value="Yearly">Yearly</option>
                                <option value="One-Time">One-Time</option>
                                <option value="Semester">Semester-wise</option>
                            </select>
                        </div>
                    </div>

                    {(isAdmin || canManageClubAdmins) && (
                    <>
                    {/* Section: Assign Multiple Dynamic Club Admin Roles */}
                    <div className="border-t pt-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-sm font-bold text-main flex items-center gap-1.5">
                                    <Shield size={16} className="text-primary" /> Multiple Club Admin Roles
                                </h3>
                                <p className="text-[11px] text-muted-text">
                                    Assign multiple officers (President, Vice Presidents, Faculty Coordinators, etc.) to this club.
                                    {showCreateModal && ' The club creator will automatically be assigned as Club Coordinator.'}
                                </p>
                            </div>
                        </div>

                        {/* Existing Assigned Multiple Roles List */}
                        {formData.admin_roles && formData.admin_roles.length > 0 ? (
                            <div className="space-y-2 bg-[var(--primary-light)] p-3 rounded-xl border border-[var(--primary-light)]">
                                <p className="text-xs font-bold text-primary">Currently Assigned Admin Roles ({formData.admin_roles.length}):</p>
                                {formData.admin_roles.map((item, idx) => (
                                    <div key={idx} className="bg-surface p-2.5 rounded-lg border border-[var(--primary-light)] text-xs shadow-2xs space-y-2">
                                        <div className="flex justify-between items-center gap-3">
                                            <div>
                                                <select
                                                    value={item.roleCode || ''}
                                                    onChange={event => handleChangeAssignedClubRole(idx, event.target.value)}
                                                    className="mb-1 max-w-full rounded border border-[var(--primary-light)] bg-[var(--primary-light)] px-2 py-1 text-[11px] font-bold text-primary"
                                                    aria-label={`Club role for ${item.name}`}
                                                >
                                                    {!dynamicRoles.some(role => role.role_code === item.roleCode) && item.roleCode && (
                                                        <option value={item.roleCode}>{item.roleName}</option>
                                                    )}
                                                    {dynamicRoles.map(role => (
                                                        <option key={role.role_code} value={role.role_code}>{role.role_name}</option>
                                                    ))}
                                                </select>
                                                <span className="font-bold text-main">{item.name}</span>
                                                <span className="text-muted-text text-[11px] ml-2">({item.empNo || item.email})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAdminRoleAssignment(idx)}
                                                className="text-danger hover:text-danger p-1 rounded hover:bg-[var(--danger-light)]"
                                                title="Remove this role assignment"
                                            >
                                                <X size={15} />
                                            </button>
                                        </div>
                                        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border pt-2">
                                            <legend className="sr-only">Read and write access for {item.name}</legend>
                                            {CLUB_ADMIN_PAGES.map(page => {
                                                const access = getPagePermissions(item)[page.key];
                                                return (
                                                    <div key={page.key} className="rounded-md border border-border px-2 py-1.5">
                                                        <p className="text-[10px] font-semibold text-sub">{page.label}</p>
                                                        <div className="flex gap-3 mt-1">
                                                            {['read', 'write'].map(accessType => (
                                                                <label key={accessType} className="inline-flex items-center gap-1 text-[10px] text-sub capitalize">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.isSuperAdmin || access[accessType]}
                                                                        onChange={() => handleToggleAdminRolePage(idx, page.key, accessType)}
                                                                        disabled={item.isSuperAdmin}
                                                                        className="rounded border-border-strong text-primary focus:ring-primary"
                                                                    />
                                                                    {accessType}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </fieldset>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-text italic bg-background p-2.5 rounded-lg border border-dashed">
                                No admin roles assigned to this club yet. Use the form below to search and add officers.
                            </p>
                        )}

                        {/* Add Officer Assign Form */}
                        <div className="p-3.5 bg-background border border-border rounded-xl space-y-3">
                            <p className="text-xs font-bold text-main">Add New Admin Role Assignment</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-sub">Select Dynamic Role</label>
                                    <select
                                        value={selectedRoleCode}
                                        onChange={(e) => setSelectedRoleCode(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-surface"
                                    >
                                        {dynamicRoles.map(r => (
                                            <option key={r.role_code} value={r.role_code}>{r.role_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-sub">
                                            {roleAssigneeType === 'student' ? 'Search Student (Members / Leaders)' : 'Search Faculty / HRMS Staff'}
                                        </label>
                                        <div className="inline-flex rounded-md bg-background p-0.5 text-[10px] font-bold">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRoleAssigneeType('student');
                                                    setSelectedHrmsEmployee(null);
                                                    setHrmsSearchQuery('');
                                                    setHrmsSearchResults([]);
                                                }}
                                                className={`px-2 py-0.5 rounded transition-all ${roleAssigneeType === 'student' ? 'bg-surface text-primary shadow-xs' : 'text-sub hover:text-main'}`}
                                            >
                                                Student
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setRoleAssigneeType('hrms');
                                                    setSelectedStudentRole(null);
                                                    setStudentRoleSearchQuery('');
                                                    setStudentRoleSearchResults([]);
                                                }}
                                                className={`px-2 py-0.5 rounded transition-all ${roleAssigneeType === 'hrms' ? 'bg-surface text-primary shadow-xs' : 'text-sub hover:text-main'}`}
                                            >
                                                Faculty / Staff
                                            </button>
                                        </div>
                                    </div>

                                    {roleAssigneeType === 'student' ? (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Type student name, admission no, PIN, branch..."
                                                value={studentRoleSearchQuery}
                                                onChange={(e) => handleSearchRoleStudent(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-surface"
                                            />
                                            {searchingRoleStudent && <span className="text-[10px] text-primary animate-pulse">Searching students...</span>}
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Type name, emp_no, email..."
                                                value={hrmsSearchQuery}
                                                onChange={(e) => handleSearchHrms(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border rounded-lg bg-surface"
                                            />
                                            {searchingHrms && <span className="text-[10px] text-muted-text">Searching employees...</span>}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Student Search Results Dropdown */}
                            {roleAssigneeType === 'student' && studentRoleSearchResults.length > 0 && (
                                <div className="max-h-48 overflow-y-auto bg-surface border border-border-strong rounded-lg divide-y shadow-lg">
                                    {studentRoleSearchResults.map((st, i) => (
                                        <div
                                            key={st.id || i}
                                            onClick={() => {
                                                setSelectedStudentRole(st);
                                                setStudentRoleSearchResults([]);
                                            }}
                                            className="p-2.5 hover:bg-[var(--primary-light)] cursor-pointer text-xs flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-bold text-main">{st.student_name}</p>
                                                <p className="text-[10px] text-muted-text font-mono">
                                                    Adm: {st.admission_number} {st.pin_no ? `| PIN: ${st.pin_no}` : ''}
                                                </p>
                                                <p className="text-[10px] text-muted-text">
                                                    {[st.course, st.branch, st.college].filter(Boolean).join(' • ')}
                                                </p>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[var(--primary-light)] text-primary">
                                                Student
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selected Student Card */}
                            {roleAssigneeType === 'student' && selectedStudentRole && (
                                <div className="bg-surface p-3 border border-[var(--primary-light)] rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs font-bold text-main flex items-center gap-1.5">
                                                <GraduationCap size={15} className="text-primary" />
                                                Selected: {selectedStudentRole.student_name}
                                            </p>
                                            <p className="text-[11px] text-sub font-mono mt-0.5">
                                                Adm: {selectedStudentRole.admission_number} {selectedStudentRole.pin_no ? `| PIN: ${selectedStudentRole.pin_no}` : ''}
                                            </p>
                                            <p className="text-[10px] text-muted-text">
                                                {[selectedStudentRole.course, selectedStudentRole.branch, selectedStudentRole.college].filter(Boolean).join(' • ')}
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => setSelectedStudentRole(null)} className="text-xs text-danger font-bold hover:text-danger">Change</button>
                                    </div>
                                    <div className="flex justify-end pt-1 border-t border-border">
                                        <button
                                            type="button"
                                            onClick={handleAddStudentRoleAssignment}
                                            className="px-3.5 py-1.5 bg-primary text-white rounded-lg font-bold hover:bg-primary-hover text-xs shadow-xs flex items-center gap-1"
                                        >
                                            <Plus size={13} /> Add to Role
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* HRMS Search Results Dropdown */}
                            {roleAssigneeType === 'hrms' && hrmsSearchResults.length > 0 && (
                                <div className="max-h-40 overflow-y-auto bg-surface border border-border-strong rounded-lg divide-y shadow-lg">
                                    {hrmsSearchResults.map((emp, i) => (
                                        <div
                                            key={i}
                                            onClick={() => handleSelectHrmsEmployee(emp)}
                                            className="p-2.5 hover:bg-[var(--primary-light)] cursor-pointer text-xs flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-bold text-main">{emp.name}</p>
                                                <p className="text-[10px] text-muted-text">ID: {emp.emp_no} | {emp.email}</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                                emp.type === 'SDMS User' || emp.hasUserAccount ? 'bg-[var(--success-light)] text-success' : 'bg-background text-sub'
                                            }`}>
                                                {emp.type || 'Employee'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Selected Employee Card & Account Check */}
                            {roleAssigneeType === 'hrms' && selectedHrmsEmployee && (
                                <div className="bg-surface p-3 border rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-xs font-bold text-main">Selected: {selectedHrmsEmployee.name}</p>
                                            <p className="text-[11px] text-muted-text">{selectedHrmsEmployee.emp_no} | {selectedHrmsEmployee.email}</p>
                                        </div>
                                        <button type="button" onClick={() => setSelectedHrmsEmployee(null)} className="text-xs text-danger font-bold">Change</button>
                                    </div>

                                    {hrmsUserStatus?.checking && (
                                        <p className="text-xs text-primary animate-pulse">Checking SDMS User Account...</p>
                                    )}

                                    {/* ALERT IF NO SDMS USER ACCOUNT */}
                                    {hrmsUserStatus && !hrmsUserStatus.checking && !hrmsUserStatus.hasUserAccount && canCreateUserAccounts && (
                                        <div className="p-3 bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-lg space-y-2">
                                            <div className="flex items-start gap-2 text-warning text-xs">
                                                <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="font-bold">No SDMS User Account Found!</p>
                                                    <p className="text-[11px] text-warning mt-0.5">
                                                        Employee <b>{selectedHrmsEmployee.name}</b> doesn't have a user login account in SDMS. Please create an account for this employee first, then add them to the role.
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleOpenCreateUserModal}
                                                className="w-full py-1.5 bg-warning text-white font-bold text-xs rounded-md hover:bg-warning flex items-center justify-center gap-1.5 shadow-xs"
                                            >
                                                <UserPlus size={14} /> Create SDMS Account for {selectedHrmsEmployee.name}
                                            </button>
                                        </div>
                                    )}

                                    {/* SUCCESS IF SDMS USER ACCOUNT EXISTS */}
                                    {hrmsUserStatus && !hrmsUserStatus.checking && hrmsUserStatus.hasUserAccount && (
                                        <div className="flex items-center justify-between p-2 bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg text-xs text-success">
                                            <div className="flex items-center gap-1.5">
                                                <CheckCircle size={15} className="text-success" />
                                                <span className="font-bold">SDMS Account Active ({hrmsUserStatus.userAccount?.username || 'User'})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleAddAdminRoleAssignment}
                                                className="px-3 py-1 bg-success text-white rounded font-bold hover:bg-success text-xs"
                                            >
                                                Add to Role
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    </>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}
                            className="px-4 py-2 text-xs font-bold text-sub border rounded-lg hover:bg-background"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary-hover shadow-sm"
                        >
                            {showEditModal ? ((isAdmin || canManageClubAdmins) ? 'Update Club & Save Admin Roles' : 'Save Club Settings') : 'Create Club'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                show={!!pageAssignmentToEdit}
                onClose={() => setPageAssignmentToEdit(null)}
                title={`Edit Club Access for ${pageAssignmentToEdit?.assignment?.name || 'Club Admin'}`}
            >
                <div className="space-y-4">
                    <p className="text-xs text-sub">
                        Edit {pageAssignmentToEdit?.assignment?.name || 'this user'}'s role and page access for {pageAssignmentToEdit?.club?.name}.
                    </p>
                    <label className="block space-y-1.5">
                        <span className="text-xs font-semibold text-sub">Club role</span>
                        <select
                            value={clubRoleDraft.roleCode}
                            onChange={(event) => {
                                const selectedRole = dynamicRoles.find(role => role.role_code === event.target.value);
                                setClubRoleDraft({
                                    roleCode: selectedRole?.role_code || '',
                                    roleName: selectedRole?.role_name || ''
                                });
                                if (!pageAssignmentToEdit?.assignment?.isSuperAdmin && selectedRole) {
                                    setPageAccessDraft(getPagePermissions({ pages: selectedRole.pages || DEFAULT_CLUB_ADMIN_PAGES }));
                                }
                            }}
                            className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                        >
                            {!dynamicRoles.some(role => role.role_code === clubRoleDraft.roleCode) && clubRoleDraft.roleCode && (
                                <option value={clubRoleDraft.roleCode}>{clubRoleDraft.roleName}</option>
                            )}
                            {dynamicRoles.map(role => (
                                <option key={role.role_code} value={role.role_code}>{role.role_name}</option>
                            ))}
                        </select>
                    </label>
                    {pageAssignmentToEdit?.assignment?.isSuperAdmin && (
                        <p className="rounded-md border border-[var(--primary-light)] bg-[var(--primary-light)] px-3 py-2 text-xs text-primary">
                            Superadmin accounts always have access to every club page.
                        </p>
                    )}
                    <div className="space-y-2">
                        {CLUB_ADMIN_PAGES.map(page => (
                            <div key={page.key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                                <span className="text-sm font-medium text-main">{page.label}</span>
                                <div className="flex gap-4">
                                    {['read', 'write'].map(accessType => (
                                        <label key={accessType} className="inline-flex items-center gap-1.5 text-xs text-sub capitalize">
                                            <input
                                                type="checkbox"
                                                checked={pageAssignmentToEdit?.assignment?.isSuperAdmin || pageAccessDraft[page.key]?.[accessType] === true}
                                                onChange={() => setPageAccessDraft(current => {
                                                    const pagePermissions = { ...current };
                                                    const next = { ...pagePermissions[page.key], [accessType]: !pagePermissions[page.key]?.[accessType] };
                                                    if (accessType === 'write' && next.write) next.read = true;
                                                    if (accessType === 'read' && !next.read) next.write = false;
                                                    pagePermissions[page.key] = next;
                                                    return pagePermissions;
                                                })}
                                                disabled={pageAssignmentToEdit?.assignment?.isSuperAdmin}
                                                className="rounded border-border-strong text-primary focus:ring-primary"
                                            />
                                            {accessType}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <button
                            type="button"
                            onClick={() => setPageAssignmentToEdit(null)}
                            className="px-4 py-2 text-xs font-bold text-sub border rounded-lg"
                        >Cancel</button>
                        <button
                            type="button"
                            onClick={handleSavePageAccess}
                            disabled={savingPageAccess}
                            className="px-4 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-50"
                        >{savingPageAccess ? 'Saving...' : 'Save Club Role'}</button>
                    </div>
                </div>
            </Modal>

            {/* ================= MODAL: CREATE / EDIT DYNAMIC ROLE ================= */}
            <Modal
                show={showRoleModal}
                onClose={() => { setShowRoleModal(false); setEditingRole(null); }}
                title={editingRole ? 'Edit Dynamic Club Role' : 'Add New Dynamic Club Role'}
            >
                <form onSubmit={handleSaveDynamicRole} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-sub">Role Name *</label>
                        <input
                            type="text"
                            value={roleForm.role_name}
                            onChange={(e) => setRoleForm({ ...roleForm, role_name: e.target.value })}
                            placeholder="e.g. Media Head, Event Director, Treasurer"
                            className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-sub">Description</label>
                        <textarea
                            value={roleForm.description}
                            onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                            placeholder="Role responsibilities and guidelines..."
                            rows={3}
                            className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <fieldset className="space-y-2 border-t border-border pt-4">
                        <legend className="text-xs font-bold text-sub">Club Page Access</legend>
                        <p className="text-[11px] text-muted-text">Users assigned this role will see the selected pages.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {CLUB_ADMIN_PAGES.map(page => (
                                <label key={page.key} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-sub">
                                    <input
                                        type="checkbox"
                                        checked={(roleForm.pages || DEFAULT_CLUB_ADMIN_PAGES).includes(page.key)}
                                        onChange={() => handleToggleRolePage(page.key)}
                                        className="rounded border-border-strong text-primary focus:ring-primary"
                                    />
                                    {page.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-3 text-xs text-sub">
                        <input
                            type="checkbox"
                            checked={Boolean(roleForm.can_create_users)}
                            onChange={(e) => setRoleForm(prev => ({
                                ...prev,
                                can_create_users: e.target.checked
                            }))}
                            className="mt-0.5 rounded border-border-strong text-primary focus:ring-primary"
                        />
                        <span>
                            <span className="block font-semibold text-main">Allow assigned club admins to create Faculty user accounts</span>
                            <span className="mt-0.5 block text-[11px] text-muted-text">This grants access to the SDMS account creation popup for HRMS employees.</span>
                        </span>
                    </label>
                    <div className="flex justify-end gap-2 pt-3">
                        <button type="button" onClick={() => { setShowRoleModal(false); setEditingRole(null); }} className="px-4 py-2 text-xs font-bold text-sub border rounded-lg">Cancel</button>
                        <button type="submit" className="px-5 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary-hover">
                            {editingRole ? 'Update Role' : 'Create Role'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* ================= MODAL: INLINE SDMS USER ACCOUNT CREATION FOR HRMS EMPLOYEE ================= */}
            <Modal
                show={showCreateUserModal}
                onClose={() => setShowCreateUserModal(false)}
                title={`Create SDMS Account for ${createUserForm.name}`}
                size="tall"
            >
                <form onSubmit={handleCreateSDMSUserAccount} className="space-y-4">
                    <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg text-xs text-primary space-y-1">
                        <p className="font-bold">Linking HRMS Employee to SDMS</p>
                        <p className="text-[11px] mt-0.5">The employee's HRMS credentials (Employee ID as username) will be used automatically â€” no manual password required.</p>
                        <div className="mt-2 flex items-center gap-2 bg-[var(--surface)]/60 p-2 rounded-lg border border-[var(--primary-light)]">
                            <CheckCircle size={14} className="text-success shrink-0" />
                            <span className="font-semibold text-primary">Username: <code className="bg-[var(--primary-light)] px-1.5 py-0.5 rounded text-primary">{selectedHrmsEmployee?.emp_no}</code> (from HRMS)</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                            <label className="font-bold text-sub">Full Name *</label>
                            <input
                                type="text"
                                value={createUserForm.name}
                                onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg mt-1"
                                required
                            />
                        </div>
                        <div>
                            <label className="font-bold text-sub">Email Address *</label>
                            <input
                                type="email"
                                value={createUserForm.email}
                                onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                                className="w-full px-3 py-2 border rounded-lg mt-1"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-3">
                        <MultiSelectDropdown
                            label="Colleges *"
                            options={collegesList.map(college => ({
                                value: String(college.id),
                                label: `${college.name} (${college.code || college.short_name || 'COLLEGE'})`
                            }))}
                            value={createUserForm.collegeIds}
                            onChange={handleCreateUserCollegeChange}
                            placeholder="Select one or more colleges"
                        />
                        <div>
                            <label className="font-bold text-sub">System Role *</label>
                            <select
                                value={createUserForm.role}
                                disabled={!hasUserManagementControl}
                                onChange={(e) => setCreateUserForm(prev => ({
                                    ...prev,
                                    role: e.target.value,
                                    allCourses: e.target.value === 'branch_hod' ? false : prev.allCourses,
                                    allBranches: e.target.value === 'branch_hod' ? false : prev.allBranches
                                }))}
                                className="mt-1 min-h-10 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            >
                                {effectiveCreateUserRoleOptions.map(role => (
                                    <option key={role.value || role.role_key} value={role.value || role.role_key}>
                                        {role.label || role.role_key || role.value}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <MultiSelectDropdown
                                label={createUserForm.role === 'branch_hod' ? 'Courses *' : 'Courses'}
                                options={createUserCourses.map(course => ({
                                    value: String(course.id),
                                    label: `${course.name}${course.level ? ` (${course.level.toUpperCase()})` : ''}`
                                }))}
                                value={createUserForm.courseIds}
                                onChange={handleCreateUserCourseChange}
                                placeholder={createUserForm.collegeIds.length ? 'Select courses' : 'Select colleges first'}
                                disabled={loadingCreateUserCourses || createUserForm.collegeIds.length === 0 || createUserForm.allCourses}
                                headerAccessory={createUserForm.role !== 'branch_hod' && (
                                    <label className="inline-flex items-center gap-1.5 text-[10px] font-medium text-sub">
                                        <input
                                            type="checkbox"
                                            checked={createUserForm.allCourses}
                                            onChange={(e) => setCreateUserForm(prev => ({
                                                ...prev,
                                                allCourses: e.target.checked,
                                                courseIds: e.target.checked ? [] : prev.courseIds,
                                                allBranches: e.target.checked,
                                                branchIds: e.target.checked ? [] : prev.branchIds
                                            }))}
                                        />
                                        All
                                    </label>
                                )}
                            />
                            {createUserForm.allCourses && <p className="mt-1 text-[10px] text-success">All courses selected</p>}
                            {loadingCreateUserCourses && <p className="mt-1 text-[10px] text-muted-text">Loading courses...</p>}
                        </div>
                    </div>

                    {(createUserForm.courseIds.length > 0 || createUserForm.role === 'branch_hod') && (
                    <div className="grid grid-cols-1 gap-3 text-xs lg:grid-cols-3">
                        {createUserForm.courseIds.length > 0 && !createUserForm.allCourses && (
                            <div>
                                <MultiSelectDropdown
                                    label={createUserForm.role === 'branch_hod' ? 'Branches *' : 'Branches'}
                                    options={createUserBranches.map(branch => ({
                                        value: String(branch.id),
                                        label: `${branch.name} (${branch.courseName || 'Course'})`
                                    }))}
                                    value={createUserForm.branchIds}
                                    onChange={branchIds => setCreateUserForm(prev => ({ ...prev, branchIds }))}
                                    placeholder="Select branches"
                                    disabled={loadingCreateUserBranches || createUserBranches.length === 0 || createUserForm.allBranches}
                                    headerAccessory={createUserForm.role !== 'branch_hod' && (
                                        <label className="inline-flex items-center gap-1.5 text-[10px] font-medium text-sub">
                                            <input
                                                type="checkbox"
                                                checked={createUserForm.allBranches}
                                                onChange={(e) => setCreateUserForm(prev => ({
                                                    ...prev,
                                                    allBranches: e.target.checked,
                                                    branchIds: e.target.checked ? [] : prev.branchIds
                                                }))}
                                            />
                                            All
                                        </label>
                                    )}
                                />
                                {createUserForm.allBranches && createUserForm.role !== 'branch_hod' && <p className="mt-1 text-[10px] text-warning">All branches selected</p>}
                                {loadingCreateUserBranches && <p className="mt-1 text-[10px] text-muted-text">Loading branches...</p>}
                            </div>
                        )}
                        {createUserForm.role === 'branch_hod' && createUserForm.courseIds.length > 0 && (
                            <div className="rounded-lg border border-border p-3 lg:col-span-2">
                                <div className="flex items-center justify-between gap-3">
                                    <label className="font-bold text-sub">Year Access *</label>
                                    <label className="inline-flex items-center gap-1.5 text-[11px] text-sub">
                                        <input
                                            type="checkbox"
                                            checked={createUserForm.allHodYears}
                                            onChange={(e) => setCreateUserForm(prev => ({
                                                ...prev,
                                                allHodYears: e.target.checked,
                                                hodYears: e.target.checked ? [] : prev.hodYears
                                            }))}
                                        />
                                        All years
                                    </label>
                                </div>
                                {!createUserForm.allHodYears && (
                                    <div className="mt-2 flex flex-wrap gap-3">
                                        {Array.from({ length: createUserHodYearCount }, (_, index) => index + 1).map(year => (
                                            <label key={year} className="inline-flex items-center gap-1.5 text-xs text-sub">
                                                <input
                                                    type="checkbox"
                                                    checked={createUserForm.hodYears.includes(year)}
                                                    onChange={() => setCreateUserForm(prev => ({
                                                        ...prev,
                                                        hodYears: prev.hodYears.includes(year)
                                                            ? prev.hodYears.filter(value => value !== year)
                                                            : [...prev.hodYears, year]
                                                    }))}
                                                />
                                                Year {year}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <button type="button" onClick={() => setShowCreateUserModal(false)} className="px-4 py-2 text-xs font-bold text-sub border rounded-lg">Cancel</button>
                        <button type="submit" disabled={creatingUser} className="px-5 py-2 text-xs font-bold text-white bg-success rounded-lg hover:bg-success flex items-center gap-1.5">
                            {creatingUser ? 'Creating Account...' : 'Create Account & Continue'}
                        </button>
                    </div>
                </form>
            </Modal>
            {/* ================= MODAL: ADD / EDIT ACTIVITY ================= */}
            <Modal
                show={showActivityModal}
                onClose={() => {
                    setShowActivityModal(false);
                    setEditingActivityId(null);
                    setActivityForm({ title: '', description: '', date: '', location: '' });
                    setActivityImageFiles([]);
                    setExistingActivityImages([]);
                }}
                title={editingActivityId ? 'Edit Club Activity' : 'Add Club Activity'}
            >
                <form onSubmit={handleSaveActivity} className="space-y-4">
                    <div className="p-3 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-xl text-xs text-primary">
                        <p className="font-bold">
                            {editingActivityId ? 'Editing activity for: ' : 'Adding activity to: '}
                            <span className="text-primary">{selectedClub?.name}</span>
                        </p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-sub">Activity Title *</label>
                        <input
                            type="text"
                            value={activityForm.title}
                            onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                            placeholder="e.g. Annual Tech Fest, Workshop on Robotics..."
                            className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-sub">Description</label>
                        <textarea
                            value={activityForm.description}
                            onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                            placeholder="Brief overview of the activity, objectives, and details..."
                            rows={3}
                            className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-sub">Date *</label>
                            <input
                                type="date"
                                value={activityForm.date}
                                onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-sub">Location / Venue</label>
                            <input
                                type="text"
                                value={activityForm.location}
                                onChange={(e) => setActivityForm({ ...activityForm, location: e.target.value })}
                                placeholder="e.g. Seminar Hall A"
                                className="w-full px-3 py-2 text-xs border rounded-lg focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Option to add an image or group of images */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-sub flex items-center gap-1.5">
                                <Image size={14} className="text-primary" />
                                Activity Photos (Single image or group of images)
                            </label>
                            {(existingActivityImages.length > 0 || activityImageFiles.length > 0) && (
                                <span className="text-[11px] font-semibold text-primary">
                                    {existingActivityImages.length + activityImageFiles.length} photo(s) selected
                                </span>
                            )}
                        </div>

                        {/* Existing images list (when editing) */}
                        {existingActivityImages.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider">Current Photos</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {existingActivityImages.map((imgUrl, idx) => (
                                        <div key={idx} className="relative h-18 rounded-lg overflow-hidden border border-border group">
                                            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setExistingActivityImages(prev => prev.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 bg-danger text-white rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100 hover:scale-110 transition-all"
                                                title="Remove photo"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* New images preview list */}
                        {activityImageFiles.length > 0 && (
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">New Photos to Upload</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {activityImageFiles.map((file, idx) => {
                                        const previewUrl = URL.createObjectURL(file);
                                        return (
                                            <div key={idx} className="relative h-18 rounded-lg overflow-hidden border border-[var(--primary-light)] group">
                                                <img src={previewUrl} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => setActivityImageFiles(prev => prev.filter((_, i) => i !== idx))}
                                                    className="absolute top-1 right-1 bg-danger text-white rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100 hover:scale-110 transition-all"
                                                    title="Remove photo"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Upload Area for single or group of images */}
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-strong hover:border-primary rounded-xl p-4 cursor-pointer bg-background hover:bg-[var(--primary-light)] transition-all">
                            <Upload size={22} className="text-muted-text mb-1" />
                            <span className="text-xs font-bold text-sub">Choose images to upload</span>
                            <span className="text-[10px] text-muted-text mt-0.5">Select a single image or group of images (hold Ctrl/Shift to pick multiple)</span>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        const newFiles = Array.from(e.target.files);
                                        setActivityImageFiles(prev => [...prev, ...newFiles]);
                                        e.target.value = '';
                                    }
                                }}
                                className="hidden"
                            />
                        </label>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setShowActivityModal(false);
                                setEditingActivityId(null);
                                setActivityForm({ title: '', description: '', date: '', location: '' });
                                setActivityImageFiles([]);
                                setExistingActivityImages([]);
                            }}
                            className="px-4 py-2 text-xs font-bold text-sub border rounded-lg hover:bg-background"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={savingActivity}
                            className="px-5 py-2 text-xs font-bold text-white bg-primary rounded-lg hover:bg-primary-hover flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            <Plus size={14} /> {savingActivity ? 'Saving...' : (editingActivityId ? 'Update Activity' : 'Add Activity')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Lightbox / Full-screen Image Preview */}
            {previewModalImage && (
                <div
                    className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPreviewModalImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setPreviewModalImage(null)}
                            className="absolute top-3 right-3 bg-[var(--surface)]/20 hover:bg-[var(--surface)]/40 text-white p-2 rounded-full backdrop-blur-md transition-all z-10"
                        >
                            <X size={20} />
                        </button>
                        <img
                            src={previewModalImage}
                            alt=""
                            className="max-w-full max-h-[85vh] object-contain rounded-xl"
                        />
                    </div>
                </div>
            )}

            {/* ================= MODAL: ADD STUDENT MEMBER DIRECTLY ================= */}
            <Modal
                show={showAddStudentMemberModal}
                onClose={() => {
                    setShowAddStudentMemberModal(false);
                    setStudentSearchQuery('');
                    setStudentSearchResults([]);
                }}
                title={`Add Student Member - ${selectedClub?.name || 'Club'}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-sub">Search Student</label>
                        <p className="text-[11px] text-muted-text mb-2">Search students by student name, PIN number, admission number, or branch to add them to this club.</p>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-2.5 text-muted-text" />
                            <input
                                type="text"
                                placeholder="Type name, admission no, PIN..."
                                value={studentSearchQuery}
                                onChange={(e) => handleSearchStudentsForAdd(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs border border-border-strong rounded-xl focus:ring-2 focus:ring-primary focus:outline-none"
                                autoFocus
                            />
                        </div>
                        {searchingStudentsForAdd && <p className="text-[11px] text-primary mt-1 animate-pulse">Searching students...</p>}
                    </div>

                    {/* Results */}
                    {studentSearchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y">
                            {studentSearchResults.map(st => {
                                const isAlreadyMember = (selectedClub?.members || []).some(m =>
                                    String(m.student_id) === String(st.id) || String(m.admission_number) === String(st.admission_number)
                                );
                                return (
                                    <div
                                        key={st.id}
                                        className={`p-3 text-xs flex justify-between items-center transition-colors ${
                                            isAlreadyMember ? 'bg-background opacity-60' : 'hover:bg-[var(--primary-light)]'
                                        }`}
                                    >
                                        <div>
                                            <p className="font-bold text-main">{st.student_name}</p>
                                            <p className="text-[11px] text-sub font-mono">
                                                Adm: {st.admission_number} {st.pin_no ? `| PIN: ${st.pin_no}` : ''}
                                            </p>
                                            <p className="text-[10px] text-muted-text">
                                                {[st.course, st.branch, st.current_year ? `Year ${st.current_year}` : null, st.college].filter(Boolean).join(' • ')}
                                            </p>
                                        </div>
                                        <div>
                                            {isAlreadyMember ? (
                                                <span className="px-2.5 py-1 text-[10px] font-bold bg-[var(--success-light)] text-success rounded-full">
                                                    Already Member
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddStudentToClub(st)}
                                                    disabled={addingMember}
                                                    className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 shadow-xs"
                                                >
                                                    <Plus size={13} /> Add Member
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {studentSearchQuery && !searchingStudentsForAdd && studentSearchResults.length === 0 && (
                        <div className="text-center py-6 text-muted-text text-xs border border-dashed rounded-xl">
                            No students found matching "{studentSearchQuery}".
                        </div>
                    )}

                    <div className="flex justify-end pt-3 border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAddStudentMemberModal(false);
                                setStudentSearchQuery('');
                                setStudentSearchResults([]);
                            }}
                            className="px-4 py-2 text-xs font-bold text-sub hover:bg-background rounded-xl"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Clubs;
