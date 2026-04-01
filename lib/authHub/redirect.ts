import { AUTH_HUB_URL } from './config';

export interface AuthHubSessionData {
  address: string;
  did: string;
  displayName: string | null;
  sessionMnemonic: string | null;
  sessionAuthenticatorId: string | null;
  edSigningMnemonic: string | null;
  matrixMnemonic: string | null;
  matrixUserId: string | null;
  matrixRoomId: string | null;
}

/**
 * Redirect to the auth hub for login.
 */
export function loginViaAuthHub() {
  const redirectUri = `${window.location.origin}/auth/callback`;
  window.location.href = `${AUTH_HUB_URL}/api/auth/login?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Exchange a one-time code for session data.
 * CSRF protection is handled by the auth hub's single-use, time-limited codes
 * and WorkOS's own OAuth state management — no client-side state check needed.
 */
export async function handleAuthCallback(): Promise<AuthHubSessionData | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (!code) return null;

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
