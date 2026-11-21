import type { MatrixClient } from 'matrix-js-sdk';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';

import {
  APPROVE_PAYMENT_IDENTITY_KEYS,
  IDENTITY_LEVEL1_CREDENTIAL_KEY,
  KYC_AML_LEVEL1_CREDENTIAL_KEY,
} from '@constants/approvePayment';
import { IDENTITY_LEVEL1_VCT, SELF_ISSUER_DID } from '@constants/self';
import { type ListedCredential, readAllCredentialIndexEntries, readAllPiiIndexEntries } from '@utils/matrixCredential';
import { withMatrixOpenIdRetry } from '@utils/matrix';
import type { KycSource } from 'types/kyc';

/**
 * Fetch and parse a single claim from the claim bot, mirroring the pattern used in
 * SubclaimModal.loadParentClaimData. Returns the `credentialSubject` payload (minus
 * `id` and `type`), or the parsed response when no `credentialSubject` is present.
 */
export async function fetchSourceClaimData({
  client,
  collectionId,
  claimId,
  did,
}: {
  client: ReturnType<typeof createMatrixClaimBotClient>;
  collectionId: string;
  claimId: string;
  did: string;
}): Promise<Record<string, any>> {
  if (!client?.claim) throw new Error('Claim bot client is not available');
  const response = await withMatrixOpenIdRetry((token) =>
    client.claim.v1beta1.queryClaim(collectionId, claimId, token, did),
  );

  if (!response) return {};
  let parsed: any = typeof response === 'string' ? JSON.parse(response) : response;
  if (parsed?.data && !parsed?.credentialSubject) {
    parsed = typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data;
  }
  if (parsed?.credentialSubject) {
    const { id: _id, type: _type, ...rest } = parsed.credentialSubject;
    return rest;
  }
  return parsed ?? {};
}

/**
 * Locate the user's kycamllevel1 credential entry in their matrix room state.
 * Returns the index entry (with eventId) or null when not present.
 */
export function findKycLevel1IndexEntry(mxClient: MatrixClient, roomId: string) {
  const entries = readAllCredentialIndexEntries(mxClient, roomId);
  // Match on the canonical credentialKey first, fall back to the credentialType field
  // in case the user issued it under a different state key.
  return (
    entries.find((e) => e.credentialKey === KYC_AML_LEVEL1_CREDENTIAL_KEY) ??
    entries.find((e) => e.credentialType === KYC_AML_LEVEL1_CREDENTIAL_KEY) ??
    null
  );
}

/**
 * Locate the Self `IdentityLevel1` credential the Auth Hub copied into the
 * user's matrix room. The Hub files it under the state key `identitylevel1`
 * with `credentialType` = the full vct; match either, in case another writer
 * used a different state key. Newest entry from this network's Self issuer
 * first (a re-issued credential replaces the older one).
 */
export function findIdentityLevel1IndexEntry(mxClient: MatrixClient, roomId: string): ListedCredential | null {
  const matches = readAllCredentialIndexEntries(mxClient, roomId).filter(
    (e) =>
      e.credentialKey === IDENTITY_LEVEL1_CREDENTIAL_KEY ||
      e.credentialType === IDENTITY_LEVEL1_VCT ||
      e.credentialType === IDENTITY_LEVEL1_CREDENTIAL_KEY,
  );
  if (matches.length === 0) return null;
  const fromSelf = (e: ListedCredential) => (e.issuerDid === SELF_ISSUER_DID ? 1 : 0);
  return [...matches].sort(
    (a, b) => fromSelf(b) - fromSelf(a) || (b.storedAt || '').localeCompare(a.storedAt || ''),
  )[0];
}

/**
 * Load and decrypt the user's kycamllevel1 credential by reading the timeline event
 * referenced by the index entry. Mirrors the load logic in screens/credentialDetail.tsx.
 */
/**
 * Convert a snake_case key into camelCase. Used so the personal-field reader can
 * find values in either KYC-credential shape (`given_name`) or PII / form-data
 * shape (`givenName`) without needing two parallel mappers.
 */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Read a personal field from either the verifiable credential's SD-JWT-style
 * `claims` map (`{ claims: { key: { value, sd } } }`) or the flat PII payload
 * (`{ givenName: '...', given_name: '...', ... }`). Tries snake_case first then
 * camelCase so the same canonical key (`given_name`) works against both sources.
 */
