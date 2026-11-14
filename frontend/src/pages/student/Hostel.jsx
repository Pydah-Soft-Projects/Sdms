import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import hostelService from '../../services/hostelService';
import { toast } from 'react-hot-toast';
import {
  Hotel,
  Bed,
  Utensils,
  DoorOpen,
  ShieldCheck,
  FileText,
  Receipt,
  Calendar,
  CreditCard,
  Wrench,
  Clock,
  User,
  Building,
  Phone,
  AlertTriangle,
  Tag,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowLeft,
  ChevronRight,
  Info,
  Coffee,
  Sun,
  Moon,
  Cookie
} from 'lucide-react';
import { SkeletonCard, SkeletonBox } from '../../components/SkeletonLoader';

const Hostel = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hostelData, setHostelData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);

  const fetchHostelDetails = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await hostelService.getMyHostelDetails(user?.admission_number);
      if (res.data && res.data.success) {
        setHostelData(res.data);
      } else {
        setHostelData(null);
      }
    } catch (error) {
      console.error('Failed to load hostel details:', error);
      toast.error('Unable to fetch hostel information');
      setHostelData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHostelDetails();
  }, [user?.admission_number]);

  const hasAccount = hostelData?.hasHostelAccount && hostelData?.data;
  const data = hostelData?.data || {};
  const student = data.student || {};
  const allocation = data.allocation || {};
  const fees = data.fees || {};
  const payments = data.payments || [];
  const leaves = data.leaves || [];
  const complaints = data.complaints || [];
  const attendance = data.attendance || { stats: {}, recentRecords: [] };
  const requestsHistory = data.requestsHistory || [];
  const menus = data.menus || [];
  const announcements = data.announcements || [];

  // Helper to compare calendar days in local and UTC formats
  const getLocalDateYMD = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isSameCalendarDay = (dateInput, targetDate = new Date()) => {
    if (!dateInput) return false;
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return false;
    const targetLocalYMD = getLocalDateYMD(targetDate);
    const dLocalYMD = getLocalDateYMD(d);
    const dUtcYMD = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    return dLocalYMD === targetLocalYMD || dUtcYMD === targetLocalYMD;
  };

  // Filter out any past / old dates — only keep today and upcoming menus!
  const activeMenus = useMemo(() => {
    if (!menus || menus.length === 0) return [];
    const todayLocalYMD = getLocalDateYMD(new Date());

    return menus
      .filter(m => {
        if (!m.date) return false;
        const d = new Date(m.date);
        if (isNaN(d.getTime())) return false;
        const dLocalYMD = getLocalDateYMD(d);
        const dUtcYMD = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        // Keep if today or in the future
        return dLocalYMD >= todayLocalYMD || dUtcYMD >= todayLocalYMD;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [menus]);

  // Resolve today's menu:
  // Strictly matches TODAY's date (local or UTC). NEVER falls back to old dates.
  const todayMenu = useMemo(() => {
    if (data.todayMenu && isSameCalendarDay(data.todayMenu.date)) {
      return data.todayMenu;
    }
    if (!menus || menus.length === 0) return null;

    const matchToday = menus.find(m => isSameCalendarDay(m.date));
    return matchToday || null;
  }, [data.todayMenu, menus]);

  const todayMeals = todayMenu?.meals || {};

  const hasMealsUpdated = (menuObj) => {
    if (!menuObj || !menuObj.meals) return false;
    const m = menuObj.meals;
    return Boolean(
      (m.breakfast && m.breakfast.length > 0) ||
      (m.lunch && m.lunch.length > 0) ||
      (m.snacks && m.snacks.length > 0) ||
      (m.dinner && m.dinner.length > 0)
    );
  };

  const isTodayMenuUpdated = hasMealsUpdated(todayMenu);

  // Auto-select today's menu tab if present in activeMenus
  useEffect(() => {
    if (activeMenus.length > 0) {
      const todayIdx = activeMenus.findIndex(m => isSameCalendarDay(m.date));
      if (todayIdx >= 0) {
        setSelectedMenuIndex(todayIdx);
      } else {
        setSelectedMenuIndex(0);
      }
    }
  }, [activeMenus]);

  // Format currency helper
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Helper for menu meal items
  const renderMealList = (mealItems) => {
    if (!mealItems || mealItems.length === 0) {
      return (
        <div className="py-2.5 px-3 rounded-lg bg-[var(--surface)]/80 border border-dashed border-[var(--border)] text-center">
          <span className="text-xs font-semibold text-sub">Not Updated</span>
        </div>
      );
    }
    return (
      <ul className="space-y-1.5">
        {mealItems.map((item, idx) => {
          const itemName = typeof item === 'string' ? item : item?.name || '';
          return (
            <li key={idx} className="flex items-start gap-2 text-xs text-main">
              <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
              <span>{itemName}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-8 w-48" />
          <SkeletonBox className="h-10 w-28 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
          <SkeletonCard className="h-28" />
        </div>
        <SkeletonCard className="h-96" />
      </div>
    );
  }

  // 2. Empty State: No Hostel Account Found
  if (!hasAccount) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="bg-surface rounded-2xl border border-[var(--border)] p-8 sm:p-12 text-center shadow-sm">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-[var(--primary-light)] flex items-center justify-center text-primary mb-6 shadow-inner">
            <Hotel className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-main mb-2">No Hostel Account Found</h2>
          <p className="text-sub text-sm max-w-lg mx-auto mb-6 leading-relaxed">
            There is no active hostel registration or room allocation linked to student ID{' '}
            <span className="font-semibold text-main">{user?.admission_number || user?.roll_number || 'N/A'}</span>.
            If you recently enrolled or applied for accommodation, your registration may still be under processing by the hostel administration.
          </p>

          <div className="max-w-md mx-auto bg-background rounded-xl p-4 border border-[var(--border)] text-left mb-8 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-main">
              <Info className="w-4 h-4 text-primary shrink-0" />
              <span>Hostel Warden & Support Desk</span>
            </div>
            <p className="text-xs text-sub">
              For hostel admissions, room vacancy inquiries, or allocation status, please visit the Campus Hostel Office or contact your department coordinator.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => fetchHostelDetails(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-surface hover:bg-background text-main transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Check Again
            </button>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:opacity-90 transition-opacity shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active status color badge
  const isActiveStatus = allocation.isActive;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/student/dashboard')}
              className="p-1.5 rounded-lg hover:bg-[var(--border)] text-sub transition-colors"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-main tracking-tight flex items-center gap-2.5">
              <Hotel className="w-7 h-7 text-primary" />
              <span>{allocation.hostelName || 'Hostel Accommodation'}</span>
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isActiveStatus
                  ? 'bg-[var(--success-light)] text-success border border-[var(--success-light)]'
                  : 'bg-[var(--warning-light)] text-warning border border-[var(--warning-light)]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActiveStatus ? 'bg-success' : 'bg-warning'} animate-pulse`} />
              {allocation.hostelStatus || (isActiveStatus ? 'Active' : 'Inactive')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-sub mt-1 ml-9">
            Hostel ID: <span className="font-semibold text-main">{allocation.hostelId || student.hostelId}</span>
            {allocation.academicYear && (
              <> · Academic Year: <span className="font-semibold text-main">{allocation.academicYear}</span></>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => fetchHostelDetails(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-[var(--border)] bg-surface hover:bg-background text-main transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Quick KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Room & Bed */}
        <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-sub uppercase tracking-wider">Room Allocation</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-primary">
              <Bed className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-main tracking-tight">
            Room {allocation.roomNumber}
          </div>
          <p className="text-xs text-sub mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-main">{allocation.bedNumber}</span>
            <span>•</span>
            <span>Category: <strong className="text-main">{allocation.categoryName}</strong></span>
          </p>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-sub flex justify-between">
            <span>Locker: <strong className="text-main">{allocation.lockerNumber}</strong></span>
            <span>Hostel: <strong className="text-main">{allocation.hostelCode}</strong></span>
          </div>
        </div>

        {/* Card 2: Food & Diet */}
        <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-sub uppercase tracking-wider">Mess & Meals</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--success-light)] flex items-center justify-center text-success">
              <Utensils className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-main capitalize tracking-tight flex items-center gap-2">
            <span>{allocation.mealType === 'non-veg' ? 'Non-Vegetarian' : 'Vegetarian'}</span>
            <span className="text-base">{allocation.mealType === 'non-veg' ? '🍗' : '🥦'}</span>
          </div>
          <p className="text-xs text-sub mt-1.5 flex items-center gap-1.5">
            <span>Hostel: <strong className="text-main">{allocation.hostelCode}</strong></span>
            <span>•</span>
            <span>Plan: <strong className="text-main">Full Board</strong></span>
          </p>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-sub flex justify-between">
            <span>Category: <strong className="text-main">{allocation.categoryName}</strong></span>
            <span>Admit: <strong className="text-main">{formatDate(allocation.admitDate)}</strong></span>
          </div>
        </div>

        {/* Card 3: Fee Status */}
        <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-sub uppercase tracking-wider">Fee Summary</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--warning-light)] flex items-center justify-center text-warning">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-main tracking-tight">
            {formatCurrency(fees.totalCalculatedFee)}
          </div>
          <div className="flex items-center justify-between text-xs mt-1.5">
            <span className="text-sub">Paid: <strong className="text-success">{formatCurrency(fees.totalPaid)}</strong></span>
            <span className="text-sub">Due: <strong className={fees.balanceDue > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(fees.balanceDue)}</strong></span>
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-sub flex justify-between items-center">
            <span>Status:</span>
            <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
              fees.balanceDue === 0 && fees.totalCalculatedFee > 0
                ? 'bg-[var(--success-light)] text-success'
                : fees.totalPaid > 0
                ? 'bg-[var(--warning-light)] text-warning'
                : 'bg-[var(--danger-light)] text-danger'
            }`}>
              {fees.balanceDue === 0 && fees.totalCalculatedFee > 0 ? 'Fully Paid' : fees.totalPaid > 0 ? 'Partially Paid' : 'Payment Due'}
            </span>
          </div>
        </div>

        {/* Card 4: Attendance Stats */}
        <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-sub uppercase tracking-wider">Hostel Attendance</span>
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-primary">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-main tracking-tight">
            {attendance.stats?.totalDays || 0} Days
          </div>
          <p className="text-xs text-sub mt-1.5 flex items-center gap-1.5">
            <span>Morning: <strong className="text-main">{attendance.stats?.morningPresent || 0}</strong></span>
            <span>•</span>
            <span>Evening: <strong className="text-main">{attendance.stats?.eveningPresent || 0}</strong></span>
          </p>
          <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-sub flex justify-between">
            <span>Leave Requests: <strong className="text-main">{leaves.length}</strong></span>
            <span>Tickets: <strong className="text-main">{complaints.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Today's Mess Menu Card (Positioned directly below Room Allocation & Overview cards) */}
      <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-light)] flex items-center justify-center text-primary shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-main">Today's Mess Menu</h2>
                <span className="text-xs font-normal text-sub">
                  ({formatDate(todayMenu?.date || new Date())})
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isTodayMenuUpdated
                      ? 'bg-[var(--success-light)] text-success border-[var(--success-light)]'
                      : 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isTodayMenuUpdated ? 'bg-success' : 'bg-warning'}`} />
                  {isTodayMenuUpdated ? 'Updated' : 'Not Updated'}
                </span>
              </div>
              <p className="text-xs text-sub mt-0.5">Daily 4-session mess menu schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-xs text-sub font-medium">
              Student Diet: <strong className="text-main capitalize">{allocation.mealType === 'non-veg' ? 'Non-Veg 🍗' : 'Veg 🥦'}</strong>
            </span>
            <button
              onClick={() => setActiveTab('menu')}
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>Weekly Menu</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isTodayMenuUpdated && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[var(--warning-light)]/40 border border-[var(--warning-light)] text-xs text-warning">
            <Info className="w-4 h-4 shrink-0" />
            <span>Today's mess menu schedule has not been updated yet by the hostel mess management.</span>
          </div>
        )}

        {/* 4 Sessions Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Breakfast */}
          <div className="bg-background rounded-xl border border-[var(--border)] p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold uppercase text-warning flex items-center gap-1.5">
                <Sun className="w-4 h-4" />
                Breakfast
              </span>
              <span className="text-[11px] text-sub">07:30 - 09:00 AM</span>
            </div>
            {renderMealList(todayMeals.breakfast)}
          </div>

          {/* Lunch */}
          <div className="bg-background rounded-xl border border-[var(--border)] p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                <Coffee className="w-4 h-4" />
                Lunch
              </span>
              <span className="text-[11px] text-sub">12:30 - 02:00 PM</span>
            </div>
            {renderMealList(todayMeals.lunch)}
          </div>

          {/* Evening Snacks */}
          <div className="bg-background rounded-xl border border-[var(--border)] p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold uppercase text-secondary flex items-center gap-1.5">
                <Cookie className="w-4 h-4" />
                Snacks & Tea
              </span>
              <span className="text-[11px] text-sub">04:30 - 05:30 PM</span>
            </div>
            {renderMealList(todayMeals.snacks)}
          </div>

          {/* Dinner */}
          <div className="bg-background rounded-xl border border-[var(--border)] p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <span className="text-xs font-bold uppercase text-info flex items-center gap-1.5">
                <Moon className="w-4 h-4" />
                Dinner
              </span>
              <span className="text-[11px] text-sub">07:30 - 09:00 PM</span>
            </div>
            {renderMealList(todayMeals.dinner)}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--border)] overflow-x-auto no-scrollbar">
        <nav className="flex space-x-1 sm:space-x-2" aria-label="Tabs">
          {[
            { id: 'overview', label: 'Resident Profile', icon: User },
            { id: 'menu', label: 'Mess Menu', icon: Utensils, badge: isTodayMenuUpdated ? 'Updated' : 'Not Updated' },
            { id: 'fees', label: 'Fees & Receipts', icon: Receipt, badge: payments.length },
            { id: 'leaves', label: 'Leaves & Gate Pass', icon: ShieldCheck, badge: leaves.length },
            { id: 'attendance', label: 'Attendance', icon: Calendar },
            { id: 'complaints', label: 'Complaints', icon: Wrench, badge: complaints.length },
            { id: 'history', label: 'Allocation History', icon: Clock, badge: requestsHistory.length }
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-3.5 sm:px-4 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-sub hover:text-main hover:border-[var(--border)]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isCurrent ? 'text-primary' : 'text-sub'}`} />
                <span>{tab.label}</span>
                {tab.badge != null && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      isCurrent
                        ? 'bg-[var(--primary-light)] text-primary'
                        : 'bg-[var(--border)] text-sub'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Resident Profile Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Resident Profile Card */}
          <div className="bg-surface rounded-2xl border border-[var(--border)] p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
              <div className="flex items-center gap-4">
                {student.studentPhoto ? (
                  <img
                    src={student.studentPhoto}
                    alt={student.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-primary shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-[var(--primary-light)] flex items-center justify-center text-primary font-bold text-2xl shadow-inner">
                    {student.name ? student.name.charAt(0) : 'S'}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-main">{student.name}</h3>
                  <p className="text-xs text-sub font-mono">{student.admissionNumber}</p>
                  <span className="text-xs font-semibold text-primary">{student.course} • {student.branch}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => setActiveTab('complaints')}
                  className="py-2.5 px-4 rounded-xl border border-[var(--border)] bg-background hover:bg-[var(--primary-light)] hover:text-primary text-xs font-semibold text-main transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Wrench className="w-4 h-4 text-primary" />
                  <span>Report Hostel Issue</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Roll Number</span>
                <span className="font-bold text-main mt-1 block truncate">{student.rollNumber || 'N/A'}</span>
              </div>
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Academic Year</span>
                <span className="font-bold text-main mt-1 block">{allocation.academicYear || 'N/A'}</span>
              </div>
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Year of Study</span>
                <span className="font-bold text-main mt-1 block">Year {student.year || 'N/A'} (Batch {student.batch || 'N/A'})</span>
              </div>
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Student Phone</span>
                <span className="font-bold text-main mt-1 block">{student.studentPhone || 'N/A'}</span>
              </div>
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Parent Phone</span>
                <span className="font-bold text-main mt-1 block">{student.parentPhone || student.motherPhone || 'N/A'}</span>
              </div>
              <div className="bg-background rounded-xl p-3 border border-[var(--border)]">
                <span className="text-[11px] font-medium text-sub uppercase block">Institution</span>
                <span className="font-bold text-main mt-1 block truncate">{student.college?.name || 'Pydah'}</span>
              </div>
            </div>
          </div>

          {/* Announcements Card if any */}
          {announcements.length > 0 && (
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-6 shadow-sm">
              <h3 className="text-sm font-bold text-main uppercase tracking-wider mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-warning" />
                Hostel Notices & Announcements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-4 rounded-xl bg-background border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between text-xs text-sub">
                      <span className="font-semibold text-primary">Notice</span>
                      <span>{formatDate(ann.createdAt)}</span>
                    </div>
                    <h4 className="text-sm font-bold text-main">{ann.title}</h4>
                    <p className="text-xs text-sub leading-relaxed whitespace-pre-line line-clamp-3">
                      {ann.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Mess & Food Menu */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          {activeMenus.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-12 text-center">
              <Utensils className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
              <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[var(--warning-light)] text-warning border border-[var(--warning-light)] mb-2">
                Not Updated
              </div>
              <h3 className="text-base font-bold text-main mb-1">Mess Menu Not Updated</h3>
              <p className="text-xs text-sub">Today and upcoming mess schedules have not been updated yet by hostel administration.</p>
            </div>
          ) : (
            <>
              {/* Day selection tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                {activeMenus.map((m, idx) => {
                  const isSelected = selectedMenuIndex === idx;
                  const menuDate = formatDate(m.date);
                  const isToday = isSameCalendarDay(m.date);
                  const tomorrowDate = new Date();
                  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                  const isTomorrow = isSameCalendarDay(m.date, tomorrowDate);
                  const isUpdated = hasMealsUpdated(m);

                  const tabLabel = isToday
                    ? `Today (${menuDate})`
                    : isTomorrow
                    ? `Tomorrow (${menuDate})`
                    : menuDate;

                  return (
                    <button
                      key={m.id || idx}
                      onClick={() => setSelectedMenuIndex(idx)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-surface text-sub border-[var(--border)] hover:bg-background hover:text-main'
                      }`}
                    >
                      <span>{tabLabel}</span>
                      {!isUpdated && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${isSelected ? 'bg-white/20 text-white' : 'bg-[var(--warning-light)] text-warning'}`}>
                          Not Updated
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selected Day Meals Grid */}
              {(() => {
                const currentMenu = activeMenus[selectedMenuIndex] || activeMenus[0] || todayMenu;
                const meals = currentMenu?.meals || {};
                const isSelectedToday = isSameCalendarDay(currentMenu?.date);
                const isCurrentUpdated = hasMealsUpdated(currentMenu);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-main flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-primary" />
                          <span>Mess Menu for {formatDate(currentMenu?.date)}</span>
                        </h3>
                        {isSelectedToday && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-primary">
                            Today
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                            isCurrentUpdated
                              ? 'bg-[var(--success-light)] text-success border-[var(--success-light)]'
                              : 'bg-[var(--warning-light)] text-warning border-[var(--warning-light)]'
                          }`}
                        >
                          {isCurrentUpdated ? 'Updated' : 'Not Updated'}
                        </span>
                      </div>
                      <span className="text-xs text-sub font-medium">
                        Student Diet: <strong className="text-main capitalize">{allocation.mealType || 'Veg'}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Breakfast */}
                      <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                          <span className="text-xs font-bold uppercase text-warning flex items-center gap-1.5">
                            <Sun className="w-4 h-4" />
                            Breakfast
                          </span>
                          <span className="text-[11px] text-sub">07:30 - 09:00 AM</span>
                        </div>
                        {renderMealList(meals.breakfast)}
                      </div>

                      {/* Lunch */}
                      <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                          <span className="text-xs font-bold uppercase text-primary flex items-center gap-1.5">
                            <Coffee className="w-4 h-4" />
                            Lunch
                          </span>
                          <span className="text-[11px] text-sub">12:30 - 02:00 PM</span>
                        </div>
                        {renderMealList(meals.lunch)}
                      </div>

                      {/* Evening Snacks */}
                      <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                          <span className="text-xs font-bold uppercase text-secondary flex items-center gap-1.5">
                            <Cookie className="w-4 h-4" />
                            Snacks & Tea
                          </span>
                          <span className="text-[11px] text-sub">04:30 - 05:30 PM</span>
                        </div>
                        {renderMealList(meals.snacks)}
                      </div>

                      {/* Dinner */}
                      <div className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                          <span className="text-xs font-bold uppercase text-info flex items-center gap-1.5">
                            <Moon className="w-4 h-4" />
                            Dinner
                          </span>
                          <span className="text-[11px] text-sub">07:30 - 09:00 PM</span>
                        </div>
                        {renderMealList(meals.dinner)}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Tab 3: Fees & Receipts */}
      {activeTab === 'fees' && (
        <div className="space-y-6">
          {/* Term Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {['term1', 'term2', 'term3'].map((termKey, idx) => {
              const termData = fees[termKey] || { amount: 0, lateFee: 0 };
              return (
                <div key={termKey} className="bg-surface rounded-2xl border border-[var(--border)] p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs font-bold text-sub uppercase mb-2">
                    <span>Term {idx + 1} Fee</span>
                    {termData.lateFeeApplied && (
                      <span className="text-[10px] text-danger bg-[var(--danger-light)] px-1.5 py-0.5 rounded">
                        Late Fee Applied
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold text-main">{formatCurrency(termData.amount)}</div>
                  {termData.lateFee > 0 && (
                    <p className="text-[11px] text-danger mt-1">Late Fine: +{formatCurrency(termData.lateFee)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Payment Transactions Table */}
          <div className="bg-surface rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-main flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Hostel Payment Transactions
                </h3>
                <p className="text-xs text-sub mt-0.5">Official receipts and payment confirmation history</p>
              </div>
              <span className="text-xs font-semibold text-sub">
                Total Receipts: <strong className="text-main">{payments.length}</strong>
              </span>
            </div>

            {payments.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
                <h4 className="text-sm font-bold text-main mb-1">No Payment Records</h4>
                <p className="text-xs text-sub">No fee payments have been logged for this hostel account yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background text-sub uppercase font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3.5 px-4">Receipt #</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Term</th>
                      <th className="py-3.5 px-4">Method</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Transaction / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {payments.map((p) => {
                      const isSuccess = (p.status || '').toLowerCase() === 'success';
                      return (
                        <tr key={p.id} className="hover:bg-background/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-main">{p.receiptNumber}</td>
                          <td className="py-3 px-4 text-sub">{formatDate(p.paymentDate)}</td>
                          <td className="py-3 px-4 capitalize font-medium text-main">{p.term}</td>
                          <td className="py-3 px-4 text-sub">{p.paymentMethod}</td>
                          <td className="py-3 px-4 font-bold text-main">{formatCurrency(p.amount)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                isSuccess
                                  ? 'bg-[var(--success-light)] text-success'
                                  : 'bg-[var(--warning-light)] text-warning'
                              }`}
                            >
                              {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span className="capitalize">{p.status}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sub font-mono text-[11px] truncate max-w-xs">
                            {p.transactionId !== 'N/A' ? p.transactionId : p.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Leaves & Gate Pass */}
      {activeTab === 'leaves' && (
        <div className="bg-surface rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-main flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Leave & Outing Gate Pass Records
              </h3>
              <p className="text-xs text-sub mt-0.5">Requests submitted for hostel permissions and home visits</p>
            </div>
            <span className="text-xs font-semibold text-sub">
              Total Applications: <strong className="text-main">{leaves.length}</strong>
            </span>
          </div>

          {leaves.length === 0 ? (
            <div className="p-12 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
              <h4 className="text-sm font-bold text-main mb-1">No Leave History</h4>
              <p className="text-xs text-sub">No outing or gate pass applications submitted so far.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-background text-sub uppercase font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Date Range</th>
                    <th className="py-3.5 px-4">Days</th>
                    <th className="py-3.5 px-4">Gate Pass Time</th>
                    <th className="py-3.5 px-4">Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {leaves.map((l) => {
                    const isApproved = (l.status || '').toLowerCase() === 'approved';
                    const isRejected = (l.status || '').toLowerCase() === 'rejected';
                    return (
                      <tr key={l.id} className="hover:bg-background/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-main">{l.applicationType}</td>
                        <td className="py-3 px-4 text-sub">
                          {formatDate(l.startDate)} - {formatDate(l.endDate)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-main">{l.numberOfDays}d</td>
                        <td className="py-3 px-4 text-sub">{formatDateTime(l.gatePassDateTime)}</td>
                        <td className="py-3 px-4 text-main max-w-xs truncate">{l.reason || 'Personal'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isApproved
                                ? 'bg-[var(--success-light)] text-success'
                                : isRejected
                                ? 'bg-[var(--danger-light)] text-danger'
                                : 'bg-[var(--warning-light)] text-warning'
                            }`}
                          >
                            {isApproved ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : isRejected ? (
                              <XCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            <span className="capitalize">{l.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sub">{formatDate(l.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-4 shadow-sm text-center">
              <span className="text-[11px] font-medium text-sub uppercase">Total Days</span>
              <p className="text-2xl font-bold text-main mt-1">{attendance.stats?.totalDays || 0}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-4 shadow-sm text-center">
              <span className="text-[11px] font-medium text-sub uppercase">Morning Roll Calls</span>
              <p className="text-2xl font-bold text-success mt-1">{attendance.stats?.morningPresent || 0}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-4 shadow-sm text-center">
              <span className="text-[11px] font-medium text-sub uppercase">Evening Roll Calls</span>
              <p className="text-2xl font-bold text-primary mt-1">{attendance.stats?.eveningPresent || 0}</p>
            </div>
            <div className="bg-surface rounded-2xl border border-[var(--border)] p-4 shadow-sm text-center">
              <span className="text-[11px] font-medium text-sub uppercase">Night Curfew Calls</span>
              <p className="text-2xl font-bold text-info mt-1">{attendance.stats?.nightPresent || 0}</p>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--border)]">
              <h3 className="text-base font-bold text-main flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Recent Daily Roll Call Log
              </h3>
              <p className="text-xs text-sub mt-0.5">Most recent roll call attendance records</p>
            </div>

            {(!attendance.recentRecords || attendance.recentRecords.length === 0) ? (
              <div className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
                <h4 className="text-sm font-bold text-main mb-1">No Attendance Records</h4>
                <p className="text-xs text-sub">No hostel attendance records have been registered yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-background text-sub uppercase font-semibold border-b border-[var(--border)]">
                    <tr>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-center">Morning</th>
                      <th className="py-3.5 px-4 text-center">Evening</th>
                      <th className="py-3.5 px-4 text-center">Night</th>
                      <th className="py-3.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {attendance.recentRecords.map((att) => (
                      <tr key={att.id} className="hover:bg-background/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-main">{formatDate(att.date)}</td>
                        <td className="py-3 px-4 text-center">
                          {att.morning ? (
                            <span className="inline-flex items-center gap-1 text-success font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sub">
                              <XCircle className="w-4 h-4 opacity-40" /> Absent
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {att.evening ? (
                            <span className="inline-flex items-center gap-1 text-success font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sub">
                              <XCircle className="w-4 h-4 opacity-40" /> Absent
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {att.night ? (
                            <span className="inline-flex items-center gap-1 text-success font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> Present
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-sub">
                              <XCircle className="w-4 h-4 opacity-40" /> Absent
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sub">{att.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 6: Complaints */}
      {activeTab === 'complaints' && (
        <div className="bg-surface rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-main flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Hostel Complaints & Maintenance Requests
              </h3>
              <p className="text-xs text-sub mt-0.5">Issues reported regarding room facilities, plumbing, and electricity</p>
            </div>
            <span className="text-xs font-semibold text-sub">
              Total Issues: <strong className="text-main">{complaints.length}</strong>
            </span>
          </div>

          {complaints.length === 0 ? (
            <div className="p-12 text-center">
              <Wrench className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
              <h4 className="text-sm font-bold text-main mb-1">No Maintenance Complaints</h4>
              <p className="text-xs text-sub">No issues or grievances have been lodged for your room.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-background text-sub uppercase font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Subcategory</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Reported On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {complaints.map((c) => {
                    const isClosed = (c.currentStatus || '').toLowerCase() === 'closed';
                    const isResolved = (c.currentStatus || '').toLowerCase() === 'resolved';
                    return (
                      <tr key={c.id} className="hover:bg-background/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-main">{c.category}</td>
                        <td className="py-3 px-4 text-sub">{c.subCategory || 'General'}</td>
                        <td className="py-3 px-4 text-main max-w-sm whitespace-pre-line leading-relaxed">
                          {c.description}
                        </td>
                        <td className="py-3 px-4 capitalize font-semibold text-main">{c.priority}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isClosed || isResolved
                                ? 'bg-[var(--success-light)] text-success'
                                : 'bg-[var(--warning-light)] text-warning'
                            }`}
                          >
                            <span className="capitalize">{c.currentStatus}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sub">{formatDate(c.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Allocation History */}
      {activeTab === 'history' && (
        <div className="bg-surface rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-main flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Room Allocation & Registration History
              </h3>
              <p className="text-xs text-sub mt-0.5">Historical record of all past and current hostel tenures</p>
            </div>
            <span className="text-xs font-semibold text-sub">
              Total Terms: <strong className="text-main">{requestsHistory.length}</strong>
            </span>
          </div>

          {requestsHistory.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="w-12 h-12 mx-auto text-sub mb-3 opacity-40" />
              <h4 className="text-sm font-bold text-main mb-1">No Past Allocation History</h4>
              <p className="text-xs text-sub">No previous academic year allocations recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-background text-sub uppercase font-semibold border-b border-[var(--border)]">
                  <tr>
                    <th className="py-3.5 px-4">Academic Year</th>
                    <th className="py-3.5 px-4">Hostel</th>
                    <th className="py-3.5 px-4">Room #</th>
                    <th className="py-3.5 px-4">Bed #</th>
                    <th className="py-3.5 px-4">Locker #</th>
                    <th className="py-3.5 px-4">Meal</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Allocated Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {requestsHistory.map((req) => {
                    const isActive = (req.status || '').toLowerCase() === 'active';
                    return (
                      <tr key={req.id} className="hover:bg-background/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-main">{req.academicYear}</td>
                        <td className="py-3 px-4 text-sub font-semibold">{req.hostelCode || 'GH'}</td>
                        <td className="py-3 px-4 font-bold text-primary">{req.roomNumber || '—'}</td>
                        <td className="py-3 px-4 text-main">{req.bedNumber || '—'}</td>
                        <td className="py-3 px-4 text-sub">{req.lockerNumber || '—'}</td>
                        <td className="py-3 px-4 capitalize text-main">{req.mealType || 'veg'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                              isActive
                                ? 'bg-[var(--success-light)] text-success'
                                : 'bg-[var(--border)] text-sub'
                            }`}
                          >
                            <span className="capitalize">{req.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sub">{formatDate(req.allocatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Hostel;

