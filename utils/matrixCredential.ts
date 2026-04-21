import { sha256 } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import type { MatrixClient } from 'matrix-js-sdk';

const INDEX_EVENT_TYPE = 'ixo.credential.index';
const CREDENTIAL_EVENT_TYPE = 'ixo.credential';

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
    const stateEvent = room.currentState.getStateEvents(INDEX_EVENT_TYPE, credentialKey);
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
  if (duplicate) {
    return { storedAt: duplicate.storedAt || new Date().toISOString(), duplicate: true };
  }

  // Double-stringify to avoid Matrix float restrictions on numbers in JSON.
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

  await mxClient.sendStateEvent(
    roomId,
    INDEX_EVENT_TYPE as any,
    { entries: [...existingEntries, indexEntry] },
    credentialKey,
  );

  return { storedAt, duplicate: false };
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
