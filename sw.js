const CACHE_NAME = "trasporti-busto-v4-2-0";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/main.js",
  "./js/live.js",
  "./js/timetable.js",
  "./js/settings.js",
  "./js/utils.js",
  "./js/trains.js",
  "./js/line-config.js",
  "./js/dom-utils.js",
  "./js/theme.js",
  "./js/notifications.js",
  "./js/firebase-sync.js",
  "./data/config.js",
  "./data/z649.js",
  "./data/z627.js",
  "./data/z644.js",
  "./data/z625.js",
  "./data/z647.js",
  "./data/z642.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => new Response("Offline - dati non disponibili.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      }));
    })
  );
});

// Handle notification click – focus or open the app
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
