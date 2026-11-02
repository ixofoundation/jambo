import { describe, expect, it } from 'vitest';

import { CLAIM_VIEW_MESSAGES, claimViewFallback } from './claimViewError';

describe('claimViewFallback', () => {
  it.each(['IXO_FORBIDDEN', 'IXO_UNAUTHORIZED', 'M_FORBIDDEN', 'ixo_forbidden'])('treats %s as no access', (errcode) => {
    expect(claimViewFallback({ errcode })).toBe('no-access');
  });

  it.each(['IXO_CLAIM_NOT_FOUND', 'IXO_ROOM_NOT_FOUND', 'IXO_COLLECTION_NOT_FOUND', 'M_NOT_FOUND'])(
    'treats %s as a claim with no stored form',
    (errcode) => {
      expect(claimViewFallback({ errcode })).toBe('not-stored');
    },
  );

  it('treats a protocol with no form as no stored form', () => {
    expect(claimViewFallback(new Error('Claim form not found'))).toBe('not-stored');
  });

  it.each([[new Error('Failed to fetch')], [{ errcode: 'IXO_UNKNOWN' }], [undefined], [null]])(
    'never calls an outage a missing form: %s',
    (error) => {
      expect(claimViewFallback(error)).toBe('unavailable');
    },
  );

  it('has a friendly message for every state, and only one mentions on-chain', () => {
    expect(CLAIM_VIEW_MESSAGES['no-access'].body).not.toMatch(/on-chain/);
    expect(CLAIM_VIEW_MESSAGES.unavailable.body).not.toMatch(/on-chain/);
    expect(CLAIM_VIEW_MESSAGES['not-stored'].body).toMatch(/on-chain/);
  });
});
