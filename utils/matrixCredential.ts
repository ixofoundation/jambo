import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import type { MatrixClient } from 'matrix-js-sdk';
import { EventTimeline } from 'matrix-js-sdk';

const INDEX_EVENT_TYPE = 'ixo.credential.index';
const CREDENTIAL_EVENT_TYPE = 'ixo.credential';
const PII_INDEX_EVENT_TYPE = 'ixo.pii.index';
const PII_EVENT_TYPE = 'ixo.pii';

// When true, refuse to write credentials into rooms without E2EE — the timeline event
// would otherwise be sent in plaintext, defeating the purpose of the index/timeline split.
const REQUIRE_E2EE_CREDENTIALS = true;

export interface IndexEntry {
  eventId: string;
  cid: string;
  storedAt: string;
  issuerDid: string;
  holderDid: string;
  credentialType: string;
  format: string;
}

export interface ListedCredential extends IndexEntry {
  /** State key of the index event this entry came from (the credentialKey passed at write time). */
  credentialKey: string;
}

/**
 * Read every `ixo.credential.index` state event in the user's matrix room and return a
 * flat, deduplicated list of entries. Each entry carries the state key of the index
 * event it came from so callers can navigate back to it if needed.
 */
export function readAllCredentialIndexEntries(mxClient: MatrixClient, roomId: string): ListedCredential[] {
  if (!mxClient || !roomId) return [];
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return [];
    const liveState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvents = liveState?.getStateEvents(INDEX_EVENT_TYPE) ?? [];
    const out: ListedCredential[] = [];
    const seen = new Set<string>();
    for (const ev of stateEvents) {
      const credentialKey = ev.getStateKey() ?? '';
      const content = ev.getContent();
      const entries = Array.isArray(content?.entries) ? (content.entries as IndexEntry[]) : [];
      for (const entry of entries) {
        if (!entry?.cid || seen.has(entry.cid)) continue;
        seen.add(entry.cid);
        out.push({ ...entry, credentialKey });
      }
    }
    return out;
  } catch (err) {
    console.warn('readAllCredentialIndexEntries failed:', err);
    return [];
  }
}

/**
 * Poll the room's live state for an entry matching `{ cid, eventId }` under the
 * given credentialKey. Used to confirm a freshly-sent state event has been echoed
 * back through sync before we treat the save as final.
 */
