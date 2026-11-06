import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  RiHome4Line,
  RiHome4Fill,
  RiUser3Line,
  RiUser3Fill,
  RiCheckboxCircleLine,
  RiCheckboxCircleFill,
  RiBankCardLine,
  RiBankCardFill,
  RiMenuLine,
  RiLogoutBoxRLine,
} from 'react-icons/ri';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { getStaticFileUrlDirect } from '../../config/api';
import LogoutConfirmModal from '../LogoutConfirmModal';

const ParentLayout = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('parent-portal');
    document.body.classList.add('parent-portal');
    return () => {
      document.documentElement.classList.remove('parent-portal');
      document.body.classList.remove('parent-portal');
    };
  }, []);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const photoUrl = user?.student_photo
    ? (user.student_photo.startsWith('http') || user.student_photo.startsWith('data:')
      ? user.student_photo
      : getStaticFileUrlDirect(user.student_photo))
    : null;

  const navItems = [
    { icon: RiHome4Line, activeIcon: RiHome4Fill, label: 'Home', path: '/parent/dashboard' },
    { icon: RiUser3Line, activeIcon: RiUser3Fill, label: 'Student Profile', path: '/parent/profile' },
    { icon: RiCheckboxCircleLine, activeIcon: RiCheckboxCircleFill, label: 'Attendance', path: '/parent/attendance' },
    { icon: RiBankCardLine, activeIcon: RiBankCardFill, label: 'ID Card', path: '/parent/id-card' },
  ];

  const pageBackgroundStyle = {
    backgroundImage: "url('/images/login_background.png')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundColor: 'var(--background)',
  };

  return (
    <div className="parent-portal-shell fixed inset-0 flex flex-col overflow-hidden">
      <div className="fixed inset-0 pointer-events-none -z-10" style={pageBackgroundStyle} aria-hidden />
      <div
        className="fixed inset-0 pointer-events-none opacity-30 -z-10"
        style={{
          backgroundImage: 'radial-gradient(var(--border-strong) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />

      <header className="lg:hidden shrink-0 z-50 w-full bg-[var(--surface)]/95 backdrop-blur-xl border-b border-border shadow-sm pt-[env(safe-area-inset-top,0px)]">
        <div className="h-14 w-full flex items-center gap-3 px-4">
          <div className="h-10 w-10 flex items-center justify-center p-1 bg-surface rounded-xl shadow-sm border border-border shrink-0">
            <img src="/logo.png" alt="College Logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <p className="text-[10px] font-bold text-muted-text uppercase tracking-widest leading-tight">Parent</p>
            <p className="text-sm font-black text-main tracking-tight leading-tight">Portal</p>
          </div>
        </div>
      </header>

      {!desktopSidebarOpen && (
        <button
          type="button"
          className="hidden lg:flex fixed top-6 left-6 z-50 p-2 bg-[var(--surface)]/80 backdrop-blur-md rounded-lg shadow-sm border border-border text-muted-text hover:text-main"
          onClick={() => setDesktopSidebarOpen(true)}
        >
          <RiMenuLine size={20} />
        </button>
      )}

      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 w-72 bg-[var(--surface)]/95 backdrop-blur-xl border-r border-border shadow-sm transform transition-all duration-500 ${
          desktopSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col w-full">
          <div className="h-24 flex items-center justify-between px-6 border-b border-border">
            <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => navigate('/parent/dashboard')}>
              <div className="h-12 w-12 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-center p-1.5 shrink-0">
                <img src="/logo.png" alt="College Logo" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <span className="text-lg font-black text-main tracking-tight block leading-none">Parent</span>
                <span className="text-[10px] font-bold text-muted-text uppercase tracking-widest">Portal</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen(false)}
              className="p-2 text-muted-text hover:bg-background rounded-xl shrink-0"
            >
              <RiMenuLine size={18} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `relative flex items-center gap-3.5 px-4 py-3 rounded-xl text-[13px] font-bold transition-all ${
                    isActive
                      ? 'bg-[var(--primary-light)] text-primary shadow-sm border border-[var(--primary-light)]'
                      : 'text-muted-text hover:bg-background hover:text-main'
                  }`
                }
              >
                {({ isActive }) => {
                  const Icon = isActive ? item.activeIcon : item.icon;
                  return (
                    <>
                      <Icon size={20} />
                      <span>{item.label}</span>
                    </>
                  );
                }}
              </NavLink>
            ))}
          </nav>

          <div
            className="mx-5 mb-3 p-4 rounded-2xl border border-border bg-surface shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/parent/profile')}
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full overflow-hidden bg-[var(--primary-light)] ring-2 ring-white shrink-0">
                {photoUrl ? (
                  <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-primary">
                    <RiUser3Fill size={20} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-main truncate">{user?.student_name || 'Student'}</p>
                <p className="text-[11px] font-bold text-muted-text truncate">{user?.admission_number}</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-sidebar text-white text-sm font-semibold hover:bg-sidebar transition-all"
            >
              <RiLogoutBoxRLine size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main
        className={`parent-portal-scroll relative z-10 flex flex-col flex-1 min-h-0 w-full min-w-0 overflow-hidden lg:ml-0 ${
          desktopSidebarOpen ? 'lg:ml-72' : 'lg:ml-0'
        }`}
      >
        <div className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain lg:px-8 lg:py-8">
          <div className="parent-portal-page w-full min-h-full flex flex-col">
            <Outlet />
          </div>
        </div>
      </main>

      <nav className="lg:hidden shrink-0 z-[55] w-full bg-[var(--surface)]/95 backdrop-blur-3xl border-t border-border shadow-[0_-8px_32px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="h-[68px] w-full flex items-stretch justify-between px-1">
          {navItems.map((item) => (
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
                const short =
                  item.label === 'Student Profile' ? 'Profile' :
                  item.label === 'Attendance' ? 'Attend' :
                  item.label === 'ID Card' ? 'ID' : 'Home';
                return (
                  <>
                    <div className={`p-2 rounded-2xl ${isActive ? 'bg-[var(--primary-light)] -translate-y-0.5' : ''}`}>
                      <Icon size={22} />
                    </div>
                    <span className={`text-[10px] font-bold leading-none ${isActive ? 'font-extrabold' : ''}`}>
                      {short}
                    </span>
                  </>
                );
              }}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 h-full text-muted-text active:text-danger hover:text-danger transition-colors"
            aria-label="Sign out"
          >
            <div className="p-2 rounded-2xl active:bg-[var(--danger-light)]">
              <RiLogoutBoxRLine size={22} />
            </div>
            <span className="text-[10px] font-bold leading-none">Logout</span>
          </button>
        </div>
      </nav>
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
      />
    </div>
  );
};

export default ParentLayout;
