import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InMemoryInvocationStore,
  UcantoServer,
  createDelegation,
  createUCANValidator,
  defineCapability,
  generateKeypair,
  parseDelegation,
  parseSigner,
  serializeDelegation,
  signerFromMnemonic,
  type Capability,
  type DIDKeyResolver,
  type Signer,
  type SupportedDID,
} from '@ixo/ucan';

import {
  IDENTITY_LEVEL1_VCT,
  SELF_API_URL,
  SELF_AUDIENCE_DID,
  SELF_ISSUER_DID,
  SELF_LINK_CAPABILITY,
  SELF_LINK_DELEGATION_TTL_SECONDS,
  SELF_OFFER_CAPABILITY,
  SELF_OFFER_CONSENT_TTL_SECONDS,
  SELF_WEB_URL,
} from '@constants/self';
import { deriveEd25519KeyPairFromMnemonic, publicKeyToMultibase } from '@utils/veramo';
import {
  __resetSelfRateLimitsForTest,
  bodySha256,
  buildSelfInvocation,
  canonicalJson,
  clientIpOf,
  deriveRequestKey,
  handleCreateLink,
  handleLinkStatus,
  invocationFacts,
  isSelfLinkUrl,
  isValidClientNonce,
  isValidLinkId,
  mapCreateAnswer,
  mapStatusAnswer,
  readSelfConfig,
  SELF_INVOCATION_TTL_SECONDS,
  SELF_LINKS_PATH,
  validateLinkDelegation,
  validateOfferConsent,
  type SelfServerConfig,
} from './server';
import { createRateLimiter } from './rateLimit';

const PERSON_DID = `did:ixo:ixo1${'p'.repeat(38)}`;
const SERVICE_DID = `did:ixo:ixo1${'s'.repeat(38)}`;
const OTHER_DID = `did:ixo:ixo1${'x'.repeat(38)}`;
const ENTITY_DID = `did:ixo:entity:${'ab'.repeat(16)}`;
const SERVICE_MNEMONIC = 'test test test test test test test test test test test junk';
const LINK_ID = '0b9f6f4e-2f0f-4b55-9d6c-3d2f3c1a7e10';
const NONCE = 'a'.repeat(32);
const CONFIG: SelfServerConfig = { mnemonic: SERVICE_MNEMONIC, serviceDid: SERVICE_DID, entityDid: ENTITY_DID };

const nowS = () => Math.floor(Date.now() / 1000);

async function signerFor(did: string): Promise<Signer> {
  const { privateKey } = await generateKeypair();
  return parseSigner(privateKey, did as SupportedDID);
}

async function linkDelegation(
  overrides: {
    issuerDid?: string;
    audience?: string;
    capabilities?: Capability[];
    ttl?: number | null;
    withProof?: boolean;
  } = {},
): Promise<string> {
  const issuer = await signerFor(overrides.issuerDid ?? PERSON_DID);
  const proofs = overrides.withProof
    ? [
        await createDelegation({
          issuer: await signerFor(OTHER_DID),
          audience: overrides.issuerDid ?? PERSON_DID,
          capabilities: [{ ...SELF_LINK_CAPABILITY }],
          expiration: nowS() + 60,
        }),
      ]
    : undefined;
  const delegation = await createDelegation({
    issuer,
    audience: overrides.audience ?? SERVICE_DID,
    capabilities: overrides.capabilities ?? [{ ...SELF_LINK_CAPABILITY }],
    ...(overrides.ttl === null ? {} : { expiration: nowS() + (overrides.ttl ?? SELF_LINK_DELEGATION_TTL_SECONDS) }),
    proofs,
  });
  return serializeDelegation(delegation);
}

async function offerConsent(
  overrides: { issuerDid?: string; audience?: string; nb?: Record<string, unknown>; ttl?: number } = {},
): Promise<string> {
  const delegation = await createDelegation({
    issuer: await signerFor(overrides.issuerDid ?? PERSON_DID),
    audience: overrides.audience ?? SELF_ISSUER_DID,
    capabilities: [{ ...SELF_OFFER_CAPABILITY, nb: overrides.nb ?? { vct: [IDENTITY_LEVEL1_VCT] } } as Capability],
    expiration: nowS() + (overrides.ttl ?? SELF_OFFER_CONSENT_TTL_SECONDS),
  });
  return serializeDelegation(delegation);
}

/** Reads an invocation the way ixo-self does (`peekInvocation`, then the embedded proof). */
async function peek(token: string) {
  const extracted = await UcantoServer.Delegation.extract(new Uint8Array(Buffer.from(token, 'base64')));
  if (!extracted.ok) throw new Error('not an invocation');
  const inv = extracted.ok;
  return {
    issuer: inv.issuer.did(),
    audience: inv.audience.did(),
    expiration: inv.expiration,
    capabilities: inv.capabilities.map((c) => ({ can: String(c.can), with: String(c.with) })),
    facts: (inv.facts ?? []) as Record<string, unknown>[],
    proofs: inv.proofs as unknown as { issuer: { did(): string }; audience: { did(): string }; cid: unknown }[],
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const selfError = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message: `self says ${code}`, retryable: false },
  ...extra,
});

