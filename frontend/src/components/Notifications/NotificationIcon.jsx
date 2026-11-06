import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import NotificationDropdown from './NotificationDropdown';
import toast from 'react-hot-toast';

const NotificationIcon = () => {
    const [isOpen, setIsOpen] = useState(false);
    const { unreadCount, fetchNotifications, hasShownLoginToast, setHasShownLoginToast } = useNotificationStore();

    // Initial fetch to get count
    useEffect(() => {
        fetchNotifications(1).then(() => {
            const currentUnreadCount = useNotificationStore.getState().unreadCount;
            const currentHasShownLoginToast = useNotificationStore.getState().hasShownLoginToast;

            if (currentUnreadCount > 0 && !currentHasShownLoginToast) {
                toast((t) => (
                    <div
                        onClick={() => {
                            setIsOpen(true);
                            toast.dismiss(t.id);
                        }}
                        className="cursor-pointer flex items-center gap-2"
                    >
                        <span className="flex-1"> You have {currentUnreadCount} new notifications!</span>
                    </div>
                ), {
                    duration: 3000,
                    position: 'top-center',
                    style: {
                        background: 'var(--text-primary)',
                        color: 'var(--surface)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontWeight: '500'
                    },
                    icon: '🔔'
                });
                setHasShownLoginToast(true);
            }
        });

        // Optional: Poll for new notifications every minute
        const interval = setInterval(() => {
            fetchNotifications(1);
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    p-3 rounded-full transition-all duration-300 relative group shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-surface backdrop-blur-sm
                    ${isOpen ? 'bg-primary text-white' : 'bg-surface text-primary hover:text-primary hover:scale-110'}
                `}
                title="Notifications"
            >
                <Bell size={28} className={`transition-transform duration-300 ${isOpen ? 'scale-110' : 'group-hover:scale-110'}`} />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center bg-danger text-white text-[10px] font-bold rounded-full border-2 border-surface shadow-sm animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
    );
};

export default NotificationIcon;
