/**
 * WAR DESK Service Worker v17.4
 * ==============================
 * Complete offline support, intelligent caching, translation exclusion
 * 
 * Cache Strategy:
 * - Static assets (HTML/CSS/JS): Cache-first
 * - Runtime data (feeds): Network-first, fallback offline
 * - Translation APIs: Network only (no SW cache, use IndexedDB in main)
 * - External resources: Network-first with offline fallback
 */

const CACHE_VERSION = 17;
const CACHE_STATIC = `wardesk-static-v${CACHE_VERSION}`;
const CACHE_RUNTIME = `wardesk-runtime-v${CACHE_VERSION}`;
const CACHE_IMAGES = `wardesk-images-v${CACHE_VERSION}`;

const MAX_RUNTIME_ENTRIES = 150;
const MAX_STATIC_ENTRIES = 40;
const MAX_IMAGE_ENTRIES = 80;
const CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

/**
 * FIX v17.4: Exclude translation APIs from SW cache
 * These are cached in IndexedDB by the main script instead
 */
const SKIP_CACHE_HOSTS = [
  "translate.googleapis.com",
  "api.mymemory.translated.net",
  "libretranslate.de",
  "api-free.deepl.com"
];

/**
 * APIs that should use network-first strategy
 * Includes proxy, feed services, maps
 */
const NETWORK_FIRST_HOSTS = [
  "nieuwsproxy.hassanbadri814.workers.dev",
  "rss-hub-red-nine.vercel.app",
  "rsshub.app",
  "server.arcgisonline.com",
  "tile.openstreetmap.org"
];

/* ================================================================
   INSTALLATION
   ================================================================ */

self.addEventListener("install", e => {
  console.log(`[SW v${CACHE_VERSION}] Installing...`);
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => {
        console.log("[SW] Caching static assets...");
        return c.addAll(ASSETS_TO_CACHE).catch(err => {
          console.warn("[SW] Some assets failed to cache:", err);
        });
      })
  );
});

/* ================================================================
   ACTIVATION - Clean old caches
   ================================================================ */

self.addEventListener("activate", e => {
  console.log("[SW] Activating and cleaning old caches...");
  e.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(k => !k.startsWith(`wardesk-`) || !k.includes(`v${CACHE_VERSION}`))
            .map(k => {
              console.log(`[SW] Deleting old cache: ${k}`);
              return caches.delete(k);
            })
        );
      })
      .then(() => {
        console.log("[SW] Cache cleanup complete");
        return self.clients.claim();
      })
  );
});

/* ================================================================
   CACHE MANAGEMENT
   ================================================================ */

/**
 * Trim cache to max entries (recursive)
 * FIX v17.4: Proper error handling
 */
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if(keys.length > maxItems) {
      console.log(`[SW] Trimming ${cacheName}: ${keys.length} → ${maxItems} entries`);
      await cache.delete(keys[0]);
      
      // Recursive trim
      return trimCache(cacheName, maxItems);
    }
  } catch(e) {
    console.warn(`[SW] Cache trim error (${cacheName}):`, e);
  }
}

/**
 * Check if cached response is stale
 * FIX v17.4: Cache expiration
 */
function isCacheStale(response) {
  if(!response) return true;
  
  const dateHeader = response.headers.get('date');
  if(!dateHeader) return false; // Assume fresh if no date
  
  const cacheTime = new Date(dateHeader).getTime();
  const now = Date.now();
  
  return (now - cacheTime) > CACHE_MAX_AGE;
}

/* ================================================================
   FETCH HANDLER - Main routing logic
   ================================================================ */

self.addEventListener("fetch", e => {
  const req = e.request;
  
  // Only handle GET requests
  if(req.method !== "GET") return;
  
  const url = new URL(req.url);
  
  // Skip non-http protocols
  if(!url.protocol.startsWith("http")) return;

  /* ═══════════════════════════════════════════════════════
     1. TRANSLATION APIs - Network only (no SW cache)
     ═══════════════════════════════════════════════════════ */
  
  if(SKIP_CACHE_HOSTS.some(h => url.hostname === h)) {
    console.log(`[SW] Translation API (network only): ${url.hostname}`);
    // Don't intercept - let browser handle (uses IndexedDB cache in main)
    return;
  }

  /* ═══════════════════════════════════════════════════════
     2. EXTERNAL RESOURCES - Network-first with fallback
     ═══════════════════════════════════════════════════════ */
  
  if(url.origin !== self.location.origin) {
    e.respondWith(
      networkFirstStrategy(req, CACHE_RUNTIME)
    );
    return;
  }

  /* ═══════════════════════════════════════════════════════
     3. LOCAL ASSETS - Cache-first strategy
     ═══════════════════════════════════════════════════════ */
  
  if(isImageRequest(req)) {
    e.respondWith(
      cacheFirstStrategy(req, CACHE_IMAGES, MAX_IMAGE_ENTRIES)
    );
    return;
  }

  if(isStaticAsset(req)) {
    e.respondWith(
      cacheFirstStrategy(req, CACHE_STATIC, MAX_STATIC_ENTRIES)
    );
    return;
  }

  /* ═══════════════════════════════════════════════════════
     4. DEFAULT - Network-first, fallback index.html
     ═══════════════════════════════════════════════════════ */
  
  e.respondWith(
    networkFirstStrategy(req, CACHE_RUNTIME)
      .catch(() => {
        if(req.mode === "navigate") {
          return caches.match("./index.html");
        }
        return offlineResponse();
      })
  );
});

