/* Cimiento: service worker para usar la app sin conexión (prototipo, sin compilación).
 * Red primero y caché como respaldo: con conexión siempre se ven los últimos cambios; sin conexión, la última copia. */
var CACHE = "cimiento-v21-2";
var ARCHIVOS = ["./", "index.html", "test.html", "manifest.webmanifest", "css/tokens.css", "css/app.css",
  "js/config.js", "js/viaje.js", "js/datos-bci.js", "js/store.js", "js/app.js", "js/alta.js", "js/plan.js", "js/protocolo.js", "assets/vendor/qrcode.js",
  "assets/logo_bci_negro.svg", "assets/logo-cimiento.svg", "assets/fonts/overpass-latin-variable.woff2",
  "assets/icons/favicon.svg", "assets/icons/apple-touch-icon.png", "assets/icons/icono-192.png", "assets/icons/icono-512.png", "assets/icons/icono-maskable-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // Firebase: red normal
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () {
    return caches.match(e.request, { ignoreSearch: true }).then(function (r) { return r || caches.match("index.html"); });
  }));
});
