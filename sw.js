/* Invoice Kit – Offline-Unterstützung. Speichert nur die App-Dateien, niemals Rechnungsdaten. */
const CACHE="invoice-kit-v4";
const CORE=["./","index.html","anzeigen.html","zugferd.js","manifest.webmanifest","icon.svg","vendor/qrcode.js"];
const LAZY=["vendor/pdf-lib.min.js","vendor/fontkit.umd.min.js","vendor/fonts.js"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()).then(()=>caches.open(CACHE).then(c=>c.addAll(LAZY)).catch(()=>{}))));
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=="GET"||u.origin!==location.origin)return;
  /* Netzwerk zuerst (immer aktuell), Cache als Offline-Rückfall */
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})));
});
