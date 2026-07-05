/* sw.js — offline-first service worker. The whole journal (shell, art
   generators, fonts) is precached; sightings live in IndexedDB; only
   identification needs the network, and it queues gracefully. */

const VERSION = 'fj-v1';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/journal.css',
  'fonts/fonts.css',
  'fonts/caveat-400.woff2',
  'fonts/caveat-600.woff2',
  'fonts/caveat-700.woff2',
  'fonts/alegreya-400.woff2',
  'fonts/alegreya-400-italic.woff2',
  'fonts/alegreya-500.woff2',
  'fonts/alegreya-700.woff2',
  'js/app.js',
  'js/db.js',
  'js/store.js',
  'js/identify.js',
  'js/camera.js',
  'js/geo.js',
  'js/celebrate.js',
  'js/seed.js',
  'js/art/paint.js',
  'js/art/icons.js',
  'js/art/birds.js',
  'js/ui/kit.js',
  'js/ui/journal.js',
  'js/ui/spot.js',
  'js/ui/entry.js',
  'js/ui/life.js',
  'js/ui/map.js',
  'js/ui/almanac.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // API: network only; a friendly JSON error when offline
  if (url.pathname.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503, headers: { 'content-type': 'application/json' },
        }))
    );
    return;
  }

  if (event.request.method !== 'GET') return;

  // navigations: cached shell first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then(hit => hit || fetch(event.request))
    );
    return;
  }

  // static: cache-first with background refresh
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(hit => {
      const refresh = fetch(event.request).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(event.request, copy));
        }
        return res;
      }).catch(() => null);
      return hit || refresh.then(r => r || new Response('offline', { status: 503 }));
    })
  );
});
