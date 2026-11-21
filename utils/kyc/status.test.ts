import { describe, expect, it } from 'vitest';

import { isKycVerified, resolveKycStatus, type KycStatusInputs } from './status';

const base: KycStatusInputs = {
  hasLegacyCredential: false,
  matrixFailed: false,
  hasSelfCredential: false,
  hubFailed: false,
  hasPendingLink: false,
};

describe('resolveKycStatus', () => {
  it('legacy wins over everything else', () => {
    expect(
      resolveKycStatus({ ...base, hasLegacyCredential: true, hasSelfCredential: true, hasPendingLink: true }),
    ).toEqual({ status: 'legacy', source: 'kycamllevel1' });
    expect(resolveKycStatus({ ...base, hasLegacyCredential: true, hubFailed: true })).toEqual({
      status: 'legacy',
      source: 'kycamllevel1',
    });
  });

  it('the Hub Self credential comes next, even with a pending link or an unreadable Matrix room', () => {
    expect(resolveKycStatus({ ...base, hasSelfCredential: true, hasPendingLink: true })).toEqual({
      status: 'self',
      source: 'identitylevel1',
    });
    expect(resolveKycStatus({ ...base, hasSelfCredential: true, matrixFailed: true })).toEqual({
      status: 'self',
      source: 'identitylevel1',
    });
  });

  it('a pending link is pending, also when the Hub could not be reached', () => {
    expect(resolveKycStatus({ ...base, hasPendingLink: true })).toEqual({ status: 'pending', source: null });
    expect(resolveKycStatus({ ...base, hasPendingLink: true, hubFailed: true })).toEqual({
      status: 'pending',
      source: null,
    });
  });

  it('is unavailable, not none, when either place could not be read', () => {
    expect(resolveKycStatus({ ...base, hubFailed: true })).toEqual({ status: 'unavailable', source: null });
    expect(resolveKycStatus({ ...base, matrixFailed: true })).toEqual({ status: 'unavailable', source: null });
  });

  it('is none when both were read and nothing was found', () => {
    expect(resolveKycStatus(base)).toEqual({ status: 'none', source: null });
  });
});

describe('isKycVerified', () => {
  it('is true only for legacy and self', () => {
    expect(isKycVerified('legacy')).toBe(true);
    expect(isKycVerified('self')).toBe(true);
    for (const status of ['checking', 'pending', 'none', 'unavailable'] as const) {
      expect(isKycVerified(status)).toBe(false);
    }
  });
});
