import {
  createInvocation,
  serializeInvocation,
  signerFromMnemonic,
  type Capability,
  type SupportedDID,
} from '@ixo/ucan';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { mintDelegation } from '@utils/ucanDelegation';
import { isDirectProvider, normalizeAuthProvider } from 'lib/authHub/provider';
import { YOMA_SYNC_API_BASE } from './config';

/**
 * Client for the yoma worker's DID ↔ Yoma link endpoints.
 *
 * Auth follows the KYC/notifier pattern: a short-lived UCAN invocation
 * (`yoma/link` on `ixo:yoma`) authenticates the call, and the bind endpoint
 * additionally carries an `auth/user/email` delegation (plus `auth/user/phone`
 * for a Yoma account, see BindRequestBody) the worker forwards to the auth
 * hub — the hub's answer (not anything this client sends) decides the linked
 * email or phone. Failures are soft everywhere: the flow retries next
 * session, it must never disturb the user.
 */

export interface YomaLinkResult {
  email: string | null;
  yomaId: string | null;
  /** Which verified contact the worker bound this DID by (`phone` for an account without email); null when unbound or unknown. */
  contact?: 'email' | 'phone' | null;
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
  const { email, yomaId, contact } = (body ?? {}) as { email?: unknown; yomaId?: unknown; contact?: unknown };
  return {
    email: typeof email === 'string' ? email : null,
    yomaId: typeof yomaId === 'string' ? yomaId : null,
    // Only from the phone-matching worker; the worker on main never sends it.
    contact: contact === 'email' || contact === 'phone' ? contact : null,
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
 * The bind request body (POST /v1/link/bind), exactly the fields the worker
 * declares (its BindRequestSchema, on main and in its phone-matching version):
 *
 *   { delegation: string,        // always: `auth/user/email` (unchanged; main requires it)
 *     phoneDelegation?: string,  // direct-provider (Yoma) accounts only: `auth/user/phone`
 *     yref?: string }            // the Yoma hand-off marker, when this tab holds one
 *
 * Both delegations: one capability each, on `ixo:auth-hub:user:<address>`,
 * from the user's Ed25519 key, audience the worker's DID, a 240 s lifetime
 * (the hub refuses proofs longer than 300 s). `delegation` stays exactly what
 * every worker version checks (its first capability must be
 * `auth/user/email`). The worker on main ignores the two optional fields (a
 * non-strict zod object strips them); the phone-matching worker reads the
 * phone when the account has no email, and uses `yref` only to settle an
 * ambiguous match, when the account's verified contact equals that Yoma
 * profile's. The phone read is only delegated for a direct-provider account:
 * the hub keeps a phone number only for those, so a WorkOS account would only
 * grant a read that can never answer.
 */
export interface BindRequestBody {
  delegation: string;
  phoneDelegation?: string;
  yref?: string;
}

/** The worker's limit for `yref` (1 to 128 characters); anything else is left out. */
const YREF_MAX_LENGTH = 128;

export function bindCapabilities(address: string): { email: Capability; phone: Capability } {
  const resource = `ixo:auth-hub:user:${address}` as const;
  return {
    email: { can: 'auth/user/email', with: resource },
    phone: { can: 'auth/user/phone', with: resource },
  };
}

/**
 * Bind: delegate `auth/user/email` (and, for a Yoma account, `auth/user/phone`)
 * to the worker so it can fetch this DID's verified email (or phone) from the
 * auth hub and match it against Yoma's profiles. Idempotent server-side; the
 * hub is consulted at most once per DID. The phone number itself never passes
 * through this app.
 */
export async function bindLink(
  userDid: string,
  options?: { authProvider?: string | null; yref?: string | null },
): Promise<YomaLinkResult> {
  const workerDid = await fetchWorkerDid();
  const address = userDid.split(':').at(2) ?? '';
  const capabilities = bindCapabilities(address);
  const authProvider = normalizeAuthProvider(options?.authProvider);

  const body: BindRequestBody = {
    delegation: await mintDelegation({
      userDid,
      audience: workerDid,
      capabilities: [capabilities.email],
      ttlSeconds: EMAIL_DELEGATION_TTL_SECONDS,
    }),
  };
  if (isDirectProvider(authProvider)) {
    body.phoneDelegation = await mintDelegation({
      userDid,
      audience: workerDid,
      capabilities: [capabilities.phone],
      ttlSeconds: EMAIL_DELEGATION_TTL_SECONDS,
    });
  }
  const yref = options?.yref;
  if (typeof yref === 'string' && yref.length > 0 && yref.length <= YREF_MAX_LENGTH) body.yref = yref;

  const res = await fetch(`${YOMA_SYNC_API_BASE}/v1/link/bind`, {
    method: 'POST',
    headers: { ...(await linkAuthHeaders(userDid, workerDid)), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Link bind failed: ${res.status}`);
  return parseLinkResult(await res.json());
}
