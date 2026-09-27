/* Speichert ausschließlich lokale App-Dateien, keine Rechnungen oder Fremdseiten. */
const CACHE_PREFIX = 'invoice-kit-';
const CACHE = `${CACHE_PREFIX}v10`;
const CORE = ['./', 'index.html', 'anzeigen.html', 'generator.js', 'viewer.js', 'core.js',
  'viewer-check.js', 'storage.js', 'pro-app.js', 'pro-data.js', 'pro-license.js', 'pro-config.js', 'admin.html', 'admin.js', 'admin.css', 'zugferd.js', 'accessibility.css', 'manifest.webmanifest',
  'icon.svg', 'vendor/qrcode.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js', 'vendor/fonts.js'];
const allowed = new Set(CORE.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())
));
self.addEventListener('activate', event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
    .map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.search || !allowed.has(url.href)) return;
  // Zusammengehörige Versionen bleiben konsistent. Neue Versionen kommen mit neuem Cache-Namen.
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});
