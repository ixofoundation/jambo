import {
  createDelegation,
  serializeDelegation,
  signerFromMnemonic,
  type Capability,
  type SupportedDID,
} from '@ixo/ucan';
import base58 from 'bs58';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { deriveEd25519KeyPairFromMnemonic } from '@utils/veramo';
import { hasEd25519VerificationMethod, buildAddEd25519VerificationMsg } from '@utils/did';

/**
 * UCAN delegation minting for the email-notifier flow.
 *
 * Unlike the impacts-x reference (which decrypts the signing mnemonic from
 * Matrix behind a PIN prompt), jambo keeps the Ed25519 `ED_SIGNING_MNEMONIC` in
 * secure storage in plaintext (decrypted at auth-hub login), so we can mint
 * delegations directly — same pattern as the KYC invocation flow in
 * `@utils/ucan`.
 */

function loadSigningMnemonic(): string {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');
  // Some auth-hub publish paths trim the mnemonic before deriving the on-chain
  // key; trim here too so the delegation issuer matches the registered key.
  return String(mnemonic).trim();
}

export interface MintDelegationArgs {
  userDid: string;
  audience: string;
  capabilities: Capability[];
  ttlSeconds: number;
}

/**
 * Signs and serializes a UCAN delegation from the user's Ed25519 signing key.
 */
export async function mintDelegation({
  userDid,
  audience,
  capabilities,
  ttlSeconds,
}: MintDelegationArgs): Promise<string> {
  const mnemonic = loadSigningMnemonic();
  const { signer } = await signerFromMnemonic(mnemonic, userDid as SupportedDID);

  const delegation = await createDelegation({
    issuer: signer,
    audience,
    capabilities,
    expiration: Math.floor(Date.now() / 1000) + ttlSeconds,
  });

  return serializeDelegation(delegation);
}

/**
 * Ensures the user's Ed25519 verification method is registered on chain so the
 * notifier worker can verify our delegations. Mirrors the claim-submission flow
 * in `screens/collectionForm.tsx`. Idempotent — broadcasts `MsgAddVerification`
 * only when the key is missing. `onSign` is `useAuth().onSign` (session-key
 * signer); it surfaces the existing signing modal.
 */
export async function ensureEd25519OnChain({
  did,
  address,
  onSign,
}: {
  did: string;
  address: string;
  onSign: (messages: any[]) => Promise<unknown>;
}): Promise<void> {
  const mnemonic = loadSigningMnemonic();
  const keyPair = deriveEd25519KeyPairFromMnemonic(mnemonic);
  const pubKeyBase58 = base58.encode(keyPair.publicKey);

  const hasVm = await hasEd25519VerificationMethod(did, pubKeyBase58);
  if (hasVm) return;

  const addVmMsg = buildAddEd25519VerificationMsg(did, keyPair.publicKey, address);
  await onSign([addVmMsg]);
}
