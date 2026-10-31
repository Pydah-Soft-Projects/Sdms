const { masterPool } = require('../config/database');
const { ROLE_LABELS } = require('../constants/rbac');

const STAFF_NOTIFICATION_ROLES = new Set([
    ...Object.keys(ROLE_LABELS),
    'admin',
    'staff'
]);

const getNotificationRecipient = (req) => {
    const role = String(req.user?.role || '').toLowerCase();
    if (role === 'student') {
        return { id: req.user.id, mobileNumber: 'WEB' };
    }
    if (STAFF_NOTIFICATION_ROLES.has(role)) {
        return { id: req.user.id, mobileNumber: 'WEB_STAFF' };
    }
    return null;
};

/**
 * Get web notifications for the authenticated student or supported staff role.
 */
exports.getNotifications = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient) {
            return res.status(403).json({ success: false, message: 'Notifications are not available for this account' });
        }

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        // Fetch notifications where mobile_number = 'WEB'
        // Map status 'Sent' -> Unread, 'Read' -> Read
        let rows;
        try {
            [rows] = await masterPool.query(
                `SELECT id, message, status, sent_at as created_at, category,
                        COALESCE(notification_data, message_id) as data
       FROM sms_logs 
       WHERE student_id = ? AND mobile_number = ?
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`,
                [recipient.id, recipient.mobileNumber, limit, offset]
            );
        } catch (error) {
            if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
            console.warn('sms_logs.notification_data is missing; reading legacy notification records.');
            [rows] = await masterPool.query(
                `SELECT id, message, status, sent_at as created_at, category, message_id as data
         FROM sms_logs
         WHERE student_id = ? AND mobile_number = ?
         ORDER BY sent_at DESC
         LIMIT ? OFFSET ?`,
                [recipient.id, recipient.mobileNumber, limit, offset]
            );
        }

        const notifications = rows.map(row => {
            // Extract title from message (format: **Title**\nMessage)
            let title = 'Notification';
            let message = row.message;

            const titleMatch = row.message.match(/^\*\*(.*?)\*\*\n/);
            if (titleMatch) {
                title = titleMatch[1];
                message = row.message.substring(titleMatch[0].length);
            }

            let data = row.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (error) {
                    data = row.data;
                }
            }

            return {
                id: row.id,
                title,
                message,
                is_read: ['Read', 'Completed'].includes(row.status) ? 1 : 0,
                is_completed: row.status === 'Completed',
                created_at: row.created_at,
                category: row.category,
                data
            };
        });

        const [countResult] = await masterPool.query(
            `SELECT COUNT(*) as total, 
       SUM(CASE WHEN status NOT IN ('Read', 'Completed') THEN 1 ELSE 0 END) as unread_count
       FROM sms_logs 
       WHERE student_id = ? AND mobile_number = ?`,
            [recipient.id, recipient.mobileNumber]
        );

        const total = countResult[0].total;
        const unreadCount = countResult[0].unread_count || 0;

        res.json({
            success: true,
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.markAsCompleted = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient || recipient.mobileNumber !== 'WEB_STAFF') {
            return res.status(403).json({ success: false, message: 'Staff notifications only' });
        }

        const [result] = await masterPool.query(
            `UPDATE sms_logs
             SET status = 'Completed'
             WHERE id = ? AND student_id = ? AND mobile_number = ?
               AND category = 'ID Card'`,
            [req.params.id, recipient.id, recipient.mobileNumber]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'ID card notification not found' });
        }

        res.json({ success: true, message: 'ID card notification marked as issued' });
    } catch (error) {
        console.error('Error completing ID card notification:', error);
        res.status(500).json({ success: false, message: 'Failed to complete notification' });
    }
};

exports.markAllIdCardsAsCompleted = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient || recipient.mobileNumber !== 'WEB_STAFF') {
            return res.status(403).json({ success: false, message: 'Staff notifications only' });
        }

        const [result] = await masterPool.query(
            `UPDATE sms_logs
             SET status = 'Completed'
             WHERE student_id = ? AND mobile_number = ?
               AND category = 'ID Card'
               AND status != 'Completed'`,
            [recipient.id, recipient.mobileNumber]
        );

        res.json({
            success: true,
            message: `${result.affectedRows} ID card notification(s) marked as issued`,
            count: result.affectedRows
        });
    } catch (error) {
        console.error('Error completing all ID card notifications:', error);
        res.status(500).json({ success: false, message: 'Failed to complete all ID card notifications' });
    }
};

/**
 * Mark a notification as read
 */
exports.markAsRead = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient) {
            return res.status(403).json({ success: false, message: 'Notifications are not available for this account' });
        }
        const notificationId = req.params.id;

        await masterPool.query(
            `UPDATE sms_logs 
       SET status = 'Read' 
       WHERE id = ? AND student_id = ? AND mobile_number = ?`,
            [notificationId, recipient.id, recipient.mobileNumber]
        );

        res.json({ success: true, message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient) {
            return res.status(403).json({ success: false, message: 'Notifications are not available for this account' });
        }

        await masterPool.query(
            `UPDATE sms_logs 
       SET status = 'Read' 
       WHERE student_id = ? AND mobile_number = ? AND status NOT IN ('Read', 'Completed')`,
            [recipient.id, recipient.mobileNumber]
        );

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete a notification
 */
exports.deleteNotification = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient) {
            return res.status(403).json({ success: false, message: 'Notifications are not available for this account' });
        }
        const notificationId = req.params.id;

        await masterPool.query(
            `DELETE FROM sms_logs 
       WHERE id = ? AND student_id = ? AND mobile_number = ?`,
            [notificationId, recipient.id, recipient.mobileNumber]
        );

        res.json({ success: true, message: 'Notification removed' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Delete all notifications
 */
exports.clearAllNotifications = async (req, res) => {
    try {
        const recipient = getNotificationRecipient(req);
        if (!recipient) {
            return res.status(403).json({ success: false, message: 'Notifications are not available for this account' });
        }

        await masterPool.query(
            `DELETE FROM sms_logs 
       WHERE student_id = ? AND mobile_number = ?`,
            [recipient.id, recipient.mobileNumber]
        );

        res.json({ success: true, message: 'All notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
