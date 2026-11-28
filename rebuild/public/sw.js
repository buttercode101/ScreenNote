const CACHE_NAME = "screennote-pwa-shell-v5";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.svg", "/icon-512.svg"];
const OLD_SHELL_PREFIXES = ["screennote-shell-", "screennote-react-shell-", "screennote-pwa-shell-"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) =>
        OLD_SHELL_PREFIXES.some((prefix) => key.startsWith(prefix)) && key !== CACHE_NAME
      ).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && url.pathname === "/") {
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put("/", response.clone())));
        }
        return response;
      }).catch(async () =>
        (await caches.match(request)) ||
        (await caches.match("/")) ||
        (await caches.match("/index.html")) ||
        new Response("ScreenNote is offline. Reconnect and try again.", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } })
      )
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || APP_SHELL.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
      return response;
    })());
  }
});
