import { describe, expect, it } from 'vitest';

import { resolveKycCredentialStatus } from './rampCredentialStatus';
import { resolveKycStatus, type KycStatusInputs } from './status';

const base = {
  hasKyc: null as boolean | null,
  credentialJwt: null as string | null,
  credentialLoaded: false,
  checkFailed: false,
  kycStatus: 'checking',
} as const;

describe('resolveKycCredentialStatus', () => {
  it('is ready as soon as the credential is in hand', () => {
    expect(resolveKycCredentialStatus({ ...base, credentialJwt: 'a~b', kycStatus: 'none' })).toBe('ready');
    expect(resolveKycCredentialStatus({ ...base, credentialJwt: 'a~b', checkFailed: true })).toBe('ready');
  });

  it('reads a Vault credential exactly as before, whatever the shared state says', () => {
    expect(resolveKycCredentialStatus({ ...base, hasKyc: null, kycStatus: 'legacy' })).toBe('checking');
    expect(resolveKycCredentialStatus({ ...base, hasKyc: true, kycStatus: 'none' })).toBe('checking');
    expect(resolveKycCredentialStatus({ ...base, hasKyc: true, credentialLoaded: true, kycStatus: 'none' })).toBe(
      'unreadable',
    );
    expect(resolveKycCredentialStatus({ ...base, checkFailed: true, kycStatus: 'self' })).toBe('unavailable');
  });

  it('lets the shared state explain an empty Vault', () => {
    const empty = { ...base, hasKyc: false };
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'checking' })).toBe('checking');
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'none' })).toBe('none');
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'pending' })).toBe('pending');
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'unavailable' })).toBe('unavailable');
  });

  it('never asks a verified person to verify again when only the Vault copy is missing', () => {
    const empty = { ...base, hasKyc: false };
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'self' })).toBe('not_on_device');
    expect(resolveKycCredentialStatus({ ...empty, kycStatus: 'legacy' })).toBe('not_on_device');
  });
});

/**
 * The ramps and the profile card must agree. Each row is one person: what
 * `useKyc` read (Matrix index, Auth Hub) and what the ramp's own Vault read
 * found, against what the ramp shows.
 */
describe('ramp status for each kind of person', () => {
  const inputs: KycStatusInputs = {
    hasLegacyCredential: false,
    matrixFailed: false,
    hasSelfCredential: false,
    hubFailed: false,
    hasPendingLink: false,
  };
  /** The ramp's Vault read: `hasKyc` = either credential is indexed; the JWT once it is opened. */
  type VaultRead = { hasKyc: boolean | null; credentialJwt?: string | null; checkFailed?: boolean };
  const vault = (read: VaultRead) => ({ ...base, ...read, credentialLoaded: read.hasKyc === true });
  const ramp = (shared: Partial<KycStatusInputs>, read: VaultRead) =>
    resolveKycCredentialStatus({ ...vault(read), kycStatus: resolveKycStatus({ ...inputs, ...shared }).status });

  it('legacy credential in Matrix: ready, and the Hub is never needed', () => {
    expect(ramp({ hasLegacyCredential: true }, { hasKyc: true, credentialJwt: 'legacy~d~' })).toBe('ready');
    expect(ramp({ hasLegacyCredential: true, hubFailed: true }, { hasKyc: true, credentialJwt: 'legacy~d~' })).toBe(
      'ready',
    );
    // Indexed but not openable on this device: as before.
    expect(ramp({ hasLegacyCredential: true }, { hasKyc: true })).toBe('unreadable');
  });

  it('Self credential copied into Matrix: ready', () => {
    expect(ramp({ hasSelfCredential: true }, { hasKyc: true, credentialJwt: 'self~d~' })).toBe('ready');
    // The Hub is down but the Vault copy is in hand: still ready.
    expect(ramp({ hubFailed: true }, { hasKyc: true, credentialJwt: 'self~d~' })).toBe('ready');
  });

  it('Self credential in the Hub only: verified, try again shortly (never "verify")', () => {
    expect(ramp({ hasSelfCredential: true }, { hasKyc: false })).toBe('not_on_device');
    expect(ramp({ hasSelfCredential: true, hasPendingLink: true }, { hasKyc: false })).toBe('not_on_device');
  });

  it('no credential anywhere: verify, or continue an open check', () => {
    expect(ramp({}, { hasKyc: false })).toBe('none');
    expect(ramp({ hasPendingLink: true }, { hasKyc: false })).toBe('pending');
  });

  it('Hub down and nothing in Matrix: unknown, not "verify"', () => {
    expect(ramp({ hubFailed: true }, { hasKyc: false })).toBe('unavailable');
  });

  it('Matrix not synced: checking while it loads, then unknown, never "verify"', () => {
    // The ramp's own read is still waiting for the room.
    expect(ramp({ matrixFailed: true }, { hasKyc: null })).toBe('checking');
    // It gave up on the Vault.
    expect(ramp({ matrixFailed: true }, { hasKyc: null, checkFailed: true })).toBe('unavailable');
    // Its index read came back empty, but the room never loaded for `useKyc`.
    expect(ramp({ matrixFailed: true }, { hasKyc: false })).toBe('unavailable');
    // The Hub still vouches for a Self user.
    expect(ramp({ matrixFailed: true, hasSelfCredential: true }, { hasKyc: false })).toBe('not_on_device');
  });
});
