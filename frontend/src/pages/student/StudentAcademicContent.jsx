import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../config/api';
import {
  BookOpen,
  FileText,
  Calendar,
  ArrowLeft,
  Search,
  Loader2,
  Award,
  Download,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  LayoutGrid,
  Layers,
  Table as TableIcon
} from 'lucide-react';

const typeLabels = { note: 'Lecture Note', assignment: 'Assignment', test: 'Class Test' };
const typeColors = {
  note: { bg: 'bg-[var(--primary-light)]', text: 'text-primary', border: 'border-[var(--primary-light)]' },
  assignment: { bg: 'bg-[var(--warning-light)]', text: 'text-warning', border: 'border-[var(--warning-light)]' },
  test: { bg: 'bg-[var(--primary-light)]', text: 'text-secondary', border: 'border-[var(--primary-light)]' }
};

const StudentAcademicContent = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary Tab: 'classwork' or 'examinations'
  const initialTab = searchParams.get('tab') === 'examinations' ? 'examinations' : 'classwork';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Update URL param when switching tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams(tab === 'examinations' ? { tab: 'examinations' } : {});
  };

  // --- Class Work State ---
  const [contentList, setContentList] = useState([]);
  const [loadingClassWork, setLoadingClassWork] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- Examinations (EMS Marks) State ---
  const [marksData, setMarksData] = useState([]);
  const [notificationsData, setNotificationsData] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [marksViewMode, setMarksViewMode] = useState('matrix'); // 'matrix' (Consolidated Matrix) | 'sections' (Exam Sections)
  const [studentInfo, setStudentInfo] = useState(null);
  const [loadingMarks, setLoadingMarks] = useState(false);
  const [marksLoaded, setMarksLoaded] = useState(false);
  const [isRefreshingMarks, setIsRefreshingMarks] = useState(false);

  // EMS Filter States
  const [selectedNotificationFilter, setSelectedNotificationFilter] = useState('all');
  const [isCardExpanded, setIsCardExpanded] = useState(true);
  const [viewLayout, setViewLayout] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table'));

  // Fetch Class Work
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const res = await api.get('/academic-content');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setContentList(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load academic content:', err);
      } finally {
        setLoadingClassWork(false);
      }
    };
    fetchContent();
  }, []);

  // Fetch Examinations Marks from EMS (Read-Only)
  const fetchMarks = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshingMarks(true);
    else setLoadingMarks(true);

    try {
      const res = await api.get('/examinations/my-marks');
      if (res.data?.success) {
        setMarksData(res.data.data || []);
        setNotificationsData(res.data.notifications || []);
        setMatrixData(res.data.matrix || null);
        setStudentInfo(res.data.studentInfo || null);
      }
    } catch (err) {
      console.error('Failed to load examination marks from EMS:', err);
    } finally {
      setLoadingMarks(false);
      setIsRefreshingMarks(false);
      setMarksLoaded(true);
    }
  };

  useEffect(() => {
    if (activeTab === 'examinations' && !marksLoaded) {
      fetchMarks();
    }
  }, [activeTab, marksLoaded]);

  // Distinct Notifications for Dropdown
  const notificationOptions = useMemo(() => {
    return notificationsData.map((n) => {
      const regPart = n.regulation && n.regulation !== 'N/A' ? ` (${n.regulation})` : '';
      const typePart = n.examType ? ` [${n.examType}]` : '';
      return {
        key: String(n.key || n.notificationId),
        label: `${n.title || n.examName || 'Exam'}${typePart}${regPart}`
      };
    });
  }, [notificationsData]);


  // Filtered Class Work
  const filteredContent = useMemo(() => {
    return contentList.filter((item) => {
      const matchesType = selectedType === 'all' || item.type === selectedType;
      const matchesSearch =
        !searchQuery ||
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subject_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [contentList, selectedType, searchQuery]);

  // Helper to determine pass status for a subject
  const checkIsPassed = (sub) => {
    if (sub.isAbsent === 1) return false;
    if (sub.passed === 1) return true;
    if (sub.passed === 0) return false;
    if (sub.grade && String(sub.grade).toUpperCase() === 'F') return false;
    if (sub.grade && String(sub.grade).toUpperCase() !== 'F') return true;
    if (sub.internalMarks != null) {
      const mark = parseFloat(sub.internalMarks) || 0;
      const max = parseFloat(sub.maxInternalMarks) || 30;
      return mark >= max * 0.4;
    }
    return true; // Default passed if evaluated
  };

  // Filtered Notifications with Subjects
  const filteredNotifications = useMemo(() => {
    if (!notificationsData.length) return [];

    return notificationsData
      .map((notif) => {
        const notifKey = String(notif.key || notif.notificationId);
        const matchesNotif =
          selectedNotificationFilter === 'all' || notifKey === selectedNotificationFilter;

        if (!matchesNotif) return null;
        return notif;
      })
      .filter(Boolean);
  }, [notificationsData, selectedNotificationFilter]);

  // Dynamic columns filtered by selected notification
  const visibleColumns = useMemo(() => {
    if (!matrixData?.columns) return [];
    if (selectedNotificationFilter === 'all') return matrixData.columns;
    const cleanId = selectedNotificationFilter.replace(/^exam_/, '');
    const matched = matrixData.columns.filter((c) => String(c.id) === String(cleanId));
    return matched.length > 0 ? matched : matrixData.columns;
  }, [matrixData, selectedNotificationFilter]);

  // Matrix Rows for Consolidated Table
  const filteredMatrixRows = useMemo(() => {
    if (!matrixData?.rows) return [];
    return matrixData.rows;
  }, [matrixData]);

  // Overall Statistics based on active view mode
  const allVisibleSubjects = useMemo(() => {
    const list = [];
    filteredNotifications.forEach((n) => {
      list.push(...(n.subjects || []));
    });
    return list;
  }, [filteredNotifications]);

  const totalPapersCount = marksViewMode === 'matrix'
    ? filteredMatrixRows.length
    : allVisibleSubjects.length;

  const totalPassedCount = useMemo(() => {
    if (marksViewMode === 'matrix') {
      return filteredMatrixRows.filter((r) => r.finalInternal?.passed === true).length;
    }
    return allVisibleSubjects.filter((m) => checkIsPassed(m)).length;
  }, [marksViewMode, filteredMatrixRows, allVisibleSubjects]);

  const totalBacklogsCount = totalPapersCount - totalPassedCount;

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-12">
      {/* ── SINGLE-LINE HEADER ── */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 bg-surface px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-border shadow-xs">
        {/* Left: Back button + Title in a single line */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-1.5 sm:p-2 rounded-xl text-muted-text hover:text-main hover:bg-background transition-colors cursor-pointer shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] text-primary flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black text-main tracking-tight whitespace-nowrap">
              Academics
            </h1>
          </div>
        </div>

        {/* Right: Two Main Tabs: "Class Work" & "Examinations" (Single-line Segmented Switcher) */}
        <div className="inline-flex items-center bg-[var(--background)]/90 p-1 rounded-xl border border-border shrink-0">
          <button
            onClick={() => handleTabChange('classwork')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'classwork'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-sub hover:text-main'
            }`}
          >
            <FileText size={14} className="shrink-0" />
            <span>Class Work</span>
          </button>
          <button
            onClick={() => handleTabChange('examinations')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'examinations'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-sub hover:text-main'
            }`}
          >
            <Award size={14} className="shrink-0" />
            <span>Examinations</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: CLASS WORK ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'classwork' && (
        <div className="space-y-4">
          {/* Controls Bar: Type Filters + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: 'all', label: 'All Content' },
                { key: 'note', label: 'Lecture Notes' },
                { key: 'assignment', label: 'Assignments' },
                { key: 'test', label: 'Tests' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedType(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedType === tab.key
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-background text-sub border border-border hover:bg-background'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
              <input
                type="text"
                placeholder="Search subject, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-[var(--background)]/50 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Content List */}
          {loadingClassWork ? (
            <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-border">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-xs font-semibold text-muted-text">Loading academic content...</p>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-border text-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--primary-light)] text-primary flex items-center justify-center mb-3">
                <BookOpen size={26} />
              </div>
              <h3 className="text-base font-bold text-main">No content available</h3>
              <p className="text-xs text-muted-text mt-1 max-w-sm">
                {searchQuery
                  ? 'No materials matched your search criteria.'
                  : 'Your faculty have not uploaded any study material for this section yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredContent.map((item) => {
                const typeStyle = typeColors[item.type] || typeColors.note;
                return (
                  <div
                    key={item.id}
                    className="bg-surface rounded-2xl border border-border p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                        >
                          {typeLabels[item.type] || item.type}
                        </span>
                        {item.due_date && (
                          <span className="text-[10px] font-semibold text-muted-text flex items-center gap-1">
                            <Calendar size={12} />
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-main leading-snug">{item.title}</h3>
                      {item.subject_name && (
                        <p className="text-xs font-semibold text-primary mt-0.5">{item.subject_name}</p>
                      )}
                      {item.description && (
                        <p className="text-xs text-muted-text mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-[10px] font-medium text-muted-text">
                        Posted: {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.file_url ? (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary-light)] text-primary hover:bg-[var(--primary-light)] text-xs font-bold transition-all"
                        >
                          <Download size={13} />
                          Attachment
                        </a>
                      ) : (
                        <span className="text-[11px] font-medium text-muted-text">No file attached</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: EXAMINATIONS (EXACT EMS PORTAL DESIGN) ── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'examinations' && (
        <div className="space-y-4">
          {/* Top Filter Bar: Examination Notification */}
          <div className="bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-2xs">
            <label className="block text-[10px] font-black uppercase tracking-wider text-muted-text mb-1.5">
              Examination Notification
            </label>
            <select
              value={selectedNotificationFilter}
              onChange={(e) => setSelectedNotificationFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-border bg-surface text-main focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)] focus:border-primary transition-all cursor-pointer shadow-xs"
            >
              <option value="all">All Notifications</option>
              {notificationOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Formula & Assessment Header Bar with Mobile View Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-surface p-3 sm:p-3.5 rounded-2xl border border-border shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
              <span className="text-xs font-black text-main tracking-tight">
                Consolidated Internal Assessment
              </span>
              <span className="text-[11px] font-semibold text-muted-text">
                (Semester 3-1 • Regular)
              </span>
              {matrixData?.formula && (
                <span className="text-[10px] font-bold text-sub bg-background border border-border px-2 py-0.5 rounded-md">
                  <span className="text-muted-text font-semibold mr-1">Formula:</span>
                  <span className="text-main font-extrabold">{matrixData.formula}</span>
                </span>
              )}
            </div>

            {/* View Layout Toggle: Cards vs Table */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border">
              <span className="text-[11px] font-semibold text-muted-text sm:hidden">
                {filteredMatrixRows.length} {filteredMatrixRows.length === 1 ? 'Subject' : 'Subjects'}
              </span>
              <div className="inline-flex items-center bg-[var(--background)]/90 p-0.5 rounded-xl border border-border">
                <button
                  onClick={() => setViewLayout('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewLayout === 'cards'
                      ? 'bg-surface text-primary shadow-xs'
                      : 'text-sub hover:text-main'
                  }`}
                  title="Card View (Optimized for Mobile)"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setViewLayout('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewLayout === 'table'
                      ? 'bg-surface text-primary shadow-xs'
                      : 'text-sub hover:text-main'
                  }`}
                  title="Table View (Full Matrix)"
                >
                  <TableIcon size={13} />
                  <span>Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loadingMarks ? (
            <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-border shadow-2xs">
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-xs font-semibold text-muted-text">
                Fetching marks directly from Examination Portal...
              </p>
            </div>
          ) : filteredMatrixRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-surface rounded-2xl border border-border text-center shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-[var(--primary-light)] text-primary flex items-center justify-center mb-3">
                <GraduationCap size={28} />
              </div>
              <h3 className="text-base font-bold text-main">No Assessment Records Found</h3>
              <p className="text-xs text-muted-text mt-1 max-w-md">
                {marksSearchQuery || statusFilter !== 'all'
                  ? 'No subjects match your selected search or status criteria.'
                  : 'Consolidated examination marks will appear here once entered and forwarded in EMS.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile Student Details Card (Shown on mobile devices so table/cards don't need a bulky side-column) */}
              <div className="md:hidden bg-surface p-3.5 rounded-2xl border border-border shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-muted-text">
                      #{matrixData?.student?.sNo || 2}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] shadow-2xs">
                      {matrixData?.student?.rollNumber || studentInfo?.rollNumber || '112233'}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-text">
                      Batch {matrixData?.student?.batch || '2000'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[var(--primary-light)] text-main border border-[var(--primary-light)] shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-primary">Total</span>
                      <span>{matrixData?.student?.totalDisplay?.replace(/^Total\s*/i, '') || '20 / 60'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border flex-wrap">
                  <div className="text-xs sm:text-sm font-black text-main tracking-tight">
                    {matrixData?.student?.campus || studentInfo?.name || 'Draksharamam Campus'}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                      {matrixData?.student?.course || 'CSE'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                      {matrixData?.student?.yearSem || 'Yr 3 / Sem 1'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-background text-sub border border-border">
                      {matrixData?.student?.section || 'Sec A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Layout 1: Mobile Cards View */}
              {viewLayout === 'cards' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredMatrixRows.map((row) => {
                    const isFinalPending = row.finalInternal?.status === 'pending';
                    const isFinalPassed = row.finalInternal?.passed === true;

                    return (
                      <div
                        key={row.subjectCode}
                        className="bg-surface rounded-2xl border border-border shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                      >
                        {/* Card Header: Subject Code & Name + Final Internal Badge */}
                        <div className="p-3.5 sm:p-4 bg-[var(--background)]/60 border-b border-border flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                {row.subjectCode}
                              </span>
                              {row.credits > 0 && (
                                <span className="text-[10px] font-bold text-muted-text">
                                  {row.credits} Credits
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs sm:text-sm font-black text-main mt-1 truncate">
                              {row.subjectName || row.subjectCode}
                            </h4>
                          </div>

                          {/* Final Internal Badge */}
                          <div className="shrink-0 text-right">
                            <div className="text-[9px] font-bold text-muted-text uppercase tracking-wider mb-0.5">
                              Final Internal (/30)
                            </div>
                            {isFinalPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                                Pending
                              </span>
                            ) : isFinalPassed ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[var(--success-light)] text-success border border-[var(--success-light)] shadow-2xs">
                                <span>{row.finalInternal?.display || `${row.finalInternal?.value} / 30`}</span>
                                <span className="text-[9px] uppercase font-bold text-success bg-[var(--success-light)] px-1 py-0.5 rounded">Pass</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] shadow-2xs">
                                <span>{row.finalInternal?.display || `${row.finalInternal?.value} / 30`}</span>
                                <span className="text-[9px] uppercase font-bold text-danger bg-[var(--danger-light)] px-1 py-0.5 rounded">Backlog</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Body: Exam Scores Grid */}
                        <div className="p-3.5 sm:p-4">
                          <div className="text-[10px] font-black uppercase tracking-wider text-muted-text mb-2">
                            Assessments
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                            {(visibleColumns || []).map((col) => {
                              const score = row.scores?.[col.id];
                              const isEntered = score?.status === 'entered';
                              const isPassed = score?.passed === true;

                              return (
                                <div
                                  key={col.id}
                                  className="p-2 sm:p-2.5 rounded-xl border border-border bg-[var(--background)]/50 flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="text-[11px] font-black text-main truncate uppercase tracking-tight">
                                      {col.name}
                                    </div>
                                    <div className="text-[10px] text-muted-text font-semibold capitalize">
                                      {col.type || 'regular'}
                                    </div>
                                  </div>

                                  <div className="mt-2">
                                    {isEntered ? (
                                      <span
                                        className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-black w-full shadow-2xs ${
                                          isPassed
                                            ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                                            : 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
                                        }`}
                                      >
                                        {score.display}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-surface text-muted-text border border-dashed border-border w-full">
                                        Not Entered
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* View Layout 2: Responsive Table (Full Desktop Matrix + Mobile Optimized) */
                <div className="bg-surface rounded-2xl border border-border shadow-2xs overflow-hidden">
                  {/* Mobile swipe hint */}
                  <div className="md:hidden flex items-center justify-between px-3.5 py-2 bg-[var(--background)]/90 border-b border-border text-[11px] font-semibold text-muted-text">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                      Swipe table horizontally to view all exams
                    </span>
                    <span className="font-bold text-primary">Scroll &rarr;</span>
                  </div>

                  <div className="overflow-x-auto touch-pan-x">
                    <table className="w-full text-left border-collapse min-w-[420px] md:min-w-[840px]">
                      <thead>
                        <tr className="bg-[var(--background)]/90 border-b border-border">
                          {/* 1. Student Details Column (Visible only on desktop md:screens) */}
                          <th className="hidden md:table-cell py-3 px-4 text-xs font-black text-main whitespace-nowrap w-[260px] border-r border-border">
                            Student Details
                          </th>

                          {/* 2. Subject Code & Name (Sticky on mobile horizontal scroll) */}
                          <th className="py-3 px-3 sm:px-4 text-xs font-black text-main whitespace-nowrap sticky left-0 md:static z-20 md:z-auto bg-background border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] md:shadow-none min-w-[130px] sm:min-w-[170px] md:w-[200px]">
                            Subject Code &amp; Name
                          </th>

                          {/* 3. Dynamic Exam Columns from EMS */}
                          {(visibleColumns || []).map((col) => (
                            <th key={col.id} className="py-3 px-3 sm:px-4 text-center whitespace-nowrap border-r border-border min-w-[85px] sm:min-w-[110px]">
                              <div className="text-xs font-black text-main uppercase tracking-tight">
                                {col.name}
                              </div>
                              <div className="text-[10px] font-semibold text-muted-text lowercase mt-0.5">
                                {col.type || 'regular'}
                              </div>
                            </th>
                          ))}

                          {/* 4. Final Internal Column */}
                          <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap bg-[var(--primary-light)] min-w-[95px] sm:min-w-[130px]">
                            <div className="text-xs font-black text-main">
                              Final Internal (/30)
                            </div>
                            <div className="text-[10px] font-semibold text-muted-text mt-0.5">
                              {matrixData?.formula || '80% Best + 20% Other • Min 16'}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {filteredMatrixRows.map((row, idx) => (
                          <tr key={row.subjectCode} className="group hover:bg-[var(--primary-light)] transition-colors">
                            {/* Student Details Cell (Rendered once on the first row with rowSpan matching Image 2, hidden on mobile) */}
                            {idx === 0 && (
                              <td
                                rowSpan={filteredMatrixRows.length}
                                className="hidden md:table-cell py-4 px-4 align-top whitespace-nowrap bg-[var(--background)]/30 border-r border-border"
                              >
                                <div className="flex flex-col gap-2 min-w-[220px]">
                                  {/* Index, Roll Number Badge, Batch */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-text">
                                      {matrixData?.student?.sNo || 2}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] shadow-2xs">
                                      {matrixData?.student?.rollNumber || studentInfo?.rollNumber || '112233'}
                                    </span>
                                    <span className="text-[11px] font-semibold text-muted-text">
                                      {matrixData?.student?.batch || '2000'}
                                    </span>
                                  </div>

                                  {/* Campus Name */}
                                  <div className="text-xs sm:text-sm font-black text-main tracking-tight">
                                    {matrixData?.student?.campus || studentInfo?.name || 'Draksharamam Campus'}
                                  </div>

                                  {/* Program, Year/Sem, Section Badges */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                                      {matrixData?.student?.course || 'CSE'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                                      {matrixData?.student?.yearSem || 'Yr 3 / Sem 1'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-background text-sub border border-border">
                                      {matrixData?.student?.section || 'Sec A'}
                                    </span>
                                  </div>

                                  {/* Total Score Badge */}
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-[var(--primary-light)] text-main border border-[var(--primary-light)] shadow-2xs">
                                      <span className="text-[10px] uppercase font-bold text-primary">Total</span>
                                      <span>{matrixData?.student?.totalDisplay || '20 / 60'}</span>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Subject Code & Name (Sticky on mobile horizontal scroll) */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap sticky left-0 md:static z-10 md:z-auto bg-surface group-hover:bg-background md:group-hover:bg-transparent border-r border-border shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] md:shadow-none min-w-[130px] sm:min-w-[170px]">
                              <div className="flex flex-col">
                                <span className="font-black text-main text-xs sm:text-sm tracking-tight">
                                  {row.subjectCode}
                                </span>
                                <span className="text-[11px] font-semibold text-muted-text uppercase tracking-tight truncate max-w-[120px] sm:max-w-[160px] md:max-w-[190px]">
                                  {row.subjectName || row.subjectCode}
                                </span>
                              </div>
                            </td>

                            {/* Scores for Each Exam (Pills matching Image 2) */}
                            {(visibleColumns || []).map((col) => {
                              const score = row.scores?.[col.id];
                              const isEntered = score?.status === 'entered';
                              const isPassed = score?.passed === true;

                              return (
                                <td key={col.id} className="py-3 px-2 sm:px-4 text-center whitespace-nowrap border-r border-border">
                                  {isEntered ? (
                                    <span
                                      className={`inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black min-w-[65px] sm:min-w-[76px] transition-all shadow-2xs ${
                                        isPassed
                                          ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                                          : 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
                                      }`}
                                    >
                                      {score.display}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-surface text-muted-text border border-[var(--primary-light)] min-w-[65px] sm:min-w-[76px]">
                                      Not Entered
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Final Internal Score (Pills matching Image 2) */}
                            <td className="py-3 px-2 sm:px-4 text-center whitespace-nowrap bg-[var(--primary-light)]">
                              {row.finalInternal?.status === 'pending' ? (
                                <span className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] min-w-[75px] sm:min-w-[88px] shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse"></span>
                                  Pending
                                </span>
                              ) : row.finalInternal?.passed ? (
                                <span className="inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black bg-[var(--success-light)] text-success border border-[var(--success-light)] min-w-[65px] sm:min-w-[76px] shadow-2xs">
                                  {row.finalInternal?.display || `${row.finalInternal?.value} / 30`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black bg-[var(--danger-light)] text-danger border border-[var(--danger-light)] min-w-[65px] sm:min-w-[76px] shadow-2xs">
                                  {row.finalInternal?.display || `${row.finalInternal?.value} / 30`}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAcademicContent;