export async function waitForCredentialIndexEntry({
  mxClient,
  roomId,
  credentialKey,
  cid,
  eventId,
  timeoutMs = 8000,
  pollIntervalMs = 300,
}: {
  mxClient: MatrixClient;
  roomId: string;
  credentialKey: string;
  cid: string;
  eventId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const room = mxClient.getRoom(roomId);
    const liveState = room?.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvent = liveState?.getStateEvents(INDEX_EVENT_TYPE, credentialKey);
    const content = stateEvent?.getContent();
    const entries: IndexEntry[] = Array.isArray(content?.entries) ? content.entries : [];
    if (entries.some((e) => e?.cid === cid && e?.eventId === eventId)) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

interface StoreArgs {
  mxClient: MatrixClient;
  roomId: string;
  credentialKey: string;
  credential: Record<string, any>;
  cid: string;
}

interface StoreResult {
  storedAt: string;
  duplicate: boolean;
  eventId: string;
}

function extractMetadata(credential: Record<string, any>, credentialKey: string) {
  if (credential.recordType === 'SdJwtCredentialRecord') {
    return {
      issuerDid: credential.issuerDid || '',
      holderDid: credential.holderDid || '',
      credentialType: credential.vct || credentialKey,
      format: credential.format || 'dc+sd-jwt',
    };
  }
  const issuerRaw = credential.issuer;
  const issuerDid = typeof issuerRaw === 'string' ? issuerRaw : issuerRaw?.id || '';
  const holderDid = credential.credentialSubject?.id || '';
  const vcTypes: string[] = Array.isArray(credential.type) ? credential.type : [];
  const credentialType =
    vcTypes.find((t) => t !== 'VerifiableCredential') || vcTypes[0] || credentialKey;
  return { issuerDid, holderDid, credentialType, format: 'vc+ld-proof' };
}

function readExistingEntries(
  mxClient: MatrixClient,
  roomId: string,
  credentialKey: string,
): IndexEntry[] {
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return [];
    const liveState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvent = liveState?.getStateEvents(INDEX_EVENT_TYPE, credentialKey);
    if (!stateEvent) return [];
    const content = stateEvent.getContent();
    return Array.isArray(content?.entries) ? (content.entries as IndexEntry[]) : [];
  } catch {
    return [];
  }
}

export async function storeMatrixCredential({
  mxClient,
  roomId,
  credentialKey,
  credential,
  cid,
}: StoreArgs): Promise<StoreResult> {
  if (!mxClient) throw new Error('Matrix client is not available');
  if (!roomId) throw new Error('User Matrix room ID is required');

  if (!mxClient.isRoomEncrypted(roomId)) {
    const msg = `[storeMatrixCredential] Room ${roomId} is not E2EE — credential PII would be written in plaintext`;
    if (REQUIRE_E2EE_CREDENTIALS) throw new Error(msg);
    console.warn(msg);
  }

  const metadata = extractMetadata(credential, credentialKey);
  const existingEntries = readExistingEntries(mxClient, roomId, credentialKey);
  const duplicate = existingEntries.find((entry) => entry.cid === cid);

  // Always write a new timeline event — even when the CID matches an existing entry.
  // The previous timeline event may have been encrypted with megolm keys this device
  // can no longer recover (e.g. backed-up key never restored), so re-saving with the
  // current session's keys is the only way to get a decryptable copy. The index is
  // kept de-duplicated by replacing the matching entry (1 entry per CID).
  const sendResult = await mxClient.sendEvent(roomId, CREDENTIAL_EVENT_TYPE as any, {
    credential: JSON.stringify(credential),
  });
  const eventId = sendResult.event_id;

  const storedAt = new Date().toISOString();
  const indexEntry: IndexEntry = {
    eventId,
    cid,
    storedAt,
    issuerDid: metadata.issuerDid,
    holderDid: metadata.holderDid,
    credentialType: metadata.credentialType,
    format: metadata.format,
  };

  const nextEntries = duplicate
    ? existingEntries.map((entry) => (entry.cid === cid ? indexEntry : entry))
    : [...existingEntries, indexEntry];

  await mxClient.sendStateEvent(roomId, INDEX_EVENT_TYPE as any, { entries: nextEntries }, credentialKey);

  return { storedAt, duplicate: !!duplicate, eventId };
}

// Recursively sort object keys so JSON.stringify yields a canonical, hash-stable form.
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function computeCredentialCid(credential: unknown): string {
  const canonical = JSON.stringify(canonicalize(credential));
  const digest = sha256(new TextEncoder().encode(canonical));
  return 'sha256:' + toHex(digest);
}

// =============================================================================
// PII storage — mirrors the credential save flow but under separate event types
// so it doesn't pollute the verifiable-credential index used by /profile/credentials.
// =============================================================================

export interface PiiIndexEntry {
  /** Timeline event id of the encrypted PII blob. */
  eventId: string;
  /** Content-addressed hash of the canonicalised PII payload. */
  cid: string;
  storedAt: string;
  /** KYC protocol id that produced the source identity credential. */
  protocolId: string;
  /** Origin marker — leaves room for non-KYC PII sources in the future. */
  source: 'kycaml-dump';
  /** Optional join back to the matching `ixo.credential` timeline event. */
  credentialEventId?: string;
  credentialCid?: string;
}

interface StorePiiArgs {
  mxClient: MatrixClient;
  roomId: string;
  protocolId: string;
  pii: Record<string, any>;
  credentialEventId?: string;
  credentialCid?: string;
}

interface StorePiiResult {
  storedAt: string;
  duplicate: boolean;
  eventId: string;
  cid: string;
}

function readExistingPiiEntries(mxClient: MatrixClient, roomId: string, protocolId: string): PiiIndexEntry[] {
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return [];
    const liveState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvent = liveState?.getStateEvents(PII_INDEX_EVENT_TYPE, protocolId);
    if (!stateEvent) return [];
    const content = stateEvent.getContent();
    return Array.isArray(content?.entries) ? (content.entries as PiiIndexEntry[]) : [];
  } catch {
    return [];
  }
}

