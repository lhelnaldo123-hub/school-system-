/* School App - offline support. Change VERSION when you upload new files. */
const VERSION = "school-app-v10";

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

// Phone alerts (sent by the server even when the app is closed)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data.json(); } catch (x) { }
  e.waitUntil(self.registration.showNotification(d.title || "School App", { body: d.body || "", icon: "icon.svg", badge: "icon.svg", data: { page: d.page || "home" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const page = (e.notification.data || {}).page || "home";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    if (cs.length) { cs[0].postMessage({ page }); return cs[0].focus(); }
    return self.clients.openWindow("./index.html?go=" + page);
  }));
});


