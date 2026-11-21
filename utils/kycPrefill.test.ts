import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  legacyIndex: null as { eventId: string } | null,
  selfIndex: null as { eventId: string } | null,
  loadKycLevel1Credential: vi.fn(),
  loadKycPii: vi.fn(),
  loadSelfClaims: vi.fn(),
  session: {} as Record<string, string | undefined>,
}));

vi.mock('@utils/approvePayment', () => ({
  findKycLevel1IndexEntry: () => h.legacyIndex,
  findIdentityLevel1IndexEntry: () => h.selfIndex,
  loadKycLevel1Credential: h.loadKycLevel1Credential,
  loadKycPii: h.loadKycPii,
}));
vi.mock('@utils/kyc/hubCredentials', () => ({ loadSelfClaims: h.loadSelfClaims }));
vi.mock('@utils/storage', () => ({ secureLoad: (key: string) => h.session[key] }));

import { loadApprovePaymentIdentity, loadKycPrefill, waitForKycCredentialSource } from './kycPrefill';

const mx = {} as any;
const ROOM = '!room:mx.ixo.earth';
const DID = 'did:ixo:ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';

const SELF_CLAIMS = {
  given_name: 'Thandi',
  family_name: 'Mokoena',
  full_name: 'Thandi Nomsa Mokoena',
  birth_date: '1994-03-07',
  nationality: 'ZAF',
  issuing_country: 'ZAF',
  document_type: 'national_identity_card',
  document_number: 'A12345678',
  personal_number: '9403070123085',
  gender: 'F',
};

const LEGACY_CREDENTIAL = {
  recordType: 'SdJwtCredentialRecord',
  claims: {
    given_name: { value: 'Sipho', sd: 'allowed' },
    family_name: { value: 'Dlamini', sd: 'allowed' },
    birth_date: { value: '1990-01-02', sd: 'allowed' },
    nationality: { value: 'ZA', sd: 'allowed' },
    document_type: { value: 'passport', sd: 'allowed' },
  },
};
const LEGACY_PII = { identifier_1: 'P998877', email: 'sipho@example.com', phone_number: '+27 82 555 0101' };

beforeEach(() => {
  h.legacyIndex = null;
  h.selfIndex = null;
  h.session = {};
  h.loadKycLevel1Credential.mockReset().mockResolvedValue(null);
  h.loadKycPii.mockReset().mockResolvedValue(null);
  h.loadSelfClaims.mockReset().mockResolvedValue(null);
});

