import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HUB = 'https://hub.test';
const HUB_DID = 'did:web:hub.test';
const USER_DID = 'did:ixo:ixo1user';
const VCT = 'https://credentials.ixo.world/types/IdentityLevel1';
const ISSUER = 'did:ixo:entity:self-issuer';

const mocks = vi.hoisted(() => ({
  mnemonic: ' word word word ' as string | undefined,
  invocations: [] as any[],
  /** true = the real @ixo/ucan signs (one test builds a real token and parses it). */
  realUcan: false,
  /** Seconds the server's clock is ahead of this one (utils/self/serverTime.ts). */
  serverAheadSeconds: 0,
  /** What a refresh of the server's time finds. */
  serverAheadAfterRefresh: null as number | null,
  timeRefreshes: 0,
}));

vi.mock('lib/authHub/config', () => ({ AUTH_HUB_URL: 'https://hub.test/' }));
vi.mock('@constants/auth', () => ({ default: { secretKey: { ED_SIGNING_MNEMONIC: 'ed' } } }));
vi.mock('@constants/self', () => ({
  HUB_CREDENTIALS_ABILITY: 'auth/user/credentials',
  IDENTITY_LEVEL1_VCT: 'https://credentials.ixo.world/types/IdentityLevel1',
  SELF_ISSUER_DID: 'did:ixo:entity:self-issuer',
}));
vi.mock('@utils/storage', () => ({ secureLoad: () => mocks.mnemonic }));
vi.mock('@utils/self/serverTime', () => ({
  serverNowSeconds: vi.fn(async (opts: { refresh?: boolean } = {}) => {
    if (opts.refresh) {
      mocks.timeRefreshes += 1;
      if (mocks.serverAheadAfterRefresh !== null) mocks.serverAheadSeconds = mocks.serverAheadAfterRefresh;
    }
    return Math.floor(Date.now() / 1000) + mocks.serverAheadSeconds;
  }),
}));
vi.mock('@ixo/ucan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ixo/ucan')>();
  return {
    signerFromMnemonic: vi.fn(async (mnemonic: string, did: any) =>
      mocks.realUcan ? actual.signerFromMnemonic(mnemonic, did) : { signer: { mnemonic, did } },
    ),
    createInvocation: vi.fn(async (options: any) => {
      mocks.invocations.push(options);
      return mocks.realUcan ? actual.createInvocation(options) : options;
    }),
    serializeInvocation: vi.fn(async (invocation: any) =>
      mocks.realUcan ? actual.serializeInvocation(invocation) : `token-${mocks.invocations.length}`,
    ),
  };
});

import {
  HubCredentialsError,
  clearHubCredentialCache,
  findSelfCredential,
  getHubCredentialClaims,
  listHubCredentials,
  loadSelfClaims,
} from './hubCredentials';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const row = (over: Record<string, unknown> = {}) => ({
  id: 'cred_1',
  vct: VCT,
  name: 'Identity Level 1',
  issuer: { did: ISSUER, mark: {} },
  storedAt: 100,
  expiresAt: null,
  verified: true,
  card: {},
  ...over,
});

const item = (over: Record<string, unknown> = {}) => ({
  ...row(),
  revoked: false,
  issuedAt: 90,
  claims: [
    { name: 'given_name', label: 'Given name', value: 'Ada', kind: 'text' },
    { name: 'birth_date', label: 'Date of birth', value: '1990-01-02', kind: 'date' },
  ],
  shares: { count: 0, recent: [] },
  ...over,
});

type Route = (url: URL, init?: RequestInit) => Response;
let calls: { url: URL; init?: RequestInit }[];

/** Routes by pathname; the DID document is always served. */
function serve(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === '/.well-known/did.json') return json({ id: HUB_DID });
    calls.push({ url, init });
    const route = routes[url.pathname];
    return route ? route(url, init) : json({ error: 'not_found' }, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (err) => (err instanceof HubCredentialsError ? err.code : `other: ${err}`),
  );

