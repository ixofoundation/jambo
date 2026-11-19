import { BURN_EXPIRY_MARGIN_MS } from './burn';
import {
  SWAP_BURN_JURISDICTION,
  SWAP_BURN_REASON,
  SWAP_BURN_TYPE_URL,
  type SwapBurnMessage,
  type SwapDetail,
  type SwapResponse,
  type SwapStatus,
} from './types';

/**
 * The user's swaps as this browser knows them, kept in localStorage per
 * account (the same convention as lib/yellowcard/pendingDeposit and
 * lib/usdcUpgrade/upgradeState: it survives a reload, a closed tab AND a
 * sign-out, which the persisted Redux store does not).
 *
 * Why it exists: a burn cannot be undone, and the PIN it pays for is read
 * from the service by swap id. So the swap is saved before anything is
 * signed, and the transaction hash is saved after signing and BEFORE
 * broadcast. Whatever happens next, the swap can be redeemed with the stored
 * hash, or read again, and it is never burned for twice.
 *
 * What is NOT stored: the PIN. It is fetched from the service each time it is
 * shown. (The reference is stored; it is public on chain once burned.)
 *
 * Pure parts, unit-tested in swapStore.test.ts; hooks/useAirtimeSwap drives them.
 */

/**
 * Where this device stands with the burn of a swap:
 * - `none`: nothing was signed, or a signed transaction provably did not burn
 *   (refused before broadcast, or failed on chain). The burn may be signed.
 * - `signed`: a transaction was signed and may have been broadcast: its
 *   outcome is unknown. Never sign again; redeem with `txHash`.
 * - `broadcast`: the chain accepted the burn. Never sign again.
 */
export type BurnStage = 'none' | 'signed' | 'broadcast';

export interface StoredSwap {
  id: string;
  reference: string;
  /** Whole rands. */
  amount: number;
  /** ISO 8601: the burn must be in a block at or before this. */
  expiresAt: string;
  /** ms since epoch, when this device first saw the swap. */
  createdAt: number;
  updatedAt: number;
  /** The service's status, as last heard. */
  status: SwapStatus;
  /** The vouchers the service asked to burn. Null when this device never received them. */
  tokens: { id: string; amount: string }[] | null;
  burn: BurnStage;
  /** sha256 of the signed tx bytes, upper-case hex. Set while `burn` is not `none`. */
  txHash: string | null;
  /** The service's own text about an unissued PIN, as last heard. */
  message: string | null;
  /** True when the service says an operator must settle the order. */
  held: boolean;
}

/** The user's vouchers as the service last counted them (`holdings`, or `details.held` of a refusal). */
export interface VoucherCount {
  /** Whole rands. */
  amount: number;
  /** ms since epoch. */
  at: number;
}

export interface SwapBook {
  v: 1;
  /** Newest first. */
  swaps: StoredSwap[];
  vouchers: VoucherCount | null;
}

/** The subset of `Storage` used here (so tests can pass a Map-backed fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Finished swaps kept for reading a PIN again. Unfinished ones are always kept. */
export const MAX_FINISHED_SWAPS = 20;

const STATUSES: readonly SwapStatus[] = ['awaiting_burn', 'redeeming', 'fulfilled', 'expired', 'flagged'];
const TX_HASH = /^[0-9A-Fa-f]{64}$/;

export function swapBookKey(address: string): string {
  return `jambo.airtimeSwap.${address}`;
}

export const EMPTY_BOOK: SwapBook = { v: 1, swaps: [], vouchers: null };

function parseTokens(value: unknown): StoredSwap['tokens'] {
  if (!Array.isArray(value)) return null;
  const tokens: { id: string; amount: string }[] = [];
  for (const token of value) {
    if (typeof token?.id !== 'string' || typeof token?.amount !== 'string') return null;
    tokens.push({ id: token.id, amount: token.amount });
  }
  return tokens;
}

function parseSwap(v: any): StoredSwap | null {
  if (
    typeof v?.id !== 'string' ||
    v.id === '' ||
    typeof v.reference !== 'string' ||
    typeof v.amount !== 'number' ||
    !Number.isSafeInteger(v.amount) ||
    typeof v.expiresAt !== 'string' ||
    typeof v.createdAt !== 'number' ||
    !STATUSES.includes(v.status) ||
    (v.burn !== 'none' && v.burn !== 'signed' && v.burn !== 'broadcast')
  ) {
    return null;
  }
  const txHash = typeof v.txHash === 'string' && TX_HASH.test(v.txHash) ? v.txHash.toUpperCase() : null;
  // A record that says a burn was signed but has lost its hash stays unsignable: `signed`, hash unknown.
  return {
    id: v.id,
    reference: v.reference,
    amount: v.amount,
    expiresAt: v.expiresAt,
    createdAt: v.createdAt,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : v.createdAt,
    status: v.status,
    tokens: parseTokens(v.tokens),
    burn: v.burn,
    txHash,
    message: typeof v.message === 'string' ? v.message : null,
    held: v.held === true,
  };
}

