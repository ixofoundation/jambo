import { createInvocation, serializeInvocation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { secureLoad } from '@utils/storage';
import { generateNonce } from '@utils/ucanVfs';

/**
 * The only capability claims bots accept: `can: '*'` on this resource. They validate exactly
 * that (ixo-matrix-claims-bot `src/utils/ucan.ts`), and deployed bots answer a narrower `can`
 * or resource as a guest. The limit on this token is its audience and its 5 minutes.
 */
const CLAIM_BOT_CAPABILITY = { can: '*', with: 'ixo:matrix-claims-bot' } as const;

const INVOCATION_TTL_SECONDS = 300;

/**
 * Auth headers for one request to one claims bot: a fresh invocation only `serviceDid` accepts,
 * signed with the user's ed25519 signing key. That key must be on their IID document.
 * `serviceDid` must come from `resolveBoundServiceDid`.
 */
export async function claimBotUcanHeaders(userDid: string, serviceDid: string): Promise<Record<string, string>> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const { signer } = await signerFromMnemonic(mnemonic, userDid as SupportedDID);
  const invocation = await createInvocation({
    issuer: signer,
    audience: serviceDid,
    capability: CLAIM_BOT_CAPABILITY,
    expiration: Math.floor(Date.now() / 1000) + INVOCATION_TTL_SECONDS,
    facts: [{ nonce: generateNonce() }],
  });

  return { Authorization: `Bearer ${await serializeInvocation(invocation)}`, 'X-Auth-Type': 'ucan' };
}
