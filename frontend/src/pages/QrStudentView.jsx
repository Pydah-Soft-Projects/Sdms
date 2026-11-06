import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
    User, AlertCircle, Loader, X, Bus,
    MapPin, Calendar, BadgeCheck, Ticket, CheckCircle2,
    Clock, XCircle, ZoomIn, ChevronDown, ChevronUp,
    Home, Bed, Utensils, KeyRound
} from 'lucide-react';

import { API_URL as API_BASE } from '../config/api';

// Format Date of Birth as DD/MM/YYYY
const formatDob = (raw) => {
    if (!raw) return '—';
    let date = new Date(raw);
    if (isNaN(date.getTime())) {
        const parts = String(raw).split(/[\/\-.]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                date = new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
                date = new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
    }
    if (isNaN(date.getTime())) return String(raw);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

// A single field card with centered heading & value
const FieldCard = ({ label, value }) => (
    <div className="bg-[var(--background)]/90 border border-border rounded-xl p-1.5 sm:p-2.5 transition-colors h-full flex flex-col items-center justify-center text-center min-h-[52px] min-w-0">
        <p className="text-[9px] sm:text-[10px] font-bold text-muted-text uppercase tracking-tight mb-0.5 truncate w-full">{label}</p>
        <p className="text-[11px] sm:text-xs md:text-sm font-bold text-main truncate w-full">{String(value || '—')}</p>
    </div>
);

// Helper badge for transport request status
const StatusBadge = ({ status, isActivePass }) => {
    const st = String(status || '').toLowerCase();
    if (isActivePass || st === 'approved' || st === 'active') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)] shadow-2xs">
                <CheckCircle2 size={12} /> Approved
            </span>
        );
    }
    if (st === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] shadow-2xs">
                <Clock size={12} /> Pending
            </span>
        );
    }
    if (st === 'rejected' || st === 'cancelled' || st === 'expired') {
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] capitalize shadow-2xs">
                <XCircle size={12} /> {st}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-background text-sub uppercase">
            {status || 'Unknown'}
        </span>
    );
};

