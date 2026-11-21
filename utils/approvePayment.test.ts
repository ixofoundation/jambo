import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IDENTITY_LEVEL1_VCT, SELF_ISSUER_DID } from '@constants/self';

const h = vi.hoisted(() => ({ entries: [] as any[] }));

vi.mock('@utils/matrixCredential', () => ({
  readAllCredentialIndexEntries: () => h.entries,
  readAllPiiIndexEntries: () => [],
}));
vi.mock('@utils/matrix', () => ({ withMatrixOpenIdRetry: vi.fn() }));
vi.mock('@ixo/matrixclient-sdk', () => ({ createMatrixClaimBotClient: vi.fn() }));

import {
  buildApprovePaymentPrefill,
  findIdentityLevel1IndexEntry,
  clearRejectedKycCredentials,
  loadKycCredentialJwt,
  noteKycCredentialRejected,
  selectKycCredentialJwt,
  stripPrefilledIdentity,
} from './approvePayment';

const ROOM = '!room:mx.ixo.earth';
const LEGACY_JWT = 'eyLegacy.payload.sig~disc1~disc2~';
const SELF_JWT = 'eySelf.payload.sig~discA~discB~';

/** A matrix client whose room holds the given `ixo.credential` events (already decrypted). */
function client(events: Record<string, unknown>) {
  return {
    getRoom: () => ({
      findEventById: (id: string) =>
        id in events
          ? {
              isEncrypted: () => false,
              isDecryptionFailure: () => false,
              getContent: () => ({ credential: JSON.stringify(events[id]) }),
            }
          : null,
    }),
  } as any;
}

const entry = (over: Record<string, unknown>) => ({
  cid: `sha256:${Math.random()}`,
  storedAt: '2026-11-01T00:00:00.000Z',
  issuerDid: SELF_ISSUER_DID,
  holderDid: 'did:ixo:ixo1holder',
  format: 'dc+sd-jwt',
  ...over,
});
const legacyEntry = entry({
  eventId: '$legacy',
  credentialKey: 'kycamllevel1',
  credentialType: 'https://credentials.ixo.world/types/KYCAMLLevel1',
  issuerDid: 'did:ixo:oracle',
});
const selfEntry = entry({ eventId: '$self', credentialKey: 'identitylevel1', credentialType: IDENTITY_LEVEL1_VCT });
const record = (credential: string, vct: string) => ({
  recordType: 'SdJwtCredentialRecord',
  format: 'dc+sd-jwt',
  credential,
  vct,
  claims: {},
});
const mx = client({
  $legacy: record(LEGACY_JWT, 'https://credentials.ixo.world/types/KYCAMLLevel1'),
  $self: record(SELF_JWT, IDENTITY_LEVEL1_VCT),
  $selfNew: record('eySelfNew.p.s~d~', IDENTITY_LEVEL1_VCT),
});

beforeEach(() => {
  h.entries = [];
});

describe('findIdentityLevel1IndexEntry', () => {
  it('finds the entry under the Hub state key', () => {
    h.entries = [legacyEntry, selfEntry];
    expect(findIdentityLevel1IndexEntry(mx, ROOM)?.eventId).toBe('$self');
  });

  it('falls back to the credential type when the state key differs', () => {
    h.entries = [entry({ eventId: '$self', credentialKey: 'vct-0123abcd', credentialType: IDENTITY_LEVEL1_VCT })];
    expect(findIdentityLevel1IndexEntry(mx, ROOM)?.eventId).toBe('$self');
  });

  it('takes the newest entry, the Self issuer first', () => {
    h.entries = [
      selfEntry,
      entry({ eventId: '$selfNew', credentialKey: 'identitylevel1', storedAt: '2026-11-10T00:00:00.000Z' }),
      entry({
        eventId: '$other',
        credentialKey: 'identitylevel1',
        issuerDid: 'did:ixo:someone-else',
        storedAt: '2026-11-17T00:00:00.000Z',
      }),
    ];
    expect(findIdentityLevel1IndexEntry(mx, ROOM)?.eventId).toBe('$selfNew');
  });

  it('is null when only the legacy credential is indexed', () => {
    h.entries = [legacyEntry];
    expect(findIdentityLevel1IndexEntry(mx, ROOM)).toBeNull();
  });
});