export function readAllPiiIndexEntries(mxClient: MatrixClient, roomId: string): PiiIndexEntry[] {
  if (!mxClient || !roomId) return [];
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return [];
    const liveState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvents = liveState?.getStateEvents(PII_INDEX_EVENT_TYPE) ?? [];
    const out: PiiIndexEntry[] = [];
    const seen = new Set<string>();
    for (const ev of stateEvents) {
      const content = ev.getContent();
      const entries = Array.isArray(content?.entries) ? (content.entries as PiiIndexEntry[]) : [];
      for (const entry of entries) {
        if (!entry?.cid || seen.has(entry.cid)) continue;
        seen.add(entry.cid);
        out.push(entry);
      }
    }
    return out;
  } catch (err) {
    console.warn('readAllPiiIndexEntries failed:', err);
    return [];
  }
}

export async function storeMatrixPii({
  mxClient,
  roomId,
  protocolId,
  pii,
  credentialEventId,
  credentialCid,
}: StorePiiArgs): Promise<StorePiiResult> {
  if (!mxClient) throw new Error('Matrix client is not available');
  if (!roomId) throw new Error('User Matrix room ID is required');
  if (!protocolId) throw new Error('protocolId is required');

  if (!mxClient.isRoomEncrypted(roomId)) {
    const msg = `[storeMatrixPii] Room ${roomId} is not E2EE — credential data would be written in plaintext`;
    if (REQUIRE_E2EE_CREDENTIALS) throw new Error(msg);
    console.warn(msg);
  }

  const cid = computeCredentialCid(pii);
  const existingEntries = readExistingPiiEntries(mxClient, roomId, protocolId);
  const duplicate = existingEntries.find((entry) => entry.cid === cid);

  // Always write a fresh encrypted timeline event so the user has a copy decryptable
  // with the current session's megolm keys. The index keeps one entry per CID.
  const sendResult = await mxClient.sendEvent(roomId, PII_EVENT_TYPE as any, {
    pii: JSON.stringify(pii),
  });
  const eventId = sendResult.event_id;

  const storedAt = new Date().toISOString();
  const indexEntry: PiiIndexEntry = {
    eventId,
    cid,
    storedAt,
    protocolId,
    source: 'kycaml-dump',
    ...(credentialEventId ? { credentialEventId } : {}),
    ...(credentialCid ? { credentialCid } : {}),
  };

  const nextEntries = duplicate
    ? existingEntries.map((entry) => (entry.cid === cid ? indexEntry : entry))
    : [...existingEntries, indexEntry];

  await mxClient.sendStateEvent(roomId, PII_INDEX_EVENT_TYPE as any, { entries: nextEntries }, protocolId);

  return { storedAt, duplicate: !!duplicate, eventId, cid };
}

/**
 * Poll the room's live state for a PII entry matching `{ cid, eventId }` under the
 * given protocolId. Mirrors `waitForCredentialIndexEntry` for the credential index.
 */
