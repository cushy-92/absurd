const CACHE = 'absurd-shell-v2';
const root = self.registration.scope;
const shell = new URL('./', root).href;
const assets = new Set([
  new URL('auth-client.js?v=offline-2', root).href,
  new URL('absurd-icon.svg', root).href,
  ...['app', 'auth', 'firestore'].map(name =>
    'https://www.gstatic.com/firebasejs/13.3.0/firebase-' + name + '-compat.js'
  ),
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([shell, ...assets].map(async url => {
      const response = await fetch(url === shell ? shell + '?shell=offline-2' : url, {
        mode: url.startsWith(root) ? 'same-origin' : 'no-cors',
        cache: 'reload',
      });
      if (!response.ok && response.type !== 'opaque') throw new Error('App asset unavailable');
      if (url === shell && !(await response.clone().text()).includes('auth-client.js?v=offline-2')) {
        throw new Error('Offline shell version not published yet');
      }
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key === 'absurd-shell-v1').map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const navigation = request.mode === 'navigate' &&
    (url.origin + url.pathname === shell || url.origin + url.pathname === new URL('index.html', root).href);
  if (!navigation && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = navigation ? shell : url.href;
    if (!navigation) {
      const cached = await cache.match(key);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        if (navigation && !(await response.clone().text()).includes('auth-client.js?v=offline-2')) {
          return response;
        }
        try { await cache.put(key, response.clone()); } catch {}
      } else if (navigation && response.status >= 500) {
        return (await cache.match(key)) || response;
      }
      return response;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  })());
});
