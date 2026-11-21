import { createInvocation, serializeInvocation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { HUB_CREDENTIALS_ABILITY, IDENTITY_LEVEL1_VCT, SELF_ISSUER_DID } from '@constants/self';
import { serverNowSeconds } from '@utils/self/serverTime';
import { secureLoad } from '@utils/storage';
import { AUTH_HUB_URL } from 'lib/authHub/config';
import type { HubCredentialClaims, HubCredentialSummary } from 'types/kyc';

/**
 * Client for the Auth Hub wallet's credentials API (`/api/credentials`), called
 * straight from the browser. Each call carries a UCAN invocation signed with
 * the person's own key, so the Hub shows no prompt (it writes an audit row).
 *
 * What the Hub requires of the token (ixo-auth-worker/src/routes/credentials.ts,
 * `ownShortUcanProblem`): issued by the person's did:ixo with no proofs,
 * addressed to the Hub's did:web, at most 300 s left, and a fact
 * `{ method, path }` naming this one call (path without the query).
 *
 * Claims are personal data: they live in this module's memory only and are
 * never logged or put in an error message.
 */

export type HubCredentialsErrorCode = 'unauthorized' | 'unavailable' | 'malformed';

export class HubCredentialsError extends Error {
  readonly code: HubCredentialsErrorCode;

  constructor(code: HubCredentialsErrorCode, message: string) {
    super(message);
    this.name = 'HubCredentialsError';
    this.code = code;
  }
}

const API_PATH = '/api/credentials';
/** The Hub's own id format (`CREDENTIAL_ID`); also keeps an id from changing the path. */
const CREDENTIAL_ID = /^[A-Za-z0-9_-]{1,128}$/;
// The Hub refuses a token that is expired, or has more than 300 s left, by ITS
// clock, with no allowance. So the expiry is counted from the server's time
// (utils/self/serverTime.ts), not this device's, and sits well inside the limit.
const TOKEN_TTL_SECONDS = 120;
/** A refusal is worth one more try when re-reading the server's time moved "now" by more than this. */
const CLOCK_MOVED_SECONDS = 30;
const REQUEST_TIMEOUT_MS = 20_000;
const CACHE_TTL_MS = 3 * 60 * 1000;

type OverviewCredential = HubCredentialSummary & {
  /** The Hub has not checked it yet, so `verified: false` is not a verdict. */
  checking: boolean;
  storedAt: number;
};

type Cached<T> = { at: number; value: T };
const selfCredentialCache = new Map<string, Cached<HubCredentialSummary>>();
const selfClaimsCache = new Map<string, Cached<HubCredentialClaims>>();

/** Forget everything read from the Hub (call on sign-out). */
export function clearHubCredentialCache(): void {
  selfCredentialCache.clear();
  selfClaimsCache.clear();
}

function readCache<T>(cache: Map<string, Cached<T>>, did: string): T | undefined {
  const hit = cache.get(did);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(did);
    return undefined;
  }
  return hit.value;
}

const hubBase = () => AUTH_HUB_URL.replace(/\/+$/, '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new HubCredentialsError('unavailable', 'The Auth Hub could not be reached');
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new HubCredentialsError('malformed', 'The Auth Hub answer was not JSON');
  }
}

let cachedHubDid: { base: string; did: string } | null = null;

/** The Hub's `did:web` (the token's audience), from its published DID document. */
async function resolveHubDid(): Promise<string> {
  const base = hubBase();
  if (cachedHubDid?.base === base) return cachedHubDid.did;
  const res = await fetchWithTimeout(`${base}/.well-known/did.json`);
  if (!res.ok) throw new HubCredentialsError('unavailable', `Auth Hub DID document failed (${res.status})`);
  const doc = await readJson(res);
  const did = isRecord(doc) ? doc.id : undefined;
  if (typeof did !== 'string' || !did.startsWith('did:web:')) {
    throw new HubCredentialsError('malformed', 'Malformed Auth Hub DID document');
  }
  cachedHubDid = { base, did };
  return did;
}

/**
 * A single-use bearer token for one GET on the credentials API. `path` is the
 * full pathname without the query, exactly as the Hub compares it.
 */
export async function hubCredentialsBearer(userDid: string, path: string): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  const address = userDid.split(':').pop() ?? '';
  if (!mnemonic || !userDid.startsWith('did:ixo:') || !address) {
    throw new HubCredentialsError('unauthorized', 'Signing key not available: please sign in again');
  }
  const audience = await resolveHubDid();
  const now = await serverNowSeconds();
  try {
    // Trimmed as the hub does before deriving the on-chain key (see utils/ucanDelegation.ts).
    const { signer } = await signerFromMnemonic(String(mnemonic).trim(), userDid as SupportedDID);
    const invocation = await createInvocation({
      issuer: signer,
      audience,
      capability: { can: HUB_CREDENTIALS_ABILITY, with: `ixo:auth-hub:user:${address}` },
      expiration: now + TOKEN_TTL_SECONDS,
      // The Hub accepts each token once (by CID); the nonce keeps two calls to
      // the same path within one second from being the same token.
      facts: [{ method: 'GET', path }, { nonce: globalThis.crypto.randomUUID() }],
    });
    return await serializeInvocation(invocation);
  } catch {
    throw new HubCredentialsError('unauthorized', 'Could not sign the Auth Hub request');
  }
}

