import { PAY_CONVERT_ORACLE_URL } from '@constants/payConvert';
import { RampApiError } from 'lib/yellowcard/offrampClient';

/**
 * The conversion oracle's door (pay-convert-oracle `src/convert/routes.ts`):
 *
 *   GET  /convert/info               what a client needs to build the conversion tx
 *   POST /convert/claim              store the claim body → its CID is the claim id (UCAN)
 *   POST /convert/grant              mint this user's one-shot Submit right (UCAN)
 *   POST /convert/scan               "a claim just landed, look now"
 *   GET  /convert/status/:claimId    where one conversion is
 *
 * Errors surface as `RampApiError` (status + the oracle's `code`) like the
 * YellowCard client's, so the screen maps them to friendly copy the same way.
 */

export interface ConvertInfo {
  collectionId: string;
  /** The deed's admin account — where the PAY goes and the USDC comes from. */
  admin: string;
  payDenom: string;
  payoutDenom: string;
  /** Per-conversion cap, payout base units. */
  maxClaimBase: string;
  intentDurationSec: number;
  oracleDid: string | null;
}

export interface ConvertClaim {
  claimId: string;
  url: string | null;
}

export interface ConvertGrant {
  grant: { id: string; txHash: string; expiresAt: string };
  conversion: {
    collectionId: string;
    admin: string;
    payDenom: string;
    payoutDenom: string;
    amountBase: string;
    intentDurationSec: number;
  };
}

export type ConvertStage = 'unknown' | 'evaluating' | 'review' | 'approved' | 'paid' | 'rejected' | 'failed';

/** The PAY side of a conversion: what went back to the wallet, or is on its way back. */
export interface ConvertRefund {
  status: 'waiting' | 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'none';
  /** PAY base units owed back (0 when nothing is). */
  amountBase: string;
  reason: 'rejected' | 'overpaid' | 'none';
  txHash: string | null;
}

export interface ConvertStatus {
  stage: ConvertStage;
  txHash: string | null;
  receiptCid: string | null;
  detail: string | null;
  /** Null until the oracle has looked at the PAY side of a decided conversion. */
  refund: ConvertRefund | null;
}

export const CONVERT_OVER_CAP_CODE = 'over_cap';
export const CONVERT_FLOAT_LOW_CODE = 'float_low';
export const CONVERT_TOO_MANY_CODE = 'too_many_grants';

function parseJsonBody(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit, fallback: string): Promise<T> {
  const res = await fetch(`${PAY_CONVERT_ORACLE_URL}${path}`, init);
  const body = parseJsonBody(await res.text());
  if (!res.ok) {
    throw new RampApiError(body?.message || body?.error || fallback, { status: res.status, code: body?.code });
  }
  return body as T;
}

const authed = (bearer: string, body: unknown): RequestInit => ({
  method: 'POST',
  headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export function fetchConvertInfo(): Promise<ConvertInfo> {
  return request<ConvertInfo>('/convert/info', { method: 'GET' }, 'Conversion is not available right now');
}

export function storeConvertClaim(bearer: string, amountBase: string): Promise<ConvertClaim> {
  return request<ConvertClaim>('/convert/claim', authed(bearer, { amountBase }), 'Could not prepare the conversion');
}

export function requestConvertGrant(bearer: string, amountBase: string): Promise<ConvertGrant> {
  return request<ConvertGrant>('/convert/grant', authed(bearer, { amountBase }), 'Could not authorize the conversion');
}

export function nudgeConvertScan(): Promise<{ started: number }> {
  return request<{ started: number }>('/convert/scan', { method: 'POST' }, 'Could not reach the conversion oracle');
}

export function fetchConvertStatus(claimId: string): Promise<ConvertStatus> {
  return request<ConvertStatus>(
    `/convert/status/${encodeURIComponent(claimId)}`,
    { method: 'GET' },
    'Could not read the conversion status',
  );
}
