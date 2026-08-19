import { createInvocation, serializeInvocation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { mintDelegation } from '@utils/ucanDelegation';
import { YOMA_SYNC_API_BASE } from './config';

/**
 * Client for the yoma worker's DID ↔ Yoma link endpoints.
 *
 * Auth follows the KYC/notifier pattern: a short-lived UCAN invocation
 * (`yoma/link` on `ixo:yoma`) authenticates the call, and the bind endpoint
 * additionally carries an `auth/user/email` delegation the worker forwards to
 * the auth hub — the hub's answer (not anything this client sends) decides
 * the linked email. Failures are soft everywhere: the flow retries next
 * session, it must never disturb the user.
 */

export interface YomaLinkResult {
  email: string | null;
  yomaId: string | null;
}

const EMAIL_DELEGATION_TTL_SECONDS = 240; // hub caps proof lifetime at 300s
const INVOCATION_TTL_SECONDS = 60;

let cachedWorkerDid: string | null = null;

async function fetchWorkerDid(): Promise<string> {
  if (cachedWorkerDid) return cachedWorkerDid;

  const res = await fetch(`${YOMA_SYNC_API_BASE}/.well-known/did.json`);
  if (!res.ok) throw new Error(`Failed to fetch yoma worker DID: ${res.status}`);
  const doc = await res.json();
  const did = doc?.id;
  if (typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error('Malformed yoma worker DID document');
  }
  cachedWorkerDid = did;
  return did;
}

async function linkAuthHeaders(userDid: string, workerDid: string): Promise<Record<string, string>> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const { signer } = await signerFromMnemonic(String(mnemonic).trim(), userDid as SupportedDID);
  const invocation = await createInvocation({
    issuer: signer,
    audience: workerDid,
    capability: { can: 'yoma/link', with: 'ixo:yoma' },
    expiration: Math.floor(Date.now() / 1000) + INVOCATION_TTL_SECONDS,
    // Nonce fact → unique CID for same-second mints (Ed25519 is deterministic).
    facts: [{ nonce: globalThis.crypto.randomUUID() }],
  });

  return {
    Authorization: `Bearer ${await serializeInvocation(invocation)}`,
    'X-Auth-Type': 'ucan',
  };
}

function parseLinkResult(body: unknown): YomaLinkResult {
  const { email, yomaId } = (body ?? {}) as { email?: unknown; yomaId?: unknown };
  return {
    email: typeof email === 'string' ? email : null,
    yomaId: typeof yomaId === 'string' ? yomaId : null,
  };
}

/** Cheap worker-side D1 read — costs no auth-hub quota. */
export async function getLinkStatus(userDid: string): Promise<YomaLinkResult> {
  const workerDid = await fetchWorkerDid();
  const res = await fetch(`${YOMA_SYNC_API_BASE}/v1/link/status`, {
    headers: await linkAuthHeaders(userDid, workerDid),
  });
  if (!res.ok) throw new Error(`Link status failed: ${res.status}`);
  return parseLinkResult(await res.json());
}

/**
 * Bind: delegate `auth/user/email` to the worker so it can fetch this DID's
 * verified email from the auth hub and match it against Yoma's profiles.
 * Idempotent server-side; the hub is consulted at most once per DID.
 */
export async function bindLink(userDid: string): Promise<YomaLinkResult> {
  const workerDid = await fetchWorkerDid();
  const address = userDid.split(':').at(2) ?? '';

  const delegation = await mintDelegation({
    userDid,
    audience: workerDid,
    capabilities: [{ can: 'auth/user/email', with: `ixo:auth-hub:user:${address}` }],
    ttlSeconds: EMAIL_DELEGATION_TTL_SECONDS,
  });

  const res = await fetch(`${YOMA_SYNC_API_BASE}/v1/link/bind`, {
    method: 'POST',
    headers: { ...(await linkAuthHeaders(userDid, workerDid)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ delegation }),
  });
  if (!res.ok) throw new Error(`Link bind failed: ${res.status}`);
  return parseLinkResult(await res.json());
}
