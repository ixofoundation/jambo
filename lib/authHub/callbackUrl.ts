/**
 * The auth hub returns to `/auth/callback?code=…&state=…` (or, on failure,
 * `?error=…&error_description=…&state=…`). The `code` unlocks the user's key
 * material at `/api/auth/exchange`, so it must never stay in the address bar,
 * browser history, a referrer or an analytics event.
 *
 * Next 12 records the address before any app code runs: the client reads
 * `location` into the router's `asPath` before `_app` is evaluated, and on
 * mount replaces the history entry with that `asPath` again. So the capture
 * runs earlier still, as an inline script that `pages/_document.tsx` puts first
 * in <head> (`AUTH_CALLBACK_CAPTURE_SCRIPT`): it executes while the HTML is
 * parsed, before Next's deferred scripts and long before PostHog. It reads the
 * four parameters once, keeps them in memory for the callback page, and
 * removes them from the URL with `history.replaceState`.
 */

export const AUTH_CALLBACK_PATH = '/auth/callback';

const CALLBACK_PARAMS = ['code', 'state', 'error', 'error_description'] as const;
const HOLDER_NAME = 'ixo.authHub.callbackParams';
const HOLDER = Symbol.for(HOLDER_NAME);
const CALLBACK_PATHNAME = /^\/auth\/callback\/?$/;

export interface AuthCallbackParams {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
}

type Holder = { [HOLDER]?: AuthCallbackParams | null };

const EMPTY: AuthCallbackParams = { code: null, state: null, error: null, errorDescription: null };

/** `window`, where the inline script keeps them (the same object as globalThis in a browser). */
function holder(): Holder {
  return (typeof window === 'undefined' ? globalThis : window) as unknown as Holder;
}

export function isAuthCallbackPathname(pathname: string): boolean {
  return CALLBACK_PATHNAME.test(pathname);
}

/**
 * Dependency-free, ES5 on purpose: it runs as an inline <script> before any
 * bundle. Mirrors `captureAuthCallbackFromLocation` below (tested to match).
 * Never throws: a failure here must not break the page, and the callback page
 * captures (and cleans) again itself.
 */
export const AUTH_CALLBACK_CAPTURE_SCRIPT = `(function () {
  try {
    var loc = window.location;
    if (!/^\\/auth\\/callback\\/?$/.test(loc.pathname)) return;
    var url = new URL(loc.href);
    var names = ${JSON.stringify(CALLBACK_PARAMS)};
    var found = false;
    for (var i = 0; i < names.length; i++) if (url.searchParams.has(names[i])) found = true;
    if (!found) return;
    var params = {
      code: url.searchParams.get('code'),
      state: url.searchParams.get('state'),
      error: url.searchParams.get('error'),
      errorDescription: url.searchParams.get('error_description')
    };
    for (var j = 0; j < names.length; j++) url.searchParams.delete(names[j]);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    window[Symbol.for(${JSON.stringify(HOLDER_NAME)})] = params;
  } catch (e) {}
})();`;

/**
 * On the callback route: read `code` / `state` / `error` / `error_description`
 * once, hold them in memory, and strip them from the address bar with
 * `history.replaceState`. Returns true when it removed anything.
 */
export function captureAuthCallbackFromLocation(): boolean {
  if (typeof window === 'undefined') return false;
  let url: URL;
  try {
    url = new URL(window.location.href);
  } catch {
    return false;
  }
  if (!isAuthCallbackPathname(url.pathname)) return false;
  if (!CALLBACK_PARAMS.some((param) => url.searchParams.has(param))) return false;

  const params: AuthCallbackParams = {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    error: url.searchParams.get('error'),
    errorDescription: url.searchParams.get('error_description'),
  };
  for (const param of CALLBACK_PARAMS) url.searchParams.delete(param);
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  holder()[HOLDER] = params;
  return true;
}

/**
 * The callback parameters, handed out once. Scrubs the address bar first in
 * case the early capture did not run (then it reads them from the URL itself).
 */
export function takeAuthCallbackParams(): AuthCallbackParams {
  captureAuthCallbackFromLocation();
  const params = holder()[HOLDER] ?? EMPTY;
  holder()[HOLDER] = null;
  return params;
}

/**
 * Remove the callback parameters from a callback URL (absolute or
 * root-relative) before it reaches analytics. Any other string is returned
 * unchanged.
 */
export function redactAuthCallbackUrl(value: string): string {
  if (!value.includes(AUTH_CALLBACK_PATH) || !/^(https?:\/\/|\/)/i.test(value)) return value;
  try {
    const url = new URL(value, 'https://redacted.invalid');
    if (!isAuthCallbackPathname(url.pathname)) return value;
    if (!CALLBACK_PARAMS.some((param) => url.searchParams.has(param))) return value;
    for (const param of CALLBACK_PARAMS) url.searchParams.delete(param);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return value.startsWith('/') ? path : `${url.origin}${path}`;
  } catch {
    return value.split('?')[0];
  }
}
