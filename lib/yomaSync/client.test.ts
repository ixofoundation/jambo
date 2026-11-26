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
  it('a Yoma account: the unchanged email delegation, a phone delegation and the provider', async () => {
    const m = await load();
    const result = await m.bindLink(USER_DID, { authProvider: 'yoma' });
    expect(result).toEqual({ email: null, yomaId: 'y-1' });

    const body = bindBody();
    expect(Object.keys(body).sort()).toEqual(['authProvider', 'delegation', 'phoneDelegation']);
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
    expect(body.authProvider).toBe('yoma');
  });

  it('a WorkOS account: no phone delegation', async () => {
    const m = await load();
    await m.bindLink(USER_DID, { authProvider: 'workos' });
    expect(Object.keys(bindBody()).sort()).toEqual(['authProvider', 'delegation']);
  });

  it('an unknown provider (older session): exactly the request the current worker always got', async () => {
    const m = await load();
    await m.bindLink(USER_DID);
    expect(Object.keys(bindBody())).toEqual(['delegation']);
    await m.bindLink(USER_DID, { authProvider: 'Not&Valid' });
    expect(Object.keys(bindBody())).toEqual(['delegation']);
  });
});
