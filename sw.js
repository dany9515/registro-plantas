// OilLog Service Worker — network-first para JS locales
const CACHE = 'oillog-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Solo interceptar JS propios (mismo origen, no Firebase CDN)
  if (e.request.destination === 'script' && url.origin === self.location.origin) {
    e.respondWith(
      fetch(new Request(e.request.url, { cache: 'no-cache' }))
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request.url, clone));
          return res;
        })
        .catch(() => caches.match(e.request.url))
    );
  }
});
