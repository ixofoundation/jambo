import { describe, expect, it } from 'vitest';

import { removePersistedIdentityDrafts } from './migrations';

const draft = (surveyMode: string, surveyData: unknown) => ({
  surveyMode,
  surveyTemplate: '{}',
  surveyData,
  updatedAt: 1,
});

describe('removePersistedIdentityDrafts (persist v5)', () => {
  it('deletes every draft of the old KYC form', () => {
    const state = {
      kyc: { byProtocolId: {} },
      claimDrafts: {
        byCollectionId: {
          '12': draft('kyc', { givenName: 'Sipho', identifier_1: 'P998877', streetAddress: '1 Main Rd' }),
          '13': draft('claim', { 'schema:telephone': '0825550101' }),
        },
      },
    };
    const out = removePersistedIdentityDrafts(state);
    expect(Object.keys(out.claimDrafts.byCollectionId)).toEqual(['13']);
    expect(out.kyc).toBe(state.kyc);
    expect(JSON.stringify(out)).not.toContain('Sipho');
    // The input is not changed.
    expect(state.claimDrafts.byCollectionId['12']).toBeDefined();
  });

  it('removes the identity fields from the approve-payment draft only, and keeps the rest', () => {
    const identity = {
      'schema:name': 'Sipho Dlamini',
      'schema:email': 'sipho@example.com',
      'schema:birthDate': '1990-01-02',
      'schema:identityNumber': 'P998877',
    };
    const out = removePersistedIdentityDrafts(
      {
        claimDrafts: {
          byCollectionId: {
            '20': draft('claim', { ...identity, 'schema:telephone': '0825550101', 'org:bankName': 'GTB' }),
            '21': draft('bco', { motivation: 'I can help' }),
            // Another form that happens to use the same field names: not ours to empty.
            '22': draft('claim', { ...identity, 'schema:telephone': '0825550102' }),
          },
        },
      },
      (collectionId) => collectionId === '20',
    );
    expect(out.claimDrafts.byCollectionId['20'].surveyData).toEqual({
      'schema:telephone': '0825550101',
      'org:bankName': 'GTB',
    });
    expect(out.claimDrafts.byCollectionId['20'].updatedAt).toBe(1);
    expect(out.claimDrafts.byCollectionId['21'].surveyData).toEqual({ motivation: 'I can help' });
    expect(out.claimDrafts.byCollectionId['22'].surveyData).toEqual({ ...identity, 'schema:telephone': '0825550102' });
  });

  it('strips nothing when no approve-payment collection is configured (the default here)', () => {
    const data = { 'schema:name': 'Sipho Dlamini', 'schema:telephone': '0825550101' };
    const out = removePersistedIdentityDrafts({
      claimDrafts: { byCollectionId: { '20': draft('claim', data), '12': draft('kyc', { givenName: 'Sipho' }) } },
    });
    expect(out.claimDrafts.byCollectionId).toEqual({ '20': draft('claim', data) });
  });

  it('leaves missing or odd shapes alone', () => {
    expect(removePersistedIdentityDrafts(undefined)).toBeUndefined();
    expect(removePersistedIdentityDrafts(null)).toBeNull();
    const noDrafts = { kyc: {} };
    expect(removePersistedIdentityDrafts(noDrafts)).toBe(noDrafts);
    const odd = { claimDrafts: { byCollectionId: ['x'] } };
    expect(removePersistedIdentityDrafts(odd)).toBe(odd);

    const out = removePersistedIdentityDrafts(
      {
        claimDrafts: { byCollectionId: { a: null, b: draft('claim', null), c: draft('claim', 'text'), d: 'junk' } },
      },
      () => true,
    );
    expect(out.claimDrafts.byCollectionId).toEqual({
      a: null,
      b: draft('claim', null),
      c: draft('claim', 'text'),
      d: 'junk',
    });
  });
});