function readPersonalField(source: Record<string, any> | null | undefined, snakeKey: string): any {
  if (!source) return undefined;
  const nested = source.claims?.[snakeKey];
  if (nested && typeof nested === 'object' && 'value' in nested) return nested.value;
  if (nested !== undefined) return nested;
  if (source[snakeKey] !== undefined) return source[snakeKey];
  const camelKey = snakeToCamel(snakeKey);
  if (source[camelKey] !== undefined) return source[camelKey];
  return undefined;
}

/**
 * Resolve the user's business operating address from the source claim. Prefers an
 * explicit nested object under `panel:businessOperatingAddress` (or the older
 * `pannel:` misspelling) and falls back to assembling the address from root-level
 * fields when the source claim stores them flat (streetAddress, city, addressRegion,
 * postalCode, country). Returns undefined when nothing usable is present.
 */
function buildSourceAddress(src: Record<string, any> | null | undefined): string | undefined {
  if (!src) return undefined;

  // Preferred: explicit panel/pannel field. Can be a string or an object — stringify
  // objects with the same flat-fields recipe used below.
  const panel = src['panel:businessOperatingAddress'] ?? src['pannel:businessOperatingAddress'];
  if (typeof panel === 'string' && panel.trim()) return panel.trim();
  if (panel && typeof panel === 'object') {
    const fromPanel = joinAddressParts([
      combineStreet(panel.identifier, panel.streetAddress),
      panel.city,
      panel.addressRegion,
      panel.postalCode,
      panel.country,
    ]);
    if (fromPanel) return fromPanel;
  }

  // Fallback: address parts at the root of the source claim payload.
  return joinAddressParts([
    combineStreet(src.identifier, src.streetAddress),
    src.city,
    src.addressRegion,
    src.postalCode,
    src.country,
  ]);
}

/** Stitch the street number (`identifier`) onto the street name to form a full
 *  street line. Falls back to whichever piece is present when one is missing. */
function combineStreet(identifier: unknown, streetAddress: unknown): string | undefined {
  const num = identifier == null ? '' : String(identifier).trim();
  const street = streetAddress == null ? '' : String(streetAddress).trim();
  if (num && street) return `${num} ${street}`;
  return street || num || undefined;
}

function joinAddressParts(parts: Array<unknown>): string | undefined {
  const clean = parts
    .map((p) => (typeof p === 'string' ? p.trim() : p == null ? '' : String(p).trim()))
    .filter((p) => p !== '');
  return clean.length > 0 ? clean.join(', ') : undefined;
}

/** The identity fields the approve-payment form takes from the normalised
 *  KYC profile (a structural subset of `KycPrefill` in utils/kycPrefill). */
export type ApprovePaymentProfile = { name?: string; email?: string; dob?: string; idNumber?: string };

/**
 * Build the field prefill dict for the approve-payment claim form from the source
 * claim data and the user's credential-data (PII / kycamllevel1 fallback). Missing
 * fields are simply omitted (no empty-string overrides) so SurveyJS doesn't clobber
 * existing user input.
 */
export function buildApprovePaymentPrefill(
  src: Record<string, any> | null | undefined,
  crd: Record<string, any> | null | undefined,
  /** The normalised identity (`loadKycPrefill`), used only when there is no
   *  legacy PII blob: a Self-verified user has none. */
  profile?: ApprovePaymentProfile | null,
): Record<string, any> {
  const out: Record<string, any> = {};
  const set = (k: string, v: any) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  };
  // Legacy users keep exactly the PII-blob values; the profile never mixes in.
  const fallback = crd ? null : profile;

  const given = readPersonalField(crd, 'given_name');
  const family = readPersonalField(crd, 'family_name');
  const name = [given, family].filter(Boolean).join(' ').trim();
  set('schema:name', fallback ? fallback.name : name);

  set('schema:telephone', src?.['org:businessContactNumber']);
  set('schema:email', fallback ? fallback.email : readPersonalField(crd, 'email'));
  set('schema:address', buildSourceAddress(src));
  set('schema:birthDate', fallback ? fallback.dob : readPersonalField(crd, 'birth_date'));
  set('schema:identityNumber', fallback ? fallback.idNumber : readPersonalField(crd, 'identifier_1'));
  // Country + currency: only ZA / NG are valid choices on the form. Default to ZA
  // when the source claim doesn't specify (or specifies anything else). The currency
  // is derived directly from the country: ZA → ZAR, NG → NGN. (The template also
  // computes this via `setValueExpression`, but prefilling it explicitly is faster
  // and survives surveyjs initialisation ordering.)
  const country = resolveAllowedCountry(src?.['schema:countryOfOrigin']);
  set('schema:country', country);
  set('umuzi:paymentCurrency', country === 'NG' ? 'NGN' : 'ZAR');

  set('schema:accountNumber', src?.['schema:bankAccount']);
  set('org:bankName', src?.['org:bankName']);

  return out;
}

