// App-shell service worker for the Rundown PWA. Assets are precached on
// install so the app launches offline, and served network-first so a normal
// reload always picks up a fresh deploy (the precached copy is refreshed in
// the background on every successful fetch). Bump VERSION when the offline
// shell itself changes; routine code updates no longer need a version bump.
const VERSION = 'rundown-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './logo.png',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
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
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Never touch the API/sync surface (local server or relay) — network only.
  if (url.pathname.indexOf('/api/') !== -1) return;

  // Network-first: prefer the live copy, fall back to the precache offline.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
