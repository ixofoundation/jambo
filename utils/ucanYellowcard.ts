import { createInvocation, serializeInvocation, signerFromMnemonic, type Capability, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { YELLOWCARD_WORKER_API } from '@constants/yellowcard';
import { secureLoad } from '@utils/storage';

/**
 * UCAN invocation minting for the YellowCard off-ramp worker.
 *
 * Mirrors `@utils/ucan` (the KYC flow): the user's Ed25519 `ED_SIGNING_MNEMONIC`
 * is kept in secure storage in plaintext (decrypted at auth-hub login), so we
 * mint invocations directly — no PIN prompt. The off-ramp routes are
 * user-rooted (worker rootMode 'any'), so the user is the root issuer and no
 * proof delegation is needed.
 */

let cachedWorkerDid: string | null = null;

/** Resolve the worker's `did:web` from its published DID document. Cached for
 *  the page lifetime. */
export async function resolveWorkerDid(): Promise<string> {
  if (cachedWorkerDid) return cachedWorkerDid;
  const base = YELLOWCARD_WORKER_API.replace(/\/+$/, '');
  const res = await fetch(`${base}/.well-known/did.json`);
  if (!res.ok) throw new Error(`Failed to fetch YellowCard worker DID: ${res.status}`);
  const doc = await res.json();
  const did = doc?.id;
  if (typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error('Malformed YellowCard worker DID document');
  }
  cachedWorkerDid = did;
  return did;
}

/**
 * Generate a UCAN-unique nonce. The worker indexes invocations by CID for
 * replay protection; without a per-call nonce, two requests built within the
 * same wall-clock second produce identical UCANs and the second fails as a
 * replay. `facts` are included in the CID, so a `{ nonce }` fact disambiguates
 * parallel calls.
 */
function generateNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const OFFRAMP_CAPABILITY: Capability = { can: 'yellowcard/offramp', with: 'ixo:yellowcard' };

/**
 * Mint a fresh single-use invocation CAR (bearer token) for the off-ramp
 * capability, signed by the user's Ed25519 key.
 */
export async function mintOfframpBearer(userDid: string): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const workerDid = await resolveWorkerDid();
  const { signer } = await signerFromMnemonic(String(mnemonic).trim(), userDid as SupportedDID);

  const invocation = await createInvocation({
    issuer: signer,
    audience: workerDid,
    capability: OFFRAMP_CAPABILITY,
    expiration: Math.floor(Date.now() / 1000) + 300,
    facts: [{ nonce: generateNonce() }],
  });

  return serializeInvocation(invocation);
}