/**
 * Survey data without the identity fields the prefill supplies, for the draft
 * saved to redux-persist: personal data from the credential is kept in memory
 * only. A field the prefill does not supply (so the person typed it) is kept,
 * or it would be lost when the draft is restored; the others are filled in
 * again from the prefill every time the form opens.
 */
export function stripPrefilledIdentity(
  data: Record<string, any> | null | undefined,
  prefill: Record<string, any> | null | undefined,
): Record<string, any> {
  const out: Record<string, any> = { ...(data ?? {}) };
  for (const key of APPROVE_PAYMENT_IDENTITY_KEYS) {
    const supplied = prefill?.[key];
    if (supplied !== undefined && supplied !== null && supplied !== '') delete out[key];
  }
  return out;
}

function resolveAllowedCountry(raw: unknown): 'ZA' | 'NG' {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (code === 'NG') return 'NG';
  return 'ZA';
}

/**
 * Load the user's credential-data (PII) blob from their matrix room. Looks up the
 * most-recent `ixo.pii.index` entry, fetches the referenced timeline event, decrypts
 * it, and returns the parsed payload. Returns null when no entry exists (e.g. the
 * user hasn't completed + saved their KYC on the current build).
 */
export async function loadKycPii(
  mxClient: MatrixClient,
  roomId: string,
): Promise<{ eventId: string; pii: Record<string, any> } | null> {
  const entries = readAllPiiIndexEntries(mxClient, roomId);
  if (entries.length === 0) return null;

  // Most recent wins — re-saves replace by CID so this is also the latest payload
  // for that protocol.
  const entry = [...entries].sort((a, b) => (b.storedAt || '').localeCompare(a.storedAt || ''))[0];
  if (!entry?.eventId) return null;

  const room = mxClient.getRoom(roomId);
  if (!room) throw new Error('Matrix room not loaded');

  let event = room.findEventById(entry.eventId);
  if (!event) {
    const raw = await mxClient.fetchRoomEvent(roomId, entry.eventId);
    const mapper = mxClient.getEventMapper();
    event = mapper(raw);
  }

  if (event.isEncrypted()) {
    await mxClient.decryptEventIfNeeded(event);
  }
  if (event.isDecryptionFailure()) {
    throw new Error('Credential data could not be decrypted on this device');
  }

  const content = event.getContent() as { pii?: string };
  if (!content?.pii) throw new Error('Credential data content is empty');

  let pii: Record<string, any>;
  try {
    pii = JSON.parse(content.pii);
  } catch {
    throw new Error('Stored credential data is not valid JSON');
  }
  return { eventId: entry.eventId, pii };
}

/** Fetch + decrypt the `ixo.credential` timeline event an index entry points at. */
async function loadCredentialRecord(
  mxClient: MatrixClient,
  roomId: string,
  eventId: string,
): Promise<{ eventId: string; credential: Record<string, any> }> {
  const room = mxClient.getRoom(roomId);
  if (!room) throw new Error('Matrix room not loaded');

  let event = room.findEventById(eventId);
  if (!event) {
    const raw = await mxClient.fetchRoomEvent(roomId, eventId);
    const mapper = mxClient.getEventMapper();
    event = mapper(raw);
  }

  if (event.isEncrypted()) {
    await mxClient.decryptEventIfNeeded(event);
  }
  if (event.isDecryptionFailure()) {
    throw new Error('KYC credential could not be decrypted on this device');
  }

  const content = event.getContent() as { credential?: string };
  if (!content?.credential) throw new Error('KYC credential content is empty');

  let credential: Record<string, any>;
  try {
    credential = JSON.parse(content.credential);
  } catch {
    throw new Error('KYC credential is not valid JSON');
  }
  return { eventId, credential };
}

export async function loadKycLevel1Credential(
  mxClient: MatrixClient,
  roomId: string,
): Promise<{ eventId: string; credential: Record<string, any> } | null> {
  const entry = findKycLevel1IndexEntry(mxClient, roomId);
  if (!entry) return null;
  return loadCredentialRecord(mxClient, roomId, entry.eventId);
}

/** The Self `IdentityLevel1` record the Auth Hub wrote to the room (same
 *  `SdJwtCredentialRecord` shape as the legacy one), or null when absent. */
