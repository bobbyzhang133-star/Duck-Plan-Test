const CACHE_VERSION = "duckplan-app-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.webmanifest",
  "./styles.css",
  "./assets/duckplan-app-icon.svg",
  "./assets/duckplan-app-icon-192.png",
  "./assets/duckplan-app-icon-512.png",
  "./assets/duckplan-mascot-v8.png",
  "./planner-model.js",
  "./planner-ui.js",
  "./ical-parser.js",
  "./cloud-config.js",
  "./planner-store.js",
  "./reminder-domain.js",
  "./reminder-ledger.js",
  "./browser-notifications.js",
  "./motion-tokens.js",
  "./button-interactions.js",
  "./page-navigation-feedback.js",
  "./popup-motion.js",
  "./app-install.js",
  "./app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("duckplan-app-") && key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || cache.match(fallbackUrl, { ignoreSearch: true });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) {
    fetch(request).then((response) => { if (response.ok) cache.put(request, response); }).catch(() => {});
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, "./index.html"));
    return;
  }
  if (url.pathname === "/cloud-config.js" || url.pathname === "/app.webmanifest") {
    event.respondWith(networkFirst(event.request, event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const target = windows.find((client) => client.url.startsWith(self.registration.scope)) || windows[0];
    const message = { type: "duckplan-notification-open", taskId: data.taskId || null, view: data.view || "home" };
    if (target) {
      await target.focus();
      target.postMessage(message);
      return;
    }
    await self.clients.openWindow(new URL(`./#${message.view}`, self.registration.scope).href);
  })());
});
