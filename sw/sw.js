/* JAMBO service worker (source).
 *
 * scripts/build-sw.js copies this file to public/sw.js at build time and
 * replaces __SW_VERSION__ with the deploy's commit, so every deploy ships a
 * byte-different sw.js and the browser sees an update. public/sw.js is
 * generated: edit this file, not that one. See docs/pwa.md.
 *
 * What it caches (Phase 1, docs/pwa-plan.md):
 *  - /_next/static/*        cache first. Hashed file names never change, so a
 *                           chunk is downloaded once, across deploys.
 *  - pages (navigations)    network first; the last good copy if the network
 *                           fails or is very slow; /offline.html if there is
 *                           no copy. Pages are static shells (no
 *                           getServerSideProps), so they hold no user data.
 *  - /images, /icons, fonts stale-while-revalidate, capped.
 *
 * Never touched (straight to the network, as if there were no worker):
 *  /api, /auth (one-time sign-in codes), /cleanup (another app with its own
 *  worker), /ingest (analytics), and every other origin except Google Fonts.
 *  Balances, chain, Matrix, YellowCard and KYC calls are all cross-origin or
 *  under /api, so none of them are cached.
 */

const VERSION = '__SW_VERSION__';

const SHELL_CACHE = `jambo-shell-${VERSION}`;
const STATIC_CACHE = 'jambo-static-v1';
const PAGES_CACHE = 'jambo-pages-v1';
const ASSETS_CACHE = 'jambo-assets-v1';
const OWN_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, ASSETS_CACHE];

const OFFLINE_URL = '/offline.html';
const SHELL_FILES = [OFFLINE_URL, '/icons/icon-192.png', '/manifest.webmanifest'];

// Most entries each cache keeps. Oldest go first.
const LIMITS = { [STATIC_CACHE]: 250, [PAGES_CACHE]: 40, [ASSETS_CACHE]: 80 };

// A cached page is shown when the network has not answered a page request in
// this long. 2G in a poor area often takes longer than this to give up.
const PAGE_TIMEOUT_MS = 6000;

const BYPASS_PREFIXES = ['/api/', '/auth', '/cleanup', '/ingest', '/sw.js'];
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  // No skipWaiting here: a new version waits until the user taps "Update"
  // (see the message handler), so it never swaps under an open claim form.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith('jambo-') && !OWN_CACHES.includes(n)).map((n) => caches.delete(n)),
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(VERSION);
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (BYPASS_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p.endsWith('/') ? p : `${p}/`)))
      return;
    if (request.mode === 'navigate') return event.respondWith(page(event));
    if (url.pathname.startsWith('/_next/static/')) return event.respondWith(cacheFirst(request, STATIC_CACHE));
    if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icons/') || url.pathname === '/favicon.ico')
      return event.respondWith(staleWhileRevalidate(event, ASSETS_CACHE));
    return;
  }

  if (FONT_ORIGINS.includes(url.origin)) return event.respondWith(staleWhileRevalidate(event, ASSETS_CACHE));
});

async function page(event) {
  const { request } = event;
  const cache = await caches.open(PAGES_CACHE);
  const key = pageKey(request.url);
  const cached = await cache.match(key);

  const network = (async () => {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (response.ok && response.type === 'basic') {
      await cache.put(key, response.clone());
      trim(PAGES_CACHE);
    }
    return response;
  })();
  // Keep the cache update alive even when the cached copy answers first.
  event.waitUntil(network.catch(() => undefined));

  try {
    if (!cached) return await network;
    return await Promise.race([network, timeout(PAGE_TIMEOUT_MS).then(() => cached)]);
  } catch {
    return cached || (await caches.match(OFFLINE_URL));
  }
}

// Query strings (?yref=…, utm_*) are read by the page's script, not the
// server, so one copy per path is enough and keeps them out of the cache.
function pageKey(href) {
  const url = new URL(href);
  return url.origin + url.pathname;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cacheName);
  }
  return response;
}

async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache = await caches.open(cacheName);
  // Also look in the other caches: the offline page's icon is saved in the shell cache.
  const cached = (await cache.match(request)) || (await caches.match(request));
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === 'opaque') {
        await cache.put(request, response.clone());
        trim(cacheName);
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  return (await network) || Response.error();
}

async function trim(cacheName) {
  const limit = LIMITS[cacheName];
  if (!limit) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(key);
}

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