async function hubRequest(userDid: string, path: string, query: string): Promise<Response> {
  const token = await hubCredentialsBearer(userDid, path);
  // Only `Authorization`: the Hub's CORS allows no other custom header, so an
  // `X-Auth-Type` (as other IXO services take) would fail the preflight.
  return fetchWithTimeout(`${hubBase()}${path}${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
}

async function hubGet(userDid: string, path: string, query = ''): Promise<unknown> {
  let res = await hubRequest(userDid, path, query);
  if (res.status === 401) {
    // The Hub does not say why. One cause is this device's clock having changed
    // since the server's time was read: read it again, and only when that moved
    // "now" is the call made once more (a GET, with a new token).
    const before = await serverNowSeconds();
    const after = await serverNowSeconds({ refresh: true });
    if (Math.abs(after - before) > CLOCK_MOVED_SECONDS) res = await hubRequest(userDid, path, query);
  }
  if (res.status === 401 || res.status === 403) {
    throw new HubCredentialsError('unauthorized', `The Auth Hub refused the request (${res.status})`);
  }
  // The body of a failure is not read into the message: status only.
  if (!res.ok) throw new HubCredentialsError('unavailable', `Auth Hub credentials request failed (${res.status})`);
  return readJson(res);
}

/** The fields shared by an overview row and an item (`CredentialSummary` in the Hub). */
function parseSummary(raw: unknown): OverviewCredential {
  const issuer = isRecord(raw) ? raw.issuer : undefined;
  if (
    !isRecord(raw) ||
    typeof raw.id !== 'string' ||
    !CREDENTIAL_ID.test(raw.id) ||
    typeof raw.vct !== 'string' ||
    !isRecord(issuer) ||
    typeof issuer.did !== 'string' ||
    typeof raw.verified !== 'boolean' ||
    (raw.expiresAt !== undefined && raw.expiresAt !== null && typeof raw.expiresAt !== 'number')
  ) {
    throw new HubCredentialsError('malformed', 'Unexpected credential shape from the Auth Hub');
  }
  return {
    id: raw.id,
    type: raw.vct,
    issuerDid: issuer.did,
    verified: raw.verified,
    expiresAt: typeof raw.expiresAt === 'number' ? raw.expiresAt : null,
    // The overview only says `revoked: true` when the Hub knows it; absent
    // there means "not known", which is null here. An item answers true/false/null.
    revoked: typeof raw.revoked === 'boolean' ? raw.revoked : null,
    checking: raw.checking === true,
    storedAt: typeof raw.storedAt === 'number' ? raw.storedAt : 0,
  };
}

function toSummary(c: OverviewCredential): HubCredentialSummary {
  return {
    id: c.id,
    type: c.type,
    issuerDid: c.issuerDid,
    verified: c.verified,
    expiresAt: c.expiresAt,
    revoked: c.revoked,
  };
}

async function fetchOverview(
  userDid: string,
  sync: boolean,
): Promise<{ vaultOk: boolean; credentials: OverviewCredential[] }> {
  // `sync=1` makes the Hub re-read the wallet first (it does so at most once a minute).
  const body = await hubGet(userDid, `${API_PATH}/overview`, sync ? '?sync=1' : '');
  if (!isRecord(body) || !Array.isArray(body.credentials)) {
    throw new HubCredentialsError('malformed', 'Unexpected overview shape from the Auth Hub');
  }
  return {
    // Anything but 'ok' (or absent, on a Hub without the field): the list may be incomplete.
    vaultOk: body.vault === undefined || body.vault === 'ok',
    credentials: body.credentials.map(parseSummary),
  };
}

async function fetchItem(
  userDid: string,
  id: string,
): Promise<{ credential: OverviewCredential; claims: HubCredentialClaims }> {
  if (!CREDENTIAL_ID.test(id)) throw new HubCredentialsError('malformed', 'Not a credential id');
  const body = await hubGet(userDid, `${API_PATH}/items/${id}`);
  const credential = parseSummary(body);
  const list = (body as Record<string, unknown>).claims;
  if (!Array.isArray(list)) throw new HubCredentialsError('malformed', 'Unexpected item shape from the Auth Hub');
  const claims: HubCredentialClaims = {};
  for (const claim of list) {
    if (!isRecord(claim) || typeof claim.name !== 'string') {
      throw new HubCredentialsError('malformed', 'Unexpected claim shape from the Auth Hub');
    }
    if (claim.name === '__proto__') continue;
    claims[claim.name] = claim.value;
  }
  return { credential, claims };
}

export async function listHubCredentials(userDid: string): Promise<HubCredentialSummary[]> {
  return (await fetchOverview(userDid, false)).credentials.map(toSummary);
}

/**
 * Not known to be revoked, and not expired. `revoked: null` (the Hub could not
 * read the status list, or, on an overview row, did not look) passes: the Hub
 * says "not known", and the YellowCard worker verifies the credential again,
 * status list included, before it acts on it.
 */
function usable(c: HubCredentialSummary, nowSeconds: number): boolean {
  return c.revoked !== true && (c.expiresAt === null || c.expiresAt > nowSeconds);
}

/** The person's Self credential (type and issuer), verified by the Hub and still usable. */
function isValidSelfCredential(c: HubCredentialSummary, nowSeconds: number): boolean {
  return c.type === IDENTITY_LEVEL1_VCT && c.issuerDid === SELF_ISSUER_DID && c.verified && usable(c, nowSeconds);
}

/**
 * The person's valid Self credential, or null when they hold none. `force`
 * skips the memory cache and asks the Hub to re-read the wallet.
 */
export async function findSelfCredential(
  userDid: string,
  opts: { force?: boolean } = {},
): Promise<HubCredentialSummary | null> {
  if (!opts.force) {
    const hit = readCache(selfCredentialCache, userDid);
    if (hit) return hit;
  }
  const found = await lookUpSelfCredential(userDid, !!opts.force);
  // Only a hit is remembered: "none" must be noticed as soon as it changes.
  if (found) selfCredentialCache.set(userDid, { at: Date.now(), value: found });
  else selfCredentialCache.delete(userDid);
  return found;
}

async function lookUpSelfCredential(userDid: string, sync: boolean): Promise<HubCredentialSummary | null> {
  const { vaultOk, credentials } = await fetchOverview(userDid, sync);
  const now = await serverNowSeconds();
  const candidates = credentials
    .filter((c) => c.type === IDENTITY_LEVEL1_VCT && c.issuerDid === SELF_ISSUER_DID && usable(c, now))
    .sort((a, b) => b.storedAt - a.storedAt);

  const verified = candidates.find((c) => c.verified);
  if (verified) return toSummary(verified);

  // Freshly saved credentials are listed before the Hub has checked them
  // (`checking`). Opening the item makes the Hub check it now.
  const unchecked = candidates.find((c) => c.checking);
  if (unchecked) {
    const { credential } = await fetchItem(userDid, unchecked.id);
    // The item's own answer (read live), not the row's.
    if (isValidSelfCredential(credential, now)) return toSummary(credential);
    if (credential.checking) {
      throw new HubCredentialsError('unavailable', 'The Auth Hub has not checked the credential yet');
    }
  }

  if (!vaultOk) throw new HubCredentialsError('unavailable', 'The Auth Hub wallet is not readable right now');
  return null;
}

export async function getHubCredentialClaims(userDid: string, id: string): Promise<HubCredentialClaims> {
  return (await fetchItem(userDid, id)).claims;
}

/**
 * The claims of the person's Self credential; null when they hold none.
 * Throws HubCredentialsError when the Hub cannot answer.
 */
export async function loadSelfClaims(
  userDid: string,
  opts: { force?: boolean } = {},
): Promise<HubCredentialClaims | null> {
  if (!opts.force) {
    const hit = readCache(selfClaimsCache, userDid);
    if (hit) return hit;
  }
  const credential = await findSelfCredential(userDid, opts);
  if (!credential) {
    selfClaimsCache.delete(userDid);
    return null;
  }
  // The overview row behind `credential` reads no status list and may be minutes
  // old (the cache above). The item is the Hub's live answer: its signature check
  // and its status-list read. Claims are only taken from a credential the item
  // itself calls verified, not revoked and not expired. `revoked: null` (status
  // list unreadable) is accepted, see `usable`.
  const item = await fetchItem(userDid, credential.id);
  if (item.credential.checking) {
    throw new HubCredentialsError('unavailable', 'The Auth Hub has not checked the credential yet');
  }
  if (!isValidSelfCredential(item.credential, await serverNowSeconds())) {
    selfCredentialCache.delete(userDid);
    selfClaimsCache.delete(userDid);
    return null;
  }
  // The live answer replaces the remembered row (it may now say `revoked: false`).
  selfCredentialCache.set(userDid, { at: Date.now(), value: toSummary(item.credential) });
  selfClaimsCache.set(userDid, { at: Date.now(), value: item.claims });
  return item.claims;
}
