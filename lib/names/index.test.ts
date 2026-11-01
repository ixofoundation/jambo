import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NAMES_WORKER_BY_NETWORK,
  NAMES_WORKER_URL,
  isAcceptableNamesWorkerUrl,
  resolveNamesWorkerUrl,
} from '@constants/names';
import {
  MATRIX_PROFILE_INCLUDE,
  PROFILE_INCLUDE,
  createJamboNamesClient,
  resolveMatrixProfile,
  withinMs,
  workerImage,
  type ResolvedName,
} from './index';

const ADDR = 'ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';
const ADDR2 = 'ixo1e5kty228a4k9v599yquafkwphsxymtjc2jn5ve';
const ENTITY = 'did:ixo:entity:00603e08ff955177eac0bddbce6d14ba';
const HS = 'mx.ixo.earth';
const USER_ID = `@did-ixo-${ADDR}:${HS}`;
const BASE = 'https://names.example';

function account(id: string, over: Partial<ResolvedName> = {}): ResolvedName {
  return {
    id,
    kind: 'account',
    normalized: id,
    display: 'Thandi M',
    status: 'resolved',
    complete: true,
    name: 'Thandi M',
    source: 'matrix',
    selfChosen: true,
    image: `https://${HS}/_matrix/media/v3/thumbnail/${HS}/abc?width=96&height=96&method=crop`,
    matrix: {
      homeserver: HS,
      homeserverSource: 'default',
      userId: `@did-ixo-${id}:${HS}`,
      bots: null,
    },
    cache: { hit: 'memory', freshUntil: Math.floor(Date.now() / 1000) + 3600 },
    ...over,
  };
}

/** A did-ixo sender as the worker answers it: keyed by the id sent, about its address, on the address's own homeserver. */
function sender(id: string, over: Partial<ResolvedName> = {}): ResolvedName {
  return account(id, {
    normalized: ADDR,
    matrix: { homeserver: HS, homeserverSource: 'default', userId: USER_ID, bots: null },
    ...over,
  });
}

/** What a worker from before Matrix ids answers for one. */
function unknownAnswer(id: string): ResolvedName {
  return {
    id,
    kind: 'unknown',
    normalized: null,
    display: id,
    status: 'unresolved',
    complete: true,
    name: null,
    source: null,
    selfChosen: false,
    cache: { hit: 'none', freshUntil: null },
    error: { code: 'unsupported_identifier', message: 'unsupported identifier' },
  };
}

type Call = { url: string; init: RequestInit; ids: string[]; include: string[] };

