import { peekReturnTo } from '@utils/returnTo';

import { AUTH_HUB_ORGANIZATION_ID, AUTH_HUB_SSO_PROMPT, AUTH_HUB_SSO_PROVIDER, AUTH_HUB_URL } from './config';
import { codeChallengeS256, createCodeVerifier, createState, isValidCodeVerifier, savePendingSignIn } from './pkce';
import { hubLogoutUrl, normalizeAuthProvider } from './provider';

/** True when logins can be routed to Yoma: the direct provider, or the older organisation route (see prepareAuthHubLogin). */
export const YOMA_SSO_AVAILABLE = !!AUTH_HUB_SSO_PROVIDER || !!AUTH_HUB_ORGANIZATION_ID;

export interface AuthHubSessionData {
  address: string;
  did: string;
  displayName: string | null;
  /**
   * The user's WorkOS-verified email (nullable; absent from hubs that predate
   * the field). Display/UX only — the Yoma link flow never trusts it, the
   * yoma worker verifies the email itself against the hub via UCAN.
   */
  email?: string | null;
  /**
   * How the account signs in: `'workos'` (the IXO sign-in) or a direct
   * provider id (`'yoma'`). Absent from hubs that predate it; read it through
   * normalizeAuthProvider (./provider). Decides the logout and the PIN reset.
   */
  authProvider?: string | null;
  sessionMnemonic: string | null;
  sessionAuthenticatorId: string | null;
  edSigningMnemonic: string | null;
  matrixMnemonic: string | null;
  matrixUserId: string | null;
  matrixRoomId: string | null;
}

/**
 * Redirect to the auth hub for login.
 *
 * `hideMnemonic` (default true) appends `hide_mnemonic=true`, which tells the
 * auth hub to skip the recovery-phrase ("Secret Words") screen during
 * registration. jambo owns backup/recovery itself — the root mnemonic is stored
 * encrypted in the user's Matrix room state (PIN-gated) — so the raw phrase
 * never needs to be surfaced during sign-up. The mnemonic is still generated and
 * stored server-side; only its display is skipped.
 *
 * `viaYoma` (default true) sends the login to Yoma: as `sso_provider=<id>`
 * (the hub's direct sign-in, no WorkOS) when AUTH_HUB_SSO_PROVIDER is set,
 * else through the WorkOS organisation (Yoma's Keycloak "YoID") when
 * AUTH_HUB_ORGANIZATION_ID is set; never both, the hub refuses that. Pass
 * false for the hub's normal IXO login (Google / Apple / email), used by
 * /ixo. Without either setting both behave the same.
 *
 * `ssoProvider` names the provider explicitly (a "switch account" sign-in
 * for the provider the old account used) and `prompt` overrides
 * AUTH_HUB_SSO_PROMPT (`login` for a switch: Yoma must ask who is signing in).
 *
 * Every start, on either path, carries a fresh CSRF `state` and a PKCE S256
 * `code_challenge`; the state and its verifier are kept in this browser (see
 * ./pkce) for the callback, which refuses a return it cannot match and sends
 * the verifier with the exchange. The `redirect_uri` stays exactly
 * `<origin>/auth/callback`: the hub matches registered clients on it.
 */
export interface AuthHubLoginOptions {
  hideMnemonic?: boolean;
  viaYoma?: boolean;
  ssoProvider?: string;
  prompt?: 'login' | 'inherit';
}

export async function prepareAuthHubLogin(options?: AuthHubLoginOptions): Promise<string> {
  const verifier = createCodeVerifier();
  const codeChallenge = await codeChallengeS256(verifier);
  const state = createState();
  savePendingSignIn({ state, verifier, returnTo: peekReturnTo() });

  const redirectUri = `${window.location.origin}/auth/callback`;
  let url = `${AUTH_HUB_URL}/api/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  url += `&state=${encodeURIComponent(state)}`;
  url += `&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
  if (options?.hideMnemonic ?? true) {
    url += '&hide_mnemonic=true';
  }
  // Yoma single sign-on: send the user straight to Yoma's Keycloak, where an
  // existing YoID session can be reused (prompt=inherit). The direct provider
  // when configured, else the older WorkOS organisation route.
  if (options?.viaYoma ?? true) {
    const provider = normalizeAuthProvider(options?.ssoProvider) ?? AUTH_HUB_SSO_PROVIDER;
    const prompt = options?.prompt ?? AUTH_HUB_SSO_PROMPT;
    if (provider) {
      url += `&sso_provider=${encodeURIComponent(provider)}`;
    } else if (AUTH_HUB_ORGANIZATION_ID) {
      url += `&organization_id=${encodeURIComponent(AUTH_HUB_ORGANIZATION_ID)}`;
    }
    if ((provider || AUTH_HUB_ORGANIZATION_ID) && prompt) {
      url += `&prompt=${encodeURIComponent(prompt)}`;
    }
  }
  return url;
}

/** Leave for the hub (a full redirect; popups are blocked on phones). Rejects when the sign-in cannot be secured. */
export async function loginViaAuthHub(options?: AuthHubLoginOptions): Promise<void> {
  window.location.href = await prepareAuthHubLogin(options);
}

/**
 * Exchange a one-time code, with the PKCE verifier of the sign-in that asked
 * for it, for session data. The code is single-use on the auth hub (deleted on
 * the first exchange, even a failed one) — callers must call this once per
 * code. The error never carries the code, the verifier or hub text.
 */
export async function exchangeAuthCode(code: string, codeVerifier: string): Promise<AuthHubSessionData> {
  if (!code || !isValidCodeVerifier(codeVerifier)) throw new Error('Code exchange needs a code and its verifier');
  const query = new URLSearchParams({ code, code_verifier: codeVerifier });
  const res = await fetch(`${AUTH_HUB_URL}/api/auth/exchange?${query.toString()}`, {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!res.ok) {
    throw new Error(`Code exchange failed (HTTP ${res.status})`);
  }

  try {
    return (await res.json()) as AuthHubSessionData;
  } catch {
    // Never surface the parser's message: it can quote the response body.
    throw new Error('Code exchange returned an unreadable response');
  }
}

/**
 * Leave for the hub's logout, which comes back to this app's /auth/callback
 * (the one address the hub trusts for Jambo; see hubLogoutUrl). For a direct
 * provider (Yoma) it also signs the person out at Yoma.
 */
export function logoutViaAuthHub(provider: string | null | undefined): void {
  window.location.href = hubLogoutUrl(AUTH_HUB_URL, window.location.origin, provider);
}
