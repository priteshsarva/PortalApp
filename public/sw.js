// Minimal service worker for installability + resilient loads. Network-first for
// navigations (so a deploy is never stale) with an offline app-shell fallback;
// cache-first for same-origin static assets (Vite hashes them, so safe). API and
// cross-origin requests always go to the network untouched.
const CACHE = "sp-portal-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch the API / other origins

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((r) => { caches.open(CACHE).then((c) => c.put("/", r.clone())); return r; })
        .catch(() => caches.match("/"))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((c) => c || fetch(req).then((r) => {
      if (r.ok) caches.open(CACHE).then((cc) => cc.put(req, r.clone()));
      return r;
    }))
  );
});
