/**
 * Service Worker Oficial para Terminal de Carnicería (PWA Offline-First)
 * 
 * Estrategia de Arquitectura:
 * - Shell de la Aplicación (HTML, CSS, JS, Fuentes): Cache-First con actualización en segundo plano.
 * - Navegación SPA: Si no hay red, sirve index.html desde caché para arranque instantáneo (0ms).
 * - APIs y Supabase: No se cachean en HTTP cache; la sincronización offline reside en IndexedDB Outbox.
 */

const CACHE_NAME = "carniceria-pos-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// 1. Instalación: Cachear recursos base del shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Precaché parcial:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activación: Purgar cachés antiguas y tomar control inmediato
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log("[SW] Eliminando caché obsoleta:", k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Intercepción inteligente de peticiones
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // A. Ignorar llamadas a Supabase y APIs externas (se gestionan en IndexedDB)
  if (url.hostname.includes("supabase.co") || req.method !== "GET") {
    return;
  }

  // B. Peticiones de navegación (cargar la app SPA aunque no haya internet)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match("/index.html").then((cached) => {
          if (cached) return cached;
          return caches.match("/");
        });
      })
    );
    return;
  }

  // C. Recursos estáticos (scripts, estilos, fuentes, imágenes locales)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano refrescar recurso si hay internet (Stale-While-Revalidate)
        fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, networkResponse));
            }
          })
          .catch(() => {
            // Silencioso en offline
          });
        return cachedResponse;
      }

      // Si no está en caché, buscar en la red y guardar en caché
      return fetch(req)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Si falló y es imagen o fuente, no romper
          return new Response("", { status: 408, statusText: "Offline" });
        });
    })
  );
});
