/* VrveFi service worker — offline app shell + smart caching.
   Strategy:
   - /api/*  → network-first (live data), no offline cache of stale prices
   - shell   → cache-first, updated in background (stale-while-revalidate) */
const VERSION = 'vrvefi-v4';
const SHELL = [
  './', './index.html',
  './css/styles.css',
  './js/auth-config.js', './js/auth.js',
  './js/data.js', './js/api.js', './js/charts.js',
  './js/market.js', './js/ai.js', './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Live API: always try network; the app already falls back to its on-device model.
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }

  // App code & pages: network-first so updates always appear immediately when
  // online; the cache is purely an offline fallback. (Same-origin only.)
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.status === 200 && url.origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request).then((c) =>
      c || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
