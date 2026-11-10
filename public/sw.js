// Service Worker for Web Push Notifications
//
// Brand of the panel (src/lib/appInstalavel.ts): on load the panel posts
// { tipo: 'marca', inicio: '/powerlink/', icone }. With the panel installed on
// the phone, tapping a notification opens the brand's panel (inside the
// installed app, whose scope is /powerlink/) and the notification shows the
// brand's icon. Kept in Cache Storage because the worker is stopped between
// events.
const BRAND_CACHE = 'neopower-marca';
const BRAND_KEY = '/__marca__';
const DEFAULT_ICON = '/icones/neopower-192.png';

// Push only, no page cache: a new version can take over right away.
self.addEventListener('install', function() {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', function(event) {
  const data = event.data;
  // inicio is a path of the panel itself ('/x/'), never another site.
  if (!data || data.tipo !== 'marca' || !/^\/[^/]/.test(String(data.inicio))) return;
  const brand = {
    inicio: data.inicio,
    icone: typeof data.icone === 'string' ? data.icone : null
  };
  event.waitUntil(
    caches.open(BRAND_CACHE).then(function(cache) {
      return cache.put(BRAND_KEY, new Response(JSON.stringify(brand)));
    })
  );
});

function readBrand() {
  return caches.open(BRAND_CACHE)
    .then(function(cache) { return cache.match(BRAND_KEY); })
    .then(function(response) { return response ? response.json() : null; })
    .catch(function() { return null; });
}

self.addEventListener('push', function(event) {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  const data = event.data.json();

  event.waitUntil(
    readBrand().then(function(brand) {
      const options = {
        body: data.body || 'Nova notificação',
        // The server's icon only when it is a full URL: its defaults
        // (/icon-192.png) don't exist in the panel. Otherwise the brand's.
        icon: /^https?:\/\//.test(data.icon || '')
          ? data.icon
          : (brand && brand.icone) || DEFAULT_ICON,
        badge: data.badge || '/badge-72.png',
        tag: data.tag || 'notification',
        data: data.data || {},
        vibrate: [100, 50, 100],
        actions: [
          { action: 'open', title: 'Abrir' },
          { action: 'close', title: 'Fechar' }
        ]
      };
      return self.registration.showNotification(data.title || 'NeoPower', options);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app or focus existing window
  event.waitUntil(
    Promise.all([clients.matchAll({ type: 'window', includeUncontrolled: true }), readBrand()])
      .then(function(result) {
        const clientList = result[0];
        const startPath = (result[1] && result[1].inicio) || '/';
        // Prefer a window of the brand's panel, then any window
        const brandWindows = clientList.filter(function(client) {
          return new URL(client.url).pathname.indexOf(startPath) === 0;
        });
        const windows = brandWindows.concat(clientList);
        for (let i = 0; i < windows.length; i++) {
          const client = windows[i];
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open the brand's panel (inside the installed app)
        if (clients.openWindow) {
          return clients.openWindow(startPath);
        }
      })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Notification was closed without being clicked
  console.log('Notification closed:', event.notification.tag);
});
