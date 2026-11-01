import {
  createLocalDIDResolver,
  createUCANValidator,
  defineCapability,
  signerFromMnemonic,
} from '@ixo/ucan';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const USER_DID = 'did:ixo:ixo190vqdjtlpcq27xslcveglfmr4ynfwg7glwx95q';

const h = vi.hoisted(() => ({
  mnemonic: null as string | null,
  openIdRetry: vi.fn(),
  mintVfs: vi.fn(async () => 'vfs-token'),
}));

vi.mock('@utils/storage', () => ({ secureLoad: () => h.mnemonic }));
vi.mock('@utils/matrix', () => ({ fetchWithMatrixOpenIdRetry: h.openIdRetry }));
vi.mock('@utils/claims', () => ({ fetchCollectionByCollectionId: vi.fn() }));
vi.mock('@utils/encoding', () => ({ blobToDataURL: async (blob: Blob) => `data:${blob.type};bytes=${blob.size}` }));
vi.mock('@utils/ucanVfs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@utils/ucanVfs')>()),
  mintVfsInvocation: h.mintVfs,
}));

import { VFS_BASE_URL } from '@constants/vfs';
import { createAttachDownloadHandler } from '@constants/surveyDefaultConfig';
import { getCachedServiceDid, setCachedServiceDid } from '@utils/serviceDid';
import { parseVfsClaimMediaUrl } from '../vfs/claimMedia';
import { getSurveyFileBlob, getSurveyFilePreview } from './matrixClaims';

type Route = (init: RequestInit) => Response | Promise<Response>;

const REAL_BOT = 'https://claim.bot.mx.ixo.earth';
const FOREIGN_BOT = 'https://claim.bot.matrix.supamoto.global';
const FAKE_HOST = 'https://evil.example';

const png = () => new Response(new Blob(['x'], { type: 'image/png' }), { status: 200 });
const didDocument = (id: string) => () => new Response(JSON.stringify({ id }), { status: 200 });
const content = (serviceEndpoint: string, mediaType = 'image/png') => JSON.stringify({ serviceEndpoint, mediaType });

let routes: Record<string, Route>;
let calls: { url: string; init: RequestInit; headers: Headers }[];

const sentTo = (url: string) => calls.filter((call) => call.url === url);

function expectNoCredential(call: { headers: Headers }) {
  for (const header of ['x-openid-token', 'x-did', 'authorization', 'x-auth-type']) {
    expect(call.headers.has(header), header).toBe(false);
  }
}

/** A bot's own check (ixo-matrix-claims-bot src/utils/ucan.ts), for one service DID. */
async function botAccepts(serviceDid: string, authorization: string): Promise<boolean> {
  const { signer } = await signerFromMnemonic(MNEMONIC);
  const didResolver = createLocalDIDResolver();
  const publicKey = signer.did().replace('did:key:', '');
  didResolver.register(USER_DID, publicKey);
  didResolver.register(serviceDid, publicKey);
  const validator = await createUCANValidator({
    serverDid: serviceDid,
    rootIssuers: ['*'],
    didResolver,
    invocationStore: { has: () => Promise.resolve(false), add: () => Promise.resolve() },
  } as Parameters<typeof createUCANValidator>[0]);
  const result = await validator.validate(
    authorization.replace('Bearer ', ''),
    defineCapability({ can: '*', protocol: 'ixo:' }) as never,
    'ixo:matrix-claims-bot' as never,
  );
  return result.ok;
}

