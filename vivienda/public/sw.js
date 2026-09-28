/*
 * Service worker de Mapa por la Vivienda.
 *
 * Qué se cachea:  el "shell" (página sin conexión, iconos), la agenda y fichas de convocatoria
 *                 visitadas (red primero, caché si falla), el directorio básico y los estáticos.
 * Qué NUNCA:      formularios, moderación, peticiones con ubicación (lat/lon), cualquier POST.
 * Notificaciones: preparado para el futuro (ver "push" abajo), pero no se piden permisos.
 */
const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const DATA = `data-${VERSION}`;
const STATIC = `static-${VERSION}`;
const SHELL_URLS = ["/offline", "/icon.svg", "/manifest.webmanifest", "/agenda"];
const MAX_PAGES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NEVER = [/^\/api\/submissions/, /^\/api\/reports/, /^\/api\/moderation/, /^\/moderacion/, /^\/avisa/, /^\/reportar/, /^\/api\/form-token/];
const CACHEABLE_PAGES = [/^\/$/, /^\/agenda/, /^\/convocatorias\//, /^\/colectivos/, /^\/metodologia/, /^\/privacidad/];
const CACHEABLE_DATA = [/^\/api\/events(\?|$)/, /^\/api\/organizations/, /^\/geo\//];

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs))]);
    if (res.ok) {
      cache.put(req, res.clone());
      trim(cacheName, MAX_PAGES);
    }
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: false })) || (await caches.match(req));
    if (hit) return hit;
    if (req.mode === "navigate") return (await caches.match("/offline")) || Response.error();
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  if (NEVER.some((r) => r.test(p))) return;
  if (url.searchParams.has("lat") || url.searchParams.has("lon")) return; // la ubicación nunca se cachea

  if (p.startsWith("/_next/static/") || p.startsWith("/vendor/")) {
    event.respondWith(caches.open(STATIC).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (r.ok && c.put(req, r.clone()), r))));
    return;
  }
  if (CACHEABLE_DATA.some((r) => r.test(p))) {
    event.respondWith(staleWhileRevalidate(req, DATA));
    return;
  }
  if (req.mode === "navigate" || CACHEABLE_PAGES.some((r) => r.test(p))) {
    if (req.mode === "navigate" && !CACHEABLE_PAGES.some((r) => r.test(p))) {
      event.respondWith(fetch(req).catch(async () => (await caches.match(req)) || (await caches.match("/offline")) || Response.error()));
      return;
    }
    event.respondWith(networkFirst(req, PAGES, 4000));
  }
});

// Futuro: notificaciones de convocatorias cercanas. No se registra ninguna suscripción ni se piden permisos.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : null;
  if (!data) return;
  event.waitUntil(self.registration.showNotification(data.title || "Mapa por la Vivienda", { body: data.body, icon: "/icon.svg", data: { url: data.url } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (url) event.waitUntil(self.clients.openWindow(url));
});
