import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import useNotificationStore from '../../store/notificationStore';
import { formatDistanceToNow } from 'date-fns';

const NotificationDropdown = ({ isOpen, onClose }) => {
    const [expandedNotificationId, setExpandedNotificationId] = useState(null);
    const {
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearAllNotifications,
        hasMore,
        page,
        isLoading
    } = useNotificationStore();

    const dropdownRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            fetchNotifications(1);
        }
    }, [isOpen, fetchNotifications]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={dropdownRef}
            className="absolute right-0 top-full mt-4 w-80 md:w-96 bg-surface rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-5 duration-200"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-[var(--background)]/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-main">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="bg-[var(--primary-light)] text-primary text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} New
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-xs text-primary hover:text-primary font-medium px-2 py-1 hover:bg-[var(--primary-light)] rounded-md transition-colors"
                            title="Mark all as read"
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAllNotifications}
                            className="text-muted-text hover:text-danger p-1.5 hover:bg-[var(--danger-light)] rounded-md transition-colors"
                            title="Clear all"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <div className="bg-background p-3 rounded-full mb-3">
                            <Bell size={24} className="text-muted-text" />
                        </div>
                        <p className="text-muted-text font-medium">No notifications yet</p>
                        <p className="text-xs text-muted-text mt-1">We'll notify you when something important happens</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`group p-4 hover:bg-background transition-colors relative ${!notification.is_read ? 'bg-[var(--primary-light)]' : ''}`}
                            >
                                <div className="flex gap-3">
                                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notification.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-main' : 'text-sub'}`}>
                                            {notification.title || 'Notification'}
                                        </h4>
                                        <p className={`text-xs text-muted-text mt-0.5 ${
                                            expandedNotificationId === notification.id
                                                ? 'whitespace-pre-line break-words'
                                                : 'line-clamp-2'
                                        }`}>
                                            {notification.message}
                                        </p>
                                        {notification.message?.length > 160 && (
                                            <button
                                                onClick={() => setExpandedNotificationId(
                                                    expandedNotificationId === notification.id ? null : notification.id
                                                )}
                                                className="text-[10px] text-primary hover:text-primary mt-1"
                                            >
                                                {expandedNotificationId === notification.id ? 'Show less' : 'Show details'}
                                            </button>
                                        )}
                                        <span className="text-[10px] text-muted-text mt-2 block">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notification.is_read && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                                className="p-1 text-muted-text hover:text-primary hover:bg-[var(--primary-light)] rounded"
                                                title="Mark as read"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                                            className="p-1 text-muted-text hover:text-danger hover:bg-[var(--danger-light)] rounded"
                                            title="Delete"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Load More Trigger can be added here if needed */}
                        {hasMore && (
                            <button
                                onClick={() => fetchNotifications(page + 1)}
                                disabled={isLoading}
                                className="w-full py-2 text-xs text-center text-primary hover:bg-[var(--primary-light)] transition-colors font-medium border-t border-border"
                            >
                                {isLoading ? 'Loading...' : 'Load More'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationDropdown;
