const CACHE_NAME = "kiosco-v11-offline-pro";

// Archivos críticos locales (siempre se instalan con éxito)
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js?v=2027.11",
  "./manifest.json"
];

// Librerías y modelos de IA externos (se cachean individualmente sin abortar si uno tarda)
const EXTERNAL_ASSETS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest",
  "https://unpkg.com/html5-qrcode",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js",
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/tiny_face_detector_model-weights_manifest.json",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/tiny_face_detector_model-shard1",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_landmark_68_model-weights_manifest.json",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_landmark_68_model-shard1",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_recognition_model-weights_manifest.json",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_recognition_model-shard1",
  "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/face_recognition_model-shard2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Garantizar caché local inmediato
      await cache.addAll(CORE_ASSETS);
      // 2. Cachear externos uno por uno para que un fallo de red no rompa la instalación
      await Promise.allSettled(
        EXTERNAL_ASSETS.map(async (url) => {
          try {
            const req = new Request(url, { mode: "cors" });
            const res = await fetch(req);
            if (res && res.ok) await cache.put(url, res);
          } catch (err) {
            // Intentar modo no-cors como respaldo para scripts CDN
            try {
              const resOpaque = await fetch(url, { mode: "no-cors" });
              if (resOpaque) await cache.put(url, resOpaque);
            } catch (e2) {}
          }
        })
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Nunca interceptar peticiones POST ni llamadas a Google Apps Script
  if (e.request.method !== "GET" || e.request.url.includes("script.google.com")) {
    return;
  }

  // Navegación principal (abrir la PWA desde el ícono sin internet)
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match("./index.html").then((cachedPage) => {
        return fetch(e.request)
          .then((networkRes) => {
            if (networkRes && networkRes.ok) {
              const copy = networkRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy));
            }
            return networkRes;
          })
          .catch(() => cachedPage || caches.match("./"));
      })
    );
    return;
  }

  // Cache-First con actualización dinámica para scripts, estilos y pesos neuronales
  e.respondWith(
    caches.match(e.request, { ignoreSearch: false }).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.ok || networkResponse.type === "opaque")) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});
