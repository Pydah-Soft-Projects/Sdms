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
  note: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  assignment: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  test: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
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
      <div className="flex items-center justify-between gap-2 sm:gap-4 bg-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Left: Back button + Title in a single line */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate('/student/dashboard')}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen size={18} />
            </div>
            <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
              Academics
            </h1>
          </div>
        </div>

        {/* Right: Two Main Tabs: "Class Work" & "Examinations" (Single-line Segmented Switcher) */}
        <div className="inline-flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70 shrink-0">
          <button
            onClick={() => handleTabChange('classwork')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'classwork'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText size={14} className="shrink-0" />
            <span>Class Work</span>
          </button>
          <button
            onClick={() => handleTabChange('examinations')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'examinations'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
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
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search subject, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Content List */}
          {loadingClassWork ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">Loading academic content...</p>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <BookOpen size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No content available</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
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
                    className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                        >
                          {typeLabels[item.type] || item.type}
                        </span>
                        {item.due_date && (
                          <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                            <Calendar size={12} />
                            Due: {new Date(item.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h3>
                      {item.subject_name && (
                        <p className="text-xs font-semibold text-blue-600 mt-0.5">{item.subject_name}</p>
                      )}
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed whitespace-pre-wrap">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-slate-400">
                        Posted: {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.file_url ? (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition-all"
                        >
                          <Download size={13} />
                          Attachment
                        </a>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-400">No file attached</span>
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
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
              Examination Notification
            </label>
            <select
              value={selectedNotificationFilter}
              onChange={(e) => setSelectedNotificationFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer shadow-xs"
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Consolidated Internal Assessment
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                (Semester 3-1 • Regular)
              </span>
              {matrixData?.formula && (
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">
                  <span className="text-slate-400 font-semibold mr-1">Formula:</span>
                  <span className="text-slate-800 font-extrabold">{matrixData.formula}</span>
                </span>
              )}
            </div>

            {/* View Layout Toggle: Cards vs Table */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <span className="text-[11px] font-semibold text-slate-400 sm:hidden">
                {filteredMatrixRows.length} {filteredMatrixRows.length === 1 ? 'Subject' : 'Subjects'}
              </span>
              <div className="inline-flex items-center bg-slate-100/90 p-0.5 rounded-xl border border-slate-200/70">
                <button
                  onClick={() => setViewLayout('cards')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewLayout === 'cards'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
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
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <p className="text-xs font-semibold text-slate-500">
                Fetching marks directly from Examination Portal...
              </p>
            </div>
          ) : filteredMatrixRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-200/80 text-center shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                <GraduationCap size={28} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Assessment Records Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {marksSearchQuery || statusFilter !== 'all'
                  ? 'No subjects match your selected search or status criteria.'
                  : 'Consolidated examination marks will appear here once entered and forwarded in EMS.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Mobile Student Details Card (Shown on mobile devices so table/cards don't need a bulky side-column) */}
              <div className="md:hidden bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-400">
                      #{matrixData?.student?.sNo || 2}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs">
                      {matrixData?.student?.rollNumber || studentInfo?.rollNumber || '112233'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400">
                      Batch {matrixData?.student?.batch || '2000'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-slate-800 border border-blue-200/90 shadow-2xs">
                      <span className="text-[10px] uppercase font-bold text-blue-600">Total</span>
                      <span>{matrixData?.student?.totalDisplay?.replace(/^Total\s*/i, '') || '20 / 60'}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                  <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    {matrixData?.student?.campus || studentInfo?.name || 'Draksharamam Campus'}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                      {matrixData?.student?.course || 'CSE'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {matrixData?.student?.yearSem || 'Yr 3 / Sem 1'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
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
                        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                      >
                        {/* Card Header: Subject Code & Name + Final Internal Badge */}
                        <div className="p-3.5 sm:p-4 bg-slate-50/60 border-b border-slate-100 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/80">
                                {row.subjectCode}
                              </span>
                              {row.credits > 0 && (
                                <span className="text-[10px] font-bold text-slate-400">
                                  {row.credits} Credits
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 truncate">
                              {row.subjectName || row.subjectCode}
                            </h4>
                          </div>

                          {/* Final Internal Badge */}
                          <div className="shrink-0 text-right">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                              Final Internal (/30)
                            </div>
                            {isFinalPending ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-amber-50 text-amber-700 border border-amber-300 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Pending
                              </span>
                            ) : isFinalPassed ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs">
                                <span>{row.finalInternal?.display || `${row.finalInternal?.value} / 30`}</span>
                                <span className="text-[9px] uppercase font-bold text-emerald-700 bg-emerald-100/70 px-1 py-0.5 rounded">Pass</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-300 shadow-2xs">
                                <span>{row.finalInternal?.display || `${row.finalInternal?.value} / 30`}</span>
                                <span className="text-[9px] uppercase font-bold text-rose-700 bg-rose-100/70 px-1 py-0.5 rounded">Backlog</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Body: Exam Scores Grid */}
                        <div className="p-3.5 sm:p-4">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
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
                                  className="p-2 sm:p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="text-[11px] font-black text-slate-800 truncate uppercase tracking-tight">
                                      {col.name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-semibold capitalize">
                                      {col.type || 'regular'}
                                    </div>
                                  </div>

                                  <div className="mt-2">
                                    {isEntered ? (
                                      <span
                                        className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-black w-full shadow-2xs ${
                                          isPassed
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                        }`}
                                      >
                                        {score.display}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center px-2 py-1 rounded-lg text-[11px] font-semibold bg-white text-slate-400 border border-dashed border-slate-200 w-full">
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
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  {/* Mobile swipe hint */}
                  <div className="md:hidden flex items-center justify-between px-3.5 py-2 bg-slate-50/90 border-b border-slate-200/70 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Swipe table horizontally to view all exams
                    </span>
                    <span className="font-bold text-blue-600">Scroll &rarr;</span>
                  </div>

                  <div className="overflow-x-auto touch-pan-x">
                    <table className="w-full text-left border-collapse min-w-[420px] md:min-w-[840px]">
                      <thead>
                        <tr className="bg-slate-50/90 border-b border-slate-200/80">
                          {/* 1. Student Details Column (Visible only on desktop md:screens) */}
                          <th className="hidden md:table-cell py-3 px-4 text-xs font-black text-slate-800 whitespace-nowrap w-[260px] border-r border-slate-200/80">
                            Student Details
                          </th>

                          {/* 2. Subject Code & Name (Sticky on mobile horizontal scroll) */}
                          <th className="py-3 px-3 sm:px-4 text-xs font-black text-slate-800 whitespace-nowrap sticky left-0 md:static z-20 md:z-auto bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] md:shadow-none min-w-[130px] sm:min-w-[170px] md:w-[200px]">
                            Subject Code &amp; Name
                          </th>

                          {/* 3. Dynamic Exam Columns from EMS */}
                          {(visibleColumns || []).map((col) => (
                            <th key={col.id} className="py-3 px-3 sm:px-4 text-center whitespace-nowrap border-r border-slate-200/80 min-w-[85px] sm:min-w-[110px]">
                              <div className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                {col.name}
                              </div>
                              <div className="text-[10px] font-semibold text-slate-400 lowercase mt-0.5">
                                {col.type || 'regular'}
                              </div>
                            </th>
                          ))}

                          {/* 4. Final Internal Column */}
                          <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap bg-blue-50/20 min-w-[95px] sm:min-w-[130px]">
                            <div className="text-xs font-black text-slate-800">
                              Final Internal (/30)
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                              {matrixData?.formula || '80% Best + 20% Other • Min 16'}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {filteredMatrixRows.map((row, idx) => (
                          <tr key={row.subjectCode} className="group hover:bg-blue-50/20 transition-colors">
                            {/* Student Details Cell (Rendered once on the first row with rowSpan matching Image 2, hidden on mobile) */}
                            {idx === 0 && (
                              <td
                                rowSpan={filteredMatrixRows.length}
                                className="hidden md:table-cell py-4 px-4 align-top whitespace-nowrap bg-slate-50/30 border-r border-slate-200/80"
                              >
                                <div className="flex flex-col gap-2 min-w-[220px]">
                                  {/* Index, Roll Number Badge, Batch */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400">
                                      {matrixData?.student?.sNo || 2}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-50 text-blue-700 border border-blue-200/90 shadow-2xs">
                                      {matrixData?.student?.rollNumber || studentInfo?.rollNumber || '112233'}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-400">
                                      {matrixData?.student?.batch || '2000'}
                                    </span>
                                  </div>

                                  {/* Campus Name */}
                                  <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                                    {matrixData?.student?.campus || studentInfo?.name || 'Draksharamam Campus'}
                                  </div>

                                  {/* Program, Year/Sem, Section Badges */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                                      {matrixData?.student?.course || 'CSE'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      {matrixData?.student?.yearSem || 'Yr 3 / Sem 1'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                                      {matrixData?.student?.section || 'Sec A'}
                                    </span>
                                  </div>

                                  {/* Total Score Badge */}
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-50 text-slate-800 border border-blue-200/90 shadow-2xs">
                                      <span className="text-[10px] uppercase font-bold text-blue-600">Total</span>
                                      <span>{matrixData?.student?.totalDisplay || '20 / 60'}</span>
                                    </span>
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Subject Code & Name (Sticky on mobile horizontal scroll) */}
                            <td className="py-3 px-3 sm:px-4 whitespace-nowrap sticky left-0 md:static z-10 md:z-auto bg-white group-hover:bg-slate-50 md:group-hover:bg-transparent border-r border-slate-200/80 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] md:shadow-none min-w-[130px] sm:min-w-[170px]">
                              <div className="flex flex-col">
                                <span className="font-black text-slate-900 text-xs sm:text-sm tracking-tight">
                                  {row.subjectCode}
                                </span>
                                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-tight truncate max-w-[120px] sm:max-w-[160px] md:max-w-[190px]">
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
                                <td key={col.id} className="py-3 px-2 sm:px-4 text-center whitespace-nowrap border-r border-slate-100">
                                  {isEntered ? (
                                    <span
                                      className={`inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black min-w-[65px] sm:min-w-[76px] transition-all shadow-2xs ${
                                        isPassed
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {score.display}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center px-2 sm:px-3.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-white text-slate-400 border border-blue-200/80 min-w-[65px] sm:min-w-[76px]">
                                      Not Entered
                                    </span>
                                  )}
                                </td>
                              );
                            })}

                            {/* Final Internal Score (Pills matching Image 2) */}
                            <td className="py-3 px-2 sm:px-4 text-center whitespace-nowrap bg-blue-50/10">
                              {row.finalInternal?.status === 'pending' ? (
                                <span className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-50/80 text-amber-700 border border-amber-300 min-w-[75px] sm:min-w-[88px] shadow-2xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                  Pending
                                </span>
                              ) : row.finalInternal?.passed ? (
                                <span className="inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-300 min-w-[65px] sm:min-w-[76px] shadow-2xs">
                                  {row.finalInternal?.display || `${row.finalInternal?.value} / 30`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center px-2.5 sm:px-4 py-1.5 rounded-lg text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 min-w-[65px] sm:min-w-[76px] shadow-2xs">
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