/** Answers both routes: GET /v1/names for small batches, POST /v1/resolve for the rest. */
function fakeFetch(answer: (ids: string[]) => Record<string, ResolvedName>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const query = new URL(url).searchParams;
    const body = init.method === 'POST' ? JSON.parse(String(init.body)) : null;
    const ids: string[] = body ? body.ids : (query.get('ids') ?? '').split(',');
    calls.push({ url, init, ids, include: body ? body.options.include : (query.get('include') ?? '').split(',') });
    return new Response(JSON.stringify({ network: 'mainnet', results: answer(ids), meta: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { fetchImpl, calls };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('names worker config', () => {
  it('one deployment per network, none for the local chain', () => {
    expect(NAMES_WORKER_BY_NETWORK).toEqual({
      mainnet: 'https://names.ixo.earth',
      testnet: 'https://testnet.names.ixo.earth',
      devnet: 'https://devnet.names.ixo.earth',
      local: null,
    });
  });

  it('defaults to the configured network (the suite runs as mainnet)', () => {
    expect(NAMES_WORKER_URL).toBe(process.env.NEXT_PUBLIC_NAMES_WORKER_URL || 'https://names.ixo.earth');
  });
});

describe('NEXT_PUBLIC_NAMES_WORKER_URL validation', () => {
  it('accepts https and a local http worker', () => {
    expect(isAcceptableNamesWorkerUrl('https://names.example')).toBe(true);
    expect(isAcceptableNamesWorkerUrl('http://localhost:8799')).toBe(true);
    expect(isAcceptableNamesWorkerUrl('http://127.0.0.1:8799')).toBe(true);
  });

  it('refuses plain http elsewhere, scheme-less values and other schemes', () => {
    expect(isAcceptableNamesWorkerUrl('http://names.ixo.earth')).toBe(false);
    expect(isAcceptableNamesWorkerUrl('names.ixo.earth')).toBe(false);
    expect(isAcceptableNamesWorkerUrl('javascript:alert(1)')).toBe(false);
    expect(isAcceptableNamesWorkerUrl('http://localhost.evil.example')).toBe(false);
  });

  it('trims, and ignores an invalid or blank override with a warning (network default instead)', () => {
    expect(resolveNamesWorkerUrl('  https://names.example  ', 'mainnet')).toBe('https://names.example');
    expect(resolveNamesWorkerUrl('   ', 'testnet')).toBe('https://testnet.names.ixo.earth');
    expect(resolveNamesWorkerUrl(undefined, 'devnet')).toBe('https://devnet.names.ixo.earth');
    expect(console.warn).not.toHaveBeenCalled();
    expect(resolveNamesWorkerUrl('names.ixo.earth', 'mainnet')).toBe('https://names.ixo.earth');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('ignoring NEXT_PUBLIC_NAMES_WORKER_URL'));
    expect(resolveNamesWorkerUrl(undefined, 'local')).toBe('');
    expect(resolveNamesWorkerUrl(undefined, 'nonsense')).toBe('');
  });
});

describe('workerImage', () => {
  const avatar = (host: string) => `https://${host}/_matrix/media/v3/thumbnail/${host}/abc?width=96&height=96&method=crop`;

  it('uses any https image, for every kind and from any host', () => {
    expect(workerImage(account(ADDR, { image: avatar('mx.ixo.earth') }))).toBe(avatar('mx.ixo.earth'));
    expect(workerImage(account(ADDR, { image: avatar('matrix.supamoto.global') }))).toBe(avatar('matrix.supamoto.global'));
    const img = 'https://cellnode.example/public/logo.png';
    expect(workerImage(account(ENTITY, { kind: 'entity', image: img }))).toBe(img);
    expect(workerImage(account(ADDR, { kind: 'contract', image: img }))).toBe(img);
  });

  it('refuses anything that is not an https URL', () => {
    expect(workerImage(account(ADDR, { image: 'http://mx.ixo.earth/a.png' }))).toBeNull();
    expect(workerImage(account(ADDR, { image: 'not a url' }))).toBeNull();
    expect(workerImage(account(ADDR, { image: null }))).toBeNull();
    expect(workerImage(account(ADDR, { image: undefined }))).toBeNull();
    expect(workerImage(undefined)).toBeNull();
  });
});

describe('withinMs', () => {
  it('answers with the value when it settles in time, undefined otherwise', async () => {
    await expect(withinMs(Promise.resolve(7), 50)).resolves.toBe(7);
    await expect(withinMs(new Promise<number>(() => undefined), 5)).resolves.toBeUndefined();
  });
});

describe('createJamboNamesClient', () => {
  it('asks by GET for a small batch, with X-Client-Id jambo and the sorted include groups plus cache', async () => {
    const { fetchImpl, calls } = fakeFetch((ids) => Object.fromEntries(ids.map((id) => [id, account(id)])));
    const client = createJamboNamesClient(BASE, fetchImpl);

    const results = await client.resolve([ADDR], { include: PROFILE_INCLUDE });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/v1/names?ids=${ADDR}&include=cache,image,name`);
    expect(calls[0].init.method).toBe('GET');
    // The node runtime of this suite; in a browser a GET drops custom headers to avoid a preflight.
    expect(new Headers(calls[0].init.headers).get('x-client-id')).toBe('jambo');
    expect(results[ADDR].display).toBe('Thandi M');
  });

  it('coalesces calls made in the same tick into one request, and memoises', async () => {
    const { fetchImpl, calls } = fakeFetch((ids) => Object.fromEntries(ids.map((id) => [id, account(id)])));
    const client = createJamboNamesClient(BASE, fetchImpl);

    // What N rows each calling useNames([theirAddress]) amounts to.
    await Promise.all([
      client.resolve([ADDR], { include: PROFILE_INCLUDE }),
      client.resolve([ADDR2], { include: PROFILE_INCLUDE }),
      client.resolve([ADDR], { include: PROFILE_INCLUDE }),
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].ids).toEqual([ADDR, ADDR2].sort());

    await client.resolve([ADDR, ADDR2], { include: PROFILE_INCLUDE });
    expect(calls).toHaveLength(1);
    expect(client.peek(ADDR, PROFILE_INCLUDE)?.name).toBe('Thandi M');
  });

  it('never rejects: a failing worker degrades to the canonical abbreviation and is logged', async () => {
    const client = createJamboNamesClient(
      BASE,
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    const results = await client.resolve([ADDR], { include: PROFILE_INCLUDE });

    expect(results[ADDR]).toMatchObject({ display: 'ixo190vqd…x95q', status: 'partial', complete: false, name: null });
    expect(results[ADDR].image).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[names] network'));
  });
});

describe('resolveMatrixProfile', () => {
  const answering = (over: Partial<ResolvedName> = {}) =>
    fakeFetch((ids) => Object.fromEntries(ids.map((id) => [id, sender(id, over)])));

  it('sends the sender id as it is and answers name + avatar when matrix.userId is that id', async () => {
    const { fetchImpl, calls } = answering();

    await expect(resolveMatrixProfile(createJamboNamesClient(BASE, fetchImpl), USER_ID)).resolves.toEqual({
      displayName: 'Thandi M',
      avatarUrl: account(ADDR).image,
    });
    expect(calls[0].ids).toEqual([USER_ID]);
    expect(calls[0].include).toEqual(['cache', 'image', 'matrix', 'name']);
  });

  it('a complete answer with no name is final: displayName null, not a refusal', async () => {
    const { fetchImpl } = answering({ name: null, source: null, selfChosen: false, status: 'unresolved', image: null });
    await expect(resolveMatrixProfile(createJamboNamesClient(BASE, fetchImpl), USER_ID)).resolves.toEqual({
      displayName: null,
      avatarUrl: null,
    });
  });

  it('keeps an avatar served by another homeserver, drops a non-https one', async () => {
    const image = 'https://matrix.supamoto.global/_matrix/media/v3/thumbnail/x/y';
    await expect(
      resolveMatrixProfile(createJamboNamesClient(BASE, answering({ image }).fetchImpl), USER_ID),
    ).resolves.toEqual({ displayName: 'Thandi M', avatarUrl: image });

    await expect(
      resolveMatrixProfile(createJamboNamesClient(BASE, answering({ image: 'http://mx.ixo.earth/a' }).fetchImpl), USER_ID),
    ).resolves.toEqual({ displayName: 'Thandi M', avatarUrl: null });
  });

  it('refuses a did-ixo id on another homeserver than the address\u2019s own (impersonation)', async () => {
    // The worker answers about the address, whatever server the id names.
    const { fetchImpl, calls } = answering();
    const impostor = `@did-ixo-${ADDR}:evil.example`;
    await expect(resolveMatrixProfile(createJamboNamesClient(BASE, fetchImpl), impostor)).resolves.toBeNull();
    expect(calls[0].ids).toEqual([impostor]);
  });

  it('a worker from before Matrix ids (unknown) is incomplete, so the caller reads with its session', async () => {
    const { fetchImpl, calls } = fakeFetch((ids) => Object.fromEntries(ids.map((id) => [id, unknownAnswer(id)])));
    const client = createJamboNamesClient(BASE, fetchImpl);

    await expect(resolveMatrixProfile(client, USER_ID)).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect((await client.resolve([USER_ID], { include: MATRIX_PROFILE_INCLUDE }))[USER_ID]).toMatchObject({
      kind: 'account',
      complete: false,
      display: 'ixo190vqd\u2026x95q',
    });
    expect(calls).toHaveLength(1);
  });

  it('a bad checksum is final on any worker, and still gets no name from it', async () => {
    const bad = `@did-ixo-${ADDR.slice(0, -1)}p:${HS}`;
    const { fetchImpl } = fakeFetch((ids) => Object.fromEntries(ids.map((id) => [id, unknownAnswer(id)])));
    await expect(resolveMatrixProfile(createJamboNamesClient(BASE, fetchImpl), bad)).resolves.toBeNull();
  });

  it('refuses incomplete answers and worker failures (the caller falls back to its session read)', async () => {
    const partial = answering({ complete: false });
    await expect(resolveMatrixProfile(createJamboNamesClient(BASE, partial.fetchImpl), USER_ID)).resolves.toBeNull();

    const failing = createJamboNamesClient(
      BASE,
      vi.fn(async () => new Response('{}', { status: 503 })),
    );
    await expect(resolveMatrixProfile(failing, USER_ID)).resolves.toBeNull();
  });

  it('never sends anything but a did-ixo user id of an account, or without a client', async () => {
    const { fetchImpl } = fakeFetch(() => ({}));
    const client = createJamboNamesClient(BASE, fetchImpl);
    const contract = `ixo1${'q'.repeat(58)}`;
    for (const id of ['@admin:mx.ixo.earth', `@did-ixo-${ADDR}`, `@did-ixo-${contract}:${HS}`, ADDR, `did:ixo:${ADDR}`]) {
      await expect(resolveMatrixProfile(client, id)).resolves.toBeNull();
    }
    await expect(resolveMatrixProfile(null, USER_ID)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
