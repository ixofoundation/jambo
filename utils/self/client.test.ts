import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LINK_ID = '0b9f6f4e-2f0f-4b55-9d6c-3d2f3c1a7e10';
const USER_DID = `did:ixo:ixo1${'p'.repeat(38)}`;

const mocks = vi.hoisted(() => ({
  minted: 0,
  timeRefreshes: 0,
  saved: [] as string[],
}));

vi.mock('@constants/self', () => ({ SELF_KYC_ENABLED: true, SELF_WEB_URL: 'https://self.test' }));
vi.mock('@utils/ucanDelegation', () => ({ ensureEd25519OnChain: vi.fn(async () => undefined) }));
vi.mock('./grants', () => ({
  mintSelfLinkDelegation: vi.fn(async () => `link-${++mocks.minted}`),
  mintSelfOfferConsent: vi.fn(async () => `consent-${++mocks.minted}`),
}));
vi.mock('./pendingLink', () => ({
  savePendingSelfLink: vi.fn((_did: string, linkId: string) => {
    mocks.saved.push(linkId);
  }),
}));
vi.mock('./serverTime', () => ({
  serverNowSeconds: vi.fn(async (opts: { refresh?: boolean } = {}) => {
    if (opts.refresh) mocks.timeRefreshes += 1;
    return 0;
  }),
}));

import { createSelfLink, getSelfLinkStatus } from './client';

const CLOCK_SKEW = { outcome: 'error', code: 'clock_skew', message: 'Your device clock is off.' };
const created = { outcome: 'created', linkId: LINK_ID, url: 'https://self.test/l/token', expiresAt: 'soon' };

let bodies: Record<string, unknown>[];

/** Jambo's route, answering in turn. */
function route(answers: { status: number; body: unknown }[]) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const answer = answers[Math.min(bodies.length, answers.length) - 1];
    return new Response(JSON.stringify(answer.body), { status: answer.status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const args = { userDid: USER_DID, address: 'ixo1p', onSign: async () => undefined };

beforeEach(() => {
  bodies = [];
  mocks.minted = 0;
  mocks.timeRefreshes = 0;
  mocks.saved.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSelfLink and a clock that is off', () => {
  it('re-reads the time and tries once more with newly signed delegations', async () => {
    const fetchMock = route([
      { status: 400, body: CLOCK_SKEW },
      { status: 200, body: created },
    ]);

    expect(await createSelfLink(args)).toMatchObject({ outcome: 'created', linkId: LINK_ID });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.timeRefreshes).toBe(1);
    // Nothing signed for the first try is sent again; the nonce names the same request.
    expect(bodies[1].linkDelegation).not.toBe(bodies[0].linkDelegation);
    expect(bodies[1].offerConsent).not.toBe(bodies[0].offerConsent);
    expect(bodies[1].nonce).toBe(bodies[0].nonce);
    expect(mocks.saved).toEqual([LINK_ID]);
  });

  it('gives the error back when the second try is refused too', async () => {
    const fetchMock = route([{ status: 400, body: CLOCK_SKEW }]);
    expect(await createSelfLink(args)).toEqual(CLOCK_SKEW);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.timeRefreshes).toBe(1);
  });

  it('does not try again for any other answer', async () => {
    for (const body of [
      created,
      { outcome: 'already_verified' },
      { outcome: 'link_active' },
      { outcome: 'error', code: 'bad_request', message: 'no' },
      { outcome: 'error', code: 'unavailable', message: 'no' },
    ]) {
      bodies = [];
      const fetchMock = route([{ status: 200, body }]);
      await createSelfLink(args);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
    expect(mocks.timeRefreshes).toBe(0);
  });
});

describe('getSelfLinkStatus and a clock that is off', () => {
  it('re-reads the time and tries once more with a newly signed delegation', async () => {
    const status = { outcome: 'status', linkId: LINK_ID, status: 'opened' };
    const fetchMock = route([
      { status: 400, body: CLOCK_SKEW },
      { status: 200, body: status },
    ]);

    expect(await getSelfLinkStatus({ userDid: USER_DID, linkId: LINK_ID })).toEqual(status);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.timeRefreshes).toBe(1);
    expect(bodies[1].linkDelegation).not.toBe(bodies[0].linkDelegation);
  });

  it('gives the error back when the second try is refused too', async () => {
    const fetchMock = route([{ status: 400, body: CLOCK_SKEW }]);
    expect(await getSelfLinkStatus({ userDid: USER_DID, linkId: LINK_ID })).toEqual(CLOCK_SKEW);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes on a start refused for the daily limit', async () => {
    const status = {
      outcome: 'status',
      linkId: LINK_ID,
      status: 'opened',
      limit: { code: 'daily_limit', resetsAt: '2026-11-18T16:00:00.000Z' },
    };
    route([{ status: 200, body: status }]);
    expect(await getSelfLinkStatus({ userDid: USER_DID, linkId: LINK_ID })).toEqual(status);
  });
});
