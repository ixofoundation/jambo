import { YELLOWCARD_WORKER_API } from '@constants/yellowcard';

/**
 * Thin client for the YellowCard worker's off-ramp endpoints. The off-ramp
 * routes are UCAN-gated (rootMode 'any') — pass a freshly-minted invocation
 * CAR as the bearer. `/channels` and `/countries` are public.
 */

const BASE = YELLOWCARD_WORKER_API.replace(/\/+$/, '');

export interface OfframpCustomer {
  name: string;
  country: string;
  phone?: string;
  email?: string;
  address?: string;
  dob?: string;
  idType?: string;
  idNumber?: string;
  additionalIdNumber?: string;
}

export interface OfframpDestination {
  accountName: string;
  accountNumber: string;
  accountType: 'bank' | 'momo';
  networkId: string;
  country: string;
  bankName?: string;
}

export interface OfframpTransaction {
  id: string;
  status: string;
  yc_payment_id: string | null;
  crypto_currency: string;
  crypto_network: string;
  deposit_address: string | null;
  /** USDC the user sent from ixo (pre Skip bridge). */
  send_amount_usdc: number | null;
  /** Skip bridge/relay fee (USD ≈ USDC). */
  skip_fee_usd: number | null;
  /** USDC that reached YC after the bridge. */
  amount_usd: number | null;
  local_currency: string | null;
  local_amount: number | null;
  converted_amount: number | null;
  service_fee_usd: number | null;
  partner_fee_usd: number | null;
  rate: number | null;
  /** YC settlement deadline (unix seconds) — bridge retry only valid before. */
  expires_at: number | null;
  destination: unknown;
  channel_id: string | null;
  /** Payout rail YC routed on ('bank' | 'momo'). */
  channel_type: string | null;
  /** Optional crypto refund address (Base) for a failed payout. */
  refund_address: string | null;
  skip_tx_hash: string | null;
  skip_status: string | null;
  /** YC's raw errorCode (e.g. NAME_MISMATCH) or failure reason. */
  error: string | null;
  /** Readable meaning of a YC errorCode, mapped server-side from YC's docs. */
  error_detail: string | null;
  created_at: number;
  updated_at: number;
}

