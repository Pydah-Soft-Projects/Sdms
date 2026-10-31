import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'react-icons/ri';
import api from '../../config/api';
import toast from 'react-hot-toast';
import { SkeletonBox } from '../../components/SkeletonLoader';

/* ── Helper: Format Title Case ─────────────────────────────────────── */
const toTitleCase = (str) => {
    if (!str) return '';
    // If it's short and uppercase like 'CSE' or 'AI', keep it
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
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20'
                                        : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-slate-50'
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
                                    <RiStarFill size={32} className="text-amber-400 drop-shadow-xs sm:w-9 sm:h-9" />
                                ) : (
                                    <RiStarLine size={32} className="text-slate-300 hover:text-amber-200 sm:w-9 sm:h-9" />
                                )}
                            </button>
                        );
                    })}
                    {value ? (
                        <div className="ml-2 sm:ml-3 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-bold">
                            {value} / {maxValue}
                        </div>
                    ) : null}
                </div>

                {activeScore > 0 && (
                    <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5 transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
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
                    className="w-full p-3 sm:p-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all resize-none text-slate-800 text-xs sm:text-sm placeholder:text-slate-400 leading-relaxed"
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [publications, setPublications] = useState([]);
    const [studentInfo, setStudentInfo] = useState(null);
    const [submittedMap, setSubmittedMap] = useState({});

    // Search and tab filter
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all'); // 'all' | 'pending' | 'completed'

    // Form Modal
    const [modalPub, setModalPub] = useState(null);
    const [modalSubject, setModalSubject] = useState(null);
    const [formQuestions, setFormQuestions] = useState([]);
    const [formLoading, setFormLoading] = useState(false);
    const [responses, setResponses] = useState({});
    const [submitting, setSubmitting] = useState(false);

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

    /* ── Compute cards and filter lists ── */
    const allCards = useMemo(() => {
        return publications.flatMap((pub) =>
            (pub.mappedStaffSubjects || []).map((subject) => ({ pub, subject }))
        );
    }, [publications]);

    const totalCount = allCards.length;
    const completedCount = useMemo(
        () => allCards.filter(({ pub, subject }) => isSubmitted(pub, subject)).length,
        [allCards, isSubmitted]
    );
    const pendingCount = totalCount - completedCount;
    const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Filter by tab & search query
    const filteredCards = useMemo(() => {
        return allCards.filter(({ pub, subject }) => {
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
    }, [allCards, activeTab, searchQuery, isSubmitted]);

    /* ── Loading Skeleton State ── */
    if (loading) {
        return (
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 px-0 sm:px-4 py-1 sm:py-6">
                <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-4 sm:p-6 space-y-4">
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
                        <div key={i} className="bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/80 space-y-3.5">
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
                <div className="bg-white border border-rose-200 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
                    <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
                        <RiAlertLine size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-base sm:text-lg">Unable to Load Feedback</h3>
                        <p className="text-slate-500 text-xs sm:text-sm mt-1">{error}</p>
                    </div>
                    <button
                        onClick={fetchPublications}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-xs hover:bg-indigo-700 transition-colors shadow-xs"
                    >
                        <RiRefreshLine size={16} /> Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-6 px-0 sm:px-4 py-1 sm:py-6 text-slate-800">
            {/* ── Top Header & Context Card ─────────────────────────────────── */}
            <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-3.5 sm:p-6 shadow-xs">
                {/* Desktop/Tablet Header: Hidden on Mobile per request */}
                <div className="hidden sm:flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 pb-5 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                                <RiGraduationCapLine size={24} />
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                Academic Feedback
                            </h1>
                            <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active Session
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 max-w-2xl">
                            Evaluate teaching performance and syllabus progress for your assigned faculty.
                            Your feedback is <span className="font-semibold text-slate-700">100% anonymous</span> and directly helps enhance academic quality.
                        </p>
                    </div>

                    {/* Student Info Pill */}
                    {studentInfo && (
                        <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:px-4 text-xs font-medium text-slate-600">
                            <span className="font-bold text-slate-800">{studentInfo.branch || 'Branch'}</span>
                            <span className="text-slate-300">•</span>
                            <span>Sem {studentInfo.semester || '1'}</span>
                            <span className="text-slate-300">•</span>
                            <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-semibold text-slate-700">
                                Sec {studentInfo.section || 'A'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>Batch {studentInfo.batch || '2023'}</span>
                        </div>
                    )}
                </div>

                {/* ── Progress and Stats Bar ───────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="flex items-center justify-between sm:justify-start gap-4 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Courses</p>
                            <p className="text-lg sm:text-xl font-extrabold text-slate-800">{totalCount}</p>
                        </div>
                        <div className="h-7 w-px bg-slate-200 hidden sm:block mx-auto" />
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending</p>
                            <p className="text-lg sm:text-xl font-extrabold text-amber-700">{pendingCount}</p>
                        </div>
                        <div className="h-7 w-px bg-slate-200 hidden sm:block mx-auto" />
                        <div className="text-left">
                            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600">Completed</p>
                            <p className="text-lg sm:text-xl font-extrabold text-emerald-700">{completedCount}</p>
                        </div>
                    </div>

                    <div className="sm:col-span-2 p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex flex-col justify-center">
                        <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                            <span className="text-slate-600 flex items-center gap-1.5 text-[11px] sm:text-xs">
                                <RiShieldCheckLine className="text-indigo-600" size={14} />
                                Submission Progress
                            </span>
                            <span className="text-indigo-600 font-bold text-[11px] sm:text-xs">{completionPercentage}% Completed</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 sm:h-2.5 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${completionPercentage}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="bg-indigo-600 h-2 sm:h-2.5 rounded-full"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Search and Filter Controls ─────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
                {/* Tabs */}
                <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`flex-1 sm:flex-initial text-center px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            activeTab === 'all'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        All ({totalCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('pending')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'pending'
                                ? 'bg-white text-amber-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        Pending ({pendingCount})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('completed')}
                        className={`flex-1 sm:flex-initial text-center px-2.5 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'completed'
                                ? 'bg-white text-emerald-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        Completed ({completedCount})
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                    <RiSearchLine className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search subject or faculty..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                            <RiCloseLine size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Empty State ──────────────────────────────────────────────── */}
            {filteredCards.length === 0 && (
                <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center max-w-md mx-auto my-4 sm:my-6 shadow-xs">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <RiMessage2Line size={24} className="sm:w-7 sm:h-7" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                        {searchQuery ? 'No matching courses found' : 'No Feedback Available'}
                    </h3>
                    <p className="text-slate-500 text-xs mt-1">
                        {searchQuery
                            ? `No subject or faculty matches "${searchQuery}". Clear your search to see all.`
                            : activeTab === 'pending'
                            ? 'Great job! You have completed all pending feedback submissions.'
                            : 'There are no active feedback sessions for your batch and section at this time.'}
                    </p>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-3.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                        >
                            Clear Search
                        </button>
                    )}
                </div>
            )}

            {/* ── Cards Grid ───────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                {filteredCards.map(({ pub, subject }, idx) => {
                    const submitted = isSubmitted(pub, subject);
                    const formattedSubject = toTitleCase(subject.subjectName);
                    const formattedFaculty = toTitleCase(subject.facultyName);
                    const initials = getInitials(subject.facultyName);

                    return (
                        <motion.div
                            key={`${pub.id}-${subject.subjectName}-${subject.facultyName}`}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03, duration: 0.25 }}
                            className={`bg-white rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden relative ${
                                submitted
                                    ? 'border-slate-200/70 opacity-80 hover:opacity-100 hover:border-slate-300'
                                    : 'border-slate-200/90 hover:border-indigo-300 hover:shadow-md'
                            }`}
                        >
                            {/* Card Body */}
                            <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
                                {/* Badges Row */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {subject.subjectCode && (
                                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100/80 text-indigo-700 font-bold text-[10px] sm:text-[11px] tracking-wide">
                                                {subject.subjectCode}
                                            </span>
                                        )}
                                        {subject.sectionName && (
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold text-[10px] sm:text-[11px]">
                                                Sec {subject.sectionName}
                                            </span>
                                        )}
                                    </div>

                                    {/* Status Badge */}
                                    {submitted ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                            <RiCheckboxCircleFill size={13} />
                                            Submitted
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            Pending
                                        </span>
                                    )}
                                </div>

                                {/* Course Title */}
                                <div>
                                    <h3
                                        className="text-sm sm:text-base font-bold text-slate-900 leading-snug line-clamp-2"
                                        title={subject.subjectName}
                                    >
                                        {formattedSubject}
                                    </h3>
                                </div>

                                {/* Faculty Details Cardlet */}
                                <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/90 border border-slate-100 flex items-center gap-2.5 sm:gap-3">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">Faculty Instructor</p>
                                        <p className="text-xs font-bold text-slate-800 truncate" title={subject.facultyName}>
                                            {formattedFaculty}
                                        </p>
                                    </div>
                                </div>

                                {/* Due Date */}
                                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-400 font-medium">
                                    <RiTimeLine size={13} className="text-slate-400 shrink-0" />
                                    <span>Closes {formatDate(pub.endDate)}</span>
                                </div>
                            </div>

                            {/* Card Footer Button */}
                            <div className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
                                {submitted ? (
                                    <button
                                        type="button"
                                        disabled
                                        className="w-full py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-default"
                                    >
                                        <RiCheckboxCircleFill size={15} />
                                        Evaluation Completed
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleOpenForm(pub, subject)}
                                        className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm flex items-center justify-center gap-2 group cursor-pointer"
                                    >
                                        <span>Give Feedback</span>
                                        <RiArrowRightLine size={15} className="group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Evaluation Modal ─────────────────────────────────────────── */}
            <AnimatePresence>
                {modalPub && modalSubject && (
                    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
                            onClick={handleCloseModal}
                        />

                        {/* Modal Dialog */}
                        <motion.div
                            initial={{ scale: 0.96, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.96, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
                            className="relative bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80"
                        >
                            {/* Modal Header */}
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-start gap-4 bg-slate-50/60">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-700 font-bold text-[10px] uppercase tracking-wider">
                                            {modalPub.title || 'Course Evaluation'}
                                        </span>
                                    </div>
                                    <h2 className="text-base sm:text-xl font-extrabold text-slate-900 leading-snug truncate">
                                        {toTitleCase(modalSubject.subjectName)}
                                    </h2>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <RiUser3Line size={13} className="text-slate-400" />
                                        <span>Instructor: <strong className="font-semibold text-slate-700">{toTitleCase(modalSubject.facultyName)}</strong></span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors shrink-0"
                                >
                                    <RiCloseLine size={20} />
                                </button>
                            </div>

                            {/* Anonymity Notice Banner */}
                            <div className="bg-indigo-50/60 border-b border-indigo-100/60 px-4 sm:px-6 py-2 sm:py-2.5 flex items-center gap-2 text-[11px] sm:text-xs text-indigo-900">
                                <RiShieldCheckLine size={15} className="text-indigo-600 shrink-0" />
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
                                                className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5 sm:space-y-3 hover:border-slate-300 transition-colors"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <label className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                                                        <span className="text-indigo-600 font-extrabold mr-1.5">
                                                            {idx + 1}.
                                                        </span>
                                                        {q.questionText}
                                                        {q.isRequired && <span className="text-rose-500 ml-1 font-bold">*</span>}
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
                            <div className="p-3.5 sm:p-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end items-center gap-2 sm:gap-2.5 bg-slate-50/60">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-slate-500 hover:text-slate-800 hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    form="feedback-form"
                                    disabled={submitting || formLoading}
                                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {submitting ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
