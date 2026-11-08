/* Distribuciones Ontiveros — service worker
   - Guarda la app del equipo para que abra rápido y sin señal.
   - Nunca guarda las llamadas al CRM: esas siempre van a la red. */
const VERSION = "dist-ontiveros-v41";
const BASICOS = [
  "panel.html",
  "manifest.webmanifest",
  "css/styles.css",
  "css/panel.css",
  "js/tema.js",
  "js/producto.js",
  "js/datos-distribuidora.js",
  "js/crm-core.js",
  "js/crm-api.js",
  "js/panel.js",
  "assets/img/logo/logo-96.png",
  "assets/img/logo/logo-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const guardada = await cache.match(e.request, { ignoreSearch: true });
      const red = fetch(e.request)
        .then((r) => { if (r && r.ok) cache.put(e.request, r.clone()); return r; })
        .catch(() => guardada);
      return guardada || red;
    })
  );
});
