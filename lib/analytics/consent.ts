/**
 * Analytics consent persistence. Ported from the portal (impacts-x-web
 * `lib/analytics/consent.ts`): the decision lives in localStorage AND a
 * first-party cookie so it survives a storage wipe, and nothing is ever
 * captured until the user has explicitly accepted.
 */

const CONSENT_KEY = 'ixo_analytics_consent';
const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type AnalyticsConsentState = 'granted' | 'denied' | 'unset';

type ConsentListener = () => void;
const listeners = new Set<ConsentListener>();

function notifyConsentListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken subscriber must not block the others.
    }
  });
}

/**
 * Subscribe to consent changes made through this module in the current tab.
 * Returns the unsubscribe function (shape matches `useSyncExternalStore`).
 */
export function subscribeAnalyticsConsent(listener: ConsentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeConsentValue(value: string | null | undefined): AnalyticsConsentState {
  return value === 'granted' || value === 'denied' ? value : 'unset';
}

function getAnalyticsConsentCookie(): AnalyticsConsentState {
  if (typeof document === 'undefined') return 'unset';

  try {
    const cookie = document.cookie
      .split(';')
      .map((row) => row.trim())
      .find((row) => row.startsWith(`${CONSENT_KEY}=`))
      ?.split('=')
      .slice(1)
      .join('=');

    return normalizeConsentValue(cookie ? decodeURIComponent(cookie) : null);
  } catch {
    return 'unset';
  }
}

function getCookieSecurityAttribute(): string {
  if (typeof window === 'undefined') return '';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

function setAnalyticsConsentCookie(value: Exclude<AnalyticsConsentState, 'unset'>): void {
  if (typeof document === 'undefined') return;

  try {
    document.cookie = `${CONSENT_KEY}=${encodeURIComponent(
      value,
    )}; Max-Age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${getCookieSecurityAttribute()}`;
  } catch {
    // Cookies unavailable; localStorage remains the primary store
  }
}

function clearAnalyticsConsentCookie(): void {
  if (typeof document === 'undefined') return;

  try {
    document.cookie = `${CONSENT_KEY}=; Max-Age=0; Path=/; SameSite=Lax${getCookieSecurityAttribute()}`;
  } catch {
    // Cookies unavailable; no-op
  }
}

export function getAnalyticsConsent(): AnalyticsConsentState {
  if (typeof window === 'undefined') return 'unset';

  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    const localStorageConsent = normalizeConsentValue(value);
    if (localStorageConsent !== 'unset') return localStorageConsent;
  } catch {
    // localStorage unavailable; fall through to cookie
  }

  const cookieConsent = getAnalyticsConsentCookie();
  if (cookieConsent === 'unset') return 'unset';

  try {
    window.localStorage.setItem(CONSENT_KEY, cookieConsent);
  } catch {
    // localStorage unavailable; cookie still preserves the choice
  }

  return cookieConsent;
}

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === 'granted';
}

export function setAnalyticsConsentValue(value: Exclude<AnalyticsConsentState, 'unset'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage unavailable; no-op
  }
  setAnalyticsConsentCookie(value);
  notifyConsentListeners();
}

export function clearAnalyticsConsent(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      // localStorage unavailable; no-op
    }
  }

  clearAnalyticsConsentCookie();
  notifyConsentListeners();
}
