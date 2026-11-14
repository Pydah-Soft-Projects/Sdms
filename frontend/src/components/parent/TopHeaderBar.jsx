import React, { useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, ArrowLeft } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import useAuthStore from '../../store/authStore';
import { getStaticFileUrlDirect } from '../../config/api';

const ParentTopHeaderBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    fetchNotifications(1);
    const interval = setInterval(() => {
      fetchNotifications(1);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Dynamic time of day greeting
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
      return 'Good Afternoon';
    } else if (hour >= 17 && hour < 22) {
      return 'Good Evening';
    } else {
      return 'Good Night';
    }
  }, []);

  const displayBadgeCount = unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : 0;
  const initialLetter = (user?.student_name || user?.name || 'Damerla')?.charAt(0)?.toUpperCase() || 'P';
  const photoUrl = getStaticFileUrlDirect(user?.student_photo || user?.photo);

  return (
    <div className="hidden lg:flex sticky top-0 z-30 bg-[var(--background)]/95 backdrop-blur-md items-center justify-between py-2.5 px-6 lg:px-8 transition-all border-b border-border shadow-2xs min-h-[52px] sm:min-h-[58px]">
      {/* Left: College Logo & Time Wish with Cursive Parent */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
        {location.pathname !== '/parent/dashboard' && (
          <button
            onClick={() => navigate('/parent/dashboard')}
            className="p-1 -ml-1 text-muted-text hover:bg-[var(--background)]/80 active:scale-95 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-muted-text" />
          </button>
        )}
        <img
          src="/campo-logos/icon-192.png"
          alt="CAMPO SD"
          className="h-8 sm:h-9 w-auto object-contain drop-shadow-xs cursor-pointer block rounded-lg"
          onClick={() => navigate('/parent/dashboard')}
        />
        <div className="flex items-center border-l border-border pl-2.5 sm:pl-3 h-6 sm:h-7 min-w-0">
          <span className="text-xs sm:text-base font-extrabold text-main tracking-tight flex items-center gap-1.5 truncate leading-none">
            <span>{timeGreeting}</span>
            <span
              className="text-[var(--warning)] font-bold tracking-normal text-sm sm:text-lg ml-0.5 inline-block"
              style={{ fontFamily: "'Dancing Script', 'Brush Script MT', 'Caveat', 'Segoe Script', cursive" }}
            >
              Parent
            </span>
          </span>
        </div>
      </div>

      {/* Right: Notification Bell & Profile Initial Avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
        <button
          onClick={() => navigate('/parent/announcements')}
          className="relative flex items-center justify-center p-1.5 sm:p-2 rounded-full text-muted-text hover:bg-surface hover:text-main transition-colors cursor-pointer"
          title="View Announcements & Notifications"
        >
          <Bell className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[var(--text-primary)]" />
          {displayBadgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] sm:text-[10px] font-bold text-white bg-danger rounded-full shadow-xs border border-surface leading-none">
              {displayBadgeCount}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/parent/profile')}
          className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 aspect-square rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-xs border-2 border-[var(--primary-light)] cursor-pointer hover:bg-primary-hover transition-all font-black text-xs sm:text-sm uppercase leading-none overflow-hidden"
          title="View Student Profile"
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initialLetter
          )}
        </button>
      </div>
    </div>
  );
};

export default ParentTopHeaderBar;
