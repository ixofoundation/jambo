/* JAMBO service worker: KILL SWITCH.
 *
 * Built into public/sw.js instead of sw/sw.js when the build runs with
 * NEXT_PUBLIC_SW_KILL_SWITCH=1 (scripts/build-sw.js). Phones that installed a broken
 * worker fetch this one on their next visit; it deletes every JAMBO cache,
 * unregisters itself and reloads open pages, so they go back to plain
 * network loading. See docs/pwa.md.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('jambo-')).map((n) => caches.delete(n)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: 'window' });
      windows.forEach((client) => client.navigate(client.url));
    })(),
  );
});
