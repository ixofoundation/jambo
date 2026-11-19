import { describe, expect, it } from 'vitest';

import { BURN_EXPIRY_MARGIN_MS, BurnRefusedError, checkSwapBurn, swapBurnGas, type BurnCheck } from './burn';
import { ADDRESS, NOW, REFERENCE, burnOf, swapOf } from './testFixtures';
import type { Swap, SwapBurnMessage } from './types';

function check(over: {
  burn?: SwapBurnMessage;
  swap?: Partial<Swap>;
  address?: string;
  amount?: number;
  nowMs?: number;
}) {
  return checkSwapBurn({
    burn: over.burn ?? burnOf(),
    swap: swapOf(over.swap),
    address: over.address ?? ADDRESS,
    amount: over.amount ?? 20,
    nowMs: over.nowMs ?? NOW,
  });
}

function refusedWith(run: () => unknown): BurnCheck {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(BurnRefusedError);
    return (err as BurnRefusedError).check;
  }
  throw new Error('expected the burn to be refused');
}

describe('the burn is signed only when it is exactly what the user confirmed', () => {
  it('returns the service’s fields untouched when everything matches', () => {
    expect(check({})).toEqual({
      owner: ADDRESS,
      tokens: [
        { id: 'batch-a', amount: '15' },
        { id: 'batch-b', amount: '5' },
      ],
      jurisdiction: 'ZA',
      reason: 'airtime-swap',
      authorizationId: REFERENCE,
    });
  });

  it('refuses another message type', () => {
    expect(refusedWith(() => check({ burn: { ...burnOf(), typeUrl: '/cosmos.bank.v1beta1.MsgSend' } }))).toBe('type');
  });

  it('refuses a burn from another owner, or a swap of another account', () => {
    expect(refusedWith(() => check({ burn: burnOf({ owner: 'ixo1someoneelse' }) }))).toBe('owner');
    expect(refusedWith(() => check({ swap: { address: 'ixo1someoneelse' } }))).toBe('swap_owner');
    expect(refusedWith(() => check({ address: '' }))).toBe('owner');
  });

  it('refuses another reason or jurisdiction', () => {
    expect(refusedWith(() => check({ burn: burnOf({ reason: 'retire' }) }))).toBe('reason');
    expect(refusedWith(() => check({ burn: burnOf({ reason: 'Airtime-Swap' }) }))).toBe('reason');
    expect(refusedWith(() => check({ burn: burnOf({ jurisdiction: 'KE' }) }))).toBe('jurisdiction');
  });

  it('refuses a reference that is not this swap’s', () => {
    expect(refusedWith(() => check({ burn: burnOf({ authorizationId: 'ref-other' }) }))).toBe('reference');
    expect(refusedWith(() => check({ burn: burnOf({ authorizationId: '' }), swap: { reference: '' } }))).toBe(
      'reference',
    );
  });

  it('refuses when the swap or the vouchers are not the confirmed amount', () => {
    // The user confirmed R20; the service answered a swap of R50.
    expect(refusedWith(() => check({ swap: { amount: 50 } }))).toBe('amount');
    // The swap says R20 but the vouchers to burn add up to R25.
    expect(
      refusedWith(() =>
        check({
          burn: burnOf({
            tokens: [
              { id: 'batch-a', amount: '15' },
              { id: 'batch-b', amount: '10' },
            ],
          }),
        }),
      ),
    ).toBe('amount');
    expect(refusedWith(() => check({ burn: burnOf({ tokens: [{ id: 'batch-a', amount: '19' }] }) }))).toBe('amount');
    expect(refusedWith(() => check({ amount: 20.5, swap: { amount: 20.5 } }))).toBe('amount');
  });

  it('refuses malformed vouchers', () => {
    const tokens = (list: { id: string; amount: string }[]) => () => check({ burn: burnOf({ tokens: list }) });
    expect(refusedWith(tokens([]))).toBe('tokens');
    expect(refusedWith(tokens([{ id: '', amount: '20' }]))).toBe('tokens');
    expect(refusedWith(tokens([{ id: 'batch-a', amount: '20.0' }]))).toBe('tokens');
    expect(refusedWith(tokens([{ id: 'batch-a', amount: '-20' }]))).toBe('tokens');
    expect(refusedWith(tokens([{ id: 'batch-a', amount: '020' }]))).toBe('tokens');
    expect(refusedWith(tokens([{ id: 'batch-a', amount: 20 as unknown as string }]))).toBe('tokens');
    expect(
      refusedWith(
        tokens([
          { id: 'batch-a', amount: '10' },
          { id: 'batch-a', amount: '10' },
        ]),
      ),
    ).toBe('tokens');
    expect(refusedWith(tokens(Array.from({ length: 51 }, (_, i) => ({ id: `b${i}`, amount: '1' }))))).toBe('tokens');
  });

  it('refuses a swap that is no longer open, or has too little time left to land', () => {
    expect(refusedWith(() => check({ swap: { status: 'expired' } }))).toBe('status');
    expect(refusedWith(() => check({ swap: { status: 'redeeming' } }))).toBe('status');
    const expiresAt = new Date(NOW + BURN_EXPIRY_MARGIN_MS - 1).toISOString();
    expect(refusedWith(() => check({ swap: { expiresAt } }))).toBe('expiry');
    expect(refusedWith(() => check({ swap: { expiresAt: 'soon' } }))).toBe('expiry');
    expect(() => check({ swap: { expiresAt: new Date(NOW + BURN_EXPIRY_MARGIN_MS).toISOString() } })).not.toThrow();
  });

  it('asks for more gas for more batches', () => {
    expect(swapBurnGas(1)).toBe(600_000);
    expect(swapBurnGas(3)).toBe(1_000_000);
    expect(swapBurnGas(0)).toBe(600_000);
  });
});
