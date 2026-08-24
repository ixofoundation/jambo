import { AUTH_HUB_URL } from './config';

/**
 * Open the auth hub's PIN-reset flow in a new tab (same pattern as the Portal).
 *
 * The hub is semi-custodial: it verifies the user with a fresh email sign-in,
 * then re-encrypts the Vault secrets (`encrypted_mnemonic` +
 * `encrypted_mnemonic_ed_signing` room state) under the new PIN — the old PIN
 * is never needed, and it emails a "your PIN was changed" notice. Nothing to
 * refresh app-side: jambo never caches the ciphertext, so the next PIN prompt
 * reads the freshly written value.
 */
export function openPinResetFlow(): void {
  window.open(`${AUTH_HUB_URL}/reset-pin`, '_blank', 'noopener,noreferrer');
}
