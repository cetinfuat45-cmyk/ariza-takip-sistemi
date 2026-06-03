const CACHE_NAME = 'ariza-takip-v1';
const urlsToCache = [
  './',
  './index.html',
  './dashboard.html',
  './admin.html',
  './style.css',
  './app.js',
  './dashboard.js',
  './admin.js',
  './icon.svg',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Cache'ten döndür
        }
        return fetch(event.request); // Ağdan çek
      })
  );
});