beforeEach(() => {
  __resetSelfRateLimitsForTest();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

describe('canonicalJson and the body hash', () => {
  it('sorts keys at every depth and writes no spaces', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('keeps array order and primitives', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson({ n: null, t: true, s: 'a b' })).toBe('{"n":null,"s":"a b","t":true}');
  });

  it('does not depend on the order the keys were written in', () => {
    expect(canonicalJson({ requestKey: 'k', offerConsent: 'c' })).toBe(
      canonicalJson({ offerConsent: 'c', requestKey: 'k' }),
    );
    expect(canonicalJson({ requestKey: 'k', offerConsent: 'c' })).toBe('{"offerConsent":"c","requestKey":"k"}');
  });

  it('hashes the canonical form', () => {
    const expected = createHash('sha256').update('{"offerConsent":"c","requestKey":"k"}').digest('hex');
    expect(bodySha256({ requestKey: 'k', offerConsent: 'c' })).toBe(expected);
    expect(bodySha256({ requestKey: 'k', offerConsent: 'c' })).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('request key and input formats', () => {
  it('derives the request key from the person and the nonce', () => {
    const key = deriveRequestKey(PERSON_DID, NONCE);
    expect(key).toBe(createHash('sha256').update(`${PERSON_DID}:${NONCE}`).digest('hex'));
    // Self's own format.
    expect(key).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(deriveRequestKey(PERSON_DID, 'b'.repeat(32))).not.toBe(key);
    expect(deriveRequestKey(OTHER_DID, NONCE)).not.toBe(key);
  });

  it('accepts only well-formed link ids', () => {
    expect(isValidLinkId(LINK_ID)).toBe(true);
    for (const bad of [
      'short',
      '',
      'a'.repeat(65),
      '../../v1/me',
      `${LINK_ID}/cancel`,
      `${LINK_ID}?x=1`,
      'abc def gh',
      12345678,
      null,
      [LINK_ID],
    ]) {
      expect(isValidLinkId(bad)).toBe(false);
    }
  });

  it('accepts only well-formed nonces', () => {
    expect(isValidClientNonce(NONCE)).toBe(true);
    for (const bad of ['short', 'a'.repeat(65), `${'a'.repeat(20)}:x`, 42, undefined])
      expect(isValidClientNonce(bad)).toBe(false);
  });

  it("accepts a link only on Self's own origin", () => {
    expect(isSelfLinkUrl(`${SELF_WEB_URL}/l/abc`)).toBe(true);
    for (const bad of [
      'https://evil.example/l/abc',
      `${SELF_WEB_URL.replace('https://', 'https://x.')}/l/abc`,
      `${SELF_WEB_URL}.evil.example/l/abc`,
      SELF_WEB_URL.replace('https://', 'http://') + '/l/abc',
      SELF_WEB_URL.replace('https://', 'https://user:pw@') + '/l/abc',
      'javascript:alert(1)',
      '/l/abc',
      '',
      undefined,
    ]) {
      expect(isSelfLinkUrl(bad)).toBe(false);
    }
  });

  it('reads the configuration, or null when it is incomplete', () => {
    const env = { SELF_SERVICE_MNEMONIC: ` ${SERVICE_MNEMONIC} `, NEXT_PUBLIC_SELF_SERVICE_DID: SERVICE_DID };
    expect(readSelfConfig(env)).toEqual({ mnemonic: SERVICE_MNEMONIC, serviceDid: SERVICE_DID });
    expect(readSelfConfig({ ...env, SELF_SERVICE_ENTITY_DID: ENTITY_DID })?.entityDid).toBe(ENTITY_DID);
    expect(readSelfConfig({ ...env, SELF_SERVICE_ENTITY_DID: 'did:ixo:entity:nope' })?.entityDid).toBeUndefined();
    expect(readSelfConfig({ ...env, SELF_SERVICE_MNEMONIC: '' })).toBeNull();
    expect(readSelfConfig({ ...env, NEXT_PUBLIC_SELF_SERVICE_DID: '' })).toBeNull();
    expect(readSelfConfig({ ...env, NEXT_PUBLIC_SELF_SERVICE_DID: ENTITY_DID })).toBeNull();
  });

  it('takes the first forwarded address', () => {
    expect(clientIpOf({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '127.0.0.1')).toBe('203.0.113.7');
    expect(clientIpOf({ 'x-forwarded-for': ['203.0.113.8, 10.0.0.1', '10.0.0.2'] }, '127.0.0.1')).toBe('203.0.113.8');
    expect(clientIpOf({}, '127.0.0.1')).toBe('127.0.0.1');
    expect(clientIpOf({}, undefined)).toBe('unknown');
  });

  it("prefers the platform's own header to x-forwarded-for", () => {
    const forwarded = { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' };
    expect(clientIpOf({ ...forwarded, 'x-real-ip': '203.0.113.1' }, '127.0.0.1')).toBe('203.0.113.1');
    expect(
      clientIpOf({ ...forwarded, 'x-real-ip': '203.0.113.1', 'x-nf-client-connection-ip': '203.0.113.2' }, undefined),
    ).toBe('203.0.113.2');
    expect(
      clientIpOf(
        {
          ...forwarded,
          'x-real-ip': '203.0.113.1',
          'x-nf-client-connection-ip': '203.0.113.2',
          'x-vercel-forwarded-for': '203.0.113.3, 10.0.0.9',
        },
        undefined,
      ),
    ).toBe('203.0.113.3');
    // An empty platform header is no answer.
    expect(clientIpOf({ ...forwarded, 'x-real-ip': ' ' }, undefined)).toBe('198.51.100.1');
  });
});

describe('the service key', () => {
  it('signerFromMnemonic derives the key Jambo registers on chain (deriveEd25519KeyPairFromMnemonic)', async () => {
    const { did } = await signerFromMnemonic(SERVICE_MNEMONIC);
    const { publicKey } = deriveEd25519KeyPairFromMnemonic(SERVICE_MNEMONIC);
    expect(did).toBe(`did:key:${publicKeyToMultibase(publicKey)}`);
  });
});

describe('validateLinkDelegation', () => {
  it('accepts the delegation the browser mints and names the person from its issuer', async () => {
    const check = await validateLinkDelegation(await linkDelegation(), SERVICE_DID);
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.personDid).toBe(PERSON_DID);
  });

  const refusals: [string, Parameters<typeof linkDelegation>[0], string][] = [
    ['another audience', { audience: OTHER_DID }, 'wrong_audience'],
    ["Self's own DID as audience", { audience: SELF_AUDIENCE_DID }, 'wrong_audience'],
    [
      'an extra capability',
      { capabilities: [{ ...SELF_LINK_CAPABILITY }, { can: '*', with: 'ixo:identity' }] },
      'not_one_capability',
    ],
    ['another ability', { capabilities: [{ can: 'identity/verify', with: 'ixo:identity' }] }, 'wrong_capability'],
    ['another resource', { capabilities: [{ can: 'identity/link', with: 'ixo:credentials' }] }, 'wrong_capability'],
    ['a caveat', { capabilities: [{ ...SELF_LINK_CAPABILITY, nb: { any: 1 } } as Capability] }, 'wrong_capability'],
    ['proofs', { withProof: true }, 'has_proofs'],
    ['an expiry too far ahead', { ttl: SELF_LINK_DELEGATION_TTL_SECONDS + 600 }, 'too_long'],
    ['no expiry', { ttl: null }, 'no_expiry'],
    ['an expiry in the past', { ttl: -10 }, 'expired'],
    ['an entity DID as issuer', { issuerDid: ENTITY_DID }, 'wrong_issuer'],
    ['the service itself as issuer', { issuerDid: SERVICE_DID }, 'wrong_issuer'],
  ];
  it.each(refusals)('refuses %s', async (_name, overrides, reason) => {
    expect(await validateLinkDelegation(await linkDelegation(overrides), SERVICE_DID)).toEqual({ ok: false, reason });
  });

  it('refuses a did:key issuer', async () => {
    const { signer } = await generateKeypair();
    const delegation = await createDelegation({
      issuer: signer,
      audience: SERVICE_DID,
      capabilities: [{ ...SELF_LINK_CAPABILITY }],
      expiration: nowS() + 60,
    });
    expect(await validateLinkDelegation(await serializeDelegation(delegation), SERVICE_DID)).toEqual({
      ok: false,
      reason: 'wrong_issuer',
    });
  });

  it('allows the clock skew and no more', async () => {
    expect(
      (await validateLinkDelegation(await linkDelegation({ ttl: SELF_LINK_DELEGATION_TTL_SECONDS + 100 }), SERVICE_DID))
        .ok,
    ).toBe(true);
    expect(
      (await validateLinkDelegation(await linkDelegation({ ttl: SELF_LINK_DELEGATION_TTL_SECONDS + 130 }), SERVICE_DID))
        .ok,
    ).toBe(false);
  });

  it('refuses anything that is not a small base64 delegation', async () => {
    for (const bad of [undefined, 42, '', 'not base64!', 'aGVsbG8=', 'A'.repeat(8193), { token: 'x' }]) {
      expect((await validateLinkDelegation(bad, SERVICE_DID)).ok).toBe(false);
    }
  });
});

describe('validateOfferConsent', () => {
  it('accepts the consent the browser mints', async () => {
    expect(await validateOfferConsent(await offerConsent(), PERSON_DID)).toEqual({ ok: true });
  });

  it('refuses another person, audience, type, caveat or lifetime', async () => {
    expect(await validateOfferConsent(await offerConsent({ issuerDid: OTHER_DID }), PERSON_DID)).toEqual({
      ok: false,
      reason: 'wrong_issuer',
    });
    expect(await validateOfferConsent(await offerConsent({ audience: SERVICE_DID }), PERSON_DID)).toEqual({
      ok: false,
      reason: 'wrong_audience',
    });
    expect(
      await validateOfferConsent(await offerConsent({ nb: { vct: ['https://example.com/Other'] } }), PERSON_DID),
    ).toEqual({
      ok: false,
      reason: 'wrong_capability',
    });
    expect(
      await validateOfferConsent(await offerConsent({ nb: { vct: [IDENTITY_LEVEL1_VCT], extra: true } }), PERSON_DID),
    ).toEqual({
      ok: false,
      reason: 'wrong_capability',
    });
    expect(await validateOfferConsent(await offerConsent({ ttl: 40 * 24 * 3600 }), PERSON_DID)).toEqual({
      ok: false,
      reason: 'too_long',
    });
    expect(await validateOfferConsent(await offerConsent({ ttl: -5 }), PERSON_DID)).toEqual({
      ok: false,
      reason: 'expired',
    });
    // A link delegation is not an offer consent.
    expect((await validateOfferConsent(await linkDelegation({ audience: SELF_ISSUER_DID }), PERSON_DID)).ok).toBe(
      false,
    );
  });
});

describe('the offer consent and a clock that is off', () => {
  it('allows a signing clock up to 15 minutes ahead, and no more', async () => {
    const ahead = (seconds: number) => offerConsent({ ttl: SELF_OFFER_CONSENT_TTL_SECONDS + seconds });
    expect(await validateOfferConsent(await ahead(14 * 60), PERSON_DID)).toEqual({ ok: true });
    expect(await validateOfferConsent(await ahead(16 * 60), PERSON_DID)).toEqual({ ok: false, reason: 'too_long' });
  });
});

/**
 * Self's own check of the invocation (ixo-self links/oracle-auth.ts
 * `authenticateOracle`): the @ixo/ucan validator with Self as the server, the
 * person as the only root issuer, both accounts' keys from a resolver, an expiry
 * required and no chain deeper than the person's delegation. No network: the
 * keys come from a local resolver.
 */
describe("the invocation, through Self's validator", () => {
  const capability = defineCapability({ can: SELF_LINK_CAPABILITY.can, protocol: 'ixo:' });

  async function setUp(options: { signedByAnotherKey?: boolean } = {}) {
    const person = await generateKeypair();
    const stranger = await generateKeypair();
    const service = await signerFromMnemonic(SERVICE_MNEMONIC);
    const self = await generateKeypair();
    const keys: Record<string, string> = {
      [PERSON_DID]: person.did,
      [SERVICE_DID]: service.did,
      [SELF_AUDIENCE_DID]: self.did,
    };
    const didResolver: DIDKeyResolver = async (did) =>
      keys[did]
        ? { ok: [keys[did]] as never }
        : { error: { name: 'DIDKeyResolutionError', did, message: `Cannot resolve ${did}` } as never };
    const validator = await createUCANValidator({
      serverDid: SELF_AUDIENCE_DID,
      rootIssuers: [PERSON_DID],
      didResolver,
      invocationStore: new InMemoryInvocationStore(),
      requireExpiration: true,
      proofChainLimits: { maxDepth: 1 },
    });
    // What the browser signs: PERSON_DID as the issuer, by the person's key (or not).
    const signedBy = options.signedByAnotherKey ? stranger : person;
    const token = serializeDelegation(
      await createDelegation({
        issuer: parseSigner(signedBy.privateKey, PERSON_DID as SupportedDID),
        audience: SERVICE_DID,
        capabilities: [{ ...SELF_LINK_CAPABILITY }],
        expiration: nowS() + SELF_LINK_DELEGATION_TTL_SECONDS,
      }),
    );
    // Jambo's route cannot tell the two apart: it does not verify the signature.
    const checked = await validateLinkDelegation(await token, SERVICE_DID);
    if (!checked.ok) throw new Error(`delegation refused: ${checked.reason}`);
    const invocation = await buildSelfInvocation({
      signer: (await signerFromMnemonic(SERVICE_MNEMONIC, SERVICE_DID as SupportedDID)).signer,
      delegation: checked.delegation,
      method: 'GET',
      path: `${SELF_LINKS_PATH}/${LINK_ID}`,
      entityDid: ENTITY_DID,
    });
    const validate = () =>
      validator.validate(invocation, capability, SELF_LINK_CAPABILITY.with, { expect: { ...SELF_LINK_CAPABILITY } });
    return { validate };
  }

  it('validates, with the service as the invoker and the person as the root', async () => {
    const { validate } = await setUp();
    const result = await validate();
    expect(result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.invoker).toBe(SERVICE_DID);
    expect(result.proofChain?.[0]).toBe(PERSON_DID);
    expect(result.capability).toMatchObject({ can: 'identity/link', with: 'ixo:identity' });
    expect(result.facts?.[0]).toEqual({ method: 'GET', path: `/identity/v1/links/${LINK_ID}` });
  });

  it('is refused the second time (single use)', async () => {
    const { validate } = await setUp();
    expect((await validate()).ok).toBe(true);
    const replay = await validate();
    expect(replay.ok).toBe(false);
    expect(replay.error?.code).toBe('REPLAY');
  });

  it("is refused when the delegation was not signed by the person's key", async () => {
    const { validate } = await setUp({ signedByAnotherKey: true });
    const result = await validate();
    expect(result.ok).toBe(false);
    // The only difference from the accepted one is the key that signed the delegation.
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });
});

describe('the invocation', () => {
  it('puts the request binding in one fact, then the entity, then a nonce', () => {
    expect(invocationFacts('POST', SELF_LINKS_PATH, { bodySha256: 'abc', entityDid: ENTITY_DID, nonce: 'n' })).toEqual([
      { method: 'POST', path: '/identity/v1/links', body_sha256: 'abc' },
      { entityDid: ENTITY_DID },
      { nonce: 'n' },
    ]);
    expect(invocationFacts('GET', `${SELF_LINKS_PATH}/${LINK_ID}`, { nonce: 'n' })).toEqual([
      { method: 'GET', path: `/identity/v1/links/${LINK_ID}` },
      { nonce: 'n' },
    ]);
  });

  it('is what Self expects: issuer, audience, one capability, one embedded proof, bound facts, a short life', async () => {
    const serviceSigner = (await signerFromMnemonic(SERVICE_MNEMONIC, SERVICE_DID as SupportedDID)).signer;
    const delegation = await parseDelegation(await linkDelegation());
    const hash = bodySha256({ offerConsent: 'c', requestKey: 'k' });
    const token = await buildSelfInvocation({
      signer: serviceSigner,
      delegation,
      method: 'POST',
      path: SELF_LINKS_PATH,
      bodySha256: hash,
      entityDid: ENTITY_DID,
    });
    expect(token).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    // Self's cap on the bearer.
    expect(token.length).toBeLessThan(32_000);

    const inv = await peek(token);
    expect(inv.issuer).toBe(SERVICE_DID);
    expect(inv.audience).toBe(SELF_AUDIENCE_DID);
    expect(inv.capabilities).toEqual([{ can: 'identity/link', with: 'ixo:identity' }]);
    expect(inv.expiration).toBeGreaterThan(nowS());
    expect(inv.expiration).toBeLessThanOrEqual(nowS() + SELF_INVOCATION_TTL_SECONDS);
    expect(SELF_INVOCATION_TTL_SECONDS).toBeLessThanOrEqual(300);

    // Exactly one proof, embedded in the CAR (a bare CID would have no issuer).
    expect(inv.proofs).toHaveLength(1);
    expect(inv.proofs[0].issuer.did()).toBe(PERSON_DID);
    expect(inv.proofs[0].audience.did()).toBe(SERVICE_DID);
    expect(String(inv.proofs[0].cid)).toBe(String(delegation.cid));

    // Self's `bindingError`: the first fact naming a method or a path must equal the request.
    const binding = inv.facts.find((f) => typeof f.method === 'string' || typeof f.path === 'string');
    expect(binding).toEqual({ method: 'POST', path: '/identity/v1/links', body_sha256: hash });
    expect(inv.facts.some((f) => f.body_sha256 === hash)).toBe(true);
    expect(inv.facts.find((f) => 'entityDid' in f)).toEqual({ entityDid: ENTITY_DID });
    expect(inv.facts.filter((f) => typeof f.nonce === 'string')).toHaveLength(1);
  });

  it('differs every time, so a retry is never a replay', async () => {
    const signer = (await signerFromMnemonic(SERVICE_MNEMONIC, SERVICE_DID as SupportedDID)).signer;
    const delegation = await parseDelegation(await linkDelegation());
    const args = {
      signer,
      delegation,
      method: 'GET' as const,
      path: `${SELF_LINKS_PATH}/${LINK_ID}`,
      nowSeconds: nowS(),
    };
    const [a, b] = await Promise.all([buildSelfInvocation(args), buildSelfInvocation(args)]);
    expect(a).not.toBe(b);
    const inv = await peek(a);
    expect(inv.facts[0]).toEqual({ method: 'GET', path: `/identity/v1/links/${LINK_ID}` });
    expect(inv.facts.some((f) => 'body_sha256' in f)).toBe(false);
  });
});

describe('mapCreateAnswer', () => {
  const created = {
    linkId: LINK_ID,
    url: `${SELF_WEB_URL}/l/token`,
    expiresAt: '2026-11-18T10:15:00.000Z',
    startsLeft: 2,
    startsMax: 3,
    windowHours: 6,
  };

  it('maps a new link', () => {
    expect(mapCreateAnswer({ status: 201, body: created })).toEqual({
      outcome: 'created',
      linkId: LINK_ID,
      url: created.url,
      expiresAt: created.expiresAt,
      startsLeft: 2,
    });
  });

  it('never passes on a link that is not on the Self origin, or a malformed answer', () => {
    for (const body of [
      { ...created, url: 'https://evil.example/l/token' },
      { ...created, url: undefined },
      { ...created, linkId: '../x' },
      { ...created, expiresAt: 'soon' },
      null,
    ]) {
      const result = mapCreateAnswer({ status: 201, body: body as Record<string, unknown> | null });
      expect(result).toMatchObject({ outcome: 'error', code: 'unavailable' });
      expect(JSON.stringify(result)).not.toContain('evil.example');
    }
  });

  it('maps each of the refusals', () => {
    expect(mapCreateAnswer({ status: 409, body: selfError('already_verified') })).toEqual({
      outcome: 'already_verified',
    });
    expect(
      mapCreateAnswer({
        status: 409,
        body: selfError('link_active', { linkId: LINK_ID, status: 'in_progress', expiresAt: created.expiresAt }),
      }),
    ).toEqual({ outcome: 'link_active', linkId: LINK_ID });
    expect(mapCreateAnswer({ status: 409, body: selfError('link_active', { linkId: 'bad id' }) })).toEqual({
      outcome: 'link_active',
    });
    expect(
      mapCreateAnswer({
        status: 429,
        body: selfError('daily_limit', {
          resetsAt: '2026-11-18T15:00:00.000Z',
          retryAfterSeconds: 18000,
          startsLeft: 0,
          startsMax: 3,
          windowHours: 6,
        }),
        retryAfterSeconds: 18000,
      }),
    ).toEqual({
      outcome: 'error',
      code: 'daily_limit',
      message: 'self says daily_limit',
      retryAfterSeconds: 18000,
      resetsAt: '2026-11-18T15:00:00.000Z',
    });
    expect(mapCreateAnswer({ status: 429, body: selfError('rate_limited'), retryAfterSeconds: 60 })).toMatchObject({
      outcome: 'error',
      code: 'rate_limited',
      retryAfterSeconds: 60,
    });
    const codes: [number, string, string][] = [
      [400, 'offer_consent_invalid', 'offer_consent_invalid'],
      [400, 'bad_request', 'bad_request'],
      [413, 'request_too_large', 'bad_request'],
      [401, 'unauthorized', 'unauthorized'],
      [503, 'auth_unavailable', 'unavailable'],
      [500, 'misconfigured', 'unavailable'],
      [500, 'internal', 'unavailable'],
      [418, 'something_new', 'unknown'],
    ];
    for (const [status, selfCode, code] of codes) {
      const result = mapCreateAnswer({ status, body: selfError(selfCode) });
      expect(result).toMatchObject({ outcome: 'error', code });
      // Self's own wording is not passed on (only the daily limit's is).
      expect(JSON.stringify(result)).not.toContain('self says');
    }
  });

  it('maps no answer, and an answer that is not JSON', () => {
    expect(mapCreateAnswer(null)).toMatchObject({ outcome: 'error', code: 'unavailable' });
    expect(mapCreateAnswer({ status: 502, body: null })).toMatchObject({ outcome: 'error', code: 'unavailable' });
    expect(mapCreateAnswer({ status: 401, body: null })).toMatchObject({ outcome: 'error', code: 'unauthorized' });
  });
});

describe('mapStatusAnswer', () => {
  const base = { linkId: LINK_ID, updatedAt: '2026-11-18T10:01:00.000Z', expiresAt: '2026-11-18T10:15:00.000Z' };

  it('maps every status', () => {
    for (const status of ['sent', 'opened', 'in_progress', 'passed', 'failed', 'expired', 'cancelled']) {
      expect(mapStatusAnswer({ status: 200, body: { ...base, status } }, LINK_ID)).toEqual({
        outcome: 'status',
        linkId: LINK_ID,
        status,
        expiresAt: base.expiresAt,
      });
    }
  });

  it('keeps review, saving, failure and the starts left only where they belong', () => {
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, status: 'in_progress', review: true } }, LINK_ID),
    ).toMatchObject({ review: true });
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, status: 'in_progress', saving: true } }, LINK_ID),
    ).toMatchObject({ saving: true });
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, status: 'passed', review: true, saving: 'yes' } }, LINK_ID),
    ).not.toHaveProperty('review');
    expect(
      mapStatusAnswer(
        {
          status: 200,
          body: {
            ...base,
            status: 'failed',
            failure: 'too_many_attempts',
            failureReason: 'too_many_photos',
            startsLeft: 1,
          },
        },
        LINK_ID,
      ),
    ).toEqual({
      outcome: 'status',
      linkId: LINK_ID,
      status: 'failed',
      failure: 'too_many_attempts',
      expiresAt: base.expiresAt,
      startsLeft: 1,
    });
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, status: 'failed', failure: 'other' } }, LINK_ID),
    ).not.toHaveProperty('failure');
  });

  it('passes on a start refused for the daily limit: the code and when it resets, nothing else', () => {
    const limit = {
      code: 'daily_limit',
      resetsAt: '2026-11-18T16:00:00.000Z',
      startsLeft: 0,
      startsResetAt: '2026-11-18T16:00:00.000Z',
      note: 'not passed on',
    };
    const answer = mapStatusAnswer({ status: 200, body: { ...base, status: 'opened', limit, startsLeft: 0 } }, LINK_ID);
    expect(answer).toEqual({
      outcome: 'status',
      linkId: LINK_ID,
      status: 'opened',
      expiresAt: base.expiresAt,
      startsLeft: 0,
      limit: { code: 'daily_limit', resetsAt: limit.resetsAt },
    });
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, status: 'sent', limit: { code: 'daily_limit' } } }, LINK_ID),
    ).toMatchObject({ limit: { code: 'daily_limit' } });
    // A malformed time is left out; an unknown code, or a link that is no longer waiting to start, has no limit.
    expect(
      mapStatusAnswer(
        { status: 200, body: { ...base, status: 'opened', limit: { code: 'daily_limit', resetsAt: 'soon' } } },
        LINK_ID,
      ),
    ).toMatchObject({ limit: { code: 'daily_limit' } });
    for (const body of [
      { ...base, status: 'opened', limit: { code: 'other', resetsAt: limit.resetsAt } },
      { ...base, status: 'opened', limit: 'daily_limit' },
      { ...base, status: 'opened', limit: [limit] },
      { ...base, status: 'in_progress', limit },
      { ...base, status: 'failed', limit },
    ]) {
      expect(mapStatusAnswer({ status: 200, body }, LINK_ID)).not.toHaveProperty('limit');
    }
  });

  it('refuses an answer about another link or with an unknown status', () => {
    expect(
      mapStatusAnswer({ status: 200, body: { ...base, linkId: 'another-link-id', status: 'sent' } }, LINK_ID),
    ).toMatchObject({ code: 'unavailable' });
    expect(mapStatusAnswer({ status: 200, body: { ...base, status: 'weird' } }, LINK_ID)).toMatchObject({
      code: 'unavailable',
    });
  });

  it('maps the refusals', () => {
    const codes: [number, string, string][] = [
      [404, 'not_found', 'not_found'],
      [401, 'unauthorized', 'unauthorized'],
      [429, 'rate_limited', 'rate_limited'],
      [503, 'auth_unavailable', 'unavailable'],
      [500, 'misconfigured', 'unavailable'],
    ];
    for (const [status, selfCode, code] of codes) {
      expect(mapStatusAnswer({ status, body: selfError(selfCode) }, LINK_ID)).toMatchObject({ outcome: 'error', code });
    }
    expect(mapStatusAnswer(null, LINK_ID)).toMatchObject({ outcome: 'error', code: 'unavailable' });
  });
});

