import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  RiHome4Line,
  RiHome4Fill,
  RiUser3Line,
  RiUser3Fill,
  RiCheckboxCircleLine,
  RiCheckboxCircleFill,
  RiBankCardLine,
  RiBankCardFill,
  RiTimeLine,
  RiTimeFill,
  RiBusLine,
  RiBusFill,
  RiCalendarLine,
  RiCalendarFill,
  RiMegaphoneLine,
  RiMegaphoneFill,
  RiShieldCheckLine,
  RiShieldCheckFill,
  RiMenuLine,
  RiLogoutBoxRLine,
  RiMoreFill,
  RiCloseLine,
  RiArrowUpDownLine
} from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import api, { getStaticFileUrlDirect } from '../../config/api';
import LogoutConfirmModal from '../LogoutConfirmModal';
import ParentTopHeaderBar from '../parent/TopHeaderBar';

const ParentLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [childrenList, setChildrenList] = useState([]);
  const [showChildDropdown, setShowChildDropdown] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('parent-portal');
    document.body.classList.add('parent-portal');
    return () => {
      document.documentElement.classList.remove('parent-portal');
      document.body.classList.remove('parent-portal');
    };
  }, []);

  // Close mobile more drawer on route change
  useEffect(() => {
    setMobileMoreOpen(false);
  }, [location.pathname]);

  // Load children for switcher
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await api.get('/parent/children');
        if (res.data?.success && Array.isArray(res.data.children)) {
          setChildrenList(res.data.children);
        }
      } catch (e) {
        // Silent catch
      }
    };
    fetchChildren();
  }, [user]);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const handleSwitchChild = async (childId) => {
    if (String(childId) === String(user?.studentId || user?.id)) return;
    try {
      const res = await api.post('/parent/switch-child', { studentId: childId });
      if (res.data?.success) {
        const { token, user: newUser } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(newUser));
        useAuthStore.setState({ user: newUser, token });
        toast.success(`Switched to ${newUser.student_name}`);
        setShowChildDropdown(false);
        window.location.reload();
      }
    } catch (e) {
      toast.error('Failed to switch child');
    }
  };

  const photoUrl = user?.student_photo
    ? (user.student_photo.startsWith('http') || user.student_photo.startsWith('data:')
      ? user.student_photo
      : getStaticFileUrlDirect(user.student_photo))
    : null;

  const navItems = [
    { icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Home', path: '/parent/dashboard' },
    { icon: RiCheckboxCircleLine, activeIcon: RiCheckboxCircleFill, label: 'Attendance', path: '/parent/attendance' },
    { icon: RiBankCardLine, activeIcon: RiBankCardFill, label: 'Fees & Dues', path: '/parent/fees' },
    { icon: RiTimeLine, activeIcon: RiTimeFill, label: 'Timetable', path: '/parent/timetable' },
    { icon: RiBusLine, activeIcon: RiBusFill, label: 'Transport (GPS)', path: '/parent/transport' },
    { icon: RiCalendarLine, activeIcon: RiCalendarFill, label: 'Calendar', path: '/parent/calendar' },
    { icon: RiMegaphoneLine, activeIcon: RiMegaphoneFill, label: 'Announcements', path: '/parent/announcements' },
    { icon: RiUser3Line, activeIcon: RiUser3Fill, label: 'Student Profile', path: '/parent/profile' },
    { icon: RiShieldCheckLine, activeIcon: RiShieldCheckFill, label: 'ID Card', path: '/parent/id-card' },
  ];

  const primaryMobileNav = [
    { icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Home', path: '/parent/dashboard' },
    { icon: RiCheckboxCircleLine, activeIcon: RiCheckboxCircleFill, label: 'Attend', path: '/parent/attendance' },
    { icon: RiBankCardLine, activeIcon: RiBankCardFill, label: 'Fees', path: '/parent/fees' },
    { icon: RiTimeLine, activeIcon: RiTimeFill, label: 'Schedule', path: '/parent/timetable' },
  ];

  const secondaryMobileNav = [
    { icon: RiBusLine, label: 'Live Transport (GPS)', path: '/parent/transport' },
    { icon: RiCalendarLine, label: 'Academic Calendar', path: '/parent/calendar' },
    { icon: RiMegaphoneLine, label: 'Notices & Circulars', path: '/parent/announcements' },
    { icon: RiUser3Line, label: 'Student Profile', path: '/parent/profile' },
    { icon: RiShieldCheckLine, label: 'Digital ID Card', path: '/parent/id-card' },
  ];

  return (
    <div className="parent-portal-shell fixed inset-0 flex flex-col overflow-hidden bg-background">
      {/* Background Dot Matrix Pattern (Matching Student Portal Theme) */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40 -z-10"
        style={{
          backgroundImage: 'radial-gradient(var(--primary-light) 1.2px, transparent 1.2px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />

      {/* Top Header Mobile */}
      <header className="lg:hidden shrink-0 z-40 w-full bg-surface/95 backdrop-blur-xl border-b border-border shadow-xs pt-[env(safe-area-inset-top,0px)]">
        <div className="h-14 w-full flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 flex items-center justify-center p-1 bg-surface rounded-xl shadow-xs border border-border shrink-0">
              <img src="/campo-logos/icon-192.png" alt="CAMPO SD" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex flex-col justify-center min-w-0">
              <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest leading-tight">Parent Portal</p>
              <p className="text-xs font-black text-main truncate">{user?.student_name || 'Portal'}</p>
            </div>
          </div>

          {/* If multi-child, show switcher button on mobile header */}
          {childrenList.length > 1 && (
            <button
              type="button"
              onClick={() => setShowChildDropdown(!showChildDropdown)}
              className="px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center gap-1"
            >
              <RiArrowUpDownLine size={13} />
              <span>Switch</span>
            </button>
          )}
        </div>

        {/* Mobile child switcher dropdown */}
        {showChildDropdown && childrenList.length > 1 && (
          <div className="p-3 bg-surface border-t border-border space-y-1.5 shadow-md">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-text">Select Active Child</p>
            {childrenList.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSwitchChild(c.id)}
                className={`w-full text-left p-2 rounded-xl text-xs font-bold flex items-center justify-between ${
                  String(c.id) === String(user?.studentId || user?.id)
                    ? 'bg-primary text-white'
                    : 'bg-background hover:bg-muted text-main border border-border'
                }`}
              >
                <span>{c.student_name}</span>
                <span className="text-[10px] opacity-80 font-mono">({c.admission_number})</span>
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Floating menu button for desktop if sidebar collapsed */}
      {!desktopSidebarOpen && (
        <button
          type="button"
          className="hidden lg:flex fixed top-6 left-6 z-50 p-2 bg-[var(--surface)]/80 backdrop-blur-md rounded-lg shadow-sm border border-border text-muted-text hover:text-main transition-all hover:scale-105 active:scale-95"
          onClick={() => setDesktopSidebarOpen(true)}
          title="Expand Sidebar"
        >
          <RiMenuLine size={20} />
        </button>
      )}

      {/* Desktop Sidebar (Identical to Student Portal Theme and Design) */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 backdrop-blur-xl border-r transform transition-all duration-500 ease-in-out bg-[var(--surface)]/95 border-border shadow-[4px_0_24px_-2px_rgba(0,0,0,0.02)] ${
          desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full w-full flex flex-col min-h-0 overflow-hidden">
          {/* Logo Area */}
          <div className="shrink-0 h-16 lg:h-[4.25rem] flex items-center justify-between px-5 border-b transition-all duration-300 border-border bg-[var(--surface)]/50">
            <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => navigate('/parent/dashboard')}>
              <img
                src="/campo-logos/icon-192.png"
                alt="CAMPO SD"
                className="h-11 w-11 rounded-2xl object-contain shadow-md transition-transform duration-300 group-hover:scale-105"
              />
              <div className="flex flex-col justify-center">
                <span className="text-lg font-black text-main tracking-tight leading-none">
                  CAMPO
                </span>
                <span className="text-[10px] font-bold text-muted-text uppercase tracking-widest mt-0.5">
                  Parent Portal
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen(false)}
              className="p-2 text-muted-text hover:text-main hover:bg-[var(--background)]/80 rounded-xl transition-all active:scale-90"
            >
              <RiMenuLine size={18} />
            </button>
          </div>

          {/* Navigation Links with Student Side Pill Indicators and Active Pulse */}
          <nav className="flex-1 min-h-0 px-3 py-4 lg:py-5 space-y-0.5 overflow-y-auto no-scrollbar scroll-smooth">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[12px] font-bold transition-all duration-200 group
                  ${isActive
                    ? 'bg-[var(--primary-light)] text-info shadow-sm border border-info'
                    : 'text-muted-text hover:bg-[var(--background)]/80 hover:text-main'}
                `}
              >
                {({ isActive }) => {
                  const Icon = isActive ? item.activeIcon : item.icon;
                  return (
                    <>
                      <span
                        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-r-full transition-all duration-500 bg-info ${
                          isActive ? 'opacity-100 translate-x-[-8px]' : 'opacity-0 scale-y-0'
                        }`}
                      />
                      <Icon
                        size={20}
                        className={`transition-all duration-300 ${
                          isActive ? 'scale-110 opacity-100' : 'opacity-70 group-hover:opacity-100 group-hover:scale-110'
                        }`}
                      />
                      <span className="tracking-tight">{item.label}</span>
                      {isActive && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full animate-pulse transition-all bg-info shadow-lg shadow-info/40" />
                      )}
                    </>
                  );
                }}
              </NavLink>
            ))}
          </nav>

          {/* User Info Card with Theme Background Accent and Child Switcher */}
          <div
            onClick={() => navigate('/parent/profile')}
            className="shrink-0 mx-5 mb-3 p-3.5 rounded-2xl border relative overflow-hidden group cursor-pointer hover:shadow-xl transition-all duration-500 bg-surface border-[var(--primary-light)] shadow-info/10"
          >
            <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-full -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 bg-[var(--primary-light)]" />
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="relative shrink-0">
                <div className="h-11 w-11 rounded-full ring-2 ring-white shadow-lg bg-background overflow-hidden relative z-10 transition-transform duration-500 group-hover:scale-105">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-[var(--primary-light)] text-info">
                      <RiUser3Fill size={20} />
                    </div>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-surface z-20 bg-success" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-black text-main truncate tracking-tight">{user?.student_name || 'Child'}</p>
                </div>
                <p className="text-[11px] font-bold text-muted-text truncate tracking-wide uppercase">{user?.admission_number}</p>
              </div>
            </div>

            {/* Child Switcher if multiple children */}
            {childrenList.length > 1 && (
              <div
                className="mt-2.5 pt-2 border-t border-border flex items-center justify-between relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[10px] text-muted-text font-bold uppercase">Children ({childrenList.length})</span>
                <button
                  type="button"
                  onClick={() => setShowChildDropdown(!showChildDropdown)}
                  className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                >
                  <RiArrowUpDownLine size={12} />
                  <span>Switch</span>
                </button>
              </div>
            )}

            {showChildDropdown && childrenList.length > 1 && (
              <div
                className="mt-2 space-y-1 pt-1 border-t border-border relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {childrenList.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      handleSwitchChild(c.id);
                      setShowChildDropdown(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between ${
                      String(c.id) === String(user?.studentId || user?.id)
                        ? 'bg-primary text-white'
                        : 'bg-background hover:bg-muted text-main border border-border'
                    }`}
                  >
                    <span className="truncate">{c.student_name}</span>
                    <span className="text-[9px] font-mono opacity-80">({c.admission_number})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sign Out Button (Identical to Student Portal) */}
          <div className="shrink-0 p-4 border-t border-border bg-[var(--background)]/30">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2.5 px-4 py-3.5 w-full rounded-xl text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 group bg-sidebar hover:bg-sidebar"
            >
              <RiLogoutBoxRLine size={18} className="group-hover:-translate-x-1 transition-transform" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Page Body - Balanced Centering with desktop sidebar padding */}
      <main
        className={`relative z-10 flex flex-col flex-1 min-h-0 w-full min-w-0 overflow-hidden transition-all duration-300 ${
          desktopSidebarOpen ? 'lg:pl-72' : 'lg:pl-0'
        }`}
      >
        {/* Desktop Top Header Bar (Matching Student Portal TopHeaderBar Design) */}
        <ParentTopHeaderBar />

        <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden shrink-0 z-40 w-full bg-surface/95 backdrop-blur-3xl border-t border-border shadow-[0_-8px_32px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="h-[64px] w-full flex items-stretch justify-between px-1">
          {primaryMobileNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 h-full ${
                  isActive ? 'text-primary' : 'text-muted-text'
                }`
              }
            >
              {({ isActive }) => {
                const Icon = isActive ? item.activeIcon : item.icon;
                return (
                  <>
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-primary/10 -translate-y-0.5' : ''}`}>
                      <Icon size={21} />
                    </div>
                    <span className={`text-[10px] font-bold leading-none ${isActive ? 'font-extrabold text-primary' : ''}`}>
                      {item.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}

          {/* "More" Trigger for secondary pages */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 h-full transition-colors ${
              mobileMoreOpen ? 'text-primary' : 'text-muted-text'
            }`}
          >
            <div className={`p-1.5 rounded-xl ${mobileMoreOpen ? 'bg-primary/10' : ''}`}>
              <RiMoreFill size={21} />
            </div>
            <span className="text-[10px] font-bold leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" Slide-up Drawer */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="w-full bg-surface rounded-t-3xl border-t border-border p-5 pb-8 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-primary">All Sections</p>
                <h3 className="text-base font-black text-main">Parent Portal Navigation</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="p-2 rounded-full hover:bg-background text-muted-text"
              >
                <RiCloseLine size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {secondaryMobileNav.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMoreOpen(false)}
                  className={({ isActive }) =>
                    `p-3 rounded-2xl border text-xs font-bold flex flex-col items-start gap-2 transition-all ${
                      isActive
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-background hover:bg-muted text-main border-border'
                    }`
                  }
                >
                  <item.icon size={20} className="text-primary" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  handleLogout();
                }}
                className="w-full py-3 rounded-xl bg-danger/10 text-danger text-xs font-bold flex items-center justify-center gap-2 hover:bg-danger/20 transition-colors"
              >
                <RiLogoutBoxRLine size={16} />
                <span>Sign Out of Parent Portal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};

export default ParentLayout;