beforeEach(() => {
  calls = [];
  mocks.mnemonic = ' word word word ';
  mocks.invocations.length = 0;
  mocks.realUcan = false;
  mocks.serverAheadSeconds = 0;
  mocks.serverAheadAfterRefresh = null;
  mocks.timeRefreshes = 0;
  clearHubCredentialCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the request', () => {
  it('signs a short self-issued invocation bound to the method and path, and sends only Authorization', async () => {
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials: [row()] }) });
    const before = Math.floor(Date.now() / 1000);

    await listHubCredentials(USER_DID);

    const [invocation] = mocks.invocations;
    expect(invocation.issuer).toEqual({ mnemonic: 'word word word', did: USER_DID });
    expect(invocation.audience).toBe(HUB_DID);
    expect(invocation.capability).toEqual({ can: 'auth/user/credentials', with: 'ixo:auth-hub:user:ixo1user' });
    expect(invocation.proofs).toBeUndefined();
    expect(invocation.expiration - before).toBeGreaterThan(0);
    expect(invocation.expiration - before).toBeLessThanOrEqual(300);
    expect(invocation.facts[0]).toEqual({ method: 'GET', path: '/api/credentials/overview' });
    expect(typeof invocation.facts[1].nonce).toBe('string');

    expect(calls[0].url.href).toBe(`${HUB}/api/credentials/overview`);
    expect(calls[0].init?.headers).toEqual({ Authorization: 'Bearer token-1' });
  });

  it('builds a real token the Hub accepts: issuer, audience, capability, lifetime and the bound call', async () => {
    const { UcantoServer } = await vi.importActual<typeof import('@ixo/ucan')>('@ixo/ucan');
    const did = `did:ixo:ixo1${'u'.repeat(38)}`;
    mocks.realUcan = true;
    mocks.mnemonic = ' test test test test test test test test test test test junk ';
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials: [] }) });
    const before = Math.floor(Date.now() / 1000);

    await listHubCredentials(did);

    const header = (calls[0].init?.headers as Record<string, string>).Authorization;
    expect(header).toMatch(/^Bearer [A-Za-z0-9+/]+={0,2}$/);
    // Read as the Hub reads it (`parseDelegation`: the CAR's root, an invocation is a delegation).
    const extracted = await UcantoServer.Delegation.extract(
      new Uint8Array(Buffer.from(header.replace(/^Bearer /, ''), 'base64')),
    );
    if (!extracted.ok) throw new Error('not a UCAN');
    const token = extracted.ok;
    expect(token.issuer.did()).toBe(did);
    expect(token.audience.did()).toBe(HUB_DID);
    expect(token.proofs).toHaveLength(0);
    expect(token.capabilities.map((c) => ({ can: String(c.can), with: String(c.with) }))).toEqual([
      { can: 'auth/user/credentials', with: `ixo:auth-hub:user:ixo1${'u'.repeat(38)}` },
    ]);
    // The Hub: `expiration > now` and `expiration <= now + 300`.
    expect(token.expiration).toBeGreaterThan(before);
    expect(token.expiration).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 300);
    const facts = token.facts as Record<string, unknown>[];
    expect(facts.filter((f) => typeof f.method === 'string' || typeof f.path === 'string')).toEqual([
      { method: 'GET', path: '/api/credentials/overview' },
    ]);
    expect(facts.some((f) => typeof f.nonce === 'string')).toBe(true);
  });

  it("counts the token's expiry from the server's time, not this device's", async () => {
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials: [] }) });
    // This device's clock is 20 minutes behind the server's.
    mocks.serverAheadSeconds = 20 * 60;
    const device = Math.floor(Date.now() / 1000);

    await listHubCredentials(USER_DID);

    const left = mocks.invocations[0].expiration - (device + 20 * 60);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(300);
  });

  it('after a 401, reads the time again and retries once only when the clock had moved', async () => {
    let refused = 1;
    serve({
      '/api/credentials/overview': () =>
        refused-- > 0 ? json({ error: 'unauthorized' }, 401) : json({ vault: 'ok', credentials: [row()] }),
    });
    mocks.serverAheadAfterRefresh = 600;
    expect(await listHubCredentials(USER_DID)).toHaveLength(1);
    expect(calls).toHaveLength(2);
    expect(mocks.invocations).toHaveLength(2);
    expect(mocks.invocations[1].expiration - mocks.invocations[0].expiration).toBeGreaterThanOrEqual(600);

    // The clock was right all along: the refusal stands, and nothing is sent again.
    calls.length = 0;
    refused = 5;
    mocks.serverAheadAfterRefresh = null;
    expect(await code(listHubCredentials(USER_DID))).toBe('unauthorized');
    expect(calls).toHaveLength(1);
    expect(mocks.timeRefreshes).toBe(2);
  });

  it('keeps the query out of the bound path and mints a new token per call', async () => {
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials: [] }) });

    await findSelfCredential(USER_DID, { force: true });
    await findSelfCredential(USER_DID);

    expect(calls[0].url.search).toBe('?sync=1');
    expect(calls[1].url.search).toBe('');
    expect(mocks.invocations.map((i) => i.facts[0].path)).toEqual([
      '/api/credentials/overview',
      '/api/credentials/overview',
    ]);
    expect(mocks.invocations[0].facts[1].nonce).not.toBe(mocks.invocations[1].facts[1].nonce);
  });

  it('does not call the Hub without a signing mnemonic', async () => {
    const fetchMock = serve({});
    mocks.mnemonic = undefined;

    expect(await code(listHubCredentials(USER_DID))).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'unavailable'],
    [429, 'unavailable'],
    [503, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, expected) => {
    serve({ '/api/credentials/overview': () => json({ error: 'x', message: 'y' }, status) });
    expect(await code(listHubCredentials(USER_DID))).toBe(expected);
  });

  it('maps a network failure to unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(await code(listHubCredentials(USER_DID))).toBe('unavailable');
  });

  it.each([
    ['no credentials array', { vault: 'ok' }],
    ['a row without an issuer DID', { credentials: [row({ issuer: {} })] }],
    ['a row without verified', { credentials: [row({ verified: undefined })] }],
    ['a row with a bad id', { credentials: [row({ id: '../x' })] }],
    ['not an object', [1]],
  ])('maps %s to malformed', async (_name, body) => {
    serve({ '/api/credentials/overview': () => json(body) });
    expect(await code(listHubCredentials(USER_DID))).toBe('malformed');
  });

  it('refuses an id that is not a credential id without calling the Hub', async () => {
    const fetchMock = serve({});
    expect(await code(getHubCredentialClaims(USER_DID, 'a/../b'))).toBe('malformed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('listHubCredentials', () => {
  it('maps the overview rows', async () => {
    serve({
      '/api/credentials/overview': () =>
        json({ vault: 'ok', credentials: [row({ expiresAt: 500, revoked: true }), row({ id: 'cred_2' })] }),
    });

    expect(await listHubCredentials(USER_DID)).toEqual([
      { id: 'cred_1', type: VCT, issuerDid: ISSUER, verified: true, expiresAt: 500, revoked: true },
      { id: 'cred_2', type: VCT, issuerDid: ISSUER, verified: true, expiresAt: null, revoked: null },
    ]);
  });
});

describe('findSelfCredential', () => {
  const overview = (credentials: unknown[], vault = 'ok') =>
    serve({ '/api/credentials/overview': () => json({ vault, credentials }) });

  it('picks the newest valid Self credential', async () => {
    const now = Math.floor(Date.now() / 1000);
    overview([
      row({ id: 'old', storedAt: 1 }),
      row({ id: 'newest', storedAt: 9, expiresAt: now + 3600 }),
      row({ id: 'revoked', storedAt: 20, revoked: true }),
      row({ id: 'expired', storedAt: 21, expiresAt: now - 1 }),
      row({ id: 'other-issuer', storedAt: 22, issuer: { did: 'did:ixo:entity:other' } }),
      row({ id: 'other-type', storedAt: 23, vct: 'https://credentials.ixo.world/types/KYCAMLLevel1' }),
      row({ id: 'failed', storedAt: 24, verified: false }),
    ]);

    expect((await findSelfCredential(USER_DID))?.id).toBe('newest');
  });

  it('answers null when the wallet was read and holds none', async () => {
    overview([row({ verified: false })]);
    expect(await findSelfCredential(USER_DID)).toBeNull();
  });

  it('is unavailable, not null, when the wallet could not be read', async () => {
    overview([], 'unavailable');
    expect(await code(findSelfCredential(USER_DID))).toBe('unavailable');
  });

  it('opens a credential the Hub has not checked yet, so the Hub checks it', async () => {
    serve({
      '/api/credentials/overview': () => json({ vault: 'ok', credentials: [row({ verified: false, checking: true })] }),
      '/api/credentials/items/cred_1': () => json(item()),
    });

    expect(await findSelfCredential(USER_DID)).toEqual({
      id: 'cred_1',
      type: VCT,
      issuerDid: ISSUER,
      verified: true,
      expiresAt: null,
      revoked: false,
    });
    expect(mocks.invocations[1].facts[0]).toEqual({ method: 'GET', path: '/api/credentials/items/cred_1' });
  });

  it('answers null when that check finds it revoked, and unavailable when it still could not run', async () => {
    let answer = item({ revoked: true });
    serve({
      '/api/credentials/overview': () => json({ vault: 'ok', credentials: [row({ verified: false, checking: true })] }),
      '/api/credentials/items/cred_1': () => json(answer),
    });

    expect(await findSelfCredential(USER_DID)).toBeNull();
    answer = item({ verified: false, checking: true, revoked: null });
    expect(await code(findSelfCredential(USER_DID))).toBe('unavailable');
  });

  it('remembers a hit for a few minutes, never a miss, and force skips the memory', async () => {
    vi.useFakeTimers();
    let credentials: unknown[] = [];
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials }) });

    expect(await findSelfCredential(USER_DID)).toBeNull();
    credentials = [row()];
    expect((await findSelfCredential(USER_DID))?.id).toBe('cred_1');
    expect(calls).toHaveLength(2);

    await findSelfCredential(USER_DID);
    expect(calls).toHaveLength(2);
    await findSelfCredential(USER_DID, { force: true });
    expect(calls).toHaveLength(3);

    vi.advanceTimersByTime(10 * 60 * 1000);
    await findSelfCredential(USER_DID);
    expect(calls).toHaveLength(4);
  });
});

