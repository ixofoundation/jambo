import { normalizeAuthProvider } from './provider';

/**
 * Two small markers kept in this tab's sessionStorage (it survives the
 * same-tab round trip to the auth hub and Yoma, and is not shared with
 * other tabs):
 *
 * - "Switch account" under way: set just before Jambo sends a direct-provider
 *   account (Yoma) through the hub's logout; read once, back on /auth, which
 *   then starts a fresh sign-in at that provider with `prompt=login`
 *   (CLIENTS.md "Use a different account", step 2). Short-lived: someone who
 *   gives up at Yoma's "Do you want to log out?" and comes back much later
 *   is not sent off to sign in by surprise.
 * - The sign-in page the last sign-in started from (`/auth`, or `/ixo` for
 *   IXO team accounts), so the callback's "Try again" goes back to it.
 */

const SWITCH_KEY = 'ixo_auth_switch_account';
const SWITCH_MAX_AGE_MS = 10 * 60 * 1000;

const SIGN_IN_PAGE_KEY = 'ixo_auth_sign_in_page';

export type SignInPage = '/auth' | '/ixo';

export function markSwitchAccount(provider: string, now: number = Date.now()): void {
  const id = normalizeAuthProvider(provider);
  if (!id) return;
  try {
    sessionStorage.setItem(SWITCH_KEY, JSON.stringify({ provider: id, ts: now }));
  } catch {
    // Storage unavailable: the person lands on the sign-in page and taps it themselves.
  }
}

/** The provider of a switch under way, read once (always cleared). Null when none, stale or unreadable. */
export function takeSwitchAccount(now: number = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(SWITCH_KEY);
    sessionStorage.removeItem(SWITCH_KEY);
    if (!raw) return null;
    const { provider, ts } = JSON.parse(raw) as { provider?: unknown; ts?: unknown };
    if (typeof ts !== 'number' || now - ts < 0 || now - ts > SWITCH_MAX_AGE_MS) return null;
    return normalizeAuthProvider(provider);
  } catch {
    return null;
  }
}

export function rememberSignInPage(page: SignInPage): void {
  try {
    sessionStorage.setItem(SIGN_IN_PAGE_KEY, page);
  } catch {
    // Storage unavailable: "Try again" goes to /auth.
  }
}

/** Where "Try again" goes: the page the last sign-in in this tab started from, else /auth. */
export function lastSignInPage(): SignInPage {
  try {
    return sessionStorage.getItem(SIGN_IN_PAGE_KEY) === '/ixo' ? '/ixo' : '/auth';
  } catch {
    return '/auth';
  }
}
