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
            className="absolute right-0 top-full mt-4 w-80 md:w-96 bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-5 duration-200"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">Notifications</h3>
                    {unreadCount > 0 && (
                        <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} New
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 hover:bg-blue-50 rounded-md transition-colors"
                            title="Mark all as read"
                        >
                            Mark all read
                        </button>
                    )}
                    {notifications.length > 0 && (
                        <button
                            onClick={clearAllNotifications}
                            className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition-colors"
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
                        <div className="bg-gray-100 p-3 rounded-full mb-3">
                            <Bell size={24} className="text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">No notifications yet</p>
                        <p className="text-xs text-gray-400 mt-1">We'll notify you when something important happens</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={`group p-4 hover:bg-gray-50 transition-colors relative ${!notification.is_read ? 'bg-blue-50/30' : ''}`}
                            >
                                <div className="flex gap-3">
                                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notification.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {notification.title || 'Notification'}
                                        </h4>
                                        <p className={`text-xs text-gray-500 mt-0.5 ${
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
                                                className="text-[10px] text-blue-600 hover:text-blue-700 mt-1"
                                            >
                                                {expandedNotificationId === notification.id ? 'Show less' : 'Show details'}
                                            </button>
                                        )}
                                        <span className="text-[10px] text-gray-400 mt-2 block">
                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!notification.is_read && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
                                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                title="Mark as read"
                                            >
                                                <Check size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
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
                                className="w-full py-2 text-xs text-center text-blue-600 hover:bg-blue-50 transition-colors font-medium border-t border-gray-100"
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
