import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Search,
  RefreshCw,
  Copy,
  Check,
  Phone,
  User,
  AlertTriangle,
  Info,
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldAlert,
  Send,
  Globe,
  Smartphone
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const formatMobileNumber = (raw) => {
  if (!raw) return '—';
  const clean = String(raw).replace(/[^0-9]/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  if (clean.length === 12 && clean.startsWith('91')) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  return raw;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return { date: '—', time: '—', relative: '' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: '—', time: '—', relative: '' };

    const date = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const time = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = '';
    if (diffMins < 1) relative = 'Just now';
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffHours < 24) relative = `${diffHours}h ago`;
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays < 30) relative = `${diffDays}d ago`;

    return { date, time, relative };
  } catch {
    return { date: '—', time: '—', relative: '' };
  }
};

/**
 * Parses notification / SMS message to extract clean title and body if markdown bold is used
 */
const parseMessageContent = (raw) => {
  if (!raw) return { title: null, body: '' };
  const str = String(raw).trim();

  // Pattern: **Title**\nBody or **Title**: Body or **Title**
  const match = str.match(/^\*\*(.*?)\*\*(?:[\r\n\s]+([\s\S]*))?$/);
  if (match) {
    return {
      title: match[1].trim(),
      body: (match[2] || '').trim()
    };
  }

  return {
    title: null,
    body: str
  };
};

const getCategoryBadgeClass = (category) => {
  const cat = String(category || '').toLowerCase();
  if (cat.includes('attend')) return 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]';
  if (cat.includes('event')) return 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]';
  if (cat.includes('announc')) return 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]';
  if (cat.includes('credential') || cat.includes('password') || cat.includes('login') || cat.includes('otp')) {
    return 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
  }
  if (cat.includes('fee')) return 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)]';
  if (cat.includes('exam') || cat.includes('result') || cat.includes('grade')) {
    return 'bg-[var(--success-light)] text-success border-[var(--success-light)]';
  }
  if (cat.includes('service')) return 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
  return 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]';
};

