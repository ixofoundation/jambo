import { describe, expect, it } from 'vitest';

import type { RedeemResult } from './client';
import { AirtimeVoucherError } from './errors';
import { redeemUntilSettled } from './redeem';
import { PIN, SWAP_ID, TX_HASH, detailOf } from './testFixtures';

type Step = RedeemResult | Error;

function run(steps: Step[], options: { budgetMs?: number; owedRetries?: number } = {}) {
  let clock = 0;
  const slept: number[] = [];
  const calls: [string, string][] = [];
  const queue = [...steps];
  const outcome = redeemUntilSettled({
    client: {
      redeemSwap: async (id, hash) => {
        calls.push([id, hash]);
        const step = queue.shift();
        if (!step) throw new Error('no step queued');
        if (step instanceof Error) throw step;
        return step;
      },
    },
    swapId: SWAP_ID,
    txHash: TX_HASH,
    everyMs: 3_000,
    budgetMs: options.budgetMs ?? 90_000,
    owedRetries: options.owedRetries,
    now: () => clock,
    sleep: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
  });
  return { outcome, slept, calls };
}

const notVisible: RedeemResult = { issued: false, detail: detailOf({}, null, 'Not in a block yet.') };
const owed: RedeemResult = {
  issued: false,
  detail: detailOf({ status: 'redeeming' }, null, 'The PIN is being issued.'),
};
const issued: RedeemResult = { issued: true, detail: detailOf({ status: 'fulfilled' }, PIN) };
const refusal = (code: string, status: number, retryAfterSec?: number) =>
  new AirtimeVoucherError({ code: code as AirtimeVoucherError['code'], status, message: code, retryAfterSec });

describe('redeeming until something is settled', () => {
  it('repeats while the burn is not visible, always with the same hash, and stops at the PIN', async () => {
    const r = run([notVisible, notVisible, issued]);
    const outcome = await r.outcome;
    expect(outcome.kind).toBe('issued');
    expect(outcome.kind === 'issued' && outcome.detail.pin?.pin).toBe(PIN.pin);
    expect(r.slept).toEqual([3_000, 3_000]);
    expect(r.calls).toEqual([
      [SWAP_ID, TX_HASH],
      [SWAP_ID, TX_HASH],
      [SWAP_ID, TX_HASH],
    ]);
  });

  it('gives up after the budget and says the burn is not visible yet', async () => {
    const r = run([notVisible, notVisible, notVisible, notVisible], { budgetMs: 7_000 });
    const outcome = await r.outcome;
    expect(outcome.kind).toBe('not_visible');
    expect(r.calls).toHaveLength(3);
  });

  it('asks a few more times once the PIN is owed, then reports it as owed with the service’s message', async () => {
    const r = run([notVisible, owed, owed, owed], { owedRetries: 2 });
    const outcome = await r.outcome;
    expect(outcome.kind).toBe('owed');
    expect(outcome.kind === 'owed' && outcome.detail.message).toBe('The PIN is being issued.');
    expect(r.calls).toHaveLength(4);
  });

  it('does not keep asking about an order an operator must settle', async () => {
    const held: RedeemResult = {
      issued: false,
      detail: detailOf({
        status: 'redeeming',
        order: {
          id: 'o1',
          status: 'placed',
          attempts: 1,
          error: null,
          providerOrderId: null,
          providerRef: null,
          bought: true,
          held: true,
          createdAt: '',
          updatedAt: '',
        },
      }),
    };
    const r = run([held]);
    expect((await r.outcome).kind).toBe('owed');
    expect(r.calls).toHaveLength(1);
  });

  it('waits out a 429 for as long as it says, then carries on', async () => {
    const r = run([refusal('rate_limited', 429, 20), issued]);
    expect((await r.outcome).kind).toBe('issued');
    expect(r.slept).toEqual([20_000]);
  });

  it('stops on a 429 that asks for longer than it will wait', async () => {
    const r = run([notVisible, refusal('rate_limited', 429, 600)]);
    expect((await r.outcome).kind).toBe('not_visible');
    expect(r.slept).toEqual([3_000]);
  });

  it('tries again through a service or chain hiccup', async () => {
    const r = run([refusal('chain_unavailable', 503), refusal('network_error', 0), issued]);
    expect((await r.outcome).kind).toBe('issued');
    expect(r.calls).toHaveLength(3);
  });

  it('reports unreachable when nothing ever answered', async () => {
    const r = run([refusal('timeout', 0), refusal('timeout', 0), refusal('timeout', 0)], { budgetMs: 5_000 });
    const outcome = await r.outcome;
    expect(outcome.kind).toBe('unreachable');
    expect(r.calls).toHaveLength(2);
  });

  it('throws a refusal that will not change by asking again', async () => {
    for (const code of [
      'swap_burn_invalid',
      'swap_burn_failed',
      'swap_flagged',
      'swap_already_redeemed',
      'pin_unavailable',
    ]) {
      const r = run([refusal(code, 422)]);
      await expect(r.outcome).rejects.toMatchObject({ code });
      expect(r.calls).toHaveLength(1);
    }
  });
});
