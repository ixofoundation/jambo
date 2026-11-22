/**
 * The parts of the airtime-voucher-worker's HTTP contract the swap uses.
 *
 * Copied from `packages/contract/src/index.ts` of ixoworld/airtime-voucher-worker
 * (the source of truth; that file's comments say more). Plain types and a few
 * constants, no dependency on that repository: when the contract changes
 * there, change it here.
 */

export type Network = 'devnet' | 'testnet' | 'mainnet';

/** The UCAN ability of an account holder swapping their own vouchers. */
export const SWAP_ABILITY = 'airtime-voucher/swap';
/** The UCAN resource is this prefix followed by the caller's own ixo address. */
export const RESOURCE_PREFIX = 'ixo:airtime-voucher:';
/** The `reason` of a swap burn. */
export const SWAP_BURN_REASON = 'airtime-swap';
/** The `jurisdiction` of a swap burn: South Africa. */
export const SWAP_BURN_JURISDICTION = 'ZA';
/** The type URL of the burn message a swap is made with. */
export const SWAP_BURN_TYPE_URL = '/ixo.token.v1beta1.MsgTransferCredit';

/**
 * Every error code the service answers with (`SERVICE_ERROR_CODES` there).
 * The ones the swap routes can answer are handled one by one in `./messages`.
 */
export type ServiceErrorCode =
  // auth (401 unless noted)
  | 'missing_bearer'
  | 'invalid_format'
  | 'invalid_signature'
  | 'expired'
  | 'audience_mismatch'
  | 'capability_mismatch'
  | 'unauthorized'
  | 'replay' // 409
  | 'not_operator' // 403
  // request
  | 'validation_error' // 400
  | 'not_found' // 404
  | 'idempotency_key_required'
  | 'idempotency_conflict'
  // token
  | 'token_exists'
  | 'token_not_found' // 404: no token created yet
  | 'token_not_active' // 409: creating, failed, paused or stopped
  | 'invalid_class'
  | 'invalid_mint_target'
  // minting (never answered on a swap route)
  | 'operation_in_progress'
  | 'mint_in_progress'
  | 'cap_exceeded'
  | 'insufficient_gas_funds'
  | 'operator_account_not_found'
  | 'chain_tx_failed'
  | 'invalid_transaction'
  | 'permission_expired'
  // upstream
  | 'provider_unavailable' // 503
  | 'chain_unavailable' // 503
  | 'directory_unavailable'
  // other
  | 'test_only'
  | 'config_error' // 500
  | 'internal_error' // 500
  // swaps
  | 'swap_in_progress' // 409: the account already has an open swap (`details.swapId`)
  | 'insufficient_airtime_balance' // 409: the airtime account cannot cover the swap
  | 'insufficient_vouchers' // 422: fewer vouchers than the amount (`details.held`)
  | 'swap_flagged' // 409: the swap was flagged; an operator settles it
  | 'swap_already_redeemed' // 409: redeemed with another transaction
  | 'swap_tx_used' // 409: no longer answered
  | 'swap_burn_failed' // 422: the burn failed on chain; nothing was burned
  | 'swap_burn_invalid' // 422: not this swap's burn (`details.check`, `details.flagged`)
  | 'swaps_paused' // 503: no new swap until an operator settles a purchase
  | 'swap_order_not_stuck'
  | 'provider_order_invalid'
  | 'swap_cooldown' // 429: wait until `details.retryAfter`
  | 'swap_reserve_full' // 503: retry shortly
  | 'pin_unavailable' // 503: the PIN is issued but cannot be read right now
  // identity (403 unless noted): asked for at the request, before any burn
  | 'kyc_required' // no identity credential was sent
  | 'kyc_invalid' // the credential was not accepted (`details.reason`)
  | 'kyc_expired'
  | 'kyc_revoked'
  | 'credential_check_unavailable' // 503: nothing was decided; retry
  // limits
  | 'rate_limited' // 429: `Retry-After`, `details.retryAfterSeconds`
  | 'payload_too_large';