export async function loadIdentityLevel1Credential(
  mxClient: MatrixClient,
  roomId: string,
): Promise<{ eventId: string; credential: Record<string, any> } | null> {
  const entry = findIdentityLevel1IndexEntry(mxClient, roomId);
  if (!entry?.eventId) return null;
  return loadCredentialRecord(mxClient, roomId, entry.eventId);
}

/**
 * The raw SD-JWT presentation string (`<jwt>~<disclosure>~…`) of ONE credential
 * source, to send to a verifier (e.g. the YellowCard worker's KYC gate). For an
 * SD-JWT record the raw credential, with every disclosure, lives in the
 * record's `credential` field. Returns null when that credential is not held;
 * throws only if it's present but undecryptable.
 */
async function loadKycCredentialJwtForSource(
  mxClient: MatrixClient,
  roomId: string,
  source: KycSource,
): Promise<string | null> {
  const loaded =
    source === 'identitylevel1'
      ? await loadIdentityLevel1Credential(mxClient, roomId)
      : await loadKycLevel1Credential(mxClient, roomId);
  const record = loaded?.credential;
  if (!record) return null;
  const raw = record.credential;
  return typeof raw === 'string' && raw.includes('~') ? raw : null;
}

/**
 * When an SD-JWT says it expires (its own `exp`, unix seconds); null when it
 * names no expiry or can't be read. Read only: the signature is the
 * verifier's to check.
 */
function sdJwtExpiry(sdJwt: string): number | null {
  try {
    const payload = sdJwt.split('~')[0].split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)))?.exp;
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Legacy credentials a verifier refused in this session (memory only, never
 * stored). Sending the same one again would be refused again. The credential
 * itself is not kept here, only its SHA-256.
 */
const rejectedThisSession = new Set<string>();

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The verifier could not accept this credential and asked for a new
 * verification. Resolves once it is noted (await it before choosing the
 * credential again); never rejects.
 */
export async function noteKycCredentialRejected(sdJwt: string | null | undefined): Promise<void> {
  if (!sdJwt) return;
  try {
    rejectedThisSession.add(await sha256Hex(sdJwt));
  } catch {
    // No Web Crypto here: the credential is not noted, and is sent as before.
  }
}

async function wasRejectedThisSession(sdJwt: string): Promise<boolean> {
  if (rejectedThisSession.size === 0) return false;
  try {
    return rejectedThisSession.has(await sha256Hex(sdJwt));
  } catch {
    return false;
  }
}

/** Forget the refused credentials (call on sign-out). */
export function clearRejectedKycCredentials(): void {
  rejectedThisSession.clear();
}

/**
 * The raw KYC SD-JWT to present: the legacy `kycamllevel1` credential when the
 * user holds one (exactly as before, even when a Self credential also exists),
 * otherwise the Self `IdentityLevel1` credential.
 *
 * One exception, for a user who verified again with Self: when the legacy
 * credential has expired by its own `exp`, or a verifier refused it in this
 * session, the Self credential is sent instead if one is held.
 */
export async function loadKycCredentialJwt(
  mxClient: MatrixClient,
  roomId: string,
  now: number = Date.now(),
): Promise<string | null> {
  return (await selectKycCredentialJwt(mxClient, roomId, now)).jwt;
}

/**
 * `loadKycCredentialJwt`, also saying which credential was chosen, so a form
 * can show the identity of the credential it is about to send.
 */
export async function selectKycCredentialJwt(
  mxClient: MatrixClient,
  roomId: string,
  now: number = Date.now(),
): Promise<{ jwt: string | null; source: KycSource }> {
  if (!findKycLevel1IndexEntry(mxClient, roomId)) {
    return { jwt: await loadKycCredentialJwtForSource(mxClient, roomId, 'identitylevel1'), source: 'identitylevel1' };
  }
  const legacy = await loadKycCredentialJwtForSource(mxClient, roomId, 'kycamllevel1');
  if (!legacy) return { jwt: legacy, source: 'kycamllevel1' };
  const exp = sdJwtExpiry(legacy);
  const unusable = (exp !== null && exp * 1000 <= now) || (await wasRejectedThisSession(legacy));
  if (!unusable) return { jwt: legacy, source: 'kycamllevel1' };
  const self = await loadKycCredentialJwtForSource(mxClient, roomId, 'identitylevel1').catch(() => null);
  return self ? { jwt: self, source: 'identitylevel1' } : { jwt: legacy, source: 'kycamllevel1' };
}
