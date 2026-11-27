import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The signing parts are not under test: a delegation is named after its capability.
vi.mock('@utils/ucanDelegation', () => ({
  mintDelegation: vi.fn(async ({ capabilities, audience, ttlSeconds }) =>
    JSON.stringify({
      can: capabilities.map((c: { can: string; with: string }) => `${c.can} ${c.with}`),
      audience,
      ttlSeconds,
    }),
  ),
}));
vi.mock('@utils/storage', () => ({ secureLoad: vi.fn(() => 'test mnemonic') }));
vi.mock('@ixo/ucan', () => ({
  signerFromMnemonic: vi.fn(async () => ({ signer: {} })),
  createInvocation: vi.fn(async () => ({})),
  serializeInvocation: vi.fn(async () => 'invocation'),
}));

const WORKER = 'https://sync.test';
const WORKER_DID = 'did:web:sync.test';
const USER_DID = 'did:ixo:ixo1user';

let fetchMock: ReturnType<typeof vi.fn>;

async function load() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_YOMA_SYNC_WORKER_URL', WORKER);
  return import('./client');
}

function bindBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/v1/link/bind'));
  return JSON.parse((call![1] as RequestInit).body as string);
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) =>
    url.endsWith('/.well-known/did.json')
      ? new Response(JSON.stringify({ id: WORKER_DID }), { status: 200 })
      : new Response(JSON.stringify({ email: null, yomaId: 'y-1' }), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('bindLink', () => {
  it('a Yoma account: the unchanged email delegation and a phone delegation, nothing else', async () => {
    const m = await load();
    const result = await m.bindLink(USER_DID, { authProvider: 'yoma' });
    expect(result).toEqual({ email: null, yomaId: 'y-1', contact: null });

    const body = bindBody();
    expect(Object.keys(body).sort()).toEqual(['delegation', 'phoneDelegation']);
    expect(JSON.parse(body.delegation as string)).toEqual({
      can: ['auth/user/email ixo:auth-hub:user:ixo1user'],
      audience: WORKER_DID,
      ttlSeconds: 240,
    });
    expect(JSON.parse(body.phoneDelegation as string)).toEqual({
      can: ['auth/user/phone ixo:auth-hub:user:ixo1user'],
      audience: WORKER_DID,
      ttlSeconds: 240,
    });
  });

  it('a WorkOS account: no phone delegation', async () => {
    const m = await load();
    await m.bindLink(USER_DID, { authProvider: 'workos' });
    expect(Object.keys(bindBody())).toEqual(['delegation']);
  });

  it('forwards a signed hand-off unchanged, all three together', async () => {
    const m = await load();
    await m.bindLink(USER_DID, {
      authProvider: 'yoma',
      handOff: { yref: 'partner-user-42', ysig: 'c2ln_-+/=', yexp: '1795714015' },
    });
    const body = bindBody();
    expect(Object.keys(body).sort()).toEqual(['delegation', 'phoneDelegation', 'yexp', 'yref', 'ysig']);
    expect(body).toMatchObject({ yref: 'partner-user-42', ysig: 'c2ln_-+/=', yexp: '1795714015' });
  });

  it('an older, unsigned hand-off: yref alone', async () => {
    const m = await load();
    await m.bindLink(USER_DID, {
      authProvider: 'workos',
      handOff: { yref: 'partner-user-42', ysig: null, yexp: null },
    });
    expect(Object.keys(bindBody()).sort()).toEqual(['delegation', 'yref']);
  });

  it('a yref outside the worker limit leaves the whole hand-off out', async () => {
    const m = await load();
    await m.bindLink(USER_DID, { handOff: { yref: 'x'.repeat(129), ysig: 'sig', yexp: '1' } });
    expect(Object.keys(bindBody())).toEqual(['delegation']);
  });

  it('reads the contact the phone-matching worker reports, and nothing else', async () => {
    const m = await load();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/.well-known/did.json')
        ? new Response(JSON.stringify({ id: WORKER_DID }), { status: 200 })
        : new Response(JSON.stringify({ email: null, yomaId: null, contact: 'phone' }), { status: 200 }),
    );
    expect(await m.getLinkStatus(USER_DID)).toEqual({ email: null, yomaId: null, contact: 'phone' });
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/.well-known/did.json')
        ? new Response(JSON.stringify({ id: WORKER_DID }), { status: 200 })
        : new Response(JSON.stringify({ email: null, yomaId: null, contact: '+15550000' }), { status: 200 }),
    );
    expect((await m.getLinkStatus(USER_DID)).contact).toBeNull();
  });

  it('an unknown provider and no yref (older session): exactly the request the worker always got', async () => {
    const m = await load();
    await m.bindLink(USER_DID);
    expect(Object.keys(bindBody())).toEqual(['delegation']);
    await m.bindLink(USER_DID, { authProvider: 'Not&Valid' });
    expect(Object.keys(bindBody())).toEqual(['delegation']);
  });
});
