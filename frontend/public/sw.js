// Basic PWA Requirements
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
    console.log('Service Worker installing.');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
    console.log('Service Worker activating.');
});

// A simple fetch handler is required for PWA install criteria
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        fetch(event.request).catch(() =>
            new Response('Network unavailable', {
                status: 503,
                statusText: 'Service Unavailable'
            })
        )
    );
});

self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();

        // Determine the target URL
        // Check top-level 'url' or nested 'data.url'
        const relativeUrl = data.url || (data.data && data.data.url) || '/';

        // Create absolute URL
        const urlToOpen = new URL(relativeUrl, self.location.origin).href;

        const options = {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: data.badge || '/icon-192x192.png',
            vibrate: [100, 50, 100],
            tag: 'attendance-update', // Group similar notifications
            renotify: true,
            actions: [], // Explicitly empty actions to discourage browser defaults
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '1',
                url: urlToOpen
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Get URL from notification data
    const urlToOpen = event.notification.data.url;

    if (!urlToOpen) return;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            let matchingClient = null;

            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Check if we have a match on the exact URL or base URL
                // Mobile browsers might append query params or behave differently, so basic matching first
                if (client.url === urlToOpen || client.url.includes(urlToOpen)) {
                    matchingClient = client;
                    break;
                }
            }

            if (matchingClient) {
                return matchingClient.focus().then(client => {
                    // Optional: Navigate to key URL if it's different?
                    // return client.navigate(urlToOpen);
                    return client;
                }).catch(() => {
                    // Fallback if focus fails
                    if (clients.openWindow) return clients.openWindow(urlToOpen);
                });
            } else {
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            }
        })
    );
});
