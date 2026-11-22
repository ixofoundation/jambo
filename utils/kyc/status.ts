import type { KycSource, KycStatus } from 'types/kyc';

/** What `useKyc` has already fetched; resolving it is pure so it can be tested. */
export type KycStatusInputs = {
  /** The Matrix room holds the old `kycamllevel1` credential. */
  hasLegacyCredential: boolean;
  /** The Matrix room could not be read, so a legacy credential is not ruled out. */
  matrixFailed: boolean;
  /** The Hub wallet holds a valid `IdentityLevel1` credential from Self. */
  hasSelfCredential: boolean;
  /** The Hub could not be asked, so a Self credential is not ruled out. */
  hubFailed: boolean;
  /** A Self check was started on this device and is not known to be finished. */
  hasPendingLink: boolean;
};

export type KycResolution = { status: Exclude<KycStatus, 'checking'>; source: KycSource | null };

/**
 * Legacy wins (those users never need a Self credential), then Self, then an
 * open check. `none` is only answered when both places were actually read:
 * otherwise a verified person would be told to verify again.
 */
export function resolveKycStatus(inputs: KycStatusInputs): KycResolution {
  if (inputs.hasLegacyCredential) return { status: 'legacy', source: 'kycamllevel1' };
  if (inputs.hasSelfCredential) return { status: 'self', source: 'identitylevel1' };
  if (inputs.hasPendingLink) return { status: 'pending', source: null };
  if (inputs.hubFailed || inputs.matrixFailed) return { status: 'unavailable', source: null };
  return { status: 'none', source: null };
}

export function isKycVerified(status: KycStatus): boolean {
  return status === 'legacy' || status === 'self';
}
