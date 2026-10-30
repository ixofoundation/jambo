import { describe, expect, it } from 'vitest';

import { RampApiError } from 'lib/yellowcard/offrampClient';
import {
  type DepositStore,
  type PendingDeposit,
  classifyDepositError,
  loadPendingDeposits,
  pendingDepositsKey,
  savePendingDeposits,
  withDeposit,
  withoutDeposit,
} from './pendingDeposit';

const ADDR = 'ixo1user';
const entry: PendingDeposit = { v: 1, offrampId: 'off_1', txHash: 'CD'.repeat(32), signedAt: 1, state: 'pending' };

function memStore(): DepositStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('pending off-ramp deposits (saved before broadcast)', () => {
  it('round-trips, per account', () => {
    const store = memStore();
    savePendingDeposits(store, ADDR, withDeposit({}, entry));
    expect(loadPendingDeposits(store, ADDR)).toEqual({ off_1: entry });
    expect(loadPendingDeposits(store, 'ixo1other')).toEqual({});
    savePendingDeposits(store, ADDR, withoutDeposit(loadPendingDeposits(store, ADDR), 'off_1'));
    expect(store.map.has(pendingDepositsKey(ADDR))).toBe(false);
  });

  it('drops malformed entries and survives broken storage', () => {
    const store = memStore();
    store.setItem(
      pendingDepositsKey(ADDR),
      JSON.stringify({ off_1: entry, off_2: { ...entry, offrampId: 'off_2', txHash: 'x' } }),
    );
    expect(Object.keys(loadPendingDeposits(store, ADDR))).toEqual(['off_1']);
    store.setItem(pendingDepositsKey(ADDR), 'not json');
    expect(loadPendingDeposits(store, ADDR)).toEqual({});
    const broken: DepositStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPendingDeposits(broken, ADDR)).toEqual({});
    expect(() => savePendingDeposits(broken, ADDR, { off_1: entry })).not.toThrow();
  });
});

describe('classifyDepositError (POST /offramp/{id}/deposit answers)', () => {
  const api = (status: number, code?: string, retryAfterSec?: number) =>
    new RampApiError('x', { status, code, retryAfterSec });

  it('retries 503 / 429 / 5xx / network', () => {
    expect(classifyDepositError(api(503, 'tx_pending', 5))).toEqual({ kind: 'retry', retryAfterMs: 5000 });
    expect(classifyDepositError(api(503, 'verification_unavailable', 10))).toEqual({
      kind: 'retry',
      retryAfterMs: 10_000,
    });
    expect(classifyDepositError(api(429))).toEqual({ kind: 'retry', retryAfterMs: undefined });
    expect(classifyDepositError(new TypeError('Failed to fetch'))).toEqual({ kind: 'retry' });
  });

  it('tx_failed: nothing moved', () =>
    expect(classifyDepositError(api(422, 'tx_failed'))).toEqual({ kind: 'tx_failed' }));

  it('another transfer already recorded', () =>
    expect(classifyDepositError(api(409, 'deposit_already_recorded'))).toEqual({ kind: 'already_recorded' }));

  it('permanent refusals (the transfer may have moved — never re-send)', () => {
    for (const [s, c] of [
      [422, 'deposit_mismatch'],
      [403, 'not_your_transaction'],
      [403, 'unsupported_account'],
      [400, 'invalid_skip_status'],
      [409, undefined],
    ] as const) {
      expect(classifyDepositError(api(s, c))).toEqual({ kind: 'refused' });
    }
  });
});
