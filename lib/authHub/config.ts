import { normalizeAuthProvider } from './provider';

export const AUTH_HUB_URL = process.env.NEXT_PUBLIC_AUTH_HUB_URL || 'http://localhost:8787';
export const DEV_BYPASS = process.env.NEXT_PUBLIC_AUTH_HUB_DEV_BYPASS === 'true';

/**
 * Optional WorkOS organization id. When set, the auth hub routes the login
 * straight to that organization's Enterprise SSO connection (Yoma's Keycloak
 * "YoID") instead of showing the Google / Apple / email chooser, so a user
 * who is already signed in to Yoma is not asked to sign in a second time.
 * Unset = today's behaviour.
 */
export const AUTH_HUB_ORGANIZATION_ID = process.env.NEXT_PUBLIC_AUTH_HUB_ORGANIZATION_ID || null;

/**
 * Optional direct sign-in provider id (`yoma`). When set, "Login with Yoma"
 * sends `sso_provider=<id>` and NOT the organization id: the hub signs the
 * person in at Yoma itself, without WorkOS (hub CLIENTS.md "Direct sign-in
 * providers"; the hub refuses both together). Unset = the organization id
 * above, exactly as before (the hub may alias that organization to the same
 * provider). A value that is not a valid provider id is ignored.
 */
export const AUTH_HUB_SSO_PROVIDER = normalizeAuthProvider(process.env.NEXT_PUBLIC_AUTH_HUB_SSO_PROVIDER);
/**
 * Optional upstream re-authentication policy for Enterprise SSO logins, passed
 * through as the hub's `prompt` query param (`login` = force a fresh sign-in,
 * `inherit` = let the IdP reuse its live session). Only meaningful together
 * with AUTH_HUB_SSO_PROVIDER or AUTH_HUB_ORGANIZATION_ID; unset = the hub's
 * default. A "switch account" sign-in always sends `login`.
 */
export const AUTH_HUB_SSO_PROMPT = process.env.NEXT_PUBLIC_AUTH_HUB_SSO_PROMPT || null;
