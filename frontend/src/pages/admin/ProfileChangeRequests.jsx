import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Search,
    Eye,
    Check,
    X,
    Clock,
    User,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    Building2,
    GraduationCap,
    RotateCw,
    Filter,
    ArrowRight,
    CheckCircle2,
    XCircle,
    BookOpen,
    Layers,
    Sparkles,
    UserCheck
} from 'lucide-react';
import api, { getStaticFileUrl } from '../../config/api';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { isFullAccessRole, hasPermission, BACKEND_MODULES } from '../../constants/rbac';

export const ProfileChangeRequests = () => {
    const { user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();

    const canManageRequests = useMemo(() => {
        if (!user) return false;
        if (isFullAccessRole(user.role)) return true;
        return hasPermission(user.permissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'edit_profile_requests');
    }, [user]);

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'pending');
    const [collegeFilter, setCollegeFilter] = useState(() => searchParams.get('college') || '');
    const [courseFilter, setCourseFilter] = useState(() => searchParams.get('course') || '');
    const [branchFilter, setBranchFilter] = useState(() => searchParams.get('branch') || '');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [reviewComments, setReviewComments] = useState('');
    const [studentOriginalData, setStudentOriginalData] = useState({});
    const [filterOptions, setFilterOptions] = useState({ courses: [], branches: [] });
    const [coursesWithBranches, setCoursesWithBranches] = useState([]);

    // College-wise abstract stats
    const [abstractData, setAbstractData] = useState(null);
    const [abstractLoading, setAbstractLoading] = useState(false);

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [pagination, setPagination] = useState({
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1
    });

    const getPhotoSrc = (photo) => {
        if (!photo || typeof photo !== 'string') return null;
        const trimmed = photo.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith('data:image/') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            return trimmed;
        }
        return getStaticFileUrl(trimmed);
    };


    // Sync searchParams if URL changes externally
    useEffect(() => {
        const urlStatus = searchParams.get('status');
        const urlCollege = searchParams.get('college');
        const urlCourse = searchParams.get('course');
        const urlBranch = searchParams.get('branch');

        if (urlStatus && urlStatus !== statusFilter) setStatusFilter(urlStatus);
        if (urlCollege !== null && urlCollege !== collegeFilter) setCollegeFilter(urlCollege);
        if (urlCourse !== null && urlCourse !== courseFilter) setCourseFilter(urlCourse);
        if (urlBranch !== null && urlBranch !== branchFilter) setBranchFilter(urlBranch);
    }, [searchParams]);

    // Keep URL in sync with active filters
    const updateFilters = (newFilters) => {
        const updated = {
            status: statusFilter,
            college: collegeFilter,
            course: courseFilter,
            branch: branchFilter,
            ...newFilters
        };
        const params = new URLSearchParams();
        if (updated.status && updated.status !== 'all') params.set('status', updated.status);
        if (updated.college) params.set('college', updated.college);
        if (updated.course) params.set('course', updated.course);
        if (updated.branch) params.set('branch', updated.branch);
        setSearchParams(params, { replace: true });
    };

    const fetchCollegeAbstract = async () => {
        try {
            setAbstractLoading(true);
            const res = await api.get('/profile-changes/college-abstract');
            if (res.data?.success) {
                setAbstractData(res.data);
            }
        } catch (err) {
            console.warn('Failed to fetch college abstract:', err);
        } finally {
            setAbstractLoading(false);
        }
    };

    useEffect(() => {
        fetchCollegeAbstract();
    }, []);

    // Load general filter meta and cascade by college
    useEffect(() => {
        const updateCascadeOptions = async () => {
            try {
                const params = new URLSearchParams({ applyExclusions: 'true' });
                if (collegeFilter) params.append('college', collegeFilter);
                if (courseFilter) params.append('course', courseFilter);
                const res = await api.get(`/students/quick-filters?${params.toString()}`);
                if (res.data?.success) {
                    const d = res.data.data || {};
                    setFilterOptions({
                        courses: d.courses || [],
                        branches: d.branches || []
                    });
                }
            } catch (err) {
                console.warn('Failed to update filter options:', err);
            }
        };
        updateCascadeOptions();
    }, [collegeFilter, courseFilter]);

    useEffect(() => {
        const loadInitialMeta = async () => {
            try {
                const res = await api.get('/courses?includeInactive=false');
                if (res.data?.success) {
                    setCoursesWithBranches(res.data.data || []);
                }
            } catch (err) {
                console.warn('Failed to load courses metadata:', err);
            }
        };
        loadInitialMeta();
    }, []);

    const collegesList = useMemo(() => {
        return abstractData?.colleges || abstractData?.data?.colleges || [];
    }, [abstractData]);

    // 🎯 COURSES: Strictly auto-filtered based on selected college
    const availableCourses = useMemo(() => {
        if (collegeFilter) {
            const colObj = collegesList.find(c =>
                (c.college || '').trim().toLowerCase() === collegeFilter.trim().toLowerCase()
            );
            if (colObj?.programs?.length) {
                const list = colObj.programs.map(p => ({
                    name: p.course,
                    pending: p.pending,
                    total: p.total
                }));
                if (courseFilter && !list.some(c => c.name.toLowerCase() === courseFilter.toLowerCase())) {
                    list.unshift({ name: courseFilter, pending: 0, total: 0 });
                }
                return list;
            }
            if (courseFilter) {
                return [{ name: courseFilter, pending: 0, total: 0 }];
            }
            return [];
        }

        // When "All Colleges" is selected, aggregate all courses across colleges with total pending counts
        if (collegesList.length) {
            const courseMap = new Map();
            collegesList.forEach(col => {
                (col.programs || []).forEach(p => {
                    if (!courseMap.has(p.course)) {
                        courseMap.set(p.course, { name: p.course, pending: 0, total: 0 });
                    }
                    const item = courseMap.get(p.course);
                    item.pending += (p.pending || 0);
                    item.total += (p.total || 0);
                });
            });
            if (courseMap.size > 0) {
                return Array.from(courseMap.values()).sort((a, b) => (b.pending - a.pending) || a.name.localeCompare(b.name));
            }
        }

        return [];
    }, [collegeFilter, collegesList, courseFilter]);

    // 🎯 BRANCHES: Auto-filtered based on selected course and college
    const availableBranches = useMemo(() => {
        if (!courseFilter) return [];

        if (collegeFilter) {
            const colObj = collegesList.find(c =>
                (c.college || '').trim().toLowerCase() === collegeFilter.trim().toLowerCase()
            );
            const prog = colObj?.programs?.find(p => (p.course || '').trim().toLowerCase() === courseFilter.trim().toLowerCase());
            if (prog?.branches?.length) {
                const list = prog.branches.map(b => ({
                    name: b.branch,
                    pending: b.pending,
                    total: b.total
                }));
                if (branchFilter && !list.some(b => b.name.toLowerCase() === branchFilter.toLowerCase())) {
                    list.unshift({ name: branchFilter, pending: 0, total: 0 });
                }
                return list;
            }
            if (branchFilter) {
                return [{ name: branchFilter, pending: 0, total: 0 }];
            }
            return [];
        } else if (collegesList.length) {
            const branchMap = new Map();
            collegesList.forEach(col => {
                const prog = (col.programs || []).find(p => (p.course || '').trim().toLowerCase() === courseFilter.trim().toLowerCase());
                if (prog?.branches) {
                    prog.branches.forEach(b => {
                        if (!branchMap.has(b.branch)) {
                            branchMap.set(b.branch, { name: b.branch, pending: 0, total: 0 });
                        }
                        const item = branchMap.get(b.branch);
                        item.pending += (b.pending || 0);
                        item.total += (b.total || 0);
                    });
                }
            });
            if (branchMap.size > 0) {
                return Array.from(branchMap.values()).sort((a, b) => (b.pending - a.pending) || a.name.localeCompare(b.name));
            }
        }

        return [];
    }, [collegeFilter, courseFilter, collegesList, branchFilter]);

    // Auto-clean incompatible course and branch when college changes
    const handleCollegeChange = (value) => {
        setCollegeFilter(value);
        if (value) {
            const colObj = collegesList.find(c => (c.college || '').trim().toLowerCase() === value.trim().toLowerCase());
            const validPrograms = (colObj?.programs || []).map(p => (p.course || '').toLowerCase());
            if (courseFilter && validPrograms.length > 0 && !validPrograms.includes(courseFilter.toLowerCase())) {
                setCourseFilter('');
                setBranchFilter('');
                updateFilters({ college: value, course: '', branch: '' });
                return;
            }
        }
        updateFilters({ college: value });
    };

    const handleCourseChange = (value) => {
        setCourseFilter(value);
        setBranchFilter('');
        updateFilters({ course: value, branch: '' });
    };

    const handleBranchChange = (value) => {
        setBranchFilter(value);
        updateFilters({ branch: value });
    };

    const handleStatusChange = (status) => {
        setStatusFilter(status);
        updateFilters({ status });
    };

    const handleResetAllFilters = () => {
        setCollegeFilter('');
        setCourseFilter('');
        setBranchFilter('');
        setStatusFilter('pending');
        setSearchTerm('');
        setSearchParams(new URLSearchParams({ status: 'pending' }), { replace: true });
    };

    const fetchRequests = async (overridePage, overridePageSize) => {
        try {
            setLoading(true);
            const pPage = overridePage ?? currentPage;
            const pLimit = overridePageSize ?? pageSize;
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (collegeFilter) params.append('college', collegeFilter);
            if (courseFilter) params.append('course', courseFilter);
            if (branchFilter) params.append('branch', branchFilter);
            if (searchTerm.trim()) params.append('search', searchTerm.trim());
            params.append('page', pPage.toString());
            params.append('limit', pLimit.toString());

            const query = params.toString() ? `?${params.toString()}` : '';
            const res = await api.get(`/profile-changes/all${query}`);
            if (res.data?.success) {
                setRequests(res.data.data || []);
                if (res.data.pagination) {
                    setPagination(res.data.pagination);
                }
            } else {
                toast.error('Failed to fetch requests');
            }
        } catch (error) {
            console.error('Error fetching requests', error);
            toast.error('Failed to fetch requests');
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        fetchRequests(newPage, pageSize);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(1);
        fetchRequests(1, newSize);
    };

    // Filter changes reset to page 1
    useEffect(() => {
        setCurrentPage(1);
        fetchRequests(1, pageSize);
    }, [statusFilter, collegeFilter, courseFilter, branchFilter]);

    // Search query with debounce resets to page 1
    useEffect(() => {
        const timer = setTimeout(() => {
            setCurrentPage(1);
            fetchRequests(1, pageSize);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const handleReview = async (status) => {
        if (!selectedRequest) return;

        try {
            const res = await api.put(`/profile-changes/${selectedRequest.id}/status`, {
                status,
                comments: reviewComments
            });

            if (res.data?.success) {
                toast.success(`Request ${status} successfully`);
                setSelectedRequest(null);
                setReviewComments('');
                fetchRequests();
                fetchCollegeAbstract();
            } else {
                toast.error(res.data?.message || `Failed to ${status} request`);
            }
        } catch (error) {
            console.error('Error updating request', error);
            toast.error(error.response?.data?.message || `Failed to ${status} request`);
        }
    };

    const parseChanges = (changes) => {
        if (typeof changes === 'string') {
            try { return JSON.parse(changes); }
            catch { return {}; }
        }
        return changes || {};
    };

    // Backend filters and paginates records; display current page slice
    const filteredRequests = requests;

    const formatKey = (key) => {
        return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

        // 🎯 Dynamically computed counts based on active college / course / branch filters
    const activeFilterSummary = useMemo(() => {
        const globalSummary = abstractData?.summary || abstractData?.data?.summary || {
            pending: 0,
            approved: 0,
            rejected: 0,
            total: 0
        };

        if (collegeFilter) {
            const colObj = (collegesList || []).find(c =>
                (c.college || '').trim().toLowerCase() === collegeFilter.trim().toLowerCase()
            );
            if (colObj) {
                if (courseFilter) {
                    const prog = (colObj.programs || []).find(p =>
                        (p.course || '').trim().toLowerCase() === courseFilter.trim().toLowerCase()
                    );
                    if (prog) {
                        if (branchFilter) {
                            const br = (prog.branches || []).find(b =>
                                (b.branch || '').trim().toLowerCase() === branchFilter.trim().toLowerCase()
                            );
                            if (br) {
                                return {
                                    pending: br.pending || 0,
                                    approved: br.approved || 0,
                                    rejected: br.rejected || 0,
                                    total: br.total || 0,
                                    isFiltered: true
                                };
                            }
                        }
                        return {
                            pending: prog.pending || 0,
                            approved: prog.approved || 0,
                            rejected: prog.rejected || 0,
                            total: prog.total || 0,
                            isFiltered: true
                        };
                    }
                }
                return {
                    pending: colObj.pending || 0,
                    approved: colObj.approved || 0,
                    rejected: colObj.rejected || 0,
                    total: colObj.total || 0,
                    isFiltered: true
                };
            }
        } else if (courseFilter) {
            let pending = 0, approved = 0, rejected = 0, total = 0;
            (collegesList || []).forEach(col => {
                const prog = (col.programs || []).find(p =>
                    (p.course || '').trim().toLowerCase() === courseFilter.trim().toLowerCase()
                );
                if (prog) {
                    pending += (prog.pending || 0);
                    approved += (prog.approved || 0);
                    rejected += (prog.rejected || 0);
                    total += (prog.total || 0);
                }
            });
            return { pending, approved, rejected, total, isFiltered: true };
        }

        return { ...globalSummary, isFiltered: false };
    }, [abstractData, collegesList, collegeFilter, courseFilter, branchFilter]);

    const hasActiveFilters = Boolean(collegeFilter || courseFilter || branchFilter || statusFilter !== 'pending' || searchTerm);
    const tableColSpan = (statusFilter === 'approved' || statusFilter === 'rejected') ? 8 : statusFilter === 'all' ? 7 : 6;

    return (
        <div className="space-y-6 pb-12">
            {/* 1. Header Banner with Live Stats & Light Executive Colors */}
            <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-border shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-primary to-primary flex items-center justify-center text-white shadow-sm shadow-primary shrink-0">
                        <Layers size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl font-bold text-main tracking-tight">Profile Change Requests</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                {(abstractData?.summary?.pending ?? 0).toLocaleString()} Pending
                            </span>
                        </div>
                        <p className="text-xs text-muted-text mt-0.5">
                            Review, verify, and approve student profile update requests across all colleges
                        </p>
                    </div>
                </div>

                {/* College-Wise Stats Mini-Cards & Refresh Button in Header */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
                    <button
                        type="button"
                        onClick={() => handleCollegeChange('')}
                        title={`All Colleges: ${(abstractData?.summary?.pending ?? 0).toLocaleString()} pending`}
                        className={`px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer min-w-[65px] ${
                            !collegeFilter
                                ? 'bg-[var(--primary-light)] border-[var(--primary-light)] ring-2 ring-[var(--primary-light)] shadow-2xs'
                                : 'bg-surface border-border hover:bg-background text-sub'
                        }`}
                    >
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${!collegeFilter ? 'text-primary' : 'text-muted-text'}`}>
                            All
                        </span>
                        <span className={`text-sm font-black ${!collegeFilter ? 'text-primary' : 'text-sub'}`}>
                            {(abstractData?.summary?.pending ?? 0).toLocaleString()}
                        </span>
                    </button>

                    {collegesList.map((c) => {
                        const isSelected = (collegeFilter || '').trim().toLowerCase() === (c.college || '').trim().toLowerCase();
                        const shortName = c.college
                            .replace(/^Pydah\s+/i, '')
                            .replace(/College of\s+/i, '')
                            .replace(/Polytechnic of\s+/i, '')
                            .replace(/Polytechnic/i, 'Poly');

                        return (
                            <button
                                key={c.college}
                                type="button"
                                onClick={() => handleCollegeChange(isSelected ? '' : c.college)}
                                title={`${c.college}: ${c.pending.toLocaleString()} pending • ${c.total.toLocaleString()} total`}
                                className={`px-2.5 py-1.5 rounded-xl border text-center transition-all cursor-pointer min-w-[75px] max-w-[125px] ${
                                    isSelected
                                        ? 'bg-[var(--primary-light)] border-primary ring-2 ring-[var(--primary-light)] shadow-2xs'
                                        : 'bg-surface border-border hover:border-border-strong hover:bg-[var(--background)]/80 text-sub'
                                }`}
                            >
                                <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${
                                    isSelected ? 'text-primary' : 'text-muted-text'
                                }`}>
                                    {shortName}
                                </span>
                                <span className={`text-sm font-black ${
                                    isSelected
                                        ? 'text-primary'
                                        : c.pending > 0
                                            ? 'text-warning'
                                            : 'text-muted-text'
                                }`}>
                                    {c.pending.toLocaleString()}
                                </span>
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        onClick={() => {
                            fetchRequests();
                            fetchCollegeAbstract();
                            toast.success('Refreshed data');
                        }}
                        disabled={loading || abstractLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-xs font-semibold text-sub hover:bg-background hover:border-border-strong transition-colors shadow-2xs cursor-pointer disabled:opacity-60 ml-1 self-center"
                        title="Reload requests and statistics"
                    >
                        <RotateCw size={14} className={loading || abstractLoading ? 'animate-spin text-primary' : 'text-muted-text'} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>
            </div>

            {/* 3. Filters & Controls */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-3">
                {/* Search & Status Tabs */}
                <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-text" size={17} />
                        <input
                            type="text"
                            placeholder="Search by student name, PIN, admission number, reviewer, course, branch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-xs sm:text-sm bg-[var(--background)]/40 focus:bg-surface"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub p-0.5 rounded cursor-pointer"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {/* Status Tabs */}
                    <div className="inline-flex p-1 bg-[var(--background)]/90 rounded-xl shrink-0 overflow-x-auto">
                        {[
                            { id: 'pending', label: 'Pending', count: activeFilterSummary.pending, totalCount: abstractData?.summary?.pending },
                            { id: 'approved', label: 'Approved', count: activeFilterSummary.approved, totalCount: abstractData?.summary?.approved },
                            { id: 'rejected', label: 'Rejected', count: activeFilterSummary.rejected, totalCount: abstractData?.summary?.rejected },
                            { id: 'all', label: 'All Requests', count: activeFilterSummary.total, totalCount: abstractData?.summary?.total },
                        ].map((tab) => {
                            const isActive = statusFilter === tab.id;
                            const isFiltered = activeFilterSummary.isFiltered && tab.count !== tab.totalCount;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleStatusChange(tab.id)}
                                    title={isFiltered ? `${tab.count} matching in this selection (${(tab.totalCount || 0).toLocaleString()} across all colleges)` : `${(tab.count || 0).toLocaleString()} total`}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                        isActive
                                            ? 'bg-surface text-primary shadow-xs'
                                            : 'text-sub hover:text-main hover:bg-[var(--background)]/50'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    {tab.count !== undefined && (
                                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                            isActive
                                                ? 'bg-[var(--primary-light)] text-primary'
                                                : 'bg-background text-sub'
                                        }`}>
                                            {tab.count.toLocaleString()}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Cascading Filter Selectors: College -> Course -> Branch */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-border">
                    {/* 1. College Selector */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-sub flex items-center gap-1.5">
                                <Building2 size={13} className="text-primary" />
                                <span>College</span>
                            </label>
                            <span className="text-[10px] text-muted-text font-medium">
                                {abstractData?.colleges?.length || 0} colleges
                            </span>
                        </div>
                        <select
                            value={collegeFilter}
                            onChange={(e) => handleCollegeChange(e.target.value)}
                            className="w-full rounded-xl border border-border px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface cursor-pointer"
                        >
                            <option value="">All Colleges ({collegesList.length || 7}) - {((abstractData?.summary?.pending ?? 0)).toLocaleString()} pending</option>
                            {collegesList.map((c) => (
                                <option key={c.college} value={c.college}>
                                    {c.college} ({c.pending} pending • {c.total} total)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Course / Program Selector (Auto-Filtered by College) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-sub flex items-center gap-1.5">
                                <GraduationCap size={14} className="text-primary" />
                                <span>Course / Program</span>
                            </label>
                            <span className="text-[10px] font-semibold text-primary">
                                {collegeFilter
                                    ? `${availableCourses.length} in this college`
                                    : `${availableCourses.length} total`}
                            </span>
                        </div>
                        <select
                            value={courseFilter}
                            onChange={(e) => handleCourseChange(e.target.value)}
                            className="w-full rounded-xl border border-border px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface cursor-pointer"
                        >
                            <option value="">
                                {collegeFilter
                                    ? `All Programs in ${collegeFilter.split(' ')[0]}...`
                                    : 'All Courses / Programs'}
                            </option>
                            {availableCourses.map((course) => (
                                <option key={course.name} value={course.name}>
                                    {course.name} {course.pending ? `(${course.pending} pending)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Branch Selector (Auto-Filtered by Course & College) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-sub flex items-center gap-1.5">
                                <BookOpen size={13} className="text-primary" />
                                <span>Branch / Department</span>
                            </label>
                            <span className="text-[10px] text-muted-text font-medium">
                                {courseFilter ? `${availableBranches.length} branches` : 'Select a course first'}
                            </span>
                        </div>
                        <select
                            value={branchFilter}
                            onChange={(e) => handleBranchChange(e.target.value)}
                            disabled={!courseFilter && availableBranches.length === 0}
                            className="w-full rounded-xl border border-border px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface cursor-pointer disabled:bg-background disabled:text-muted-text disabled:cursor-not-allowed"
                        >
                            <option value="">
                                {!courseFilter ? 'Select Course to view branches' : 'All Branches'}
                            </option>
                            {availableBranches.map((branch) => (
                                <option key={branch.name} value={branch.name}>
                                    {branch.name} {branch.pending ? `(${branch.pending} pending)` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Active Filter Pills Bar */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
                        <span className="text-muted-text font-medium text-[11px]">Active Filters:</span>
                        {collegeFilter && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] font-semibold text-[11px]">
                                <Building2 size={11} />
                                <span className="max-w-[200px] truncate">{collegeFilter}</span>
                                <button type="button" onClick={() => handleCollegeChange('')} className="hover:text-primary cursor-pointer ml-0.5">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {courseFilter && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-secondary border border-[var(--primary-light)] font-semibold text-[11px]">
                                <GraduationCap size={11} />
                                <span>{courseFilter}</span>
                                <button type="button" onClick={() => handleCourseChange('')} className="hover:text-secondary cursor-pointer ml-0.5">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {branchFilter && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] font-semibold text-[11px]">
                                <span>Branch: {branchFilter}</span>
                                <button type="button" onClick={() => handleBranchChange('')} className="hover:text-primary cursor-pointer ml-0.5">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {statusFilter !== 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background text-sub font-semibold text-[11px] capitalize">
                                <span>Status: {statusFilter}</span>
                                <button type="button" onClick={() => handleStatusChange('pending')} className="hover:text-main cursor-pointer ml-0.5">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        {searchTerm && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] font-semibold text-[11px]">
                                <span>Search: "{searchTerm}"</span>
                                <button type="button" onClick={() => setSearchTerm('')} className="hover:text-warning cursor-pointer ml-0.5">
                                    <X size={12} />
                                </button>
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleResetAllFilters}
                            className="ml-auto text-xs font-semibold text-danger hover:text-danger hover:underline cursor-pointer"
                        >
                            Reset All Filters
                        </button>
                    </div>
                )}
            </div>

            {/* 4. Requests Table */}
            <div className="bg-surface rounded-2xl shadow-xs border border-border overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border bg-[var(--background)]/50 flex items-center justify-between">
                    <p className="text-xs font-bold text-sub uppercase tracking-wider">
                        Requests List ({(pagination.total || requests.length).toLocaleString()} matching)
                    </p>
                    <span className="text-xs text-muted-text">
                        {statusFilter === 'all' ? 'All statuses' : `Showing ${statusFilter} only`}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border">
                        <thead className="bg-[var(--background)]/80 sticky top-0 z-10">
                            <tr className="border-b border-border">
                                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Student Details</th>
                                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">College & Program</th>
                                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Requested Changes</th>
                                <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Submitted</th>
                                {statusFilter === 'approved' && (
                                    <>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Approved Time</th>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Approved By</th>
                                    </>
                                )}
                                {statusFilter === 'rejected' && (
                                    <>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Rejected Time</th>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Rejected By</th>
                                    </>
                                )}
                                {statusFilter === 'all' && (
                                    <th className="px-3.5 py-2.5 text-left text-[11px] font-bold text-muted-text uppercase tracking-wider">Review Details</th>
                                )}
                                <th className="px-3 py-2.5 text-center text-[11px] font-bold text-muted-text uppercase tracking-wider">Status</th>
                                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold text-muted-text uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-6 py-16 text-center text-muted-text">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                                        <p className="text-xs font-semibold text-sub">Loading student requests...</p>
                                    </td>
                                </tr>
                            ) : filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={tableColSpan} className="px-6 py-16 text-center text-muted-text">
                                        <div className="bg-background rounded-2xl w-14 h-14 flex items-center justify-center mx-auto mb-3 border border-border">
                                            <AlertCircle size={28} className="text-muted-text" />
                                        </div>
                                        <p className="text-base font-bold text-main">No profile change requests found</p>
                                        <p className="text-xs text-muted-text mt-1 max-w-sm mx-auto">
                                            {hasActiveFilters
                                                ? 'Try clearing some of your filters or switching college to see requests.'
                                                : 'There are currently no requests matching this status.'}
                                        </p>
                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                onClick={handleResetAllFilters}
                                                className="mt-3 px-3.5 py-1.5 bg-[var(--primary-light)] text-primary hover:bg-[var(--primary-light)] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((req) => {
                                    const changes = parseChanges(req.requested_changes);
                                    const changeKeys = Object.keys(changes);
                                    const initial = req.student_name ? req.student_name.trim().charAt(0).toUpperCase() : '?';
                                    const photoSrc = getPhotoSrc(req.student_photo);

                                    return (
                                        <tr key={req.id} className="hover:bg-[var(--primary-light)] transition-colors border-b border-border last:border-b-0">
                                            {/* Column 1: Student Details with Photo */}
                                            <td className="px-3.5 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="relative h-8 w-8 shrink-0">
                                                        {photoSrc ? (
                                                            <img
                                                                src={photoSrc}
                                                                alt={req.student_name || 'Student'}
                                                                className="h-8 w-8 rounded-lg object-cover border border-border shadow-2xs"
                                                                onError={(e) => {
                                                                    e.currentTarget.style.display = 'none';
                                                                    const fb = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                                                                    if (fb) fb.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div
                                                            className="avatar-fallback h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[11px] shadow-2xs"
                                                            style={{ display: photoSrc ? 'none' : 'flex' }}
                                                        >
                                                            {initial}
                                                        </div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-main leading-snug truncate max-w-[170px]" title={req.student_name}>
                                                            {req.student_name || 'Unknown Student'}
                                                        </div>
                                                        <div className="text-[10px] text-muted-text font-mono flex items-center gap-1.5 leading-none mt-0.5">
                                                            <span>Adm: {req.admission_number}</span>
                                                            {req.pin_no && (
                                                                <span className="text-primary font-semibold">• {req.pin_no}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Column 2: Single Cell for College, Course, Branch & Year */}
                                            <td className="px-3.5 py-2">
                                                <div className="max-w-[210px] space-y-0.5">
                                                    <div className="text-xs font-bold text-main truncate" title={req.college}>
                                                        {req.college || '—'}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px] text-sub truncate flex-wrap">
                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] shrink-0">
                                                            {req.course || '—'}
                                                        </span>
                                                        <span className="font-medium text-sub truncate" title={req.branch}>
                                                            {req.branch || '—'}
                                                        </span>
                                                    </div>
                                                    {(req.current_year || req.batch) && (
                                                        <div className="text-[10px] text-muted-text font-medium">
                                                            {req.current_year ? `Year ${req.current_year}` : ''}
                                                            {req.current_semester ? ` • Sem ${req.current_semester}` : ''}
                                                            {req.batch ? ` (Batch ${req.batch})` : ''}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Column 3: Requested Changes */}
                                            <td className="px-3.5 py-2">
                                                <div className="flex flex-wrap gap-1 max-w-[160px]">
                                                    {changeKeys.slice(0, 2).map((key) => (
                                                        <span
                                                            key={key}
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]"
                                                        >
                                                            {formatKey(key)}
                                                        </span>
                                                    ))}
                                                    {changeKeys.length > 2 && (
                                                        <span
                                                            className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold bg-background text-sub"
                                                            title={changeKeys.slice(2).map(formatKey).join(', ')}
                                                        >
                                                            +{changeKeys.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Column 4: Submitted Date */}
                                            <td className="px-3.5 py-2 whitespace-nowrap text-xs text-muted-text">
                                                <div className="font-semibold text-main text-[11px]">
                                                    {new Date(req.created_at).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                                <div className="text-[10px] text-muted-text">
                                                    {new Date(req.created_at).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>

                                            {/* Dynamic Columns: Approved Time & Approved By */}
                                            {statusFilter === 'approved' && (
                                                <>
                                                    <td className="px-3.5 py-2 whitespace-nowrap text-xs">
                                                        <div className="font-semibold text-main text-[11px] flex items-center gap-1">
                                                            <Clock size={11} className="text-success shrink-0" />
                                                            <span>
                                                                {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] font-semibold text-success pl-3.5">
                                                            {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleTimeString('en-US', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--success-light)] text-success border border-[var(--success-light)] text-[10px] font-bold shadow-2xs">
                                                            <UserCheck size={11} className="text-success shrink-0" />
                                                            <span>{req.reviewed_by || 'Admin'}</span>
                                                        </span>
                                                    </td>
                                                </>
                                            )}

                                            {/* Dynamic Columns: Rejected Time & Rejected By */}
                                            {statusFilter === 'rejected' && (
                                                <>
                                                    <td className="px-3.5 py-2 whitespace-nowrap text-xs">
                                                        <div className="font-semibold text-main text-[11px] flex items-center gap-1">
                                                            <Clock size={11} className="text-danger shrink-0" />
                                                            <span>
                                                                {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleDateString('en-US', {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    year: 'numeric'
                                                                })}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] font-semibold text-danger pl-3.5">
                                                            {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleTimeString('en-US', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-3.5 py-2 whitespace-nowrap">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] text-[10px] font-bold shadow-2xs">
                                                            <UserCheck size={11} className="text-danger shrink-0" />
                                                            <span>{req.reviewed_by || 'Admin'}</span>
                                                        </span>
                                                    </td>
                                                </>
                                            )}

                                            {/* Dynamic Column: All Statuses Review Details */}
                                            {statusFilter === 'all' && (
                                                <td className="px-3.5 py-2 whitespace-nowrap text-xs">
                                                    {req.status === 'approved' ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-semibold text-main text-[11px] flex items-center gap-1">
                                                                <Clock size={11} className="text-success shrink-0" />
                                                                <span>
                                                                    {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span className="text-[10px] text-muted-text font-normal">
                                                                    {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--success-light)] text-success border border-[var(--success-light)] text-[10px] font-bold">
                                                                <UserCheck size={10} className="text-success shrink-0" />
                                                                <span>{req.reviewed_by || 'Admin'}</span>
                                                            </div>
                                                        </div>
                                                    ) : req.status === 'rejected' ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-semibold text-main text-[11px] flex items-center gap-1">
                                                                <Clock size={11} className="text-danger shrink-0" />
                                                                <span>
                                                                    {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                                </span>
                                                                <span className="text-[10px] text-muted-text font-normal">
                                                                    {new Date(req.updated_at || req.reviewed_at || req.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] text-[10px] font-bold">
                                                                <UserCheck size={10} className="text-danger shrink-0" />
                                                                <span>{req.reviewed_by || 'Admin'}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-warning font-medium italic flex items-center gap-1">
                                                            <Clock size={11} className="text-warning shrink-0" />
                                                            <span>Awaiting review</span>
                                                        </span>
                                                    )}
                                                </td>
                                            )}

                                            {/* Column: Status */}
                                            <td className="px-3 py-2 whitespace-nowrap text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                                                    req.status === 'approved'
                                                        ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                                                        : req.status === 'rejected'
                                                            ? 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
                                                            : 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]'
                                                }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                                        req.status === 'approved'
                                                            ? 'bg-success'
                                                            : req.status === 'rejected'
                                                                ? 'bg-danger'
                                                                : 'bg-warning animate-pulse'
                                                    }`} />
                                                    {req.status || 'Pending'}
                                                </span>
                                            </td>

                                            {/* Column: Action */}
                                            <td className="px-3.5 py-2 whitespace-nowrap text-right">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        setSelectedRequest(req);
                                                        try {
                                                            const res = await api.get(`/students/${req.admission_number}`);
                                                            if (res.data?.success) {
                                                                setStudentOriginalData(res.data.data);
                                                            }
                                                        } catch (err) {
                                                            console.error("Failed to fetch original student data:", err);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface border border-border hover:border-primary hover:bg-[var(--primary-light)] rounded-lg text-[11px] font-bold text-sub hover:text-primary transition-all shadow-2xs cursor-pointer"
                                                >
                                                    <Eye size={12} />
                                                    <span>Review</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 5. Pagination Bar */}
                {!loading && (pagination.total > 0 || requests.length > 0) && (
                    <div className="px-5 py-3.5 border-t border-border bg-[var(--background)]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                        {/* Range info and page size selector */}
                        <div className="flex items-center gap-3 text-muted-text flex-wrap justify-center sm:justify-start">
                            <span>
                                Showing{' '}
                                <span className="font-bold text-main">
                                    {pagination.total === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                                </span>{' '}
                                to{' '}
                                <span className="font-bold text-main">
                                    {Math.min(currentPage * pageSize, pagination.total || requests.length)}
                                </span>{' '}
                                of{' '}
                                <span className="font-bold text-main">
                                    {(pagination.total || requests.length).toLocaleString()}
                                </span>{' '}
                                requests
                            </span>
                            <span className="text-muted-text">|</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-muted-text font-medium">Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                                    className="px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-semibold text-sub outline-none cursor-pointer focus:ring-1 focus:ring-primary shadow-2xs"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>

                        {/* Page Navigation Buttons */}
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                disabled={currentPage <= 1 || loading}
                                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-sub hover:bg-background hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer font-medium shadow-2xs"
                            >
                                <ChevronLeft size={14} />
                                <span>Prev</span>
                            </button>

                            {/* Page Pills */}
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.totalPages || 1) }, (_, i) => {
                                    const totalP = pagination.totalPages || 1;
                                    let pageNum;
                                    if (totalP <= 5) {
                                        pageNum = i + 1;
                                    } else if (currentPage <= 3) {
                                        pageNum = i + 1;
                                    } else if (currentPage >= totalP - 2) {
                                        pageNum = totalP - 4 + i;
                                    } else {
                                        pageNum = currentPage - 2 + i;
                                    }

                                    const isActive = currentPage === pageNum;
                                    return (
                                        <button
                                            key={pageNum}
                                            type="button"
                                            onClick={() => handlePageChange(pageNum)}
                                            disabled={loading}
                                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                isActive
                                                    ? 'bg-primary text-white shadow-2xs'
                                                    : 'bg-surface border border-border text-sub hover:bg-background'
                                            }`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => handlePageChange(Math.min(pagination.totalPages || 1, currentPage + 1))}
                                disabled={currentPage >= (pagination.totalPages || 1) || loading}
                                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-sub hover:bg-background hover:text-main disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer font-medium shadow-2xs"
                            >
                                <span>Next</span>
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 5. Review & Approval Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
                    <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col relative my-auto border border-border overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-gradient-to-r from-[var(--background)] via-surface to-[var(--primary-light)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-main">Review Profile Change Request</h2>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold capitalize ${
                                        selectedRequest.status === 'pending'
                                            ? 'bg-[var(--warning-light)] text-warning'
                                            : selectedRequest.status === 'approved'
                                                ? 'bg-[var(--success-light)] text-success'
                                                : 'bg-[var(--danger-light)] text-danger'
                                    }`}>
                                        {selectedRequest.status}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-text mt-0.5">
                                    Submitted on {new Date(selectedRequest.created_at).toLocaleString()}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRequest(null)}
                                className="p-1.5 hover:bg-background rounded-xl transition-colors text-muted-text hover:text-sub cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto max-h-[65vh] space-y-5">
                            {/* Student Metadata Card */}
                            <div className="bg-[var(--background)]/80 p-4 rounded-xl border border-border">
                                <p className="text-[10px] font-bold text-muted-text uppercase tracking-wider mb-2.5">
                                    Student Record Information
                                </p>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-3 pb-3 border-b border-border">
                                    <div className="relative h-14 w-14 shrink-0">
                                        {getPhotoSrc(selectedRequest.student_photo) ? (
                                            <img
                                                src={getPhotoSrc(selectedRequest.student_photo)}
                                                alt={selectedRequest.student_name}
                                                className="h-14 w-14 rounded-2xl object-cover border-2 border-surface shadow-md"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fb = e.currentTarget.parentElement?.querySelector('.modal-avatar-fallback');
                                                    if (fb) fb.style.display = 'flex';
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className="modal-avatar-fallback h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-lg shadow-md"
                                            style={{ display: getPhotoSrc(selectedRequest.student_photo) ? 'none' : 'flex' }}
                                        >
                                            {selectedRequest.student_name ? selectedRequest.student_name.trim().charAt(0).toUpperCase() : '?'}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-main leading-tight">
                                            {selectedRequest.student_name || 'Unknown Student'}
                                        </h3>
                                        <div className="text-xs text-muted-text font-mono mt-1 flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-primary">Adm: {selectedRequest.admission_number}</span>
                                            {selectedRequest.pin_no && <span>• PIN: {selectedRequest.pin_no}</span>}
                                            {selectedRequest.batch && <span>• Batch: {selectedRequest.batch}</span>}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-muted-text block text-[11px]">Student Name</span>
                                        <span className="font-bold text-main">{selectedRequest.student_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-text block text-[11px]">Admission Number</span>
                                        <span className="font-bold text-primary font-mono">{selectedRequest.admission_number}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-text block text-[11px]">College</span>
                                        <span className="font-bold text-main">{selectedRequest.college || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-text block text-[11px]">Course & Branch</span>
                                        <span className="font-bold text-main">{selectedRequest.course} ({selectedRequest.branch})</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-text block text-[11px]">Year & Semester</span>
                                        <span className="font-bold text-main">Year {selectedRequest.current_year || '?'} • Sem {selectedRequest.current_semester || '?'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-text block text-[11px]">Request ID</span>
                                        <span className="font-mono text-sub">#{selectedRequest.id}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Side-by-Side Comparison of Changes */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h3 className="text-xs font-bold text-sub uppercase tracking-wider">
                                        Proposed Updates Comparison
                                    </h3>
                                    <span className="text-[11px] text-muted-text">
                                        {Object.keys(parseChanges(selectedRequest.requested_changes)).length} field(s) modified
                                    </span>
                                </div>

                                <div className="space-y-2.5">
                                    {Object.entries(parseChanges(selectedRequest.requested_changes)).map(([key, value]) => {
                                        let oldVal = studentOriginalData[key];
                                        if (oldVal === undefined && studentOriginalData.student_data) {
                                            let parsed = {};
                                            if (typeof studentOriginalData.student_data === 'string') {
                                                try { parsed = JSON.parse(studentOriginalData.student_data); } catch (e) { }
                                            } else {
                                                parsed = studentOriginalData.student_data;
                                            }
                                            oldVal = parsed[key] || parsed[formatKey(key)];
                                        }

                                        return (
                                            <div
                                                key={key}
                                                className="p-3 bg-surface rounded-xl border border-border shadow-2xs hover:border-[var(--primary-light)] transition-colors"
                                            >
                                                <span className="text-xs font-bold text-main block mb-2">
                                                    {formatKey(key)}
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                                                    <div className="p-2.5 rounded-lg bg-background border border-border text-xs">
                                                        <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider block mb-0.5">
                                                            Current in Database
                                                        </span>
                                                        <span className="font-medium text-sub break-words">
                                                            {String(oldVal ?? '(Empty / Not Provided)')}
                                                        </span>
                                                    </div>

                                                    <div className="p-2.5 rounded-lg bg-[var(--primary-light)] border border-[var(--primary-light)] text-xs">
                                                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-0.5">
                                                            Student Requested New Value
                                                        </span>
                                                        <span className="font-bold text-primary break-words">
                                                            {String(value ?? '(Empty)')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Reviewer Comments */}
                            {selectedRequest.status === 'pending' && canManageRequests && (
                                <div>
                                    <label className="text-xs font-bold text-sub uppercase tracking-wider block mb-1.5">
                                        Reviewer Comments / Reason (Optional)
                                    </label>
                                    <textarea
                                        value={reviewComments}
                                        onChange={(e) => setReviewComments(e.target.value)}
                                        placeholder="Add approval note or reason if rejecting request..."
                                        rows={3}
                                        className="w-full p-3 text-xs sm:text-sm border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none bg-[var(--background)]/30 focus:bg-surface"
                                    />
                                </div>
                            )}

                            {selectedRequest.status === 'pending' && !canManageRequests && (
                                <div className="bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-xl p-3 text-xs text-warning flex items-center gap-2">
                                    <AlertCircle size={16} className="text-warning shrink-0" />
                                    <span>You have Read-Only permissions for profile change requests.</span>
                                </div>
                            )}

                            {/* Prior Review Details if already processed */}
                            {selectedRequest.status !== 'pending' && (
                                <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                                    selectedRequest.status === 'approved'
                                        ? 'bg-[var(--success-light)] border-[var(--success-light)]'
                                        : 'bg-[var(--danger-light)] border-[var(--danger-light)]'
                                }`}>
                                    <p className={`font-bold uppercase text-[10px] tracking-wider flex items-center gap-1.5 ${
                                        selectedRequest.status === 'approved' ? 'text-success' : 'text-danger'
                                    }`}>
                                        {selectedRequest.status === 'approved' ? (
                                            <>
                                                <CheckCircle2 size={13} className="text-success" />
                                                <span>Approval History</span>
                                            </>
                                        ) : (
                                            <>
                                                <XCircle size={13} className="text-danger" />
                                                <span>Rejection History</span>
                                            </>
                                        )}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-muted-text block text-[10px] font-medium">
                                                {selectedRequest.status === 'approved' ? 'Approved By' : 'Rejected By'}
                                            </span>
                                            <span className="font-bold text-main flex items-center gap-1.5 mt-0.5">
                                                <UserCheck size={13} className={selectedRequest.status === 'approved' ? 'text-success' : 'text-danger'} />
                                                <span>{selectedRequest.reviewed_by || 'Admin'}</span>
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-muted-text block text-[10px] font-medium">
                                                {selectedRequest.status === 'approved' ? 'Approved Time' : 'Rejected Time'}
                                            </span>
                                            <span className="font-bold text-main flex items-center gap-1.5 mt-0.5">
                                                <Clock size={13} className="text-muted-text" />
                                                <span>{new Date(selectedRequest.updated_at || selectedRequest.created_at).toLocaleString()}</span>
                                            </span>
                                        </div>
                                        {selectedRequest.comments && (
                                            <div className="col-span-2 mt-1 pt-2 border-t border-border">
                                                <span className="text-muted-text block text-[10px] font-medium">Comments / Reason</span>
                                                <span className="font-medium text-main italic block mt-0.5">{selectedRequest.comments}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        {selectedRequest.status === 'pending' && canManageRequests ? (
                            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2.5 bg-[var(--background)]/80">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-4 py-2 text-xs font-semibold text-sub hover:bg-background rounded-xl transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleReview('rejected')}
                                    className="px-4 py-2 text-xs font-bold rounded-xl text-danger bg-[var(--danger-light)] hover:bg-[var(--danger-light)] flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <X size={15} />
                                    <span>Reject Request</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleReview('approved')}
                                    className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-success hover:bg-success flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                                >
                                    <Check size={15} />
                                    <span>Approve & Update Record</span>
                                </button>
                            </div>
                        ) : (
                            <div className="px-6 py-4 border-t border-border flex items-center justify-end bg-[var(--background)]/80">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-4 py-2 text-xs font-semibold bg-background text-sub hover:bg-background rounded-xl transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileChangeRequests;
