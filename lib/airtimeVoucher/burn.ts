import { SWAP_BURN_JURISDICTION, SWAP_BURN_REASON, SWAP_BURN_TYPE_URL, type Swap, type SwapBurnMessage } from './types';

/**
 * The local check of a swap burn before anything is signed. A burn cannot be
 * undone, so the message the service asks for is signed only when it is
 * exactly what the user confirmed: their own vouchers, this swap's reference,
 * the amount they chose. Pure; the caller encodes and signs the result.
 */

/** Which local check refused the burn. */
export type BurnCheck =
  | 'type'
  | 'owner'
  | 'swap_owner'
  | 'reason'
  | 'jurisdiction'
  | 'reference'
  | 'tokens'
  | 'amount'
  | 'status'
  | 'expiry';

/** Nothing was signed. */
export class BurnRefusedError extends Error {
  readonly check: BurnCheck;

  constructor(check: BurnCheck, message: string) {
    super(message);
    Object.setPrototypeOf(this, BurnRefusedError.prototype);
    this.name = 'BurnRefusedError';
    this.check = check;
  }
}

/** The fields of the one `MsgTransferCredit` to sign. */
export interface BurnFields {
  owner: string;
  tokens: { id: string; amount: string }[];
  jurisdiction: string;
  reason: string;
  authorizationId: string;
}

/**
 * The burn must be in a block at or before `expiresAt`. Nothing is signed when
 * less than this is left: a burn that lands late is not redeemed.
 */
export const BURN_EXPIRY_MARGIN_MS = 60_000;

/** The service takes 1 to 50 batches in one burn. */
const MAX_BATCHES = 50;

const WHOLE_POSITIVE = /^[1-9]\d{0,8}$/;

/**
 * Checks the burn the service asked for against what the user confirmed and
 * returns the fields to sign. Throws `BurnRefusedError` otherwise.
 *
 * - `address`: the signed-in account, which will sign.
 * - `amount`: the whole rands the user confirmed.
 */
export function checkSwapBurn({
  burn,
  swap,
  address,
  amount,
  nowMs,
}: {
  burn: SwapBurnMessage;
  swap: Pick<Swap, 'reference' | 'address' | 'amount' | 'expiresAt' | 'status'>;
  address: string;
  amount: number;
  nowMs: number;
}): BurnFields {
  const refuse = (check: BurnCheck, message: string): never => {
    throw new BurnRefusedError(check, message);
  };
  const value = burn?.value;
  if (burn?.typeUrl !== SWAP_BURN_TYPE_URL || !value) refuse('type', 'The service asked for another kind of message');
  if (!address || value.owner !== address) refuse('owner', 'The burn is not from this account');
  if (swap.address !== address) refuse('swap_owner', 'The swap belongs to another account');
  if (value.reason !== SWAP_BURN_REASON) refuse('reason', 'The burn is not marked as an airtime swap');
  if (value.jurisdiction !== SWAP_BURN_JURISDICTION) refuse('jurisdiction', 'The burn names another jurisdiction');
  if (typeof swap.reference !== 'string' || swap.reference === '' || value.authorizationId !== swap.reference) {
    refuse('reference', 'The burn does not carry this swap’s reference');
  }
  if (!Number.isSafeInteger(amount) || amount <= 0 || swap.amount !== amount) {
    refuse('amount', 'The swap is not for the amount that was confirmed');
  }
  const tokens = value.tokens;
  if (!Array.isArray(tokens) || tokens.length < 1 || tokens.length > MAX_BATCHES) {
    refuse('tokens', 'The burn names no vouchers, or too many kinds');
  }
  const seen = new Set<string>();
  let total = 0;
  for (const token of tokens) {
    if (typeof token?.id !== 'string' || token.id === '' || seen.has(token.id)) {
      refuse('tokens', 'The burn names a voucher batch twice, or none');
    }
    if (typeof token.amount !== 'string' || !WHOLE_POSITIVE.test(token.amount)) {
      refuse('tokens', 'A voucher amount is not a positive whole number');
    }
    seen.add(token.id);
    total += Number(token.amount);
  }
  if (total !== amount) refuse('amount', 'The vouchers to burn do not add up to the amount that was confirmed');
  if (swap.status !== 'awaiting_burn') refuse('status', 'The swap is no longer open');
  const expiresAt = Date.parse(swap.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt - nowMs < BURN_EXPIRY_MARGIN_MS) {
    refuse('expiry', 'The swap has run out, or is about to');
  }
  return {
    owner: value.owner,
    tokens: tokens.map((token) => ({ id: token.id, amount: token.amount })),
    jurisdiction: value.jurisdiction,
    reason: value.reason,
    authorizationId: value.authorizationId,
  };
}

/**
 * The gas limit for the burn if the chain cannot simulate it (the limit is
 * normally simulated). The app's fixed fallback (one message) is too tight for
 * a burn of several batches, so the burn brings its own: the figures the
 * worker's own test client uses for the same message.
 */
export function swapBurnGas(batchCount: number): number {
  return 400_000 + 200_000 * Math.max(1, batchCount);
}
