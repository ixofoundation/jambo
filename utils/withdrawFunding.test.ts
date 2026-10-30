import { describe, expect, it } from 'vitest';

import { planWithdrawalFunding } from '@utils/withdrawFunding';

const usdc = (n: number) => BigInt(n * 1_000_000);

describe('planWithdrawalFunding', () => {
  const base = { usdcMicro: usdc(40), payMicro: usdc(10), upgradeableMicro: usdc(50) };

  it('direct when the withdrawable USDC covers it (no upgrade asked for)', () => {
    expect(planWithdrawalFunding({ ...base, amountMicro: usdc(40) })).toEqual({ kind: 'direct' });
  });

  it('converts exactly the shortfall of rewards before asking for an upgrade', () => {
    expect(planWithdrawalFunding({ ...base, amountMicro: usdc(45) })).toEqual({
      kind: 'convert',
      neededPayMicro: usdc(5),
    });
  });

  it('upgrade first when only the legacy USDC makes it reachable', () => {
    expect(planWithdrawalFunding({ ...base, amountMicro: usdc(51) })).toEqual({ kind: 'upgrade_first' });
    expect(planWithdrawalFunding({ ...base, amountMicro: usdc(100) })).toEqual({ kind: 'upgrade_first' });
  });

  it('insufficient past everything together, with that maximum', () => {
    expect(planWithdrawalFunding({ ...base, amountMicro: usdc(100) + BigInt(1) })).toEqual({
      kind: 'insufficient',
      maxMicro: usdc(100),
    });
  });

  it('no upgrade offered (testnet, old worker): legacy USDC never counts as withdrawable', () => {
    expect(planWithdrawalFunding({ ...base, upgradeableMicro: BigInt(0), amountMicro: usdc(51) })).toEqual({
      kind: 'insufficient',
      maxMicro: usdc(50),
    });
  });

  it('zero or negative amounts are insufficient, never direct', () => {
    expect(planWithdrawalFunding({ ...base, amountMicro: BigInt(0) }).kind).toBe('insufficient');
    expect(planWithdrawalFunding({ ...base, amountMicro: BigInt(-1) }).kind).toBe('insufficient');
  });

  it('exact beyond Number precision', () => {
    const big = BigInt('9007199254740993');
    expect(
      planWithdrawalFunding({
        amountMicro: big,
        usdcMicro: big - BigInt(1),
        payMicro: BigInt(1),
        upgradeableMicro: BigInt(0),
      }),
    ).toEqual({ kind: 'convert', neededPayMicro: BigInt(1) });
  });
});
