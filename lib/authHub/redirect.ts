import { peekReturnTo } from '@utils/returnTo';

import { AUTH_HUB_URL } from './config';
import { codeChallengeS256, createCodeVerifier, createState, isValidCodeVerifier, savePendingSignIn } from './pkce';

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
 * Every start carries a fresh CSRF `state` and a PKCE S256 `code_challenge`;
 * the state and its verifier are kept in this browser (see ./pkce) for the
 * callback, which refuses a return it cannot match and sends the verifier with
 * the exchange. The `redirect_uri` stays exactly `<origin>/auth/callback`: the
 * hub matches registered clients on it.
 */
export async function prepareAuthHubLogin(options?: { hideMnemonic?: boolean }): Promise<string> {
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
  return url;
}

/** Leave for the hub (a full redirect; popups are blocked on phones). Rejects when the sign-in cannot be secured. */
export async function loginViaAuthHub(options?: { hideMnemonic?: boolean }): Promise<void> {
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
 * Redirect to the auth hub for logout.
 */
export function logoutViaAuthHub() {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth`);
  window.location.href = `${AUTH_HUB_URL}/api/auth/logout?redirect_uri=${redirectUri}`;
}
