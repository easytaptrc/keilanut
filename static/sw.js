/* Service worker: caché offline básico + notificaciones push (FCM). */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDV3SVxoFv0Lk6OwnE7-c3Upp55pcKxIqg',
  authDomain: 'egogym-39e45.firebaseapp.com',
  projectId: 'egogym-39e45',
  storageBucket: 'egogym-39e45.firebasestorage.app',
  messagingSenderId: '784474467563',
  appId: '1:784474467563:web:63a4ac5d8d6c5995d622ae',
});

const messaging = firebase.messaging();

// Mensajes "data-only" (los que envía nuestra Cloud Function) se muestran aquí.
messaging.onBackgroundMessage((payload) => {
  if (payload.notification) return; // el navegador ya la muestra
  const d = payload.data || {};
  self.registration.showNotification(d.title || 'Keila Guerrero · Nutrición', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon.png',
    data: { url: d.url || '/team' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && (event.notification.data.url || event.notification.data.FCM_MSG?.data?.url)) || '/team';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return clients.openWindow(url);
    })
  );
});

// --- Caché ---
const CACHE = 'kg-v2';
const SHELL = ['/', '/index.html', '/logo.png', '/monogram.png', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Firebase/Google/Anthropic: siempre red
  if (url.pathname.startsWith('/__/')) return;
  // Navegación: red primero, si falla, app shell
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }
  // Recursos estáticos: caché primero, luego red
  if (/\.(js|css|png|jpg|jpeg|svg|webp|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