const StudentSmsTab = ({ student }) => {
  const [logs, setLogs] = useState([]);
  const [studentDetails, setStudentDetails] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterChannel, setFilterChannel] = useState('All'); // 'All', 'SMS', 'WEB'
  const [filterStatus, setFilterStatus] = useState('All');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [selectedLogForModal, setSelectedLogForModal] = useState(null);

  const studentIdentifier =
    student?.admission_number ||
    student?.admissionNumber ||
    student?.pin_no ||
    student?.id;

  const fetchLogs = useCallback(async (silent = false) => {
    if (!studentIdentifier) return;
    if (!silent) setLoading(true);
    try {
      const response = await api.get(
        `/students/${encodeURIComponent(studentIdentifier)}/sms-logs`
      );
      if (response.data?.success) {
        setLogs(response.data.data || []);
        setStudentDetails(response.data.studentDetails || null);
        setSummary(response.data.summary || null);
      } else {
        toast.error(response.data?.message || 'Failed to load communications logs');
      }
    } catch (error) {
      console.error('Failed to fetch student SMS logs:', error);
      if (!silent) {
        toast.error(
          error.response?.data?.message || 'Failed to load communications logs for this student'
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [studentIdentifier]);

  useEffect(() => {
    if (studentIdentifier) {
      fetchLogs();
    }
  }, [studentIdentifier, fetchLogs]);

  const currentStudent = studentDetails || student;

  // Map recipient and channel information cleanly
  const getRecipientInfo = useCallback(
    (log) => {
      const isWeb =
        log?.channel === 'WEB' ||
        String(log?.mobile_number || '').toUpperCase().startsWith('WEB');

      if (isWeb) {
        return {
          label: 'Student',
          sublabel: 'Student Portal (Web / App)',
          channel: 'WEB',
          mobile: log?.recipient_mobile || currentStudent?.student_mobile || null,
          badgeLabel: 'Portal / In-App',
          badgeClass: 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]'
        };
      }

      const mobileNumber = log?.mobile_number;
      if (!mobileNumber) {
        return {
          label: 'Student',
          sublabel: 'Registered Contact',
          channel: 'SMS',
          mobile: null,
          badgeLabel: 'Contact',
          badgeClass: 'bg-background text-sub border-border'
        };
      }

      const cleanNum = String(mobileNumber).replace(/[^0-9]/g, '').slice(-10);

      const cleanStudent = String(currentStudent?.student_mobile || '')
        .replace(/[^0-9]/g, '')
        .slice(-10);
      const cleanP1 = String(currentStudent?.parent_mobile1 || '')
        .replace(/[^0-9]/g, '')
        .slice(-10);
      const cleanP2 = String(currentStudent?.parent_mobile2 || '')
        .replace(/[^0-9]/g, '')
        .slice(-10);

      if (cleanStudent && cleanNum === cleanStudent) {
        return {
          label: 'Student',
          sublabel: 'Mobile Handset',
          channel: 'SMS',
          mobile: mobileNumber,
          badgeLabel: 'Student',
          badgeClass: 'bg-[var(--primary-light)] text-primary border-[var(--primary-light)]'
        };
      }
      if (cleanP1 && cleanNum === cleanP1) {
        return {
          label: 'Parent 1 / Father',
          sublabel: 'Guardian Handset',
          channel: 'SMS',
          mobile: mobileNumber,
          badgeLabel: 'Parent 1 / Father',
          badgeClass: 'bg-[var(--success-light)] text-success border-[var(--success-light)]'
        };
      }
      if (cleanP2 && cleanNum === cleanP2) {
        return {
          label: 'Parent 2 / Mother',
          sublabel: 'Guardian Handset',
          channel: 'SMS',
          mobile: mobileNumber,
          badgeLabel: 'Parent 2 / Mother',
          badgeClass: 'bg-[var(--primary-light)] text-secondary border-[var(--primary-light)]'
        };
      }
      return {
        label: 'Registered Contact',
        sublabel: 'SMS Gateway',
        channel: 'SMS',
        mobile: mobileNumber,
        badgeLabel: 'Contact',
        badgeClass: 'bg-background text-sub border-border'
      };
    },
    [currentStudent]
  );

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set();
    logs.forEach((log) => {
      if (log.category && String(log.category).trim()) {
        set.add(String(log.category).trim());
      }
    });
    return ['All', ...Array.from(set)];
  }, [logs]);

  // Filtered and searched logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const isWeb =
        log.channel === 'WEB' ||
        String(log.mobile_number || '').toUpperCase().startsWith('WEB');

      // Channel filter
      if (filterChannel === 'SMS' && isWeb) return false;
      if (filterChannel === 'WEB' && !isWeb) return false;

      // Category filter
      if (
        filterCategory !== 'All' &&
        String(log.category || '').toLowerCase() !== filterCategory.toLowerCase()
      ) {
        return false;
      }

      // Status filter
      if (filterStatus !== 'All') {
        const s = String(log.status || '').toLowerCase();
        if (filterStatus === 'Sent' && s !== 'sent' && s !== 'delivered') {
          return false;
        }
        if (filterStatus === 'Failed' && s !== 'failed') {
          return false;
        }
        if (filterStatus === 'Pending' && s !== 'pending') {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const msg = String(log.message || '').toLowerCase();
        const mobile = String(log.mobile_number || '').toLowerCase();
        const recMobile = String(log.recipient_mobile || '').toLowerCase();
        const category = String(log.category || '').toLowerCase();
        const sentBy = String(log.sent_by || '').toLowerCase();
        const error = String(log.error_details || '').toLowerCase();
        const template = String(log.template_id || '').toLowerCase();

        return (
          msg.includes(query) ||
          mobile.includes(query) ||
          recMobile.includes(query) ||
          category.includes(query) ||
          sentBy.includes(query) ||
          error.includes(query) ||
          template.includes(query)
        );
      }

      return true;
    });
  }, [logs, filterChannel, filterCategory, filterStatus, searchQuery]);

  // Copy message text
  const handleCopy = (id, text) => {
    if (!text) return;
    const cleanText = text.replace(/^\*\*(.*?)\*\*\s*/, '$1\n');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    toast.success('Message content copied to clipboard');
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Toggle expand
  const toggleExpand = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Computed summary
  const totalCount = summary?.total ?? logs.length;
  const totalSmsCount =
    summary?.smsCount ??
    logs.filter(
      (l) =>
        l.channel === 'SMS' ||
        !String(l.mobile_number || '').toUpperCase().startsWith('WEB')
    ).length;
  const totalWebCount =
    summary?.webCount ??
    logs.filter(
      (l) =>
        l.channel === 'WEB' ||
        String(l.mobile_number || '').toUpperCase().startsWith('WEB')
    ).length;

  const sentCount =
    summary?.sent ??
    logs.filter(
      (l) =>
        String(l.status).toLowerCase() === 'sent' ||
        String(l.status).toLowerCase() === 'delivered'
    ).length;
  const failedCount =
    summary?.failed ??
    logs.filter((l) => String(l.status).toLowerCase() === 'failed').length;
  const deliveryRate = totalCount > 0 ? Math.round((sentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner: Registered Phone Numbers on file */}
      <div className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--primary-light)] to-surface rounded-2xl p-4 sm:p-5 border border-[var(--primary-light)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-success ring-4 ring-[var(--success-light)]" />
            <h4 className="text-sm font-bold text-main tracking-tight">
              Portal Communications & SMS History
            </h4>
            <span className="text-xs bg-[var(--primary-light)] text-primary font-semibold px-2 py-0.5 rounded-full">
              Till Date
            </span>
          </div>
          <p className="text-xs text-sub">
            All SMS dispatches and portal notifications sent to this student and guardians
            (Attendance alerts, events, announcements, credentials, notices, and OTPs).
          </p>
        </div>

        {/* Contact Numbers Quick Reference */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {currentStudent?.student_mobile && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface rounded-xl border border-[var(--primary-light)] text-main shadow-2xs">
              <Phone size={12} className="text-primary shrink-0" />
              <span className="text-muted-text font-medium">Student:</span>
              <span className="font-bold text-primary">
                {formatMobileNumber(currentStudent.student_mobile)}
              </span>
            </div>
          )}
          {currentStudent?.parent_mobile1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface rounded-xl border border-[var(--success-light)] text-main shadow-2xs">
              <Phone size={12} className="text-success shrink-0" />
              <span className="text-muted-text font-medium">Parent 1:</span>
              <span className="font-bold text-success">
                {formatMobileNumber(currentStudent.parent_mobile1)}
              </span>
            </div>
          )}
          {currentStudent?.parent_mobile2 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface rounded-xl border border-[var(--primary-light)] text-main shadow-2xs">
              <Phone size={12} className="text-secondary shrink-0" />
              <span className="text-muted-text font-medium">Parent 2:</span>
              <span className="font-bold text-secondary">
                {formatMobileNumber(currentStudent.parent_mobile2)}
              </span>
            </div>
          )}

          <button
            onClick={() => fetchLogs()}
            disabled={loading}
            title="Refresh communications history"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-background active:bg-background text-sub font-semibold rounded-xl border border-border shadow-2xs transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-primary' : 'text-muted-text'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Communications */}
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs hover:border-[var(--primary-light)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-text">
              Total Messages
            </span>
            <div className="p-2 rounded-xl bg-[var(--primary-light)] text-primary">
              <Send size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-main">{totalCount}</span>
            <span className="text-xs font-medium text-muted-text">all time</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-text mt-1">
            <span className="font-semibold text-primary">{totalSmsCount} SMS</span>
            <span>•</span>
            <span className="font-semibold text-secondary">{totalWebCount} Portal</span>
          </div>
        </div>

        {/* Delivered / Sent */}
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs hover:border-[var(--success-light)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-success">
              Delivered / Sent
            </span>
            <div className="p-2 rounded-xl bg-[var(--success-light)] text-success">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-success">{sentCount}</span>
            <span className="text-xs font-bold text-success bg-[var(--success-light)] px-1.5 py-0.5 rounded-md">
              {deliveryRate}%
            </span>
          </div>
          <p className="text-[11px] text-muted-text mt-1">Successfully dispatched</p>
        </div>

        {/* Failed */}
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs hover:border-[var(--danger-light)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-danger">
              Delivery Issues
            </span>
            <div className="p-2 rounded-xl bg-[var(--danger-light)] text-danger">
              <XCircle size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-danger">{failedCount}</span>
            {failedCount > 0 && (
              <span className="text-xs font-bold text-danger bg-[var(--danger-light)] px-1.5 py-0.5 rounded-md">
                Failed
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-text mt-1">SMS gateway / network errors</p>
        </div>

        {/* Latest Activity */}
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-2xs hover:border-[var(--primary-light)] transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Latest Dispatch
            </span>
            <div className="p-2 rounded-xl bg-[var(--primary-light)] text-primary">
              <Clock size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            {logs.length > 0 ? (
              <div>
                <span className="text-sm font-bold text-main block truncate">
                  {formatDateTime(logs[0].sent_at).date}
                </span>
                <span className="text-[11px] text-primary font-semibold">
                  {formatDateTime(logs[0].sent_at).relative || formatDateTime(logs[0].sent_at).time}
                </span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-muted-text">None yet</span>
            )}
          </div>
          <p className="text-[11px] text-muted-text mt-1">Most recent communication</p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[var(--primary-light)] text-primary rounded-xl">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-bold text-main text-sm sm:text-base">
                Communications History
              </h3>
              <p className="text-xs text-muted-text">
                Showing {filteredLogs.length} of {logs.length} records
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[220px] flex-1 sm:flex-initial">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search text, phone, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface transition-all text-main"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-sub text-xs font-bold"
                >
                  ×
                </button>
              )}
            </div>

            {/* Channel Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs">
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
                className="bg-transparent text-sub font-semibold focus:outline-none cursor-pointer"
              >
                <option value="All">All Channels</option>
                <option value="SMS">SMS Gateway Only</option>
                <option value="WEB">Portal / In-App Only</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs">
              <Filter size={13} className="text-muted-text shrink-0" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-sub font-semibold focus:outline-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'All' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sub font-semibold focus:outline-none cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Sent">Delivered / Sent</option>
                <option value="Failed">Failed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            {(searchQuery || filterChannel !== 'All' || filterCategory !== 'All' || filterStatus !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterChannel('All');
                  setFilterCategory('All');
                  setFilterStatus('All');
                }}
                className="text-xs text-primary hover:text-primary font-semibold px-2 py-1 rounded-lg hover:bg-[var(--primary-light)] transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-text">
            <Loader2 className="animate-spin text-primary mb-3" size={32} />
            <p className="text-xs font-medium">Fetching communications records...</p>
          </div>
        ) : filteredLogs.length > 0 ? (
          /* Logs Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--background)]/80 text-sub uppercase text-[11px] font-bold border-b border-border tracking-wider">
                <tr>
                  <th className="px-4 sm:px-6 py-3.5 w-[120px]">Status</th>
                  <th className="px-4 sm:px-6 py-3.5 w-[200px]">Recipient & Channel</th>
                  <th className="px-4 sm:px-6 py-3.5 w-[130px]">Category</th>
                  <th className="px-4 sm:px-6 py-3.5 min-w-[340px]">Message / SMS Content</th>
                  <th className="px-4 sm:px-6 py-3.5 w-[160px]">Sent By / Academic</th>
                  <th className="px-4 sm:px-6 py-3.5 w-[150px]">Date & Time (IST)</th>
                  <th className="px-3 py-3.5 w-[60px] text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((log) => {
                  const statusStr = String(log.status || 'Pending').toLowerCase();
                  const isSuccess = statusStr === 'sent' || statusStr === 'delivered';
                  const isFailed = statusStr === 'failed';
                  const recipient = getRecipientInfo(log);
                  const isWeb = recipient.channel === 'WEB';
                  const isExpanded = expandedIds.has(log.id);
                  const dt = formatDateTime(log.sent_at);
                  const parsed = parseMessageContent(log.message);
                  const fullText = parsed.title ? `${parsed.title}: ${parsed.body}` : parsed.body;
                  const isLongMessage = fullText.length > 130;

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[var(--primary-light)] transition-colors group"
                    >
                      {/* Status */}
                      <td className="px-4 sm:px-6 py-4 align-top">
                        <div className="flex items-center gap-1.5">
                          {isSuccess && (
                            <CheckCircle2 size={16} className="text-success shrink-0" />
                          )}
                          {isFailed && (
                            <XCircle size={16} className="text-danger shrink-0" />
                          )}
                          {!isSuccess && !isFailed && (
                            <Clock size={16} className="text-warning shrink-0" />
                          )}
                          <span
                            className={`font-bold text-xs ${
                              isSuccess
                                ? 'text-success'
                                : isFailed
                                ? 'text-danger'
                                : 'text-warning'
                            }`}
                          >
                            {log.status || 'Pending'}
                          </span>
                        </div>
                        {isFailed && log.error_details && (
                          <div
                            className="mt-1 text-[10px] text-danger bg-[var(--danger-light)] border border-[var(--danger-light)] rounded p-1 max-w-[140px] truncate"
                            title={log.error_details}
                          >
                            {log.error_details}
                          </div>
                        )}
                      </td>

                      {/* Recipient & Channel */}
                      <td className="px-4 sm:px-6 py-4 align-top">
                        <div className="space-y-1">
                          {isWeb ? (
                            <>
                              <div className="flex items-center gap-1.5 font-bold text-main text-xs">
                                <Globe size={13} className="text-secondary shrink-0" />
                                <span>Student Portal</span>
                              </div>
                              {recipient.mobile && (
                                <div className="text-[11px] text-sub font-medium">
                                  Mobile: <span className="font-semibold text-main">{formatMobileNumber(recipient.mobile)}</span>
                                </div>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${recipient.badgeClass}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                                {recipient.badgeLabel}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-1.5 font-bold text-main text-xs font-mono">
                                <Smartphone size={13} className="text-primary shrink-0" />
                                <span>{formatMobileNumber(log.mobile_number)}</span>
                              </div>
                              <div className="text-[11px] text-muted-text font-medium">
                                {recipient.label}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${recipient.badgeClass}`}
                              >
                                {recipient.badgeLabel}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 sm:px-6 py-4 align-top">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold border ${getCategoryBadgeClass(
                              log.category
                            )}`}
                          >
                            {log.category || 'General'}
                          </span>
                          {log.template_id && (
                            <div
                              className="text-[10px] text-muted-text font-mono truncate max-w-[120px]"
                              title={`Template ID: ${log.template_id}`}
                            >
                              TID: {log.template_id}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Message Content */}
                      <td className="px-4 sm:px-6 py-4 align-top">
                        <div className="space-y-2">
                          <div
                            className={`text-main text-xs leading-relaxed ${
                              !isExpanded && isLongMessage ? 'line-clamp-2' : ''
                            }`}
                          >
                            {parsed.title ? (
                              <div className="space-y-1">
                                <div className="font-bold text-main flex items-center gap-1.5">
                                  <span className="h-1.5 w-1.5 rounded-full bg-secondary shrink-0" />
                                  <span>{parsed.title}</span>
                                </div>
                                {parsed.body && (
                                  <div className="text-sub whitespace-pre-wrap">
                                    {parsed.body}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{parsed.body || '—'}</div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 pt-0.5">
                            {isLongMessage && (
                              <button
                                onClick={() => toggleExpand(log.id)}
                                className="text-[11px] font-semibold text-primary hover:text-primary flex items-center gap-0.5"
                              >
                                {isExpanded ? (
                                  <>
                                    Show less <ChevronUp size={12} />
                                  </>
                                ) : (
                                  <>
                                    Show more <ChevronDown size={12} />
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              onClick={() => handleCopy(log.id, log.message)}
                              className="text-[11px] text-muted-text hover:text-sub flex items-center gap-1 font-medium transition-colors"
                              title="Copy message content"
                            >
                              {copiedId === log.id ? (
                                <>
                                  <Check size={12} className="text-success" />
                                  <span className="text-success font-semibold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Sent By / Academic Year */}
                      <td className="px-4 sm:px-6 py-4 align-top text-sub">
                        <div className="space-y-1">
                          <div className="font-semibold text-main flex items-center gap-1 text-xs">
                            <User size={12} className="text-muted-text shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {log.sent_by || (isWeb ? 'Portal System' : 'System Automated')}
                            </span>
                          </div>
                          {(log.current_year || log.current_semester) && (
                            <div className="text-[11px] text-muted-text font-medium">
                              {log.current_year && `Year ${log.current_year}`}
                              {log.current_year && log.current_semester && ' • '}
                              {log.current_semester && `Sem ${log.current_semester}`}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 sm:px-6 py-4 align-top whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="font-bold text-main text-xs flex items-center gap-1">
                            <Calendar size={11} className="text-muted-text" />
                            <span>{dt.date}</span>
                          </div>
                          <div className="text-[11px] text-muted-text flex items-center gap-1">
                            <Clock size={11} className="text-muted-text" />
                            <span>{dt.time}</span>
                            {dt.relative && (
                              <span className="text-[10px] text-primary font-medium ml-1">
                                ({dt.relative})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-4 align-top text-center">
                        <button
                          onClick={() => setSelectedLogForModal(log)}
                          className="p-1.5 rounded-lg text-muted-text hover:text-primary hover:bg-[var(--primary-light)] transition-colors"
                          title="View Full Technical Details"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
            <div className="p-4 bg-[var(--primary-light)] text-primary rounded-2xl mb-3">
              <MessageSquare size={36} className="opacity-80" />
            </div>
            <h4 className="text-base font-bold text-main mb-1">
              {searchQuery || filterChannel !== 'All' || filterCategory !== 'All' || filterStatus !== 'All'
                ? 'No matching communications found'
                : 'No communications sent to this student yet'}
            </h4>
            <p className="text-xs text-muted-text max-w-md mb-4">
              {searchQuery || filterChannel !== 'All' || filterCategory !== 'All' || filterStatus !== 'All'
                ? 'Try adjusting your search keywords, channel, category, or status filter.'
                : 'All SMS messages and portal notifications dispatched to this student or their registered mobile numbers will be tracked and displayed here.'}
            </p>
            {(searchQuery || filterChannel !== 'All' || filterCategory !== 'All' || filterStatus !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterChannel('All');
                  setFilterCategory('All');
                  setFilterStatus('All');
                }}
                className="text-xs font-bold text-primary hover:text-primary bg-[var(--primary-light)] px-3 py-1.5 rounded-xl border border-[var(--primary-light)] hover:bg-[var(--primary-light)] transition-all"
              >
                Reset All Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal: Full Technical Details of selected SMS */}
      {selectedLogForModal && (() => {
        const modalRecipient = getRecipientInfo(selectedLogForModal);
        const modalIsWeb = modalRecipient.channel === 'WEB';
        const modalParsed = parseMessageContent(selectedLogForModal.message);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-surface rounded-2xl shadow-xl border border-border max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
                <div className="flex items-center gap-2">
                  <MessageSquare size={18} className="text-primary" />
                  <h3 className="font-bold text-main text-sm">
                    {modalIsWeb ? 'Portal Notification Details' : 'SMS Dispatch Details'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLogForModal(null)}
                  className="text-muted-text hover:text-sub text-lg font-bold p-1 rounded-lg"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                {/* Status and Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-background rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase text-muted-text block mb-1">
                      Delivery Status
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        selectedLogForModal.status === 'Sent' ||
                        selectedLogForModal.status === 'Delivered'
                          ? 'text-success'
                          : selectedLogForModal.status === 'Failed'
                          ? 'text-danger'
                          : 'text-warning'
                      }`}
                    >
                      {selectedLogForModal.status || 'Pending'}
                    </span>
                  </div>

                  <div className="p-3 bg-background rounded-xl border border-border">
                    <span className="text-[10px] font-bold uppercase text-muted-text block mb-1">
                      Category & Channel
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-main">
                        {selectedLogForModal.category || 'General'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-background text-sub">
                        {modalIsWeb ? 'Portal' : 'SMS'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="p-3 bg-background rounded-xl border border-border space-y-1">
                  <span className="text-[10px] font-bold uppercase text-muted-text block">
                    Recipient Information
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-main">
                        {modalIsWeb ? 'Student Portal (Web / Mobile App)' : formatMobileNumber(selectedLogForModal.mobile_number)}
                      </div>
                      <div className="text-[11px] text-muted-text">
                        Target: {modalRecipient.label}
                        {modalRecipient.mobile && modalIsWeb && (
                          <span className="ml-1 text-sub font-semibold">
                            ({formatMobileNumber(modalRecipient.mobile)})
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${modalRecipient.badgeClass}`}
                    >
                      {modalRecipient.badgeLabel}
                    </span>
                  </div>
                </div>

                {/* Message Content */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold uppercase text-muted-text">
                      Content
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(selectedLogForModal.id, selectedLogForModal.message)
                      }
                      className="text-[11px] text-primary hover:text-primary font-semibold flex items-center gap-1"
                    >
                      <Copy size={11} /> Copy Content
                    </button>
                  </div>
                  <div className="p-3.5 bg-background rounded-xl border border-border text-main leading-relaxed font-sans select-all">
                    {modalParsed.title && (
                      <div className="font-bold text-main text-xs mb-1">
                        {modalParsed.title}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{modalParsed.body}</div>
                  </div>
                </div>

                {/* Error Details if Failed */}
                {selectedLogForModal.error_details && (
                  <div className="p-3 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-xl">
                    <div className="flex items-center gap-1.5 text-danger font-bold mb-1">
                      <ShieldAlert size={14} />
                      <span>Gateway Error Reason</span>
                    </div>
                    <p className="text-danger font-mono text-[11px]">
                      {selectedLogForModal.error_details}
                    </p>
                  </div>
                )}

                {/* Metadata Key Values */}
                <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                  <div>
                    <span className="text-muted-text font-medium block">Sent At:</span>
                    <span className="font-semibold text-main">
                      {formatDateTime(selectedLogForModal.sent_at).date}{' '}
                      {formatDateTime(selectedLogForModal.sent_at).time}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-text font-medium block">Sent By:</span>
                    <span className="font-semibold text-main">
                      {selectedLogForModal.sent_by || (modalIsWeb ? 'Portal System' : 'System Automated')}
                    </span>
                  </div>

                  {selectedLogForModal.template_id && (
                    <div>
                      <span className="text-muted-text font-medium block">Template ID:</span>
                      <span className="font-mono text-main">
                        {selectedLogForModal.template_id}
                      </span>
                    </div>
                  )}

                  {selectedLogForModal.message_id && (
                    <div>
                      <span className="text-muted-text font-medium block">Gateway Msg ID:</span>
                      <span className="font-mono text-main">
                        {selectedLogForModal.message_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 border-t border-border bg-background flex justify-end">
                <button
                  onClick={() => setSelectedLogForModal(null)}
                  className="px-4 py-2 bg-sidebar hover:bg-sidebar text-white font-semibold rounded-xl text-xs transition-all shadow-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StudentSmsTab;