async function post<T>(path: string, body: unknown, bearer?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Worker ${path} returned ${res.status}`);
  }
  return json as T;
}

async function get<T>(path: string, bearer: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${bearer}` } });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Worker ${path} returned ${res.status}`);
  }
  return json as T;
}

export interface QuoteResult {
  success: true;
  currency: string;
  cryptoAmount: number;
  network: string;
  fiatReceived?: number;
  convertedAmount?: number;
  rateLocal?: number;
  serviceFeeLocal?: number;
  serviceFeeUSD?: number;
  partnerFeeLocal?: number;
  partnerFeeUSD?: number;
  paymentMethod?: string;
  /** Min/max the user may sell, in USDC. */
  cryptoMinLimit?: number | null;
  cryptoMaxLimit?: number | null;
  /** Min/max in local currency. */
  transactionLimitMin?: number | null;
  transactionLimitMax?: number | null;
}

export function quoteOfframp(
  body: { cryptoAmount: number; currency: string; channelType: string; country: string; network?: string },
  bearer: string,
): Promise<QuoteResult> {
  return post<QuoteResult>('/offramp/quote', body, bearer);
}

export interface CreateResult {
  success: true;
  id: string;
  status: string;
  yc_payment_id: string | null;
  deposit_address: string | null;
  crypto_network: string;
  crypto_currency: string;
  send_amount_usdc: number | null;
  skip_fee_usd: number | null;
  amount_usd: number | null;
  local_currency: string | null;
  local_amount: number | null;
  service_fee_usd: number | null;
  partner_fee_usd: number | null;
  expires_at: number | null;
  created_at: number;
}

export function createOfframp(
  body: {
    // directSettlement sells take the exact USDC amount (→ settlementInfo.cryptoAmount).
    cryptoAmount: number;
    /** Full USDC the user sent from ixo (pre-bridge) + the bridge fee — stored
     *  for history display only. */
    sendAmountUsdc?: number;
    skipFeeUsd?: number;
    currency: string;
    /** Payout rail — YC auto-routes to the optimal channel of this type. */
    channelType: string;
    network?: string;
    customerType?: string;
    customer: OfframpCustomer;
    destination: OfframpDestination;
    /** The user's KYC credential as the full canonical SD-JWT presentation
     *  (`<jwt>~<disclosure>~…`). The worker verifies it against our oracle and
     *  binds it to the caller's DID before creating the payout. */
    kycCredential: string;
  },
  bearer: string,
): Promise<CreateResult> {
  return post<CreateResult>('/offramp/create', body, bearer);
}

export function notifyDeposit(
  id: string,
  body: { skipTxHash: string; skipStatus?: string },
  bearer: string,
): Promise<{ success: true; transaction: OfframpTransaction }> {
  return post(`/offramp/${id}/deposit`, body, bearer);
}

/** Download the payment-record PDF for a COMPLETED off-ramp (worker returns
 *  400 otherwise). The worker brands it "Proof of Payment"; for NG it includes
 *  the bank's NIP session id. */
export async function fetchPaymentRecordPdf(id: string, bearer: string): Promise<Blob> {
  const res = await fetch(`${BASE}/offramp/${id}/proof`, { headers: { Authorization: `Bearer ${bearer}` } });
  if (!res.ok) {
    const text = await res.text();
    let json: { message?: string; error?: string } | null = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(json?.message || json?.error || `Worker /offramp/${id}/proof returned ${res.status}`);
  }
  return res.blob();
}

export function listOfframps(bearer: string): Promise<{ success: true; count: number; transactions: OfframpTransaction[] }> {
  return get(`/offramp/transactions`, bearer);
}

export function getOfframp(id: string, bearer: string): Promise<{ success: true; transaction: OfframpTransaction }> {
  return get(`/offramp/${id}`, bearer);
}

// --- Public: channel/network discovery for the payout bank picker ---

export interface YcNetwork {
  id: string;
  name?: string;
  code?: string;
  status?: string;
  channelId?: string;
  channelIds?: string[];
}
export interface YcChannel {
  id: string;
  currency?: string;
  accountType?: string;
  channelType?: string;
  rampType?: string;
  status?: string;
  /** Whether the channel is usable by YC's widget quote — the worker only
   *  returns channels with this 'active', since the quote depends on it. */
  widgetStatus?: string;
  /** API/submit-payment minimum (local currency) — the one YC enforces. */
  min?: number;
  max?: number;
  /** Widget-flow limits — NOT what the API enforces (often lower). */
  widgetMin?: number;
  widgetMax?: number;
  estimatedSettlementTime?: number;
}

/** Public: the YC-supported off-ramp country codes (ISO alpha-2). Maintained
 *  server-side so the list can be updated without a frontend release. */
export async function fetchSupportedCountries(): Promise<string[]> {
  const res = await fetch(`${BASE}/countries`);
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Worker /countries returned ${res.status}`);
  }
  return Array.isArray(json?.countries) ? json.countries : [];
}

export async function discoverChannels(country: string): Promise<{ channels: YcChannel[]; networks: YcNetwork[] }> {
  const json = await post<{ results?: Array<{ success?: boolean; country?: string; channels?: unknown; networks?: unknown }> }>('/channels', {
    countries: [country.toUpperCase()],
  });
  const entry = (json.results ?? []).find((r) => r?.success);
  const arr = (v: unknown): any[] =>
    Array.isArray(v) ? v : Array.isArray((v as any)?.channels) ? (v as any).channels : Array.isArray((v as any)?.networks) ? (v as any).networks : [];
  return {
    channels: arr(entry?.channels) as YcChannel[],
    networks: arr(entry?.networks) as YcNetwork[],
  };
}
