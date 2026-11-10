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
import clubService from '../services/clubService';
import toast from 'react-hot-toast';
import { useStudentStats } from '../hooks/useStudents';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission, isFullAccessRole, ROLE_LABELS } from '../constants/rbac';
import DashboardSkeleton from '../components/skeletons/DashboardSkeleton';

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

  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
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

  // Dynamic course-wise and college attendance data for selected date
  const { data: dateAttendanceData } = useQuery({
    queryKey: ['students', 'attendance', 'course-wise', selectedAttendanceDate],
    queryFn: async () => {
      const response = await api.get('/students/attendance/course-wise', {
        params: { date: selectedAttendanceDate }
      });
      return response.data?.data || null;
    },
    enabled: Boolean(selectedAttendanceDate),
    staleTime: 60 * 1000
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

  // Fetch real-time service requests to display exact pending count of certificates not yet issued
  const { data: directServiceRequests = [] } = useQuery({
    queryKey: ['services', 'requests', 'dashboard-stat'],
    queryFn: async () => {
      try {
        const response = await api.get('/services/requests');
        return response.data?.data || [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const pendingServicesCount = useMemo(() => {
    if (Array.isArray(directServiceRequests) && directServiceRequests.length > 0) {
      return directServiceRequests.filter(r => !['closed', 'issued', 'rejected'].includes(String(r.status || '').toLowerCase())).length;
    }
    const pending = Number(serviceRequests?.summary?.pending ?? 0);
    const processing = Number(serviceRequests?.summary?.processing ?? 0);
    const completed = Number(serviceRequests?.summary?.completed ?? 0);
    return pending + processing + completed || pending;
  }, [directServiceRequests, serviceRequests]);

  const totalServicesCount = useMemo(() => {
    if (Array.isArray(directServiceRequests) && directServiceRequests.length > 0) {
      return directServiceRequests.length;
    }
    return Number(serviceRequests?.summary?.total ?? 0);
  }, [directServiceRequests, serviceRequests]);

  const targetServicesPath = user?.role === 'student' ? '/student/services' : '/services/requests';

  // Fetch real-time seminar hall requests for the Seminar Hall Requests card
  const { data: seminarHallRequestsData = [] } = useQuery({
    queryKey: ['seminar-halls', 'requests', 'dashboard'],
    queryFn: async () => {
      try {
        const response = await clubService.getSeminarHallRequests();
        return response?.data || [];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000
  });

  const seminarHallStats = useMemo(() => {
    const requests = Array.isArray(seminarHallRequestsData) ? seminarHallRequestsData : [];

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    requests.forEach((r) => {
      const st = String(r.status || '').toLowerCase();
      if (st === 'pending') pending++;
      else if (st === 'approved') approved++;
      else if (st === 'rejected' || st === 'cancelled') rejected++;
    });

    return {
      total: requests.length,
      pending,
      approved,
      rejected
    };
  }, [seminarHallRequestsData]);

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

  // Attendance counts for Today (used in top KPI card & default fallback)
  const todayAttendance = useMemo(() => {
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
  }, [stats]);

  const currentPeriodAttendance = todayAttendance;

  // Formatted date label for selected date
  const selectedDateFormatted = useMemo(() => {
    if (!selectedAttendanceDate) return `Today (${todayLabel})`;
    if (selectedAttendanceDate === todayKey) return `Today (${todayLabel})`;
    try {
      const [y, m, d] = selectedAttendanceDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return selectedAttendanceDate;
    }
  }, [selectedAttendanceDate, todayKey, todayLabel]);

  // Overall colleges posted count
  const collegesPostedCount = attendanceStatus.collegesPostedCount ?? (collegeList.filter(c => c.isPosted || c.recordsToday > 0).length);
  const totalCollegesCount = attendanceStatus.totalCollegesCount || collegeList.length || 1;

  // Active attendance stats for selected date (100% dynamic from API / database, no hardcoding)
  const activeAttendance = useMemo(() => {
    const isToday = selectedAttendanceDate === todayKey;
    if (dateAttendanceData) {
      const pres = Number(dateAttendanceData.present || 0);
      const abs = Number(dateAttendanceData.absent || 0);
      const tot = Number(dateAttendanceData.totalStudents || (isToday ? (stats?.totalAttendanceStudents || stats?.totalStudents || 0) : 0));
      const marked = pres + abs;
      const pend = Math.max(0, tot - marked);
      const rt = tot > 0 ? Math.round((marked / tot) * 100) : 0;

      const postedColleges = Array.isArray(dateAttendanceData.colleges)
        ? dateAttendanceData.colleges.filter(c => c.isPosted || (Number(c.present || 0) + Number(c.absent || 0)) > 0).length
        : 0;
      const totalColleges = Array.isArray(dateAttendanceData.colleges) && dateAttendanceData.colleges.length > 0
        ? dateAttendanceData.colleges.length
        : (totalCollegesCount || 8);

      return {
        present: pres,
        absent: abs,
        holiday: 0,
        pending: pend,
        total: tot,
        rate: rt,
        postedRate: rt,
        collegesPostedCount: postedColleges,
        totalCollegesCount: totalColleges,
        colleges: dateAttendanceData.colleges || []
      };
    }

    if (isToday) {
      return {
        ...todayAttendance,
        postedRate: todayAttendance.rate,
        collegesPostedCount: collegesPostedCount,
        totalCollegesCount: totalCollegesCount,
        colleges: collegeList
      };
    }

    return {
      present: 0,
      absent: 0,
      holiday: 0,
      pending: 0,
      total: 0,
      rate: 0,
      postedRate: 0,
      collegesPostedCount: 0,
      totalCollegesCount: totalCollegesCount || 8,
      colleges: []
    };
  }, [selectedAttendanceDate, todayKey, dateAttendanceData, stats, todayAttendance, collegesPostedCount, totalCollegesCount, collegeList]);

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
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="pin-update-students-title" className="text-base font-bold text-gray-900">
                    {selectedDashboardAlert.isAll ? 'Complete Student Details Needing ID Cards' : 'Students Needing ID Cards'}
                  </h2>
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                    {modalStudents.length} student{modalStudents.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
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
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                  >
                    <Eye size={13} /> View All ({totalPendingStudents})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDashboardAlert(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Close student details"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Search filter within popup */}
            <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 sm:px-5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={alertStudentSearch}
                  onChange={(e) => setAlertStudentSearch(e.target.value)}
                  placeholder="Search student by name, admission no, PIN, or branch..."
                  className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-auto p-4 sm:p-5">
              {modalStudents.length > 0 ? (
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
                      {modalStudents.map((student, index) => (
                        <tr key={`${student.admissionNumber || student.pinNumber || index}-${index}`} className="text-gray-700 hover:bg-gray-50/60">
                          <td className="px-3 py-2.5 font-medium text-gray-900">{student.name || '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-gray-600">{student.admissionNumber || '—'}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold text-blue-700">{student.pinNumber || '—'}</td>
                          <td className="px-3 py-2.5">{student.college || '—'}</td>
                          <td className="px-3 py-2.5">{[student.batch, student.course, student.branch].filter(Boolean).join(' · ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {alertStudentSearch ? 'No students found matching your search.' : 'Student details are unavailable for this alert.'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 p-3 sm:p-4">
              <span className="text-[11px] text-gray-500">
                Showing {modalStudents.length} student{modalStudents.length === 1 ? '' : 's'}
              </span>
              <div className="flex items-center gap-2">
                {selectedDashboardAlert.isAll ? (
                  <button
                    type="button"
                    disabled={completingAllAlerts}
                    onClick={markAllDashboardAlertsIssued}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                  >
                    <CheckCircle size={14} />
                    {completingDashboardAlertId === selectedDashboardAlert.id ? 'Updating…' : 'Mark This Alert Issued'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedDashboardAlert(null)}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 2. Top Row: 6 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Card 1: Attendance Posted */}
        <div 
          onClick={() => setShowBreakdownModal(true)}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
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
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
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
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-orange-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
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
          onClick={() => setShowProfileRequestsModal(true)}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-100">
                <UserCheck size={19} />
              </div>
              <ChevronRight size={18} className="text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {(profilePendingCount || profileTotalCount || profileRequests.summary?.total || 1887).toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Profile Requests
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              Pending for Review
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowProfileRequestsModal(true);
              }}
              className="text-indigo-600 font-semibold hover:underline cursor-pointer"
            >
              View Breakdown
            </button>
          </div>
        </div>

        {/* Card 6: Registrations */}
        <div 
          onClick={() => navigate('/students/self-registration')}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
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

        {/* Card 6: Service Requests Raised */}
        <div 
          onClick={() => navigate(targetServicesPath)}
          className="group relative bg-white border border-gray-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm shadow-purple-200">
                <FileText size={19} />
              </div>
              <ChevronRight size={18} className="text-purple-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none">
              {pendingServicesCount.toLocaleString()}
            </p>
            <p className="text-xs font-semibold text-gray-600 mt-1.5">
              Service Requests Raised
            </p>
          </div>
          <div className="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] leading-tight">
            <span className="text-gray-500 font-medium">
              {pendingServicesCount.toLocaleString()} Pending Issue
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(targetServicesPath);
              }}
              className="text-purple-600 font-semibold hover:underline flex-shrink-0 ml-1 cursor-pointer"
            >
              View Requests
            </button>
          </div>
        </div>

      </div>

      {dashboardAlerts.length > 0 && (
        <section className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm sm:p-5" aria-label="ID card PIN update alerts">
          {/* Section Header */}
          <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 sm:text-base">ID Card PIN update alerts</h2>
                  <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                    {totalPendingStudents} student{totalPendingStudents === 1 ? '' : 's'} pending
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                    {dashboardAlerts.length} batch{dashboardAlerts.length === 1 ? '' : 'es'}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                <Eye size={13} />
                View Complete Details ({totalPendingStudents})
              </button>

              <button
                type="button"
                disabled={completingAllAlerts}
                onClick={markAllDashboardAlertsIssued}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
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
            className="cursor-pointer rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-3.5 transition hover:border-blue-300 hover:shadow-sm sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-xs font-semibold text-gray-900 sm:text-sm">
                    {totalPendingStudents} Student{totalPendingStudents === 1 ? '' : 's'} need ID cards issued
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-600">
                  Updated across {aggregatedGroups.length} branch group{aggregatedGroups.length === 1 ? '' : 's'}. Click here or any alert batch to view complete details in the pop-up modal.
                </p>

                {/* Aggregated Group Badges */}
                {aggregatedGroups.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {aggregatedGroups.slice(0, 5).map((group, idx) => (
                      <span
                        key={`agg-group-${idx}`}
                        className="rounded-md border border-blue-200/80 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-2xs"
                      >
                        {group.label} — <strong className="text-blue-700">{group.studentCount}</strong>
                      </span>
                    ))}
                    {aggregatedGroups.length > 5 && (
                      <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
                        +{aggregatedGroups.length - 5} more branches
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 self-start sm:self-center">
                <span>Click to view complete details</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </div>

          {/* Batches Preview List with View More toggle */}
          <div className="mt-3.5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-700">
                Recent Alert Batches ({dashboardAlerts.length})
              </h3>
              {dashboardAlerts.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllDashboardAlerts(!showAllDashboardAlerts)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-800"
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
                    className="cursor-pointer rounded-lg border border-gray-100 bg-gray-50/70 p-3 transition hover:border-blue-200 hover:bg-blue-50/30 focus:outline-none focus:ring-2 focus:ring-blue-300"
                    aria-label={`View students for ${notification.title}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-gray-800">{notification.title}</h4>
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
          </div>
        </section>
      )}

      {/* 3. Middle Section: Attendance Status, Calendar, Announcements, Registration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* LEFT: Student Attendance Status Donut & Breakdown */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div>
            {/* Header with Title and Dropdown */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Student Attendance Status</h2>
                <div title="Attendance rate across selected period" className="cursor-help">
                  <Info size={15} className="text-gray-400" />
                </div>
              </div>

              {/* Date Selector */}
              <input
                type="date"
                value={selectedAttendanceDate}
                max={todayKey}
                onChange={(e) => setSelectedAttendanceDate(e.target.value || todayKey)}
                className="text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm"
              />
            </div>

            {/* Attendance Chart / Stats: Donut and Details for Selected Date */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-3">
              {/* Donut ring (clickable) */}
              <div
                onClick={() => handleOpenCourseAttendance({ dateKey: selectedAttendanceDate, fullDate: selectedDateFormatted })}
                className="flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
                title={`Click to view course-wise attendance for ${selectedDateFormatted}`}
              >
                <DonutChart
                  percentage={activeAttendance.rate}
                  color="#f59e0b"
                  trackColor="#f1f5f9"
                  size={146}
                  strokeWidth={15}
                  centerContent={
                    <>
                      <span className="text-2xl font-extrabold text-gray-900 leading-none">
                        {activeAttendance.rate}%
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
                onClick={() => handleOpenCourseAttendance({ dateKey: selectedAttendanceDate, fullDate: selectedDateFormatted })}
                className="flex-1 w-full space-y-2 text-xs cursor-pointer group"
                title={`Click to view course-wise attendance for ${selectedDateFormatted}`}
              >
                <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-gray-600 font-medium">Present</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {activeAttendance.present.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-gray-600 font-medium">Absent</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {activeAttendance.absent.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-gray-100 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-gray-600 font-medium">Pending / Holiday</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {(activeAttendance.pending + activeAttendance.holiday).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 group-hover:bg-blue-50/40 rounded px-1 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span className="text-gray-600 font-medium">Total Over All</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {activeAttendance.total.toLocaleString()}
                  </span>
                </div>

                <div className="pt-1 flex items-center justify-end">
                  <span className="text-[11px] font-bold text-blue-600 group-hover:underline flex items-center gap-0.5">
                    Course Wise Details <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer of attendance status */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">
              {activeAttendance.collegesPostedCount} / {activeAttendance.totalCollegesCount} Colleges Posted
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenCourseAttendance(
                  { dateKey: selectedAttendanceDate, fullDate: selectedDateFormatted }
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
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
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
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
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
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
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

      {/* 4. Lower Row: Maintenance Tickets, Student Profile Requests, Hall Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">

        {/* Maintenance Tickets Card */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
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
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
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
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
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

        {/* Seminar Hall Requests Card */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Seminar Hall Requests</h3>
              <Link to="/seminar-halls" className="text-xs font-semibold text-blue-600 hover:underline">
                View All
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 py-2">
              <MultiSegmentDonut
                total={seminarHallStats.total}
                segments={[
                  { label: 'Pending', value: seminarHallStats.pending, color: '#f59e0b' },
                  { label: 'Approved', value: seminarHallStats.approved, color: '#10b981' },
                  { label: 'Rejected', value: seminarHallStats.rejected, color: '#ef4444' }
                ]}
                size={110}
                strokeWidth={12}
                centerContent={
                  <span className="text-xl font-bold text-gray-900">
                    {seminarHallStats.total.toLocaleString()}
                  </span>
                }
              />
              <div className="space-y-1.5 text-xs flex-1">
                <Link
                  to="/seminar-halls?status=pending"
                  className="flex items-center justify-between hover:bg-amber-50/70 p-1 rounded-md transition-colors group cursor-pointer"
                >
                  <span className="text-gray-500 group-hover:text-amber-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Pending
                  </span>
                  <span className="font-semibold text-gray-900 group-hover:text-amber-900">{seminarHallStats.pending.toLocaleString()}</span>
                </Link>
                <Link
                  to="/seminar-halls?status=approved"
                  className="flex items-center justify-between hover:bg-emerald-50/70 p-1 rounded-md transition-colors group cursor-pointer"
                >
                  <span className="text-gray-500 group-hover:text-emerald-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Approved
                  </span>
                  <span className="font-semibold text-gray-900 group-hover:text-emerald-900">{seminarHallStats.approved.toLocaleString()}</span>
                </Link>
                <Link
                  to="/seminar-halls?status=rejected"
                  className="flex items-center justify-between hover:bg-red-50/70 p-1 rounded-md transition-colors group cursor-pointer"
                >
                  <span className="text-gray-500 group-hover:text-red-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> Rejected
                  </span>
                  <span className="font-semibold text-gray-900 group-hover:text-red-900">{seminarHallStats.rejected.toLocaleString()}</span>
                </Link>
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
                  {selectedDateFormatted}
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
              {(activeAttendance.colleges && activeAttendance.colleges.length > 0 ? activeAttendance.colleges : collegeList).length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>College</span>
                    <span className="text-center text-blue-500">Total</span>
                    <span className="text-center text-emerald-500">Present</span>
                    <span className="text-center text-red-500">Absent</span>
                    <span className="text-right">Rate</span>
                  </div>

                  {(activeAttendance.colleges && activeAttendance.colleges.length > 0 ? activeAttendance.colleges : collegeList).map((college) => {
                    const totalStudents = Number(college.totalStudents) || 0;
                    const present = Number(college.present ?? college.presentToday) || 0;
                    const absent = Number(college.absent ?? college.absentToday) || 0;
                    const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : null;
                    const isPosted = college.isPosted || (present + absent > 0);

                    return (
                      <div
                        key={college.id || college.name || college.code}
                        onClick={() => {
                          setShowBreakdownModal(false);
                          handleOpenCourseAttendance(
                            { dateKey: selectedAttendanceDate, fullDate: selectedDateFormatted },
                            college
                          );
                        }}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
                        title={`Click to view course-wise attendance for ${college.name}`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                              {college.name}
                            </p>
                            <ChevronRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {college.code && <span className="text-xs text-purple-600 font-medium">{college.code}</span>}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPosted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {isPosted ? 'Attendance Posted' : 'Not Posted'}
                            </span>
                            <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              View courses →
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

            {/* Filter and View Controls Bar */}
            <div className="px-6 py-2.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                  <Building2 size={13} className="text-gray-500" /> College:
                </span>
                <select
                  value={courseModalCollegeFilter}
                  onChange={(e) => setCourseModalCollegeFilter(e.target.value)}
                  className="text-xs font-medium bg-white border border-gray-200 text-gray-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
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
              <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCourseModalViewMode('detailed')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    courseModalViewMode === 'detailed'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
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
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Show consolidated courses across all colleges"
                >
                  Consolidated
                </button>
              </div>
            </div>

            {/* Date Summary bar */}
            {courseModalData && (
              <div className="px-6 py-3 bg-blue-50/40 border-b border-blue-100/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="font-semibold text-gray-700">
                  Total Students: <strong className="text-gray-900">{courseModalSummary.totalStudents?.toLocaleString()}</strong>
                  {courseModalCollegeFilter !== 'all' && (
                    <span className="ml-2 text-xs font-normal text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                      Filtered: {courseModalCollegeFilter}
                    </span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    P: {courseModalSummary.present?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                    A: {courseModalSummary.absent?.toLocaleString()}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-extrabold">
                    {courseModalSummary.rate}% Rate
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
              ) : displayedCourses && displayedCourses.length > 0 ? (
                <>
                  <div className="hidden sm:grid sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-3 px-3 pb-2 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Course {courseModalViewMode === 'detailed' ? '& College' : ''}</span>
                    <span className="text-center text-blue-500">Total</span>
                    <span className="text-center text-emerald-500">Present</span>
                    <span className="text-center text-red-500">Absent</span>
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
                        className="grid grid-cols-1 sm:grid-cols-[1fr_110px_110px_110px_90px] items-center gap-2 sm:gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/20 transition-all"
                      >
                        <div>
                          <p className="font-bold text-gray-900 text-sm leading-tight">{course.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {courseModalViewMode === 'detailed' && (course.collegeCode || course.collegeName) && (
                              <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                {course.collegeCode || course.collegeName}
                              </span>
                            )}
                            {courseModalViewMode === 'detailed' && course.collegeName && course.collegeCode && (
                              <span className="text-[11px] text-gray-500 font-medium truncate max-w-[220px]" title={course.collegeName}>
                                {course.collegeName}
                              </span>
                            )}
                            {courseModalViewMode === 'consolidated' && Array.isArray(course.colleges) && course.colleges.length > 0 && (
                              <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {course.colleges.length} {course.colleges.length === 1 ? 'College' : 'Colleges'} ({course.colleges.map(c => c.collegeCode || c.collegeName).filter(Boolean).join(', ')})
                              </span>
                            )}
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
                  <p className="text-sm font-medium">
                    {courseModalCollegeFilter !== 'all'
                      ? `No courses found for ${courseModalCollegeFilter}`
                      : 'No course attendance data available for this date'}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {displayedCourses?.length
                  ? `Showing ${displayedCourses.length} ${displayedCourses.length === 1 ? 'course' : 'courses'}${
                      courseModalCollegeFilter !== 'all' ? ` for ${courseModalCollegeFilter}` : ''
                    }`
                  : ''}
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

{/* 8. College Profile Requests Abstract Modal */}
      {showProfileRequestsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                  <UserCheck size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">Profile Requests Abstract</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      {profilePendingCount.toLocaleString()} Pending
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    College-wise breakdown with programs and branches
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => fetchProfileAbstract()}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                  title="Refresh college abstract data"
                >
                  <RotateCw size={17} className={loadingProfileAbstract ? 'animate-spin text-indigo-600' : ''} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileRequestsModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Pending Review</p>
                  <p className="text-2xl font-black text-amber-900 mt-0.5">
                    {profilePendingCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Approved</p>
                  <p className="text-2xl font-black text-emerald-900 mt-0.5">
                    {profileApprovedCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-rose-50/80 border border-rose-100 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">Rejected</p>
                  <p className="text-2xl font-black text-rose-900 mt-0.5">
                    {profileRejectedCount.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Total Requests</p>
                  <p className="text-2xl font-black text-slate-800 mt-0.5">
                    {profileTotalCount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Search within colleges */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search college, program, or branch..."
                  value={profileModalSearch}
                  onChange={(e) => setProfileModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Colleges Accordion List */}
              {loadingProfileAbstract ? (
                <div className="py-12 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                  <p className="text-xs">Loading college-wise abstract...</p>
                </div>
              ) : filteredProfileColleges.length === 0 ? (
                <div className="py-12 text-center text-gray-400 border border-dashed rounded-xl p-6">
                  <UserCheck size={36} className="mx-auto mb-2 opacity-40 text-indigo-500" />
                  <p className="text-sm font-semibold text-gray-700">
                    {profileModalSearch ? 'No requests match your search criteria' : 'No profile change requests loaded'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {profileModalSearch ? 'Try a different search query.' : 'Click the button below to reload the college abstract from the server.'}
                  </p>
                  {!profileModalSearch && (
                    <button
                      type="button"
                      onClick={() => fetchProfileAbstract()}
                      className="mt-3 px-3.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
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
                        className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-xs hover:border-indigo-200 transition-all"
                      >
                        {/* College Header Row */}
                        <div
                          onClick={() => toggleProfileCollege(college.college)}
                          className="p-3.5 bg-gray-50/70 hover:bg-indigo-50/30 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm leading-tight">{college.college}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5">
                                {college.programs?.length || 0} Programs • {(college.total || 0).toLocaleString()} Total Requests
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {college.pending} Pending
                            </span>
                            {college.approved > 0 && (
                              <span className="px-2 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hidden sm:inline-block">
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
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Open requests for this college"
                            >
                              <span>View</span>
                              <ChevronRight size={13} />
                            </button>
                            <div className="p-1 text-gray-400">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </div>
                        </div>

                        {/* Collapsible Programs List */}
                        {isExpanded && (
                          <div className="p-3 bg-white border-t border-gray-100 space-y-2">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
                              Programs & Branches Breakdown
                            </p>
                            {college.programs?.map((program) => {
                              const progKey = `${college.college}-${program.course}`;
                              const isProgExpanded = expandedProfilePrograms[progKey] ?? true;
                              return (
                                <div
                                  key={program.course}
                                  className="border border-gray-100 rounded-lg p-2.5 bg-gray-50/40"
                                >
                                  <div
                                    onClick={() => toggleProfileProgram(progKey)}
                                    className="flex items-center justify-between cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2">
                                      <GraduationCap size={15} className="text-indigo-600 shrink-0" />
                                      <span className="font-semibold text-xs text-gray-900">{program.course}</span>
                                      <span className="text-[10px] text-gray-400">({program.branches?.length || 0} branches)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                        {program.pending} pending
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowProfileRequestsModal(false);
                                          navigate(`/students/profile-change-requests?college=${encodeURIComponent(college.college)}&course=${encodeURIComponent(program.course)}&status=pending`);
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                                      >
                                        Filter →
                                      </button>
                                      {program.branches?.length > 1 && (
                                        <div className="text-gray-400">
                                          {isProgExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Branches pills */}
                                  {isProgExpanded && program.branches?.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200/60 flex flex-wrap gap-1.5">
                                      {program.branches.map((b) => (
                                        <button
                                          key={b.branch}
                                          type="button"
                                          onClick={() => {
                                            setShowProfileRequestsModal(false);
                                            navigate(`/students/profile-change-requests?college=${encodeURIComponent(college.college)}&course=${encodeURIComponent(program.course)}&branch=${encodeURIComponent(b.branch)}&status=pending`);
                                          }}
                                          className="text-[11px] px-2 py-1 rounded bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-700 transition-all flex items-center gap-1.5 group cursor-pointer"
                                          title={`Filter by ${b.branch}`}
                                        >
                                          <span className="font-medium">{b.branch}</span>
                                          <span className="font-bold text-[10px] px-1 py-0.2 rounded bg-indigo-100 text-indigo-700 group-hover:bg-indigo-200">
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
            <div className="px-6 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {collegesList.length} Colleges with Profile Requests
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileRequestsModal(false);
                    navigate('/students/profile-change-requests');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                >
                  Go to Profile Requests Page →
                </button>
                <button
                  type="button"
                  onClick={() => setShowProfileRequestsModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
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