beforeEach(() => {
  h.mnemonic = MNEMONIC;
  h.openIdRetry.mockReset();
  h.mintVfs.mockClear();
  routes = {};
  calls = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init, headers: new Headers(init.headers) });
      const route = routes[url];
      return route ? route(init) : new Response('not found', { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a claim link on a hostile host', () => {
  const url = `${FAKE_HOST}/x.png`;

  it('never gets an OpenID token: no did.json, no credential at all, and the unauthenticated read still works', async () => {
    routes[url] = png;

    await expect(getSurveyFilePreview(content(url), USER_DID)).resolves.toBe('data:image/png;bytes=1');

    expect(h.openIdRetry).not.toHaveBeenCalled();
    expectNoCredential(sentTo(url)[0]);
    expect(sentTo(url)[0].init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer' });
  });

  it('never gets one by answering 401 either', async () => {
    routes[url] = () => new Response('{}', { status: 401 });

    await expect(getSurveyFileBlob(content(url), USER_DID)).resolves.toBeNull();

    expect(sentTo(url)).toHaveLength(1);
    expectNoCredential(sentTo(url)[0]);
    expect(h.openIdRetry).not.toHaveBeenCalled();
  });

  it('gets no UCAN when its did.json names our real bot', async () => {
    routes[`${FAKE_HOST}/.well-known/did.json`] = didDocument('did:web:claim.bot.mx.ixo.earth');
    routes[url] = png;

    await getSurveyFilePreview(content(url), USER_DID);

    expectNoCredential(sentTo(url)[0]);
    expect(getCachedServiceDid(FAKE_HOST)).toBeUndefined();
  });

  it('gets no UCAN from a poisoned cache, which is dropped', async () => {
    setCachedServiceDid(FAKE_HOST, 'did:web:claim.bot.mx.ixo.earth');
    routes[url] = png;

    await getSurveyFilePreview(content(url), USER_DID);

    expectNoCredential(sentTo(url)[0]);
    expect(getCachedServiceDid(FAKE_HOST)).toBeUndefined();
  });

  it('gets no UCAN for a did.json that is not JSON or has no id', async () => {
    routes[`${FAKE_HOST}/.well-known/did.json`] = () => new Response('<html>', { status: 200 });
    routes[url] = png;
    await getSurveyFilePreview(content(url), USER_DID);
    expectNoCredential(sentTo(url)[0]);

    routes[`${FAKE_HOST}/.well-known/did.json`] = () => new Response('{}', { status: 200 });
    await getSurveyFilePreview(content(url), USER_DID);
    expectNoCredential(sentTo(url)[1]);
  });

  it('a did:web of its own buys a token useless anywhere else', async () => {
    const own = 'https://own-did.example';
    routes[`${own}/.well-known/did.json`] = didDocument('did:web:own-did.example');
    routes[`${own}/x.png`] = png;

    await getSurveyFilePreview(content(`${own}/x.png`), USER_DID);

    const token = sentTo(`${own}/x.png`)[0].headers.get('authorization') as string;
    expect(sentTo(`${own}/x.png`)[0].headers.has('x-openid-token')).toBe(false);
    await expect(botAccepts('did:web:own-did.example', token)).resolves.toBe(true);
    await expect(botAccepts('did:web:claim.bot.mx.ixo.earth', token)).resolves.toBe(false);
  });

  it('sends nothing to a link that is not https', async () => {
    for (const link of ['http://evil.example/x.png', 'ipfs://bafy', 'file:///etc/passwd', '/relative', 'not a url']) {
      await expect(getSurveyFilePreview(content(link), USER_DID)).resolves.toBe('');
      await expect(getSurveyFileBlob(content(link), USER_DID)).resolves.toBeNull();
    }
    expect(calls).toHaveLength(0);
  });
});

describe('a claims bot on any homeserver', () => {
  it.each([
    ['our bot', REAL_BOT, 'did:web:claim.bot.mx.ixo.earth'],
    ['a foreign bot', FOREIGN_BOT, 'did:web:claim.bot.matrix.supamoto.global'],
  ])('%s gets a UCAN it accepts, and no OpenID token', async (_name, bot, did) => {
    const url = `${bot}/media/collections/142/bafy-${_name}`;
    routes[`${bot}/.well-known/did.json`] = didDocument(did);
    routes[url] = png;

    await expect(getSurveyFileBlob(content(url), USER_DID)).resolves.toMatchObject({ mediaType: 'image/png' });

    const { headers, init } = sentTo(url)[0];
    expect(headers.get('x-auth-type')).toBe('ucan');
    expect(headers.has('x-openid-token')).toBe(false);
    expect(headers.has('x-did')).toBe(false);
    expect(init.redirect).toBe('error');
    await expect(botAccepts(did, headers.get('authorization') as string)).resolves.toBe(true);
    expect(h.openIdRetry).not.toHaveBeenCalled();
  });

  it('binds a host with a port, encoded as did:web requires', async () => {
    const bot = 'https://bot.example:8448';
    routes[`${bot}/.well-known/did.json`] = didDocument('did:web:bot.example%3A8448');
    routes[`${bot}/m`] = png;

    await getSurveyFilePreview(content(`${bot}/m`), USER_DID);

    await expect(
      botAccepts('did:web:bot.example%3A8448', sentTo(`${bot}/m`)[0].headers.get('authorization') as string),
    ).resolves.toBe(true);
  });

  it('asks a bot for its did.json once per session, and mints a fresh token per read', async () => {
    const bot = 'https://claim.bot.once.example';
    routes[`${bot}/.well-known/did.json`] = didDocument('did:web:claim.bot.once.example');
    routes[`${bot}/a`] = png;
    routes[`${bot}/b`] = png;

    await Promise.all([getSurveyFilePreview(content(`${bot}/a`), USER_DID), getSurveyFilePreview(content(`${bot}/b`), USER_DID)]);
    await getSurveyFilePreview(content(`${bot}/a`), USER_DID);

    expect(sentTo(`${bot}/.well-known/did.json`)).toHaveLength(1);
    const tokens = [...sentTo(`${bot}/a`), ...sentTo(`${bot}/b`)].map((call) => call.headers.get('authorization'));
    expect(new Set(tokens).size).toBe(3);
  });

  it('without a signing key the read goes out with no credential and no OpenID fallback', async () => {
    const bot = 'https://claim.bot.nokey.example';
    h.mnemonic = null;
    routes[`${bot}/.well-known/did.json`] = didDocument('did:web:claim.bot.nokey.example');
    routes[`${bot}/m`] = () => new Response('{}', { status: 401 });

    await expect(getSurveyFilePreview(content(`${bot}/m`), USER_DID)).resolves.toBe('');

    expectNoCredential(sentTo(`${bot}/m`)[0]);
    expect(h.openIdRetry).not.toHaveBeenCalled();
  });
});

describe('VFS links', () => {
  const query = '?entity=did:ixo:entity:00603e08ff955177eac0bddbce6d14ba&collection=142';
  const onVfs = `${VFS_BASE_URL}/api/fs/cid/bafy${query}`;
  const lookalike = `https://vfs-lookalike.example/api/fs/cid/bafy${query}`;

  it('only the configured VFS host parses as VFS', () => {
    expect(parseVfsClaimMediaUrl(onVfs)).toMatchObject({ cid: 'bafy', collectionId: '142' });
    expect(parseVfsClaimMediaUrl(lookalike)).toBeNull();
    expect(parseVfsClaimMediaUrl(`${VFS_BASE_URL}.evil.example/api/fs/cid/bafy${query}`)).toBeNull();
    expect(parseVfsClaimMediaUrl(onVfs.replace('https://', 'http://'))).toBeNull();
  });

  it('the configured VFS gets its lane UCAN', async () => {
    routes[onVfs] = png;

    await getSurveyFilePreview(content(onVfs), USER_DID);

    expect(h.mintVfs).toHaveBeenCalledWith(USER_DID, 'fs/read', expect.stringContaining('/.claims/142'));
    expect(sentTo(onVfs)[0].headers.get('authorization')).toBe('Bearer vfs-token');
  });

  it('the same URL on another host gets no VFS UCAN: it takes the legacy path', async () => {
    routes[lookalike] = png;

    await getSurveyFilePreview(content(lookalike), USER_DID);
    await getSurveyFileBlob(content(lookalike), USER_DID);

    expect(h.mintVfs).not.toHaveBeenCalled();
    sentTo(lookalike).forEach(expectNoCredential);
  });
});

describe('a failed preview', () => {
  const url = `${REAL_BOT}/media/collections/142/missing`;

  beforeEach(() => {
    routes[`${REAL_BOT}/.well-known/did.json`] = didDocument('did:web:claim.bot.mx.ixo.earth');
  });

  it('is empty for a refused or thrown read, never an exception', async () => {
    routes[url] = () => new Response('{}', { status: 403 });
    await expect(getSurveyFilePreview(content(url), USER_DID)).resolves.toBe('');
    await expect(getSurveyFileBlob(content(url), USER_DID)).resolves.toBeNull();

    routes[url] = () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(getSurveyFilePreview(content(url), USER_DID)).resolves.toBe('');
    await expect(getSurveyFileBlob(content(url), USER_DID)).resolves.toBeNull();
  });

  it('renders SurveyJS’s error state instead of an image', async () => {
    routes[url] = () => new Response('{}', { status: 403 });
    let download!: (sender: unknown, options: unknown) => Promise<void>;
    const model = { onDownloadFile: { add: (handler: typeof download) => (download = handler) } };
    createAttachDownloadHandler(USER_DID)(model as never);
    const callback = vi.fn();

    await download(model, { content: content(url), callback });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('error');
  });
});
