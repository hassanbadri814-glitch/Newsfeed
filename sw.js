/* ============================================================
   WAR DESK Service Worker v2.0
   - Network-first voor HTML/JS/CSS/JSON (updates komen door)
   - Cache-first voor images/fonts/icons (snelheid)
   - Fallback naar cache als netwerk faalt
   ============================================================ */

const CACHE_NAME = 'wardesk-v15';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './store.js',
  './news-v27.js',
  './app-v12.js',
  './persist-v4.js',
  './refresh-v12.js',
  './iptv-v8.js',
  './map-v11.10.js',
  './vod-v24.js',
  './manifest.json',
  './icon.svg'
];

// INSTALL — precache alle assets (fail-safe per bestand)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precache openen:', CACHE_NAME);
        return Promise.all(
          PRECACHE_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn('[SW] Precache faalde voor', url, err.message);
            })
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVATE — verwijder oude caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(n => n !== CACHE_NAME)
          .map(n => {
            console.log('[SW] Oude cache verwijderen:', n);
            return caches.delete(n);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH — network-first voor code, cache-first voor assets
self.addEventListener('fetch', event => {
  const req = event.request;

  // Alleen GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin: alleen bekende CDN's cachen
  if (url.origin !== location.origin) {
    const isAsset = /fonts\.(googleapis|gstatic)\.com|unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com/.test(url.host);
    if (!isAsset) return;
  }

  // Bepaal strategie
  const isCode = /\.(html|js|css|json)$/i.test(url.pathname)
              || url.pathname === '/'
              || url.pathname.endsWith('/');

  if (isCode) {
    // NETWORK-FIRST (updates komen direct door)
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          // Offline: gebruik cache, of index.html als fallback
          return caches.match(req).then(r => r || caches.match('./index.html'));
        })
    );
    return;
  }

  // CACHE-FIRST voor afbeeldingen/fonts/icons
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        // Update op de achtergrond (stale-while-revalidate)
        fetch(req).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});