/** An error answer of any route. */
export interface ServiceError {
  error: ServiceErrorCode;
  message: string;
  status: number;
  details?: Record<string, unknown>;
}

/** `GET /api` (public). */
export interface ServiceInfo {
  name: string;
  version: string;
  network: Network;
  /** The worker's did:web: the audience of every UCAN. */
  serviceDid: string;
  authHubUrl: string;
  /** True when the airtime provider is the fake one (no real money, test PINs). */
  test: boolean;
  /** Smallest swap allowed, in rand. */
  minSwapZar: number;
  /** Largest swap allowed, in rand. */
  maxSwapZar: number;
  /**
   * What a swap request must carry here. `kyc`: the user's identity
   * credential. Absent on a service from before it asked for one.
   */
  requires?: { kyc: boolean };
  chain: { chainId: string; rpcUrl: string };
  docs: string;
}

/**
 * `awaiting_burn`: the reference is open, no burn verified. `redeeming`: the
 * burn is verified, the airtime is owed and its PIN is not issued yet.
 * `fulfilled`: the PIN is bought and stored. `expired`: the reference ran out
 * with no burn reported. `flagged`: a burn carries the reference but is not
 * what the swap asked for; an operator decides.
 */
export type SwapStatus = 'awaiting_burn' | 'redeeming' | 'fulfilled' | 'expired' | 'flagged';

export type SwapOrderStatus = 'placed' | 'unknown' | 'failed' | 'fulfilled';

/** Vouchers of one batch: a 1155 token id and how many. */
export interface SwapTokenAmount {
  id: string;
  amount: number;
}

export interface SwapOrder {
  id: string;
  status: SwapOrderStatus;
  attempts: number;
  /** Always null for the account holder. */
  error: string | null;
  providerOrderId: string | null;
  providerRef: string | null;
  bought: boolean;
  /** True when an operator must settle the order. */
  held: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Swap {
  id: string;
  /** The one-time reference the burn carries in `authorization_id`. */
  reference: string;
  /** The account that asked, and the only one that may burn and redeem. */
  address: string;
  /** Whole rands: the vouchers to burn, and the value of the PIN. */
  amount: number;
  contractAddress: string;
  status: SwapStatus;
  /** The burn must be in a block at or before this time (ISO 8601). */
  expiresAt: string;
  burnTxHash: string | null;
  burnedTokens: SwapTokenAmount[] | null;
  flagReason: string | null;
  order: SwapOrder | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /api/swaps`. */
export interface SwapRequest {
  amount: number;
}

/** The burn to sign: one `MsgTransferCredit` with exactly these fields. */
export interface SwapBurnMessage {
  typeUrl: string;
  value: {
    owner: string;
    tokens: { id: string; amount: string }[];
    jurisdiction: string;
    reason: string;
    /** The swap's reference. */
    authorizationId: string;
  };
}

/** The answer of `POST /api/swaps` (201). */
export interface SwapResponse {
  swap: Swap;
  burn: SwapBurnMessage;
  /** The caller's holdings of the service's batches. */
  holdings: SwapTokenAmount[];
}

/** `POST /api/swaps/{id}/redeem`. */
export interface RedeemSwapRequest {
  txHash: string;
}

/** An airtime PIN and how to use it. Only ever answered to its owner. */
export interface SwapPin {
  pin: string;
  valueZar: number;
  /** The USSD code to dial, with the PIN in it. Absent for a test PIN. */
  ussd: string | null;
  /** A web page that redeems the PIN. Absent for a test PIN. */
  url: string | null;
  /** Plain instructions, with the PIN in them. */
  steps: string[];
  /** True for a PIN of the fake provider: not real airtime. */
  test: boolean;
}

/** The answer of `POST /api/swaps/{id}/redeem` (200 or 202) and of `GET /api/swaps/{id}`. */
export interface SwapDetail {
  swap: Swap;
  pin: SwapPin | null;
  /** What the caller should know about where the swap stands: one of a few fixed texts. */
  message: string | null;
}
