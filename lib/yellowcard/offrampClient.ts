import { YELLOWCARD_WORKER_API } from '@constants/yellowcard';

/**
 * Thin client for the YellowCard worker's off-ramp AND on-ramp endpoints.
 * The ramp routes are UCAN-gated (rootMode 'any') — pass a freshly-minted
 * invocation CAR as the bearer. `/channels` and `/countries` are public.
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

/** `code` on a create 403 when the amount needs identity verification and the
 *  caller presented no credential. The worker decides this (rolling-window
 *  volume + this amount vs its threshold) — jambo never computes it. */
export const RAMP_KYC_REQUIRED_CODE = 'kyc_required';

/** `code` values on a create 403 when a credential WAS sent, failed the
 *  worker's verification, and the amount needs identity verification. */
export const RAMP_KYC_CREDENTIAL_FAILURE_CODES = [
  'expired',
  'name_mismatch',
  'holder_mismatch',
  'bad_signature',
  'malformed',
  'untrusted_issuer',
  'wrong_type',
  'issuer_key_unpublished',
  'bad_disclosure',
  'not_yet_valid',
  'resolver_error',
  'verify_error',
] as const;

export type RampKycCredentialFailureCode = (typeof RAMP_KYC_CREDENTIAL_FAILURE_CODES)[number];

export function isRampKycCredentialFailureCode(code: unknown): code is RampKycCredentialFailureCode {
  return typeof code === 'string' && (RAMP_KYC_CREDENTIAL_FAILURE_CODES as readonly string[]).includes(code);
}

/** The machine-readable parts of a worker error body, for callers that branch
 *  on them (the human-readable part stays on `Error.message`). */
export interface RampApiErrorDetails {
  /** HTTP status of the response. */
  status: number;
  /** Worker `code`, e.g. 'kyc_required' | 'expired' | 'name_mismatch' | … */
  code?: string;
}

/**
 * A non-2xx response from the worker. Still an `Error` whose `message` is
 * exactly what was thrown before (`body.message || body.error || fallback`),
 * so callers that only read `.message` are unaffected; the parsed body's
 * machine-readable fields ride along for callers that need them.
 */
export class RampApiError extends Error implements RampApiErrorDetails {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, details: RampApiErrorDetails) {
    super(message);
    // Keep `instanceof` reliable if a build ever down-levels classes.
    Object.setPrototypeOf(this, RampApiError.prototype);
    this.name = 'RampApiError';
    this.status = details.status;
    this.code = details.code;
  }
}

/** The machine-readable details of a thrown value, or null when it isn't a
 *  worker error (network failure, signing error, …). */
export function rampApiErrorDetails(err: unknown): RampApiErrorDetails | null {
  if (!(err instanceof RampApiError)) return null;
  return { status: err.status, code: err.code };
}

/** Worker responses are JSON, but an edge error page (e.g. a 5xx from the
 *  network in front of it) is not — never let that surface as a SyntaxError. */
function parseJsonBody(text: string): any {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function toRampApiError(path: string, status: number, json: any): RampApiError {
  return new RampApiError(json?.message || json?.error || `Worker ${path} returned ${status}`, {
    status,
    code: typeof json?.code === 'string' ? json.code : undefined,
  });
}

async function post<T>(path: string, body: unknown, bearer?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  const json = parseJsonBody(text);
  if (!res.ok) {
    throw toRampApiError(path, res.status, json);
  }
  return json as T;
}

async function get<T>(path: string, bearer: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${bearer}` } });
  const text = await res.text();
  const json = parseJsonBody(text);
  if (!res.ok) {
    throw toRampApiError(path, res.status, json);
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
  /** True when THIS amount would need identity verification for a caller who
   *  presents no credential. An early hint only — the create call is
   *  authoritative (it also sums by payout account and ID number, which the
   *  quote can't see), so a `kyc_required` 403 can still follow a `false`. */
  kycRequired?: boolean;
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
     *  binds it to the caller's DID before creating the payout. OPTIONAL: send
     *  it whenever we hold one (verified users skip the worker's volume
     *  threshold); OMIT the field otherwise — never send an empty string. With
     *  no credential the create fails with a `kyc_required` 403 once the
     *  amount crosses the worker's threshold. */
    kycCredential?: string;
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

export function listOfframps(
  bearer: string,
): Promise<{ success: true; count: number; transactions: OfframpTransaction[] }> {
  return get(`/offramp/transactions`, bearer);
}

export function getOfframp(id: string, bearer: string): Promise<{ success: true; transaction: OfframpTransaction }> {
  return get(`/offramp/${id}`, bearer);
}

// --- Public: channel/network discovery for the payout bank picker ---

export interface YcNetwork {
  id: string;
  name?: string;
  /** Display code. For most networks a string (e.g. "M PESA", bank sort code),
   *  but some bank networks return an object mapping branch name → code — never
   *  render it directly without a typeof check. */
  code?: string | Record<string, string>;
  status?: string;
  channelId?: string;
  channelIds?: string[];
  /** The rail this network serves ('bank' | 'momo' | 'p2p' | …). Present on all
   *  networks observed; the off-ramp collapses it to bank/momo via mapCategory. */
  channelType?: string;
  /** 'bank' (account number) | 'phone' (mobile-money number). */
  accountNumberType?: string;
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

/** Public: the YC-supported country codes (ISO alpha-2) for a ramp direction.
 *  Maintained server-side so the list can change without a frontend release. */
export async function fetchSupportedCountries(ramp: 'offramp' | 'onramp' = 'offramp'): Promise<string[]> {
  const res = await fetch(`${BASE}/countries${ramp === 'onramp' ? '?ramp=onramp' : ''}`);
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Worker /countries returned ${res.status}`);
  }
  return Array.isArray(json?.countries) ? json.countries : [];
}

