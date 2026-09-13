// Relative URLs keep project-site deployments self-contained.
const CACHE_PREFIX = 'starwake-app-';
const CACHE = `${CACHE_PREFIX}v1.0.0`;
const ASSETS = ['./','./index.html','./style.css','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png','./src/main.js','./src/engine.js','./src/render.js','./src/audio.js','./src/input.js','./src/storage.js'];
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
    catch(error) { if(event.request.mode === 'navigate') return await cache.match('./index.html'); throw error; }
  }));
});
