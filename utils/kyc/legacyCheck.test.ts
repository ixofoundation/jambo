import { describe, expect, it } from 'vitest';

import { KycStatus } from '@constants/kyc';
import { canLeaveLegacyKyc, isLegacyKycInFlight, resolveKycCardView, showsLegacyKyc } from './legacyCheck';

describe('isLegacyKycInFlight', () => {
  it('is true for every status between submitting the form and saving the credential', () => {
    for (const status of [
      KycStatus.Verify,
      KycStatus.Review,
      KycStatus.Attention,
      KycStatus.Clear,
      KycStatus.Issuing,
      KycStatus.Issued,
    ]) {
      expect(isLegacyKycInFlight(status)).toBe(true);
    }
  });

  it('is false when no check exists, or it ended', () => {
    for (const status of [KycStatus.Unknown, KycStatus.Rejected, KycStatus.Error, KycStatus.Complete]) {
      expect(isLegacyKycInFlight(status)).toBe(false);
    }
    expect(isLegacyKycInFlight(undefined)).toBe(false);
    expect(isLegacyKycInFlight(null)).toBe(false);
    expect(isLegacyKycInFlight('')).toBe(false);
    expect(isLegacyKycInFlight('something-new')).toBe(false);
  });
});

describe('leaving the old check for the new one', () => {
  const stallable = [KycStatus.Verify, KycStatus.Review, KycStatus.Attention];
  const credentialDue = [KycStatus.Clear, KycStatus.Issuing, KycStatus.Issued];
  const notInFlight = [KycStatus.Unknown, KycStatus.Rejected, KycStatus.Error, KycStatus.Complete, undefined, null, ''];

  it('is offered only while the old check can still stall', () => {
    for (const status of stallable) expect(canLeaveLegacyKyc(status)).toBe(true);
    for (const status of credentialDue) expect(canLeaveLegacyKyc(status)).toBe(false);
    for (const status of notInFlight) expect(canLeaveLegacyKyc(status)).toBe(false);
  });

  it('hides the old check for a person who left it', () => {
    for (const status of stallable) {
      expect(showsLegacyKyc(status, false)).toBe(true);
      expect(showsLegacyKyc(status, true)).toBe(false);
    }
  });

  it('ignores an earlier "leave" once the old credential is issued or being issued', () => {
    for (const status of credentialDue) {
      expect(showsLegacyKyc(status, false)).toBe(true);
      expect(showsLegacyKyc(status, true)).toBe(true);
    }
  });

  it('never shows an old check that is not in flight', () => {
    for (const status of notInFlight) {
      expect(showsLegacyKyc(status, false)).toBe(false);
      expect(showsLegacyKyc(status, true)).toBe(false);
    }
  });
});

describe('resolveKycCardView', () => {
  const base = { kycStatus: 'none', legacyInFlight: false, legacyChecked: true, selfEnabled: true } as const;

  it('shows a verified person as verified, whatever else is going on', () => {
    expect(resolveKycCardView({ ...base, kycStatus: 'legacy', legacyInFlight: true })).toBe('verified');
    expect(resolveKycCardView({ ...base, kycStatus: 'self', legacyInFlight: true, selfEnabled: false })).toBe(
      'verified',
    );
    expect(resolveKycCardView({ ...base, kycStatus: 'legacy', legacyChecked: false })).toBe('verified');
  });

  it('waits while either lookup is still running', () => {
    expect(resolveKycCardView({ ...base, kycStatus: 'checking', legacyInFlight: true })).toBe('checking');
    expect(resolveKycCardView({ ...base, legacyChecked: false })).toBe('checking');
  });

  it('keeps the old check for a person midway through one, and never offers Self beside it', () => {
    expect(resolveKycCardView({ ...base, legacyInFlight: true })).toBe('legacy');
    expect(resolveKycCardView({ ...base, kycStatus: 'pending', legacyInFlight: true })).toBe('legacy');
    expect(resolveKycCardView({ ...base, kycStatus: 'unavailable', legacyInFlight: true })).toBe('legacy');
    expect(resolveKycCardView({ ...base, legacyInFlight: true, selfEnabled: false })).toBe('legacy');
  });

  it('offers the Self check to everyone else', () => {
    expect(resolveKycCardView(base)).toBe('start');
    expect(resolveKycCardView({ ...base, kycStatus: 'pending' })).toBe('pending');
    expect(resolveKycCardView({ ...base, kycStatus: 'unavailable' })).toBe('unavailable');
  });

  it('says so when the Self check is not configured', () => {
    expect(resolveKycCardView({ ...base, selfEnabled: false })).toBe('not_available');
    expect(resolveKycCardView({ ...base, kycStatus: 'pending', selfEnabled: false })).toBe('not_available');
  });
});