/** Malformed entries are dropped; a missing or broken store reads as an empty book. */
export function loadSwapBook(store: KeyValueStore | null, address: string): SwapBook {
  if (!store || !address) return EMPTY_BOOK;
  try {
    const raw = store.getItem(swapBookKey(address));
    if (!raw) return EMPTY_BOOK;
    const parsed = JSON.parse(raw);
    if (parsed?.v !== 1 || !Array.isArray(parsed.swaps)) return EMPTY_BOOK;
    const swaps = parsed.swaps.map(parseSwap).filter((s: StoredSwap | null): s is StoredSwap => s !== null);
    const vouchers =
      typeof parsed.vouchers?.amount === 'number' && typeof parsed.vouchers?.at === 'number'
        ? { amount: parsed.vouchers.amount, at: parsed.vouchers.at }
        : null;
    return { v: 1, swaps, vouchers };
  } catch {
    return EMPTY_BOOK;
  }
}

/**
 * Writes the book and reads it back. False when it did not stick (no storage,
 * private mode, quota): the caller must then not sign a burn, because a swap
 * this browser cannot remember could lose its PIN.
 */
export function saveSwapBook(store: KeyValueStore | null, address: string, book: SwapBook): boolean {
  if (!store || !address) return false;
  try {
    const raw = JSON.stringify(book);
    store.setItem(swapBookKey(address), raw);
    return store.getItem(swapBookKey(address)) === raw;
  } catch {
    return false;
  }
}

/** A swap is finished for this device when nothing more can happen to it here. */
export function isFinished(swap: StoredSwap): boolean {
  if (swap.status === 'fulfilled' || swap.status === 'flagged') return true;
  // Expired with a burn that may have gone out is not finished: a burn made in time is still redeemed.
  return swap.status === 'expired' && swap.burn === 'none';
}

/** Adds or replaces a swap (newest first) and drops the oldest finished ones past the limit. */
export function withSwap(book: SwapBook, swap: StoredSwap): SwapBook {
  const others = book.swaps.filter((s) => s.id !== swap.id);
  const all = [swap, ...others].sort((a, b) => b.createdAt - a.createdAt);
  let finished = 0;
  const swaps = all.filter((s) => {
    if (!isFinished(s)) return true;
    finished += 1;
    return finished <= MAX_FINISHED_SWAPS;
  });
  return { ...book, swaps };
}

export function withVouchers(book: SwapBook, amount: number, at: number): SwapBook {
  if (!Number.isFinite(amount) || amount < 0) return book;
  return { ...book, vouchers: { amount: Math.floor(amount), at } };
}

export function findSwap(book: SwapBook, id: string): StoredSwap | null {
  return book.swaps.find((s) => s.id === id) ?? null;
}

/** The record of a swap the service just gave (`POST /api/swaps`, 201): nothing signed yet. */
export function swapFromResponse(response: SwapResponse, nowMs: number): StoredSwap {
  const { swap, burn } = response;
  return {
    id: swap.id,
    reference: swap.reference,
    amount: swap.amount,
    expiresAt: swap.expiresAt,
    createdAt: nowMs,
    updatedAt: nowMs,
    status: swap.status,
    tokens: parseTokens(burn?.value?.tokens),
    burn: 'none',
    txHash: null,
    message: null,
    held: false,
  };
}

/**
 * Folds what the service says about a swap (`SwapDetail`) into its record, or
 * makes a record for a swap this device has not seen (an open swap started
 * elsewhere). The PIN in the detail is deliberately not copied.
 *
 * A burn the service itself has recorded settles the local burn stage: it
 * happened, so nothing is ever signed again.
 */
export function withServiceDetail(record: StoredSwap | null, detail: SwapDetail, nowMs: number): StoredSwap {
  const { swap } = detail;
  const serviceHash =
    typeof swap.burnTxHash === 'string' && TX_HASH.test(swap.burnTxHash) ? swap.burnTxHash.toUpperCase() : null;
  const base: StoredSwap = record ?? {
    id: swap.id,
    reference: swap.reference,
    amount: swap.amount,
    expiresAt: swap.expiresAt,
    createdAt: Number.isFinite(Date.parse(swap.createdAt)) ? Date.parse(swap.createdAt) : nowMs,
    updatedAt: nowMs,
    status: swap.status,
    tokens: null,
    burn: 'none',
    txHash: null,
    message: null,
    held: false,
  };
  const burned = serviceHash !== null || swap.status === 'redeeming' || swap.status === 'fulfilled';
  return {
    ...base,
    status: swap.status,
    burn: burned ? 'broadcast' : base.burn,
    txHash: serviceHash ?? base.txHash,
    message: typeof detail.message === 'string' ? detail.message : null,
    held: swap.order?.held === true,
    updatedAt: nowMs,
  };
}

