import type { KycStatus } from 'types/kyc';

/**
 * The old identity check (SurveyJS form + ComplyCube via ixo-kyc-server) can no
 * longer be started; a person who is midway through one may still finish it
 * (docs/self-kyc-plan.md 4.6). These helpers decide who that is.
 */

/**
 * The ixo-kyc-server statuses (`KycStatus` in constants/kyc) that mean an old
 * check was started and can still end in a credential:
 *
 * - `verify`: form submitted, the document scan and liveness check are still to do
 * - `review` / `attention`: submitted, being reviewed (automatically / by a person)
 * - `clear` / `issuing`: approved, the credential is being issued
 * - `issued`: issued, the app still has to save it to the Vault
 *
 * Not in flight: no status or `unknown` (the server knows no check), `rejected`
 * and `error` (ended without a credential: the person starts the new check),
 * and `complete` (saved: the Vault credential makes the person verified).
 */
const IN_FLIGHT_STATUSES: readonly string[] = ['verify', 'review', 'attention', 'clear', 'issuing', 'issued'];

export function isLegacyKycInFlight(status?: string | null): boolean {
  return !!status && IN_FLIGHT_STATUSES.includes(status);
}

/**
 * Approved: the credential is being issued, or is issued and waits to be saved.
 * It comes with the person's details (email, phone, address) that the new
 * check does not collect, so from here the old check is finished, not left.
 */
const CREDENTIAL_DUE_STATUSES: readonly string[] = ['clear', 'issuing', 'issued'];

/**
 * Whether "Use the new identity check instead" may be offered: only for an old
 * check that can still stall (`verify`, `review`, `attention`).
 */
export function canLeaveLegacyKyc(status?: string | null): boolean {
  return isLegacyKycInFlight(status) && !CREDENTIAL_DUE_STATUSES.includes(status as string);
}

/**
 * Whether the old check is what the person sees. `leftForNewCheck` = they chose
 * the new check earlier on this device; that choice is ignored once the old
 * credential is due, so a tap made earlier cannot hide "Save Credential".
 */
export function showsLegacyKyc(status: string | null | undefined, leftForNewCheck: boolean): boolean {
  return isLegacyKycInFlight(status) && !(leftForNewCheck && canLeaveLegacyKyc(status));
}

/** What the profile's identity card shows. */
export type KycCardView =
  /** Not known yet. */
  | 'checking'
  /** Holds a credential (old or new). */
  | 'verified'
  /** Midway through an old check: the old status, continue and save controls. */
  | 'legacy'
  /** A Self check is open, under review or being saved. */
  | 'pending'
  /** Not verified: offer the Self check. */
  | 'start'
  /** Could not be checked: offer a retry. */
  | 'unavailable'
  /** Not verified and the Self check is not configured here. */
  | 'not_available';

export function resolveKycCardView(state: {
  /** `useKyc().status`. */
  kycStatus: KycStatus;
  /** An old check is in flight (`isLegacyKycInFlight`), and the old path is configured. */
  legacyInFlight: boolean;
  /** The old-check lookup has answered (or is switched off). */
  legacyChecked: boolean;
  selfEnabled: boolean;
}): KycCardView {
  const { kycStatus, legacyInFlight, legacyChecked, selfEnabled } = state;
  if (kycStatus === 'checking') return 'checking';
  // A verified person never sees the old check or the Self prompt.
  if (kycStatus === 'legacy' || kycStatus === 'self') return 'verified';
  if (legacyInFlight) return 'legacy';
  // Wait for the old-check lookup, so "Verify my identity" does not flash first.
  if (!legacyChecked) return 'checking';
  if (kycStatus === 'unavailable') return 'unavailable';
  if (!selfEnabled) return 'not_available';
  return kycStatus === 'pending' ? 'pending' : 'start';
}
