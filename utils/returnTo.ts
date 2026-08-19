const KEY = 'ixo_return_to';
// Deep links older than this are dropped — a youth who abandoned login
// yesterday shouldn't be teleported to a stale page on today's sign-in.
const MAX_AGE_MS = 30 * 60 * 1000;

// Once logout starts, AuthGuard still fires on the logged-out state flip and
// would re-save the page the user logged out FROM — its passive effect can
// run after logout's own clear. This flag outlives that race: logout ends in
// a full page navigation, so the module (and the flag) resets naturally on
// the next page load.
let suppressed = false;

/**
 * Remembers where a logged-out visitor was heading so the auth flow can take
 * them back after sign-in (e.g. a Yoma hand-off deep link to
 * /entities/<did>). sessionStorage survives the full-page redirect round trip
 * to the auth hub within the same tab.
 */
export function saveReturnTo(path: string): void {
  if (suppressed) return;
  // Internal app paths only (no protocol-relative //host), and never the
  // auth pages themselves or the home default.
  if (!path.startsWith('/') || path.startsWith('//')) return;
  if (path === '/' || path.startsWith('/auth')) return;
  // An unhydrated dynamic-route pattern ("/entities/[entityId]") is not a
  // real destination — never save it.
  if (path.includes('[')) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Storage unavailable (private mode etc.) — losing the deep link is fine.
  }
}

/**
 * Drops any saved path. Called on explicit logout — signing out is a clean
 * break, so the next sign-in must start fresh instead of resuming the page
 * the user happened to be on when they logged out.
 */
export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/**
 * Call at the START of logout: clears any saved path AND blocks new saves for
 * the remainder of this page instance, so the guard's logged-out effect can't
 * re-save the current page mid-teardown.
 */
export function suppressReturnTo(): void {
  suppressed = true;
  clearReturnTo();
}

/** Reads and clears the saved path; null when absent, expired, or invalid. */
export function takeReturnTo(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const { path, ts } = JSON.parse(raw) as { path?: unknown; ts?: unknown };
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
    if (path.includes('[')) return null; // stale unhydrated route pattern
    if (typeof ts !== 'number' || Date.now() - ts > MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
}
