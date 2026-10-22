/* Future Forge — sw.js
 * Offline cache for the hosted (https) version: after one visit, the whole
 * experience — app, content, vision engine — loads with no network.
 * Bump CACHE when files change so visitors get the new version.
 * Not used when opened from a local file (file://); it isn't needed there.
 */
const CACHE = "future-forge-v1.2.1";
const FILES = [
  "./", "./index.html", "./styles.css", "./app.js", "./config.js", "./manifest.webmanifest",
  "./content/domains.js", "./content/lessons.js", "./content/challenge-cards.js", "./content/series.js",
  "./js/classifier.js", "./js/vision.js", "./js/counter.js", "./js/challenge.js", "./js/map.js",
  "./js/lab-vision.js", "./js/lab-data.js", "./js/lab-series.js",
  "./vendor/tf.min.js", "./models/mobilenet-v2-035/model.js",
  "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png",
  "./assets/fonts/fonts.css"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return; // never touch the optional challenge endpoint
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match("./index.html")))
  );
});