/** Discover a country's active channels + networks. `rampType` selects the
 *  direction: 'withdraw' (off-ramp payouts, default) or 'deposit' (on-ramp). */
export async function discoverChannels(
  country: string,
  rampType: 'withdraw' | 'deposit' = 'withdraw',
): Promise<{ channels: YcChannel[]; networks: YcNetwork[] }> {
  const json = await post<{
    results?: Array<{ success?: boolean; country?: string; channels?: unknown; networks?: unknown }>;
  }>('/channels', {
    countries: [country.toUpperCase()],
    rampType,
  });
  const entry = (json.results ?? []).find((r) => r?.success);
  const arr = (v: unknown): any[] =>
    Array.isArray(v)
      ? v
      : Array.isArray((v as any)?.channels)
      ? (v as any).channels
      : Array.isArray((v as any)?.networks)
      ? (v as any).networks
      : [];
  return {
    channels: arr(entry?.channels) as YcChannel[],
    networks: arr(entry?.networks) as YcNetwork[],
  };
}

// ---------------------------------------------------------------------------
// On-ramp (pay local fiat → receive USDC on ixo)
// ---------------------------------------------------------------------------

export interface OnrampSource {
  accountType: 'bank' | 'momo';
  /** Momo: the payer's mobile-money number in international format (+…). */
  accountNumber?: string;
  /** Momo: the mobile-money provider (YC network id). */
  networkId?: string;
  /** Display name of the provider — stored for history only. */
  networkName?: string;
}

export interface OnrampTransaction {
  id: string;
  status: string;
  yc_collection_id: string | null;
  /** Payment rail ('bank' | 'momo'). */
  channel_type: string | null;
  /** Local currency the user pays in. */
  currency: string | null;
  country: string | null;
  /** Local fiat the user pays. */
  local_amount: number | null;
  /** Gross USD equivalent. */
  amount_usd: number | null;
  rate: number | null;
  service_fee_usd: number | null;
  /** YC's crypto-send network fee. */
  network_fee_usd: number | null;
  partner_fee_usd: number | null;
  /** EXACT USDC YellowCard sends after its fees (pre bridge fee). */
  crypto_amount: number | null;
  /** Our flat bridge fee, withheld from the delivery. */
  bridge_fee_usd: number | null;
  /** USDC delivered to the user's ixo account. */
  net_usdc: number | null;
  crypto_currency: string;
  crypto_network: string;
  /** The ixo address the USDC is delivered to. */
  ixo_address: string | null;
  source: unknown;
  /** YC bankInfo — the account to pay INTO (bank rails), or { paymentLink }. */
  bank_info: { name?: string; accountNumber?: string; accountName?: string; paymentLink?: string } | null;
  /** Payment reference the user must include (bank rails). */
  reference: string | null;
  /** Hosted payment page (redirect channels, e.g. South Africa). */
  payment_link: string | null;
  settlement_tx_hash: string | null;
  bridge_tx_hash: string | null;
  bridge_status: string | null;
  error: string | null;
  error_detail: string | null;
  /** Deadline for the user's payment / YC acceptance (unix seconds). */
  expires_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface OnrampQuoteResult {
  success: true;
  currency: string;
  localAmount: number;
  amountUsd?: number;
  rateLocal?: number;
  serviceFeeLocal?: number;
  serviceFeeUSD?: number;
  partnerFeeLocal?: number;
  partnerFeeUSD?: number;
  /** Estimate only — the create response carries the exact network fee. */
  networkFeeUSDEstimate?: number;
  bridgeFeeUsd?: number;
  /** Estimated USDC delivered to the user's ixo account. */
  estimatedUsdcReceive?: number;
  /** Min/max in local currency. */
  transactionLimitMin?: number | null;
  transactionLimitMax?: number | null;
  /** Same early hint as the off-ramp quote (deposits have their own counter
   *  on the worker). */
  kycRequired?: boolean;
}

export function quoteOnramp(
  body: { localAmount: number; currency: string; channelType: string; country: string },
  bearer: string,
): Promise<OnrampQuoteResult> {
  return post<OnrampQuoteResult>('/onramp/quote', body, bearer);
}

export function createOnramp(
  body: {
    /** Local fiat the user will pay — fixed for the user; YC locks the rate. */
    localAmount: number;
    currency: string;
    country: string;
    channelType: string;
    /** The user's ixo address the bridged USDC is delivered to. */
    ixoAddress: string;
    source: OnrampSource;
    customerType?: string;
    customer: OfframpCustomer;
    /** Where a hosted payment page (ZA) returns the user to. */
    returnUrl?: string;
    /** The user's KYC SD-JWT presentation — same rules as the off-ramp:
     *  optional, sent whenever held, omitted (never '') otherwise. */
    kycCredential?: string;
  },
  bearer: string,
): Promise<{ success: true; transaction: OnrampTransaction }> {
  return post('/onramp/create', body, bearer);
}

export function listOnramps(
  bearer: string,
): Promise<{ success: true; count: number; transactions: OnrampTransaction[] }> {
  return get(`/onramp/transactions`, bearer);
}

export function getOnramp(id: string, bearer: string): Promise<{ success: true; transaction: OnrampTransaction }> {
  return get(`/onramp/${id}`, bearer);
}
