// =============================================================================
// Service Worker – Trasporti LIVE Busto Garolfo
// =============================================================================
// Strategy:
//   - Same-origin assets: NETWORK-FIRST with cache fallback (so online users
//     always get the latest deploy; offline users still get the last cached copy)
//   - CDN assets (Leaflet, Firebase): Stale-while-revalidate (fast load, background refresh)
//   - Precache on install so the first offline visit works
//
// IMPORTANT: Bump CACHE_NAME on every deploy so the activate handler purges stale caches.
// =============================================================================

const CACHE_NAME = "z-transit-v5-0-2";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/main.js",
  "./js/live.js",
  "./js/timetable.js",
  "./js/trains-tab.js",
  "./js/line-registry.js",
  "./js/settings.js",
  "./js/utils.js",
  "./js/trains.js",
  "./js/line-config.js",
  "./js/dom-utils.js",
  "./js/theme.js",
  "./js/notifications.js",
  "./js/firebase-sync.js",
  "./js/crypto-utils.js",
  "./js/migration.js",
  "./js/firebase-config.js",
  "./js/map.js",
  "./js/map-data.js",
  "./js/onboarding.js",
  "./js/alerts.js",
  "./privacy.html",
  "./feedback.html",
  "./data/config.js",
  "./data/trains.js",
  // Default city (BT) lines precached for instant first load
  "./data/z649.js",
  "./data/z627.js",
  "./data/z644.js",
  "./data/z625.js",
  "./data/z647.js",
  "./data/z642.js",
  // Other lines loaded on-demand and cached via stale-while-revalidate
  "./icon-192.png",
  "./icon-badge.png"
];

const SWR_HOSTS = ["unpkg.com", "www.gstatic.com"];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately, don't wait for old tabs to close
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim()) // Take control of all open tabs immediately
  );
});

// ─── Fetch Strategies ───────────────────────────────────────────────────────

/**
 * Network-first: try the network, cache the response, fall back to cache if offline.
 * This ensures online users always see the latest deploy.
 */
function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
      }
      return response;
    })
    .catch(() => {
      return caches.match(request).then(cached => {
        if (cached) return cached;
        // Only return the offline stub for navigation requests (HTML pages)
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return new Response("Offline - dati non disponibili.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      });
    });
}

/**
 * Stale-while-revalidate: serve from cache instantly, refresh in background.
 * Used for CDN assets (Leaflet, Firebase) that change rarely.
 */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(cache => {
    return cache.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    });
  });
}

/**
 * Cache-first: serve from cache if available, otherwise fetch from network.
 */
function cacheFirst(request) {
  return caches.match(request)
    .then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
    .catch(() => {
      if (request.mode === "navigate") {
        return caches.match("./index.html");
      }
      return new Response("Offline - dati non disponibili.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    });
}

// ─── Fetch Handler ──────────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // CDN assets → stale-while-revalidate (fast, background refresh)
  if (SWR_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // Same-origin assets or precached → cache-first
  event.respondWith(cacheFirst(event.request));
});

// ─── Notification Click ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      if (clients.length > 0) {
        return clients[0].focus();
      }
      return self.clients.openWindow("./");
    })
  );
});
