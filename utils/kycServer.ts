import { KYC_API_BASE, KycStatus } from '@constants/kyc';
import { ucanAuthHeaders } from '@utils/ucan';

async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleError(res: Response): Promise<never> {
  const body = await parseJson(res);
  const msg =
    (body && typeof body === 'object' && (body.message || body.error)) ||
    (typeof body === 'string' ? body : '') ||
    `HTTP ${res.status}`;
  throw new Error(`KYC server error: ${msg}`);
}

export interface InitiateKycBody {
  protocolId: string;
  claimCollectionId?: string;
  deedOfferId?: string;
  address: string;
  data?: any;
}

export async function initiateKyc(userDid: string, body: InitiateKycBody): Promise<void> {
  const headers = await ucanAuthHeaders(userDid);
  const res = await fetch(`${KYC_API_BASE}/kycaml/${encodeURIComponent(userDid)}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await handleError(res);
}

export interface KycRedirectToken {
  token: string;
  url: string;
  exp: number;
  ts: number;
}

export async function fetchKycRedirect(userDid: string, protocolId: string): Promise<KycRedirectToken> {
  const headers = await ucanAuthHeaders(userDid);
  const res = await fetch(
    `${KYC_API_BASE}/tokens/${encodeURIComponent(userDid)}/${encodeURIComponent(protocolId)}`,
    { headers },
  );
  if (!res.ok) await handleError(res);
  const body = await parseJson(res);
  const data = body?.data;
  if (!data?.url || !data?.token) throw new Error('KYC server returned malformed redirect token');
  return data as KycRedirectToken;
}

export async function fetchKycStatus(userDid: string, protocolId: string): Promise<KycStatus> {
  const res = await fetch(
    `${KYC_API_BASE}/kycaml/${encodeURIComponent(userDid)}/${encodeURIComponent(protocolId)}/status`,
  );
  if (res.status === 404) return KycStatus.Unknown;
  if (!res.ok) await handleError(res);
  const body = await parseJson(res);
  const raw = typeof body?.data === 'string' ? body.data : body;
  const match = Object.values(KycStatus).find((s) => s === raw);
  return (match as KycStatus) ?? KycStatus.Unknown;
}

export async function fetchKycCredential(
  userDid: string,
  protocolId: string,
): Promise<Record<string, any>> {
  const headers = await ucanAuthHeaders(userDid);
  const res = await fetch(
    `${KYC_API_BASE}/kycaml/${encodeURIComponent(userDid)}/${encodeURIComponent(protocolId)}/credential`,
    { headers },
  );
  if (!res.ok) await handleError(res);
  const body = await parseJson(res);
  const data = body?.data;
  if (!data || typeof data !== 'object') throw new Error('KYC server returned no credential');
  return data;
}

/**
 * Fetch the raw PII / deed-offer payload that fed into the KYC credential. Used for
 * the parallel save into the user's matrix room alongside the verifiable credential.
 * The PII lives at `data.deedOfferData` in the dump response.
 */
export async function fetchKycPii(userDid: string, protocolId: string): Promise<Record<string, any>> {
  const headers = await ucanAuthHeaders(userDid);
  const res = await fetch(
    `${KYC_API_BASE}/kycaml/${encodeURIComponent(userDid)}/${encodeURIComponent(protocolId)}?dump=true`,
    { headers },
  );
  if (!res.ok) await handleError(res);
  const body = await parseJson(res);
  const pii = body?.data?.deedOfferData;
  if (!pii || typeof pii !== 'object') throw new Error('KYC server returned no credential data');
  return pii;
}

export async function updateKycStatus(userDid: string, protocolId: string, status: KycStatus): Promise<void> {
  const headers = await ucanAuthHeaders(userDid);
  const res = await fetch(
    `${KYC_API_BASE}/kycaml/${encodeURIComponent(userDid)}/${encodeURIComponent(protocolId)}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) await handleError(res);
}
