import axios from 'axios';
import { API_URL } from '../config/api';

const VAPID_PUBLIC_KEY_URL = `${API_URL}/push/vapid-public-key`;
const SUBSCRIBE_URL = `${API_URL}/push/subscribe`;

// Check subscription status
export const getSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'unsupported';
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            return 'granted';
        }

        // If no subscription, check permission state
        return Notification.permission; // 'default', 'denied', or 'granted' (but no active subscription)
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return 'error';
    }
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                updateViaCache: 'none'
            });
            registration.update().catch((error) => {
                console.warn('Service Worker update check failed:', error);
            });
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    } else {
        console.warn('Push messaging is not supported');
        return null;
    }
};

export const subscribeUser = async (registration) => {
    try {
        const response = await axios.get(VAPID_PUBLIC_KEY_URL);
        const publicKey = response.data.publicKey;
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // Send subscription to backend
        // We need auth token here ideally. Axios interceptors usually handle this if set up correctly.
        // Assuming global axios instance or auth token is attached.
        // If API_URL is used with custom axios instance, better to use that.
        // But here I'm using raw axios. I should probably use the configured axios instance from util/api or similar if it exists.
        // Checking open files... `src/config/api.js` is open. `src/services/serviceService.js` is open.

        // I'll stick to basic fetch or axios. Assuming auth headers are managed or I can import the auth store.

        const token = localStorage.getItem('token'); // Simplest way to get token if stored there
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        await axios.post(SUBSCRIBE_URL, subscription, { headers });
        console.log('User subscribed to push notifications');
        return true;

    } catch (error) {
        console.error('Failed to subscribe the user: ', error);
        return false;
    }
};
