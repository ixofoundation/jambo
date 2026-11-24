/**
 * Registers the service worker (public/sw.js, built from sw/sw.js) and tracks
 * whether a new version is waiting. See docs/pwa.md.
 *
 * - Production builds only. `next dev` skips it unless NEXT_PUBLIC_SW_DEV=1,
 *   because a worker caching dev chunks gets in the way of hot reload.
 * - NEXT_PUBLIC_SW_KILL_SWITCH=1: never registers; removes any worker and
 *   JAMBO caches already on the phone. The same flag makes the build ship the
 *   kill-switch worker, so phones that only load cached pages are cleaned too.
 *   Both halves are needed: without this one, the page would re-register the
 *   kill-switch worker on every load and reload forever.
 * - A new version never takes over on its own. It waits until the user taps
 *   "Update" (components/Pwa/UpdateToast), so it can't swap under an open
 *   claim form or the sign-in callback.
 */

const ENABLED = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SW_DEV === '1';
const KILLED = process.env.NEXT_PUBLIC_SW_KILL_SWITCH === '1';

// Installed apps stay open for days. Look for a new deploy when the app comes
// back to the front, at most this often.
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();
let started = false;

function setWaiting(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((fn) => fn());
}

export function subscribeUpdate(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isUpdateWaiting(): boolean {
  return waitingWorker !== null;
}

/** Hand control to the waiting version and reload once it has taken over. */
export function applyUpdate(): void {
  const worker = waitingWorker;
  if (!worker) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  worker.postMessage({ type: 'SKIP_WAITING' });
}

async function removeEverything() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('jambo-')).map((n) => caches.delete(n)));
  }
}

async function register() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });

  // A version that finished installing before this page loaded.
  if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);

  registration.addEventListener('updatefound', () => {
    const incoming = registration.installing;
    if (!incoming) return;
    incoming.addEventListener('statechange', () => {
      // With no controller this is the first install, not an update.
      if (incoming.state === 'installed' && navigator.serviceWorker.controller) setWaiting(incoming);
    });
  });

  let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastCheck = Date.now();
    registration.update().catch(() => undefined);
  });
}

export function startServiceWorker(): void {
  if (started || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  started = true;

  if (KILLED) {
    removeEverything().catch((err) => console.warn('[pwa] could not remove the service worker:', err));
    return;
  }
  if (!ENABLED) return;

  const run = () => register().catch((err) => console.warn('[pwa] service worker registration failed:', err));
  // After load, so registering and the first caching never compete with the page itself.
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run, { once: true });
}
