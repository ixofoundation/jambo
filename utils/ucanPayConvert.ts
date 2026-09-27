import { createInvocation, serializeInvocation, signerFromMnemonic, type Capability, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { PAY_CONVERT_ORACLE_URL } from '@constants/payConvert';
import { secureLoad } from '@utils/storage';

/**
 * UCAN invocation minting for the PAY → USDC conversion oracle — the same
 * shape as `@utils/ucanYellowcard`: the user's Ed25519 `ED_SIGNING_MNEMONIC`
 * signs a single-use invocation addressed to the oracle's did:web. The oracle
 * accepts any root issuer (the caller proves they hold their own DID's key)
 * and mints the conversion right for that DID's address.
 */

let cachedOracleDid: string | null = null;

export async function resolveOracleDid(): Promise<string> {
  if (cachedOracleDid) return cachedOracleDid;
  const res = await fetch(`${PAY_CONVERT_ORACLE_URL}/.well-known/did.json`);
  if (!res.ok) throw new Error(`Failed to fetch the conversion oracle DID: ${res.status}`);
  const doc = await res.json();
  const did = doc?.id;
  if (typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error('Malformed conversion oracle DID document');
  }
  cachedOracleDid = did;
  return did;
}

function generateNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const CONVERT_CAPABILITY: Capability = { can: 'pay/convert', with: 'ixo:pay-convert' };

/** A fresh single-use invocation for the conversion door, signed by the user's Ed25519 key. */
export async function mintPayConvertBearer(userDid: string): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const oracleDid = await resolveOracleDid();
  const { signer } = await signerFromMnemonic(String(mnemonic).trim(), userDid as SupportedDID);

  const invocation = await createInvocation({
    issuer: signer,
    audience: oracleDid,
    capability: CONVERT_CAPABILITY,
    expiration: Math.floor(Date.now() / 1000) + 300,
    facts: [{ nonce: generateNonce() }],
  });

  return serializeInvocation(invocation);
}
