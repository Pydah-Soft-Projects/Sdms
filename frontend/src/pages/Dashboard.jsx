import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  Clock,
  ArrowRight,
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
  Settings
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import { useStudentStats } from '../hooks/useStudents';
import useAuthStore from '../store/authStore';
import { BACKEND_MODULES, hasPermission, isFullAccessRole } from '../constants/rbac';
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
  const { user } = useAuthStore();
  const userPermissions = user?.permissions || {};
  const isAdmin = isFullAccessRole(user?.role);

  const [attendancePeriod, setAttendancePeriod] = useState('today');
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

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

      {/* 3. Middle Section: Attendance Status, Events Calendar, Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        
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

            {/* Donut and Legend row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-3">
              {/* Donut ring */}
              <div className="flex items-center justify-center">
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

              {/* Status details legend */}
              <div className="flex-1 w-full space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-gray-600 font-medium">Present</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {currentPeriodAttendance.present.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-gray-600 font-medium">Absent</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {currentPeriodAttendance.absent.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-gray-600 font-medium">Pending / Holiday</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {(currentPeriodAttendance.pending + currentPeriodAttendance.holiday).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span className="text-gray-600 font-medium">Total Over All</span>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {currentPeriodAttendance.total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer of attendance status */}
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500 font-medium">
              {collegesPostedCount} / {totalCollegesCount} Colleges Posted
            </span>
            <button
              type="button"
              onClick={() => setShowBreakdownModal(true)}
              className="text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              College Wise Details <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* MIDDLE: Events Calendar Widget */}
        <div className="bg-white border border-gray-200/90 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Events Calendar</h2>
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
    </div>
  );
};

export default Dashboard;