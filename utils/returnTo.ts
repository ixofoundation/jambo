import { stripCampaignParams } from 'lib/analytics/campaign';

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

// Browsers drop tabs and newlines from URLs and read "\" as "/", so "/\t/evil.example"
// passes a string check and still lands on another site. Refuse every control
// character (U+0000–U+001F, U+007F), any whitespace and any backslash.
const hasUnsafePathCharacter = (path: string): boolean =>
  /[\s\\]/.test(path) ||
  Array.from(path).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

/**
 * A path on this site, rebuilt from how the browser parses it: never another
 * origin. Returns the rebuilt `pathname + search + hash`, which callers must
 * use instead of the input. Null for anything else, and always null without an
 * origin to compare against (the server).
 */
export function sameOriginPath(
  path: unknown,
  origin: string | undefined = typeof window === 'undefined' ? undefined : window.location.origin,
): string | null {
  if (!origin || typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
  if (hasUnsafePathCharacter(path)) return null;
  let url: URL;
  try {
    url = new URL(path, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const rebuilt = `${url.pathname}${url.search}${url.hash}`;
  // "/.//evil.example" normalises to the pathname "//evil.example".
  return rebuilt.startsWith('//') ? null : rebuilt;
}

/** The sign-in pages: /auth… and /ixo (IXO team sign-in), with or without a query. */
const isSignInPage = (path: string): boolean => path.startsWith('/auth') || /^\/ixo(?:[/?#]|$)/.test(path);

/**
 * A deep link worth landing on after sign-in, rebuilt (see sameOriginPath):
 * never another site, the home default, the auth pages themselves, or an
 * unhydrated dynamic-route pattern ("/entities/[entityId]").
 */
export function returnablePath(path: unknown, origin?: string): string | null {
  // An unhydrated pattern is not a real destination — check the raw input too,
  // in case the URL parser ever percent-encodes the brackets.
  if (typeof path === 'string' && path.includes('[')) return null;
  const safe = sameOriginPath(path, origin);
  if (!safe || safe === '/' || isSignInPage(safe) || safe.includes('[')) return null;
  return safe;
}

/**
 * Remembers where a logged-out visitor was heading so the auth flow can take
 * them back after sign-in (e.g. a Yoma hand-off deep link to
 * /entities/<did>). sessionStorage survives the full-page redirect round trip
 * to the auth hub within the same tab.
 */
export function saveReturnTo(rawPath: string): void {
  if (suppressed) return;
  // Campaign tags are held by lib/analytics/campaign, not replayed after
  // sign-in — and `/?utm_source=…` is still just the home default.
  if (typeof rawPath !== 'string') return;
  // Internal app paths only, rebuilt by the URL parser (see sameOriginPath),
  // and never the auth pages themselves, the home default or an unhydrated
  // dynamic-route pattern.
  const path = returnablePath(stripCampaignParams(rawPath));
  if (!path) return;
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

function readReturnTo(clear: boolean): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    if (clear) sessionStorage.removeItem(KEY);
    const { path, ts } = JSON.parse(raw) as { path?: unknown; ts?: unknown };
    if (typeof ts !== 'number' || Date.now() - ts > MAX_AGE_MS) return null;
    // Re-validated on the way out: storage is not a trust boundary.
    return returnablePath(path);
  } catch {
    return null;
  }
}

/** Reads and clears the saved path; null when absent, expired, or invalid. */
export function takeReturnTo(): string | null {
  return readReturnTo(true);
}

/** Reads the saved path without clearing it (sign-in start copies it next to its state). */
export function peekReturnTo(): string | null {
  return readReturnTo(false);
}
