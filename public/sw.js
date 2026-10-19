// Versioned files are served cache-first: change a file, bump its ?v= tag and CACHE.
const CACHE = "winnie-v4-20261018-meal-stock";
const SHELL = [
  "/photo-discovery.js?v=4.30",
  "/app/photo-discovery-view.js?v=4.30",
  "/room-memory.js?v=4.30",
  "/app/room-closet.js?v=4.30",
  "/photos/winnie-stripes-v2.png",
  "/app/room-memory-view.js?v=4.30",
  "/life-timeline.js?v=4.30",
  "/app/life-timeline-view.js?v=4.30",
  "/life-insights.js?v=4.30",
  "/app/life-insights-view.js?v=4.30",
  "/story-album.js?v=4.30",
  "/app/story-album-view.js?v=4.30",
  "/app/photo-picker.js?v=4.30",
  "/app/recollections.js?v=4.30",
  "/calendar.js?v=4.30",
  "/app/calendar-view.js?v=4.30",
  "/travel.js?v=4.30",
  "/travel-map.js?v=4.30",
  "/vendor/leaflet.mjs",
  "/vendor/leaflet.css",
  "/geo/towns-us.json",
  "/geo/atlas.json",
  "/geo/land.json",
  "/geo/cities.json",
  "/lifetime.js?v=4.30",
  "/app/lifetime-view.js?v=4.30",
  "/photo-metadata.js?v=4.30",
  "/photo-fields.js",
  "/vendor/exifr.mjs",
  "/vendor/tz-lookup.mjs",
  "/draft-store.js?v=4.30",
  "/routine.js?v=4.30",
  "/app/supplies-view.js?v=4.30",
  "/care-plans.js?v=4.30",
  "/care-view.js?v=4.30",
  "/places.js?v=4.30",
  "/places-view.js?v=4.30",
  "/",
  "/index.html",
  "/styles.css?v=4.30",
  "/app.js?v=4.30",
  "/app/clicks.js?v=4.30",
  "/app/entries.js?v=4.30",
  "/app/format.js?v=4.30",
  "/app/forms.js?v=4.30",
  "/app/library.js?v=4.30",
  "/app/logging.js?v=4.30",
  "/app/nav.js?v=4.30",
  "/app/photos.js?v=4.30",
  "/app/services.js?v=4.30",
  "/app/settings.js?v=4.30",
  "/app/state.js?v=4.30",
  "/app/today.js?v=4.30",
  "/app/weather.js?v=4.30",
  "/app/memories-view.js?v=4.30",
  "/memories.js?v=4.30",
  "/pantry.js?v=4.30",
  "/app/pantry-view.js?v=4.30",
  "/photos/brandon-face.png",
  "/photos/kim-face.png",
  "/photos/brandon-pixel.png",
  "/photos/kim-pixel.png",
  "/photos/winnie-room-v3.png",
  "/photos/winnie-harness-v2.png",
  "/app/reaction-picker.js?v=4.30",
  "/app/trainer.js?v=4.30",
  "/app/ui.js?v=4.30",
  "/room.js?v=4.30",
  "/icons.js?v=4.0",
  "/fonts/pixelify-sans-latin.woff2",
  "/fonts/rubik-latin.woff2",
  "/photos/winnie-room-v1.png",
  "/photos/winnie-wall.jpg",
  "/keepsakes.js?v=4.30",
  "/sync.js?v=4.30",
  "/insights.js?v=4.30",
  "/insight-view.js?v=4.30",
  "/selection.js?v=4.30",
  "/care-state.js?v=4.30",
  "/auto-place.js?v=4.30",
  "/fridge.js?v=4.30",
  "/fridge-model.js?v=4.30",
  "/photos/winnie-pixel-v2.png",
  "/everyday.js?v=4.30",
  "/vendor/suncalc.js",
  "/manifest.json?v=4.0",
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
  if (event.request.mode === "navigate") {
    // Open instantly from cache; refresh the shell in the background. A new
    // deploy changes CACHE, and the page reloads itself on APP_UPDATED.
    const network = fetch(event.request).then(async (response) => {
      if (response.ok)
        await (await caches.open(CACHE)).put("/index.html", response.clone());
      return response;
    });
    event.waitUntil(network.catch(() => {}));
    event.respondWith(
      caches
        .match("/index.html")
        .then((cached) => cached || network)
        .catch(() => network),
    );
    return;
  }
  if (/\.(js|css)$/.test(url.pathname) && !url.search) {
    // Unversioned module imports (vendor files): cache first, refresh in the background.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request).then(async (response) => {
          if (response.ok)
            await (await caches.open(CACHE)).put(event.request, response.clone());
          return response;
        });
        event.waitUntil(network.catch(() => {}));
        return cached || network;
      }),
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
          title: "Winnie",
          body: "New entry in the shared log",
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
