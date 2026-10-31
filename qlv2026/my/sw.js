// The QLV home screen app: opens fast from a small cache, and shows the
// notifications the server sends. Pages and scripts come from the network
// first, so a change on the site reaches people straight away; the cache is
// only for when the connection drops. Calls to the QLV server are never cached.

const CACHE = "qlv-my-v1";
const SHELL = ["./", "my.css", "my.js", "../config.js", "../assets/jci-aso-white.png", "../assets/qlv-white.png", "../assets/app-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : "" }; }
  const shown = self.registration.showNotification(d.title || "QLV 2026", {
    body: d.body || "", tag: d.tag || undefined, renotify: !!d.tag,
    icon: "../assets/app-192.png", badge: "../assets/app-badge.png", data: { url: d.url || "./" },
  });
  // The number on the home screen icon, where the phone supports one.
  const badge = typeof d.badge === "number" && self.navigator.setAppBadge ? self.navigator.setAppBadge(d.badge).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([shown, badge]));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = e.notification.data?.url || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c && c.url.split("#")[0] === target.split("#")[0]) return c.navigate(target).then((w) => (w || c).focus());
    return self.clients.openWindow(target);
  }));
});
