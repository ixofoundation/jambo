import { createInvocation, serializeInvocation, signerFromMnemonic, type SupportedDID } from '@ixo/ucan';

import authConstants from '@constants/auth';
import { KYC_API_BASE } from '@constants/kyc';
import { secureLoad } from '@utils/storage';

let cachedServerDid: string | null = null;

async function fetchKycServerDid(): Promise<string> {
  if (cachedServerDid) return cachedServerDid;

  const res = await fetch(`${KYC_API_BASE}/.well-known/did.json`);
  if (!res.ok) throw new Error(`Failed to fetch KYC server DID: ${res.status}`);
  const doc = await res.json();
  const did = doc?.id;
  if (typeof did !== 'string' || !did.startsWith('did:')) {
    throw new Error('Malformed KYC server DID document');
  }
  cachedServerDid = did;
  return did;
}

async function buildUcanInvocation(userDid: string): Promise<string> {
  const mnemonic = secureLoad(authConstants.secretKey.ED_SIGNING_MNEMONIC);
  if (!mnemonic) throw new Error('Signing mnemonic not available — please sign in again');

  const serverDid = await fetchKycServerDid();
  const { signer } = await signerFromMnemonic(mnemonic, userDid as SupportedDID);

  const invocation = await createInvocation({
    issuer: signer,
    audience: serverDid,
    capability: { can: '*', with: 'ixo:kyc' },
    expiration: Math.floor(Date.now() / 1000) + 300,
  });

  return serializeInvocation(invocation);
}

export async function ucanAuthHeaders(userDid: string): Promise<Record<string, string>> {
  const token = await buildUcanInvocation(userDid);
  return {
    Authorization: `Bearer ${token}`,
    'X-Auth-Type': 'ucan',
  };
}