describe('loadKycPrefill — legacy user', () => {
  beforeEach(() => {
    h.legacyIndex = { eventId: '$legacy' };
    h.loadKycLevel1Credential.mockResolvedValue({ eventId: '$legacy', credential: LEGACY_CREDENTIAL });
    h.loadKycPii.mockResolvedValue({ eventId: '$pii', pii: LEGACY_PII });
  });

  it('returns the legacy profile and never calls the Hub', async () => {
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const out = await loadKycPrefill(mx, ROOM, { userDid: DID, email: 'session@example.com' });
    expect(out).toEqual({
      name: 'Sipho Dlamini',
      dob: '1990-01-02',
      country: 'ZA',
      idType: 'passport',
      idNumber: 'P998877',
      email: 'sipho@example.com',
      phone: '27825550101',
    });
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('does not fall back to the Hub when the legacy credential cannot be opened', async () => {
    h.loadKycLevel1Credential.mockRejectedValue(new Error('KYC credential could not be decrypted on this device'));
    h.loadKycPii.mockResolvedValue(null);
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID })).toEqual({});
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('does not fill a missing legacy email from the session', async () => {
    h.loadKycPii.mockResolvedValue({ eventId: '$pii', pii: { identifier_1: 'P998877' } });
    const out = await loadKycPrefill(mx, ROOM, { userDid: DID, email: 'session@example.com' });
    expect(out.email).toBeUndefined();
  });
});

describe('loadKycPrefill — Self user', () => {
  it('maps the IdentityLevel1 claims and the session email', async () => {
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const out = await loadKycPrefill(mx, ROOM, { userDid: DID, email: 'thandi@example.com' });
    expect(h.loadSelfClaims).toHaveBeenCalledWith(DID);
    expect(out).toEqual({
      name: 'Thandi Mokoena',
      dob: '1994-03-07',
      country: 'ZA',
      idType: 'national_id',
      idNumber: 'A12345678',
      email: 'thandi@example.com',
    });
    // The credential has no phone: the user types it.
    expect(out.phone).toBeUndefined();
  });

  it('falls back: full_name, issuing_country, personal_number', async () => {
    h.loadSelfClaims.mockResolvedValue({
      full_name: 'Thandi Nomsa Mokoena',
      birth_date: '1994-03-07',
      nationality: 'XXX',
      issuing_country: 'nga',
      document_type: 'passport',
      personal_number: '9403070123085',
    });
    const out = await loadKycPrefill(mx, ROOM, { userDid: DID });
    expect(out).toEqual({
      name: 'Thandi Nomsa Mokoena',
      dob: '1994-03-07',
      country: 'NG',
      idType: 'passport',
      idNumber: '9403070123085',
    });
  });

  it('leaves out a country or document type it cannot map', async () => {
    h.loadSelfClaims.mockResolvedValue({
      given_name: 'A',
      family_name: 'B',
      nationality: 'XXX',
      document_type: 'visa',
    });
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID })).toEqual({ name: 'A B' });
  });

  it('accepts claims in the record form { value }', async () => {
    h.loadSelfClaims.mockResolvedValue({
      given_name: { value: 'Thandi', sd: 'allowed' },
      family_name: { value: 'Mokoena', sd: 'allowed' },
      nationality: { value: 'KEN', sd: 'allowed' },
    });
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID })).toEqual({ name: 'Thandi Mokoena', country: 'KE' });
  });

  it('reads the DID and email from the stored session when not passed', async () => {
    h.session = { auth_ixo_did: DID, auth_ixo_email: 'stored@example.com' };
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const out = await loadKycPrefill(mx, ROOM);
    expect(h.loadSelfClaims).toHaveBeenCalledWith(DID);
    expect(out.email).toBe('stored@example.com');
    expect(out.country).toBe('ZA');
  });

  it('gives no prefill when the Hub fails, the person holds no credential, or no DID is known', async () => {
    h.loadSelfClaims.mockRejectedValue(Object.assign(new Error('hub down'), { code: 'unavailable' }));
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID, email: 'thandi@example.com' })).toEqual({});

    h.loadSelfClaims.mockReset().mockResolvedValue(null);
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID, email: 'thandi@example.com' })).toEqual({});

    h.loadSelfClaims.mockReset().mockResolvedValue(SELF_CLAIMS);
    expect(await loadKycPrefill(mx, ROOM)).toEqual({});
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('never calls the Hub with `skipHub`', async () => {
    h.selfIndex = { eventId: '$self' };
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID }, { skipHub: true })).toEqual({});
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('`skipHub` changes nothing for a legacy user', async () => {
    h.legacyIndex = { eventId: '$legacy' };
    h.loadKycLevel1Credential.mockResolvedValue({ eventId: '$legacy', credential: LEGACY_CREDENTIAL });
    h.loadKycPii.mockResolvedValue({ eventId: '$pii', pii: LEGACY_PII });
    const withHub = await loadKycPrefill(mx, ROOM, { userDid: DID });
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID }, { skipHub: true })).toEqual(withHub);
    expect(withHub.country).toBe('ZA');
  });
});

describe('credential source in the matrix index', () => {
  it('prefers the legacy credential, then the Self one', async () => {
    const now = { timeoutMs: 0 };
    expect(await waitForKycCredentialSource(mx, ROOM, now)).toBeNull();
    h.selfIndex = { eventId: '$self' };
    expect(await waitForKycCredentialSource(mx, ROOM, now)).toBe('identitylevel1');
    h.legacyIndex = { eventId: '$legacy' };
    expect(await waitForKycCredentialSource(mx, ROOM, now)).toBe('kycamllevel1');
  });

  it('waits for the index to sync, and gives up after the window', async () => {
    setTimeout(() => (h.selfIndex = { eventId: '$self' }), 15);
    expect(await waitForKycCredentialSource(mx, ROOM, { timeoutMs: 500, pollIntervalMs: 5 })).toBe('identitylevel1');
    h.selfIndex = null;
    expect(await waitForKycCredentialSource(mx, ROOM, { timeoutMs: 20, pollIntervalMs: 5 })).toBeNull();
  });
});

