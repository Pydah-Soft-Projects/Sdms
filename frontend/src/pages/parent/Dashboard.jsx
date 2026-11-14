import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getStaticFileUrlDirect } from '../../config/api';
import useAuthStore from '../../store/authStore';
import { SkeletonBox } from '../../components/SkeletonLoader';
import { buildParentDisplayData } from '../../utils/parentProfileHelpers';
import transportService from '../../services/transportService';
import toast from 'react-hot-toast';
import {
  User,
  Calendar,
  CreditCard,
  ChevronRight,
  GraduationCap,
  Building2,
  BookOpen,
  Layers,
  Hash,
  Clock,
  Bus,
  Megaphone,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  RotateCw,
  Home,
  Users,
  Award,
  ArrowRight
} from 'lucide-react';

const formatCurrency = (amount) => {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  try {
    const [hRaw, mRaw] = timeStr.split(':');
    let h = parseInt(hRaw, 10);
    const m = mRaw || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
};

const ParentDashboard = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [transportPass, setTransportPass] = useState(null);
  const [childrenList, setChildrenList] = useState([]);
  const [switchingChild, setSwitchingChild] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAllData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [summaryRes, profileRes, feeRes, transRes, childrenRes] = await Promise.allSettled([
        api.get('/parent/dashboard-summary'),
        api.get('/parent/profile'),
        api.get('/parent/fees'),
        transportService.getMyTransportDetails(user?.admission_number),
        api.get('/parent/children')
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.data?.success) {
        setDashboardSummary(summaryRes.value.data.data);
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.data?.success) {
        setProfileData(buildParentDisplayData(profileRes.value.data.data));
      }
      if (feeRes.status === 'fulfilled' && feeRes.value.data?.success) {
        setFeeSummary(feeRes.value.data);
      }
      if (transRes.status === 'fulfilled' && transRes.value.data?.success) {
        setTransportPass(transRes.value.data.activePass || null);
      }
      if (childrenRes.status === 'fulfilled' && childrenRes.value.data?.success) {
        setChildrenList(childrenRes.value.data.children || []);
      }
    } catch (e) {
      console.error('Failed to load parent dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [user]);

  // Handle switching active child
  const handleSwitchChild = async (childId) => {
    if (String(childId) === String(user?.studentId || user?.id)) return;
    try {
      setSwitchingChild(true);
      const res = await api.post('/parent/switch-child', { studentId: childId });
      if (res.data?.success) {
        const { token, user: newUser } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(newUser));
        useAuthStore.setState({ user: newUser, token });
        toast.success(`Switched to ${newUser.student_name}`);
        loadAllData();
      } else {
        toast.error('Could not switch child profile');
      }
    } catch (err) {
      console.error('Switch child error:', err);
      toast.error('Failed to switch child');
    } finally {
      setSwitchingChild(false);
    }
  };

  const display = profileData || buildParentDisplayData(user);
  const photoUrl = display?.student_photo
    ? (display.student_photo.startsWith('http') || display.student_photo.startsWith('data:')
      ? display.student_photo
      : getStaticFileUrlDirect(display.student_photo))
    : null;

  // Real Attendance calculation
  const attendance = dashboardSummary?.attendance || {
    totalClasses: 0,
    attendedClasses: 0,
    percentage: 0,
    todayStatus: 'Not Marked'
  };

  // Real Fee calculation from invoices
  const feeMetrics = useMemo(() => {
    if (!feeSummary) return { total: 0, paid: 0, due: 0, hostelDue: 0, transportDue: 0 };
    const invoices = feeSummary.invoices || [];
    const transactions = feeSummary.transactions || [];

    let total = 0;
    let paid = 0;
    let hostelDue = 0;
    let transportDue = 0;

    invoices.forEach((inv) => {
      if (inv.status === 'cancelled') return;
      const amt = Number(inv.amount) || 0;
      total += amt;
      const headName = String(inv.feeHead?.name || inv.remarks || '').toLowerCase();
      if (headName.includes('hostel') || headName.includes('mess')) hostelDue += amt;
      if (headName.includes('transport') || headName.includes('bus')) transportDue += amt;
    });

    transactions.forEach((tx) => {
      if (tx.status && tx.status !== 'active') return;
      const amt = Number(tx.amount) || 0;
      paid += amt;
      const headName = String(tx.feeHead?.name || tx.remarks || '').toLowerCase();
      if (headName.includes('hostel') || headName.includes('mess')) hostelDue = Math.max(0, hostelDue - amt);
      if (headName.includes('transport') || headName.includes('bus')) transportDue = Math.max(0, transportDue - amt);
    });

    const due = Math.max(0, total - paid);
    return { total, paid, due, hostelDue, transportDue };
  }, [feeSummary]);

  const todayClasses = dashboardSummary?.todayClasses || [];
  const latestAnnouncements = dashboardSummary?.latestAnnouncements || [];
  const upcomingEvents = dashboardSummary?.upcomingEvents || [];

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col min-h-full p-4 sm:p-6 lg:p-8 space-y-4">
        <SkeletonBox className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <SkeletonBox className="h-32 rounded-2xl" />
            <SkeletonBox className="h-64 rounded-2xl" />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <SkeletonBox className="h-36 rounded-2xl" />
            <SkeletonBox className="h-36 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col min-h-full space-y-6 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 font-sans">
      {/* Multi-Child Selector Banner (if parent has multiple children) */}
      {childrenList.length > 1 && (
        <div className="p-3 bg-surface rounded-2xl border border-primary/30 shadow-xs flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 text-xs font-bold text-main shrink-0">
            <Users size={16} className="text-primary" />
            <span>Select Child:</span>
          </div>
          <div className="flex items-center gap-2">
            {childrenList.map((child) => {
              const isSelected = String(child.id) === String(user?.studentId || user?.id);
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => handleSwitchChild(child.id)}
                  disabled={switchingChild || isSelected}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-background hover:bg-muted text-muted-text border border-border'
                  }`}
                >
                  <span>{child.student_name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({child.admission_number})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hero Banner: Modern Horizontal Balanced Layout */}
      <section className="w-full rounded-2xl bg-gradient-to-r from-primary via-primary to-primary-dark text-white p-5 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" aria-hidden />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-surface border-2 border-white/80 shadow-md shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover object-center" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-background text-muted-text">
                  <User size={32} strokeWidth={1.5} />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider inline-block">
                Welcome, Parent
              </span>
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white mt-1 truncate">
                {display?.student_name || 'Student Name'}
              </h1>
              <p className="text-xs sm:text-sm text-white/90 mt-0.5 font-medium truncate">
                {display?.admission_number || '—'}
                {display?.pin_no ? ` · PIN ${display.pin_no}` : ''}
                {display?.course && display?.branch ? ` · ${display.course} (${display.branch})` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              onClick={() => loadAllData(true)}
              disabled={refreshing}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-all text-xs font-bold flex items-center gap-1.5"
              title="Refresh Dashboard"
            >
              <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </section>

      {/* Academic Information Bar */}
      <section className="w-full bg-surface p-4 rounded-2xl border border-border shadow-xs space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0 text-primary">
            <Building2 size={18} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">College</p>
            <p className="text-sm font-bold text-main mt-0.5 truncate">
              {display?.college || 'Pydah College of Engineering'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-background border border-border text-left">
            <BookOpen size={16} className="text-muted-text shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-text uppercase tracking-wide">Course</p>
              <p className="text-xs sm:text-sm font-bold text-main mt-0.5 truncate">{display?.course || '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-background border border-border text-left">
            <Layers size={16} className="text-muted-text shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-text uppercase tracking-wide">Branch</p>
              <p className="text-xs sm:text-sm font-bold text-main mt-0.5 truncate">{display?.branch || '—'}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-background border border-border text-left">
            <GraduationCap size={16} className="text-muted-text shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-text uppercase tracking-wide">Year / Semester</p>
              <p className="text-xs sm:text-sm font-bold text-main mt-0.5 truncate">
                {display?.current_year || '—'} / {display?.current_semester || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-background border border-border text-left">
            <Hash size={16} className="text-muted-text shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-text uppercase tracking-wide">Batch</p>
              <p className="text-xs sm:text-sm font-bold text-main mt-0.5 truncate">{display?.batch || '—'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Multi-Column Dashboard Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Timetable, Transport GPS Banner, Campus Circulars */}
        <div className="lg:col-span-8 space-y-6">
          {/* Today's Timetable Widget */}
          <section className="bg-surface rounded-2xl border border-border shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <div>
                  <h2 className="text-sm font-black text-main">Today's Class Schedule</h2>
                  <p className="text-[11px] text-muted-text">
                    Live schedule for {dashboardSummary?.todayDay || 'Today'}
                  </p>
                </div>
              </div>
              <Link
                to="/parent/timetable"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>Full Timetable</span>
                <ChevronRight size={14} />
              </Link>
            </div>

            {todayClasses.length === 0 ? (
              <div className="p-8 text-center text-muted-text text-xs">
                <Clock size={28} className="mx-auto mb-2 opacity-40 text-primary" />
                <p className="font-bold text-sm text-main">No classes scheduled for today.</p>
                <p className="mt-0.5 text-muted-text">Weekend or academic holiday.</p>
              </div>
            ) : (
              <div className="divide-y divide-border overflow-x-auto">
                {todayClasses.slice(0, 5).map((entry, idx) => (
                  <div key={entry.id || idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-background/40">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-black text-xs flex items-center justify-center shrink-0">
                        P{entry.slot_order || idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-main">
                          {entry.subject_name || entry.custom_label || 'Scheduled Period'}
                        </p>
                        <p className="text-[11px] text-muted-text flex items-center gap-2 mt-0.5">
                          {entry.faculty_name && <span>Faculty: {entry.faculty_name}</span>}
                          {entry.room_no && <span>· Room: {entry.room_no}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs shrink-0 font-bold text-main">
                      {entry.start_time ? formatTime12h(entry.start_time) : '—'} - {entry.end_time ? formatTime12h(entry.end_time) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Live Transport Tracking Feature Banner */}
          <section className="p-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-xs text-white shrink-0">
                <Bus size={24} />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-white text-[10px] font-black uppercase tracking-wider">
                  Live GPS Tracking
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight mt-1 text-white">
                  Child Bus Location & Real-Time Tracking
                </h3>
                <p className="text-xs text-white/90 mt-0.5 leading-relaxed">
                  {transportPass
                    ? `Route: ${transportPass.routeName || 'College Route'} · Bus ${transportPass.busId || transportPass.routeId} · Stop: ${transportPass.stopName || 'Boarding Stage'}`
                    : 'Monitor college bus real-time GPS location, arrival times, and boarding stops.'}
                </p>
              </div>
            </div>

            <Link
              to="/parent/transport"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-primary font-black text-xs hover:bg-white/90 transition-all shadow-md shrink-0"
            >
              <span>Open Live GPS Map</span>
              <ChevronRight size={15} />
            </Link>
          </section>

          {/* Campus Announcements Widget */}
          <section className="bg-surface rounded-2xl border border-border shadow-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-wider text-main">
                  Campus Circulars & Notices
                </h3>
              </div>
              <Link to="/parent/announcements" className="text-xs font-bold text-primary hover:underline">
                View All
              </Link>
            </div>

            {latestAnnouncements.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-text font-medium">
                No active announcements right now.
              </p>
            ) : (
              <div className="divide-y divide-border mt-1">
                {latestAnnouncements.slice(0, 4).map((a) => (
                  <div key={a.id} className="py-2.5 space-y-1">
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {a.target_type || 'Notice'}
                    </span>
                    <h4 className="text-xs font-bold text-main leading-snug">{a.title}</h4>
                    <p className="text-[11px] text-muted-text line-clamp-1">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column (4 cols): Attendance KPI, Fee Due KPI, Events, Quick Links */}
        <div className="lg:col-span-4 space-y-6">
          {/* Attendance KPI Card */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-success/10 text-success">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-text">Attendance Rate</h2>
                  <p className="text-2xl font-black text-main tracking-tight mt-0.5">
                    {attendance.percentage}%
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  attendance.percentage >= 75
                    ? 'bg-success/15 text-success'
                    : attendance.percentage >= 65
                    ? 'bg-warning/15 text-warning'
                    : 'bg-danger/15 text-danger'
                }`}
              >
                {attendance.percentage >= 75 ? 'Good Standing' : attendance.percentage >= 65 ? 'Warning' : 'Shortage'}
              </span>
            </div>

            {/* Attendance progress bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2 rounded-full bg-background overflow-hidden border border-border">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    attendance.percentage >= 75 ? 'bg-success' : attendance.percentage >= 65 ? 'bg-warning' : 'bg-danger'
                  }`}
                  style={{ width: `${Math.min(100, attendance.percentage)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-text font-medium">
                <span>{attendance.attendedClasses} Attended</span>
                <span>{attendance.totalClasses} Total Working Days</span>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="text-xs">
                <span className="text-muted-text">Today: </span>
                <span className="font-bold text-main">{attendance.todayStatus || 'Not Marked'}</span>
              </div>
              <Link
                to="/parent/attendance"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>View Details</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Fee Overview Card */}
          <div className="p-5 rounded-2xl bg-surface border border-border shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-text">Outstanding Fee Due</h2>
                  <p className={`text-2xl font-black tracking-tight mt-0.5 ${feeMetrics.due > 0 ? 'text-danger' : 'text-success'}`}>
                    {formatCurrency(feeMetrics.due)}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black ${
                  feeMetrics.due === 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                }`}
              >
                {feeMetrics.due === 0 ? 'Fully Paid' : 'Due Pending'}
              </span>
            </div>

            {/* Quick breakdown of Hostel / Transport dues */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-1.5 text-muted-text font-bold text-[10px] uppercase">
                  <Home size={12} className="text-amber-500" />
                  <span>Hostel Due</span>
                </div>
                <p className="text-xs font-black text-main mt-1">
                  {formatCurrency(feeMetrics.hostelDue)}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border">
                <div className="flex items-center gap-1.5 text-muted-text font-bold text-[10px] uppercase">
                  <Bus size={12} className="text-blue-500" />
                  <span>Transport Due</span>
                </div>
                <p className="text-xs font-black text-main mt-1">
                  {formatCurrency(feeMetrics.transportDue)}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-text">
                Total Paid: <span className="font-bold text-success">{formatCurrency(feeMetrics.paid)}</span>
              </span>
              <Link
                to="/parent/fees"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>View Details</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Upcoming Calendar Events Widget */}
          <div className="bg-surface rounded-2xl border border-border shadow-xs p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-primary" />
                <h3 className="text-xs font-black uppercase tracking-wider text-main">
                  Upcoming Events & Exams
                </h3>
              </div>
              <Link to="/parent/calendar" className="text-xs font-bold text-primary hover:underline">
                Calendar
              </Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-text font-medium">
                No upcoming events this week.
              </p>
            ) : (
              <div className="divide-y divide-border mt-1">
                {upcomingEvents.slice(0, 3).map((e) => (
                  <div key={e.id} className="py-2.5 space-y-1">
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
                      {e.event_type || 'Event'}
                    </span>
                    <h4 className="text-xs font-bold text-main leading-snug">{e.title}</h4>
                    {e.venue && (
                      <p className="text-[10px] text-muted-text flex items-center gap-1">
                        <MapPin size={10} /> {e.venue}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Action Navigation Grid */}
          <section className="bg-surface rounded-2xl border border-border shadow-xs p-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-muted-text mb-3">
              Quick Access Portal
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                to="/parent/attendance"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-success/10 text-success shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Attendance</p>
                  <p className="text-[10px] text-muted-text truncate">Daily records</p>
                </div>
              </Link>

              <Link
                to="/parent/fees"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  <CreditCard size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Fees & Dues</p>
                  <p className="text-[10px] text-muted-text truncate">Breakdowns</p>
                </div>
              </Link>

              <Link
                to="/parent/timetable"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                  <Clock size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Timetable</p>
                  <p className="text-[10px] text-muted-text truncate">Weekly classes</p>
                </div>
              </Link>

              <Link
                to="/parent/transport"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 shrink-0">
                  <Bus size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Live GPS</p>
                  <p className="text-[10px] text-muted-text truncate">Bus location</p>
                </div>
              </Link>

              <Link
                to="/parent/calendar"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Calendar</p>
                  <p className="text-[10px] text-muted-text truncate">Events & exams</p>
                </div>
              </Link>

              <Link
                to="/parent/announcements"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <Megaphone size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Notices</p>
                  <p className="text-[10px] text-muted-text truncate">Circulars</p>
                </div>
              </Link>

              <Link
                to="/parent/profile"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <User size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">Profile</p>
                  <p className="text-[10px] text-muted-text truncate">Full details</p>
                </div>
              </Link>

              <Link
                to="/parent/id-card"
                className="p-3 rounded-xl bg-background border border-border hover:border-primary/40 hover:bg-primary/5 transition-all flex items-center gap-2.5"
              >
                <div className="p-2 rounded-lg bg-sidebar/10 text-sidebar shrink-0">
                  <Award size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-main truncate">ID Card</p>
                  <p className="text-[10px] text-muted-text truncate">Student card</p>
                </div>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard;
