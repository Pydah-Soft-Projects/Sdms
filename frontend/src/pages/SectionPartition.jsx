import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid,
  Filter,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Save,
  Users,
  X,
  SlidersHorizontal,
  Search,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import { SkeletonTable } from '../components/SkeletonLoader';
import PinRangeSeparationModal from '../components/SectionPartition/PinRangeSeparationModal';
import useAuthStore from '../store/authStore';
import {
  hasPermission,
  hasModuleAccess,
  isFullAccessRole,
  BACKEND_MODULES,
  FRONTEND_MODULES
} from '../constants/rbac';

const CHUNK_SIZE = 50;

const getBranchSectionConfig = (coursesWithLevels, courseInput, branchInput) => {
  if (!branchInput || !courseInput) {
    return { enabled: false, items: [], breakdown: [] };
  }

  const courseStr = typeof courseInput === 'object' ? (courseInput.name || courseInput.id) : String(courseInput).trim();
  const branchStr = typeof branchInput === 'object' ? (branchInput.name || branchInput.id) : String(branchInput).trim();

  const courseObj = (coursesWithLevels || []).find(
    (c) => String(c.name).toLowerCase() === courseStr.toLowerCase() || String(c.id) === courseStr
  );
  if (!courseObj) {
    return { enabled: false, items: [], breakdown: [] };
  }

  const branchObj = (courseObj.branches || []).find(
    (b) => String(b.name).toLowerCase() === branchStr.toLowerCase() || String(b.id) === branchStr
  );
  if (!branchObj?.metadata?.sections?.enabled) {
    return { enabled: false, items: [], breakdown: [] };
  }

  const rawItems = branchObj.metadata?.sections?.items || [];
  const breakdown = rawItems
    .filter((item) => item && (item.name || typeof item === 'string'))
    .map((item) => (typeof item === 'object' ? item : { name: String(item), strength: null }));

  const items = breakdown
    .map((item) => (typeof item === 'object' ? item?.name : item))
    .filter(Boolean);

  return { enabled: items.length > 0, items, breakdown };
};

const normalizeSectionValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const getStudentKey = (student) => student?.admissionNumber || String(student?.id ?? '');