describe('loadKycPrefill — a legacy user presenting the Self credential', () => {
  beforeEach(() => {
    h.legacyIndex = { eventId: '$legacy' };
    h.selfIndex = { eventId: '$self' };
    h.loadKycLevel1Credential.mockResolvedValue({ eventId: '$legacy', credential: LEGACY_CREDENTIAL });
    h.loadKycPii.mockResolvedValue({ eventId: '$pii', pii: LEGACY_PII });
  });

  it('fills the form from the Self claims only, never the legacy records', async () => {
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const out = await loadKycPrefill(
      mx,
      ROOM,
      { userDid: DID, email: 'thandi@example.com' },
      { source: 'identitylevel1' },
    );
    expect(out.name).toBe('Thandi Mokoena');
    expect(out.dob).toBe('1994-03-07');
    expect(out.email).toBe('thandi@example.com');
    // The Self credential has no phone, and the legacy one is not mixed in.
    expect(out.phone).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('Sipho');
    expect(h.loadKycLevel1Credential).not.toHaveBeenCalled();
    expect(h.loadKycPii).not.toHaveBeenCalled();
  });

  it('fills nothing (so nothing is locked) when the Hub cannot answer', async () => {
    h.loadSelfClaims.mockRejectedValue(new Error('hub down'));
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID }, { source: 'identitylevel1' })).toEqual({});
    h.loadSelfClaims.mockReset().mockResolvedValue(null);
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID }, { source: 'identitylevel1' })).toEqual({});
  });

  it('is the legacy prefill, as before, when the legacy credential is the one presented', async () => {
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const before = await loadKycPrefill(mx, ROOM, { userDid: DID });
    expect(await loadKycPrefill(mx, ROOM, { userDid: DID }, { source: 'kycamllevel1' })).toEqual(before);
    expect(before.name).toBe('Sipho Dlamini');
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });
});

describe('loadApprovePaymentIdentity', () => {
  it('uses the legacy PII blob as is, without the Hub', async () => {
    h.legacyIndex = { eventId: '$legacy' };
    h.loadKycPii.mockResolvedValue({ eventId: '$pii', pii: LEGACY_PII });
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({ pii: LEGACY_PII, profile: null });
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('gives a Self user the normalised profile', async () => {
    h.loadSelfClaims.mockResolvedValue(SELF_CLAIMS);
    const out = await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID, email: 'thandi@example.com' });
    expect(out?.pii).toBeNull();
    expect(out?.profile).toMatchObject({ name: 'Thandi Mokoena', dob: '1994-03-07', idNumber: 'A12345678' });
  });

  it('is null only for a person who holds no credential', async () => {
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toBeNull();
  });

  it('is "details not available", not "not verified", when the Hub cannot be asked and the Vault has no copy', async () => {
    h.loadSelfClaims.mockRejectedValue(new Error('hub down'));
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({ pii: null, profile: null });
  });

  it('lets a legacy credential saved without its PII through on the credential’s name and birth date', async () => {
    h.legacyIndex = { eventId: '$legacy' };
    h.loadKycLevel1Credential.mockResolvedValue({ eventId: '$legacy', credential: LEGACY_CREDENTIAL });
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({
      pii: null,
      profile: { name: 'Sipho Dlamini', dob: '1990-01-02', country: 'ZA', idType: 'passport' },
    });
    expect(h.loadSelfClaims).not.toHaveBeenCalled();
  });

  it('says "verified, details not available" when a held credential yields no identity', async () => {
    // Legacy credential that can't be opened here, or without a name and birth date.
    h.legacyIndex = { eventId: '$legacy' };
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({ pii: null, profile: null });
    h.loadKycLevel1Credential.mockResolvedValue({
      eventId: '$legacy',
      credential: { claims: { given_name: { value: 'Sipho' }, family_name: { value: 'Dlamini' } } },
    });
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({ pii: null, profile: null });
    expect(h.loadSelfClaims).not.toHaveBeenCalled();

    // Self credential in the Vault, Auth Hub unreachable.
    h.legacyIndex = null;
    h.loadKycLevel1Credential.mockResolvedValue(null);
    h.selfIndex = { eventId: '$self' };
    h.loadSelfClaims.mockRejectedValue(new Error('hub down'));
    expect(await loadApprovePaymentIdentity(mx, ROOM, { userDid: DID })).toEqual({ pii: null, profile: null });
  });
});
