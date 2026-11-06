import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Wallet,
  Lock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission, isFullAccessRole } from '../constants/rbac';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '-', time: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: String(dateStr), time: '' };
  const date = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return { date, time };
};

function SmsReport() {
  const { user } = useAuthStore();
  const todayStr = useMemo(() => getTodayDateString(), []);

  // Permission check
  const hasAccess = useMemo(() => {
    if (!user) return false;
    if (isFullAccessRole(user.role)) return true;
    return hasPermission(user.permissions, BACKEND_MODULES.REPORTS, 'view_sms_reports');
  }, [user]);

  const [filters, setFilters] = useState({
    date_from: todayStr,
    date_to: todayStr,
    category: '',
    status: '',
    search: ''
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [report, setReport] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const buildParams = useCallback((extra = {}) => {
    const params = new URLSearchParams();
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to) params.append('date_to', filters.date_to);
    if (filters.category) params.append('category', filters.category);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search.trim());
    if (selectedTemplateId) params.append('template_id', selectedTemplateId);
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, v);
    });
    return params;
  }, [filters, selectedTemplateId]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    if (field === 'category') {
      setSelectedTemplateId('');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplateId(templateId);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ date_from: todayStr, date_to: todayStr, category: '', status: '', search: '' });
    setSelectedTemplateId('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/students/reports/sms?${buildParams().toString()}`);
        if (res.data?.success) setReport(res.data.data);
      } catch (err) {
        console.error(err);
        toast.error('Failed to load SMS report');
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [buildParams, refreshKey]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true);
      try {
        const params = buildParams({ page: pagination.page, limit: pagination.limit });
        const res = await api.get(`/students/reports/sms/logs?${params.toString()}`);
        if (res.data?.success) {
          setLogs(res.data.data || []);
          setPagination((prev) => ({ ...prev, ...res.data.pagination }));
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load SMS logs');
      } finally {
        setLogsLoading(false);
      }
    };
    fetchLogs();
  }, [buildParams, refreshKey, pagination.page, pagination.limit]);

  const summary = report?.summary || { total: 0, sent: 0, failed: 0, other: 0 };
  const balance = report?.accountBalance;
  const categories = report?.categories || [];
  const templates = report?.templates || [];

  const categoryCountMap = useMemo(() => {
    const map = {};
    (report?.byCategory || []).forEach((c) => {
      const catName = c.category === 'SMS Template' ? 'General' : c.category;
      map[catName] = (map[catName] || 0) + c.sent;
    });
    return map;
  }, [report?.byCategory]);

  const allCategoryNames = useMemo(() => {
    const set = new Set();
    categories.forEach((cat) => {
      if (cat) {
        const catName = (typeof cat === 'object' ? cat.name || cat.id : cat);
        set.add(catName === 'SMS Template' ? 'General' : catName);
      }
    });
    (report?.byCategory || []).forEach((c) => {
      if (c.category) {
        set.add(c.category === 'SMS Template' ? 'General' : c.category);
      }
    });
    return Array.from(set).sort();
  }, [categories, report?.byCategory]);

  const totalAllSentCount = useMemo(() => {
    return Object.values(categoryCountMap).reduce((sum, val) => sum + Number(val || 0), 0);
  }, [categoryCountMap]);

  const totalTemplateSentCount = useMemo(() => {
    return templates.reduce((acc, t) => acc + (t.sent_count || 0), 0);
  }, [templates]);

  const formatCredits = () => {
    if (!balance) return '—';
    if (balance.testMode) return 'Test mode';
    if (balance.success && balance.credits != null) {
      return Number(balance.credits).toLocaleString('en-IN');
    }
    return 'Unavailable';
  };

  const hasActiveFilters = Boolean(
    filters.category ||
    filters.status ||
    filters.search ||
    selectedTemplateId ||
    filters.date_from !== todayStr ||
    filters.date_to !== todayStr
  );

  const getCategoryDisplayName = (log) => {
    if (log.category === 'SMS Template' || !log.category) {
      return 'General';
    }
    return log.category;
  };

  const getTemplateName = (log) => {
    if (log.template_id) {
      const found = templates.find((t) => String(t.template_id) === String(log.template_id));
      if (found?.name) return found.name;
    }
    const normalizeTemplateText = (value) => String(value || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedMessage = normalizeTemplateText(log.message);
    const matched = templates.find((t) => {
      if (!t.content) return false;
      const parts = t.content.split(/\{#var#\}|\{\{.*?\}\}/);
      const snippet = (parts.find((p) => p.trim().length >= 8) || parts[0] || '').trim();
      return snippet && normalizedMessage.includes(normalizeTemplateText(snippet));
    });
    if (matched?.name) return matched.name;
    if (String(log.category || '').toLowerCase() === 'otp') {
      if (normalizedMessage.includes('parent portal otp')) return 'Parent Portal OTP';
      if (normalizedMessage.includes('semester registration')) return 'Semester Registration OTP';
      return 'OTP SMS';
    }
    return '-';
  };

  if (!hasAccess && user) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] p-4 text-center">
        <div className="w-14 h-14 bg-[var(--danger-light)] rounded-full flex items-center justify-center mb-3">
          <Lock className="text-danger" size={28} />
        </div>
        <h2 className="text-lg font-bold text-main mb-1">Access Denied</h2>
        <p className="text-sub text-xs max-w-sm">
          You do not have permission to view SMS Reports.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 p-3">
      {/* Compact Page header */}
      <header className="shrink-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-[var(--primary-light)] p-1.5 text-primary">
            <MessageSquare size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-main leading-tight">SMS Reports</h1>
            <p className="text-xs text-muted-text leading-tight">Track sent messages and account SMS credits</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-strong text-sub hover:bg-background text-xs font-semibold disabled:opacity-50 transition-all shadow-2xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {/* Compact Summary Cards */}
      <section className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-surface rounded-xl border border-[var(--primary-light)] shadow-2xs p-3">
          <div className="flex items-center gap-1.5 text-primary mb-1">
            <Wallet size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Account Credits</span>
          </div>
          <p className="text-xl font-black text-main">{formatCredits()}</p>
        </div>
        <div className="bg-surface rounded-xl border border-[var(--success-light)] shadow-2xs p-3">
          <div className="flex items-center gap-1.5 text-success mb-1">
            <CheckCircle2 size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sent</span>
          </div>
          <p className="text-xl font-black text-main">{summary.sent}</p>
        </div>
        <div className="bg-surface rounded-xl border border-[var(--danger-light)] shadow-2xs p-3">
          <div className="flex items-center gap-1.5 text-danger mb-1">
            <XCircle size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Failed</span>
          </div>
          <p className="text-xl font-black text-main">{summary.failed}</p>
        </div>
        <div className="bg-surface rounded-xl border border-border shadow-2xs p-3">
          <div className="flex items-center gap-1.5 text-sub mb-1">
            <MessageSquare size={15} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Logged</span>
          </div>
          <p className="text-xl font-black text-main">{summary.total}</p>
        </div>
      </section>

      {/* Main Table Container with Header Controls */}
      <section className="flex-1 min-h-0 bg-surface border border-border rounded-xl shadow-2xs overflow-hidden flex flex-col">
        {/* Top Control Bar with Categories & Sub-filters */}
        <div className="px-3.5 py-2.5 bg-[var(--background)]/80 border-b border-border flex flex-col gap-2 shrink-0">
          {/* Row 1: Activity Title & Compact Filters (Date From, Date To, Status) */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-main uppercase tracking-wider">Recent SMS Activity</h2>
            </div>

            {/* Compact Filters Toolbar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="flex items-center gap-1.5 bg-surface border border-border-strong rounded-lg px-2.5 py-1 shadow-2xs">
                <Search size={13} className="text-muted-text shrink-0" />
                <input
                  type="text"
                  placeholder="Search student, mobile..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="border-none p-0 text-xs focus:ring-0 text-sub bg-transparent font-medium w-36 placeholder:text-muted-text"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface border border-border-strong rounded-lg px-2 py-1 shadow-2xs">
                <span className="text-muted-text font-semibold text-[11px]">From:</span>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => handleFilterChange('date_from', e.target.value)}
                  className="border-none p-0 text-xs focus:ring-0 text-sub bg-transparent font-medium"
                />
              </div>

              <div className="flex items-center gap-1 bg-surface border border-border-strong rounded-lg px-2 py-1 shadow-2xs">
                <span className="text-muted-text font-semibold text-[11px]">To:</span>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => handleFilterChange('date_to', e.target.value)}
                  className="border-none p-0 text-xs focus:ring-0 text-sub bg-transparent font-medium"
                />
              </div>

              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="bg-surface border border-border-strong rounded-lg px-2 py-1 text-xs text-sub font-medium focus:ring-1 focus:ring-primary shadow-2xs"
              >
                <option value="">All Statuses</option>
                <option value="Sent">Sent</option>
                <option value="Failed">Failed</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--danger-light)] text-danger hover:bg-[var(--danger-light)] text-xs font-semibold transition-all shadow-2xs"
                  title="Clear all filters"
                >
                  <XCircle size={13} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Category Pills Row with Individual Sent Counts */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full no-scrollbar">
            <span className="text-[11px] font-bold text-muted-text uppercase tracking-wider shrink-0 mr-1">Category:</span>
            <button
              type="button"
              onClick={() => handleFilterChange('category', '')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                !filters.category
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface text-sub border border-border-strong hover:bg-background'
              }`}
            >
              All ({totalAllSentCount})
            </button>
            {allCategoryNames.map((catName) => {
              const count = categoryCountMap[catName] || 0;
              const isSelected = filters.category === catName;
              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => handleFilterChange('category', catName)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-surface text-sub border border-border-strong hover:bg-background'
                  }`}
                >
                  {catName} ({count})
                </button>
              );
            })}
          </div>

          {/* Row 3: Sub-filters Row for Templates (Visible when General category is selected or a template filter is active) */}
          {(filters.category === 'General' || selectedTemplateId) && templates.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full pt-1.5 border-t border-border no-scrollbar">
              <span className="text-[11px] font-bold text-primary uppercase tracking-wider shrink-0 mr-1">Templates:</span>
              <button
                type="button"
                onClick={() => handleTemplateSelect('')}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  !selectedTemplateId
                    ? 'bg-primary text-white shadow-2xs'
                    : 'bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] hover:bg-[var(--primary-light)]'
                }`}
              >
                All Templates ({totalTemplateSentCount})
              </button>
              {templates.map((tpl) => (
                <button
                  key={tpl.id || tpl.template_id}
                  type="button"
                  onClick={() => handleTemplateSelect(tpl.template_id)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                    selectedTemplateId === tpl.template_id
                      ? 'bg-primary text-white shadow-2xs'
                      : 'bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] hover:bg-[var(--primary-light)]'
                  }`}
                  title={tpl.content}
                >
                  {tpl.name} ({tpl.sent_count || 0})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SMS Logs Table */}
        {/* SMS Logs Table */}
        <div className="flex-1 overflow-y-auto overflow-x-auto">
          {logsLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center py-12 text-xs text-muted-text">No SMS logs found for the selected filters.</p>
          ) : (
            <table className="w-full text-xs table-fixed min-w-[950px]">
              <thead className="bg-background sticky top-0 text-sub font-semibold border-b z-10 shadow-2xs">
                <tr>
                  <th className="w-[72px] px-3 py-2.5 text-left whitespace-nowrap">Status</th>
                  <th className="w-[105px] px-3 py-2.5 text-left whitespace-nowrap">Date</th>
                  <th className="w-[125px] px-3 py-2.5 text-left whitespace-nowrap">Raised By</th>
                  <th className="w-[95px] px-3 py-2.5 text-left whitespace-nowrap">Category</th>
                  <th className="w-[110px] px-3 py-2.5 text-left whitespace-nowrap">Template Name</th>
                  <th className="w-[95px] px-3 py-2.5 text-left whitespace-nowrap">Mobile</th>
                  <th className="w-[185px] px-3 py-2.5 text-left">Student</th>
                  <th className="w-[115px] px-3 py-2.5 text-left">Course</th>
                  <th className="px-3 py-2.5 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[var(--primary-light)] transition-colors cursor-pointer group"
                    title="Click to view message details"
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'Sent' || log.status === 'Delivered'
                          ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                          : 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {(() => {
                        const { date, time } = formatDateTime(log.sent_at);
                        return (
                          <div className="leading-tight">
                            <div className="font-semibold text-main text-[11px]">{date}</div>
                            {time && (
                              <div className="text-[10px] text-muted-text font-mono mt-0.5">
                                {time}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {log.raised_by && log.raised_by !== 'System Generated' && log.raised_by !== 'System' ? (
                        <div className="font-semibold text-main leading-tight truncate" title={log.raised_by}>
                          {log.raised_by}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-background text-sub border border-border">
                          System Generated
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-main truncate" title={getCategoryDisplayName(log)}>
                      {getCategoryDisplayName(log)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold text-primary truncate" title={getTemplateName(log)}>
                      {getTemplateName(log)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-sub">
                      {log.mobile_number}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-main leading-tight truncate" title={log.student_name || ''}>
                        {log.student_name || (log.admission_number ? log.admission_number : '-')}
                      </div>
                      {log.student_name && log.admission_number && (
                        <div className="text-[11px] text-muted-text font-mono leading-tight mt-0.5 truncate">
                          {log.admission_number}
                        </div>
                      )}
                      {/* Student branch & current year & sem details below the student name */}
                      {(log.branch || log.current_year || log.current_semester) && (
                        <div
                          className="text-[11px] text-sub font-medium leading-tight mt-0.5 truncate flex items-center gap-1"
                          title={`${log.branch || ''}${log.current_year ? ` • Year ${log.current_year}` : ''}${log.current_semester ? ` • Sem ${log.current_semester}` : ''}`}
                        >
                          {log.branch && <span className="text-sub font-semibold">{log.branch}</span>}
                          {log.branch && (log.current_year || log.current_semester) && (
                            <span className="text-muted-text">•</span>
                          )}
                          {log.current_year && <span>Yr {log.current_year}</span>}
                          {log.current_year && log.current_semester && <span className="text-muted-text">•</span>}
                          {log.current_semester && <span>Sem {log.current_semester}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-main leading-tight truncate" title={log.course || '-'}>
                        {log.course || '-'}
                      </div>
                      {log.college && (
                        <div className="text-[11px] text-muted-text leading-tight mt-0.5 truncate" title={log.college}>
                          {log.college}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 truncate text-sub group-hover:text-primary transition-colors" title={log.message}>
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-3.5 py-2 border-t border-border bg-[var(--background)]/50 shrink-0">
            <span className="text-xs text-muted-text">Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="p-1 border border-border-strong rounded-md hover:bg-surface disabled:opacity-40"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="p-1 border border-border-strong rounded-md hover:bg-surface disabled:opacity-40"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal for viewing complete SMS details */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-surface rounded-2xl shadow-xl border border-border max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[var(--background)]/70">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-[var(--primary-light)] p-1.5 text-primary">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-main">SMS Log Details</h3>
                  <p className="text-[11px] text-muted-text">
                    {selectedLog.sent_at ? new Date(selectedLog.sent_at).toLocaleString('en-IN') : '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-muted-text hover:text-sub hover:bg-background transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Status, Raised By & Category */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-text block mb-1">Delivery Status</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedLog.status === 'Sent' || selectedLog.status === 'Delivered'
                      ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                      : 'bg-[var(--danger-light)] text-danger border border-[var(--danger-light)]'
                  }`}>
                    {selectedLog.status}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-text block mb-1">Raised By</span>
                  <p className="font-semibold text-main text-[11px] truncate" title={selectedLog.raised_by || selectedLog.sent_by || 'System Generated'}>
                    {selectedLog.raised_by && selectedLog.raised_by !== 'System Generated' && selectedLog.raised_by !== 'System'
                      ? selectedLog.raised_by
                      : 'System Generated'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-background border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-text block mb-1">Category / Template</span>
                  <p className="font-semibold text-main text-[11px] truncate" title={getCategoryDisplayName(selectedLog)}>
                    {getCategoryDisplayName(selectedLog)}
                    {getTemplateName(selectedLog) !== '-' && (
                      <span className="text-primary font-medium ml-1">({getTemplateName(selectedLog)})</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Student & Academic Info */}
              <div className="p-3 rounded-xl bg-[var(--primary-light)] border border-[var(--primary-light)] space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-primary block">Student</span>
                    <p className="font-bold text-main text-sm">
                      {selectedLog.student_name || 'Unlinked Student'}
                    </p>
                    {selectedLog.admission_number && (
                      <p className="text-[11px] font-mono text-muted-text">Adm: {selectedLog.admission_number}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-primary block">Mobile</span>
                    <p className="font-mono font-semibold text-main text-sm">{selectedLog.mobile_number}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--primary-light)] grid grid-cols-4 gap-2 text-center">
                  <div className="bg-surface rounded-lg p-1.5 border border-[var(--primary-light)]">
                    <span className="text-[10px] text-muted-text font-semibold block">Course</span>
                    <span className="font-bold text-main text-[11px] truncate block" title={selectedLog.course || ''}>
                      {selectedLog.course || '-'}
                    </span>
                  </div>
                  <div className="bg-surface rounded-lg p-1.5 border border-[var(--primary-light)]">
                    <span className="text-[10px] text-muted-text font-semibold block">Branch</span>
                    <span className="font-bold text-main text-[11px] truncate block" title={selectedLog.branch || ''}>
                      {selectedLog.branch || '-'}
                    </span>
                  </div>
                  <div className="bg-surface rounded-lg p-1.5 border border-[var(--primary-light)]">
                    <span className="text-[10px] text-muted-text font-semibold block">Year</span>
                    <span className="font-bold text-main text-[11px]">
                      {selectedLog.current_year ? `Year ${selectedLog.current_year}` : '-'}
                    </span>
                  </div>
                  <div className="bg-surface rounded-lg p-1.5 border border-[var(--primary-light)]">
                    <span className="text-[10px] text-muted-text font-semibold block">Semester</span>
                    <span className="font-bold text-main text-[11px]">
                      {selectedLog.current_semester ? `Sem ${selectedLog.current_semester}` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-text block mb-1">Message Content</span>
                <div className="p-3 bg-background rounded-xl border border-border text-main font-mono text-xs leading-relaxed whitespace-pre-wrap select-all">
                  {selectedLog.message}
                </div>
              </div>

              {selectedLog.error_details && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-danger block mb-1">Error Details</span>
                  <div className="p-2.5 bg-[var(--danger-light)] rounded-xl border border-[var(--danger-light)] text-danger font-mono text-[11px]">
                    {selectedLog.error_details}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 bg-background border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-3.5 py-1.5 bg-surface border border-border-strong rounded-lg text-xs font-semibold text-sub hover:bg-background transition-all shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SmsReport;