export async function waitForPiiIndexEntry({
  mxClient,
  roomId,
  protocolId,
  cid,
  eventId,
  timeoutMs = 8000,
  pollIntervalMs = 300,
}: {
  mxClient: MatrixClient;
  roomId: string;
  protocolId: string;
  cid: string;
  eventId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const room = mxClient.getRoom(roomId);
    const liveState = room?.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvent = liveState?.getStateEvents(PII_INDEX_EVENT_TYPE, protocolId);
    const content = stateEvent?.getContent();
    const entries: PiiIndexEntry[] = Array.isArray(content?.entries) ? content.entries : [];
    if (entries.some((e) => e?.cid === cid && e?.eventId === eventId)) return true;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return false;
}

// =============================================================================
// Off-ramp profile — remembered form fields the user typed (bank, account,
// contact details). Mirrors the PII storage (encrypted timeline blob + state
// index) but under its own event types and a single fixed state key, since
// there's just one profile per user (latest wins). This is convenience data the
// user can override — NOT verified identity.
// =============================================================================

const OFFRAMP_PROFILE_INDEX_EVENT_TYPE = 'ixo.offramp.profile.index';
const OFFRAMP_PROFILE_EVENT_TYPE = 'ixo.offramp.profile';
const OFFRAMP_PROFILE_STATE_KEY = 'yellowcard';

export interface OfframpProfileIndexEntry {
  eventId: string;
  cid: string;
  storedAt: string;
}

function readOfframpProfileEntries(mxClient: MatrixClient, roomId: string): OfframpProfileIndexEntry[] {
  try {
    const room = mxClient.getRoom(roomId);
    if (!room) return [];
    const liveState = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
    const stateEvent = liveState?.getStateEvents(OFFRAMP_PROFILE_INDEX_EVENT_TYPE, OFFRAMP_PROFILE_STATE_KEY);
    if (!stateEvent) return [];
    const content = stateEvent.getContent();
    return Array.isArray(content?.entries) ? (content.entries as OfframpProfileIndexEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Persist the user's off-ramp profile to their matrix room (encrypted timeline
 * event + a single de-duplicated state index entry, latest wins). Throws if the
 * room isn't E2EE so callers (best-effort) can swallow it.
 */
export async function storeOfframpProfile({
  mxClient,
  roomId,
  profile,
}: {
  mxClient: MatrixClient;
  roomId: string;
  profile: Record<string, any>;
}): Promise<{ storedAt: string; duplicate: boolean; eventId: string; cid: string }> {
  if (!mxClient) throw new Error('Matrix client is not available');
  if (!roomId) throw new Error('User Matrix room ID is required');

  if (!mxClient.isRoomEncrypted(roomId)) {
    const msg = `[storeOfframpProfile] Room ${roomId} is not E2EE — off-ramp profile would be written in plaintext`;
    if (REQUIRE_E2EE_CREDENTIALS) throw new Error(msg);
    console.warn(msg);
  }

  const cid = computeCredentialCid(profile);
  const existingEntries = readOfframpProfileEntries(mxClient, roomId);
  const duplicate = existingEntries.find((entry) => entry.cid === cid);

  // Always write a fresh encrypted timeline event so the user keeps a copy
  // decryptable with the current session's megolm keys. The index holds one
  // entry per CID.
  const sendResult = await mxClient.sendEvent(roomId, OFFRAMP_PROFILE_EVENT_TYPE as any, {
    profile: JSON.stringify(profile),
  });
  const eventId = sendResult.event_id;

  const storedAt = new Date().toISOString();
  const indexEntry: OfframpProfileIndexEntry = { eventId, cid, storedAt };

  const nextEntries = duplicate
    ? existingEntries.map((entry) => (entry.cid === cid ? indexEntry : entry))
    : [...existingEntries, indexEntry];

  await mxClient.sendStateEvent(
    roomId,
    OFFRAMP_PROFILE_INDEX_EVENT_TYPE as any,
    { entries: nextEntries },
    OFFRAMP_PROFILE_STATE_KEY,
  );

  return { storedAt, duplicate: !!duplicate, eventId, cid };
}

/**
 * Read and decrypt the user's most-recent off-ramp profile, or null when none
 * exists / it can't be decrypted on this device.
 */
export async function readOfframpProfile(mxClient: MatrixClient, roomId: string): Promise<Record<string, any> | null> {
  const entries = readOfframpProfileEntries(mxClient, roomId);
  if (entries.length === 0) return null;

  const entry = [...entries].sort((a, b) => (b.storedAt || '').localeCompare(a.storedAt || ''))[0];
  if (!entry?.eventId) return null;

  const room = mxClient.getRoom(roomId);
  if (!room) return null;

  let event = room.findEventById(entry.eventId);
  if (!event) {
    const raw = await mxClient.fetchRoomEvent(roomId, entry.eventId);
    const mapper = mxClient.getEventMapper();
    event = mapper(raw);
  }

  if (event.isEncrypted()) {
    await mxClient.decryptEventIfNeeded(event);
  }
  if (event.isDecryptionFailure()) return null;

  const content = event.getContent() as { profile?: string };
  if (!content?.profile) return null;

  try {
    return JSON.parse(content.profile);
  } catch {
    return null;
  }
}
