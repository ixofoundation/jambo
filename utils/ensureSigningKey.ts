import base58 from 'bs58';

import authConstants from '@constants/auth';
import { buildAddEd25519VerificationMsg, hasEd25519VerificationMethod } from '@utils/did';
import { secureLoad } from '@utils/storage';
import { deriveEd25519KeyPairFromMnemonic } from '@utils/veramo';

/**
 * Make sure the user's ed25519 signing key is a verification method on their IID document.
 *
 * Every UCAN this key signs (VFS claim-media uploads/reads, KYC) is verified against the DID
 * document, so the key must be registered on-chain BEFORE the first such request. The claim/bid
 * submission paths already register it right before signing the credential — but evidence is
 * uploaded while the form is still being filled, i.e. earlier. This runs the identical,
 * idempotent check at that point: a no-op once the key is registered, one signed
 * MsgAddVerification (via `onSign`) the very first time.
 */
export async function ensureEd25519VerificationMethod({
  did,
  address,
  onSign,
}: {
  did: string;
  address: string;
  onSign: (msgs: any[]) => Promise<unknown>;
}): Promise<void> {
  const edMnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!edMnemonic) throw new Error('Ed25519 signing mnemonic not available — please sign in again');

  const keyPair = deriveEd25519KeyPairFromMnemonic(edMnemonic);
  const pubKeyBase58 = base58.encode(keyPair.publicKey);

  if (await hasEd25519VerificationMethod(did, pubKeyBase58)) return;
  await onSign([buildAddEd25519VerificationMsg(did, keyPair.publicKey, address)]);
}
