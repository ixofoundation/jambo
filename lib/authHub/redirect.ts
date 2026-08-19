import { AUTH_HUB_URL } from './config';

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
 */
export function loginViaAuthHub(options?: { hideMnemonic?: boolean }) {
  const redirectUri = `${window.location.origin}/auth/callback`;
  let url = `${AUTH_HUB_URL}/api/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
  if (options?.hideMnemonic ?? true) {
    url += '&hide_mnemonic=true';
  }
  window.location.href = url;
}

/**
 * Exchange a one-time code for session data.
 * The code is single-use on the auth hub (deleted after first exchange) — callers
 * must ensure this is only called once per code.
 */
export async function exchangeAuthCode(code: string): Promise<AuthHubSessionData> {
  const res = await fetch(`${AUTH_HUB_URL}/api/auth/exchange?code=${encodeURIComponent(code)}`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message || 'Code exchange failed');
  }

  return res.json();
}

/**
 * Redirect to the auth hub for logout.
 */
export function logoutViaAuthHub() {
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth`);
  window.location.href = `${AUTH_HUB_URL}/api/auth/logout?redirect_uri=${redirectUri}`;
}
