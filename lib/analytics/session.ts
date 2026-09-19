/**
 * Distinguishes "the app booted with a session that was just created" from
 * "the app booted with a session revived from an earlier visit".
 *
 * Login ends in a full-page navigation (`pages/auth/callback.tsx`), so the
 * very next boot revives the session from storage exactly like a returning
 * user would. Without this marker every login would also count as a
 * `session_restored`. sessionStorage is per tab and survives the navigation.
 */

const FRESH_LOGIN_KEY = 'ixo_analytics_fresh_login';

export function markFreshLogin(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(FRESH_LOGIN_KEY, '1');
  } catch {
    // sessionStorage unavailable — the next boot may count as a restore, acceptable
  }
}

/** Returns true (and clears the marker) if this boot follows a fresh login. */
export function consumeFreshLogin(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const marked = window.sessionStorage.getItem(FRESH_LOGIN_KEY) === '1';
    if (marked) window.sessionStorage.removeItem(FRESH_LOGIN_KEY);
    return marked;
  } catch {
    return false;
  }
}