describe('claims', () => {
  const hub = () =>
    serve({
      '/api/credentials/overview': () => json({ vault: 'ok', credentials: [row()] }),
      '/api/credentials/items/cred_1': () => json(item()),
    });

  it('keys the claims by name', async () => {
    hub();
    expect(await getHubCredentialClaims(USER_DID, 'cred_1')).toEqual({ given_name: 'Ada', birth_date: '1990-01-02' });
  });

  it('maps an item without a claims list to malformed', async () => {
    serve({ '/api/credentials/items/cred_1': () => json(item({ claims: undefined })) });
    expect(await code(getHubCredentialClaims(USER_DID, 'cred_1'))).toBe('malformed');
  });

  it('loadSelfClaims finds the credential, reads it once, and forgets on clear', async () => {
    hub();

    expect(await loadSelfClaims(USER_DID)).toEqual({ given_name: 'Ada', birth_date: '1990-01-02' });
    expect(calls.map((c) => c.url.pathname)).toEqual(['/api/credentials/overview', '/api/credentials/items/cred_1']);

    await loadSelfClaims(USER_DID);
    expect(calls).toHaveLength(2);

    clearHubCredentialCache();
    await loadSelfClaims(USER_DID);
    expect(calls).toHaveLength(4);
  });

  describe('loadSelfClaims trusts the item, not the overview row', () => {
    // The row says verified (and is remembered for minutes); the item is the Hub's live answer.
    const hubWithItem = (over: Record<string, unknown>) =>
      serve({
        '/api/credentials/overview': () => json({ vault: 'ok', credentials: [row()] }),
        '/api/credentials/items/cred_1': () => json(item(over)),
      });
    const paths = () => calls.map((c) => c.url.pathname);

    for (const [name, over] of [
      ['no longer verified', { verified: false, revoked: null }],
      ['revoked', { revoked: true }],
      ['expired', { expiresAt: Math.floor(Date.now() / 1000) - 60 }],
      ['from another issuer', { issuer: { did: 'did:ixo:entity:other' } }],
    ] as [string, Record<string, unknown>][]) {
      it(`answers null and forgets the credential when the item is ${name}`, async () => {
        hubWithItem(over);
        // The row alone made the person "verified", and that was remembered.
        expect((await findSelfCredential(USER_DID))?.id).toBe('cred_1');
        expect(paths()).toEqual(['/api/credentials/overview']);

        expect(await loadSelfClaims(USER_DID)).toBeNull();
        expect(paths()).toEqual(['/api/credentials/overview', '/api/credentials/items/cred_1']);

        // Nothing was kept: neither the claims nor the row. The next look asks the Hub again.
        expect(await loadSelfClaims(USER_DID)).toBeNull();
        expect(paths()).toEqual([
          '/api/credentials/overview',
          '/api/credentials/items/cred_1',
          '/api/credentials/overview',
          '/api/credentials/items/cred_1',
        ]);
      });
    }

    it('accepts an item whose status list could not be read (revoked: null)', async () => {
      hubWithItem({ revoked: null });
      expect(await loadSelfClaims(USER_DID)).toEqual({ given_name: 'Ada', birth_date: '1990-01-02' });
    });

    it('accepts an item that is verified, not revoked and not yet expired, and remembers its answer', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      hubWithItem({ expiresAt });
      expect(await loadSelfClaims(USER_DID)).toEqual({ given_name: 'Ada', birth_date: '1990-01-02' });
      // The remembered credential is now the item's (it says `revoked: false`; the row could not).
      expect(await findSelfCredential(USER_DID)).toMatchObject({ id: 'cred_1', revoked: false, expiresAt });
      expect(paths()).toEqual(['/api/credentials/overview', '/api/credentials/items/cred_1']);
    });

    it('is unavailable, not null, while the Hub has not checked the item', async () => {
      hubWithItem({ verified: false, checking: true, revoked: null });
      expect(await code(loadSelfClaims(USER_DID))).toBe('unavailable');
    });

    it("judges the expiry by the server's time", async () => {
      // This device's clock is an hour behind: by it the credential would still look valid.
      mocks.serverAheadSeconds = 3600;
      hubWithItem({ expiresAt: Math.floor(Date.now() / 1000) + 600 });
      expect(await loadSelfClaims(USER_DID)).toBeNull();
    });
  });

  it('loadSelfClaims answers null when the person holds no Self credential', async () => {
    serve({ '/api/credentials/overview': () => json({ vault: 'ok', credentials: [] }) });
    expect(await loadSelfClaims(USER_DID)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it('does not share one person’s claims with another DID', async () => {
    hub();
    await loadSelfClaims(USER_DID);
    await loadSelfClaims('did:ixo:ixo1other');
    expect(calls).toHaveLength(4);
    expect(mocks.invocations[2].capability.with).toBe('ixo:auth-hub:user:ixo1other');
  });
});