describe('credential JWT for the ramps', () => {
  it('sends the whole Self SD-JWT, disclosures included', async () => {
    h.entries = [selfEntry];
    expect(await loadKycCredentialJwt(mx, ROOM)).toBe(SELF_JWT);
  });

  it('prefers the legacy credential when both are held', async () => {
    h.entries = [selfEntry, legacyEntry];
    expect(await loadKycCredentialJwt(mx, ROOM)).toBe(LEGACY_JWT);
  });

  it('is null with no credential', async () => {
    expect(await loadKycCredentialJwt(mx, ROOM)).toBeNull();
  });
});

describe('which credential the ramps send when the legacy one cannot be used', () => {
  const NOW = Date.parse('2026-11-18T12:00:00.000Z');
  const nowSec = Math.floor(NOW / 1000);
  const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  /** An SD-JWT whose payload carries the given claims (the signature is never checked here). */
  const sdJwt = (payload: Record<string, unknown>) => `${b64url({ alg: 'EdDSA' })}.${b64url(payload)}.sig~disc~`;
  const legacyRecord = (jwt: string) => record(jwt, 'https://credentials.ixo.world/types/KYCAMLLevel1');
  const holding = (legacyJwt: string) =>
    client({ $legacy: legacyRecord(legacyJwt), $self: record(SELF_JWT, IDENTITY_LEVEL1_VCT) });

  it('keeps sending a legacy credential that is still valid, or names no expiry', async () => {
    h.entries = [selfEntry, legacyEntry];
    const valid = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 60 });
    expect(await loadKycCredentialJwt(holding(valid), ROOM, NOW)).toBe(valid);
    const noExpiry = sdJwt({ vct: 'KYCAMLLevel1' });
    expect(await loadKycCredentialJwt(holding(noExpiry), ROOM, NOW)).toBe(noExpiry);
    // Unreadable payload: treated as before.
    expect(await loadKycCredentialJwt(mx, ROOM, NOW)).toBe(LEGACY_JWT);
  });

  it('sends the Self credential once the legacy one has expired', async () => {
    h.entries = [selfEntry, legacyEntry];
    const expired = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec - 1 });
    expect(await loadKycCredentialJwt(holding(expired), ROOM, NOW)).toBe(SELF_JWT);
    expect(await loadKycCredentialJwt(holding(sdJwt({ exp: nowSec })), ROOM, NOW)).toBe(SELF_JWT);
  });

  it('still sends an expired legacy credential when there is no Self one (the verifier explains)', async () => {
    h.entries = [legacyEntry];
    const expired = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec - 1 });
    expect(await loadKycCredentialJwt(holding(expired), ROOM, NOW)).toBe(expired);
  });

  it('sends the Self credential after the verifier refused the legacy one in this session', async () => {
    h.entries = [selfEntry, legacyEntry];
    const refused = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 3600, jti: 'refused' });
    const other = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 3600, jti: 'other' });
    expect(await loadKycCredentialJwt(holding(refused), ROOM, NOW)).toBe(refused);
    await noteKycCredentialRejected(refused);
    await noteKycCredentialRejected(null);
    expect(await loadKycCredentialJwt(holding(refused), ROOM, NOW)).toBe(SELF_JWT);
    // Only that credential: another legacy credential is sent as before.
    expect(await loadKycCredentialJwt(holding(other), ROOM, NOW)).toBe(other);
    // And with no Self credential there is nothing else to send.
    h.entries = [legacyEntry];
    expect(await loadKycCredentialJwt(holding(refused), ROOM, NOW)).toBe(refused);
    clearRejectedKycCredentials();
  });

  it('forgets the refusals on sign-out', async () => {
    h.entries = [selfEntry, legacyEntry];
    const refused = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 3600, jti: 'refused-then-cleared' });
    await noteKycCredentialRejected(refused);
    expect(await loadKycCredentialJwt(holding(refused), ROOM, NOW)).toBe(SELF_JWT);
    clearRejectedKycCredentials();
    expect(await loadKycCredentialJwt(holding(refused), ROOM, NOW)).toBe(refused);
  });

  it('remembers a refused credential by its SHA-256, never the credential itself', async () => {
    const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
    const refused = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 3600, jti: 'hashed' });
    await noteKycCredentialRejected(refused);
    expect(digest).toHaveBeenCalledWith('SHA-256', new TextEncoder().encode(refused));
    digest.mockRestore();
    clearRejectedKycCredentials();
  });

  it('says which credential it chose', async () => {
    h.entries = [selfEntry];
    expect(await selectKycCredentialJwt(mx, ROOM, NOW)).toEqual({ jwt: SELF_JWT, source: 'identitylevel1' });
    h.entries = [selfEntry, legacyEntry];
    const valid = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec + 60 });
    expect(await selectKycCredentialJwt(holding(valid), ROOM, NOW)).toEqual({ jwt: valid, source: 'kycamllevel1' });
    const expired = sdJwt({ vct: 'KYCAMLLevel1', exp: nowSec - 1 });
    expect(await selectKycCredentialJwt(holding(expired), ROOM, NOW)).toEqual({
      jwt: SELF_JWT,
      source: 'identitylevel1',
    });
    // Expired, and no Self credential to send instead: still the legacy one.
    h.entries = [legacyEntry];
    expect(await selectKycCredentialJwt(holding(expired), ROOM, NOW)).toEqual({ jwt: expired, source: 'kycamllevel1' });
  });
});

