/**
 * How an account signs in at the auth hub (`authProvider` of `/api/auth/exchange`):
 * `'workos'` (Google / Apple / email code, the "IXO" sign-in), or the id of a
 * direct sign-in provider such as `'yoma'` (the hub signs the person in at
 * Yoma's Keycloak itself, docs/direct-sso-providers.md in the hub repo).
 *
 * Pure helpers, no storage or config: the callers pass the hub URL and the
 * provider in, so the tests need no browser.
 */

export const WORKOS_PROVIDER = 'workos';

/** The hub's provider id rule: lowercase letters and digits, starting with a letter. */
const PROVIDER_ID = /^[a-z][a-z0-9]{0,31}$/;

/** A well-formed provider id, else null (missing, from an older hub, or not a string). */
export function normalizeAuthProvider(raw: unknown): string | null {
  return typeof raw === 'string' && PROVIDER_ID.test(raw) ? raw : null;
}

/** True for a direct sign-in provider (Yoma), false for WorkOS or unknown. */
export function isDirectProvider(provider: string | null | undefined): provider is string {
  const id = normalizeAuthProvider(provider);
  return id !== null && id !== WORKOS_PROVIDER;
}

/**
 * The hub's "Forgot your PIN?" page. A direct-provider account resets its PIN
 * with a fresh sign-in at its own provider, so the page must be told which
 * (CLIENTS.md "Forgot PIN?"); WorkOS and unknown accounts get the plain page,
 * which also offers every provider.
 */
export function pinResetUrl(hubUrl: string, provider: string | null | undefined): string {
  const url = new URL('/reset-pin', hubUrl);
  if (isDirectProvider(provider)) url.searchParams.set('sso_provider', provider);
  return url.toString();
}

/**
 * The page the hub returns to after a logout. It must be EXACTLY a redirect
 * URI registered for this app at the hub (sync-clients.mjs), or the hub sends
 * the person to its own home page instead: Jambo registers only its
 * `/auth/callback`, which bounces a visit without a code to the sign-in page.
 */
export function logoutReturnUrl(origin: string): string {
  return `${origin}/auth/callback`;
}

/**
 * The hub's logout (CLIENTS.md "Use a different account", step 1). With a
 * direct provider it also signs the person out at that provider (Yoma), so the
 * next sign-in can be another person; Keycloak asks "Do you want to log out?"
 * first, because the hub's own cookie is not sent on this cross-site visit.
 */
export function hubLogoutUrl(hubUrl: string, origin: string, provider: string | null | undefined): string {
  const url = new URL('/api/auth/logout', hubUrl);
  url.searchParams.set('redirect_uri', logoutReturnUrl(origin));
  if (isDirectProvider(provider)) url.searchParams.set('sso_provider', provider);
  return url.toString();
}
