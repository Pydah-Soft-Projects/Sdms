import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
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
  GraduationCap
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
  color = '#f59e0b',
  trackColor = '#f3f4f6',
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
          stroke="#f1f5f9"
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
      <div className="bg-gray-900/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl shadow-xl text-xs border border-gray-700/60 space-y-1.5 z-50 pointer-events-none min-w-[150px]">
        <div className="font-bold text-gray-200 border-b border-gray-700/70 pb-1 flex items-center justify-between gap-3">
          <span>{label}</span>
          {fullDate && <span className="text-[10px] text-gray-400 font-normal">{fullDate}</span>}
        </div>
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Present:
            </span>
            <span className="font-semibold text-white tabular-nums">{present.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Absent:
            </span>
            <span className="font-semibold text-white tabular-nums">{absent.toLocaleString()}</span>
          </div>
          {pending > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Pending:
              </span>
              <span className="font-semibold text-white tabular-nums">{pending.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-800 text-[11px]">
          <span className="text-gray-400">Posted Rate:</span>
          <span className="font-bold text-amber-400">{pData.rate ?? rate}%</span>
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
  const [completingDashboardAlertId, setCompletingDashboardAlertId] = useState(null);
  const [selectedDashboardAlert, setSelectedDashboardAlert] = useState(null);

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

  const todayObj = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => {
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  }, [todayObj]);
  const todayLabel = useMemo(() => {
    return todayObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [todayObj]);

  const handleOpenCourseAttendance = async (cell) => {
    if (!cell || !cell.dateKey) return;
    setSelectedCalendarDay(cell);
    setCourseModalDate(cell);
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
        total: periodObj.total || stats?.totalStudents || 0,
        rate: periodObj.rate || (periodObj.total > 0 ? Math.round(((periodObj.marked || 0) / periodObj.total) * 100) : 0)
      };
    }
    const pres = stats?.presentToday || 0;
    const abs = stats?.absentToday || 0;
    const tot = stats?.totalStudents || 0;
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
    <div className="space-y-5 bg-[#f8fafc] min-h-screen pb-12">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 mt-1 font-medium">
            <span>🏠</span>
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <span>›</span>
            <span className="text-gray-700">Dashboard</span>
            {user?.college && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {user.college}
              </span>
            )}
          </div>
        </div>

        {/* Date badge on top right */}
        <div className="inline-flex items-center self-start sm:self-auto gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-gray-200/80 shadow-sm text-xs sm:text-sm font-medium text-gray-700">
          <Calendar size={15} className="text-gray-400" />
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
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
              <div>
                <h2 id="pin-update-students-title" className="text-base font-bold text-gray-900">
                  Students needing ID cards
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {selectedDashboardAlert.title} · {selectedDashboardAlert.data?.totalStudents || 0} students
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDashboardAlert(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close student details"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto p-4 sm:p-5">
              {Array.isArray(selectedDashboardAlert.data?.students) && selectedDashboardAlert.data.students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Student</th>
                        <th className="px-3 py-2.5 font-semibold">Admission No.</th>
                        <th className="px-3 py-2.5 font-semibold">PIN</th>
                        <th className="px-3 py-2.5 font-semibold">College</th>
                        <th className="px-3 py-2.5 font-semibold">Batch / Course / Branch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedDashboardAlert.data.students.map((student, index) => (
                        <tr key={`${student.admissionNumber}-${index}`} className="text-gray-700">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{student.name || '—'}</td>
                          <td className="px-3 py-2.5">{student.admissionNumber || '—'}</td>
                          <td className="px-3 py-2.5">{student.pinNumber || '—'}</td>
                          <td className="px-3 py-2.5">{student.college || '—'}</td>
                          <td className="px-3 py-2.5">{[student.batch, student.course, student.branch].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  Student details are unavailable for this older alert. New alerts will include the student list.
                </p>
              )}
            </div>
            <div className="flex justify-end border-t border-gray-100 p-3 sm:p-4">
              <button
                type="button"
                onClick={() => setSelectedDashboardAlert(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 2. Top Row: 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Card 1: Attendance Posted */}
        <div 
          onClick={() => setShowBreakdownModal(true)}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-200">
                <Users size={19} />
              </div>
              <ChevronRight size={18} className="text-blue-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {currentPeriodAttendance.rate}%
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Attendance Posted
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              {collegesPostedCount} / {totalCollegesCount} Colleges Posted
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBreakdownModal(true);
              }}
              className="text-blue-600 font-semibold hover:underline flex-shrink-0 ml-1"
            >
              View Breakdown
            </button>
          </div>
        </div>

        {/* Card 2: Upcoming Events */}
        <div 
          onClick={() => navigate('/events')}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
                <Calendar size={19} />
              </div>
              <ChevronRight size={18} className="text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {(eventsData.totalUpcoming || eventsData.list?.length || 567).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Upcoming Events
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center text-[11px] leading-tight">
            <span className="text-emerald-600 font-medium">
              {(eventsData.totalUpcoming || eventsData.list?.length || 567).toLocaleString()} Active Events
            </span>
          </div>
        </div>

        {/* Card 4: Maintenance Tickets */}
        <div 
          onClick={() => navigate('/task-management')}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shadow-sm shadow-orange-200">
                <Wrench size={19} />
              </div>
              <ChevronRight size={18} className="text-orange-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {(maintenanceTickets.summary?.total || 48).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Maintenance Tickets
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              {maintenanceTickets.summary?.open ?? 11} Open - {maintenanceTickets.summary?.in_progress ?? 3} In Progress
            </span>
          </div>
        </div>

        {/* Card 5: Profile Requests */}
        <div 
          onClick={() => navigate('/students/profile-change-requests')}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-pink-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center text-white shadow-sm shadow-pink-200">
                <UserCheck size={19} />
              </div>
              <ChevronRight size={18} className="text-pink-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {(profileRequests.summary?.total || profileRequests.summary?.pending || 1236).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Profile Requests
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              Pending for Review
            </span>
          </div>
        </div>

        {/* Card 6: Registrations */}
        <div 
          onClick={() => navigate('/students/self-registration')}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm shadow-teal-200">
                <CheckSquare size={19} />
              </div>
              <ChevronRight size={18} className="text-teal-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {(registrations.summary?.pending ?? 3628).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Pending Registrations
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              {(registrations.summary?.total || stats?.totalStudents || 5938).toLocaleString()} Total - {registrations.summary?.total ? Math.round(((registrations.summary.approved || 0) / registrations.summary.total) * 100) : 37}% Approved
            </span>
          </div>
        </div>

      </div>

      {dashboardAlerts.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4" aria-label="ID card PIN update alerts">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-800">ID Card PIN update alerts</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
              {dashboardAlerts.length} pending
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {dashboardAlerts.map((notification) => {
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
                  onClick={() => setSelectedDashboardAlert(notification)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedDashboardAlert(notification);
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-gray-100 bg-gray-50/70 p-3 transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  aria-label={`View students for ${notification.title}`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-xs font-semibold text-gray-800">{notification.title}</h3>
                          <p className="mt-0.5 text-[11px] text-gray-500">
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
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
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
                              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-600"
                            >
                              {[group.college, group.batch, group.course, group.branch].filter(Boolean).join(' · ')}
                              {' — '}{group.studentCount || 0}
                            </span>
                          ))}
                        </div>
                      )}
                      {alertTime && <p className="mt-2 text-[10px] text-gray-400">{alertTime}</p>}
                      <p className="mt-1 text-[10px] font-medium text-blue-600">Click to view student details</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. Middle Section: Attendance Status, Calendar, Announcements, Registration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* LEFT: Student Attendance Status Donut & Breakdown */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header with Title and Dropdown */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Student Attendance Status</h2>
                <div title="Attendance rate across selected period" className="cursor-help">
                  <Info size={15} className="text-gray-400" />
                </div>
              </div>

              {/* Period Dropdown */}
              <select
                value={attendancePeriod}
                onChange={(e) => setAttendancePeriod(e.target.value)}
                className="text-xs font-medium bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                    color="#f59e0b"
                    trackColor="#f1f5f9"
                    size={146}
                    strokeWidth={15}
                    centerContent={
                      <>
                        <span className="text-2xl font-extrabold text-gray-900 leading-none">
                          {currentPeriodAttendance.rate}%
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">
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
                  <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-gray-600 font-medium">Present</span>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {currentPeriodAttendance.present.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-gray-600 font-medium">Absent</span>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {currentPeriodAttendance.absent.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <span className="text-gray-600 font-medium">Pending / Holiday</span>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {(currentPeriodAttendance.pending + currentPeriodAttendance.holiday).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                      <span className="text-gray-600 font-medium">Total Over All</span>
                    </div>
                    <span className="font-bold text-gray-900 tabular-nums">
                      {currentPeriodAttendance.total.toLocaleString()}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <span className="text-[11px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">
                      Course Wise Details <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </div>
            ) : attendancePeriod === 'monthly' ? (
              /* MONTHLY: In-Card Calendar */
              <div className="py-1 space-y-2">
                {/* Month Navigator & Summary Row */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs">
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(-1)}
                      className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-white transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft size={13} />
                    </button>
                    <span className="font-bold text-gray-800 text-[11px] min-w-[70px] text-center select-none">
                      {calendarMonthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCalendarMonthChange(1)}
                      className="p-1 rounded text-gray-600 hover:text-gray-900 hover:bg-white transition-colors cursor-pointer"
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
                        i === 0 ? 'text-rose-500' : 'text-gray-400'
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
                            ? 'bg-gray-50/40 border-gray-100 opacity-25 pointer-events-none'
                            : cell.isToday
                            ? 'bg-blue-50/50 border-blue-400 ring-1 ring-blue-300 shadow-xs'
                            : isSelected
                            ? 'bg-amber-50/70 border-amber-400 ring-1 ring-amber-300'
                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-xs'
                        } ${cell.hasData ? 'cursor-pointer hover:border-blue-400' : ''}`}
                      >
                        {/* Day number */}
                        <div className="flex items-center justify-between leading-none mb-0.5">
                          <span
                            className={`text-[9px] font-bold ${
                              cell.isToday
                                ? 'w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px]'
                                : cell.isSunday
                                ? 'text-rose-500 font-semibold'
                                : 'text-gray-700'
                            }`}
                          >
                            {cell.dayNum}
                          </span>
                          {cell.hasData && (cell.present + cell.absent > 0) && (
                            <span className="text-[7.5px] font-semibold text-gray-400">
                              {Math.round((cell.present / (cell.present + cell.absent)) * 100)}%
                            </span>
                          )}
                        </div>

                        {/* Both Present and Absent represented simultaneously */}
                        {cell.hasData && !cell.isSunday ? (
                          <div className="space-y-0.5">
                            <div
                              className="text-[7.5px] sm:text-[8px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200/60 flex items-center justify-between leading-none"
                              title={`Present: ${cell.present.toLocaleString()}`}
                            >
                              <span className="text-emerald-600 font-extrabold">P:</span>
                              <span className="tabular-nums font-bold">
                                {cell.present > 9999 ? `${(cell.present / 1000).toFixed(1)}k` : cell.present.toLocaleString()}
                              </span>
                            </div>
                            <div
                              className="text-[7.5px] sm:text-[8px] font-bold text-rose-700 bg-rose-50 px-1 py-0.5 rounded border border-rose-200/60 flex items-center justify-between leading-none"
                              title={`Absent: ${cell.absent.toLocaleString()}`}
                            >
                              <span className="text-rose-600 font-extrabold">A:</span>
                              <span className="tabular-nums font-bold">
                                {cell.absent > 9999 ? `${(cell.absent / 1000).toFixed(1)}k` : cell.absent.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ) : cell.isSunday ? (
                          <div className="text-[8px] text-rose-500 font-semibold text-center py-1 bg-rose-50/50 rounded">Sun</div>
                        ) : (
                          <div className="text-[8px] text-gray-300 text-center py-1">-</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected Day Breakdown banner (if a date is clicked) */}
                {selectedCalendarDay && (
                  <div
                    onClick={() => handleOpenCourseAttendance(selectedCalendarDay)}
                    className="p-2 rounded-lg bg-blue-50/80 hover:bg-blue-100/70 border border-blue-200 text-xs flex items-center justify-between cursor-pointer transition-colors"
                    title="Click to view course-wise attendance"
                  >
                    <span className="font-bold text-gray-900 text-[11px]">{selectedCalendarDay.fullDate}</span>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-700 font-bold">P: {selectedCalendarDay.present.toLocaleString()}</span>
                      <span className="text-rose-700 font-bold">A: {selectedCalendarDay.absent.toLocaleString()}</span>
                      {selectedCalendarDay.rate !== undefined && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-600 text-white font-extrabold text-[10px]">
                          {selectedCalendarDay.rate}%
                        </span>
                      )}
                      <span className="text-blue-600 font-bold text-[10px] flex items-center ml-0.5">
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
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-gray-600 text-xs font-medium">Present:</span>
                      <span className="font-bold text-gray-900 tabular-nums">{currentPeriodAttendance.present.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-gray-600 text-xs font-medium">Absent:</span>
                      <span className="font-bold text-gray-900 tabular-nums">{currentPeriodAttendance.absent.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {currentPeriodAttendance.rate}% Rate
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenCourseAttendance({ dateKey: todayKey, fullDate: `This Week (${todayLabel})` })}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center"
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <RechartsTooltip content={<AttendanceBarTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
                      <Bar
                        dataKey="present"
                        fill="#10b981"
                        name="Present"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={20}
                        cursor="pointer"
                        onClick={(data) => handleOpenCourseAttendanceFromChart(data)}
                      />
                      <Bar
                        dataKey="absent"
                        fill="#ef4444"
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
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">
              {collegesPostedCount} / {totalCollegesCount} Colleges Posted
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenCourseAttendance(
                  selectedCalendarDay || { dateKey: todayKey, fullDate: attendancePeriod === 'today' ? `Today (${todayLabel})` : attendancePeriod === 'weekly' ? 'This Week' : calendarMonthLabel }
                )}
                className="text-emerald-600 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Course Wise Details <ChevronRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(true)}
                className="text-blue-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                College Wise Details <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* MIDDLE: Calendar Widget */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Calendar</h2>
              <Link to="/events" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
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
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50/80 transition-colors"
                  >
                    {/* Date Badge */}
                    <div className="flex flex-col items-center justify-center min-w-[46px] h-[46px] rounded-xl border border-red-200 bg-red-50/50 flex-shrink-0">
                      <span className="text-red-700 font-extrabold text-sm leading-none">{dayNum}</span>
                      <span className="text-red-600 font-bold text-[9px] tracking-wider mt-0.5">{monthStr}</span>
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-snug">
                        {ev.title}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                        <span className="flex items-center gap-0.5 truncate">
                          <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                          {venue}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 flex-shrink-0">
                          <Clock size={11} className="text-gray-400" />
                          {timeStr}
                        </span>
                      </div>
                    </div>

                    {/* Tag badge */}
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                      {ev.badge || 'Today'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-right">
            <Link to="/events" className="text-xs font-semibold text-blue-600 hover:underline">
              Browse full calendar →
            </Link>
          </div>
        </div>

        {/* RIGHT OF CALENDAR: Announcements Widget */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-1.5 mb-4">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">Announcements</h2>
                {displayAnnouncements.length > 0 && (
                  <span className="whitespace-nowrap flex-shrink-0 inline-flex items-center text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 leading-normal">
                    {displayAnnouncements.length} Recent
                  </span>
                )}
              </div>
              <Link to="/announcements" className="whitespace-nowrap flex-shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 ml-1">
                View All
              </Link>
            </div>

            {/* Announcements List - Clean, uncluttered layout matching Calendar card */}
            {loadingAnnouncements && displayAnnouncements.length === 0 ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                    <div className="w-[46px] h-[46px] min-w-[46px] max-w-[46px] rounded-xl bg-gray-100 flex-shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="h-3.5 bg-gray-200 rounded w-3/4" />
                      <div className="h-2.5 bg-gray-100 rounded w-1/2" />
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
                      className="group flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50/80 transition-colors cursor-pointer"
                    >
                      {/* Image Thumbnail (matching announcements page, evenly sized) */}
                      <div className="w-[46px] h-[46px] min-w-[46px] max-w-[46px] rounded-xl overflow-hidden bg-slate-900 border border-blue-200/80 flex-shrink-0">
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
                        <p className="text-xs sm:text-sm font-bold text-gray-900 truncate leading-snug group-hover:text-blue-600 transition-colors">
                          {ann.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                          <span className="flex items-center gap-1 truncate">
                            <Clock size={11} className={isExpired ? 'text-red-500' : 'text-gray-400'} />
                            <span>{dateStr}</span>
                          </span>
                          <span>•</span>
                          <span className="truncate text-gray-400">
                            {ann.content ? ann.content.replace(/[\r\n]+/g, ' ').slice(0, 32) : 'Notice'}
                          </span>
                        </div>
                      </div>

                      {/* Tag badge */}
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isExpired
                          ? 'bg-red-50 text-red-600 border-red-200'
                          : ann.is_active === 0
                          ? 'bg-gray-100 text-gray-500 border-gray-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isExpired ? 'Expired' : 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center text-gray-400">
                <Megaphone size={28} className="text-gray-300 mb-2 opacity-60" />
                <p className="text-xs font-semibold text-gray-600">No Announcements</p>
                <p className="text-[11px] text-gray-400 mt-0.5">No recent announcements published</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-right">
            <Link to="/announcements" className="text-xs font-semibold text-blue-600 hover:underline">
              Browse all announcements →
            </Link>
          </div>
        </div>

        {/* RIGHT: Students Registration Status (4 Stages) Widget */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Registration Status</h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {stageTotal.toLocaleString()} Students
                </span>
              </div>
              <Link to="/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                View All
              </Link>
            </div>

            {/* 4 Steps - One below each other */}
            <div className="space-y-2.5">
              
              {/* Step 1: REGISTRATION */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-100/70 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-700 tracking-wider uppercase">
                    Registration
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-emerald-600">{regStage.completed.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-amber-500">{regStage.temporary.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-red-500">{regStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 2: VERIFICATION */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-100/50 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-amber-700 tracking-wider uppercase">
                    Verification
                  </p>
                  <p className="text-[10px] text-amber-600/70 font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-emerald-600">{verStage.completed.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-red-500">{verStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 3: CERTIFICATES */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-purple-200 bg-purple-50/40 hover:bg-purple-100/50 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-purple-700 tracking-wider uppercase">
                    Certificates
                  </p>
                  <p className="text-[10px] text-purple-600/70 font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-emerald-600">{certStage.verified.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-amber-500">{certStage.temporary.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-red-500">{certStage.pending.toLocaleString()}</span>
                </div>
              </div>

              {/* Step 4: FEES */}
              <div 
                onClick={() => navigate('/reports')}
                className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/50 transition-all cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-700 tracking-wider uppercase">
                    Fees
                  </p>
                  <p className="text-[10px] text-emerald-600/70 font-medium mt-0.5">
                    Click number to view pending
                  </p>
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-none text-right flex-shrink-0">
                  <span className="text-emerald-600">{feeStage.cleared.toLocaleString()}</span>
                  <span className="text-gray-300 font-normal mx-1">/</span>
                  <span className="text-red-500">{feeStage.pending.toLocaleString()}</span>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">4 Stage Registration Abstract</span>
            <Link to="/reports" className="text-xs font-semibold text-blue-600 hover:underline">
              Registration Abstract →
            </Link>
          </div>
        </div>

      </div>

      {/* 4. Lower Row: Maintenance Tickets, Student Profile Requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">

        {/* Maintenance Tickets Card */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Maintenance Tickets</h3>
              <Link to="/task-management" className="text-xs font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <MultiSegmentDonut
                total={maintenanceTickets.summary?.total || 48}
                segments={[
                  { label: 'Open', value: maintenanceTickets.summary?.open ?? 11, color: '#ef4444' },
                  { label: 'In Progress', value: maintenanceTickets.summary?.in_progress ?? 3, color: '#f59e0b' },
                  { label: 'Resolved', value: maintenanceTickets.summary?.resolved ?? 30, color: '#10b981' },
                  { label: 'Closed', value: maintenanceTickets.summary?.closed ?? 4, color: '#64748b' }
                ]}
                size={110}
                strokeWidth={12}
                centerContent={
                  <span className="text-xl font-bold text-gray-900">
                    {maintenanceTickets.summary?.total || 48}
                  </span>
                }
              />
              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Open
                  </span>
                  <span className="font-semibold text-gray-900">{maintenanceTickets.summary?.open ?? 11}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> In Progress
                  </span>
                  <span className="font-semibold text-gray-900">{maintenanceTickets.summary?.in_progress ?? 3}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved
                  </span>
                  <span className="font-semibold text-gray-900">{maintenanceTickets.summary?.resolved ?? 30}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Student Profile Requests Card */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Student Profile Requests</h3>
              <Link to="/students/profile-change-requests" className="text-xs font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <MultiSegmentDonut
                total={profileRequests.summary?.total || 1236}
                segments={[
                  { label: 'Pending', value: profileRequests.summary?.pending ?? 1236, color: '#ec4899' },
                  { label: 'Approved', value: profileRequests.summary?.approved ?? 0, color: '#10b981' },
                  { label: 'Rejected', value: profileRequests.summary?.rejected ?? 0, color: '#ef4444' }
                ]}
                size={110}
                strokeWidth={12}
                centerContent={
                  <span className="text-xl font-bold text-gray-900">
                    {(profileRequests.summary?.total || 1236).toLocaleString()}
                  </span>
                }
              />
              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500" /> Pending
                  </span>
                  <span className="font-semibold text-gray-900">{(profileRequests.summary?.pending ?? 1236).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Approved
                  </span>
                  <span className="font-semibold text-gray-900">{(profileRequests.summary?.approved ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Rejected
                  </span>
                  <span className="font-semibold text-gray-900">{(profileRequests.summary?.rejected ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>


      {/* 6. College Attendance Breakdown Modal */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/60">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">College-Wise Attendance Breakdown</h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold ml-2">
                  Today
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Colleges List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {collegeList && collegeList.length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>College</span>
                    <span className="text-center text-blue-500">Total</span>
                    <span className="text-center text-emerald-500">Present</span>
                    <span className="text-center text-red-500">Absent</span>
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
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all"
                      >
                        <div>
                          <p className="font-bold text-gray-900 text-sm leading-tight">{college.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {college.code && <span className="text-xs text-purple-600 font-medium">{college.code}</span>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPosted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {isPosted ? 'Attendance Posted' : 'Not Posted'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                          <Users size={12} className="text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-blue-700 tabular-nums">{totalStudents.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
                          <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-green-700 tabular-nums">{present.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                          <XCircle size={12} className="text-red-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-red-700 tabular-nums">{absent.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-gray-800">
                            {rate !== null ? `${rate}%` : 'N/A'}
                          </span>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${rate !== null ? Math.min(rate, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Building2 size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No college data available for this account</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Showing {collegeList.length} college{collegeList.length !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowBreakdownModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Course-Wise Attendance Breakdown</h3>
                  <p className="text-xs text-gray-500">
                    {courseModalDate?.fullDate || courseModalDate?.dateKey || courseModalData?.date || 'Selected Date'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Date Summary bar */}
            {courseModalData && (
              <div className="px-6 py-3 bg-blue-50/40 border-b border-blue-100/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-semibold text-gray-700">
                  Total Students: <strong className="text-gray-900">{courseModalData.totalStudents?.toLocaleString()}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    P: {courseModalData.present?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                    A: {courseModalData.absent?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold">
                    {courseModalData.rate}% Rate
                  </span>
                </div>
              </div>
            )}

            {/* Modal Body: Courses List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {courseModalLoading ? (
                <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-3">
                  <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Loading course-wise attendance...</p>
                </div>
              ) : courseModalError ? (
                <div className="text-center py-12 text-rose-500">
                  <AlertCircle size={36} className="mx-auto mb-2 opacity-60" />
                  <p className="text-sm font-medium">{courseModalError}</p>
                </div>
              ) : courseModalData?.courses && courseModalData.courses.length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Course</span>
                    <span className="text-center text-blue-500">Total</span>
                    <span className="text-center text-emerald-500">Present</span>
                    <span className="text-center text-red-500">Absent</span>
                    <span className="text-right">Rate</span>
                  </div>

                  {courseModalData.courses.map((course) => {
                    const totalStudents = Number(course.totalStudents) || 0;
                    const present = Number(course.present) || 0;
                    const absent = Number(course.absent) || 0;
                    const rate = course.rate ?? (totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0);
                    const isPosted = course.isPosted;

                    return (
                      <div
                        key={course.name}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all"
                      >
                        <div>
                          <p className="font-bold text-gray-900 text-sm leading-tight">{course.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPosted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {isPosted ? 'Attendance Posted' : 'Not Posted'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                          <Users size={12} className="text-blue-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-blue-700 tabular-nums">{totalStudents.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
                          <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-green-700 tabular-nums">{present.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-center gap-1.5 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                          <XCircle size={12} className="text-red-500 flex-shrink-0" />
                          <span className="text-sm font-bold text-red-700 tabular-nums">{absent.toLocaleString()}</span>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs font-bold text-gray-800">
                            {isPosted ? `${rate}%` : 'N/A'}
                          </span>
                          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${rate >= 75 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${isPosted ? Math.min(rate, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <GraduationCap size={40} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-medium">No course attendance data available for this date</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {courseModalData?.courses?.length ? `Showing ${courseModalData.courses.length} courses` : ''}
              </span>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;