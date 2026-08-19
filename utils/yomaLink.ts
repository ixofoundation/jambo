/**
 * Client-side state for the DID ↔ Yoma account link flow.
 *
 * - `yref` — the hand-off marker the yoma worker appends to its redirect
 *   (`/entities/<did>?yref=<partnerUserId>`). It identifies WHICH Yoma user
 *   this hand-off was for; after login we compare it against the logged-in
 *   account's own `yomaId` to detect a wrong-account sign-in. Kept in
 *   sessionStorage so it survives the same-tab auth-hub round trip.
 * - Link cache — the last `{ email, yomaId }` the worker reported, keyed by
 *   DID, so the root check doesn't re-query on every page. A completed link
 *   (`yomaId` set) is permanent server-side; an incomplete one is re-checked
 *   once per browser session (the Yoma match can complete server-side later).
 *
 * Everything here is cleared on logout — a public PC must not leak the
 * previous user's link state (or resume their hand-off) to the next login.
 */

const YREF_KEY = 'ixo_yoma_yref';
const LINK_CACHE_KEY = 'ixo_yoma_link';
const CHECKED_KEY = 'ixo_yoma_checked';
// A hand-off marker older than a day is stale — drop rather than confuse.
const YREF_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface YomaLinkState {
  email: string | null;
  yomaId: string | null;
}

export function saveYref(yref: string): void {
  if (!yref) return;
  try {
    sessionStorage.setItem(YREF_KEY, JSON.stringify({ yref, ts: Date.now() }));
  } catch {
    // Storage unavailable — losing the marker only skips the mismatch check.
  }
}

/** Reads without clearing — the marker stays until matched, dismissed, or logout. */
export function peekYref(): string | null {
  try {
    const raw = sessionStorage.getItem(YREF_KEY);
    if (!raw) return null;
    const { yref, ts } = JSON.parse(raw) as { yref?: unknown; ts?: unknown };
    if (typeof yref !== 'string' || !yref) return null;
    if (typeof ts !== 'number' || Date.now() - ts > YREF_MAX_AGE_MS) {
      sessionStorage.removeItem(YREF_KEY);
      return null;
    }
    return yref;
  } catch {
    return null;
  }
}

export function clearYref(): void {
  try {
    sessionStorage.removeItem(YREF_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

export function getCachedLink(did: string): YomaLinkState | null {
  try {
    const raw = localStorage.getItem(LINK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { did?: unknown; email?: unknown; yomaId?: unknown };
    if (parsed.did !== did) return null; // another account's cache — ignore
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      yomaId: typeof parsed.yomaId === 'string' ? parsed.yomaId : null,
    };
  } catch {
    return null;
  }
}

export function setCachedLink(did: string, link: YomaLinkState): void {
  try {
    localStorage.setItem(LINK_CACHE_KEY, JSON.stringify({ did, ...link, ts: Date.now() }));
  } catch {
    // Storage unavailable — the check just re-runs next session.
  }
}

/** Once-per-browser-session guard for the root status/bind check. */
export function wasCheckedThisSession(did: string): boolean {
  try {
    return sessionStorage.getItem(CHECKED_KEY) === did;
  } catch {
    return false;
  }
}

export function markCheckedThisSession(did: string): void {
  try {
    sessionStorage.setItem(CHECKED_KEY, did);
  } catch {
    // Storage unavailable — worst case the check repeats (it's cheap).
  }
}

/**
 * Clears the link cache + session-check flag. Called on EVERY logout. The
 * yref is cleared separately — a "switch account" logout keeps it so the
 * hand-off comparison re-runs for the next sign-in.
 */
export function clearLinkState(): void {
  try {
    localStorage.removeItem(LINK_CACHE_KEY);
    sessionStorage.removeItem(CHECKED_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