describe('handleCreateLink', () => {
  const created = {
    linkId: LINK_ID,
    url: `${SELF_WEB_URL}/l/secret-token`,
    expiresAt: '2026-11-18T10:15:00.000Z',
    startsLeft: 3,
    startsMax: 3,
    windowHours: 6,
  };

  it('answers 503 when it is not configured, before anything else', async () => {
    const fetchImpl = vi.fn();
    const answer = await handleCreateLink({ body: {}, ip: '1.1.1.1' }, { config: null, fetchImpl });
    expect(answer.status).toBe(503);
    expect(answer.body).toMatchObject({ outcome: 'error', code: 'not_configured' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends Self one request it will accept, and returns the link', async () => {
    const consent = await offerConsent();
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(201, created));
    const answer = await handleCreateLink(
      { body: { linkDelegation: await linkDelegation(), offerConsent: consent, nonce: NONCE }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl },
    );
    expect(answer).toEqual({
      status: 200,
      body: { outcome: 'created', linkId: LINK_ID, url: created.url, expiresAt: created.expiresAt, startsLeft: 3 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${SELF_API_URL}/identity/v1/links`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('error');
    const headers = init.headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    const requestKey = deriveRequestKey(PERSON_DID, NONCE);
    expect(JSON.parse(init.body as string)).toEqual({ offerConsent: consent, requestKey });

    // The invocation is bound to exactly the bytes that were sent.
    const inv = await peek(headers.authorization.replace(/^Bearer /, ''));
    expect(inv.issuer).toBe(SERVICE_DID);
    expect(inv.audience).toBe(SELF_AUDIENCE_DID);
    expect(inv.proofs).toHaveLength(1);
    expect(inv.proofs[0].issuer.did()).toBe(PERSON_DID);
    expect(inv.facts[0]).toEqual({
      method: 'POST',
      path: '/identity/v1/links',
      body_sha256: createHash('sha256')
        .update(init.body as string)
        .digest('hex'),
    });
    expect(inv.facts[0].body_sha256).toBe(bodySha256(JSON.parse(init.body as string)));
    expect(inv.facts).toContainEqual({ entityDid: ENTITY_DID });
  });

  it('never logs the link, a token or a DID', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const link = await linkDelegation();
    const consent = await offerConsent();
    await handleCreateLink(
      { body: { linkDelegation: link, offerConsent: consent, nonce: NONCE }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: async () => jsonResponse(201, created) },
    );
    const logged = info.mock.calls.flat().join(' ');
    expect(logged).toContain('created');
    for (const secret of ['secret-token', created.url, link, consent, PERSON_DID, SERVICE_MNEMONIC, LINK_ID]) {
      expect(logged).not.toContain(secret);
    }
  });

  it('refuses bad input with 400 and does not call Self', async () => {
    const fetchImpl = vi.fn();
    const good = { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE };
    const bodies: unknown[] = [
      null,
      'text',
      [],
      { ...good, nonce: 'short' },
      { ...good, nonce: undefined },
      { ...good, linkDelegation: await linkDelegation({ audience: OTHER_DID }) },
      { ...good, linkDelegation: 42 },
      { ...good, offerConsent: await offerConsent({ issuerDid: OTHER_DID }) },
      { ...good, offerConsent: undefined },
      // The two tokens swapped.
      { ...good, linkDelegation: good.offerConsent, offerConsent: good.linkDelegation },
    ];
    for (const [i, body] of bodies.entries()) {
      const answer = await handleCreateLink({ body, ip: `10.0.0.${i}` }, { config: CONFIG, fetchImpl });
      expect(answer.status).toBe(400);
      expect(answer.body).toMatchObject({ outcome: 'error', code: 'bad_request' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('answers clock_skew, not bad_request, when only the expiry is off', async () => {
    const fetchImpl = vi.fn();
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const good = { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE };
    const bodies = [
      // Signed by a clock 10 minutes behind, and one 10 minutes ahead.
      { ...good, linkDelegation: await linkDelegation({ ttl: SELF_LINK_DELEGATION_TTL_SECONDS - 600 }) },
      { ...good, linkDelegation: await linkDelegation({ ttl: SELF_LINK_DELEGATION_TTL_SECONDS + 600 }) },
      { ...good, offerConsent: await offerConsent({ ttl: -600 }) },
      { ...good, offerConsent: await offerConsent({ ttl: SELF_OFFER_CONSENT_TTL_SECONDS + 3600 }) },
    ];
    for (const [i, body] of bodies.entries()) {
      const answer = await handleCreateLink({ body, ip: `10.1.0.${i}` }, { config: CONFIG, fetchImpl });
      expect(answer.status).toBe(400);
      expect(answer.body).toMatchObject({ outcome: 'error', code: 'clock_skew' });
      expect((answer.body as { message: string }).message).toMatch(/date and time/);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(info.mock.calls.map((c) => c[0])).toEqual([
      '[self-link] create clock_skew (link_expired)',
      '[self-link] create clock_skew (link_too_long)',
      '[self-link] create clock_skew (consent_expired)',
      '[self-link] create clock_skew (consent_too_long)',
    ]);
  });

  it('logs a delegation for another audience as a service DID mismatch', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const body = {
      linkDelegation: await linkDelegation({ audience: OTHER_DID }),
      offerConsent: await offerConsent(),
      nonce: NONCE,
    };
    const answer = await handleCreateLink({ body, ip: '10.1.1.1' }, { config: CONFIG, fetchImpl: vi.fn() });
    expect(answer.body).toMatchObject({ outcome: 'error', code: 'bad_request' });
    const logged = String(info.mock.calls[0][0]);
    expect(logged).toContain('create bad_request (service_did_mismatch');
    expect(logged).toContain('NEXT_PUBLIC_SELF_SERVICE_DID');
    expect(logged).not.toContain('did:ixo');
  });

  it('maps a check already running, with or without its link id', async () => {
    const run = async (extra: Record<string, unknown>) =>
      (
        await handleCreateLink(
          {
            body: { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE },
            ip: '10.1.2.1',
          },
          { config: CONFIG, fetchImpl: async () => jsonResponse(409, selfError('link_active', extra)) },
        )
      ).body;
    expect(await run({ linkId: LINK_ID, status: 'opened' })).toEqual({ outcome: 'link_active', linkId: LINK_ID });
    expect(await run({})).toEqual({ outcome: 'link_active' });
    expect(await run({ linkId: '../../x' })).toEqual({ outcome: 'link_active' });
  });

  it('drops an oversized answer without reading it all', async () => {
    const body = { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE };
    const big = JSON.stringify({ ...created, padding: 'x'.repeat(20_000) });

    // Declared too large: nothing is read.
    let pulled = 0;
    const declared = new Response(
      new ReadableStream({
        pull(controller) {
          pulled += 1;
          controller.enqueue(new TextEncoder().encode(big));
          controller.close();
        },
      }),
      { status: 201, headers: { 'content-length': String(big.length) } },
    );
    const first = await handleCreateLink({ body, ip: '10.1.3.1' }, { config: CONFIG, fetchImpl: async () => declared });
    expect(first.body).toMatchObject({ outcome: 'error', code: 'unavailable' });
    expect(pulled).toBeLessThanOrEqual(1);

    // Not declared (chunked): reading stops at the cap.
    let chunks = 0;
    const endless = new Response(
      new ReadableStream({
        pull(controller) {
          chunks += 1;
          controller.enqueue(new TextEncoder().encode('x'.repeat(4096)));
        },
      }),
      { status: 201 },
    );
    const second = await handleCreateLink(
      { body: { ...body, linkDelegation: await linkDelegation() }, ip: '10.1.3.2' },
      { config: CONFIG, fetchImpl: async () => endless },
    );
    expect(second.body).toMatchObject({ outcome: 'error', code: 'unavailable' });
    expect(chunks).toBeLessThan(10);
  });

  it('answers 200 with the outcome for the refusals Self makes, and does not retry', async () => {
    const cases: [Response, Record<string, unknown>][] = [
      [jsonResponse(409, selfError('already_verified')), { outcome: 'already_verified' }],
      [
        jsonResponse(409, selfError('link_active', { linkId: LINK_ID, status: 'in_progress' })),
        { outcome: 'link_active', linkId: LINK_ID },
      ],
      [
        jsonResponse(429, selfError('daily_limit', { resetsAt: '2026-11-18T15:00:00.000Z', retryAfterSeconds: 5 })),
        { outcome: 'error', code: 'daily_limit' },
      ],
      [
        jsonResponse(503, selfError('auth_unavailable'), { 'retry-after': '30' }),
        { outcome: 'error', code: 'unavailable' },
      ],
      [jsonResponse(201, { ...created, url: 'https://evil.example/l/x' }), { outcome: 'error', code: 'unavailable' }],
      [new Response('<html>bad gateway</html>', { status: 502 }), { outcome: 'error', code: 'unavailable' }],
    ];
    for (const [i, [response, expected]] of cases.entries()) {
      const fetchImpl = vi.fn(async () => response);
      const answer = await handleCreateLink(
        {
          body: { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE },
          ip: `10.1.0.${i}`,
        },
        { config: CONFIG, fetchImpl },
      );
      expect(answer.status).toBe(200);
      expect(answer.body).toMatchObject(expected);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it('answers unavailable when Self cannot be reached', async () => {
    __resetSelfRateLimitsForTest();
    const answer = await handleCreateLink(
      {
        body: { linkDelegation: await linkDelegation(), offerConsent: await offerConsent(), nonce: NONCE },
        ip: '1.1.1.1',
      },
      {
        config: CONFIG,
        fetchImpl: async () => {
          throw new Error('network down');
        },
      },
    );
    expect(answer).toMatchObject({ status: 200, body: { outcome: 'error', code: 'unavailable' } });
  });

  it('limits requests per address and per person', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409, selfError('already_verified')));
    const body = async () => ({
      linkDelegation: await linkDelegation(),
      offerConsent: await offerConsent(),
      nonce: NONCE,
    });
    // Per person: the same DID from one address.
    for (let i = 0; i < 10; i++) {
      expect(
        (await handleCreateLink({ body: await body(), ip: '10.2.0.1' }, { config: CONFIG, fetchImpl })).status,
      ).toBe(200);
    }
    const byDid = await handleCreateLink({ body: await body(), ip: '10.2.0.1' }, { config: CONFIG, fetchImpl });
    expect(byDid.status).toBe(429);
    expect(byDid.body).toMatchObject({ outcome: 'error', code: 'rate_limited' });
    expect(byDid.retryAfterSeconds).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(10);

    // Per address (60 a minute): even requests that are refused as bad count.
    __resetSelfRateLimitsForTest();
    for (let i = 0; i < 60; i++)
      expect((await handleCreateLink({ body: {}, ip: '9.9.9.9' }, { config: CONFIG, fetchImpl })).status).toBe(400);
    expect((await handleCreateLink({ body: {}, ip: '9.9.9.9' }, { config: CONFIG, fetchImpl })).status).toBe(429);
  });

  it("does not let another address spend a person's allowance", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(409, selfError('already_verified')));
    // Anyone can NAME the person as the issuer: the signature is not checked here. (These are
    // signed by a random key, as an attacker's would be.)
    const naming = async () => ({
      linkDelegation: await linkDelegation(),
      offerConsent: await offerConsent(),
      nonce: NONCE,
    });
    for (let i = 0; i < 11; i++) {
      await handleCreateLink({ body: await naming(), ip: '203.0.113.66' }, { config: CONFIG, fetchImpl });
    }
    const attacker = await handleCreateLink(
      { body: await naming(), ip: '203.0.113.66' },
      { config: CONFIG, fetchImpl },
    );
    expect(attacker.status).toBe(429);
    // The person, from their own address, is not affected.
    const person = await handleCreateLink({ body: await naming(), ip: '198.51.100.20' }, { config: CONFIG, fetchImpl });
    expect(person.status).toBe(200);

    // The same for the status read (30 a minute per person and address).
    const status = async (ip: string) =>
      (
        await handleLinkStatus(
          { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip },
          { config: CONFIG, fetchImpl: async () => jsonResponse(404, selfError('not_found')) },
        )
      ).status;
    for (let i = 0; i < 30; i++) expect(await status('203.0.113.66')).toBe(200);
    expect(await status('203.0.113.66')).toBe(429);
    expect(await status('198.51.100.20')).toBe(200);
  });
});

describe('handleLinkStatus', () => {
  const status = {
    linkId: LINK_ID,
    status: 'in_progress',
    updatedAt: '2026-11-18T10:01:00.000Z',
    expiresAt: '2026-11-18T10:15:00.000Z',
    review: true,
  };

  it('reads the status with a GET bound to the link path and no body', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => jsonResponse(200, status));
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl },
    );
    expect(answer).toEqual({
      status: 200,
      body: { outcome: 'status', linkId: LINK_ID, status: 'in_progress', review: true, expiresAt: status.expiresAt },
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${SELF_API_URL}/identity/v1/links/${LINK_ID}`);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    const inv = await peek((init.headers as Record<string, string>).authorization.replace(/^Bearer /, ''));
    expect(inv.facts[0]).toEqual({ method: 'GET', path: `/identity/v1/links/${LINK_ID}` });
    expect(inv.proofs).toHaveLength(1);
  });

  it('refuses a bad link id or delegation before calling Self', async () => {
    const fetchImpl = vi.fn();
    const good = { linkDelegation: await linkDelegation() };
    for (const linkId of ['../me', 'x', ['a', 'b'], undefined, `${LINK_ID}/cancel`]) {
      expect(
        (await handleLinkStatus({ linkId, body: good, ip: '1.1.1.1' }, { config: CONFIG, fetchImpl })).status,
      ).toBe(400);
    }
    expect(
      (await handleLinkStatus({ linkId: LINK_ID, body: {}, ip: '1.1.1.1' }, { config: CONFIG, fetchImpl })).status,
    ).toBe(400);
    expect(
      (
        await handleLinkStatus(
          { linkId: LINK_ID, body: { linkDelegation: await linkDelegation({ ttl: 9999 }) }, ip: '1.1.1.1' },
          { config: CONFIG, fetchImpl },
        )
      ).status,
    ).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      (await handleLinkStatus({ linkId: LINK_ID, body: good, ip: '1.1.1.1' }, { config: null, fetchImpl })).status,
    ).toBe(503);
  });

  it('retries a 5xx once, with a fresh invocation', async () => {
    const tokens: string[] = [];
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      tokens.push((init.headers as Record<string, string>).authorization);
      return tokens.length === 1 ? jsonResponse(503, selfError('auth_unavailable')) : jsonResponse(200, status);
    });
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl, retryWaitMs: 0 },
    );
    expect(answer.body).toMatchObject({ outcome: 'status', status: 'in_progress' });
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('gives up after one retry, and does not wait out a long Retry-After', async () => {
    const down = vi.fn(async () => jsonResponse(500, selfError('internal')));
    const failed = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: down, retryWaitMs: 0 },
    );
    expect(failed).toMatchObject({ status: 200, body: { outcome: 'error', code: 'unavailable' } });
    expect(down).toHaveBeenCalledTimes(2);

    const limited = vi.fn(async () => jsonResponse(429, selfError('rate_limited'), { 'retry-after': '60' }));
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: limited, retryWaitMs: 0 },
    );
    expect(answer).toMatchObject({ status: 200, body: { outcome: 'error', code: 'rate_limited' } });
    expect(limited).toHaveBeenCalledTimes(1);
  });

  it('does not retry once the first try has used up the time', async () => {
    let clock = 0;
    const slow = vi.fn(async () => {
      clock += 6_000;
      return jsonResponse(503, selfError('auth_unavailable'));
    });
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: slow, retryWaitMs: 0, nowMs: () => clock },
    );
    expect(answer).toMatchObject({ status: 200, body: { outcome: 'error', code: 'unavailable' } });
    expect(slow).toHaveBeenCalledTimes(1);

    // A first try that failed fast is still followed by one more.
    clock = 0;
    const quick = vi.fn(async () => {
      clock += 1_000;
      return jsonResponse(503, selfError('auth_unavailable'));
    });
    await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: quick, retryWaitMs: 0, nowMs: () => clock },
    );
    expect(quick).toHaveBeenCalledTimes(2);
  });

  it('answers clock_skew for a delegation that is expired or lives too long', async () => {
    const fetchImpl = vi.fn();
    for (const ttl of [-30, SELF_LINK_DELEGATION_TTL_SECONDS + 600]) {
      const answer = await handleLinkStatus(
        { linkId: LINK_ID, body: { linkDelegation: await linkDelegation({ ttl }) }, ip: '1.1.1.1' },
        { config: CONFIG, fetchImpl },
      );
      expect(answer.status).toBe(400);
      expect(answer.body).toMatchObject({ outcome: 'error', code: 'clock_skew' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('passes on a start refused for the daily limit', async () => {
    const resetsAt = '2026-11-18T16:00:00.000Z';
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      {
        config: CONFIG,
        fetchImpl: async () =>
          jsonResponse(200, {
            ...status,
            status: 'opened',
            review: undefined,
            limit: { code: 'daily_limit', resetsAt, startsLeft: 0, startsResetAt: resetsAt },
            startsLeft: 0,
          }),
      },
    );
    expect(answer.body).toEqual({
      outcome: 'status',
      linkId: LINK_ID,
      status: 'opened',
      expiresAt: status.expiresAt,
      startsLeft: 0,
      limit: { code: 'daily_limit', resetsAt },
    });
  });

  it('maps a link Self does not know', async () => {
    const answer = await handleLinkStatus(
      { linkId: LINK_ID, body: { linkDelegation: await linkDelegation() }, ip: '1.1.1.1' },
      { config: CONFIG, fetchImpl: async () => jsonResponse(404, selfError('not_found')) },
    );
    expect(answer).toMatchObject({ status: 200, body: { outcome: 'error', code: 'not_found' } });
  });
});

describe('createRateLimiter', () => {
  it('allows max per window and says when to retry', () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter.take('a', 0)).toEqual({ ok: true });
    expect(limiter.take('a', 10)).toEqual({ ok: true });
    expect(limiter.take('a', 20)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(limiter.take('b', 20)).toEqual({ ok: true });
    expect(limiter.take('a', 1001)).toEqual({ ok: true });
  });

  it('when full, forgets the expired windows first and keeps the live counts', () => {
    const limiter = createRateLimiter(1, 1000, 3);
    limiter.take('old-1', 0);
    limiter.take('old-2', 0);
    limiter.take('live', 900);
    // Full. 'old-1' and 'old-2' have ended by now; 'live' has not.
    expect(limiter.take('new', 1100)).toEqual({ ok: true });
    expect(limiter.take('live', 1100)).toMatchObject({ ok: false });
    expect(limiter.take('new', 1100)).toMatchObject({ ok: false });
    // The forgotten ones simply start again.
    expect(limiter.take('old-1', 1100)).toEqual({ ok: true });
  });

  it('when full of live windows, forgets only the oldest: the others keep their counts', () => {
    const limiter = createRateLimiter(1, 1000, 3);
    limiter.take('a', 0);
    limiter.take('b', 10);
    limiter.take('c', 20);
    expect(limiter.take('d', 30)).toEqual({ ok: true });
    for (const key of ['b', 'c', 'd']) expect(limiter.take(key, 40)).toMatchObject({ ok: false });
    // Only 'a' was pushed out (asking for it again pushes out 'b', the oldest then).
    expect(limiter.take('a', 50)).toEqual({ ok: true });
    for (const key of ['c', 'd', 'a']) expect(limiter.take(key, 60)).toMatchObject({ ok: false });
  });

  it('a renewed window counts as the newest, so the order stays oldest first', () => {
    const limiter = createRateLimiter(1, 1000, 2);
    limiter.take('a', 0);
    limiter.take('b', 500);
    // 'a' ends and starts again: 'b' is now the oldest.
    expect(limiter.take('a', 1200)).toEqual({ ok: true });
    expect(limiter.take('c', 1300)).toEqual({ ok: true });
    expect(limiter.take('a', 1400)).toMatchObject({ ok: false });
    expect(limiter.take('b', 1400)).toEqual({ ok: true });
  });

  it('never holds more keys than its cap', () => {
    const limiter = createRateLimiter(1, 60_000, 50);
    for (let i = 0; i < 500; i++) limiter.take(`flood-${i}`, i);
    // The 50 newest are still counted; the ones before them were forgotten one at a time.
    for (let i = 450; i < 500; i++) expect(limiter.take(`flood-${i}`, 600)).toMatchObject({ ok: false });
  });
});
