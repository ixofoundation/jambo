import type { MatrixClient } from 'matrix-js-sdk';
import { createMatrixClaimBotClient } from '@ixo/matrixclient-sdk';

import { KYC_AML_LEVEL1_CREDENTIAL_KEY } from '@constants/approvePayment';
import { readAllCredentialIndexEntries, readAllPiiIndexEntries } from '@utils/matrixCredential';
import { withMatrixOpenIdRetry } from '@utils/matrix';

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

/**
 * Build the field prefill dict for the approve-payment claim form from the source
 * claim data and the user's credential-data (PII / kycamllevel1 fallback). Missing
 * fields are simply omitted (no empty-string overrides) so SurveyJS doesn't clobber
 * existing user input.
 */
export function buildApprovePaymentPrefill(
  src: Record<string, any> | null | undefined,
  crd: Record<string, any> | null | undefined,
): Record<string, any> {
  const out: Record<string, any> = {};
  const set = (k: string, v: any) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  };

  const given = readPersonalField(crd, 'given_name');
  const family = readPersonalField(crd, 'family_name');
  const name = [given, family].filter(Boolean).join(' ').trim();
  set('schema:name', name);

  set('schema:telephone', src?.['org:businessContactNumber']);
  set('schema:email', readPersonalField(crd, 'email'));
  set('schema:address', buildSourceAddress(src));
  set('schema:birthDate', readPersonalField(crd, 'birth_date'));
  set('schema:identityNumber', readPersonalField(crd, 'identifier_1'));
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

export async function loadKycLevel1Credential(
  mxClient: MatrixClient,
  roomId: string,
): Promise<{ eventId: string; credential: Record<string, any> } | null> {
  const entry = findKycLevel1IndexEntry(mxClient, roomId);
  if (!entry) return null;

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
  return { eventId: entry.eventId, credential };
}
