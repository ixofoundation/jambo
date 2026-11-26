import { takeAuthCallbackParams } from './callbackUrl';
import { takePendingSignIn } from './pkce';
import { exchangeAuthCode, type AuthHubSessionData } from './redirect';

export type AuthHubCallbackFailure =
  | 'cancelled'
  | 'provider_unavailable'
  | 'session_expired'
  | 'rate_limited'
  | 'account_deleted'
  | 'hub_error'
  | 'state_mismatch'
  | 'missing_verifier'
  | 'exchange_failed';

/**
 * The hub's error codes (its /auth-error page hands them back to the app,
 * and /api/auth/login answers some directly), grouped by what the person
 * can do about them. Every other code is `hub_error` (the generic line).
 */
const HUB_ERROR_REASONS: Record<string, AuthHubCallbackFailure> = {
  // They (or the provider) stopped the sign-in.
  access_denied: 'cancelled',
  sso_access_denied: 'cancelled',
  // The sign-in service (Yoma, WorkOS) could not be reached or failed.
  sso_provider_unavailable: 'provider_unavailable',
  sso_provider_error: 'provider_unavailable',
  oauth_failed: 'provider_unavailable',
  server_error: 'provider_unavailable',
  temporarily_unavailable: 'provider_unavailable',
  // The sign-in ran out, or finished in another tab or browser: start again.
  sso_session_expired: 'session_expired',
  sso_session_lost: 'session_expired',
  sso_invalid_state: 'session_expired',
  sso_nonce_mismatch: 'session_expired',
  sso_login_required: 'session_expired',
  code_expired: 'session_expired',
  state_mismatch: 'session_expired',
  rate_limited: 'rate_limited',
  sso_account_deleted: 'account_deleted',
};

/** The reason for a hub error code; anything unknown or malformed is `hub_error`. */
export function hubErrorReason(code: string | null | undefined): AuthHubCallbackFailure {
  if (!code || !/^[a-z_]{1,64}$/.test(code)) return 'hub_error';
  return Object.prototype.hasOwnProperty.call(HUB_ERROR_REASONS, code) ? HUB_ERROR_REASONS[code] : 'hub_error';
}

/** A callback this browser refuses or the hub refused. `message` never carries the code, verifier or hub text. */
export class AuthHubCallbackError extends Error {
  readonly reason: AuthHubCallbackFailure;

  constructor(reason: AuthHubCallbackFailure, message: string) {
    super(message);
    this.name = 'AuthHubCallbackError';
    this.reason = reason;
  }
}

export type AuthHubCallbackResult =
  /** Nothing to finish: the page was opened without callback parameters. */
  { kind: 'none' } | { kind: 'session'; session: AuthHubSessionData; returnTo: string | null };

/**
 * On /auth/callback. In this order, before any network call: take the
 * callback parameters (the address bar is already clean, see ./callbackUrl),
 * take the sign-in this browser started for that `state` (deleted on read, so
 * a replayed callback finds none), then refuse anything not started here.
 * Only then exchange the code with its verifier.
 */
export async function completeAuthHubCallback(): Promise<AuthHubCallbackResult> {
  const { code, state, error } = takeAuthCallbackParams();
  // Deleted even on an error return: a failed sign-in is started again from scratch.
  const pending = takePendingSignIn(state);

  if (error) {
    const errorCode = /^[a-z_]{1,64}$/.test(error) ? error : 'unknown';
    throw new AuthHubCallbackError(hubErrorReason(errorCode), `Auth hub returned an error (${errorCode})`);
  }
  if (!code) return { kind: 'none' };
  if (!pending?.state || !state || state !== pending.state) {
    throw new AuthHubCallbackError(
      'state_mismatch',
      'The sign-in state does not match a sign-in started in this browser',
    );
  }
  if (!pending.verifier) {
    throw new AuthHubCallbackError('missing_verifier', 'No PKCE verifier for this sign-in');
  }

  let session: AuthHubSessionData;
  try {
    session = await exchangeAuthCode(code, pending.verifier);
  } catch {
    // Fixed text: a parse error of the response could quote its key material.
    throw new AuthHubCallbackError('exchange_failed', 'Code exchange failed');
  }
  return { kind: 'session', session, returnTo: pending.returnTo };
}
