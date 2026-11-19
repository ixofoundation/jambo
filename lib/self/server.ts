/**
 * SERVER ONLY: never import this from browser code (it reads the service
 * account's secret, `SELF_SERVICE_MNEMONIC`). The browser side is utils/self/*.
 *
 * Jambo as the requesting service of a Self identity check (ixo-self, "Contract
 * C"; docs/self-kyc-plan.md 4.2 and 5). The browser sends delegations signed by
 * the person's key; this module wraps the `identity/link` one in a UCAN
 * invocation signed by Jambo's service account and calls Self:
 *
 *   POST {SELF_API_URL}/identity/v1/links          body { offerConsent, requestKey }
 *   GET  {SELF_API_URL}/identity/v1/links/:linkId
 *
 * The invocation Self expects (ixo-self worker/src/service/links/oracle-auth.ts):
 * issuer = the service account `did:ixo:ixo1…`, audience = Self's did:web, one
 * capability `identity/link` on `ixo:identity`, expiry at most 5 minutes ahead,
 * exactly one proof (the person's delegation, embedded), and a fact
 * `{ method, path }` naming this request, with `body_sha256` for the POST.
 *
 * Nothing here logs a link URL, a token, a delegation or the mnemonic: only
 * outcome codes.
 */
import { createHash, randomUUID } from 'crypto';

