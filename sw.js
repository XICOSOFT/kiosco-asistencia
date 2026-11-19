const CACHE_NAME = "kiosco-v12-analytics";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js?v=2027.12",
  "./manifest.json"
];

const EXTERNAL_ASSETS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/lucide@latest",
  "https://unpkg.com/html5-qrcode",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js",
  "https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js",
  "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
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
      await cache.addAll(CORE_ASSETS);
      await Promise.allSettled(
        EXTERNAL_ASSETS.map(async (url) => {
          try {
            const req = new Request(url, { mode: "cors" });
            const res = await fetch(req);
            if (res && res.ok) await cache.put(url, res);
          } catch (err) {
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
  if (e.request.method !== "GET" || e.request.url.includes("script.google.com")) {
    return;
  }

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