describe('buildApprovePaymentPrefill', () => {
  const src = { 'org:businessContactNumber': '0825550101', 'schema:countryOfOrigin': 'ng', 'org:bankName': 'GTB' };
  const pii = {
    givenName: 'Sipho',
    familyName: 'Dlamini',
    email: 'sipho@example.com',
    birthDate: '1990-01-02',
    identifier_1: 'P998877',
  };
  const profile = { name: 'Thandi Mokoena', email: 'thandi@example.com', dob: '1994-03-07', idNumber: 'A12345678' };

  it('fills a Self user from the normalised profile', () => {
    expect(buildApprovePaymentPrefill(src, null, profile)).toEqual({
      'schema:name': 'Thandi Mokoena',
      'schema:telephone': '0825550101',
      'schema:email': 'thandi@example.com',
      'schema:birthDate': '1994-03-07',
      'schema:identityNumber': 'A12345678',
      'schema:country': 'NG',
      'umuzi:paymentCurrency': 'NGN',
      'org:bankName': 'GTB',
    });
  });

  it('keeps the legacy output unchanged, with or without a profile', () => {
    const legacy = buildApprovePaymentPrefill(src, pii);
    expect(legacy).toEqual({
      'schema:name': 'Sipho Dlamini',
      'schema:telephone': '0825550101',
      'schema:email': 'sipho@example.com',
      'schema:birthDate': '1990-01-02',
      'schema:identityNumber': 'P998877',
      'schema:country': 'NG',
      'umuzi:paymentCurrency': 'NGN',
      'org:bankName': 'GTB',
    });
    expect(JSON.stringify(buildApprovePaymentPrefill(src, pii, profile))).toBe(JSON.stringify(legacy));
  });
});

describe('stripPrefilledIdentity', () => {
  const prefill = {
    'schema:name': 'Thandi Mokoena',
    'schema:email': 'thandi@example.com',
    'schema:birthDate': '1999-04-02',
    'schema:identityNumber': '9904025800086',
    'schema:country': 'ZA',
  };

  it('keeps the prefilled identity fields out of what is saved to a draft', () => {
    const data = { ...prefill, 'schema:telephone': '+27820000000', notes: 'typed by the user' };
    expect(stripPrefilledIdentity(data, prefill)).toEqual({
      'schema:country': 'ZA',
      'schema:telephone': '+27820000000',
      notes: 'typed by the user',
    });
    // The survey's own data is not touched.
    expect(data['schema:name']).toBe('Thandi Mokoena');
  });

  it('strips an identity field even after the user edited it', () => {
    expect(stripPrefilledIdentity({ 'schema:name': 'Someone Else' }, prefill)).toEqual({});
  });

  it('keeps an identity field the prefill does not supply, so a typed value survives the draft', () => {
    const noEmail = { 'schema:name': 'Thandi Mokoena', 'schema:email': '' };
    expect(
      stripPrefilledIdentity({ 'schema:name': 'Thandi Mokoena', 'schema:email': 'typed@example.com' }, noEmail),
    ).toEqual({ 'schema:email': 'typed@example.com' });
    expect(stripPrefilledIdentity({ 'schema:email': 'typed@example.com' }, null)).toEqual({
      'schema:email': 'typed@example.com',
    });
  });

  it('restores to the same form data once the prefill is merged back in', () => {
    const data = { ...prefill, notes: 'typed by the user' };
    const draft = stripPrefilledIdentity(data, prefill);
    // screens/collectionForm.tsx: `model.data = { ...prefill, ...draftData }`.
    expect({ ...prefill, ...draft }).toEqual(data);
  });

  it('handles empty input', () => {
    expect(stripPrefilledIdentity(null, prefill)).toEqual({});
    expect(stripPrefilledIdentity(undefined, undefined)).toEqual({});
  });
});
