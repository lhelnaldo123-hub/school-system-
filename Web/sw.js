/* School App - offline support. Change VERSION when you upload new files. */
const VERSION = "school-app-v3";

self.addEventListener("install", e => { self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSION).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});

// Pages and files: try the internet first, use the saved copy when offline.
// Server (API) calls are never saved.
self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(x => { const c = x.clone(); caches.open(VERSION).then(h => h.put(r, c)); return x; })
      .catch(() => caches.match(r).then(x => x || caches.match("./index.html")))
  );
});
