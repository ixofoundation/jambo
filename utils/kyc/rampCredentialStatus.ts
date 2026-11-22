import type { KycStatus } from 'types/kyc';

/** Where the background read of the user's verification (in their Vault) stands. */
export type KycCredentialStatus =
  /** Still looking — the Vault may be syncing. */
  | 'checking'
  /** Looked; the user holds no verification. */
  | 'none'
  /** Found and loaded — it is sent with the create call. */
  | 'ready'
  /** Found, but it couldn't be opened (decrypted) on this device. */
  | 'unreadable'
  /** Verified, but the Vault copy that is sent with the create call is not on this device yet. */
  | 'not_on_device'
  /** An identity check is open, under review or being saved. */
  | 'pending'
  /** The Vault (or the Auth Hub) couldn't be reached, so we don't know. */
  | 'unavailable';

/**
 * Collapse the screens' loading flags into one status.
 *
 * The ramps need the credential itself (the raw SD-JWT in the Vault), which is
 * what `hasKyc` / `credentialJwt` / `credentialLoaded` describe: `hasKyc` is
 * the Vault index check (null = unresolved); `credentialLoaded` flips once the
 * attempt to open the credential has finished, so "found but still opening"
 * reads as 'checking' rather than flashing 'unreadable'.
 *
 * Whether the person is verified at all is the shared state (`useKyc().status`,
 * the same answer the profile card shows). It decides what an empty Vault
 * means: only `none` asks the person to verify. A person the Auth Hub says is
 * verified, whose Vault copy has not arrived, is told to try again shortly.
 */
export function resolveKycCredentialStatus(state: {
  hasKyc: boolean | null;
  credentialJwt: string | null;
  credentialLoaded: boolean;
  checkFailed: boolean;
  kycStatus: KycStatus;
}): KycCredentialStatus {
  if (state.credentialJwt) return 'ready';
  if (state.checkFailed) return 'unavailable';
  if (state.hasKyc === null) return 'checking';
  if (state.hasKyc) return state.credentialLoaded ? 'unreadable' : 'checking';
  // Nothing in the Vault: the shared state says why.
  switch (state.kycStatus) {
    case 'checking':
      return 'checking';
    case 'legacy':
    case 'self':
      return 'not_on_device';
    case 'pending':
      return 'pending';
    case 'unavailable':
      return 'unavailable';
    default:
      return 'none';
  }
}
