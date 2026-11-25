const cacheName = 'voice-studio-26.11.001-3';
const assets = ['/', '/styles.css', '/app.js', '/voices.js', '/voice-profile.js', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('voice-studio-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !assets.includes(url.pathname)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(url.pathname)) ?? Response.error();
  }));
});
