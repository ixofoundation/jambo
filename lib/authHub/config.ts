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
 * Optional upstream re-authentication policy for Enterprise SSO logins, passed
 * through as the hub's `prompt` query param (`login` = force a fresh sign-in,
 * `inherit` = let the IdP reuse its live session). Only meaningful together
 * with AUTH_HUB_ORGANIZATION_ID and only once the hub supports it; unset =
 * the hub's default.
 */
export const AUTH_HUB_SSO_PROMPT = process.env.NEXT_PUBLIC_AUTH_HUB_SSO_PROMPT || null;
