import { createInvocation, serializeInvocation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { VFS_BASE_URL } from '@constants/vfs';
import { secureLoad } from '@utils/storage';

/**
 * UCAN invocations for the IXO Virtual Filesystem — one FRESH single-use invocation per HTTP
 * request (the VFS replay-protects and archives every one), signed with the user's ed25519
 * signing mnemonic (the key their on-chain IID document carries — the same key utils/ucan.ts
 * uses for the KYC server), scoped to exactly the resource the caller names.
 */

let cachedServiceDid: string | null = null;

export async function fetchVfsServiceDid(): Promise<string> {
  if (cachedServiceDid) return cachedServiceDid;
  const res = await fetch(`${VFS_BASE_URL}/.well-known/did.json`);
  if (!res.ok) throw new Error(`Failed to fetch VFS service DID: ${res.status}`);
  const doc = await res.json();
  const did = doc?.id;
  if (typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error('Malformed VFS service DID document');
  }
  cachedServiceDid = did;
  return did;
}

/** Whether the signed-in user has a UCAN signing key available (the VFS needs one). */
export function hasVfsSigner(): boolean {
  return !!secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
}

function generateNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mint a serialized bearer invocation for the VFS.
 *  - `can`: 'fs/read' | 'fs/write'
 *  - `resource`: e.g. `ixo:filesystem/<entityDid>/.claims/<collectionId>` (claims lane)
 * The `{ nonce }` fact makes every mint byte-unique so parallel requests (tus parts) never
 * collide on the replay guard.
 */
export async function mintVfsInvocation(userDid: string, can: 'fs/read' | 'fs/write', resource: string): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const serviceDid = await fetchVfsServiceDid();
  const { signer } = await signerFromMnemonic(mnemonic, userDid as SupportedDID);

  const invocation = await createInvocation({
    issuer: signer,
    audience: serviceDid,
    capability: { can, with: resource as `${string}:${string}` },
    expiration: Math.floor(Date.now() / 1000) + 300,
    facts: [{ nonce: generateNonce() }],
  });

  return serializeInvocation(invocation);
}
