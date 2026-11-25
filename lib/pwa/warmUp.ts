/**
 * After sign-in, while the phone is idle, download the code for the main
 * screens so they open offline later. The service worker keeps those files
 * (cache first, and they survive deploys while unchanged). See docs/pwa.md.
 *
 * Skipped when the user asked to save data (Save-Data / "Lite mode") or the
 * connection is 2G; Next.js's own prefetch skips those too.
 *
 * Not covered: code a screen loads later on its own (the claim form's survey
 * styles, maps, the PDF viewer). Those are saved the first time the screen is
 * opened online.
 */
import type { NextRouter } from 'next/router';

// Dynamic segments only pick the page; the values don't matter.
const ROUTES = [
  '/',
  '/tasks',
  '/wallet',
  '/profile',
  '/entities/_',
  '/entities/_/claimCollections/_',
  '/entities/_/claimCollections/_/claim',
];

const WARM_DELAY_MS = 8000;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function shouldSaveData(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return !!connection && (!!connection.saveData || /2g/.test(connection.effectiveType ?? ''));
}

let warmed = false;

/** Once per page load. Returns a cancel function. */
export function warmUpRoutes(router: NextRouter): () => void {
  if (warmed || typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return () => undefined;
  const timer = window.setTimeout(() => {
    if (warmed || !navigator.onLine || shouldSaveData()) return;
    warmed = true;
    const run = () => ROUTES.forEach((route) => router.prefetch(route).catch(() => undefined));
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(run);
    else run();
  }, WARM_DELAY_MS);
  return () => window.clearTimeout(timer);
}
