const https = require('https');
const webpush = require('web-push');
const { masterPool } = require('../config/database');

// Configure web-push
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

let mobileTableReady = false;
const ensureMobilePushTable = async () => {
    if (mobileTableReady) return;
    try {
        await masterPool.query(`
            CREATE TABLE IF NOT EXISTS mobile_push_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(255) NOT NULL,
                platform VARCHAR(20) DEFAULT 'android',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_token (user_id, token),
                INDEX idx_user_id (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        mobileTableReady = true;
    } catch (err) {
        console.error('Error ensuring mobile_push_tokens table:', err.message);
    }
};

// Helper to remove invalid/expired push subscriptions from database
const removeExpiredSubscription = async (endpoint) => {
    if (!endpoint) return;
    try {
        await masterPool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        console.log(`🧹 Removed expired push subscription: ${endpoint.substring(0, 50)}...`);
    } catch (err) {
        console.error('Error removing expired subscription:', err.message);
    }
};

// Helper to remove invalid Expo push tokens
const removeExpiredMobileToken = async (token) => {
    if (!token) return;
    try {
        await masterPool.query('DELETE FROM mobile_push_tokens WHERE token = ?', [token]);
        console.log(`🧹 Removed invalid mobile push token: ${token.substring(0, 40)}...`);
    } catch (err) {
        console.error('Error removing expired mobile token:', err.message);
    }
};

// Fallback direct HTTPS request to Expo push service
const postToExpo = (payload) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const options = {
            hostname: 'exp.host',
            port: 443,
            path: '/--/api/v2/push/send',
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            timeout: 10000,
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => { body += d; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
                } catch {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Expo Push request timeout'));
        });
        req.write(data);
        req.end();
    });
};

// Send notifications to Expo Push Service (Android / iOS native app)
const sendExpoPushNotification = async (messages) => {
    if (!messages || messages.length === 0) return { success: true, sent: 0 };

    try {
        const chunkSize = 100;
        let sentCount = 0;

        for (let i = 0; i < messages.length; i += chunkSize) {
            const chunk = messages.slice(i, i + chunkSize);
            let res = null;

            if (typeof fetch === 'function') {
                try {
                    const response = await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Accept-Encoding': 'gzip, deflate',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(chunk),
                    });
                    const data = await response.json();
                    res = { ok: response.ok, status: response.status, data };
                } catch {
                    res = await postToExpo(chunk);
                }
            } else {
                res = await postToExpo(chunk);
            }

            if (res && res.ok && res.data) {
                const tickets = Array.isArray(res.data.data) ? res.data.data : [];
                tickets.forEach((ticket, idx) => {
                    if (ticket.status === 'ok') {
                        sentCount++;
                    } else if (ticket.details?.error === 'DeviceNotRegistered') {
                        const invalidToken = chunk[idx]?.to;
                        if (invalidToken) removeExpiredMobileToken(invalidToken);
                    }
                });
                if (tickets.length === 0) {
                    sentCount += chunk.length;
                }
            } else {
                console.error('Expo push HTTP error:', res ? res.status : 'no response');
            }
        }

        return { success: true, sent: sentCount };
    } catch (error) {
        console.error('Expo push delivery error:', error);
        return { success: false, error: error.message || error };
    }
};

// Get VAPID Public Key
exports.getVapidPublicKey = (req, res) => {
    res.status(200).json({
        success: true,
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
};

// Subscribe User (Web Push)
exports.subscribe = async (req, res) => {
    const subscription = req.body;
    const userId = req.user ? req.user.id : null;

    if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    try {
        const [existing] = await masterPool.query(
            'SELECT id FROM push_subscriptions WHERE endpoint = ?',
            [subscription.endpoint]
        );

        const keysAuth = subscription.keys ? subscription.keys.auth : '';
        const keysP256dh = subscription.keys ? subscription.keys.p256dh : '';

        if (existing.length > 0) {
            await masterPool.query(
                'UPDATE push_subscriptions SET user_id = ?, keys_auth = ?, keys_p256dh = ? WHERE endpoint = ?',
                [userId, keysAuth, keysP256dh, subscription.endpoint]
            );
        } else {
            await masterPool.query(
                'INSERT INTO push_subscriptions (user_id, endpoint, keys_auth, keys_p256dh) VALUES (?, ?, ?, ?)',
                [userId, subscription.endpoint, keysAuth, keysP256dh]
            );
        }

        res.status(201).json({ success: true, message: 'Subscription added successfully' });
    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ success: false, message: 'Failed to save subscription' });
    }
};

// Register Mobile Push Token (Expo Android / iOS App)
exports.registerMobile = async (req, res) => {
    const { token, platform = 'android' } = req.body;
    const userId = (req.user && req.user.id) || req.body.userId || null;

    if (!token || !userId) {
        return res.status(400).json({ success: false, message: 'Token and authenticated user are required' });
    }

    try {
        await ensureMobilePushTable();
        await masterPool.query(
            `INSERT INTO mobile_push_tokens (user_id, token, platform)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE platform = VALUES(platform), updated_at = CURRENT_TIMESTAMP`,
            [userId, token, platform]
        );

        console.log(`📱 Registered mobile push token for user ${userId} [${platform}]: ${token.substring(0, 30)}...`);
        res.status(200).json({ success: true, message: 'Mobile push token registered successfully' });
    } catch (error) {
        console.error('Error saving mobile push token:', error);
        res.status(500).json({ success: false, message: 'Failed to save mobile push token' });
    }
};

// Send Notification to specific user (Web + Mobile)
exports.sendNotificationToUser = async (userId, payload) => {
    try {
        await ensureMobilePushTable();
        let sentWebCount = 0;
        let sentMobileCount = 0;

        // 1. Web Push
        const [subscriptions] = await masterPool.query(
            'SELECT * FROM push_subscriptions WHERE user_id = ?',
            [userId]
        );

        if (subscriptions.length > 0) {
            const stringPayload = JSON.stringify(payload);
            await Promise.allSettled(
                subscriptions.map(async (sub) => {
                    const pushSubscription = {
                        endpoint: sub.endpoint,
                        keys: {
                            auth: sub.keys_auth,
                            p256dh: sub.keys_p256dh
                        }
                    };
                    try {
                        await webpush.sendNotification(pushSubscription, stringPayload);
                        sentWebCount++;
                    } catch (err) {
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            await removeExpiredSubscription(sub.endpoint);
                        }
                    }
                })
            );
        }

        // 2. Mobile Push (Expo)
        const [mobileTokens] = await masterPool.query(
            'SELECT token FROM mobile_push_tokens WHERE user_id = ?',
            [userId]
        );

        if (mobileTokens.length > 0) {
            const expoMessages = mobileTokens.map((item) => ({
                to: item.token,
                sound: 'default',
                title: payload.title || 'Campo Portal Notification',
                body: payload.body || '',
                data: payload.data || {},
                priority: 'high',
                channelId: 'default',
            }));

            const expoRes = await sendExpoPushNotification(expoMessages);
            sentMobileCount = expoRes.sent || 0;
        }

        return {
            success: (sentWebCount + sentMobileCount) > 0,
            sent: sentWebCount + sentMobileCount,
            web: sentWebCount,
            mobile: sentMobileCount
        };
    } catch (error) {
        console.error('Error sending notification to user:', error);
        return { success: false, error: error.message || error };
    }
};

// Broadcast Notification (Admin only: Web + Mobile)
exports.broadcastNotification = async (req, res) => {
    const payload = req.body;

    if (!payload || !payload.title) {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    try {
        await ensureMobilePushTable();
        let sentWebCount = 0;
        let sentMobileCount = 0;

        // 1. Web Broadcast
        const [subscriptions] = await masterPool.query('SELECT * FROM push_subscriptions');
        if (subscriptions.length > 0) {
            const stringPayload = JSON.stringify(payload);
            const chunkSize = 50;
            for (let i = 0; i < subscriptions.length; i += chunkSize) {
                const chunk = subscriptions.slice(i, i + chunkSize);
                await Promise.allSettled(
                    chunk.map(async (sub) => {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                auth: sub.keys_auth,
                                p256dh: sub.keys_p256dh
                            }
                        };
                        try {
                            await webpush.sendNotification(pushSubscription, stringPayload);
                            sentWebCount++;
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await removeExpiredSubscription(sub.endpoint);
                            }
                        }
                    })
                );
            }
        }

        // 2. Mobile Broadcast
        const [mobileTokens] = await masterPool.query('SELECT token FROM mobile_push_tokens');
        if (mobileTokens.length > 0) {
            const expoMessages = mobileTokens.map((item) => ({
                to: item.token,
                sound: 'default',
                title: payload.title || 'Campo Notification',
                body: payload.body || '',
                data: payload.data || {},
                priority: 'high',
                channelId: 'default',
            }));

            const expoRes = await sendExpoPushNotification(expoMessages);
            sentMobileCount = expoRes.sent || 0;
        }

        res.json({
            success: true,
            message: 'Broadcast sent',
            sentCount: sentWebCount + sentMobileCount,
            web: sentWebCount,
            mobile: sentMobileCount
        });
    } catch (error) {
        console.error('Error broadcasting:', error);
        res.status(500).json({ success: false, message: 'Broadcast failed' });
    }
};

// Batch Notification (Internal: Web + Mobile)
exports.sendBatchNotification = async (userIds, payload) => {
    if (!userIds || userIds.length === 0) return { success: true, sent: 0 };

    try {
        await ensureMobilePushTable();
        let sentWebCount = 0;
        let sentMobileCount = 0;

        // 1. Send Web Push
        const [subscriptions] = await masterPool.query(
            'SELECT * FROM push_subscriptions WHERE user_id IN (?)',
            [userIds]
        );

        if (subscriptions.length > 0) {
            const stringPayload = JSON.stringify(payload);
            const chunkSize = 50;
            for (let i = 0; i < subscriptions.length; i += chunkSize) {
                const chunk = subscriptions.slice(i, i + chunkSize);
                await Promise.allSettled(
                    chunk.map(async (sub) => {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: {
                                auth: sub.keys_auth,
                                p256dh: sub.keys_p256dh
                            }
                        };
                        try {
                            await webpush.sendNotification(pushSubscription, stringPayload);
                            sentWebCount++;
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await removeExpiredSubscription(sub.endpoint);
                            }
                        }
                    })
                );
            }
        }

        // 2. Send Mobile Push (Expo Push Notifications)
        const [mobileTokens] = await masterPool.query(
            'SELECT token FROM mobile_push_tokens WHERE user_id IN (?)',
            [userIds]
        );

        if (mobileTokens.length > 0) {
            const expoMessages = mobileTokens.map((item) => ({
                to: item.token,
                sound: 'default',
                title: payload.title || 'Campo Portal Notification',
                body: payload.body || '',
                data: payload.data || {},
                priority: 'high',
                channelId: 'default',
            }));

            const expoRes = await sendExpoPushNotification(expoMessages);
            sentMobileCount = expoRes.sent || 0;
        }

        return {
            success: true,
            sent: sentWebCount + sentMobileCount,
            web: sentWebCount,
            mobile: sentMobileCount
        };
    } catch (error) {
        console.error('Batch push error:', error);
        return { success: false, error: error.message || error };
    }
};
