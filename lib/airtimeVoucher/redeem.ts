import type { AirtimeVoucherClient } from './client';
import { isAirtimeVoucherError, isTransient } from './errors';
import type { SwapDetail } from './types';

/**
 * Redeeming a swap, repeated while the service says "not yet" (202): the
 * transaction is not in a block yet, or the PIN is owed and being issued.
 * Repeating is always safe: the service never buys a second PIN for a swap,
 * and a repeat after success answers the same PIN.
 *
 * Stops at the first answer that settles something, or when the time is up:
 * - `issued`: 200, `detail.pin` is set.
 * - `owed`: the burn is verified (`redeeming`); the PIN is not issued yet.
 *   `detail.message` is the service's own text about why.
 * - `not_visible`: the service still cannot see the burn on chain.
 * - `unreachable`: the service (or the chain behind it) kept failing; nothing
 *   is known to have changed. `error` is the last failure.
 * A refusal that is not temporary is thrown (`AirtimeVoucherError`).
 */
export type RedeemOutcome =
  | { kind: 'issued'; detail: SwapDetail }
  | { kind: 'owed'; detail: SwapDetail }
  | { kind: 'not_visible'; detail: SwapDetail }
  | { kind: 'unreachable'; error: unknown };

export interface RedeemLoopOptions {
  client: Pick<AirtimeVoucherClient, 'redeemSwap'>;
  swapId: string;
  txHash: string;
  /** How long to keep asking, in ms. One call is always made. */
  budgetMs?: number;
  /** The pause between two calls while the burn is not visible. */
  everyMs?: number;
  /** How many more calls are made once the PIN is owed (it is usually issued within seconds). */
  owedRetries?: number;
  /** The longest wait a 429 may ask for; a longer one ends the loop as `unreachable`. */
  maxRateLimitWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  /** Told after every answer, so the screen can follow along (the PIN is never in a 202). */
  onAnswer?: (detail: SwapDetail) => void;
  /** Return true to stop asking (the screen was left). */
  cancelled?: () => boolean;
}

export const REDEEM_BUDGET_MS = 90_000;
export const REDEEM_EVERY_MS = 3_000;

export async function redeemUntilSettled({
  client,
  swapId,
  txHash,
  budgetMs = REDEEM_BUDGET_MS,
  everyMs = REDEEM_EVERY_MS,
  owedRetries = 3,
  maxRateLimitWaitMs = 65_000,
  sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
  onAnswer,
  cancelled = () => false,
}: RedeemLoopOptions): Promise<RedeemOutcome> {
  const deadline = now() + budgetMs;
  let last: RedeemOutcome | null = null;
  let owedCalls = 0;
  let rateLimitWaits = 0;

  for (;;) {
    let waitMs = everyMs;
    try {
      const { issued, detail } = await client.redeemSwap(swapId, txHash);
      onAnswer?.(detail);
      if (issued) return { kind: 'issued', detail };
      if (detail.swap.status === 'redeeming') {
        last = { kind: 'owed', detail };
        owedCalls += 1;
        // An order an operator must settle does not move by asking again.
        if (owedCalls > owedRetries || detail.swap.order?.held === true) return last;
      } else {
        last = { kind: 'not_visible', detail };
      }
    } catch (err) {
      if (!isTransient(err)) throw err;
      if (isAirtimeVoucherError(err) && err.code === 'rate_limited') {
        waitMs = (err.retryAfterSec ?? 5) * 1000;
        rateLimitWaits += 1;
        if (waitMs > maxRateLimitWaitMs || rateLimitWaits > 2) return last ?? { kind: 'unreachable', error: err };
      }
      last = last ?? { kind: 'unreachable', error: err };
    }
    // Every path above that reaches this line has set `last`.
    const settled: RedeemOutcome = last ?? { kind: 'unreachable', error: null };
    if (cancelled() || now() + waitMs > deadline) return settled;
    await sleep(waitMs);
    if (cancelled()) return settled;
  }
}
