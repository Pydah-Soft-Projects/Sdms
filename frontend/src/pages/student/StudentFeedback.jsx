import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RiMessage2Line,
    RiCheckDoubleLine,
    RiUser3Line,
    RiBookOpenLine,
    RiCloseLine,
    RiStarFill,
    RiStarLine,
    RiArrowRightLine,
    RiTimeLine,
    RiAlertLine,
    RiRefreshLine,
    RiShieldCheckLine,
    RiSearchLine,
    RiCheckboxCircleFill,
    RiGraduationCapLine,
    RiInformationLine,
    RiSparklingLine,
    RiThumbUpLine,
    RiNotification3Line,
    RiCalendarLine,
    RiStackLine,
    RiLockLine,
    RiTimerLine,
} from 'react-icons/ri';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { SkeletonBox } from '../../components/SkeletonLoader';

/* ── Helper: Format Title Case ─────────────────────────────────────── */
const toTitleCase = (str) => {
    if (!str) return '';
    if (str.length <= 4 && str === str.toUpperCase()) return str;

    const smallWords = new Set(['and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'a', 'an', 'the', 'by', '&']);
    return str
        .toLowerCase()
        .split(' ')
        .map((word, idx) => {
            if (!word) return '';
            if (idx !== 0 && smallWords.has(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
};

/* ── Helper: Extract Initials for Avatar ────────────────────────────── */
const getInitials = (name) => {
    if (!name) return 'FC';
    const clean = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*/i, '').trim();
    const parts = clean.split(' ').filter(Boolean);
    if (parts.length === 0) return 'FC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/* ── localStorage helpers for duplicate-submission prevention ──────── */
const getSubjectKey = (pubId, subjectName) =>
    `fb_sub_${pubId}_${String(subjectName || '').trim().toLowerCase()}`;

const getStoredToken = (pubId, subjectName, facultyName) => {
    if (!pubId || !subjectName) return null;
    return (
        localStorage.getItem(getSubjectKey(pubId, subjectName)) ||
        (facultyName ? localStorage.getItem(`fb_token_${pubId}_${subjectName}_${facultyName}`) : null)
    );
};

const storeToken = (pubId, subjectName, facultyName, token) => {
    const val = token || 'submitted';
    localStorage.setItem(getSubjectKey(pubId, subjectName), val);
    if (facultyName) {
        localStorage.setItem(`fb_token_${pubId}_${subjectName}_${facultyName}`, val);
    }
};

/* ── Live Countdown Helpers ────────────────────────────────────────── */
const formatDateTimeFull = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return String(iso);
    }
};

const getCountdownParts = (targetIso, currentMs) => {
    if (!targetIso) return null;
    const targetMs = new Date(targetIso).getTime();
    const diff = targetMs - currentMs;
    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return { days, hours, minutes, seconds, totalMs: diff };
};

const formatCountdownString = (parts) => {
    if (!parts) return '';
    const { days, hours, minutes, seconds } = parts;
    if (days > 0) {
        return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
    }
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

/* ── Rating descriptions ───────────────────────────────────────────── */
const RATING_DESCRIPTIONS = {
    1: 'Poor — Needs significant improvement',
    2: 'Fair — Room for improvement',
    3: 'Good — Meets expectations',
    4: 'Very Good — Exceeds expectations',
    5: 'Excellent — Outstanding instruction',
};

/* ── Question Field Component ──────────────────────────────────────── */
const QuestionField = ({ question, value, onChange }) => {
    const { questionType, options, minValue = 1, maxValue = 5, questionText = '' } = question;
    const [hoverStar, setHoverStar] = useState(0);

    // Multiple Choice
    if (questionType === 'multiple_choice') {
        const isUnitsQuestion = questionText.toLowerCase().includes('unit');

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-2.5">
                    {(options || []).map((opt, i) => {
                        const isSelected = String(value) === String(opt);
                        const label = isUnitsQuestion && !isNaN(Number(opt)) ? `Unit ${opt}` : opt;

                        return (
                            <button
                                key={i}
                                type="button"
                                onClick={() => onChange(opt)}
                                className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-semibold border transition-all duration-150 flex items-center justify-center gap-1.5 sm:gap-2 select-none ${
                                    isSelected
                                        ? 'bg-primary border-primary text-white shadow-md shadow-primary ring-2 ring-[var(--primary-light)]'
                                        : 'bg-surface border-border text-sub hover:border-[var(--primary-light)] hover:bg-background'
                                }`}
                            >
                                {isSelected && <RiCheckboxCircleFill size={15} className="text-white shrink-0" />}
                                <span>{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Rating Scale
    if (questionType === 'rating_scale') {
        const stars = [];
        for (let s = Number(minValue); s <= Number(maxValue); s++) stars.push(s);
        const activeScore = hoverStar || Number(value) || 0;

        return (
            <div className="space-y-2.5 sm:space-y-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {stars.map((star) => {
                        const isFilled = activeScore >= star;
                        return (
                            <button
                                key={star}
                                type="button"
                                onMouseEnter={() => setHoverStar(star)}
                                onMouseLeave={() => setHoverStar(0)}
                                onClick={() => onChange(star)}
                                className="p-0.5 sm:p-1 rounded-lg transition-transform duration-150 active:scale-90 hover:scale-110 focus:outline-hidden"
                                aria-label={`Rate ${star} out of ${maxValue}`}
                            >
                                {isFilled ? (
                                    <RiStarFill size={32} className="text-warning drop-shadow-xs sm:w-9 sm:h-9" />
                                ) : (
                                    <RiStarLine size={32} className="text-muted-text hover:text-warning sm:w-9 sm:h-9" />
                                )}
                            </button>
                        );
                    })}
                    {value ? (
                        <div className="ml-2 sm:ml-3 px-2.5 py-1 rounded-lg bg-[var(--warning-light)] border border-[var(--warning-light)] text-warning text-xs font-bold">
                            {value} / {maxValue}
                        </div>
                    ) : null}
                </div>

                {activeScore > 0 && (
                    <p className="text-xs font-medium text-sub flex items-center gap-1.5 transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                        {RATING_DESCRIPTIONS[activeScore] || `Score ${activeScore} of ${maxValue}`}
                    </p>
                )}
            </div>
        );
    }

    // Text / Textarea
    if (questionType === 'text' || questionType === 'textarea') {
        return (
            <div className="space-y-1.5">
                <textarea
                    rows={3}
                    className="w-full p-3 sm:p-3.5 border border-border rounded-xl focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary outline-hidden transition-all resize-none text-main text-xs sm:text-sm placeholder:text-muted-text leading-relaxed"
                    placeholder="Enter your feedback or suggestions here..."
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            </div>
        );
    }

    return null;
};

/* ── Main Component ────────────────────────────────────────────────── */
const StudentFeedback = () => {
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [publications, setPublications] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [submittedMap, setSubmittedMap] = useState({});

    // Search and tab filter
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'completed'

    // Notification-Wise Session State
    const [selectedPubId, setSelectedPubId] = useState(null);
    const [viewMode, setViewMode] = useState('single'); // 'single' (focused notification) | 'grouped' (all notifications grouped)

    // Form Modal
    const [modalPub, setModalPub] = useState(null);
    const [modalSubject, setModalSubject] = useState(null);
    const [formQuestions, setFormQuestions] = useState([]);
    const [formLoading, setFormLoading] = useState(false);
    const [responses, setResponses] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Live Clock for Countdown Timers
    const [currentTime, setCurrentTime] = useState(Date.now());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const isPubScheduled = useCallback(
        (pub) => {
            if (!pub) return false;
            if (pub.status === 'scheduled') return true;
            if (pub.startDate) {
                return new Date(pub.startDate).getTime() > currentTime;
            }
            return false;
        },
        [currentTime]
    );

    /* ── Fetch active publications ── */
    const fetchPublications = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/student-feedback/publications');
            if (res.data.success) {
                const pubs = res.data.data || [];
                setPublications(pubs);
                setStudentInfo(res.data.student || null);

                // Build initial submittedMap from server response and localStorage
                const subMap = {};
                pubs.forEach((pub) => {
                    (pub.submittedSubjects || []).forEach((subjName) => {
                        const key = `${pub.id}_${String(subjName).trim().toLowerCase()}`;
                        subMap[key] = true;
                    });
                    (pub.mappedStaffSubjects || []).forEach((subj) => {
                        const key = `${pub.id}_${String(subj.subjectName).trim().toLowerCase()}`;
                        if (getStoredToken(pub.id, subj.subjectName, subj.facultyName)) {
                            subMap[key] = true;
                        }
                    });
                });
                setSubmittedMap(subMap);

                // Auto-select notification from URL params or default to first/newest session
                if (pubs.length > 0) {
                    const paramPubId = Number(searchParams.get('notificationId') || searchParams.get('pubId')) || (typeof window !== 'undefined' ? Number(new URLSearchParams(window.location.search).get('notificationId') || new URLSearchParams(window.location.search).get('pubId')) : null);

                    if (paramPubId && pubs.some((p) => p.id === paramPubId)) {
                        setSelectedPubId(paramPubId);
                    } else {
                        setSelectedPubId((prev) => (prev && pubs.some((p) => p.id === prev) ? prev : pubs[0].id));
                    }
                }
            } else {
                setError(res.data.message || 'Could not load feedback sessions.');
            }
        } catch (err) {
            console.error('[StudentFeedback] fetch error:', err);
            setError('Unable to connect to the feedback service. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPublications();
    }, [fetchPublications]);

    useEffect(() => {
        const paramPubId = Number(searchParams.get('notificationId') || searchParams.get('pubId'));
        if (paramPubId && publications.some((p) => p.id === paramPubId)) {
            setSelectedPubId(paramPubId);
        }
    }, [searchParams, publications]);

    /* ── Submission check helper ── */
    const isSubmitted = useCallback(
        (pub, subject) => {
            if (!pub || !subject || !subject.subjectName) return false;
            const key = `${pub.id}_${String(subject.subjectName).trim().toLowerCase()}`;
            if (submittedMap[key]) return true;
            return !!getStoredToken(pub.id, subject.subjectName, subject.facultyName);
        },
        [submittedMap]
    );

    /* ── Open form modal ── */
    const handleOpenForm = async (pub, subject) => {
        if (isPubScheduled(pub)) {
            const cd = getCountdownParts(pub.startDate, currentTime);
            const cdStr = cd ? formatCountdownString(cd) : '';
            toast.error(`This feedback session is scheduled and opens on ${formatDateTimeFull(pub.startDate)} (in ${cdStr || 'due time'}).`);
            return;
        }
        if (isSubmitted(pub, subject)) {
            toast.error('Feedback for this subject has already been submitted.');
            return;
        }
        setModalPub(pub);
        setModalSubject(subject);
        setResponses({});
        setFormLoading(true);
        try {
            const res = await api.get(`/student-feedback/forms/${pub.formId}`);
            if (res.data.success) {
                setFormQuestions(res.data.data.questions || []);
            } else {
                toast.error('Could not load the feedback form.');
                setModalPub(null);
            }
        } catch (err) {
            console.error('[StudentFeedback] load form:', err);
            toast.error('Failed to load form questions.');
            setModalPub(null);
        } finally {
            setFormLoading(false);
        }
    };

    const handleCloseModal = () => {
        setModalPub(null);
        setModalSubject(null);
        setFormQuestions([]);
        setResponses({});
    };

    /* ── Submit feedback ── */
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isSubmitted(modalPub, modalSubject)) {
            toast.error('Feedback for this subject has already been submitted.');
            return;
        }

        const missing = formQuestions.filter((q) => q.isRequired && (responses[q.id] === undefined || responses[q.id] === ''));
        if (missing.length > 0) {
            toast.error(`Please answer all required questions (${missing.length} remaining).`);
            return;
        }

        // Build answers payload with standardized shortcut fields
        const answersPayload = { ...responses };
        formQuestions.forEach((q) => {
            const text = (q.questionText || '').toLowerCase();
            const val = responses[q.id];
            if (val === undefined) return;
            if (text.includes('units covered') || text.includes('unit')) answersPayload['unitsCovered'] = String(val);
            if (text.includes('rate') || text.includes('rating')) answersPayload['facultyRating'] = Number(val);
            if (text.includes('unit status') || text.includes('status')) answersPayload['unitStatus'] = String(val);
        });

        try {
            setSubmitting(true);
            const res = await api.post(`/student-feedback/publications/${modalPub.id}/submit`, {
                subjectName: modalSubject.subjectName,
                facultyName: modalSubject.facultyName,
                sectionName: modalSubject.sectionName || studentInfo?.section,
                answers: answersPayload,
            });

            if (res.data.success) {
                storeToken(modalPub.id, modalSubject.subjectName, modalSubject.facultyName, res.data.token);
                const subKey = `${modalPub.id}_${String(modalSubject.subjectName).trim().toLowerCase()}`;
                setSubmittedMap((prev) => ({ ...prev, [subKey]: true }));
                toast.success('Feedback submitted successfully! Thank you.', {
                    icon: '✅',
                    duration: 3500,
                });
                handleCloseModal();
            } else {
                toast.error(res.data.message || 'Submission failed.');
            }
        } catch (err) {
            console.error('[StudentFeedback] submit:', err);
            toast.error(err.response?.data?.message || 'Failed to submit feedback.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    /* ── Compute Per-Notification Statistics ── */
    const pubStats = useMemo(() => {
        const map = {};
        publications.forEach((pub) => {
            const subjects = pub.mappedStaffSubjects || [];
            const total = subjects.length;
            const completed = subjects.filter((s) => isSubmitted(pub, s)).length;
            const pending = total - completed;
            const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
            map[pub.id] = { total, completed, pending, rate };
        });
        return map;
    }, [publications, isSubmitted]);

    /* ── Active (Selected) Notification Session ── */
    const activePub = useMemo(() => {
        if (!publications.length) return null;
        return publications.find((p) => p.id === selectedPubId) || publications[0];
    }, [publications, selectedPubId]);

    /* ── Cards for the Active Notification Session (Zero Duplicates) ── */
    const activeCards = useMemo(() => {
        if (!activePub) return [];
        return (activePub.mappedStaffSubjects || []).map((subject) => ({ pub: activePub, subject }));
    }, [activePub]);

    const activeStats = useMemo(() => {
        if (!activePub) return { total: 0, completed: 0, pending: 0, rate: 0 };
        return pubStats[activePub.id] || { total: 0, completed: 0, pending: 0, rate: 0 };
    }, [activePub, pubStats]);

    const totalCount = activeStats.total;
    const completedCount = activeStats.completed;
    const pendingCount = activeStats.pending;
    const completionPercentage = activeStats.rate;

    /* ── Filter by tab & search query (within active notification) ── */
    const filteredCards = useMemo(() => {
        return activeCards.filter(({ pub, subject }) => {
            const done = isSubmitted(pub, subject);
            if (activeTab === 'pending' && done) return false;
            if (activeTab === 'completed' && !done) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const subj = (subject.subjectName || '').toLowerCase();
                const fac = (subject.facultyName || '').toLowerCase();
                const code = (subject.subjectCode || '').toLowerCase();
                return subj.includes(q) || fac.includes(q) || code.includes(q);
            }
            return true;
        });
    }, [activeCards, activeTab, searchQuery, isSubmitted]);

    /* ── Loading Skeleton State ── */
    if (loading) {
        return (
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-0 sm:px-4 py-1 sm:py-6">
                <div className="bg-surface rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 space-y-4">
                    <div className="hidden sm:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-2">
                            <SkeletonBox height="h-8" width="w-72" className="rounded-xl" />
                            <SkeletonBox height="h-4" width="w-96" />
                        </div>
                        <SkeletonBox height="h-10" width="w-48" className="rounded-xl" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <SkeletonBox height="h-16" className="w-full rounded-xl" />
                        <SkeletonBox height="h-16" className="w-full sm:col-span-2 rounded-xl" />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="bg-surface p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-border space-y-3.5">
                            <div className="flex justify-between items-center">
                                <SkeletonBox height="h-6" width="w-24" className="rounded-md" />
                                <SkeletonBox height="h-6" width="w-16" className="rounded-full" />
                            </div>
                            <SkeletonBox height="h-5" width="w-4/5" />
                            <SkeletonBox height="h-14" className="w-full rounded-xl" />
                            <SkeletonBox height="h-10" className="w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    /* ── Error State ── */
    if (error) {
        return (
            <div className="max-w-2xl mx-auto my-8 sm:my-12 px-2 sm:px-6">
                <div className="bg-surface border border-[var(--danger-light)] rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
                    <div className="w-12 h-12 bg-[var(--danger-light)] text-danger rounded-full flex items-center justify-center mx-auto">
                        <RiAlertLine size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-main text-base sm:text-lg">Unable to Load Feedback</h3>
                        <p className="text-muted-text text-xs sm:text-sm mt-1">{error}</p>
                    </div>
                    <button
                        onClick={fetchPublications}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-xs hover:bg-primary-hover transition-colors shadow-xs"
                    >
                        <RiRefreshLine size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    /* ── Render Course Card ── */
    const renderCourseCard = (pub, subject, idx) => {
        const submitted = isSubmitted(pub, subject);
        const scheduled = isPubScheduled(pub);
        const countdown = scheduled && pub.startDate ? getCountdownParts(pub.startDate, currentTime) : null;
        const countdownStr = countdown ? formatCountdownString(countdown) : '';
        const formattedSubject = toTitleCase(subject.subjectName);
        const formattedFaculty = toTitleCase(subject.facultyName);
        const initials = getInitials(subject.facultyName);

        return (
            <motion.div
                key={`${pub.id}-${subject.subjectName}-${subject.facultyName}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                className={`bg-surface rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                    submitted
                        ? 'border-border opacity-80 hover:opacity-100 hover:border-border-strong'
                        : scheduled
                        ? 'border-[var(--primary-light)] hover:border-[var(--primary-light)] hover:shadow-md'
                        : 'border-border hover:border-[var(--primary-light)] hover:shadow-md'
                }`}
            >
                {/* Card Body */}
                <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                    {/* Badges Row */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {subject.subjectCode && (
                                <span className="px-2 py-0.5 rounded-md bg-[var(--primary-light)] border border-[var(--primary-light)] text-primary font-bold text-[10px] sm:text-[11px] tracking-wide">
                                    {subject.subjectCode}
                                </span>
                            )}
                            {subject.sectionName && (
                                <span className="px-2 py-0.5 rounded-md bg-background text-sub font-bold text-[10px] sm:text-[11px]">
                                    Sec {subject.sectionName}
                                </span>
                            )}
                        </div>

                        {/* Status Badge */}
                        {submitted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                <RiCheckboxCircleFill size={13} />
                                Submitted
                            </span>
                        ) : scheduled ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                <RiTimeLine size={13} className="text-primary" />
                                Scheduled
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                                Pending
                            </span>
                        )}
                    </div>

                    {/* Course Title */}
                    <div>
                        <h3
                            className="text-sm sm:text-base font-bold text-main leading-snug line-clamp-2"
                            title={subject.subjectName}
                        >
                            {formattedSubject}
                        </h3>
                    </div>

                    {/* Faculty Details Cardlet */}
                    <div className="p-2.5 sm:p-3 rounded-xl bg-[var(--background)]/90 border border-border flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-secondary text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-text">Faculty Instructor</p>
                            <p className="text-xs font-bold text-main truncate" title={subject.facultyName}>
                                {formattedFaculty}
                            </p>
                        </div>
                    </div>

                    {/* Due Date specifically matching this publication */}
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-text font-medium">
                        <RiTimeLine size={13} className="text-muted-text shrink-0" />
                        {scheduled ? (
                            <span className="text-primary font-semibold">
                                Opens {formatDateTimeFull(pub.startDate)}
                            </span>
                        ) : (
                            <span>Closes {formatDate(pub.endDate)}</span>
                        )}
                    </div>
                </div>

                {/* Card Footer Button */}
                <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                    {submitted ? (
                        <button
                            type="button"
                            disabled
                            className="w-full py-2.5 px-4 bg-[var(--success-light)] border border-[var(--success-light)] text-success rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-default"
                        >
                            <RiCheckboxCircleFill size={15} />
                            Evaluation Completed
                        </button>
                    ) : scheduled ? (
                        <button
                            type="button"
                            disabled
                            className="w-full py-2.5 px-4 bg-background border border-border text-muted-text rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed shadow-2xs"
                            title={`This feedback session unlocks on ${formatDateTimeFull(pub.startDate)}`}
                        >
                            <RiLockLine size={14} className="text-muted-text" />
                            <span>Opens in {countdownStr || 'Scheduled Time'}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleOpenForm(pub, subject)}
                            className="w-full py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-2 group cursor-pointer"
                        >
                            <span>Give Feedback</span>
                            <RiArrowRightLine size={15} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-6 px-0 sm:px-4 py-1 sm:py-6 text-main">
            {/* ── Top Header & Context Card ─────────────────────────────────── */}
            <div className="bg-surface rounded-xl sm:rounded-2xl border border-border p-3.5 sm:p-6 shadow-xs">
                {/* Desktop/Tablet Header */}
                <div className="hidden sm:flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 pb-5 border-b border-border">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                            <div className="p-2 bg-[var(--primary-light)] text-primary rounded-xl">
                                <RiGraduationCapLine size={24} />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">
                                Academic Feedback
                            </h1>
                            {(() => {
                                const scheduledCount = publications.filter(isPubScheduled).length;
                                const activeCount = publications.length - scheduledCount;
                                if (scheduledCount > 0) {
                                    return (
                                        <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                            <RiTimeLine size={13} className="text-primary" />
                                            {activeCount > 0 ? `${activeCount} Active` : ''}
                                            {activeCount > 0 && scheduledCount > 0 ? ' • ' : ''}
                                            {scheduledCount} Scheduled
                                        </span>
                                    );
                                }
                                return (
                                    <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--success-light)] text-success border border-[var(--success-light)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                        {publications.length > 1 ? `${publications.length} Active Sessions` : 'Active Session'}
                                    </span>
                                );
                            })()}
                        </div>
                        <p className="text-sm text-muted-text max-w-2xl">
                            Evaluate teaching performance and syllabus progress for your assigned faculty.
                            Your feedback is <span className="font-semibold text-sub">100% anonymous</span> and directly helps enhance academic quality.
                        </p>
                    </div>

                    {/* Student Info Pill */}
                    {studentInfo && (
                        <div className="flex flex-wrap items-center gap-2 bg-background border border-border rounded-xl p-2.5 sm:px-4 text-xs font-medium text-sub">
                            <span className="font-bold text-main">{studentInfo.branch || 'Branch'}</span>
                            <span className="text-muted-text">•</span>
                            <span>Sem {studentInfo.semester || '1'}</span>
                            <span className="text-muted-text">•</span>
                            <span className="bg-surface px-2 py-0.5 rounded-md border border-border font-semibold text-sub">
                                Sec {studentInfo.section || 'A'}
                            </span>
                            <span className="text-muted-text">•</span>
                            <span>Batch {studentInfo.batch || '2023'}</span>
                        </div>
                    )}
                </div>

                {/* ── Progress and Stats Bar (Scoped to Active Notification) ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="flex items-center justify-between sm:justify-start gap-4 p-3 bg-[var(--background)]/70 rounded-xl border border-border">
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-muted-text">
                                {publications.length > 1 && viewMode === 'single' ? 'Session Courses' : 'Total Courses'}
                            </p>
                            <p className="text-lg sm:text-xl font-extrabold text-main">{totalCount}</p>
                        </div>
                        <div className="h-7 w-px bg-background hidden sm:block mx-auto" />
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-warning">Pending</p>
                            <p className="text-lg sm:text-xl font-extrabold text-warning">{pendingCount}</p>
                        </div>
                        <div className="h-7 w-px bg-background hidden sm:block mx-auto" />
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-success">Completed</p>
                            <p className="text-lg sm:text-xl font-extrabold text-success">{completedCount}</p>
                        </div>
                    </div>

                    <div className="sm:col-span-2 p-3 bg-[var(--background)]/70 rounded-xl border border-border flex flex-col justify-center">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                            <span className="text-sub flex items-center gap-1.5 text-[11px] sm:text-xs">
                                <RiShieldCheckLine className="text-primary" size={14} />
                                {publications.length > 1 && viewMode === 'single' && activePub
                                    ? `${activePub.title} Progress`
                                    : 'Submission Progress'}
                            </span>
                            <span className="text-primary font-bold text-[11px] sm:text-xs">{completionPercentage}% Completed</span>
                        </div>
                        <div className="w-full bg-background rounded-full h-2 sm:h-2.5 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${completionPercentage}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="bg-primary h-2 sm:h-2.5 rounded-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── NOTIFICATION SESSIONS SWITCHER (NOTIFICATION-WISE SEPARATION) ── */}
            {publications.length > 1 && (
                <div className="bg-surface rounded-xl sm:rounded-2xl border border-[var(--primary-light)] p-3.5 sm:p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-[var(--primary-light)] text-primary rounded-lg">
                                <RiNotification3Line size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-extrabold text-main">
                                        Feedback Notifications
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                        {publications.length} Active Sessions
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-text">
                                    Feedback sessions are organized notification-wise. Select a notification below to complete its evaluations:
                                </p>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex bg-background p-0.5 rounded-lg border border-border self-start sm:self-auto text-xs">
                            <button
                                type="button"
                                onClick={() => setViewMode('single')}
                                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                                    viewMode === 'single'
                                        ? 'bg-surface text-primary shadow-2xs font-bold'
                                        : 'text-sub hover:text-main'
                                }`}
                            >
                                By Notification
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('grouped')}
                                className={`px-2.5 py-1 rounded-md font-semibold text-[11px] transition-all cursor-pointer ${
                                    viewMode === 'grouped'
                                        ? 'bg-surface text-primary shadow-2xs font-bold'
                                        : 'text-sub hover:text-main'
                                }`}
                            >
                                All Grouped
                            </button>
                        </div>
                    </div>

                    {/* Notification Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                        {publications.map((pub, idx) => {
                            const isSelected = selectedPubId === pub.id;
                            const stats = pubStats[pub.id] || { total: 0, completed: 0, pending: 0, rate: 0 };
                            const isAllDone = stats.total > 0 && stats.completed === stats.total;
                            const scheduled = isPubScheduled(pub);
                            const countdown = scheduled && pub.startDate ? getCountdownParts(pub.startDate, currentTime) : null;
                            const countdownStr = countdown ? formatCountdownString(countdown) : '';

                            return (
                                <button
                                    key={pub.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedPubId(pub.id);
                                        setViewMode('single');
                                    }}
                                    className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between relative group cursor-pointer ${
                                        isSelected && viewMode === 'single'
                                            ? scheduled
                                                ? 'border-primary bg-[var(--primary-light)] ring-2 ring-[var(--primary-light)] shadow-xs'
                                                : 'border-primary bg-[var(--primary-light)] ring-2 ring-[var(--primary-light)] shadow-xs'
                                            : 'border-border bg-[var(--background)]/60 hover:bg-surface hover:border-border-strong'
                                    }`}
                                >
                                    <div className="space-y-1.5 w-full">
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider">
                                                Notification #{idx + 1}
                                            </span>
                                            {scheduled ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded-full border border-[var(--primary-light)]">
                                                    <RiTimeLine size={11} className="text-primary animate-spin" style={{ animationDuration: '6s' }} />
                                                    {countdownStr ? `Starts in ${countdownStr}` : 'Scheduled'}
                                                </span>
                                            ) : isAllDone ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success bg-[var(--success-light)] px-2 py-0.5 rounded-full border border-[var(--success-light)]">
                                                    <RiCheckboxCircleFill size={11} /> All Completed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning bg-[var(--warning-light)] px-2 py-0.5 rounded-full border border-[var(--warning-light)]">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                                                    {stats.pending} Pending
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="text-xs sm:text-sm font-bold text-main line-clamp-1 group-hover:text-primary transition-colors">
                                            {pub.title}
                                        </h3>

                                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-text">
                                            <RiTimeLine size={12} className="text-muted-text shrink-0" />
                                            {scheduled ? (
                                                <span className="text-primary font-semibold">
                                                    Opens: {formatDateTimeFull(pub.startDate)}
                                                </span>
                                            ) : (
                                                <span>Active: {formatDate(pub.startDate)} → {formatDate(pub.endDate)}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] sm:text-[11px] w-full">
                                        {scheduled ? (
                                            <span className="text-primary font-semibold flex items-center gap-1">
                                                <RiTimerLine size={12} />
                                                Live Countdown Active
                                            </span>
                                        ) : (
                                            <span className="text-muted-text font-medium">
                                                {stats.completed}/{stats.total} Courses Evaluated
                                            </span>
                                        )}
                                        <span className={`font-bold ${isSelected && viewMode === 'single' ? (scheduled ? 'text-primary' : 'text-primary') : 'text-sub'}`}>
                                            {scheduled ? 'Scheduled' : `${stats.rate}%`}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Active Notification Schedule Banner (Single Mode) ── */}
            {activePub && viewMode === 'single' && (
                isPubScheduled(activePub) ? (() => {
                    const countdown = getCountdownParts(activePub.startDate, currentTime);
                    return (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[var(--sidebar)] to-navy-950 text-white p-5 sm:p-6 shadow-lg border border-primary">
                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                                <div className="space-y-2 max-w-xl">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--warning-light)] text-warning border border-warning">
                                            <RiTimerLine size={14} className="animate-pulse text-warning" />
                                            Scheduled Feedback Session
                                        </span>
                                        {activePub.semester && (
                                            <span className="px-2.5 py-0.5 rounded-md bg-[var(--surface)]/10 text-white/90 text-xs font-semibold">
                                                Semester {activePub.semester}
                                            </span>
                                        )}
                                        {activePub.academicYear && (
                                            <span className="px-2.5 py-0.5 rounded-md bg-[var(--surface)]/10 text-muted-text text-xs">
                                                {activePub.academicYear}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                        {activePub.title}
                                    </h2>
                                    <p className="text-xs sm:text-sm text-primary leading-relaxed">
                                        This feedback evaluation session has been scheduled in advance. You can preview all assigned faculty and subjects below. Feedback forms will unlock automatically when the countdown timer finishes.
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-primary">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <RiCalendarLine size={14} className="text-primary shrink-0" />
                                            <span>Starts: <strong className="text-white font-bold">{formatDateTimeFull(activePub.startDate)}</strong></span>
                                        </span>
                                        <span className="text-muted-text">•</span>
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <RiTimeLine size={14} className="text-primary shrink-0" />
                                            <span>Closes: <strong className="text-warning font-bold">{formatDateTimeFull(activePub.endDate)}</strong></span>
                                        </span>
                                    </div>
                                </div>

                                {/* Live Countdown Boxes */}
                                {countdown ? (
                                    <div className="bg-[var(--surface)]/10 backdrop-blur-md border border-surface rounded-2xl p-4 sm:p-5 text-center shrink-0 w-full sm:w-auto shadow-inner">
                                        <div className="text-[11px] font-extrabold text-warning uppercase tracking-widest mb-3 flex items-center justify-center gap-1.5">
                                            <RiTimerLine size={14} className="animate-spin" style={{ animationDuration: '8s' }} />
                                            Submissions Open In
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center">
                                            <div className="bg-[var(--sidebar)]/60 rounded-xl p-2.5 min-w-[55px] sm:min-w-[64px] border border-surface">
                                                <span className="block text-2xl sm:text-3xl font-black text-white tabular-nums">
                                                    {String(countdown.days).padStart(2, '0')}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-text uppercase tracking-wider">Days</span>
                                            </div>
                                            <div className="bg-[var(--sidebar)]/60 rounded-xl p-2.5 min-w-[55px] sm:min-w-[64px] border border-surface">
                                                <span className="block text-2xl sm:text-3xl font-black text-white tabular-nums">
                                                    {String(countdown.hours).padStart(2, '0')}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-text uppercase tracking-wider">Hours</span>
                                            </div>
                                            <div className="bg-[var(--sidebar)]/60 rounded-xl p-2.5 min-w-[55px] sm:min-w-[64px] border border-surface">
                                                <span className="block text-2xl sm:text-3xl font-black text-white tabular-nums">
                                                    {String(countdown.minutes).padStart(2, '0')}
                                                </span>
                                                <span className="text-[9px] font-bold text-muted-text uppercase tracking-wider">Mins</span>
                                            </div>
                                            <div className="bg-[var(--sidebar)]/60 rounded-xl p-2.5 min-w-[55px] sm:min-w-[64px] border border-surface">
                                                <span className="block text-2xl sm:text-3xl font-black text-warning tabular-nums animate-pulse">
                                                    {String(countdown.seconds).padStart(2, '0')}
                                                </span>
                                                <span className="text-[9px] font-bold text-warning uppercase tracking-wider">Secs</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })() : (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[var(--background)] to-[var(--primary-light)] border border-border rounded-xl px-4 py-2.5 text-xs text-sub shadow-2xs">
                        <div className="flex items-center gap-2">
                            <RiNotification3Line className="text-primary shrink-0" size={16} />
                            <span className="font-semibold text-sub">
                                Active Session: <strong className="text-main font-bold">{activePub.title}</strong>
                            </span>
                            {activePub.semester && (
                                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-surface border border-border text-[10px] font-semibold text-sub">
                                    Sem {activePub.semester}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-text">Validity:</span>
                            <span className="font-semibold text-main">
                                {formatDate(activePub.startDate)} – {formatDate(activePub.endDate)}
                            </span>
                            <span className="text-muted-text">•</span>
                            <span className="text-warning font-bold">
                                Closes {formatDate(activePub.endDate)}
                            </span>
                        </div>
                    </div>
                )
            )}

            {/* ── Search and Filter Controls (Active Notification) ── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                {/* Tabs */}
                <div className="flex bg-[var(--background)]/90 p-1 rounded-xl border border-border w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-surface text-main shadow-xs'
                                : 'text-sub hover:text-main'
                        }`}
                    >
                        All ({totalCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'pending'
                                ? 'bg-surface text-warning shadow-xs'
                                : 'text-sub hover:text-main'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                        Pending ({pendingCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            activeTab === 'completed'
                                ? 'bg-surface text-success shadow-xs'
                                : 'text-sub hover:text-main'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                        Completed ({completedCount})
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                    <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" size={15} />
                    <input
                        type="text"
                        placeholder="Search subject or faculty..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-main placeholder:text-muted-text focus:outline-hidden focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary transition-all shadow-xs"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub p-1 cursor-pointer"
                        >
                            <RiCloseLine size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Empty State ── */}
            {viewMode === 'single' && filteredCards.length === 0 && (
                <div className="bg-surface rounded-xl sm:rounded-2xl border border-border p-8 sm:p-12 text-center max-w-md mx-auto my-4 sm:my-6 shadow-xs">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[var(--primary-light)] text-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <RiMessage2Line size={24} className="sm:w-7 sm:h-7" />
                    </div>
                    <h3 className="font-bold text-main text-sm sm:text-base">
                        {searchQuery ? 'No matching courses found' : 'No Feedback Available'}
                    </h3>
                    <p className="text-muted-text text-xs mt-1">
                        {searchQuery
                            ? `No subject or faculty matches "${searchQuery}". Clear your search to see all.`
                            : activeTab === 'pending'
                            ? 'Great job! You have completed all evaluations for this notification session.'
                            : 'There are no active feedback sessions for your batch and section at this time.'}
                    </p>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-3.5 px-4 py-2 bg-background hover:bg-background text-sub rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            )}

            {/* ── VIEW MODE: GROUPED (ALL NOTIFICATIONS SEPARATED INTO DISTINCT SECTIONS) ── */}
            {viewMode === 'grouped' ? (
                <div className="space-y-6">
                    {publications.map((pub, pIdx) => {
                        const stats = pubStats[pub.id] || { total: 0, completed: 0, pending: 0, rate: 0 };
                        const pubSubjects = (pub.mappedStaffSubjects || []).filter((subject) => {
                            const done = isSubmitted(pub, subject);
                            if (activeTab === 'pending' && done) return false;
                            if (activeTab === 'completed' && !done) return false;
                            if (searchQuery.trim()) {
                                const q = searchQuery.toLowerCase();
                                const subj = (subject.subjectName || '').toLowerCase();
                                const fac = (subject.facultyName || '').toLowerCase();
                                const code = (subject.subjectCode || '').toLowerCase();
                                return subj.includes(q) || fac.includes(q) || code.includes(q);
                            }
                            return true;
                        });

                        return (
                            <div
                                key={pub.id}
                                className="bg-surface rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 space-y-4 shadow-xs"
                            >
                                {/* Notification Group Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-0.5 rounded-md bg-[var(--primary-light)] text-primary font-bold text-[10px] tracking-wide uppercase">
                                                Notification #{pIdx + 1}
                                            </span>
                                            {isPubScheduled(pub) && (
                                                <span className="px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary font-bold text-[10px] flex items-center gap-1">
                                                    <RiTimerLine size={12} /> Scheduled
                                                </span>
                                            )}
                                            <h2 className="text-base sm:text-lg font-extrabold text-main">
                                                {pub.title}
                                            </h2>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-text mt-1">
                                            <span className="flex items-center gap-1 font-medium">
                                                <RiCalendarLine size={13} className="text-muted-text" />
                                                {isPubScheduled(pub)
                                                    ? `Opens: ${formatDateTimeFull(pub.startDate)}`
                                                    : `Active: ${formatDate(pub.startDate)} to ${formatDate(pub.endDate)}`}
                                            </span>
                                            <span className="text-muted-text">•</span>
                                            <span className="font-semibold text-warning">
                                                Closes: {formatDateTimeFull(pub.endDate)}
                                            </span>
                                        </div>
                                    </div>

                                    {isPubScheduled(pub) ? (() => {
                                        const cd = getCountdownParts(pub.startDate, currentTime);
                                        const cdStr = cd ? formatCountdownString(cd) : '';
                                        return (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] text-xs font-bold shadow-2xs">
                                                <RiTimeLine size={13} className="text-primary animate-spin" style={{ animationDuration: '6s' }} />
                                                Opens in {cdStr || 'due time'}
                                            </span>
                                        );
                                    })() : (
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-sub font-semibold">
                                                {stats.completed}/{stats.total} Completed
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] text-xs font-bold">
                                                {stats.rate}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Cards Grid for this publication */}
                                {pubSubjects.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-muted-text">
                                        No courses match your filter for this notification.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                                        {pubSubjects.map((subject, idx) => renderCourseCard(pub, subject, idx))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ── VIEW MODE: SINGLE (ACTIVE NOTIFICATION SESSION - ZERO DUPLICATES) ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                    {filteredCards.map(({ pub, subject }, idx) => renderCourseCard(pub, subject, idx))}
                </div>
            )}

            {/* ── Evaluation Modal ── */}
            <AnimatePresence>
                {modalPub && modalSubject && (
                    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[var(--sidebar)]/50 backdrop-blur-xs"
                            onClick={handleCloseModal}
                        />

                        {/* Modal Dialog */}
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                            className="relative bg-surface w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border"
                        >
                            {/* Modal Header */}
                            <div className="p-4 sm:p-6 border-b border-border flex justify-between items-start gap-4 bg-[var(--background)]/60">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-[var(--primary-light)] text-primary font-bold text-[10px] uppercase tracking-wider">
                                            {modalPub.title || 'Course Evaluation'}
                                        </span>
                                    </div>
                                    <h2 className="text-base sm:text-xl font-extrabold text-main leading-snug truncate">
                                        {toTitleCase(modalSubject.subjectName)}
                                    </h2>
                                    <div className="flex items-center gap-2 text-xs text-muted-text">
                                        <RiUser3Line size={13} className="text-muted-text" />
                                        <span>Instructor: <strong className="font-semibold text-sub">{toTitleCase(modalSubject.facultyName)}</strong></span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="p-1.5 sm:p-2 text-muted-text hover:text-sub hover:bg-surface rounded-xl transition-colors shrink-0 cursor-pointer"
                                >
                                    <RiCloseLine size={20} />
                                </button>
                            </div>

                            {/* Anonymity Notice Banner */}
                            <div className="bg-[var(--primary-light)] border-b border-[var(--primary-light)] px-4 sm:px-6 py-2 sm:py-2.5 flex items-center gap-2 text-[11px] sm:text-xs text-primary">
                                <RiShieldCheckLine size={15} className="text-primary shrink-0" />
                                <span>
                                    <strong>Confidential:</strong> Your identity is never stored with this submission. Faculty only see anonymous responses.
                                </span>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                                {formLoading ? (
                                    <div className="space-y-4 sm:space-y-6 py-4 animate-pulse">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="space-y-2 sm:space-y-3">
                                                <SkeletonBox height="h-4" width="w-2/3" />
                                                <SkeletonBox height="h-10" className="w-full rounded-xl" />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                                        {formQuestions.map((q, idx) => (
                                            <div
                                                key={q.id || idx}
                                                className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-surface border border-border shadow-2xs space-y-2.5 sm:space-y-3 hover:border-border-strong transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <label className="text-xs sm:text-sm font-bold text-main leading-snug">
                                                        <span className="text-primary font-extrabold mr-1.5">
                                                            {idx + 1}.
                                                        </span>
                                                        {q.questionText}
                                                        {q.isRequired && <span className="text-danger ml-1 font-bold">*</span>}
                                                    </label>
                                                </div>

                                                <div className="pt-1">
                                                    <QuestionField
                                                        question={q}
                                                        value={responses[q.id]}
                                                        onChange={(val) => setResponses((prev) => ({ ...prev, [q.id]: val }))}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </form>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-3.5 sm:p-5 border-t border-border flex flex-col-reverse sm:flex-row justify-end items-center gap-2 sm:gap-2.5 bg-[var(--background)]/60">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-muted-text hover:text-main hover:bg-surface transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="feedback-form"
                                    disabled={submitting || formLoading}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-primary hover:bg-primary-hover transition-all shadow-xs hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-surface border-t-surface rounded-full animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RiThumbUpLine size={15} />
                                            <span>Submit Evaluation</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default StudentFeedback;