// Transport Details Section Component
const TransportInfoSection = ({ transportInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!transportInfo) return null;

    const { hasTransport, requests = [], requestsByYear = {}, activePass } = transportInfo;
    const yearKeys = Object.keys(requestsByYear);

    // Compute default selected tab (Current year / active pass year tab if available, else first year tab, else 'All')
    const initialTab = React.useMemo(() => {
        if (!requestsByYear) return 'All';
        const keys = Object.keys(requestsByYear);
        if (keys.length === 0) return 'All';
        if (activePass?.year_of_study) {
            const activeKey = `Year ${activePass.year_of_study}`;
            if (keys.includes(activeKey)) return activeKey;
        }
        return keys[0] || 'All';
    }, [requestsByYear, activePass]);

    const [selectedYearTab, setSelectedYearTab] = useState(initialTab);

    useEffect(() => {
        if (initialTab) setSelectedYearTab(initialTab);
    }, [initialTab]);

    // Sort requests so active pass comes first, followed by highest year of study descending
    const sortRequests = (list) => {
        return [...list].sort((a, b) => {
            if (a.isActivePass && !b.isActivePass) return -1;
            if (!a.isActivePass && b.isActivePass) return 1;
            const yearA = Number(a.year_of_study) || 0;
            const yearB = Number(b.year_of_study) || 0;
            return yearB - yearA;
        });
    };

    const rawRequests = selectedYearTab === 'All'
        ? requests
        : (requestsByYear[selectedYearTab] || []);

    const displayedRequests = sortRequests(rawRequests);

    return (
        <div className="mt-4 bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Clickable Card Header (Light Gradient Theme + Expandable) */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--background)] to-[var(--success-light)] text-main px-4 py-3.5 flex items-center justify-between cursor-pointer select-none border-b border-border transition-colors hover:from-[var(--primary-light)] hover:to-[var(--success-light)]"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Bus size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-main leading-tight truncate">Transport Details</h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasTransport ? (
                        activePass ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)] flex items-center gap-1 shadow-2xs">
                                <BadgeCheck size={13} /> Active Pass
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] shadow-2xs">
                                {requests.length} Request(s)
                            </span>
                        )
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background text-muted-text border border-border">
                            No Transport
                        </span>
                    )}

                    {/* Expand / Collapse Chevron Indicator */}
                    <div className="p-1 rounded-lg hover:bg-[var(--background)]/60 text-muted-text transition-colors">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </div>

            {/* Collapsible Card Body */}
            {isExpanded && (
                <div className="p-3 sm:p-4 animate-in fade-in duration-150">
                    {!hasTransport ? (
                        <div className="text-center py-6 px-4 bg-[var(--background)]/80 rounded-xl border border-dashed border-border">
                            <div className="w-10 h-10 rounded-full bg-background text-muted-text flex items-center justify-center mx-auto mb-2">
                                <Bus size={20} />
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-sub">No Transport Requests Found</p>
                            <p className="text-[11px] text-muted-text mt-0.5">This student has no registered transport requests in the system.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Year Tabs Filter */}
                            {yearKeys.length > 0 && (
                                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
                                    <button
                                        onClick={() => setSelectedYearTab('All')}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                            selectedYearTab === 'All'
                                                ? 'bg-primary text-white shadow-2xs'
                                                : 'bg-background text-sub hover:bg-background'
                                        }`}
                                    >
                                        All ({requests.length})
                                    </button>
                                    {yearKeys.map(year => (
                                        <button
                                            key={year}
                                            onClick={() => setSelectedYearTab(year)}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                                selectedYearTab === year
                                                    ? 'bg-primary text-white shadow-2xs'
                                                    : 'bg-background text-sub hover:bg-background'
                                            }`}
                                        >
                                            {year} ({requestsByYear[year].length})
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Transport Requests List */}
                            <div className="space-y-2.5">
                                {displayedRequests.map((req, idx) => (
                                    <div
                                        key={req.id || req._id || idx}
                                        className={`rounded-xl p-3 border transition-all ${
                                            req.isActivePass
                                                ? 'bg-gradient-to-br from-[var(--primary-light)] to-[var(--success-light)] border-[var(--primary-light)] shadow-xs'
                                                : 'bg-[var(--background)]/90 border-border'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs sm:text-sm font-extrabold text-main leading-snug break-words">
                                                    {req.route_id ? `Route ID: ${req.route_id}` : ''}
                                                    {req.route_name ? (req.route_id ? ` • ${req.route_name}` : req.route_name) : ''}
                                                </h4>
                                                {req.academic_year && (
                                                    <p className="text-[11px] font-medium text-muted-text mt-0.5">
                                                        Academic Year: {req.academic_year}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0">
                                                <StatusBadge status={req.status} isActivePass={req.isActivePass} />
                                            </div>
                                        </div>

                                        {/* Detailed Fields Grid */}
                                        <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-border">
                                            <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                <MapPin size={13} className="text-primary flex-shrink-0" />
                                                <span className="truncate">
                                                    <strong className="text-main">Stop:</strong> {req.stage_name || '—'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                <Bus size={13} className="text-sub flex-shrink-0" />
                                                <span className="truncate">
                                                    <strong className="text-main">Bus:</strong> {req.bus_id || 'Unassigned'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                <Ticket size={13} className="text-success flex-shrink-0" />
                                                <span className="truncate">
                                                    <strong className="text-main">Fare:</strong> ₹{req.fare || 0}
                                                </span>
                                            </div>
                                            {req.expiry_date && (
                                                <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                    <Calendar size={13} className="text-warning flex-shrink-0" />
                                                    <span className="truncate">
                                                        <strong className="text-main">Expires:</strong> {new Date(req.expiry_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Hostel Details Section Component
const HostelInfoSection = ({ hostelInfo }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!hostelInfo) return null;

    const { hasHostel, requests = [], requestsByYear = {}, activeHostel } = hostelInfo;
    const yearKeys = Object.keys(requestsByYear);

    // Compute default selected tab (Current year / active hostel year tab if available, else first year tab, else 'All')
    const initialTab = React.useMemo(() => {
        if (!requestsByYear) return 'All';
        const keys = Object.keys(requestsByYear);
        if (keys.length === 0) return 'All';
        if (activeHostel?.sdmsYearOfStudy) {
            const activeKey = `Year ${activeHostel.sdmsYearOfStudy}`;
            if (keys.includes(activeKey)) return activeKey;
        }
        return keys[0] || 'All';
    }, [requestsByYear, activeHostel]);

    const [selectedYearTab, setSelectedYearTab] = useState(initialTab);

    useEffect(() => {
        if (initialTab) setSelectedYearTab(initialTab);
    }, [initialTab]);

    const sortRequests = (list) => {
        return [...list].sort((a, b) => {
            if (a.isActiveHostel && !b.isActiveHostel) return -1;
            if (!a.isActiveHostel && b.isActiveHostel) return 1;
            const yearA = Number(a.sdmsYearOfStudy) || 0;
            const yearB = Number(b.sdmsYearOfStudy) || 0;
            return yearB - yearA;
        });
    };

    const rawRequests = selectedYearTab === 'All'
        ? requests
        : (requestsByYear[selectedYearTab] || []);

    const displayedRequests = sortRequests(rawRequests);

    return (
        <div className="mt-4 bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
            {/* Clickable Card Header (Light Theme + Expandable) */}
            <div 
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-gradient-to-r from-[var(--warning-light)] via-[var(--background)] to-[var(--warning-light)] text-main px-4 py-3.5 flex items-center justify-between cursor-pointer select-none border-b border-border transition-colors hover:from-[var(--warning-light)] hover:to-[var(--warning-light)]"
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[var(--warning-light)] border border-[var(--warning-light)] text-warning flex items-center justify-center flex-shrink-0 shadow-2xs">
                        <Home size={18} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-main leading-tight truncate">Hostel Details</h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasHostel ? (
                        activeHostel ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)] flex items-center gap-1 shadow-2xs">
                                <BadgeCheck size={13} /> Active Resident
                            </span>
                        ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] shadow-2xs">
                                {requests.length} Record(s)
                            </span>
                        )
                    ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background text-muted-text border border-border">
                            No Hostel
                        </span>
                    )}

                    {/* Expand / Collapse Chevron Indicator */}
                    <div className="p-1 rounded-lg hover:bg-[var(--background)]/60 text-muted-text transition-colors">
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                </div>
            </div>

            {/* Collapsible Card Body */}
            {isExpanded && (
                <div className="p-3 sm:p-4 animate-in fade-in duration-150">
                    {!hasHostel || requests.length === 0 ? (
                        <div className="text-center py-6 px-4 bg-[var(--background)]/80 rounded-xl border border-dashed border-border">
                            <div className="w-10 h-10 rounded-full bg-background text-muted-text flex items-center justify-center mx-auto mb-2">
                                <Home size={20} />
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-sub">No Hostel Records Found</p>
                            <p className="text-[11px] text-muted-text mt-0.5">This student has no registered hostel records in the system.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Year Tabs Filter */}
                            {yearKeys.length > 0 && (
                                <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
                                    <button
                                        onClick={() => setSelectedYearTab('All')}
                                        className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                            selectedYearTab === 'All'
                                                ? 'bg-warning text-white shadow-2xs'
                                                : 'bg-background text-sub hover:bg-background'
                                        }`}
                                    >
                                        All ({requests.length})
                                    </button>
                                    {yearKeys.map(year => (
                                        <button
                                            key={year}
                                            onClick={() => setSelectedYearTab(year)}
                                            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                                selectedYearTab === year
                                                    ? 'bg-warning text-white shadow-2xs'
                                                    : 'bg-background text-sub hover:bg-background'
                                            }`}
                                        >
                                            {year} ({requestsByYear[year].length})
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Hostel Requests List */}
                            <div className="space-y-2.5">
                                {displayedRequests.map((req, idx) => (
                                    <div
                                        key={req.id || idx}
                                        className={`rounded-xl p-3 border transition-all ${
                                            req.isActiveHostel
                                                ? 'bg-gradient-to-br from-[var(--warning-light)] to-[var(--warning-light)] border-[var(--warning-light)] shadow-xs'
                                                : 'bg-[var(--background)]/90 border-border'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-xs sm:text-sm font-extrabold text-main leading-snug break-words">
                                                    Hostel: <span className="text-warning font-bold">{req.hostelCode}</span>
                                                    {req.categoryName && (
                                                        <span className="text-sub font-medium"> • Category: <strong className="text-main font-bold">{req.categoryName}</strong></span>
                                                    )}
                                                </h4>
                                                {req.academicYear && (
                                                    <p className="text-[11px] font-medium text-muted-text mt-0.5">
                                                        Academic Year: {req.academicYear}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex-shrink-0">
                                                <StatusBadge status={req.status} isActivePass={req.isActiveHostel} />
                                            </div>
                                        </div>

                                        {/* Detailed Fields Grid */}
                                        <div className="grid grid-cols-2 gap-2 text-xs pt-2.5 border-t border-border">
                                            <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                <Home size={13} className="text-warning flex-shrink-0" />
                                                <span className="truncate">
                                                    <strong className="text-main">Room:</strong> {req.roomNumber}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-sub min-w-0">
                                                <Bed size={13} className="text-sub flex-shrink-0" />
                                                <span className="truncate">
                                                    <strong className="text-main">Bed:</strong> {req.bedNumber}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function QrStudentView() {
    const { qrToken } = useParams();

    // Public data state
    const [publicLoading, setPublicLoading] = useState(true);
    const [publicData, setPublicData] = useState(null); // { student, transportInfo, hasPrivateView }
    const [publicError, setPublicError] = useState('');

    // Photo preview modal state
    const [showPhotoPreviewModal, setShowPhotoPreviewModal] = useState(false);

    // Fetch public data on mount
    useEffect(() => {
        if (!qrToken) return;
        const load = async () => {
            try {
                setPublicLoading(true);
                const res = await axios.get(`${API_BASE}/qr/public/${encodeURIComponent(qrToken.trim())}`);
                if (res.data.success) {
                    setPublicData(res.data.data);
                } else {
                    setPublicError(res.data.message || 'Student not found');
                }
            } catch (e) {
                setPublicError(e.response?.data?.message || 'Student not found or server error');
            } finally {
                setPublicLoading(false);
            }
        };
        load();
    }, [qrToken]);

    // Extract helper value from publicData.student
    const getVal = (key) => {
        if (!publicData?.student) return '';
        const item = publicData.student[key];
        if (!item) return '';
        if (typeof item === 'object' && item.value !== undefined) return item.value;
        return item;
    };

    const studentPhotoUrl = getVal('student_photo');
    const studentName = getVal('student_name') || 'Student';
    const admissionNo = getVal('admission_no') || getVal('admission_number');
    const pinNo = getVal('pin_no') || getVal('pin_number') || getVal('pin');
    const collegeName = getVal('college');

    // Combine Current Year & Semester (e.g. "4 - 1")
    const yearVal = getVal('current_year');
    const semVal = getVal('current_semester');
    let yearSemDisplay = '—';
    if (yearVal && semVal) {
        yearSemDisplay = `${yearVal} - ${semVal}`;
    } else if (yearVal) {
        yearSemDisplay = `${yearVal}`;
    } else if (semVal) {
        yearSemDisplay = `${semVal}`;
    }

    // List of keys to exclude from general remaining fields grid
    const EXCLUDED_KEYS = new Set([
        'student_photo', 'student_name', 'admission_no', 'admission_number', 'pin_no', 'pin_number', 'pin',
        'college', 'course', 'branch', 'batch',
        'current_year', 'current_semester',
        'student_mobile', 'parent_mobile1', 'parent_mobile2', // parent_mobile2 removed completely
        'gender', 'dob',
        'father_name' // Explicitly removed
    ]);

    // Build remaining general fields
    const remainingFields = [];
    if (publicData?.student) {
        Object.keys(publicData.student).forEach(key => {
            if (!EXCLUDED_KEYS.has(key)) {
                const item = publicData.student[key];
                const label = item?.label || key.replace(/_/g, ' ').toUpperCase();
                let val = typeof item === 'object' && item.value !== undefined ? item.value : item;
                
                if (val !== undefined && val !== null && val !== '') {
                    remainingFields.push({ key, label, value: val });
                }
            }
        });
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[var(--background)] via-[var(--background)] to-[var(--primary-light)] flex flex-col items-center py-4 sm:py-8 px-2.5 sm:px-4 selection:bg-primary selection:text-white">
            <div className="w-full max-w-xl sm:max-w-2xl">

                {/* ── COLLEGE HEADER & BRANDING (LOGO LEFT, TITLE RIGHT + STYLISH COLORFUL UNDERLINE) ── */}
                <div className="bg-surface rounded-2xl p-4 sm:p-5 shadow-xs border border-border mb-4 relative overflow-hidden">
                    <div className="flex items-center gap-3.5 sm:gap-5">
                        {/* College Logo Left */}
                        <img
                            src="/logo.png"
                            alt="Pydah Educational Group Logo"
                            className="h-12 sm:h-16 w-auto object-contain flex-shrink-0 transition-transform hover:scale-105"
                            onError={e => { e.target.style.display = 'none'; }}
                        />
                        {/* Title & Colorful Stylish Underline Right */}
                        <div className="min-w-0 flex-1">
                            <h1 className="text-base sm:text-xl font-black text-main tracking-tight leading-snug">
                                PYDAH EDUCATIONAL GROUP
                            </h1>
                            {/* Colorful Underline */}
                            <div className="w-24 sm:w-36 h-1.5 bg-gradient-to-r from-primary via-info to-success rounded-full mt-1.5 shadow-2xs" />
                        </div>
                    </div>
                </div>

                {/* ── LOADING STATE ── */}
                {publicLoading && (
                    <div className="bg-surface rounded-2xl shadow-sm border border-border p-10 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin border-[3px]" />
                        <p className="text-xs sm:text-sm font-semibold text-muted-text">Retrieving student records...</p>
                    </div>
                )}

                {/* ── ERROR STATE ── */}
                {!publicLoading && publicError && (
                    <div className="bg-surface rounded-2xl shadow-sm border border-[var(--danger-light)] p-8 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--danger-light)] flex items-center justify-center">
                            <AlertCircle size={24} className="text-danger" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-main">
                            {publicError.toLowerCase().includes('expired') ||
                            publicError.toLowerCase().includes('validity')
                                ? 'QR Link Expired'
                                : 'Student Not Found'}
                        </h2>
                        <p className="text-xs sm:text-sm text-muted-text max-w-md">{publicError}</p>
                    </div>
                )}

                {/* ── MAIN PUBLIC DATA CARD ── */}
                {!publicLoading && publicData && (
                    <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">

                        {/* Student Photo + Profile Header (LIGHTER ELEGANT BACKGROUND) */}
                        <div className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--background)] to-[var(--success-light)] px-4 sm:px-6 py-6 text-main text-center relative flex flex-col items-center justify-center border-b border-border">
                            
                            {/* Circular Photo Container */}
                            <div className="relative group cursor-pointer mb-3" onClick={() => { if (studentPhotoUrl) setShowPhotoPreviewModal(true); }}>
                                {studentPhotoUrl ? (
                                    <div className="relative">
                                        <img
                                            src={studentPhotoUrl}
                                            alt={studentName}
                                            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-surface object-cover shadow-md transition-transform duration-200 group-hover:scale-105"
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                        <div className="absolute inset-0 rounded-full bg-[var(--sidebar)]/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
                                            <ZoomIn size={22} className="text-white drop-shadow-md" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-surface bg-[var(--primary-light)] flex items-center justify-center shadow-inner">
                                        <User size={44} className="text-primary" />
                                    </div>
                                )}
                            </div>

                            {/* Centered Student Name */}
                            <h2 className="text-lg sm:text-2xl font-black text-main leading-tight truncate max-w-full">
                                {studentName}
                            </h2>

                            {/* Admission Number & PIN Number */}
                            <div className="flex items-center justify-center gap-2 sm:gap-3 text-sub text-xs sm:text-sm font-semibold tracking-wide mt-1 flex-wrap">
                                {admissionNo && (
                                    <span>Adm No: <strong className="text-main font-bold">{admissionNo}</strong></span>
                                )}
                                {admissionNo && (
                                    <span className="text-muted-text font-bold">•</span>
                                )}
                                <span>PIN No: <strong className="text-main font-bold">{pinNo || '—'}</strong></span>
                            </div>

                            {/* College Name Centered Below Admission & PIN */}
                            {collegeName && (
                                <div className="mt-2.5 inline-flex items-center justify-center px-4 py-1 rounded-full bg-primary text-white shadow-2xs text-xs font-bold tracking-wide">
                                    {collegeName}
                                </div>
                            )}
                        </div>

                        {/* Structured Fields Section */}
                        <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3">
                            
                            {/* ROW 1 (3 ITEMS): PROGRAM | BRANCH | BATCH */}
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                                <FieldCard label="Program" value={getVal('course')} />
                                <FieldCard label="Branch" value={getVal('branch')} />
                                <FieldCard label="Batch" value={getVal('batch')} />
                            </div>

                            {/* ROW 2 (2 ITEMS): STUDENT MOBILE | PARENT MOBILE */}
                            <div className="grid grid-cols-2 gap-1.5 sm:gap-2.5">
                                <FieldCard label="Student Mobile" value={getVal('student_mobile')} />
                                <FieldCard label="Parent Mobile" value={getVal('parent_mobile1')} />
                            </div>

                            {/* ROW 3 (3 ITEMS): YEAR / SEM | GENDER | DATE OF BIRTH */}
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
                                <FieldCard label="Year / Sem" value={yearSemDisplay} />
                                <FieldCard label="Gender" value={getVal('gender')} />
                                <FieldCard label="Date of Birth" value={formatDob(getVal('dob'))} />
                            </div>

                            {/* ROW 4+: REMAINING FIELDS */}
                            {remainingFields.length > 0 && (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2.5 pt-1.5 border-t border-border">
                                    {remainingFields.map(field => {
                                        const isFullWidth = field.key === 'student_address' || field.key === 'remarks' || String(field.value).length > 30;
                                        return (
                                            <div key={field.key} className={isFullWidth ? "col-span-2 sm:col-span-3" : ""}>
                                                <FieldCard label={field.label} value={field.value} />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>
                    </div>
                )}

                {/* ── TRANSPORT DETAILS SECTION (Only display if transport requests exist) ── */}
                {!publicLoading && publicData && publicData.transportInfo?.hasTransport && publicData.transportInfo?.requests?.length > 0 && (
                    <TransportInfoSection transportInfo={publicData.transportInfo} />
                )}

                {/* ── HOSTEL DETAILS SECTION (Only display if hostel requests exist) ── */}
                {!publicLoading && publicData && publicData.hostelInfo?.hasHostel && publicData.hostelInfo?.requests?.length > 0 && (
                    <HostelInfoSection hostelInfo={publicData.hostelInfo} />
                )}

                {/* ── FOOTER ── */}
                <div className="text-center mt-6 text-muted-text">
                    <p className="text-[11px] font-semibold">
                        Pydah Student Management System (SDMS)
                    </p>
                    <p className="text-[10px] mt-0.5 text-muted-text">
                        Secure QR Code Identity & Transport Verification Portal
                    </p>
                </div>
            </div>

            {/* ── STUDENT PHOTO POPUP ENLARGED MODAL ── */}
            {showPhotoPreviewModal && studentPhotoUrl && (
                <div
                    className="fixed inset-0 bg-[var(--sidebar)]/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-150"
                    onClick={() => setShowPhotoPreviewModal(false)}
                >
                    <div
                        className="bg-surface rounded-3xl overflow-hidden shadow-2xl max-w-xs sm:max-w-md w-full relative flex flex-col items-center border border-surface"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        <button
                            onClick={() => setShowPhotoPreviewModal(false)}
                            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[var(--sidebar)]/60 hover:bg-sidebar text-white flex items-center justify-center transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <div className="w-full bg-sidebar p-4 text-center text-white border-b border-border-strong">
                            <h3 className="text-sm font-bold truncate">{studentName}</h3>
                            <div className="flex items-center justify-center gap-2 text-xs text-primary font-mono mt-0.5">
                                {admissionNo && <span>Adm: {admissionNo}</span>}
                                <span>•</span>
                                <span>PIN: {pinNo || '—'}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-background w-full flex items-center justify-center">
                            <img
                                src={studentPhotoUrl}
                                alt={studentName}
                                className="w-full max-h-[65vh] object-contain rounded-2xl shadow-lg border border-border"
                            />
                        </div>

                        <div className="p-3 w-full bg-surface text-center">
                            <button
                                onClick={() => setShowPhotoPreviewModal(false)}
                                className="px-5 py-2 bg-sidebar text-white rounded-xl text-xs font-bold hover:bg-sidebar transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