/* ================================================================
   STRATEGIES
   ================================================================ */

/**
 * Network-first: try network, fallback to cache
 * FIX v17.4: Timeout, proper error handling
 */
async function networkFirstStrategy(req, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timeout);
    
    if(res && res.status === 200) {
      // Cache successful response
      cache.put(req, res.clone())
        .then(() => trimCache(cacheName, MAX_RUNTIME_ENTRIES))
        .catch(() => {});
      return res;
    }
    
    return res;
  } catch(e) {
    console.log(`[SW] Network failed, using cache: ${req.url}`);
    
    // Fallback to cache
    const cached = await cache.match(req);
    if(cached) return cached;
    
    throw e;
  }
}

/**
 * Cache-first: try cache, fallback to network
 * FIX v17.4: Stale-while-revalidate pattern
 */
async function cacheFirstStrategy(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  
  // Try cache first
  const cached = await cache.match(req);
  if(cached && !isCacheStale(cached)) {
    return cached;
  }
  
  try {
    // Fetch fresh version
    const res = await fetch(req);
    
    if(res && res.status === 200) {
      cache.put(req, res.clone())
        .then(() => trimCache(cacheName, maxEntries))
        .catch(() => {});
      return res;
    }
    
    // If fetch fails but we have stale cache, return it
    if(cached) return cached;
    
    return res;
  } catch(e) {
    console.log(`[SW] Fetch failed, returning cache: ${req.url}`);
    
    // Return cached (even if stale) or offline response
    if(cached) return cached;
    return offlineResponse();
  }
}

/* ================================================================
   HELPERS
   ================================================================ */

function isImageRequest(req) {
  return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(new URL(req.url).pathname);
}

function isStaticAsset(req) {
  const path = new URL(req.url).pathname;
  return /\.(html|css|js|woff2|woff|ttf|eot)$/i.test(path);
}

function offlineResponse() {
  return new Response(
    JSON.stringify({
      error: "Offline",
      message: "Je bent offline. Probeer later opnieuw.",
      items: []
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json" }
    }
  );
}

/* ================================================================
   MESSAGE HANDLING - Commands from main thread
   ================================================================ */

self.addEventListener("message", e => {
  const data = e.data || {};
  
  switch(data.type) {
    case "SKIP_WAITING":
      console.log("[SW] Skipping waiting period");
      self.skipWaiting();
      break;
      
    case "CLEAR_CACHE":
      handleClearCache(e);
      break;
      
    case "CLEAR_SPECIFIC_CACHE":
      handleClearSpecificCache(e, data.cacheName);
      break;
      
    case "CACHE_ASSETS":
      handleCacheAssets(e, data.urls);
      break;
      
    default:
      console.log("[SW] Unknown message type:", data.type);
  }
});

async function handleClearCache(e) {
  console.log("[SW] Clearing all caches...");
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    
    if(e.ports && e.ports[0]) {
      e.ports[0].postMessage({ ok: true, message: "All caches cleared" });
    }
    console.log("[SW] Cache clear complete");
  } catch(err) {
    console.error("[SW] Cache clear error:", err);
    if(e.ports && e.ports[0]) {
      e.ports[0].postMessage({ ok: false, error: err.message });
    }
  }
}

async function handleClearSpecificCache(e, cacheName) {
  console.log(`[SW] Clearing cache: ${cacheName}`);
  try {
    const deleted = await caches.delete(cacheName);
    if(e.ports && e.ports[0]) {
      e.ports[0].postMessage({ ok: deleted, cacheName });
    }
  } catch(err) {
    console.error("[SW] Specific cache clear error:", err);
    if(e.ports && e.ports[0]) {
      e.ports[0].postMessage({ ok: false, error: err.message });
    }
  }
}

async function handleCacheAssets(e, urls) {
  if(!Array.isArray(urls)) return;
  
  console.log(`[SW] Caching ${urls.length} assets...`);
  try {
    const cache = await caches.open(CACHE_RUNTIME);
    await Promise.all(
      urls.map(url => {
        return fetch(url)
          .then(res => res.ok && cache.put(url, res))
          .catch(() => {});
      })
    );
    
    if(e.ports && e.ports[0]) {
      e.ports[0].postMessage({ ok: true, cached: urls.length });
    }
  } catch(err) {
    console.error("[SW] Asset cache error:", err);
  }
}

/* ================================================================
   PERIODIC BACKGROUND SYNC (voor toekomstig gebruik)
   ================================================================ */

self.addEventListener("sync", e => {
  if(e.tag === "sync-feeds") {
    console.log("[SW] Background sync: feeds");
    e.waitUntil(
      clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: "SYNC_FEEDS"
          });
        });
      })
    );
  }
});

/* ================================================================
   PERIODIC MAINTENANCE
   ================================================================ */

self.addEventListener("message", e => {
  if(e.data?.type === "CLEANUP") {
    console.log("[SW] Running maintenance cleanup...");
    trimCache(CACHE_RUNTIME, MAX_RUNTIME_ENTRIES);
    trimCache(CACHE_STATIC, MAX_STATIC_ENTRIES);
    trimCache(CACHE_IMAGES, MAX_IMAGE_ENTRIES);
  }
});

console.log(`[SW] Service Worker v${CACHE_VERSION} loaded`);