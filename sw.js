// WAR DESK Service Worker v1.0
const CACHE_NAME = 'wardesk-v13';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/config.js',
  '/store.js',
  '/news-v27.js',
  '/app-v12.js',
  '/persist-v4.js',
  '/refresh-v12.js',
  '/iptv-v8.js',
  '/map-v11.js',
  '/vod-v24.js'
];

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache opened');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if(response) return response;
        return fetch(event.request);
      })
  );
});