import {
  createInvocation,
  parseDelegation,
  serializeInvocation,
  signerFromMnemonic,
  type Delegation,
  type Fact,
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
import type {
  SelfLinkCreateResult,
  SelfLinkErrorCode,
  SelfLinkState,
  SelfLinkStatus,
  SelfLinkStatusResult,
} from 'types/kyc';
import { createRateLimiter } from './rateLimit';

/** The full path Self binds an invocation to (its `/identity` prefix included). */
export const SELF_LINKS_PATH = '/identity/v1/links';
/** Self refuses an invocation that lives longer than 5 minutes; the working oracle client uses 240 s too. */
export const SELF_INVOCATION_TTL_SECONDS = 240;
/** Self's cap on an offer consent (auth/consent.ts); the link delegation is as small. */
export const MAX_DELEGATION_CHARS = 8192;
/**
 * One request to Self. Under the 10 s a serverless function may get by default
 * (Netlify, Vercel's smallest plan), so the route answers before it is killed.
 */
const UPSTREAM_TIMEOUT_MS = 8_000;
/** The status read is tried again only when the first try took less than this... */
const STATUS_RETRY_WITHIN_MS = 5_000;
/** ...and the second try may only use what is left of this. */
const STATUS_BUDGET_MS = 9_000;
/** Self's answers are a few hundred bytes. */
const MAX_ANSWER_BYTES = 16 * 1024;
/** The same allowance Self gives a delegation's clock. */
const SKEW_SECONDS = 120;
/**
 * The offer consent lives 7 days and Self accepts up to 31, so this bound only
 * stops absurd values: a wide allowance costs nothing.
 */
const CONSENT_SKEW_SECONDS = 15 * 60;

/** A person's (or service's) account DID: never an entity DID. Self's `USER_DID`. */
const ACCOUNT_DID = /^did:ixo:ixo1[0-9a-z]{38}$/;
const ENTITY_DID = /^did:ixo:entity:[0-9a-f]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const LINK_ID = /^[A-Za-z0-9-]{8,64}$/;
const CLIENT_NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const LINK_STATES: readonly SelfLinkState[] = [
  'sent',
  'opened',
  'in_progress',
  'passed',
  'failed',
  'expired',
  'cancelled',
];

// Per minute. Creating a link is rare; reading its status is a poll, about 12 a
// minute per person (Self itself allows 30 a minute per service and link). One
// address can be a whole mobile network (carrier NAT), so the per-address limits
// leave room for some 50 people polling at once; the per-person limits are the
// tight ones.
//
// The per-person buckets are keyed on the person AND the address. The person is
// only the issuer NAMED in the delegation: its signature is checked by Self, not
// here, so on the DID alone anyone could spend somebody else's allowance.
const createByIp = createRateLimiter(60, 60_000);
const createByDid = createRateLimiter(10, 60_000);
const statusByIp = createRateLimiter(600, 60_000);
const statusByDid = createRateLimiter(30, 60_000);

const personKey = (personDid: string, ip: string) => `did:${personDid}|ip:${ip}`;

/** Test seam. */
export function __resetSelfRateLimitsForTest(): void {
  [createByIp, createByDid, statusByIp, statusByDid].forEach((limiter) => limiter.reset());
}

// ── pure helpers ───────────────────────────────────────────────────────────────

/**
 * The form Self hashes for `body_sha256`: object keys sorted at every depth, no
 * spaces. Must stay identical to `canonicalJson` in ixo-self's oracle-auth.ts.
 */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : typeof v === 'object' && v !== null
      ? Object.fromEntries(
          Object.keys(v as Record<string, unknown>)
            .sort()
            .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
        )
      : v;
  return JSON.stringify(sort(value));
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Hex SHA-256 of the body's canonical JSON: the invocation's `body_sha256` fact. */
export function bodySha256(body: unknown): string {
  return sha256Hex(canonicalJson(body));
}

/**
 * Self's `requestKey`, made here so a caller cannot choose it: 64 hex characters,
 * inside Self's `^[A-Za-z0-9._:-]{1,128}$`.
 */
export function deriveRequestKey(personDid: string, clientNonce: string): string {
  return sha256Hex(`${personDid}:${clientNonce}`);
}

/** Checked before a link id is put in a URL. */
export function isValidLinkId(value: unknown): value is string {
  return typeof value === 'string' && LINK_ID.test(value);
}

export function isValidClientNonce(value: unknown): value is string {
  return typeof value === 'string' && CLIENT_NONCE.test(value);
}

function isSerializedDelegation(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_DELEGATION_CHARS && BASE64.test(value);
}

/** A link may only point at Self's own web app (the oracle client's rule: same origin, no credentials). */
export function isSelfLinkUrl(value: unknown, webUrl: string = SELF_WEB_URL): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const expected = new URL(webUrl);
    return url.protocol === 'https:' && url.origin === expected.origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

// ── configuration ──────────────────────────────────────────────────────────────

export type SelfServerConfig = {
  mnemonic: string;
  /** Jambo's service account: the invocation's issuer and the audience of the person's delegation. */
  serviceDid: string;
  /** Optional: the entity Self shows as "who is asking". */
  entityDid?: string;
};

/** null = the Self check is not configured on this deployment (the routes answer 503). */
export function readSelfConfig(env: Record<string, string | undefined> = process.env): SelfServerConfig | null {
  const mnemonic = (env.SELF_SERVICE_MNEMONIC || '').trim();
  const serviceDid = (env.NEXT_PUBLIC_SELF_SERVICE_DID || '').trim();
  if (!mnemonic || !ACCOUNT_DID.test(serviceDid)) return null;
  const entityDid = (env.SELF_SERVICE_ENTITY_DID || '').trim();
  // A malformed entity DID is left out: Self would ignore it anyway (it is only a hint).
  return { mnemonic, serviceDid, ...(ENTITY_DID.test(entityDid) ? { entityDid } : {}) };
}

// The key derivation is a hash and a scalar multiplication: do it once per instance.
let cachedSigner: { key: string; signer: Promise<Signer> } | null = null;

function serviceSigner(config: SelfServerConfig): Promise<Signer> {
  const key = `${config.serviceDid}:${sha256Hex(config.mnemonic)}`;
  if (!cachedSigner || cachedSigner.key !== key) {
    const signer = signerFromMnemonic(config.mnemonic, config.serviceDid as SupportedDID).then((s) => s.signer);
    // A failed derivation is not kept.
    signer.catch(() => {
      if (cachedSigner?.key === key) cachedSigner = null;
    });
    cachedSigner = { key, signer };
  }
  return cachedSigner.signer;
}

// ── the person's delegations ───────────────────────────────────────────────────

export type DelegationCheck =
  | { ok: true; delegation: Delegation; personDid: string }
  /** `reason` is a fixed code for the log, never caller data. */
  | { ok: false; reason: string };

/**
 * The reasons that are about time only: everything else in the delegation was
 * right. The usual cause is the signing device's clock, so the routes answer
 * `clock_skew` (the browser then re-reads the server's time and signs again)
 * and not `bad_request`.
 */
const EXPIRY_REASONS: readonly string[] = ['expired', 'too_long'];

/** The refusal for a delegation that failed its check: a clock problem, or a bad request. */
const delegationRefusal = (reason: string): 'clock_skew' | 'bad_request' =>
  EXPIRY_REASONS.includes(reason) ? 'clock_skew' : 'bad_request';

/**
 * The person's `identity/link` delegation, checked BEFORE the service key signs
 * anything, so this route cannot be used to sign for another audience, another
 * capability or a long-lived grant. The person is whoever issued it; nothing
 * else in the request names them. The signature itself is verified by Self,
 * against the person's DID document on chain.
 */
export async function validateLinkDelegation(
  token: unknown,
  serviceDid: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<DelegationCheck> {
  if (!isSerializedDelegation(token)) return { ok: false, reason: 'not_base64' };
  let delegation: Delegation;
  try {
    delegation = await parseDelegation(token);
  } catch {
    return { ok: false, reason: 'not_a_delegation' };
  }
  try {
    const personDid = delegation.issuer.did();
    if (!ACCOUNT_DID.test(personDid) || personDid === serviceDid) return { ok: false, reason: 'wrong_issuer' };
    if (delegation.audience.did() !== serviceDid) return { ok: false, reason: 'wrong_audience' };
    if (delegation.proofs.length > 0) return { ok: false, reason: 'has_proofs' };
    const caps = delegation.capabilities as { can: string; with: string; nb?: unknown }[];
    if (caps.length !== 1) return { ok: false, reason: 'not_one_capability' };
    const [cap] = caps;
    const caveats = cap.nb && typeof cap.nb === 'object' ? Object.keys(cap.nb as object).length : 0;
    if (cap.can !== SELF_LINK_CAPABILITY.can || cap.with !== SELF_LINK_CAPABILITY.with || caveats > 0) {
      return { ok: false, reason: 'wrong_capability' };
    }
    const exp = delegation.expiration;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return { ok: false, reason: 'no_expiry' };
    if (exp <= nowSeconds) return { ok: false, reason: 'expired' };
    if (exp > nowSeconds + SELF_LINK_DELEGATION_TTL_SECONDS + SKEW_SECONDS) return { ok: false, reason: 'too_long' };
    return { ok: true, delegation, personDid };
  } catch {
    return { ok: false, reason: 'not_a_delegation' };
  }
}

/**
 * The offer consent's shape, as Self checks it (auth/consent.ts), so a wrong one
 * is refused here and does not spend a request at Self. Self verifies the
 * signature; this route only forwards the token.
 */
export async function validateOfferConsent(
  token: unknown,
  personDid: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  issuerDid: string = SELF_ISSUER_DID,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!isSerializedDelegation(token)) return { ok: false, reason: 'not_base64' };
  try {
    const delegation = await parseDelegation(token);
    if (delegation.proofs.length > 0) return { ok: false, reason: 'has_proofs' };
    if (delegation.issuer.did() !== personDid) return { ok: false, reason: 'wrong_issuer' };
    if (delegation.audience.did() !== issuerDid) return { ok: false, reason: 'wrong_audience' };
    const caps = delegation.capabilities as { can: string; with: string; nb?: unknown }[];
    if (caps.length !== 1) return { ok: false, reason: 'not_one_capability' };
    const [cap] = caps;
    const nb = cap.nb as { vct?: unknown } | undefined;
    if (
      cap.can !== SELF_OFFER_CAPABILITY.can ||
      cap.with !== SELF_OFFER_CAPABILITY.with ||
      typeof nb !== 'object' ||
      nb === null ||
      Array.isArray(nb) ||
      Object.keys(nb).length !== 1 ||
      !Array.isArray(nb.vct) ||
      nb.vct.length !== 1 ||
      nb.vct[0] !== IDENTITY_LEVEL1_VCT
    ) {
      return { ok: false, reason: 'wrong_capability' };
    }
    const exp = delegation.expiration;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return { ok: false, reason: 'no_expiry' };
    if (exp <= nowSeconds) return { ok: false, reason: 'expired' };
    if (exp > nowSeconds + SELF_OFFER_CONSENT_TTL_SECONDS + CONSENT_SKEW_SECONDS) {
      return { ok: false, reason: 'too_long' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'not_a_delegation' };
  }
}

// ── the invocation ─────────────────────────────────────────────────────────────

/**
 * The invocation's facts, as ixo-self reads them (auth/ucan.ts `bindingError`,
 * oracle-auth.ts `authenticateOracle` and `hintsOf`):
 *   1. ONE object `{ method, path }` (method upper-case, the full path), plus
 *      `body_sha256` in that same object for a request with a body;
 *   2. optionally `{ entityDid }`;
 *   3. `{ nonce }`: Self spends each invocation's CID once, and signatures are
 *      deterministic, so two requests in the same second (a retry, two tabs
 *      polling) would otherwise be the same invocation and the second a replay.
 */
export function invocationFacts(
  method: 'GET' | 'POST',
  path: string,
  options: { bodySha256?: string; entityDid?: string; nonce?: string } = {},
): Fact[] {
  return [
    options.bodySha256 ? { method, path, body_sha256: options.bodySha256 } : { method, path },
    ...(options.entityDid ? [{ entityDid: options.entityDid }] : []),
    { nonce: options.nonce ?? randomUUID() },
  ];
}

/** One single-use invocation for one request to Self, serialized for `Authorization: Bearer`. */
export async function buildSelfInvocation(args: {
  signer: Signer;
  /** The person's validated `identity/link` delegation: the only proof. */
  delegation: Delegation;
  method: 'GET' | 'POST';
  path: string;
  bodySha256?: string;
  entityDid?: string;
  audience?: string;
  nowSeconds?: number;
}): Promise<string> {
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const invocation = await createInvocation({
    issuer: args.signer,
    audience: args.audience ?? SELF_AUDIENCE_DID,
    capability: { ...SELF_LINK_CAPABILITY },
    proofs: [args.delegation],
    expiration: now + SELF_INVOCATION_TTL_SECONDS,
    facts: invocationFacts(args.method, args.path, { bodySha256: args.bodySha256, entityDid: args.entityDid }),
  });
  return serializeInvocation(invocation);
}

// ── Self's answers ─────────────────────────────────────────────────────────────

/** One answer from Self; `null` body = not JSON (or too large). */
export type SelfAnswer = { status: number; body: Record<string, unknown> | null; retryAfterSeconds?: number };

const MESSAGES: Record<SelfLinkErrorCode | 'not_found', string> = {
  not_configured: 'The identity check is not available here yet.',
  daily_limit: "You've used your tries for now. Please try again in a few hours.",
  rate_limited: 'Too many requests. Please wait a minute and try again.',
  offer_consent_invalid: "We couldn't confirm your permission to save the credential. Please try again.",
  unauthorized: "We couldn't confirm it's you. Please sign in again and retry.",
  clock_skew: "Your device's date and time look wrong. Please set them to automatic and try again.",
  unavailable: "The identity check can't be reached right now. Please try again in a minute.",
  bad_request: 'That request was not valid. Please try again.',
  not_found: "We couldn't find this identity check.",
  unknown: 'Something went wrong. Please try again.',
};

type ErrorResult<C extends string> = { outcome: 'error'; code: C; message: string };

function errorResult<C extends SelfLinkErrorCode | 'not_found'>(code: C): ErrorResult<C> {
  return { outcome: 'error', code, message: MESSAGES[code] };
}

function selfErrorCode(answer: SelfAnswer): string {
  const error = answer.body?.error;
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' ? code : '';
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function isoTime(value: unknown): string | undefined {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/** Self's refusals that mean the same for a create and a status read. */
function commonError(answer: SelfAnswer): ErrorResult<SelfLinkErrorCode> & { retryAfterSeconds?: number } {
  const code = selfErrorCode(answer);
  if (code === 'unauthorized' || answer.status === 401 || answer.status === 403) return errorResult('unauthorized');
  if (code === 'rate_limited' || code === 'service_busy' || answer.status === 429) {
    const retryAfterSeconds = positiveInt(answer.retryAfterSeconds);
    return { ...errorResult('rate_limited'), ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) };
  }
  if (code === 'bad_request' || code === 'request_too_large' || answer.status === 400 || answer.status === 413) {
    return errorResult('bad_request');
  }
  // `auth_unavailable` (Self cannot reach the chain index or the revocation store), `misconfigured`, any 5xx.
  if (code === 'auth_unavailable' || answer.status >= 500) return errorResult('unavailable');
  return errorResult('unknown');
}

/** Self's answer to `POST /identity/v1/links`, in Jambo's terms. `null` = Self was not reached. */
export function mapCreateAnswer(answer: SelfAnswer | null, webUrl: string = SELF_WEB_URL): SelfLinkCreateResult {
  if (!answer) return errorResult('unavailable');
  const { status, body } = answer;
  if (status === 201 || status === 200) {
    const expiresAt = isoTime(body?.expiresAt);
    // A link that is not on Self's own origin is never passed on.
    if (!body || !isValidLinkId(body.linkId) || !expiresAt || !isSelfLinkUrl(body.url, webUrl)) {
      return errorResult('unavailable');
    }
    const startsLeft = positiveInt(body.startsLeft);
    return {
      outcome: 'created',
      linkId: body.linkId,
      url: body.url,
      expiresAt,
      ...(startsLeft !== undefined ? { startsLeft } : {}),
    };
  }
  const code = selfErrorCode(answer);
  if (code === 'already_verified') return { outcome: 'already_verified' };
  // Beside the error Self names the open link: `{ linkId, status, expiresAt }` (link-do.ts `create`).
  if (code === 'link_active') {
    return { outcome: 'link_active', ...(isValidLinkId(body?.linkId) ? { linkId: body?.linkId as string } : {}) };
  }
  if (code === 'daily_limit') {
    // Self's sentence says how long to wait ("…try again in about 5 hours.").
    const said = (body?.error as { message?: unknown } | undefined)?.message;
    const retryAfterSeconds = positiveInt(body?.retryAfterSeconds) ?? positiveInt(answer.retryAfterSeconds);
    const resetsAt = isoTime(body?.resetsAt);
    return {
      outcome: 'error',
      code: 'daily_limit',
      message: typeof said === 'string' && said.length > 0 && said.length <= 300 ? said : MESSAGES.daily_limit,
      ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      ...(resetsAt ? { resetsAt } : {}),
    };
  }
  if (code === 'offer_consent_invalid') return errorResult('offer_consent_invalid');
  return commonError(answer);
}

/** Self's answer to `GET /identity/v1/links/:linkId`, in Jambo's terms. `null` = Self was not reached. */
export function mapStatusAnswer(answer: SelfAnswer | null, linkId: string): SelfLinkStatusResult {
  if (!answer) return errorResult('unavailable');
  const { status, body } = answer;
  if (status === 200) {
    const state = body?.status as SelfLinkState;
    if (!body || body.linkId !== linkId || !LINK_STATES.includes(state)) return errorResult('unavailable');
    const expiresAt = isoTime(body.expiresAt);
    const startsLeft = positiveInt(body.startsLeft);
    const failure = body.failure === 'error' || body.failure === 'too_many_attempts' ? body.failure : undefined;
    // A start refused for the daily limit: Self keeps the link open and says so here
    // (routes/links.ts `statusAnswer`: `limit: { code, resetsAt, startsLeft, startsResetAt }`).
    const limited = fieldsOf(body.limit);
    const resetsAt = isoTime(limited?.resetsAt);
    const link: SelfLinkStatus = {
      linkId,
      status: state,
      // Self sends each of these only as `true`, and only beside the status it belongs to.
      ...(body.review === true && state === 'in_progress' ? { review: true } : {}),
      ...(body.saving === true && state === 'in_progress' ? { saving: true } : {}),
      ...(failure && state === 'failed' ? { failure } : {}),
      ...(expiresAt ? { expiresAt } : {}),
      ...(startsLeft !== undefined ? { startsLeft } : {}),
      ...(limited?.code === 'daily_limit' && (state === 'sent' || state === 'opened')
        ? { limit: { code: 'daily_limit' as const, ...(resetsAt ? { resetsAt } : {}) } }
        : {}),
    };
    return { outcome: 'status', ...link };
  }
  // Also Self's answer for a link another service made.
  if (selfErrorCode(answer) === 'not_found' || status === 404) return errorResult('not_found');
  const { outcome, code, message } = commonError(answer);
  return { outcome, code, message };
}

// ── calling Self ───────────────────────────────────────────────────────────────

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * The answer's text, read with a cap: an oversized answer is dropped without
 * being read into memory. `null` = too large.
 */
async function readCapped(response: Response): Promise<string | null> {
  const declared = Number(response.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_ANSWER_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  // The header can be absent (chunked) or wrong: the bytes are counted as they arrive.
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_ANSWER_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** One request to Self, at most `timeoutMs`. `null` = no answer (network failure or timeout). */
async function callSelf(
  fetchImpl: FetchLike,
  method: 'GET' | 'POST',
  path: string,
  invocation: string,
  body?: string,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS,
): Promise<SelfAnswer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${SELF_API_URL}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${invocation}`,
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      // The bearer is never carried to another address.
      redirect: 'error',
      signal: controller.signal,
    });
    const text = await readCapped(response);
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }
    const retryAfter = (response.headers.get('retry-after') || '').trim();
    return {
      status: response.status,
      body:
        typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null,
      ...(/^\d{1,6}$/.test(retryAfter) ? { retryAfterSeconds: Number(retryAfter) } : {}),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── the routes ─────────────────────────────────────────────────────────────────

export type RouteAnswer<T> = { status: number; body: T; retryAfterSeconds?: number };
type RouteDeps = { config?: SelfServerConfig | null; fetchImpl?: FetchLike };

/**
 * The person's delegation names another audience than this deployment's service
 * account. From Jambo's own page that is a deployment fault, so the log says
 * where to look: NEXT_PUBLIC_SELF_SERVICE_DID is inlined into the browser bundle
 * at build time and read here at run time, and the two must be the same account.
 */
const AUDIENCE_MISMATCH = 'service_did_mismatch: is NEXT_PUBLIC_SELF_SERVICE_DID the same at build and at run time?';

/** The log detail for a refused link delegation: a fixed code, never caller data. */
const linkRefusalDetail = (reason: string) => (reason === 'wrong_audience' ? AUDIENCE_MISMATCH : `link_${reason}`);

/** Outcome codes only: never a URL, a token or a DID. */
function logOutcome(route: 'create' | 'status', outcome: string, detail?: string | number): void {
  console.info(`[self-link] ${route} ${outcome}${detail !== undefined ? ` (${detail})` : ''}`);
}

function refused<C extends SelfLinkErrorCode>(status: number, code: C, retryAfterSeconds?: number) {
  return {
    status,
    body: { ...errorResult(code), ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) },
    ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
  };
}

function fieldsOf(body: unknown): Record<string, unknown> | null {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/**
 * `POST /api/self/links`, body `{ linkDelegation, offerConsent, nonce }`.
 *
 * Expected outcomes (created, already verified, a check already running, Self's
 * own refusals) answer 200 with the union; only a bad request or a delegation
 * signed by a clock that is off (400), this route's rate limit (429) and missing
 * configuration (503) use an error status.
 */
export async function handleCreateLink(
  input: { body: unknown; ip: string },
  deps: RouteDeps = {},
): Promise<RouteAnswer<SelfLinkCreateResult>> {
  const config = deps.config !== undefined ? deps.config : readSelfConfig();
  if (!config) {
    logOutcome('create', 'not_configured');
    return refused(503, 'not_configured');
  }
  const byIp = createByIp.take(`ip:${input.ip}`);
  if (!byIp.ok) {
    logOutcome('create', 'rate_limited', 'ip');
    return refused(429, 'rate_limited', byIp.retryAfterSeconds);
  }

  const fields = fieldsOf(input.body);
  if (!fields || !isValidClientNonce(fields.nonce)) {
    logOutcome('create', 'bad_request', 'fields');
    return refused(400, 'bad_request');
  }
  const link = await validateLinkDelegation(fields.linkDelegation, config.serviceDid);
  if (!link.ok) {
    const code = delegationRefusal(link.reason);
    logOutcome('create', code, linkRefusalDetail(link.reason));
    return refused(400, code);
  }
  const consent = await validateOfferConsent(fields.offerConsent, link.personDid);
  if (!consent.ok) {
    const code = delegationRefusal(consent.reason);
    logOutcome('create', code, `consent_${consent.reason}`);
    return refused(400, code);
  }
  const byDid = createByDid.take(personKey(link.personDid, input.ip));
  if (!byDid.ok) {
    logOutcome('create', 'rate_limited', 'did');
    return refused(429, 'rate_limited', byDid.retryAfterSeconds);
  }

  let answer: SelfAnswer | null;
  try {
    const body = {
      offerConsent: fields.offerConsent as string,
      requestKey: deriveRequestKey(link.personDid, fields.nonce),
    };
    // The bytes sent are the bytes hashed.
    const text = canonicalJson(body);
    const invocation = await buildSelfInvocation({
      signer: await serviceSigner(config),
      delegation: link.delegation,
      method: 'POST',
      path: SELF_LINKS_PATH,
      bodySha256: sha256Hex(text),
      entityDid: config.entityDid,
    });
    // Sent once: the invocation is single use, and a blind retry could make a second link.
    answer = await callSelf(deps.fetchImpl ?? fetch, 'POST', SELF_LINKS_PATH, invocation, text);
  } catch {
    logOutcome('create', 'error', 'signing');
    return { status: 200, body: errorResult('unknown') };
  }

  const result = mapCreateAnswer(answer);
  logOutcome('create', result.outcome === 'error' ? result.code : result.outcome, answer?.status ?? 'no_answer');
  return { status: 200, body: result };
}

/**
 * `POST /api/self/links/:linkId`, body `{ linkDelegation }` (a POST so the
 * delegation travels in the body, not in a URL or header that gets logged).
 */
export async function handleLinkStatus(
  input: { linkId: unknown; body: unknown; ip: string },
  deps: RouteDeps & { retryWaitMs?: number; nowMs?: () => number } = {},
): Promise<RouteAnswer<SelfLinkStatusResult>> {
  const nowMs = deps.nowMs ?? Date.now;
  const startedAt = nowMs();
  const config = deps.config !== undefined ? deps.config : readSelfConfig();
  if (!config) {
    logOutcome('status', 'not_configured');
    return refused(503, 'not_configured');
  }
  const byIp = statusByIp.take(`ip:${input.ip}`);
  if (!byIp.ok) {
    logOutcome('status', 'rate_limited', 'ip');
    return refused(429, 'rate_limited', byIp.retryAfterSeconds);
  }

  const { linkId } = input;
  const fields = fieldsOf(input.body);
  if (!fields || !isValidLinkId(linkId)) {
    logOutcome('status', 'bad_request', 'fields');
    return refused(400, 'bad_request');
  }
  const link = await validateLinkDelegation(fields.linkDelegation, config.serviceDid);
  if (!link.ok) {
    const code = delegationRefusal(link.reason);
    logOutcome('status', code, linkRefusalDetail(link.reason));
    return refused(400, code);
  }
  const byDid = statusByDid.take(personKey(link.personDid, input.ip));
  if (!byDid.ok) {
    logOutcome('status', 'rate_limited', 'did');
    return refused(429, 'rate_limited', byDid.retryAfterSeconds);
  }

  const path = `${SELF_LINKS_PATH}/${linkId}`;
  let answer: SelfAnswer | null = null;
  try {
    const signer = await serviceSigner(config);
    // A read is safe to repeat: one more try, with a FRESH invocation (each is single use),
    // and only while the whole request still fits a serverless function's time.
    for (let attempt = 0; attempt < 2; attempt++) {
      const timeoutMs = Math.min(UPSTREAM_TIMEOUT_MS, STATUS_BUDGET_MS - (nowMs() - startedAt));
      const invocation = await buildSelfInvocation({
        signer,
        delegation: link.delegation,
        method: 'GET',
        path,
        entityDid: config.entityDid,
      });
      answer = await callSelf(deps.fetchImpl ?? fetch, 'GET', path, invocation, undefined, timeoutMs);
      const retry = !answer || answer.status >= 500 || answer.status === 429;
      // A long `Retry-After` (Self's rate limit says 60 s) is not waited out: the page polls again anyway.
      if (!retry || attempt === 1 || (answer?.retryAfterSeconds ?? 0) > 2) break;
      // A slow first try is not followed by a second: the page polls again anyway.
      if (nowMs() - startedAt > STATUS_RETRY_WITHIN_MS) break;
      await new Promise((resolve) => setTimeout(resolve, deps.retryWaitMs ?? 500));
    }
  } catch {
    logOutcome('status', 'error', 'signing');
    return { status: 200, body: errorResult('unknown') };
  }

  const result = mapStatusAnswer(answer, linkId);
  logOutcome('status', result.outcome === 'error' ? result.code : result.status, answer?.status ?? 'no_answer');
  return { status: 200, body: result };
}

/** Set by the hosting platform itself, in the order they are trusted. */
const PLATFORM_IP_HEADERS = ['x-vercel-forwarded-for', 'x-nf-client-connection-ip', 'x-real-ip'] as const;

/**
 * The caller's address, for the rate limit only: the platform's own header when
 * there is one (Vercel, Netlify, a reverse proxy's `x-real-ip`), else the first
 * `x-forwarded-for` entry, else the socket's address.
 *
 * ASSUMPTION: the app runs behind a proxy that sets these headers itself and
 * overwrites what the caller sent (Vercel and Netlify do). Served directly, or
 * behind a proxy that only appends to `x-forwarded-for`, a caller can choose the
 * value and so step around the per-address limit; Self's own limits still apply.
 */
export function clientIpOf(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress: string | undefined,
): string {
  const first = (name: string): string => {
    const value = headers[name];
    return ((Array.isArray(value) ? value[0] : value) || '').split(',')[0].trim();
  };
  const platform = PLATFORM_IP_HEADERS.map(first).find((value) => value.length > 0);
  return (platform || first('x-forwarded-for') || remoteAddress || 'unknown').slice(0, 64);
}
