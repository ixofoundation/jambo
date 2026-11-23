import { takeAuthCallbackParams } from './callbackUrl';
import { takePendingSignIn } from './pkce';
import { exchangeAuthCode, type AuthHubSessionData } from './redirect';

export type AuthHubCallbackFailure =
  | 'cancelled'
  | 'hub_error'
  | 'state_mismatch'
  | 'missing_verifier'
  | 'exchange_failed';

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
    throw new AuthHubCallbackError(
      errorCode === 'access_denied' ? 'cancelled' : 'hub_error',
      `Auth hub returned an error (${errorCode})`,
    );
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