const SectionPartition = () => {
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || {};
  const canViewSectionPartition =
    isFullAccessRole(user?.role) ||
    hasModuleAccess(userPermissions, FRONTEND_MODULES.SECTION_PARTITION) ||
    (Array.isArray(user?.modules) && user.modules.includes(FRONTEND_MODULES.SECTION_PARTITION));
  const canEditSection =
    isFullAccessRole(user?.role) ||
    hasPermission(userPermissions, BACKEND_MODULES.SECTION_PARTITION, 'manage');

  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => ({
    college: searchParams.get('college') || '',
    course: searchParams.get('course') || '',
    branch: searchParams.get('branch') || '',
    batch: searchParams.get('batch') || '',
    sectionStatus: searchParams.get('sectionStatus') || 'all'
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    marked: 0,
    notMarked: 0
  });
  const [allBatchStudents, setAllBatchStudents] = useState([]);
  const [allBatchTotal, setAllBatchTotal] = useState(0);
  const [colleges, setColleges] = useState([]);
  const [collegesLoading, setCollegesLoading] = useState(false);
  const [quickFilterOptions, setQuickFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: []
  });
  const [coursesWithLevels, setCoursesWithLevels] = useState([]);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [students, setStudents] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [sectionBreakdown, setSectionBreakdown] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [draftSections, setDraftSections] = useState({});
  const [savedSections, setSavedSections] = useState({});
  const [selectedStudentKeys, setSelectedStudentKeys] = useState(new Set());
  const [bulkAssignModalOpen, setBulkAssignModalOpen] = useState(false);
  const [bulkAssignSection, setBulkAssignSection] = useState('');
  const [pinRangeModalOpen, setPinRangeModalOpen] = useState(false);
  const [loadingAllStudents, setLoadingAllStudents] = useState(false);

  const scrollContainerRef = useRef(null);
  const loadMoreRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const filtersReady = Boolean(
    filters.college && filters.course && filters.branch && filters.batch
  );

  const branchHasSections = useMemo(() => {
    if (!filters.course || !filters.branch) return false;
    if (sectionOptions && sectionOptions.length > 0) return true;
    return getBranchSectionConfig(coursesWithLevels, filters.course, filters.branch).enabled;
  }, [coursesWithLevels, filters.course, filters.branch, sectionOptions]);

  const availableBranches = useMemo(() => {
    if (!filters.course) return [];
    return (quickFilterOptions.branches || [])
      .map((b) => (typeof b === 'object' ? b.name || b.id : b))
      .filter(Boolean);
  }, [quickFilterOptions.branches, filters.course]);

  const configuredSectionItems = useMemo(() => {
    if (sectionOptions.length > 0) return sectionOptions;
    return getBranchSectionConfig(coursesWithLevels, filters.course, filters.branch).items;
  }, [sectionOptions, coursesWithLevels, filters.course, filters.branch]);

  const currentSectionBreakdown = useMemo(() => {
    const config = getBranchSectionConfig(coursesWithLevels, filters.course, filters.branch);
    if (config.breakdown && config.breakdown.length > 0) return config.breakdown;
    if (sectionBreakdown && sectionBreakdown.length > 0) return sectionBreakdown;
    if (sectionOptions && sectionOptions.length > 0) {
      return sectionOptions.map((s) => (typeof s === 'object' ? s : { name: String(s), strength: null }));
    }
    return [];
  }, [coursesWithLevels, filters.course, filters.branch, sectionBreakdown, sectionOptions]);

  const unsavedCount = useMemo(() => {
    return students.filter((student) => {
      const key = getStudentKey(student);
      const draft = normalizeSectionValue(draftSections[key]);
      const saved = normalizeSectionValue(savedSections[key]);
      return draft !== saved;
    }).length;
  }, [students, draftSections, savedSections]);

  const selectedCount = selectedStudentKeys.size;

  const applyRowsToSectionState = useCallback((rows, reset = false) => {
    setSavedSections((prev) => {
      const next = reset ? {} : { ...prev };
      rows.forEach((student) => {
        const key = getStudentKey(student);
        if (reset || next[key] === undefined) {
          next[key] = normalizeSectionValue(student.section);
        }
      });
      return next;
    });
    setDraftSections((prev) => {
      const next = reset ? {} : { ...prev };
      rows.forEach((student) => {
        const key = getStudentKey(student);
        if (reset || next[key] === undefined) {
          next[key] = normalizeSectionValue(student.section);
        }
      });
      return next;
    });
  }, []);

  const fetchColleges = useCallback(async () => {
    setCollegesLoading(true);
    try {
      const response = await api.get('/colleges');
      if (response.data?.success) {
        setColleges(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch colleges:', error);
      toast.error('Failed to load colleges');
    } finally {
      setCollegesLoading(false);
    }
  }, []);

  const fetchCoursesWithLevels = useCallback(async () => {
    try {
      const response = await api.get('/courses?includeInactive=false');
      if (response.data?.success) {
        setCoursesWithLevels(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error);
    }
  }, []);

  const fetchQuickFilterOptions = useCallback(async (currentFilters = {}) => {
    setLoadingFilters(true);
    try {
      const params = new URLSearchParams();
      if (currentFilters.college) params.append('college', currentFilters.college);
      if (currentFilters.course) params.append('course', currentFilters.course);
      if (currentFilters.batch) params.append('batch', currentFilters.batch);

      const queryString = params.toString();
      const url = `/students/quick-filters${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      if (response.data?.success) {
        const data = response.data.data || {};
        setQuickFilterOptions((prev) => ({
          batches: currentFilters.batch ? prev.batches : (data.batches || []),
          courses: currentFilters.course ? prev.courses : (data.courses || []),
          branches: data.branches || []
        }));
      }
    } catch (error) {
      console.warn('Failed to load filter metadata:', error);
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  const resetStudentList = useCallback(() => {
    setStudents([]);
    setDraftSections({});
    setSavedSections({});
    setSelectedStudentKeys(new Set());
    setTotalStudents(0);
    setHasMore(false);
    setNextOffset(0);
    setSectionOptions([]);
    setSectionBreakdown([]);
    setStatusCounts({ all: 0, marked: 0, notMarked: 0 });
    setAllBatchStudents([]);
    setAllBatchTotal(0);
  }, []);

  const loadStudents = useCallback(async ({ offset = 0, append = false } = {}) => {
    if (!filtersReady) {
      resetStudentList();
      return;
    }

    if (append) {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setLoadingInitial(true);
    }

    try {
      const params = new URLSearchParams({
        college: filters.college,
        course: filters.course,
        branch: filters.branch,
        batch: filters.batch,
        limit: String(CHUNK_SIZE),
        offset: String(offset)
      });
      if (filters.sectionStatus && filters.sectionStatus !== 'all') {
        params.append('sectionStatus', filters.sectionStatus);
      }

      const response = await api.get(`/students/section-partition?${params.toString()}`);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to load students');
      }

      const data = response.data.data || {};
      const rows = data.students || [];
      const pagination = data.pagination || {};

      setSectionOptions(data.sections || []);
      setSectionBreakdown(data.sectionBreakdown || []);
      setTotalStudents(pagination.total || 0);
      if (data.statusCounts) {
        setStatusCounts(data.statusCounts);
      }
      setHasMore(Boolean(pagination.hasMore));
      setNextOffset(offset + rows.length);

      if (append) {
        setStudents((prev) => {
          const existing = new Set(prev.map((s) => s.admissionNumber || s.id));
          return [...prev, ...rows.filter((s) => !existing.has(s.admissionNumber || s.id))];
        });
        applyRowsToSectionState(rows, false);
      } else {
        setStudents(rows);
        applyRowsToSectionState(rows, true);
      }
    } catch (error) {
      console.error('Failed to fetch section partition students:', error);
      toast.error(error.response?.data?.message || 'Failed to load students');
      if (!append) {
        resetStudentList();
      }
    } finally {
      if (append) {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      } else {
        setLoadingInitial(false);
      }
    }
  }, [filters, filtersReady, resetStudentList, applyRowsToSectionState]);

  useEffect(() => {
    fetchColleges();
    fetchCoursesWithLevels();
  }, [fetchColleges, fetchCoursesWithLevels]);

  useEffect(() => {
    fetchQuickFilterOptions(filters);
  }, [filters.college, filters.course, filters.batch, fetchQuickFilterOptions]);

  useEffect(() => {
    if (!filtersReady) {
      resetStudentList();
      return;
    }
    loadStudents({ offset: 0, append: false });
  }, [filtersReady, filters.college, filters.course, filters.branch, filters.batch, filters.sectionStatus, loadStudents, resetStudentList]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root || !hasMore || loadingInitial || loadingMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMoreRef.current && !loadingInitial) {
          loadStudents({ offset: nextOffset, append: true });
        }
      },
      { root, rootMargin: '120px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingInitial, loadingMore, nextOffset, loadStudents]);

  useEffect(() => {
    const qCollege = searchParams.get('college') || '';
    const qCourse = searchParams.get('course') || '';
    const qBranch = searchParams.get('branch') || '';
    const qBatch = searchParams.get('batch') || '';
    const qStatus = searchParams.get('sectionStatus') || 'all';

    if (qCollege || qCourse || qBranch || qBatch) {
      setFilters((prev) => {
        if (
          prev.college === qCollege &&
          prev.course === qCourse &&
          prev.branch === qBranch &&
          prev.batch === qBatch &&
          prev.sectionStatus === qStatus
        ) {
          return prev;
        }
        return {
          college: qCollege,
          course: qCourse,
          branch: qBranch,
          batch: qBatch,
          sectionStatus: qStatus
        };
      });
    }
  }, [searchParams]);

  const handleFilterChange = (key, value) => {
    setSelectedStudentKeys(new Set());
    setFilters((prev) => {
      const next = { ...prev, [key]: value || (key === 'sectionStatus' ? 'all' : '') };
      if (key === 'college') {
        next.course = '';
        next.branch = '';
        next.batch = '';
        setAllBatchStudents([]);
        setAllBatchTotal(0);
      } else if (key === 'course') {
        next.branch = '';
        next.batch = '';
        setAllBatchStudents([]);
        setAllBatchTotal(0);
      } else if (key === 'branch') {
        next.batch = '';
        setAllBatchStudents([]);
        setAllBatchTotal(0);
      } else if (key === 'batch') {
        setAllBatchStudents([]);
        setAllBatchTotal(0);
      }

      const newParams = new URLSearchParams();
      if (next.college) newParams.set('college', next.college);
      if (next.course) newParams.set('course', next.course);
      if (next.branch) newParams.set('branch', next.branch);
      if (next.batch) newParams.set('batch', next.batch);
      if (next.sectionStatus && next.sectionStatus !== 'all') {
        newParams.set('sectionStatus', next.sectionStatus);
      }
      setSearchParams(newParams, { replace: true });

      return next;
    });
  };

  const handleSectionDraftChange = (studentKey, sectionValue) => {
    if (!canEditSection) {
      toast.error('You do not have permission to update sections');
      return;
    }
    setDraftSections((prev) => ({
      ...prev,
      [studentKey]: normalizeSectionValue(sectionValue)
    }));
  };

  const displayedStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const term = searchTerm.trim().toLowerCase();
    return students.filter((s) => {
      const pin = String(s.pinNo || '').toLowerCase();
      const name = String(s.studentName || '').toLowerCase();
      const adm = String(s.admissionNumber || '').toLowerCase();
      return pin.includes(term) || name.includes(term) || adm.includes(term);
    });
  }, [students, searchTerm]);

  const isAllLoadedSelected = useMemo(() => {
    if (displayedStudents.length === 0) return false;
    return displayedStudents.every((student) => selectedStudentKeys.has(getStudentKey(student)));
  }, [displayedStudents, selectedStudentKeys]);

  const toggleStudentSelection = (studentKey) => {
    setSelectedStudentKeys((prev) => {
      const next = new Set(prev);
      if (next.has(studentKey)) {
        next.delete(studentKey);
      } else {
        next.add(studentKey);
      }
      return next;
    });
  };

  const toggleSelectAllLoaded = (checked) => {
    if (!checked) {
      setSelectedStudentKeys(new Set());
      return;
    }
    setSelectedStudentKeys(new Set(displayedStudents.map((student) => getStudentKey(student))));
  };

  const applyBulkSectionToSelected = (sectionValue) => {
    if (!canEditSection) {
      toast.error('You do not have permission to update sections');
      return;
    }
    if (selectedStudentKeys.size === 0) {
      toast.error('Select at least one student');
      return;
    }

    const normalized = normalizeSectionValue(sectionValue);
    setDraftSections((prev) => {
      const next = { ...prev };
      selectedStudentKeys.forEach((key) => {
        next[key] = normalized;
      });
      return next;
    });

    const label = normalized || 'None';
    toast.success(`Assigned section ${label} to ${selectedStudentKeys.size} student(s)`);
    setBulkAssignModalOpen(false);
    setBulkAssignSection('');
  };

  const openBulkAssignModal = () => {
    if (selectedStudentKeys.size === 0) {
      toast.error('Select at least one student');
      return;
    }
    setBulkAssignSection('');
    setBulkAssignModalOpen(true);
  };

  const handleBulkAssignConfirm = () => {
    applyBulkSectionToSelected(bulkAssignSection);
  };

  const handleSave = async () => {
    if (!canEditSection) {
      toast.error('You do not have permission to save sections');
      return;
    }

    const assignments = students
      .filter((student) => {
        const key = getStudentKey(student);
        const draft = normalizeSectionValue(draftSections[key]);
        const saved = normalizeSectionValue(savedSections[key]);
        return draft !== saved;
      })
      .map((student) => ({
        admissionNumber: student.admissionNumber,
        section: normalizeSectionValue(draftSections[getStudentKey(student)])
      }));

    if (assignments.length === 0) {
      toast.error('No section changes to save');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/students/section-partition/save', { assignments });
      if (response.data?.success || response.data?.data?.success > 0) {
        const updatedSaved = { ...savedSections };
        assignments.forEach(({ admissionNumber, section }) => {
          updatedSaved[admissionNumber] = section;
          const match = students.find((s) => s.admissionNumber === admissionNumber);
          if (match) {
            updatedSaved[getStudentKey(match)] = section;
          }
        });
        setSavedSections(updatedSaved);
        setStudents((prev) =>
          prev.map((student) => {
            const change = assignments.find((a) => a.admissionNumber === student.admissionNumber);
            if (!change) return student;
            return {
              ...student,
              section: change.section || null
            };
          })
        );
        toast.success(response.data?.message || `Saved ${assignments.length} section assignment(s)`);
      } else {
        throw new Error(response.data?.message || 'Failed to save sections');
      }
    } catch (error) {
      console.error('Failed to save sections:', error);
      toast.error(error.response?.data?.message || 'Failed to save section assignments');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setFilters({ college: '', course: '', branch: '', batch: '', sectionStatus: 'all' });
    setSearchParams(new URLSearchParams(), { replace: true });
    setSearchTerm('');
    setAllBatchStudents([]);
    setAllBatchTotal(0);
    resetStudentList();
  };

  const handleRefresh = () => {
    if (!filtersReady) return;
    setAllBatchStudents([]);
    setAllBatchTotal(0);
    loadStudents({ offset: 0, append: false });
  };

  const fetchAllStudentsForBatch = useCallback(async () => {
    if (!filtersReady) return [];
    setLoadingAllStudents(true);
    try {
      const params = new URLSearchParams({
        college: filters.college,
        course: filters.course,
        branch: filters.branch,
        batch: filters.batch,
        limit: '1000',
        offset: '0'
      });
      if (filters.sectionStatus && filters.sectionStatus !== 'all') {
        params.append('sectionStatus', filters.sectionStatus);
      }
      const response = await api.get(`/students/section-partition?${params.toString()}`);
      if (response.data?.success) {
        const rows = response.data.data?.students || [];
        const pagination = response.data.data?.pagination || {};
        setSectionOptions(response.data.data?.sections || []);
        setSectionBreakdown(response.data.data?.sectionBreakdown || []);
        const total = pagination.total || rows.length;
        setAllBatchTotal(total);
        setAllBatchStudents(rows);
        if (response.data.data?.statusCounts) {
          setStatusCounts(response.data.data.statusCounts);
        }
        setTotalStudents(total);
        setStudents(rows);
        setHasMore(false);
        applyRowsToSectionState(rows, false);
        return rows;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch students for batch:', error);
      toast.error('Failed to load students for batch');
      return [];
    } finally {
      setLoadingAllStudents(false);
    }
  }, [filters, filtersReady, applyRowsToSectionState]);

  const openPinRangeModal = async () => {
    if (!filtersReady) {
      toast.error('Please select College, Course, Branch, and Batch first');
      return;
    }
    setPinRangeModalOpen(true);
    if (allBatchStudents.length === 0 || allBatchStudents.length < allBatchTotal || students.length < totalStudents) {
      await fetchAllStudentsForBatch();
    }
  };

  const handleApplyPinRangeDraft = (assignments) => {
    if (!canEditSection) {
      toast.error('You do not have permission to update sections');
      return;
    }

    setDraftSections((prev) => {
      const next = { ...prev };
      assignments.forEach(({ admissionNumber, section }) => {
        next[admissionNumber] = normalizeSectionValue(section);
      });
      return next;
    });
  };

  const handleSavePinRangeDirectly = async (assignments, ranges) => {
    if (!canEditSection) {
      toast.error('You do not have permission to save sections');
      return;
    }

    setSaving(true);
    try {
      const response = await api.post('/students/section-partition/apply-pin-ranges', {
        college: filters.college,
        course: filters.course,
        branch: filters.branch,
        batch: filters.batch,
        sectionStatus: filters.sectionStatus,
        ranges
      });

      if (response.data?.success) {
        toast.success(response.data?.message || 'Section ranges applied successfully');
        setAllBatchStudents([]);
        setAllBatchTotal(0);
        await loadStudents({ offset: 0, append: false });
      } else {
        throw new Error(response.data?.message || 'Failed to apply section ranges');
      }
    } catch (err) {
      console.warn('Direct range save failed, falling back to bulk save assignments:', err);
      try {
        const fallbackResponse = await api.post('/students/section-partition/save', { assignments });
        if (fallbackResponse.data?.success || fallbackResponse.data?.data?.success > 0) {
          toast.success(fallbackResponse.data?.message || 'Saved section assignments successfully');
          setAllBatchStudents([]);
          setAllBatchTotal(0);
          await loadStudents({ offset: 0, append: false });
        } else {
          throw new Error(fallbackResponse.data?.message || 'Failed to save section assignments');
        }
      } catch (fallbackErr) {
        toast.error(fallbackErr.response?.data?.message || 'Failed to save section assignments');
        throw fallbackErr;
      }
    } finally {
      setSaving(false);
    }
  };

  const tableHeadCellClass =
    'sticky top-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200';

  if (!canViewSectionPartition) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 sm:space-y-3 p-3 sm:p-4">
      {/* Top Search Bar with Action Buttons (Identical to Students.jsx) */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-xs min-h-[36px]"
              placeholder="Filter loaded students by name, PIN, or admission no..."
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={!filtersReady || loadingInitial}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-xs font-medium shadow-xs transition-colors min-h-[34px] disabled:opacity-50"
            >
              <RefreshCw size={14} className={loadingInitial ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            {canEditSection && (
              <button
                type="button"
                onClick={openPinRangeModal}
                disabled={!filtersReady || loadingInitial}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-gradient-to-r from-emerald-600 to-emerald-700 border border-transparent shadow-sm hover:shadow active:scale-95 transition-all duration-300 min-h-[34px] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                title="Separate regular students into sections based on PIN number range"
              >
                <SlidersHorizontal size={14} />
                <span>PIN Range Separation</span>
              </button>
            )}

            {canEditSection && (
              <button
                type="button"
                onClick={handleSave}
                disabled={!filtersReady || saving || unsavedCount === 0}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent shadow-sm hover:shadow active:scale-95 transition-all duration-300 min-h-[34px] disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>Save{unsavedCount > 0 ? ` (${unsavedCount})` : ''}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Statistics Cards (Identical to Students.jsx) */}
      {filtersReady && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Total Students</p>
                <p className="text-base font-bold text-blue-600 leading-tight">
                  {(statusCounts.all || totalStudents).toLocaleString()}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">Regular in Batch</p>
              </div>
              <div className="bg-blue-50 p-1.5 rounded-lg">
                <Users className="text-blue-500" size={14} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Section Marked</p>
                <p className="text-base font-bold text-emerald-600 leading-tight">
                  {statusCounts.marked.toLocaleString()}
                </p>
                <p className="text-[9px] text-emerald-600 mt-0.5 font-medium">
                  {statusCounts.all > 0 ? `${Math.round((statusCounts.marked / statusCounts.all) * 100)}% assigned` : 'Assigned'}
                </p>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg">
                <CheckCircle2 className="text-emerald-500" size={14} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Not Marked</p>
                <p className="text-base font-bold text-amber-600 leading-tight">
                  {statusCounts.notMarked.toLocaleString()}
                </p>
                <p className="text-[9px] text-amber-600 mt-0.5 font-medium">
                  {statusCounts.all > 0 ? `${Math.round((statusCounts.notMarked / statusCounts.all) * 100)}% pending` : 'Pending'}
                </p>
              </div>
              <div className="bg-amber-50 p-1.5 rounded-lg">
                <AlertTriangle className="text-amber-500" size={14} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium text-gray-500 mb-0.5 uppercase tracking-wider">Unsaved Changes</p>
                <p className={`text-base font-bold leading-tight ${unsavedCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                  {unsavedCount.toLocaleString()}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">
                  {unsavedCount > 0 ? 'Click Save to persist' : 'All synced'}
                </p>
              </div>
              <div className={`p-1.5 rounded-lg ${unsavedCount > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
                <Save className={unsavedCount > 0 ? 'text-amber-500' : 'text-gray-400'} size={14} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section (Identical styling to Students.jsx) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden shrink-0">
        <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center gap-2 text-[11px] font-bold text-gray-700 uppercase tracking-wider hover:text-gray-900 transition-colors"
            >
              <Filter size={14} />
              <span>Filters</span>
              {filtersExpanded ? (
                <ChevronUp size={14} className="text-gray-500" />
              ) : (
                <ChevronDown size={14} className="text-gray-500" />
              )}
            </button>
            <div className="flex items-center gap-3">
              {!filtersExpanded && filtersReady && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-gray-500">Active:</span>
                  {filters.college && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      College: {filters.college}
                    </span>
                  )}
                  {filters.course && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Course: {filters.course}
                    </span>
                  )}
                  {filters.branch && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Branch: {filters.branch}
                    </span>
                  )}
                  {filters.batch && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                      Batch: {filters.batch}
                    </span>
                  )}
                </div>
              )}
              {(filters.college || filters.course || filters.branch || filters.batch) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {filtersExpanded && (
          <div className="p-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-500 mb-0.5 ml-0.5 uppercase tracking-wide">
                  College
                </label>
                <select
                  value={filters.college}
                  onChange={(e) => handleFilterChange('college', e.target.value)}
                  disabled={collegesLoading}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                >
                  <option value="">Select College</option>
                  {colleges.filter((c) => c.isActive !== false).map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-500 mb-0.5 ml-0.5 uppercase tracking-wide">
                  Course
                </label>
                <select
                  value={filters.course}
                  onChange={(e) => handleFilterChange('course', e.target.value)}
                  disabled={!filters.college || loadingFilters}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                >
                  <option value="">Select Course</option>
                  {quickFilterOptions.courses.map((c) => {
                    const val = typeof c === 'object' ? c.name || c.id : c;
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-500 mb-0.5 ml-0.5 uppercase tracking-wide">
                  Branch
                </label>
                <select
                  value={filters.branch}
                  onChange={(e) => handleFilterChange('branch', e.target.value)}
                  disabled={!filters.course || loadingFilters}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                >
                  <option value="">Select Branch</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-500 mb-0.5 ml-0.5 uppercase tracking-wide">
                  Batch
                </label>
                <select
                  value={filters.batch}
                  onChange={(e) => handleFilterChange('batch', e.target.value)}
                  disabled={!filters.branch || loadingFilters}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                >
                  <option value="">Select Batch</option>
                  {quickFilterOptions.batches.map((b) => {
                    const val = typeof b === 'object' ? b.name || b.id : b;
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-[10px] font-semibold text-gray-500 mb-0.5 ml-0.5 uppercase tracking-wide">
                  Section Status
                </label>
                <select
                  value={filters.sectionStatus || 'all'}
                  onChange={(e) => handleFilterChange('sectionStatus', e.target.value)}
                  disabled={!filtersReady || loadingInitial}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white disabled:bg-gray-100"
                >
                  <option value="all">All {statusCounts.all > 0 ? `(${statusCounts.all})` : ''}</option>
                  <option value="marked">Section Marked {statusCounts.marked > 0 ? `(${statusCounts.marked})` : ''}</option>
                  <option value="not_marked">Not Marked {statusCounts.notMarked > 0 ? `(${statusCounts.notMarked})` : ''}</option>
                </select>
              </div>
            </div>

            {filters.branch && !branchHasSections && students.length === 0 && !loadingInitial && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>Section breakdown is not enabled for this branch. Please enable sections in Course Settings first.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Students Table Container Card */}
      <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 flex flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-900">Students</span>
            {filtersReady && (
              <span className="text-xs text-gray-500">
                ({displayedStudents.length} of {totalStudents} loaded)
              </span>
            )}
            {unsavedCount > 0 && (
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {unsavedCount} unsaved
              </span>
            )}
          </div>

          {filtersReady && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center p-0.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleFilterChange('sectionStatus', 'all')}
                  className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                    filters.sectionStatus === 'all'
                      ? 'bg-white text-blue-600 font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All {statusCounts.all > 0 ? `(${statusCounts.all})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('sectionStatus', 'marked')}
                  className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                    filters.sectionStatus === 'marked'
                      ? 'bg-white text-emerald-600 font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Section Marked {statusCounts.marked > 0 ? `(${statusCounts.marked})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => handleFilterChange('sectionStatus', 'not_marked')}
                  className={`px-2.5 py-1 rounded-md transition-all text-xs ${
                    filters.sectionStatus === 'not_marked'
                      ? 'bg-white text-amber-600 font-semibold shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Not Marked {statusCounts.notMarked > 0 ? `(${statusCounts.notMarked})` : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        {!filtersReady ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-lg text-xs">
            Select College, Course, Branch, and Batch above to view and assign sections.
          </div>
        ) : loadingInitial && students.length === 0 ? (
          <SkeletonTable rows={10} cols={7} />
        ) : displayedStudents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 border border-dashed border-gray-200 rounded-lg text-center p-6 text-xs">
            {searchTerm
              ? `No students matching "${searchTerm}".`
              : filters.sectionStatus === 'marked'
              ? 'No section-marked students found for the selected batch.'
              : filters.sectionStatus === 'not_marked'
              ? 'No unassigned students found. All students have sections assigned!'
              : 'No students found for the selected filters.'}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col min-w-0 overflow-hidden">
            {canEditSection && selectedCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 p-2.5 rounded-lg border border-blue-200 bg-blue-50 shrink-0">
                <div className="text-xs text-blue-900">
                  <span className="font-semibold">{selectedCount}</span>
                  {' student'}
                  {selectedCount === 1 ? '' : 's'}
                  {' selected'}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStudentKeys(new Set())}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg border border-blue-200 bg-white text-blue-700 hover:bg-blue-100"
                  >
                    Clear selection
                  </button>
                  <button
                    type="button"
                    onClick={openBulkAssignModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-xs"
                  >
                    <Users size={14} />
                    Bulk Assign
                  </button>
                </div>
              </div>
            )}

            <div
              ref={scrollContainerRef}
              className="flex-1 min-h-0 overflow-auto border border-gray-200 rounded-lg"
            >
              <table className="min-w-full border-separate border-spacing-0 divide-y divide-gray-200 text-xs">
                <thead>
                  <tr>
                    {canEditSection && (
                      <th className={`${tableHeadCellClass} px-3 w-10 z-20`}>
                        <input
                          type="checkbox"
                          checked={isAllLoadedSelected}
                          onChange={(e) => toggleSelectAllLoaded(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          title="Select all loaded students"
                        />
                      </th>
                    )}
                    <th className={`${tableHeadCellClass} w-12`}>#</th>
                    <th className={tableHeadCellClass}>Batch</th>
                    <th className={tableHeadCellClass}>PIN Number</th>
                    <th className={tableHeadCellClass}>Student Name</th>
                    <th className={tableHeadCellClass}>Course</th>
                    <th className={tableHeadCellClass}>Branch</th>
                    <th className={tableHeadCellClass}>Section</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {displayedStudents.map((student, index) => {
                    const studentKey = getStudentKey(student);
                    const draftValue = normalizeSectionValue(draftSections[studentKey]);
                    const savedValue = normalizeSectionValue(savedSections[studentKey]);
                    const isDirty = draftValue !== savedValue;
                    const isSelected = selectedStudentKeys.has(studentKey);

                    return (
                      <tr
                        key={studentKey}
                        onClick={() => {
                          if (canEditSection) {
                            toggleStudentSelection(studentKey);
                          }
                        }}
                        className={`hover:bg-blue-50/30 transition-colors ${
                          isDirty ? 'bg-amber-50/50' : ''
                        } ${isSelected ? 'bg-blue-50/50' : ''} ${canEditSection ? 'cursor-pointer' : ''}`}
                      >
                        {canEditSection && (
                          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudentSelection(studentKey)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              aria-label={`Select ${student.studentName || student.pinNo || 'student'}`}
                            />
                          </td>
                        )}
                        <td className="px-3 py-2 text-gray-500 text-[11px]">{index + 1}</td>
                        <td className="px-3 py-2 text-gray-900">{student.batch || '-'}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono">{student.pinNo || '-'}</span>
                            {student.studType &&
                              ['LATER', 'LSPOT', 'L.E'].includes(
                                String(student.studType).trim().toUpperCase()
                              ) && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                                  title={`Lateral Entry Quota (${student.studType})`}
                                >
                                  Lateral
                                </span>
                              )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-900">{student.studentName || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{student.course || '-'}</td>
                        <td className="px-3 py-2 text-gray-700">{student.branch || '-'}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={draftValue}
                            onChange={(e) =>
                              handleSectionDraftChange(studentKey, e.target.value)
                            }
                            disabled={!canEditSection || saving}
                            className={`w-full min-w-[120px] border rounded-lg px-2.5 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 bg-white ${
                              isDirty ? 'border-amber-400 bg-amber-50 font-semibold' : 'border-gray-300'
                            }`}
                          >
                            <option value="">— Unassigned —</option>
                            {configuredSectionItems.map((section) => {
                              const val = typeof section === 'object' ? section.name || section.id : section;
                              const label = typeof section === 'object' ? section.name || section.id : section;
                              return (
                                <option key={val} value={val}>
                                  Section {label}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div ref={loadMoreRef} className="py-3 flex justify-center border-t border-gray-100 bg-gray-50/50">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 size={16} className="animate-spin text-blue-600" />
                    Loading more students...
                  </div>
                )}
                {!loadingMore && hasMore && (
                  <span className="text-[11px] text-gray-400">Scroll down for more</span>
                )}
                {!hasMore && students.length > 0 && (
                  <span className="text-[11px] text-gray-500">
                    All {totalStudents.toLocaleString()} students loaded
                  </span>
                )}
              </div>
            </div>

            {canEditSection && (
              <div className="flex justify-end pt-3 mt-2 border-t border-gray-100 shrink-0">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || unsavedCount === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>Save Section Assignments{unsavedCount > 0 ? ` (${unsavedCount})` : ''}</span>
                </button>
              </div>
            )}

            {bulkAssignModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
                <div
                  className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-md overflow-hidden"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="bulk-assign-title"
                >
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                    <div>
                      <h3 id="bulk-assign-title" className="text-sm font-bold text-gray-900">
                        Bulk Assign Section
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {selectedCount} student{selectedCount === 1 ? '' : 's'} selected
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBulkAssignModalOpen(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Select Section
                      </label>
                      <select
                        value={bulkAssignSection}
                        onChange={(e) => setBulkAssignSection(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                        autoFocus
                      >
                        <option value="">None (clear section)</option>
                        {configuredSectionItems.map((section) => {
                          const val = typeof section === 'object' ? section.name || section.id : section;
                          const label = typeof section === 'object' ? section.name || section.id : section;
                          return (
                            <option key={val} value={val}>
                              Section {label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      This updates the draft for selected students. Click Save on the page to store in the database.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setBulkAssignModalOpen(false)}
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkAssignConfirm}
                      disabled={saving}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-xs"
                    >
                      Apply to selected
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PinRangeSeparationModal
        isOpen={pinRangeModalOpen}
        onClose={() => setPinRangeModalOpen(false)}
        filters={filters}
        configuredSections={configuredSectionItems}
        sectionBreakdown={currentSectionBreakdown}
        students={allBatchStudents.length > 0 ? allBatchStudents : students}
        totalStudents={allBatchTotal || totalStudents}
        statusCounts={statusCounts}
        loadingAllStudents={loadingAllStudents}
        onApplyDraft={handleApplyPinRangeDraft}
        onSaveDirectly={handleSavePinRangeDirectly}
        saving={saving}
      />
    </div>
  );
};

export default SectionPartition;
