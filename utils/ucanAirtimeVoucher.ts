import { signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { accountDid, createSwapToken, type SwapMethod } from 'lib/airtimeVoucher/swapToken';

/**
 * Swap tokens for the airtime voucher service, signed with the user's own
 * Ed25519 key.
 *
 * Mirrors `@utils/ucanYellowcard`: the `ED_SIGNING_MNEMONIC` is in secure
 * storage in plaintext (decrypted at auth-hub login), so tokens are signed
 * directly, with no PIN prompt. The service reads the key from the account's
 * DID document on chain, so it must be registered there first
 * (`ensureEd25519OnChain` in `@utils/ucanDelegation`).
 */

// The signer derived from the stored mnemonic, reused for the page lifetime (a swap signs
// several tokens). Keyed by mnemonic + DID, so a re-login or another account derives a fresh one.
let cachedSigner: { key: string; signer: Promise<Awaited<ReturnType<typeof signerFromMnemonic>>['signer']> } | null =
  null;

function signerFor(mnemonic: string, did: string) {
  const key = `${did}\n${mnemonic}`;
  if (!cachedSigner || cachedSigner.key !== key) {
    const signer = signerFromMnemonic(mnemonic, did as SupportedDID).then((r) => r.signer);
    cachedSigner = { key, signer };
    signer.catch(() => {
      if (cachedSigner?.key === key) cachedSigner = null;
    });
  }
  return cachedSigner.signer;
}

/**
 * Signs one single-use swap token for one request (`method` and `path`),
 * issued by `did:ixo:<address>` to the service (`audience`, its DID from
 * `GET /api`).
 */
export async function mintSwapToken(
  address: string,
  request: { audience: string; method: SwapMethod; path: string },
): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');
  const signer = await signerFor(String(mnemonic).trim(), accountDid(address));
  return createSwapToken({ signer, address, ...request });
}
