const CACHE = "winnie-v3-20260911-r15";
const SHELL = [
  "/care-plans.js?v=3.9",
  "/care-view.js?v=3.9",
  "/places.js?v=3.9",
  "/places-view.js?v=3.9",
  "/geo/cities.json",
  "/geo/land.json",
  "/",
  "/index.html",
  "/styles.css?v=3.9",
  "/app.js?v=3.9",
  "/sync.js?v=3.9",
  "/insights.js?v=3.9",
  "/insight-view.js?v=3.9",
  "/companion.js?v=3.9",
  "/selection.js?v=3.9",
  "/care-state.js?v=3.9",
  "/auto-place.js?v=3.9",
  "/fridge.js?v=3.9",
  "/fridge-model.js?v=3.9",
  "/photos/winnie-pixel-v2.png",
  "/everyday.js?v=3.9",
  "/vendor/suncalc.js",
  "/manifest.json?v=3.9",
  "/icons/winnie-v2-32.png",
  "/icons/winnie-v2-180.png",
  "/icons/winnie-v2-192.png",
  "/icons/winnie-v2-512.png",
  "/icon-192.png",
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("winnie-") && key !== CACHE)
          await caches.delete(key);
      await self.clients.claim();
      for (const client of await self.clients.matchAll({ type: "window" }))
        client.postMessage({ type: "APP_UPDATED" });
    })(),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/.netlify/functions/") ||
    event.request.method !== "GET"
  )
    return;
  if (event.request.mode === "navigate" || /\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE);
            await cache.put(
              event.request.mode === "navigate" ? "/index.html" : event.request,
              response.clone(),
            );
          }
          return response;
        })
        .catch(() =>
          caches.match(
            event.request.mode === "navigate" ? "/index.html" : event.request,
          ),
        ),
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE).then((c) => c.put(event.request, copy)),
            );
          }
          return response;
        }),
    ),
  );
});
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data;
      try {
        data = event.data.json();
      } catch {
        data = {
          title: "Winnie’s shared day",
          body: "There’s an update in your shared log.",
          url: "/",
        };
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icons/winnie-v2-192.png",
        badge: "/icon-192.png",
        tag: data.tag,
        data: { url: data.url, eventId: data.eventId },
        renotify: false,
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data || {};
      for (const client of await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      })) {
        await client.focus();
        client.postMessage({ type: "OPEN_EVENT", id: data.eventId });
        return;
      }
      const url = new URL(data.url || "/", self.location.origin);
      await self.clients.openWindow(
        url.origin === self.location.origin ? url.href : "/",
      );
    })(),
  );
});
