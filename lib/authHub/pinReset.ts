import { AUTH_HUB_URL } from './config';
import { pinResetUrl } from './provider';

/**
 * Open the auth hub's PIN-reset flow in a new tab (same pattern as the Portal).
 *
 * The hub is semi-custodial: it verifies the user with a fresh sign-in (an
 * email code for a WorkOS account; a fresh login at Yoma for a Yoma account,
 * which is why the account's `authProvider` is passed on), then re-encrypts
 * the Vault secrets (`encrypted_mnemonic` + `encrypted_mnemonic_ed_signing`
 * room state) under the new PIN — the old PIN is never needed, and it sends a
 * "your PIN was changed" notice. Nothing to refresh app-side: jambo never
 * caches the ciphertext, so the next PIN prompt reads the freshly written value.
 */
export function openPinResetFlow(authProvider: string | null | undefined): void {
  window.open(pinResetUrl(AUTH_HUB_URL, authProvider), '_blank', 'noopener,noreferrer');
}