/** After signing, BEFORE broadcast: from here on the burn is never signed again unless it provably did not burn. */
export function withSignedBurn(record: StoredSwap, txHash: string, nowMs: number): StoredSwap {
  if (!TX_HASH.test(txHash)) throw new Error('Not a transaction hash');
  if (record.burn !== 'none') throw new Error('A burn was already signed for this swap');
  return { ...record, burn: 'signed', txHash: txHash.toUpperCase(), updatedAt: nowMs };
}

/** The chain accepted the burn. */
export function withBroadcastBurn(record: StoredSwap, nowMs: number): StoredSwap {
  if (!record.txHash) return record;
  return { ...record, burn: 'broadcast', updatedAt: nowMs };
}

/**
 * The signed transaction provably burned nothing: it was refused before
 * broadcast, or it is in a block with a failure code (`swap_burn_failed`).
 * Only then may the burn be signed again. Never call this for an outcome that
 * is merely unknown (a time-out, a lost connection).
 */
export function withBurnNotMade(record: StoredSwap, nowMs: number): StoredSwap {
  if (record.status !== 'awaiting_burn') return record;
  return { ...record, burn: 'none', txHash: null, updatedAt: nowMs };
}

function expiryMs(record: StoredSwap): number {
  const at = Date.parse(record.expiresAt);
  return Number.isFinite(at) ? at : 0;
}

/**
 * The one rule against burning twice: a burn may be signed only for an open
 * swap that this device has the burn for, for which nothing was signed (or
 * what was signed provably burned nothing), with time left to land.
 */
export function canSignBurn(record: StoredSwap, nowMs: number): boolean {
  return (
    record.status === 'awaiting_burn' &&
    record.burn === 'none' &&
    record.txHash === null &&
    record.tokens !== null &&
    record.tokens.length > 0 &&
    expiryMs(record) - nowMs >= BURN_EXPIRY_MARGIN_MS
  );
}

/** The burn message of a stored swap, in the service's shape, for `checkSwapBurn`. */
export function storedBurnMessage(record: StoredSwap, address: string): SwapBurnMessage {
  return {
    typeUrl: SWAP_BURN_TYPE_URL,
    value: {
      owner: address,
      tokens: record.tokens ?? [],
      jurisdiction: SWAP_BURN_JURISDICTION,
      reason: SWAP_BURN_REASON,
      authorizationId: record.reference,
    },
  };
}

/**
 * What a stored swap needs, for the screens:
 * - `pin`: fulfilled; the PIN can be read from the service.
 * - `owed`: the burn is verified; the PIN is not issued yet.
 * - `flagged`: an operator must look at it.
 * - `burn_sent`: a burn was signed (maybe broadcast); the service has not confirmed it. Redeem; never sign.
 * - `ready`: open, nothing signed, can be burned now.
 * - `open_elsewhere`: open, but this device does not have its burn (started on another device); it runs out by itself.
 * - `expired`: ran out with nothing burned from this device.
 */
export type SwapNeed = 'pin' | 'owed' | 'flagged' | 'burn_sent' | 'ready' | 'open_elsewhere' | 'expired';

export function swapNeed(record: StoredSwap, nowMs: number): SwapNeed {
  if (record.status === 'fulfilled') return 'pin';
  if (record.status === 'redeeming') return 'owed';
  if (record.status === 'flagged') return 'flagged';
  if (record.burn !== 'none') return 'burn_sent';
  if (record.status === 'expired') return 'expired';
  if (canSignBurn(record, nowMs)) return 'ready';
  // Open at the service, nothing signed here, and either out of time or without its burn.
  if (expiryMs(record) - nowMs < BURN_EXPIRY_MARGIN_MS) return 'expired';
  return 'open_elsewhere';
}

/** The swap the user should be taken back to when they return: the newest one that is not finished. */
export function openSwap(book: SwapBook, nowMs: number): StoredSwap | null {
  for (const swap of book.swaps) {
    const need = swapNeed(swap, nowMs);
    // A burn that was signed for a swap the service has since closed stays in the list to be
    // checked again, but no longer takes over the screen: the user may start a new swap.
    if (need === 'burn_sent' && swap.status === 'expired') continue;
    if (need === 'owed' || need === 'burn_sent' || need === 'ready' || need === 'open_elsewhere') return swap;
  }
  return null;
}
