// Relative URLs keep project-site deployments self-contained.
const CACHE_PREFIX = 'starwake-app-';
const CACHE = `${CACHE_PREFIX}v2.0.0`;
const ASSETS = ['./','./index.html','./style.css','./portal.js','./manifest.webmanifest','./shared/audio.js','./shared/collision.js','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./assets/zenith-cover.png','./assets/horizon-cover.png','./vertical/','./vertical/index.html','./vertical/style.css','./vertical/manifest.webmanifest','./vertical/assets/icon.svg','./vertical/assets/icon-192.png','./vertical/assets/icon-512.png','./vertical/src/main.js','./vertical/src/engine.js','./vertical/src/render.js','./vertical/src/input.js','./vertical/src/storage.js','./horizontal/','./horizontal/index.html','./horizontal/style.css','./horizontal/manifest.webmanifest','./horizontal/assets/icon.svg','./horizontal/assets/icon-192.png','./horizontal/assets/icon-512.png','./horizontal/src/main.js','./horizontal/src/engine.js','./horizontal/src/render.js','./horizontal/src/input.js','./horizontal/src/storage.js'];
self.addEventListener('install', event => {
  // Do not skipWaiting: an update must not mix new code into an active game.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request, {ignoreSearch: true});
    if(cached) return cached;
    try { return await fetch(event.request); }
    catch(error) { if(event.request.mode === 'navigate') { const path=url.pathname.slice(new URL(self.registration.scope).pathname.length); const mode=path.startsWith('vertical/')?'vertical/':path.startsWith('horizontal/')?'horizontal/':''; return await cache.match(`./${mode}index.html`); } throw error; }
  }));
});
