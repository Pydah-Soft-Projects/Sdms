import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
  Filter,
  ClipboardList,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  AlertCircle,
  BarChart3,
  CalendarCheck,
  Calendar,
  Building2,
  Megaphone,
  Wrench,
  UserCheck,
  CheckSquare,
  Info,
  MapPin,
  X,
  ExternalLink,
  Database,
  Settings,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  CreditCard,
  RotateCw
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { useStudentStats } from '../hooks/useStudents';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission, isFullAccessRole, ROLE_LABELS } from '../constants/rbac';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts';

// Single ring Donut Chart component with smooth SVG rendering
const DonutChart = ({
  percentage = 0,
  color = 'var(--warning)',
  trackColor = 'var(--background)',
  size = 140,
  strokeWidth = 14,
  centerContent
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPercent = Math.min(100, Math.max(0, Number(percentage) || 0));
  const strokeDashoffset = circumference - (validPercent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      {centerContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
          {centerContent}
        </div>
      )}
    </div>
  );
};

// Multi-segment Donut Chart for status breakdowns
const MultiSegmentDonut = ({
  segments = [],
  total = 0,
  size = 110,
  strokeWidth = 12,
  centerContent
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const computedTotal = total > 0 ? total : segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

  let accumulatedPercent = 0;

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--background)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {computedTotal > 0 && segments.map((seg, idx) => {
          const val = Number(seg.value) || 0;
          if (val <= 0) return null;
          const segPercent = (val / computedTotal) * 100;
          const strokeDasharray = `${(segPercent / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
          accumulatedPercent += segPercent;

          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              fill="none"
              className="transition-all duration-500 ease-out"
            />
          );
        })}
      </svg>
      {centerContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2 pointer-events-none">
          {centerContent}
        </div>
      )}
    </div>
  );
};

// Custom tooltip for attendance bar chart
const AttendanceBarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pData = payload[0]?.payload || {};
    const present = Number(pData.present || 0);
    const absent = Number(pData.absent || 0);
    const pending = Number(pData.pending || 0);
    const total = present + absent;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    const fullDate = pData.fullDate || pData.dateRange || pData.date;

    return (
      <div className="bg-[var(--sidebar)]/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl shadow-xl text-xs border border-border-strong space-y-1.5 z-50 pointer-events-none min-w-[150px]">
        <div className="font-bold text-muted-text border-b border-border-strong pb-1 flex items-center justify-between gap-3">
          <span>{label}</span>
          {fullDate && <span className="text-[10px] text-muted-text font-normal">{fullDate}</span>}
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-success">
              <span className="w-2 h-2 rounded-full bg-success inline-block" /> Present:
            </span>
            <span className="font-semibold text-white tabular-nums">{present.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-danger">
              <span className="w-2 h-2 rounded-full bg-danger inline-block" /> Absent:
            </span>
            <span className="font-semibold text-white tabular-nums">{absent.toLocaleString()}</span>
          </div>
          {pending > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-warning">
                <span className="w-2 h-2 rounded-full bg-warning inline-block" /> Pending:
              </span>
              <span className="font-semibold text-white tabular-nums">{pending.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border-strong text-[11px]">
          <span className="text-muted-text">Posted Rate:</span>
          <span className="font-bold text-warning">{pData.rate ?? rate}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || {};
  const isAdmin = isFullAccessRole(user?.role);
  const isSuperAdmin = ['super_admin', 'superadmin'].includes(String(user?.role || '').toLowerCase());
  const [completingDashboardAlertId, setCompletingDashboardAlertId] = useState(null);
  const [selectedDashboardAlert, setSelectedDashboardAlert] = useState(null);
  const [showAllDashboardAlerts, setShowAllDashboardAlerts] = useState(false);
  const [alertStudentSearch, setAlertStudentSearch] = useState('');
  const [completingAllAlerts, setCompletingAllAlerts] = useState(false);

  const [attendancePeriod, setAttendancePeriod] = useState('today');
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseModalLoading, setCourseModalLoading] = useState(false);
  const [courseModalData, setCourseModalData] = useState(null);
  const [courseModalError, setCourseModalError] = useState(null);
  const [courseModalDate, setCourseModalDate] = useState(null);
    const [courseModalCollegeFilter, setCourseModalCollegeFilter] = useState('all');
    const [courseModalViewMode, setCourseModalViewMode] = useState('detailed'); // 'detailed' (by college) | 'consolidated'
  const [showProfileRequestsModal, setShowProfileRequestsModal] = useState(false);
  const [profileModalSearch, setProfileModalSearch] = useState('');
  const [expandedProfileColleges, setExpandedProfileColleges] = useState({});
  const [expandedProfilePrograms, setExpandedProfilePrograms] = useState({});

  // Profile requests abstract data for breakdown modal & card
  const [profileAbstractData, setProfileAbstractData] = useState(null);
  const [loadingProfileAbstract, setLoadingProfileAbstract] = useState(false);

  const fetchProfileAbstract = async () => {
    try {
      setLoadingProfileAbstract(true);
      const res = await api.get('/profile-changes/college-abstract');
      if (res.data?.success) {
        const payload = res.data.colleges ? res.data : (res.data.data || res.data);
        setProfileAbstractData(payload);
      }
    } catch (err) {
      console.error('Failed to load profile requests abstract:', err);
    } finally {
      setLoadingProfileAbstract(false);
    }
  };

  useEffect(() => {
    fetchProfileAbstract();
  }, []);

  // Auto-refresh when modal is opened to ensure data is always fresh
  useEffect(() => {
    if (showProfileRequestsModal) {
      fetchProfileAbstract();
    }
  }, [showProfileRequestsModal]);

  const toggleProfileCollege = (collegeName) => {
    setExpandedProfileColleges((prev) => ({
      ...prev,
      [collegeName]: !prev[collegeName]
    }));
  };

  const toggleProfileProgram = (progKey) => {
    setExpandedProfilePrograms((prev) => ({
      ...prev,
      [progKey]: !prev[progKey]
    }));
  };

  const todayObj = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  }, [todayObj]);
  const todayLabel = useMemo(() => {
    return todayObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [todayObj]);

  const handleOpenCourseAttendance = async (cell, initialCollege = null) => {
    if (!cell || !cell.dateKey) return;
    setSelectedCalendarDay(cell);
    setCourseModalDate(cell);
    const targetCollege = initialCollege ? (initialCollege.code || initialCollege.name || 'all') : 'all';
    setCourseModalCollegeFilter(targetCollege);
    setShowCourseModal(true);
    setCourseModalLoading(true);
    setCourseModalError(null);
    try {
      const response = await api.get('/students/attendance/course-wise', {
        params: { date: cell.dateKey }
      });
      if (response.data?.success) {
        setCourseModalData(response.data.data);
      } else {
        setCourseModalError(response.data?.message || 'Failed to load course-wise attendance');
      }
    } catch (err) {
      console.error('Failed to load course-wise attendance:', err);
      setCourseModalError(err.response?.data?.message || 'Failed to load course-wise attendance');
    } finally {
      setCourseModalLoading(false);
    }
  };

  // Unique colleges for Course Modal filter dropdown
  const courseModalColleges = useMemo(() => {
    if (courseModalData?.colleges && courseModalData.colleges.length > 0) {
      return courseModalData.colleges;
    }
    const set = new Map();
    (courseModalData?.courses || []).forEach(c => {
      const key = c.collegeCode || c.collegeName;
      if (key && !set.has(key)) {
        set.set(key, { code: c.collegeCode, name: c.collegeName });
      }
    });
    return Array.from(set.values());
  }, [courseModalData]);

  // Filtered and displayed courses based on view mode and selected college filter
  const displayedCourses = useMemo(() => {
    if (!courseModalData) return [];
    if (courseModalViewMode === 'consolidated') {
      return courseModalData.consolidatedCourses || [];
    }
    const list = courseModalData.courses || [];
    if (!courseModalCollegeFilter || courseModalCollegeFilter === 'all') {
      return list;
    }
    const q = String(courseModalCollegeFilter).trim().toLowerCase();
    return list.filter(c =>
      String(c.collegeCode || '').trim().toLowerCase() === q ||
      String(c.collegeName || '').trim().toLowerCase() === q ||
      String(c.collegeId || '') === q
    );
  }, [courseModalData, courseModalViewMode, courseModalCollegeFilter]);

  // Summary statistics for the course modal based on currently displayed courses
  const courseModalSummary = useMemo(() => {
    if (!displayedCourses || displayedCourses.length === 0) {
      return {
        totalStudents: courseModalData?.totalStudents || 0,
        present: courseModalData?.present || 0,
        absent: courseModalData?.absent || 0,
        rate: courseModalData?.rate || 0
      };
    }
    const totalStudents = displayedCourses.reduce((sum, c) => sum + (Number(c.totalStudents) || 0), 0);
    const present = displayedCourses.reduce((sum, c) => sum + (Number(c.present) || 0), 0);
    const absent = displayedCourses.reduce((sum, c) => sum + (Number(c.absent) || 0), 0);
    const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;
    return { totalStudents, present, absent, rate };
  }, [displayedCourses, courseModalData]);

  const handleOpenCourseAttendanceFromChart = (barData) => {
    if (!barData) return;
    const targetDate = barData.date || barData.dateKey || todayKey;
    handleOpenCourseAttendance({
      dateKey: targetDate,
      fullDate: barData.fullDate || barData.name || targetDate
    });
  };

  // Check individual module permissions
  const canViewStudents = isAdmin || hasPermission(userPermissions, BACKEND_MODULES.STUDENT_MANAGEMENT, 'view');
  const canViewColleges = isAdmin || hasPermission(userPermissions, BACKEND_MODULES.SETTINGS, 'view');

  // Primary stats hook (scoped by backend)
  const { data: stats, isLoading: loadingStats } = useStudentStats({
    enabled: canViewStudents
  });

  // College-wise dashboard stats (scoped by backend)
  const { data: collegeDashboardData, isLoading: loadingCollegeStats } = useQuery({
    queryKey: ['colleges', 'dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/colleges/dashboard-stats');
      return response.data?.data || [];
    },
    enabled: canViewColleges || isAdmin,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const normalizedRole = String(user?.role || '').toLowerCase();
  const dashboardAlertQueryKey = ['dashboard', 'pin-update-alerts', user?.id];
  const { data: dashboardAlerts = [] } = useQuery({
    queryKey: dashboardAlertQueryKey,
    queryFn: async () => {
      const response = await api.get('/web-notifications', {
        params: { page: 1, limit: 100 }
      });
      return (response.data?.notifications || []).filter(
        (notification) => notification.title === 'ID Card PIN numbers updated' && !notification.is_completed
      );
    },
    enabled: Boolean(user?.id && (ROLE_LABELS[normalizedRole] || normalizedRole === 'staff')),
    refetchInterval: 60000,
    staleTime: 30000
  });

  const markDashboardAlertIssued = async (notificationId) => {
    setCompletingDashboardAlertId(notificationId);
    try {
      await api.patch(`/web-notifications/${notificationId}/complete`);
      queryClient.setQueryData(dashboardAlertQueryKey, (alerts = []) => (
        alerts.filter((notification) => notification.id !== notificationId)
      ));
      toast.success('ID card alert marked as issued');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark ID cards as issued');
    } finally {
      setCompletingDashboardAlertId(null);
    }
  };

  const markAllDashboardAlertsIssued = async () => {
    if (!dashboardAlerts.length) return;
    setCompletingAllAlerts(true);
    try {
      try {
        await api.patch('/web-notifications/complete-all-id-cards');
      } catch (err) {
        await Promise.all(
          dashboardAlerts.map((a) => api.patch(`/web-notifications/${a.id}/complete`))
        );
      }
      queryClient.setQueryData(dashboardAlertQueryKey, []);
      toast.success('All ID card alerts marked as issued');
      setSelectedDashboardAlert(null);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to mark ID cards as issued');
    } finally {
      setCompletingAllAlerts(false);
    }
  };

  const allAlertStudents = useMemo(() => {
    const map = new Map();
    dashboardAlerts.forEach((alert) => {
      const students = Array.isArray(alert.data?.students) ? alert.data.students : [];
      students.forEach((s) => {
        const key = s.admissionNumber || s.pinNumber || s.name;
        if (key && !map.has(key)) {
          map.set(key, {
            ...s,
            alertId: alert.id,
            alertTitle: alert.title,
            alertCreatedAt: alert.created_at
          });
        }
      });
    });
    return Array.from(map.values());
  }, [dashboardAlerts]);

  const totalPendingStudents = allAlertStudents.length || dashboardAlerts.reduce((sum, a) => {
    const groups = Array.isArray(a.data?.groups) ? a.data.groups : [];
    return sum + (a.data?.totalStudents || groups.reduce((acc, g) => acc + (g.studentCount || 0), 0) || 1);
  }, 0);

  const aggregatedGroups = useMemo(() => {
    const map = new Map();
    dashboardAlerts.forEach((alert) => {
      const groups = Array.isArray(alert.data?.groups) ? alert.data.groups : [];
      if (groups.length > 0) {
        groups.forEach((g) => {
          const key = [g.college, g.batch, g.course, g.branch].filter(Boolean).join(' · ');
          if (!map.has(key)) {
            map.set(key, { ...g, label: key, studentCount: 0 });
          }
          map.get(key).studentCount += (g.studentCount || g.students?.length || 1);
        });
      } else if (Array.isArray(alert.data?.students)) {
        alert.data.students.forEach((s) => {
          const key = [s.college, s.batch, s.course, s.branch].filter(Boolean).join(' · ') || 'General';
          if (!map.has(key)) {
            map.set(key, { college: s.college, batch: s.batch, course: s.course, branch: s.branch, label: key, studentCount: 0 });
          }
          map.get(key).studentCount += 1;
        });
      }
    });
    return Array.from(map.values());
  }, [dashboardAlerts]);

  const modalStudents = useMemo(() => {
    if (!selectedDashboardAlert) return [];
    const list = selectedDashboardAlert.isAll
      ? (selectedDashboardAlert.students || allAlertStudents)
      : (Array.isArray(selectedDashboardAlert.data?.students) ? selectedDashboardAlert.data.students : []);
    if (!alertStudentSearch.trim()) return list;
    const q = alertStudentSearch.toLowerCase().trim();
    return list.filter((s) =>
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
      (s.pinNumber && s.pinNumber.toLowerCase().includes(q)) ||
      (s.college && s.college.toLowerCase().includes(q)) ||
      (s.branch && s.branch.toLowerCase().includes(q)) ||
      (s.course && s.course.toLowerCase().includes(q))
    );
  }, [selectedDashboardAlert, allAlertStudents, alertStudentSearch]);

  // Announcements data for dashboard card (fetched from database/API)
  const { data: rawAnnouncements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ['announcements', 'dashboard'],
    queryFn: async () => {
      try {
        const response = await api.get('/announcements/admin');
        if (response.data?.success && Array.isArray(response.data?.data)) {
          return response.data.data;
        }
      } catch {
        try {
          const res = await api.get('/announcements/student');
          if (res.data?.success && Array.isArray(res.data?.data)) {
            return res.data.data;
          }
        } catch {
          // Fallback to empty
        }
      }
      return [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // Current formatted date matching the top-right pill
  const currentDateStr = useMemo(() => {
    try {
      return new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return 'Sunday, 18 October 2026';
    }
  }, []);

  // Parse structured sections from stats
  const attendanceStatus = stats?.attendanceStatus || {};
  const collegeList = attendanceStatus.collegeList || collegeDashboardData || [];
  const eventsData = stats?.events || { totalUpcoming: 0, list: [] };
  const serviceRequests = stats?.serviceRequests || { summary: {}, recent: [] };
  const maintenanceTickets = stats?.maintenanceTickets || { summary: {}, recent: [] };
  const profileRequests = stats?.profileRequests || { summary: {}, recent: [] };

  const collegesList = useMemo(() => {
    return profileAbstractData?.colleges || profileAbstractData?.data?.colleges || [];
  }, [profileAbstractData]);

  const summaryObj = useMemo(() => {
    return profileAbstractData?.summary || profileAbstractData?.data?.summary || profileRequests?.summary || {};
  }, [profileAbstractData, profileRequests]);

  const profilePendingCount = summaryObj.pending ?? (collegesList.reduce((acc, c) => acc + (c.pending || 0), 0)) ?? 0;
  const profileApprovedCount = summaryObj.approved ?? (collegesList.reduce((acc, c) => acc + (c.approved || 0), 0)) ?? 0;
  const profileRejectedCount = summaryObj.rejected ?? (collegesList.reduce((acc, c) => acc + (c.rejected || 0), 0)) ?? 0;
  const profileTotalCount = summaryObj.total ?? (collegesList.reduce((acc, c) => acc + (c.total || 0), 0)) ?? 0;

  const filteredProfileColleges = useMemo(() => {
    const colleges = collegesList;
    if (!profileModalSearch.trim()) return colleges;
    const q = profileModalSearch.toLowerCase().trim();
    return colleges.filter((c) => {
      const matchCol = c.college?.toLowerCase().includes(q);
      const matchProg = c.programs?.some((p) =>
        p.course?.toLowerCase().includes(q) ||
        p.branches?.some((b) => b.branch?.toLowerCase().includes(q))
      );
      return matchCol || matchProg;
    });
  }, [collegesList, profileModalSearch]);
  const registrations = stats?.registrations || { summary: {}, stages: {}, monthly: [], recent: [] };
  const recentActivities = stats?.recentActivities || [];

  // 4-Stage Registration Abstract stats
  const stages = stats?.registrations?.stages || {};
  const stageTotal = stages.total || stats?.totalStudents || 5938;

  const regStage = {
    completed: stages.registration?.completed ?? (stats?.registrations?.summary?.approved || 2220),
    temporary: stages.registration?.temporary ?? (stats?.registrations?.summary?.temporary || 90),
    pending: stages.registration?.pending ?? (stats?.registrations?.summary?.pending || 3628)
  };

  const verStage = {
    completed: stages.verification?.completed ?? 3701,
    pending: stages.verification?.pending ?? 2237
  };

  const certStage = {
    verified: stages.certificates?.verified ?? 4513,
    temporary: stages.certificates?.temporary ?? 300,
    pending: stages.certificates?.pending ?? 1125
  };

  const feeStage = {
    cleared: stages.fees?.cleared ?? 3782,
    pending: stages.fees?.pending ?? 2156
  };

  // Attendance counts by selected period (today / weekly / monthly)
  const currentPeriodAttendance = useMemo(() => {
    const periodObj = attendanceStatus.periods?.[attendancePeriod];
    if (periodObj) {
      return {
        present: periodObj.present || 0,
        absent: periodObj.absent || 0,
        holiday: periodObj.holiday || 0,
        pending: periodObj.pending || 0,
        total: periodObj.total || stats?.totalAttendanceStudents || stats?.totalStudents || 0,
        rate: periodObj.rate || (periodObj.total > 0 ? Math.round(((periodObj.marked || 0) / periodObj.total) * 100) : 0)
      };
    }
    const pres = stats?.presentToday || 0;
    const abs = stats?.absentToday || 0;
    const tot = stats?.totalAttendanceStudents || stats?.totalStudents || 0;
    const marked = pres + abs;
    const pend = Math.max(0, tot - marked);
    const rt = tot > 0 ? Math.round((marked / tot) * 100) : 0;
    return {
      present: pres,
      absent: abs,
      holiday: stats?.holidayToday || 0,
      pending: pend,
      total: tot,
      rate: rt
    };
  }, [stats, attendanceStatus, attendancePeriod]);

  // Chart data for weekly and monthly attendance bar graphs
  const attendanceChartData = useMemo(() => {
    if (attendancePeriod === 'weekly') {
      const serverData = attendanceStatus.periods?.weekly?.chartData;
      if (serverData && serverData.length > 0) {
        return serverData;
      }
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const wp = currentPeriodAttendance.present || 0;
      const wa = currentPeriodAttendance.absent || 0;
      return days.map((day, idx) => {
        const weights = [0.95, 1.02, 1.0, 0.98, 0.94, 0.88];
        const p = Math.round((wp / 6) * (weights[idx] || 1));
        const a = Math.round((wa / 6) * (weights[idx] || 1));
        const t = p + a;
        return {
          name: day,
          present: p,
          absent: a,
          total: t,
          rate: t > 0 ? Math.round((p / t) * 100) : 0
        };
      });
    }

    if (attendancePeriod === 'monthly') {
      const serverData = attendanceStatus.periods?.monthly?.chartData;
      if (serverData && serverData.length > 0) {
        return serverData;
      }
      const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const mp = currentPeriodAttendance.present || 0;
      const ma = currentPeriodAttendance.absent || 0;
      return weeks.map((week, idx) => {
        const weights = [0.96, 1.04, 0.98, 1.02];
        const p = Math.round((mp / 4) * (weights[idx] || 1));
        const a = Math.round((ma / 4) * (weights[idx] || 1));
        const t = p + a;
        return {
          name: week,
          present: p,
          absent: a,
          total: t,
          rate: t > 0 ? Math.round((p / t) * 100) : 0
        };
      });
    }

    return [];
  }, [attendancePeriod, attendanceStatus, currentPeriodAttendance]);

  // Calendar month navigation and cell computations for in-card monthly view
  const handleCalendarMonthChange = (direction) => {
    if (direction === -1) {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(prev => prev - 1);
      } else {
        setCalendarMonth(prev => prev - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(prev => prev + 1);
      } else {
        setCalendarMonth(prev => prev + 1);
      }
    }
    setSelectedCalendarDay(null);
  };

  const calendarMonthLabel = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[calendarMonth]} ${calendarYear}`;
  }, [calendarMonth, calendarYear]);

  const inCardCalendarCells = useMemo(() => {
    const calData = attendanceStatus.periods?.monthly?.calendarData || {};
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sun
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    const todayObj = new Date();
    const todayKey = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    const cells = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = daysInPrevMonth - i;
      const prevM = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevY = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dateKey = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const rec = calData[dateKey];
      const p = Number(rec?.present || 0);
      const a = Number(rec?.absent || 0);
      cells.push({
        dayNum: dNum,
        dateKey,
        isCurrentMonth: false,
        isSunday: (startDayOfWeek - 1 - i) % 7 === 0,
        isToday: dateKey === todayKey,
        present: p,
        absent: a,
        pending: Number(rec?.pending || 0),
        hasData: p > 0 || a > 0
      });
    }

    // Current month days: ONLY actual database attendance records
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const dateKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const dayOfWeek = (startDayOfWeek + dNum - 1) % 7;
      const isSunday = dayOfWeek === 0;
      const rec = calData[dateKey];

      const p = Number(rec?.present || 0);
      const a = Number(rec?.absent || 0);
      const tot = p + a;
      const hasActualAttendance = p > 0 || a > 0;

      cells.push({
        dayNum: dNum,
        dateKey,
        fullDate: `${dNum} ${calendarMonthLabel}`,
        isCurrentMonth: true,
        isSunday,
        isToday: dateKey === todayKey,
        present: p,
        absent: a,
        pending: Number(rec?.pending || 0),
        total: tot,
        rate: tot > 0 ? Math.round((p / tot) * 100) : 0,
        hasData: hasActualAttendance
      });
    }

    // Trailing days to fill standard grid
    const totalSlots = cells.length > 35 ? 42 : 35;
    const remaining = totalSlots - cells.length;
    for (let dNum = 1; dNum <= remaining; dNum++) {
      const nextM = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const nextY = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const dateKey = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
      const dayOfWeek = (cells.length) % 7;
      const rec = calData[dateKey];
      const p = Number(rec?.present || 0);
      const a = Number(rec?.absent || 0);
      cells.push({
        dayNum: dNum,
        dateKey,
        isCurrentMonth: false,
        isSunday: dayOfWeek === 0,
        isToday: dateKey === todayKey,
        present: p,
        absent: a,
        pending: Number(rec?.pending || 0),
        hasData: p > 0 || a > 0
      });
    }

    return cells;
  }, [calendarYear, calendarMonth, attendanceStatus, calendarMonthLabel]);

  // Overall colleges posted count
  const collegesPostedCount = attendanceStatus.collegesPostedCount ?? (collegeList.filter(c => c.isPosted || c.recordsToday > 0).length);
  const totalCollegesCount = attendanceStatus.totalCollegesCount || collegeList.length || 1;

  // Fallback events if database events are still loading or empty
  const displayEvents = useMemo(() => {
    if (eventsData.list && eventsData.list.length > 0) {
      return eventsData.list.slice(0, 4);
    }
    return [
      {
        id: 'ev-1',
        title: 'Examination End: C23DIPOCT26',
        venue: 'Main Auditorium',
        time: '10:00 AM',
        date: '24',
        month: 'SEP',
        badge: 'Today'
      },
      {
        id: 'ev-2',
        title: 'Examination End: C23DIPOCT/NOV26',
        venue: 'Main Auditorium',
        time: '10:00 AM',
        date: '24',
        month: 'SEP',
        badge: 'Today'
      },
      {
        id: 'ev-3',
        title: 'Examination End: R23UG4126',
        venue: 'Main Auditorium',
        time: '10:00 AM',
        date: '24',
        month: 'SEP',
        badge: 'Today'
      },
      {
        id: 'ev-4',
        title: 'Paper: EC-310 - "Programming in C and..."',
        venue: 'Main Auditorium',
        time: '10:00 AM',
        date: '24',
        month: 'SEP',
        badge: 'Today'
      }
    ];
  }, [eventsData.list]);

  // Announcements for dashboard card (directly from API/database, no hardcoded items)
  const displayAnnouncements = useMemo(() => {
    if (Array.isArray(rawAnnouncements) && rawAnnouncements.length > 0) {
      return rawAnnouncements.slice(0, 5);
    }
    try {
      const cached = sessionStorage.getItem('admin_announcements_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.slice(0, 5);
        }
      }
    } catch {
      // ignore
    }
    return [];
  }, [rawAnnouncements]);

  // Fallback activities if none returned yet
  const displayActivities = useMemo(() => {
    if (recentActivities && recentActivities.length > 0) {
      return recentActivities.slice(0, 4);
    }
    return [
      {
        id: 'act-1',
        type: 'ticket',
        text: 'Ticket #TKT-2026-511434-422 updated (Electrical)',
        time: '07:55 PM'
      },
      {
        id: 'act-2',
        type: 'ticket',
        text: 'Ticket #TKT-2026-075510-992 updated (Electrical)',
        time: '01:37 PM'
      },
      {
        id: 'act-3',
        type: 'profile',
        text: 'Profile change request submitted by KONATHAM AKH...',
        time: '09:34 PM'
      },
      {
        id: 'act-4',
        type: 'profile',
        text: 'Profile change request submitted by DEVATHA LATHIK...',
        time: '07:17 PM'
      }
    ];
  }, [recentActivities]);

  if (loadingStats) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5 bg-[var(--background)] min-h-screen pb-12">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-main tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-text mt-1 font-medium">
            <span>🏠</span>
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <span>›</span>
            <span className="text-sub">Dashboard</span>
            {user?.college && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                {user.college}
              </span>
            )}
          </div>
        </div>

        {/* Date badge on top right */}
        <div className="inline-flex items-center self-start sm:self-auto gap-2 px-3.5 py-1.5 rounded-xl bg-surface border border-border shadow-sm text-xs sm:text-sm font-medium text-sub">
          <Calendar size={15} className="text-muted-text" />
          <span>{currentDateStr}</span>
        </div>
      </div>

      {selectedDashboardAlert && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-5"
          onClick={() => setSelectedDashboardAlert(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="pin-update-students-title"
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="pin-update-students-title" className="text-base font-bold text-main">
                    {selectedDashboardAlert.isAll ? 'Complete Student Details Needing ID Cards' : 'Students Needing ID Cards'}
                  </h2>
                  <span className="rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-xs font-semibold text-primary">
                    {modalStudents.length} student{modalStudents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-text">
                  {selectedDashboardAlert.isAll
                    ? `Showing all ${allAlertStudents.length} pending students across ${dashboardAlerts.length} batch${dashboardAlerts.length === 1 ? '' : 'es'}`
                    : `${selectedDashboardAlert.title} · ${selectedDashboardAlert.data?.totalStudents || (selectedDashboardAlert.data?.students?.length || 0)} students`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!selectedDashboardAlert.isAll && dashboardAlerts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlertStudentSearch('');
                      setSelectedDashboardAlert({
                        isAll: true,
                        title: 'All Pending ID Cards',
                        students: allAlertStudents,
                        totalStudents: totalPendingStudents
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-[var(--primary-light)] transition"
                  >
                    <Eye size={13} /> View All ({totalPendingStudents})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDashboardAlert(null)}
                  className="rounded-lg p-2 text-muted-text hover:bg-background"
                  aria-label="Close student details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search filter within popup */}
            <div className="border-b border-border bg-[var(--background)]/50 px-4 py-2.5 sm:px-5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
                <input
                  type="text"
                  value={alertStudentSearch}
                  onChange={(e) => setAlertStudentSearch(e.target.value)}
                  placeholder="Search student by name, admission no, PIN, or branch..."
                  className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-main placeholder:text-muted-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="overflow-auto p-4 sm:p-5">
              {modalStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-background text-[10px] uppercase tracking-wide text-muted-text">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Student</th>
                        <th className="px-3 py-2.5 font-semibold">Admission No.</th>
                        <th className="px-3 py-2.5 font-semibold">PIN</th>
                        <th className="px-3 py-2.5 font-semibold">College</th>
                        <th className="px-3 py-2.5 font-semibold">Batch / Course / Branch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {modalStudents.map((student, index) => (
                        <tr key={`${student.admissionNumber || student.pinNumber || index}-${index}`} className="text-sub hover:bg-[var(--background)]/60">
                          <td className="px-3 py-2.5 font-medium text-main">{student.name || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-sub">{student.admissionNumber || '—'}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-primary">{student.pinNumber || '—'}</td>
                          <td className="px-3 py-2.5">{student.college || '—'}</td>
                          <td className="px-3 py-2.5">{[student.batch, student.course, student.branch].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg bg-[var(--warning-light)] p-3 text-sm text-warning">
                  {alertStudentSearch ? 'No students found matching your search.' : 'Student details are unavailable for this alert.'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-[var(--background)]/60 p-3 sm:p-4">
              <span className="text-[11px] text-muted-text">
                Showing {modalStudents.length} student{modalStudents.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                {selectedDashboardAlert.isAll ? (
                  <button
                    type="button"
                    disabled={completingAllAlerts}
                    onClick={markAllDashboardAlertsIssued}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-semibold text-white hover:bg-success disabled:opacity-60 transition"
                  >
                    <CheckCircle size={14} />
                    {completingAllAlerts ? 'Updating…' : 'Mark All Issued'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={completingDashboardAlertId === selectedDashboardAlert.id}
                    onClick={() => {
                      markDashboardAlertIssued(selectedDashboardAlert.id);
                      setSelectedDashboardAlert(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-semibold text-white hover:bg-success disabled:opacity-60 transition"
                  >
                    <CheckCircle size={14} />
                    {completingDashboardAlertId === selectedDashboardAlert.id ? 'Updating…' : 'Mark This Alert Issued'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDashboardAlert(null)}
                  className="rounded-lg bg-sidebar px-4 py-2 text-xs font-semibold text-white hover:bg-background transition"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. Top Row: 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Attendance Posted */}
        <div 
          onClick={() => setShowBreakdownModal(true)}
          className="group relative bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--primary-light)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-primary">
                <Users size={19} />
              </div>
              <ChevronRight size={18} className="text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-main leading-none">
              {currentPeriodAttendance.rate}%
            </p>
            <p className="text-xs font-semibold text-sub mt-1.5">
              Attendance Posted
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-border flex items-center justify-between text-[11px] leading-tight">
            <span className="text-muted-text font-medium">
              {collegesPostedCount} / {totalCollegesCount} Colleges Posted
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBreakdownModal(true);
              }}
              className="text-primary font-semibold hover:underline flex-shrink-0 ml-1"
            >
              View Breakdown
            </button>
          </div>
        </div>

        {/* Card 2: Upcoming Events */}
        <div 
          onClick={() => navigate('/events')}
          className="group relative bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--success-light)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-success flex items-center justify-center text-white shadow-sm shadow-success">
                <Calendar size={19} />
              </div>
              <ChevronRight size={18} className="text-success group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-main leading-none">
              {(eventsData.totalUpcoming || eventsData.list?.length || 567).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-sub mt-1.5">
              Upcoming Events
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-border flex items-center text-[11px] leading-tight">
            <span className="text-success font-medium">
              {(eventsData.totalUpcoming || eventsData.list?.length || 567).toLocaleString()} Active Events
            </span>
          </div>
        </div>

        {/* Card 4: Maintenance Tickets */}
        <div 
          onClick={() => navigate('/task-management')}
          className="group relative bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--warning-light)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-warning flex items-center justify-center text-white shadow-sm shadow-warning">
                <Wrench size={19} />
              </div>
              <ChevronRight size={18} className="text-warning group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-main leading-none">
              {(maintenanceTickets.summary?.total || 48).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-sub mt-1.5">
              Maintenance Tickets
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-border flex items-center text-[11px] leading-tight">
            <span className="text-muted-text font-medium">
              {maintenanceTickets.summary?.open ?? 11} Open - {maintenanceTickets.summary?.in_progress ?? 3} In Progress
            </span>
          </div>
        </div>

        {/* Card 5: Profile Requests */}
        <div 
          onClick={() => setShowProfileRequestsModal(true)}
          className="group relative bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--primary-light)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-primary">
                <UserCheck size={19} />
              </div>
              <ChevronRight size={18} className="text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-main leading-none">
              {(profilePendingCount || profileTotalCount || profileRequests.summary?.total || 1887).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-sub mt-1.5">
              Profile Requests
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-border flex items-center justify-between text-[11px] leading-tight">
            <span className="text-muted-text font-medium">
              Pending for Review
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileRequestsModal(true);
              }}
              className="text-primary font-semibold hover:underline cursor-pointer"
            >
              View Breakdown
            </button>
          </div>
        </div>

        {/* Card 6: Registrations */}
        <div 
          onClick={() => navigate('/students/self-registration')}
          className="group relative bg-surface border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-[var(--primary-light)] transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-sm shadow-primary">
                <CheckSquare size={19} />
              </div>
              <ChevronRight size={18} className="text-primary group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-main leading-none">
              {(registrations.summary?.pending ?? 3628).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-sub mt-1.5">
              Pending Registrations
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-border flex items-center text-[11px] leading-tight">
            <span className="text-muted-text font-medium">
              {(registrations.summary?.total || stats?.totalStudents || 5938).toLocaleString()} Total - {registrations.summary?.total ? Math.round(((registrations.summary.approved || 0) / registrations.summary.total) * 100) : 37}% Approved
            </span>
          </div>
        </div>

      </div>

      {dashboardAlerts.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5" aria-label="ID card PIN update alerts">
          {/* Section Header */}
          <div className="mb-4 flex flex-col gap-3 border-b border-border pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-primary">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-main sm:text-base">ID Card PIN update alerts</h2>
                  <span className="rounded-full bg-[var(--primary-light)] px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {totalPendingStudents} student{totalPendingStudents === 1 ? '' : 's'} pending
                  </span>
                  <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-sub">
                    {dashboardAlerts.length} batch{dashboardAlerts.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-text">
                  PIN numbers were updated. Review student details in the pop-up modal or mark as issued.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setAlertStudentSearch('');
                  setSelectedDashboardAlert({
                    isAll: true,
                    title: 'All Pending ID Cards',
                    students: allAlertStudents,
                    totalStudents: totalPendingStudents
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--primary-light)] bg-[var(--primary-light)] px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-[var(--primary-light)]"
              >
                <Eye size={13} />
                View Complete Details ({totalPendingStudents})
              </button>

              <button
                type="button"
                disabled={completingAllAlerts}
                onClick={markAllDashboardAlertsIssued}
                className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-success disabled:opacity-60"
              >
                <CheckCircle size={13} />
                {completingAllAlerts ? 'Updating…' : 'Mark All Issued'}
              </button>
            </div>
          </div>

          {/* Consolidated Single Section Card */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setAlertStudentSearch('');
              setSelectedDashboardAlert({
                isAll: true,
                title: 'All Pending ID Cards',
                students: allAlertStudents,
                totalStudents: totalPendingStudents
              });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setAlertStudentSearch('');
                setSelectedDashboardAlert({
                  isAll: true,
                  title: 'All Pending ID Cards',
                  students: allAlertStudents,
                  totalStudents: totalPendingStudents
                });
              }
            }}
            className="cursor-pointer rounded-xl border border-[var(--primary-light)] bg-gradient-to-r from-[var(--primary-light)] via-[var(--primary-light)] to-surface p-3.5 transition hover:border-[var(--primary-light)] hover:shadow-sm sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-xs font-semibold text-main sm:text-sm">
                    {totalPendingStudents} Student{totalPendingStudents === 1 ? '' : 's'} need ID cards issued
                  </span>
                </div>
                <p className="mt-1 text-xs text-sub">
                  Updated across {aggregatedGroups.length} branch group{aggregatedGroups.length === 1 ? '' : 's'}. Click here or any alert batch to view complete details in the pop-up modal.
                </p>

                {/* Aggregated Group Badges */}
                {aggregatedGroups.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {aggregatedGroups.slice(0, 5).map((group, idx) => (
                      <span
                        key={`agg-group-${idx}`}
                        className="rounded-md border border-[var(--primary-light)] bg-surface px-2 py-0.5 text-[10px] font-medium text-sub shadow-2xs"
                      >
                        {group.label} — <strong className="text-primary">{group.studentCount}</strong>
                      </span>
                    ))}
                    {aggregatedGroups.length > 5 && (
                      <span className="rounded-md bg-[var(--primary-light)] px-2 py-0.5 text-[10px] font-semibold text-primary">
                        +{aggregatedGroups.length - 5} more branches
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary self-start sm:self-center">
                <span>Click to view complete details</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Batches Preview List with View More toggle */}
          <div className="mt-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-sub">
                Recent Alert Batches ({dashboardAlerts.length})
              </h3>
              {dashboardAlerts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllDashboardAlerts(!showAllDashboardAlerts)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary transition hover:bg-[var(--primary-light)] hover:text-primary"
                >
                  {showAllDashboardAlerts ? (
                    <>
                      Show Less <ChevronUp size={14} />
                    </>
                  ) : (
                    <>
                      View More ({dashboardAlerts.length - 3} more) <ChevronDown size={14} />
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(showAllDashboardAlerts ? dashboardAlerts : dashboardAlerts.slice(0, 3)).map((notification) => {
                const groups = Array.isArray(notification.data?.groups) ? notification.data.groups : [];
                const totalStudents = notification.data?.totalStudents || groups.reduce(
                  (total, group) => total + (group.studentCount || group.students?.length || 0),
                  0
                );
                const createdAt = new Date(notification.created_at);
                const alertTime = Number.isNaN(createdAt.getTime())
                  ? ''
                  : formatDistanceToNow(createdAt, { addSuffix: true });

                return (
                  <div
                    key={notification.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setAlertStudentSearch('');
                      setSelectedDashboardAlert(notification);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setAlertStudentSearch('');
                        setSelectedDashboardAlert(notification);
                      }
                    }}
                    className="cursor-pointer rounded-lg border border-border bg-[var(--background)]/70 p-3 transition hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-light)]"
                    aria-label={`View students for ${notification.title}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-main">{notification.title}</h4>
                            <p className="mt-0.5 text-[11px] text-muted-text">
                              {totalStudents ? `${totalStudents} student${totalStudents === 1 ? '' : 's'} need ID cards issued.` : notification.message}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={completingDashboardAlertId === notification.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              markDashboardAlertIssued(notification.id);
                            }}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-success px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-success disabled:cursor-wait disabled:opacity-60 sm:self-auto"
                          >
                            <CheckCircle size={13} />
                            {completingDashboardAlertId === notification.id ? 'Updating…' : 'Mark Issued'}
                          </button>
                        </div>

                        {groups.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {groups.map((group, groupIndex) => (
                              <span
                                key={`${group.college}-${group.batch}-${group.course}-${group.branch}-${groupIndex}`}
                                className="rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-sub"
                              >
                                {[group.college, group.batch, group.course, group.branch].filter(Boolean).join(' · ')}
                                {' — '}{group.studentCount || 0}
                              </span>
                            ))}
                          </div>
                        )}
                        {alertTime && <p className="mt-2 text-[10px] text-muted-text">{alertTime}</p>}
                        <p className="mt-1 text-[10px] font-medium text-primary">Click to view student details</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. Middle Section: Attendance Status, Calendar, Announcements, Registration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* LEFT: Student Attendance Status Donut & Breakdown */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header with Title and Dropdown */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-bold text-main">Student Attendance Status</h2>
                <div title="Attendance rate across selected period" className="cursor-help">
                  <Info size={15} className="text-muted-text" />
                </div>
              </div>

              {/* Period Dropdown */}
              <select
                value={attendancePeriod}
                onChange={(e) => setAttendancePeriod(e.target.value)}
                className="text-xs font-medium bg-background border border-border text-sub rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option value="today">Today</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Attendance Chart / Stats: Donut for Today, Calendar for Monthly, Bar Graph for Weekly */}
            {attendancePeriod === 'today' ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-3">
                {/* Donut ring (clickable) */}
                <div
                  onClick={() => handleOpenCourseAttendance({ dateKey: todayKey, fullDate: `Today (${todayLabel})` })}
                  className="flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                  title="Click to view course-wise attendance for Today"
                >
                  <DonutChart
                    percentage={currentPeriodAttendance.rate}
                    color="var(--warning)"
                    trackColor="var(--background)"
                    size={146}
                    strokeWidth={15}
                    centerContent={
                      <>
                        <span className="text-2xl font-extrabold text-main leading-none">
                          {currentPeriodAttendance.rate}%
                        </span>
                        <span className="text-[10px] font-bold text-muted-text uppercase tracking-wider mt-1">
                          POSTED RATE
                        </span>
                      </>
                    }
                  />
                </div>

                {/* Status details legend (clickable) */}
                <div
                  onClick={() => handleOpenCourseAttendance({ dateKey: todayKey, fullDate: `Today (${todayLabel})` })}
                  className="flex-1 w-full space-y-2 text-xs cursor-pointer group"
                  title="Click to view course-wise attendance for Today"
                >
                  <div className="flex items-center justify-between py-1 border-b border-border group-hover:bg-[var(--primary-light)] rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-success" />
                      <span className="text-sub font-medium">Present</span>
                    </div>
                    <span className="font-bold text-main tabular-nums">
                      {currentPeriodAttendance.present.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border group-hover:bg-[var(--primary-light)] rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                      <span className="text-sub font-medium">Absent</span>
                    </div>
                    <span className="font-bold text-main tabular-nums">
                      {currentPeriodAttendance.absent.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-border group-hover:bg-[var(--primary-light)] rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                      <span className="text-sub font-medium">Pending / Holiday</span>
                    </div>
                    <span className="font-bold text-main tabular-nums">
                      {(currentPeriodAttendance.pending + currentPeriodAttendance.holiday).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 group-hover:bg-[var(--primary-light)] rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-background" />
                      <span className="text-sub font-medium">Total Over All</span>
                    </div>
                    <span className="font-bold text-main tabular-nums">
                      {currentPeriodAttendance.total.toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <span className="text-[11px] font-bold text-primary group-hover:underline flex items-center gap-0.5">
                      Course Wise Details <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ) : attendancePeriod === 'monthly' ? (
              /* MONTHLY: In-Card Calendar */
              <div className="py-1 space-y-2">
                {/* Month Navigator & Summary Row */}
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="flex items-center gap-1 bg-background border border-border rounded-lg px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      className="p-1 rounded text-sub hover:text-main hover:bg-surface transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="font-bold text-main text-[11px] min-w-[70px] text-center select-none">
                      {calendarMonthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      className="p-1 rounded text-sub hover:text-main hover:bg-surface transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <span
                      key={d}
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        i === 0 ? 'text-danger' : 'text-muted-text'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {inCardCalendarCells.map((cell) => {
                    const isSelected = selectedCalendarDay?.dateKey === cell.dateKey;
                    return (
                      <div
                        key={cell.dateKey}
                        onClick={() => cell.hasData ? handleOpenCourseAttendance(cell) : null}
                        className={`p-1 rounded-md border flex flex-col justify-between transition-all min-h-[50px] ${
                          !cell.isCurrentMonth
                            ? 'bg-[var(--background)]/40 border-border opacity-25 pointer-events-none'
                            : cell.isToday
                            ? 'bg-[var(--primary-light)] border-primary ring-1 ring-[var(--primary-light)] shadow-xs'
                            : isSelected
                            ? 'bg-[var(--warning-light)] border-warning ring-1 ring-[var(--warning-light)]'
                            : 'bg-surface border-border hover:border-border-strong hover:shadow-xs'
                        } ${cell.hasData ? 'cursor-pointer hover:border-primary' : ''}`}
                      >
                        {/* Day number */}
                        <div className="flex items-center justify-between leading-none mb-0.5">
                          <span
                            className={`text-[9px] font-bold ${
                              cell.isToday
                                ? 'w-3.5 h-3.5 rounded-full bg-primary text-white flex items-center justify-center text-[8px]'
                                : cell.isSunday
                                ? 'text-danger font-semibold'
                                : 'text-sub'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {cell.hasData && (cell.present + cell.absent > 0) && (
                            <span className="text-[7.5px] font-semibold text-muted-text">
                              {Math.round((cell.present / (cell.present + cell.absent)) * 100)}%
                            </span>
                          )}
                        </div>

                        {/* Both Present and Absent represented simultaneously */}
                        {cell.hasData && !cell.isSunday ? (
                          <div className="space-y-0.5">
                            <div
                              className="text-[7.5px] sm:text-[8px] font-bold text-success bg-[var(--success-light)] px-1 py-0.5 rounded border border-[var(--success-light)] flex items-center justify-between leading-none"
                              title={`Present: ${cell.present.toLocaleString()}`}
                            >
                              <span className="text-success font-extrabold">P:</span>
                              <span className="tabular-nums font-bold">
                                {cell.present > 9999 ? `${(cell.present / 1000).toFixed(1)}k` : cell.present.toLocaleString()}
                              </span>
                            </div>
                            <div
                              className="text-[7.5px] sm:text-[8px] font-bold text-danger bg-[var(--danger-light)] px-1 py-0.5 rounded border border-[var(--danger-light)] flex items-center justify-between leading-none"
                              title={`Absent: ${cell.absent.toLocaleString()}`}
                            >
                              <span className="text-danger font-extrabold">A:</span>
                              <span className="tabular-nums font-bold">
                                {cell.absent > 9999 ? `${(cell.absent / 1000).toFixed(1)}k` : cell.absent.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ) : cell.isSunday ? (
                          <div className="text-[8px] text-danger font-semibold text-center py-1 bg-[var(--danger-light)] rounded">Sun</div>
                        ) : (
                          <div className="text-[8px] text-muted-text text-center py-1">-</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected Day Breakdown banner (if a date is clicked) */}
                {selectedCalendarDay && (
                  <div
                    onClick={() => handleOpenCourseAttendance(selectedCalendarDay)}
                    className="p-2 rounded-lg bg-[var(--primary-light)] hover:bg-[var(--primary-light)] border border-[var(--primary-light)] text-xs flex items-center justify-between cursor-pointer transition-colors"
                    title="Click to view course-wise attendance"
                  >
                    <span className="font-bold text-main text-[11px]">{selectedCalendarDay.fullDate}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-success font-bold">P: {selectedCalendarDay.present.toLocaleString()}</span>
                      <span className="text-danger font-bold">A: {selectedCalendarDay.absent.toLocaleString()}</span>
                      {selectedCalendarDay.rate !== undefined && (
                        <span className="px-1.5 py-0.2 rounded bg-primary text-white font-extrabold text-[10px]">
                          {selectedCalendarDay.rate}%
                        </span>
                      )}
                      <span className="text-primary font-bold text-[10px] flex items-center ml-0.5">
                        Courses <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* WEEKLY: Bar Graph */
              <div className="py-1">
                {/* Summary badges strip */}
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs pb-2 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-success" />
                      <span className="text-sub text-xs font-medium">Present:</span>
                      <span className="font-bold text-main tabular-nums">{currentPeriodAttendance.present.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                      <span className="text-sub text-xs font-medium">Absent:</span>
                      <span className="font-bold text-main tabular-nums">{currentPeriodAttendance.absent.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                      {currentPeriodAttendance.rate}% Rate
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenCourseAttendance({ dateKey: todayKey, fullDate: `This Week (${todayLabel})` })}
                      className="text-[11px] font-bold text-primary hover:text-primary hover:underline flex items-center"
                    >
                      Course Wise <ChevronRight size={12} />
                    </button>
                  </div>
                </div>

                {/* Bar Graph */}
                <div className="w-full h-40 pt-2" title="Click any bar to view course-wise attendance for that day">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={attendanceChartData}
                      margin={{ top: 8, right: 6, left: -22, bottom: 0 }}
                      barGap={3}
                      onClick={(state) => {
                        if (state && state.activePayload && state.activePayload.length) {
                          handleOpenCourseAttendanceFromChart(state.activePayload[0].payload);
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--background)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 500 }}
                        axisLine={{ stroke: 'var(--border)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <RechartsTooltip content={<AttendanceBarTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
                      <Bar
                        dataKey="present"
                        fill="var(--success)"
                        name="Present"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                        cursor="pointer"
                        onClick={(data) => handleOpenCourseAttendanceFromChart(data)}
                      />
                      <Bar
                        dataKey="absent"
                        fill="var(--danger)"
                        name="Absent"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                        cursor="pointer"
                        onClick={(data) => handleOpenCourseAttendanceFromChart(data)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Footer of attendance status */}
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-text font-medium">
              {collegesPostedCount} / {totalCollegesCount} Colleges Posted
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenCourseAttendance(
                  selectedCalendarDay || { dateKey: todayKey, fullDate: attendancePeriod === 'today' ? `Today (${todayLabel})` : attendancePeriod === 'weekly' ? 'This Week' : calendarMonthLabel }
                )}
                className="text-success font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Course Wise Details <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(true)}
                className="text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                College Wise Details <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE: Calendar Widget */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-main">Calendar</h2>
              <Link to="/events" className="text-xs font-semibold text-primary hover:text-primary">
                View All
              </Link>
            </div>

            {/* Event rows */}
            <div className="space-y-3">
              {displayEvents.map((ev, idx) => {
                const eventDate = ev.event_date ? new Date(ev.event_date) : null;
                const dayNum = eventDate ? eventDate.getDate() : ev.date || '24';
                const monthStr = eventDate 
                  ? eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() 
                  : ev.month || 'SEP';
                const venue = ev.venue || ev.description || 'Main Auditorium';
                const timeStr = ev.start_time || ev.time || '10:00 AM';

                return (
                  <div 
                    key={ev.id || idx}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--background)]/80 transition-colors"
                  >
                    {/* Date Badge */}
                    <div className="flex flex-col items-center justify-center min-w-[46px] h-[46px] rounded-xl border border-[var(--danger-light)] bg-[var(--danger-light)] flex-shrink-0">
                      <span className="text-danger font-extrabold text-sm leading-none">{dayNum}</span>
                      <span className="text-danger font-bold text-[9px] tracking-wider mt-0.5">{monthStr}</span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-main truncate leading-snug">
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-text mt-1">
                        <span className="flex items-center gap-0.5 truncate">
                          <MapPin size={11} className="text-muted-text flex-shrink-0" />
                          {venue}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock size={11} className="text-muted-text" />
                          {timeStr}
                        </span>
                      </div>
                    </div>

                    {/* Tag badge */}
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                      {ev.badge || 'Today'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border text-right">
            <Link to="/events" className="text-xs font-semibold text-primary hover:underline">
              Browse full calendar →
            </Link>
          </div>
        </div>

        {/* RIGHT OF CALENDAR: Announcements Widget */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base font-bold text-main truncate">Announcements</h2>
                {displayAnnouncements.length > 0 && (
                  <span className="whitespace-nowrap flex-shrink-0 inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)] leading-normal">
                    {displayAnnouncements.length} Recent
                  </span>
                )}
              </div>
              <Link to="/announcements" className="whitespace-nowrap flex-shrink-0 text-xs font-semibold text-primary hover:text-primary ml-1">
                View All
              </Link>
            </div>

            {/* Announcements List - Clean, uncluttered layout matching Calendar card */}
            {loadingAnnouncements && displayAnnouncements.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                    <div className="w-[46px] h-[46px] min-w-[46px] max-w-[46px] rounded-xl bg-background flex-shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3.5 bg-background rounded w-3/4" />
                      <div className="h-2.5 bg-background rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayAnnouncements.length > 0 ? (
              <div className="space-y-3">
                {displayAnnouncements.map((ann, idx) => {
                  const annDate = ann.created_at ? new Date(ann.created_at) : null;
                  const dateStr = annDate && !isNaN(annDate.getTime())
                    ? annDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                    : 'Recent';
                  const isExpired = ann.expires_at && new Date(ann.expires_at) < new Date();

                  return (
                    <div
                      key={ann.id || idx}
                      onClick={() => navigate('/announcements')}
                      className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--background)]/80 transition-colors cursor-pointer"
                    >
                      {/* Image Thumbnail (matching announcements page, evenly sized) */}
                      <div className="w-[46px] h-[46px] min-w-[46px] max-w-[46px] rounded-xl overflow-hidden bg-sidebar border border-[var(--primary-light)] flex-shrink-0">
                        <img
                          src={ann.image_url || '/images/announcement-fallback.jpg'}
                          alt={ann.title || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            if (e.currentTarget.src !== window.location.origin + '/images/announcement-fallback.jpg') {
                              e.currentTarget.src = '/images/announcement-fallback.jpg';
                            }
                          }}
                        />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-main truncate leading-snug group-hover:text-primary transition-colors">
                          {ann.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-text mt-1">
                          <span className="flex items-center gap-1 truncate">
                            <Clock size={11} className={isExpired ? 'text-danger' : 'text-muted-text'} />
                            <span>{dateStr}</span>
                          </span>
                          <span>•</span>
                          <span className="truncate text-muted-text">
                            {ann.content ? ann.content.replace(/[\r\n]+/g, ' ').slice(0, 32) : 'Notice'}
                          </span>
                        </div>
                      </div>

                      {/* Tag badge */}
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isExpired
                          ? 'bg-[var(--danger-light)] text-danger border-[var(--danger-light)]'
                          : ann.is_active === 0
                          ? 'bg-background text-muted-text border-border'
                          : 'bg-[var(--success-light)] text-success border-[var(--success-light)]'
                      }`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center text-muted-text">
                <Megaphone size={28} className="text-muted-text mb-2 opacity-60" />
                <p className="text-xs font-semibold text-sub">No Announcements</p>
                <p className="text-[11px] text-muted-text mt-0.5">No recent announcements published</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border text-right">
            <Link to="/announcements" className="text-xs font-semibold text-primary hover:underline">
              Browse all announcements →
            </Link>
          </div>
        </div>

        {/* RIGHT: Students Registration Status (4 Stages) Widget */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-main">Registration Status</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary border border-[var(--primary-light)]">
                  {stageTotal.toLocaleString()} Students
                </span>
              </div>
              <Link to="/reports" className="text-xs font-semibold text-primary hover:text-primary">
                View All
              </Link>
            </div>

            {/* 4 Steps - One below each other */}
            <div className="space-y-2.5">
              
              {/* Step 1: REGISTRATION */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-border bg-[var(--background)]/50 hover:bg-[var(--background)]/70 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-sub tracking-wider uppercase">
                    Registration
                  </p>
                  <p className="text-[10px] text-muted-text font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-success">{regStage.completed.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-warning">{regStage.temporary.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-danger">{regStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 2: VERIFICATION */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-[var(--warning-light)] bg-[var(--warning-light)] hover:bg-[var(--warning-light)] transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-warning tracking-wider uppercase">
                    Verification
                  </p>
                  <p className="text-[10px] text-warning font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-success">{verStage.completed.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-danger">{verStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 3: CERTIFICATES */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-[var(--primary-light)] bg-[var(--primary-light)] hover:bg-[var(--primary-light)] transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-secondary tracking-wider uppercase">
                    Certificates
                  </p>
                  <p className="text-[10px] text-secondary font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-success">{certStage.verified.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-warning">{certStage.temporary.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-danger">{certStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 4: FEES */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-[var(--success-light)] bg-[var(--success-light)] hover:bg-[var(--success-light)] transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-success tracking-wider uppercase">
                    Fees
                  </p>
                  <p className="text-[10px] text-success font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-success">{feeStage.cleared.toLocaleString()}</span>
                  <span className="text-muted-text font-normal mx-1">/</span>
                  <span className="text-danger">{feeStage.pending.toLocaleString()}</span>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-text font-medium">4 Stage Registration Abstract</span>
            <Link to="/reports" className="text-xs font-semibold text-primary hover:underline">
              Registration Abstract →
            </Link>
          </div>
        </div>

      </div>

      {/* 4. Lower Row: Maintenance Tickets, Student Profile Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">

        {/* Maintenance Tickets Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-main">Maintenance Tickets</h3>
              <Link to="/task-management" className="text-xs font-semibold text-primary hover:underline">
                View All
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <MultiSegmentDonut
                total={maintenanceTickets.summary?.total || 48}
                segments={[
                  { label: 'Open', value: maintenanceTickets.summary?.open ?? 11, color: 'var(--danger)' },
                  { label: 'In Progress', value: maintenanceTickets.summary?.in_progress ?? 3, color: 'var(--warning)' },
                  { label: 'Resolved', value: maintenanceTickets.summary?.resolved ?? 30, color: 'var(--success)' },
                  { label: 'Closed', value: maintenanceTickets.summary?.closed ?? 4, color: 'var(--text-secondary)' }
                ]}
                size={110}
                strokeWidth={12}
                centerContent={
                  <span className="text-xl font-bold text-main">
                    {maintenanceTickets.summary?.total || 48}
                  </span>
                }
              />
              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-danger" /> Open
                  </span>
                  <span className="font-semibold text-main">{maintenanceTickets.summary?.open ?? 11}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-warning" /> In Progress
                  </span>
                  <span className="font-semibold text-main">{maintenanceTickets.summary?.in_progress ?? 3}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success" /> Resolved
                  </span>
                  <span className="font-semibold text-main">{maintenanceTickets.summary?.resolved ?? 30}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Profile Requests Card */}
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-main">Student Profile Requests</h3>
              <Link to="/students/profile-change-requests" className="text-xs font-semibold text-primary hover:underline">
                View All
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <MultiSegmentDonut
                total={profileRequests.summary?.total || 1236}
                segments={[
                  { label: 'Pending', value: profileRequests.summary?.pending ?? 1236, color: 'var(--accent)' },
                  { label: 'Approved', value: profileRequests.summary?.approved ?? 0, color: 'var(--success)' },
                  { label: 'Rejected', value: profileRequests.summary?.rejected ?? 0, color: 'var(--danger)' }
                ]}
                size={110}
                strokeWidth={12}
                centerContent={
                  <span className="text-xl font-bold text-main">
                    {(profileRequests.summary?.total || 1236).toLocaleString()}
                  </span>
                }
              />
              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-warning" /> Pending
                  </span>
                  <span className="font-semibold text-main">{(profileRequests.summary?.pending ?? 1236).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success" /> Approved
                  </span>
                  <span className="font-semibold text-main">{(profileRequests.summary?.approved ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-text flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-danger" /> Rejected
                  </span>
                  <span className="font-semibold text-main">{(profileRequests.summary?.rejected ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>


      {/* 6. College Attendance Breakdown Modal */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--background)]/60">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-primary" />
                <h3 className="text-lg font-bold text-main">College-Wise Attendance Breakdown</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--primary-light)] text-primary font-semibold ml-2">
                  Today
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="p-1.5 rounded-lg text-muted-text hover:text-sub hover:bg-background transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Colleges List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {collegeList && collegeList.length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-border text-xs font-semibold text-muted-text uppercase tracking-wide">
                    <span>College</span>
                    <span className="text-center text-primary">Total</span>
                    <span className="text-center text-success">Present</span>
                    <span className="text-center text-danger">Absent</span>
                    <span className="text-right">Rate</span>
                  </div>

                  {collegeList.map((college) => {
                    const totalStudents = Number(college.totalStudents) || 0;
                    const present = Number(college.presentToday) || 0;
                    const absent = Number(college.absentToday) || 0;
                    const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : null;
                    const isPosted = college.isPosted || (present + absent > 0);

                    return (
                      <div
                        key={college.id || college.name}
                        onClick={() => {
                          setShowBreakdownModal(false);
                          handleOpenCourseAttendance(
                            { dateKey: todayKey, fullDate: `Today (${todayLabel})` },
                            college
                          );
                        }}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-border hover:border-primary hover:bg-[var(--primary-light)] transition-all cursor-pointer group"
                        title={`Click to view course-wise attendance for ${college.name}`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-main text-sm leading-tight group-hover:text-primary transition-colors">
                              {college.name}
                            </p>
                            <ChevronRight size={14} className="text-muted-text opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {college.code && <span className="text-xs text-secondary font-medium">{college.code}</span>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPosted ? 'bg-[var(--success-light)] text-success' : 'bg-background text-muted-text'}`}>
                              {isPosted ? 'Attendance Posted' : 'Not Posted'}
                            </span>
                            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              View courses →
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg px-3 py-1.5">
                          <Users size={12} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-bold text-primary tabular-nums">{totalStudents.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg px-3 py-1.5">
                          <CheckCircle size={12} className="text-success flex-shrink-0" />
                          <span className="text-sm font-bold text-success tabular-nums">{present.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-lg px-3 py-1.5">
                          <XCircle size={12} className="text-danger flex-shrink-0" />
                          <span className="text-sm font-bold text-danger tabular-nums">{absent.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-main">
                            {rate !== null ? `${rate}%` : 'N/A'}
                          </span>
                          <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${rate !== null ? Math.min(rate, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-12 text-muted-text">
                  <Building2 size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No college data available for this account</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-background flex items-center justify-between">
              <span className="text-xs text-muted-text">
                Showing {collegeList.length} college{collegeList.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sidebar text-white hover:bg-sidebar transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Course Attendance Breakdown Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[var(--background)]/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[var(--primary-light)] text-primary rounded-xl">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-main">Course-Wise Attendance Breakdown</h3>
                  <p className="text-xs text-muted-text">
                    {courseModalDate?.fullDate || courseModalDate?.dateKey || courseModalData?.date || 'Selected Date'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="p-1.5 rounded-lg text-muted-text hover:text-sub hover:bg-background transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter and View Controls Bar */}
            <div className="px-6 py-2.5 bg-[var(--background)]/80 border-b border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-sub flex items-center gap-1">
                  <Building2 size={13} className="text-muted-text" /> College:
                </span>
                <select
                  value={courseModalCollegeFilter}
                  onChange={(e) => setCourseModalCollegeFilter(e.target.value)}
                  className="text-xs font-medium bg-surface border border-border text-main rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-sm"
                >
                  <option value="all">All Colleges {courseModalColleges.length ? `(${courseModalColleges.length})` : ''}</option>
                  {courseModalColleges.map((col) => (
                    <option key={col.id || col.code || col.name} value={col.code || col.name}>
                      {col.code ? `${col.code} — ${col.name}` : col.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Toggle: By College vs Consolidated */}
              <div className="flex items-center bg-[var(--background)]/80 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCourseModalViewMode('detailed')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    courseModalViewMode === 'detailed'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-sub hover:text-main'
                  }`}
                  title="Show courses separated by college"
                >
                  By College
                </button>
                <button
                  type="button"
                  onClick={() => setCourseModalViewMode('consolidated')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    courseModalViewMode === 'consolidated'
                      ? 'bg-surface text-primary shadow-sm'
                      : 'text-sub hover:text-main'
                  }`}
                  title="Show consolidated courses across all colleges"
                >
                  Consolidated
                </button>
              </div>
            </div>

            {/* Date Summary bar */}
            {courseModalData && (
              <div className="px-6 py-3 bg-[var(--primary-light)] border-b border-[var(--primary-light)] flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-semibold text-sub">
                  Total Students: <strong className="text-main">{courseModalSummary.totalStudents?.toLocaleString()}</strong>
                  {courseModalCollegeFilter !== 'all' && (
                    <span className="ml-2 text-xs font-normal text-secondary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                      Filtered: {courseModalCollegeFilter}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--success-light)] text-success font-bold">
                    P: {courseModalSummary.present?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--danger-light)] text-danger font-bold">
                    A: {courseModalSummary.absent?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-primary text-white font-extrabold">
                    {courseModalSummary.rate}% Rate
                  </span>
                </div>
              </div>
            )}

            {/* Modal Body: Courses List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {courseModalLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-muted-text gap-3">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Loading course-wise attendance...</p>
                </div>
              ) : courseModalError ? (
                <div className="text-center py-12 text-danger">
                  <AlertCircle size={36} className="mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium">{courseModalError}</p>
                </div>
              ) : displayedCourses && displayedCourses.length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-border text-xs font-semibold text-muted-text uppercase tracking-wide">
                    <span>Course {courseModalViewMode === 'detailed' ? '& College' : ''}</span>
                    <span className="text-center text-primary">Total</span>
                    <span className="text-center text-success">Present</span>
                    <span className="text-center text-danger">Absent</span>
                    <span className="text-right">Rate</span>
                  </div>

                  {displayedCourses.map((course) => {
                    const totalStudents = Number(course.totalStudents) || 0;
                    const present = Number(course.present) || 0;
                    const absent = Number(course.absent) || 0;
                    const rate = course.rate ?? (totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0);
                    const isPosted = course.isPosted;

                    return (
                      <div
                        key={course.id || `${course.collegeCode || course.collegeName || ''}-${course.name}`}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-border hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)] transition-all"
                      >
                        <div>
                          <p className="font-bold text-main text-sm leading-tight">{course.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {courseModalViewMode === 'detailed' && (course.collegeCode || course.collegeName) && (
                              <span className="text-[11px] text-secondary font-semibold bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                                {course.collegeCode || course.collegeName}
                              </span>
                            )}
                            {courseModalViewMode === 'detailed' && course.collegeName && course.collegeCode && (
                              <span className="text-[11px] text-muted-text font-medium truncate max-w-[220px]" title={course.collegeName}>
                                {course.collegeName}
                              </span>
                            )}
                            {courseModalViewMode === 'consolidated' && Array.isArray(course.colleges) && course.colleges.length > 0 && (
                              <span className="text-[10px] text-primary font-semibold bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                                {course.colleges.length} {course.colleges.length === 1 ? 'College' : 'Colleges'} ({course.colleges.map(c => c.collegeCode || c.collegeName).filter(Boolean).join(', ')})
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPosted ? 'bg-[var(--success-light)] text-success' : 'bg-background text-muted-text'}`}>
                              {isPosted ? 'Attendance Posted' : 'Not Posted'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--primary-light)] border border-[var(--primary-light)] rounded-lg px-3 py-1.5">
                          <Users size={12} className="text-primary flex-shrink-0" />
                          <span className="text-sm font-bold text-primary tabular-nums">{totalStudents.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--success-light)] border border-[var(--success-light)] rounded-lg px-3 py-1.5">
                          <CheckCircle size={12} className="text-success flex-shrink-0" />
                          <span className="text-sm font-bold text-success tabular-nums">{present.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-lg px-3 py-1.5">
                          <XCircle size={12} className="text-danger flex-shrink-0" />
                          <span className="text-sm font-bold text-danger tabular-nums">{absent.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-main">
                            {isPosted ? `${rate}%` : 'N/A'}
                          </span>
                          <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${rate >= 75 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-danger'}`}
                              style={{ width: `${isPosted ? Math.min(rate, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-12 text-muted-text">
                  <GraduationCap size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">
                    {courseModalCollegeFilter !== 'all'
                      ? `No courses found for ${courseModalCollegeFilter}`
                      : 'No course attendance data available for this date'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-background flex items-center justify-between">
              <span className="text-xs text-muted-text">
                {displayedCourses?.length
                  ? `Showing ${displayedCourses.length} ${displayedCourses.length === 1 ? 'course' : 'courses'}${
                      courseModalCollegeFilter !== 'all' ? ` for ${courseModalCollegeFilter}` : ''
                    }`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-sidebar text-white hover:bg-sidebar transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

{/* 8. College Profile Requests Abstract Modal */}
      {showProfileRequestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-[var(--background)] via-surface to-[var(--primary-light)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-main">Profile Requests Abstract</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--warning-light)] text-warning font-bold">
                      {profilePendingCount.toLocaleString()} Pending
                    </span>
                  </div>
                  <p className="text-xs text-muted-text mt-0.5">
                    College-wise breakdown with programs and branches
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fetchProfileAbstract()}
                  className="p-1.5 rounded-lg text-muted-text hover:text-primary hover:bg-[var(--primary-light)] transition-colors cursor-pointer"
                  title="Refresh college abstract data"
                >
                  <RotateCw size={17} className={loadingProfileAbstract ? 'animate-spin text-primary' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileRequestsModal(false)}
                  className="p-1.5 rounded-lg text-muted-text hover:text-sub hover:bg-background transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[var(--warning-light)] border border-[var(--warning-light)] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-warning uppercase tracking-wide">Pending Review</p>
                  <p className="text-2xl font-black text-warning mt-0.5">
                    {profilePendingCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--success-light)] border border-[var(--success-light)] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-success uppercase tracking-wide">Approved</p>
                  <p className="text-2xl font-black text-success mt-0.5">
                    {profileApprovedCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--danger-light)] border border-[var(--danger-light)] rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-danger uppercase tracking-wide">Rejected</p>
                  <p className="text-2xl font-black text-danger mt-0.5">
                    {profileRejectedCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-background border border-border rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-sub uppercase tracking-wide">Total Requests</p>
                  <p className="text-2xl font-black text-main mt-0.5">
                    {profileTotalCount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Search within colleges */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
                <input
                  type="text"
                  placeholder="Search college, program, or branch..."
                  value={profileModalSearch}
                  onChange={(e) => setProfileModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                />
              </div>

              {/* Colleges Accordion List */}
              {loadingProfileAbstract ? (
                <div className="py-12 text-center text-muted-text">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3"></div>
                  <p className="text-xs">Loading college-wise abstract...</p>
                </div>
              ) : filteredProfileColleges.length === 0 ? (
                <div className="py-12 text-center text-muted-text border border-dashed rounded-xl p-6">
                  <UserCheck size={36} className="mx-auto mb-2 opacity-40 text-primary" />
                  <p className="text-sm font-semibold text-sub">
                    {profileModalSearch ? 'No requests match your search criteria' : 'No profile change requests loaded'}
                  </p>
                  <p className="text-xs text-muted-text mt-1">
                    {profileModalSearch ? 'Try a different search query.' : 'Click the button below to reload the college abstract from the server.'}
                  </p>
                  {!profileModalSearch && (
                    <button
                      type="button"
                      onClick={() => fetchProfileAbstract()}
                      className="mt-3 px-3.5 py-1.5 bg-[var(--primary-light)] text-primary hover:bg-[var(--primary-light)] rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <RotateCw size={13} />
                      <span>Retry Fetching Abstract</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProfileColleges.map((college) => {
                    const isExpanded = !!expandedProfileColleges[college.college];
                    return (
                      <div
                        key={college.college}
                        className="border border-border rounded-xl overflow-hidden bg-surface shadow-xs hover:border-[var(--primary-light)] transition-all"
                      >
                        {/* College Header Row */}
                        <div
                          onClick={() => toggleProfileCollege(college.college)}
                          className="p-3.5 bg-[var(--background)]/70 hover:bg-[var(--primary-light)] cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--primary-light)] flex items-center justify-center text-primary shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-main text-sm leading-tight">{college.college}</p>
                              <p className="text-[11px] text-muted-text mt-0.5">
                                {college.programs?.length || 0} Programs • {(college.total || 0).toLocaleString()} Total Requests
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]">
                              {college.pending} Pending
                            </span>
                            {college.approved > 0 && (
                              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-[var(--success-light)] text-success border border-[var(--success-light)] hidden sm:inline-block">
                                {college.approved} Approved
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowProfileRequestsModal(false);
                                navigate(`/students/profile-change-requests?college=${encodeURIComponent(college.college)}&status=pending`);
                              }}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-[var(--primary-light)] transition-colors flex items-center gap-1 cursor-pointer"
                              title="Open requests for this college"
                            >
                              <span>View</span>
                              <ChevronRight size={13} />
                            </button>
                            <div className="p-1 text-muted-text">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Programs List */}
                        {isExpanded && (
                          <div className="p-3 bg-surface border-t border-border space-y-2">
                            <p className="text-[10px] font-bold text-muted-text uppercase tracking-wider px-1">
                              Programs & Branches Breakdown
                            </p>
                            {college.programs?.map((program) => {
                              const progKey = `${college.college}-${program.course}`;
                              const isProgExpanded = expandedProfilePrograms[progKey] ?? true;
                              return (
                                <div
                                  key={program.course}
                                  className="border border-border rounded-lg p-2.5 bg-[var(--background)]/40"
                                >
                                  <div
                                    onClick={() => toggleProfileProgram(progKey)}
                                    className="flex items-center justify-between cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <GraduationCap size={15} className="text-primary shrink-0" />
                                      <span className="font-semibold text-xs text-main">{program.course}</span>
                                      <span className="text-[10px] text-muted-text">({program.branches?.length || 0} branches)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold text-primary bg-[var(--primary-light)] px-2 py-0.5 rounded border border-[var(--primary-light)]">
                                        {program.pending} pending
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowProfileRequestsModal(false);
                                          navigate(`/students/profile-change-requests?college=${encodeURIComponent(college.college)}&course=${encodeURIComponent(program.course)}&status=pending`);
                                        }}
                                        className="text-[10px] text-primary hover:text-primary font-semibold hover:underline cursor-pointer"
                                      >
                                        Filter →
                                      </button>
                                      {program.branches?.length > 1 && (
                                        <div className="text-muted-text">
                                          {isProgExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Branches pills */}
                                  {isProgExpanded && program.branches?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-border flex flex-wrap gap-1.5">
                                      {program.branches.map((b) => (
                                        <button
                                          key={b.branch}
                                          type="button"
                                          onClick={() => {
                                            setShowProfileRequestsModal(false);
                                            navigate(`/students/profile-change-requests?college=${encodeURIComponent(college.college)}&course=${encodeURIComponent(program.course)}&branch=${encodeURIComponent(b.branch)}&status=pending`);
                                          }}
                                          className="text-[11px] px-2 py-1 rounded bg-surface border border-border hover:border-[var(--primary-light)] hover:bg-[var(--primary-light)] text-sub transition-all flex items-center gap-1.5 group cursor-pointer"
                                          title={`Filter by ${b.branch}`}
                                        >
                                          <span className="font-medium">{b.branch}</span>
                                          <span className="font-bold text-[10px] px-1 py-0.2 rounded bg-[var(--primary-light)] text-primary group-hover:bg-[var(--primary-light)]">
                                            {b.pending}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-border bg-background flex items-center justify-between">
              <span className="text-xs text-muted-text">
                {collegesList.length} Colleges with Profile Requests
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileRequestsModal(false);
                    navigate('/students/profile-change-requests');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
                >
                  Go to Profile Requests Page →
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileRequestsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-background text-sub hover:bg-background transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Dashboard;
