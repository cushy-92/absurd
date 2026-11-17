const CACHE = 'absurd-shell-v4';
const root = self.registration.scope;
const shell = new URL('./', root).href;
const assets = new Set([
  new URL('auth-client.js?v=offline-4', root).href,
  new URL('absurd-icon.svg', root).href,
  new URL('manifest.webmanifest', root).href,
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([shell, ...assets].map(async url => {
      const response = await fetch(url === shell ? shell + '?shell=offline-4' : url, {
        mode: 'same-origin',
        cache: 'reload',
      });
      if (!response.ok && response.type !== 'opaque') throw new Error('App asset unavailable');
      if (url === shell && !(await response.clone().text()).includes('auth-client.js?v=offline-4')) {
        throw new Error('Offline shell version not published yet');
      }
      await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key === 'absurd-shell-v1' || key === 'absurd-shell-v2' || key === 'absurd-shell-v3').map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function offlinePage(cache) {
  const cached = await cache.match(shell);
  if (!cached) return null;
  const html = (await cached.text())
    .replace('<html lang="ru">', '<html lang="ru" data-offline-shell>')
    .replace(/<script src="https:\/\/www\.gstatic\.com\/firebasejs\/[^"]+"><\/script>/g, '');
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('push', event => {
  let count;
  try { count = event.data?.json()?.count; } catch { return; }
  if (!Number.isSafeInteger(count) || count < 1) return;
  event.waitUntil(self.registration.showNotification('Дедлайны Absurd', {
    body: count === 1 ? 'Один дедлайн в ближайшие 24 часа.' : 'Дедлайнов в ближайшие 24 часа: ' + count + '.',
    tag: 'absurd-deadlines',
    icon: new URL('absurd-icon.svg', root).href,
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('./#deadlines', root).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = windows.find(client => client.url.startsWith(root));
    if (app) {
      const opened = await app.navigate(target).catch(() => null);
      if (opened) return opened.focus();
    }
    return self.clients.openWindow(target);
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
      const response = await fetch(request, navigation ? { cache: 'no-store' } : undefined);
      if (response.ok || response.type === 'opaque') {
        if (navigation && !(await response.clone().text()).includes('auth-client.js?v=offline-4')) {
          return response;
        }
        try { await cache.put(key, response.clone()); } catch {}
      } else if (navigation && response.status >= 500) {
        return (await offlinePage(cache)) || response;
      }
      return response;
    } catch {
      return (navigation ? await offlinePage(cache) : await cache.match(key)) || Response.error();
    }
  })());
});
