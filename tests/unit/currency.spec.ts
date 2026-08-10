import { describe, expect, it } from 'vitest';

import { getMicroAmount } from '@utils/encoding';
import {
  amountToMicroAmount,
  calculateMaxTokenAmount,
  calculateTokenAmount,
  microAmountToAmount,
  validateAmountAgainstBalance,
  validateIbcDenom,
} from '@utils/currency';

describe('getMicroAmount', () => {
  it('scales by the given number of decimals', () => {
    expect(getMicroAmount('1', 6)).toBe('1000000');
    expect(getMicroAmount('1.5', 6)).toBe('1500000');
    expect(getMicroAmount('1', 18)).toBe('1000000000000000000');
  });

  it('uses BigNumber, so it does not lose precision the way floats do', () => {
    // 0.1 * 10**18 in float arithmetic gives 100000000000000000.00000001
    expect(getMicroAmount('0.1', 18)).toBe('100000000000000000');
  });

  /**
   * This is the contract that `steps/ReviewAndSign.tsx` currently breaks.
   *
   * Every call site there — the send, multi-send, delegate, undelegate and
   * redelegate branches — calls `getMicroAmount(amount.toString())` with no second
   * argument, so every token is treated as 6-decimal. The chosen token object is in
   * scope and carries its real decimals via `getMicroUnitsFromCurrencyToken()`.
   *
   * For an 18-decimal token that is a 10^12 error in the transacted amount.
   */
  it('defaults to 6 decimals, which is wrong for any token that is not 6-decimal', () => {
    expect(getMicroAmount('1')).toBe('1000000');
    expect(getMicroAmount('1')).not.toBe(getMicroAmount('1', 18));
  });
});

describe('amountToMicroAmount / microAmountToAmount', () => {
  it('round-trips', () => {
    expect(microAmountToAmount(amountToMicroAmount(2.5))).toBe(2.5);
    expect(microAmountToAmount(amountToMicroAmount(2.5, 18), 18)).toBe(2.5);
  });

  it('treats a missing amount as zero rather than NaN', () => {
    expect(amountToMicroAmount(undefined as unknown as number)).toBe(0);
    expect(microAmountToAmount(undefined as unknown as number)).toBe(0);
  });
});

describe('calculateTokenAmount', () => {
  it('converts from micro units', () => {
    expect(calculateTokenAmount(1_500_000)).toBe(1.5);
  });

  it('returns 0 for a falsy amount without dividing', () => {
    expect(calculateTokenAmount(0)).toBe(0);
  });

  it('only floors once the value is at least 1', () => {
    expect(calculateTokenAmount(1_500_000, 6, true)).toBe(1);
    // Below 1 the fraction is kept, otherwise small balances would floor to zero.
    expect(calculateTokenAmount(500_000, 6, true)).toBe(0.5);
  });
});

describe('calculateMaxTokenAmount', () => {
  /**
   * Locks in current behaviour, which does not match the intent stated in the
   * source comment ("subtract 0.3 for gas fees").
   *
   * Callers pass a *micro* amount — `components/Input.tsx` uses
   * `getAmountFromCurrencyToken(maxToken)`, which is the raw on-chain amount — but
   * the 0.3 is subtracted before the conversion to display units. The reserve is
   * therefore 0.3 uixo (3e-7 IXO), not 0.3 IXO, and once the formatter rounds to
   * 6 fraction digits it disappears entirely.
   *
   * Consequence: "Max" offers the whole balance and the transaction can then fail
   * at broadcast for want of gas. Tracked separately; not changed here because
   * altering how much a user sends is a product decision, not a test fix.
   */
  it('does not in practice hold anything back for gas', () => {
    expect(calculateMaxTokenAmount(10_000_000)).toBe('10');
  });

  it('subtracts in micro units, so the reserve is 3e-7 tokens rather than 0.3', () => {
    // 10_000_000 - 0.3 = 9_999_999.7 micro units -> 9.9999997 tokens -> rounds to 10.
    expect(calculateMaxTokenAmount(1_000_000, 6, false)).toBe('1');
  });

  it('returns 0 rather than a negative max when the balance is below the reserve', () => {
    expect(calculateMaxTokenAmount(0.2)).toBe('0');
  });
});

describe('validateAmountAgainstBalance', () => {
  it('treats the balance as micro units by default', () => {
    expect(validateAmountAgainstBalance(1, 1_000_000)).toBe(true);
    expect(validateAmountAgainstBalance(2, 1_000_000)).toBe(false);
  });

  it('compares directly when told the balance is already in display units', () => {
    expect(validateAmountAgainstBalance(1, 1, false)).toBe(true);
  });

  it('always divides by 10^6 regardless of the token decimals', () => {
    // Same shape of assumption as getMicroAmount above: this helper takes no
    // decimals argument, so an 18-decimal balance validates against the wrong bound.
    expect(validateAmountAgainstBalance(1, 1_000_000_000_000_000_000)).toBe(true);
  });
});

describe('validateIbcDenom', () => {
  it('matches ibc denoms case-insensitively at the start only', () => {
    expect(validateIbcDenom('ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2')).toBe(true);
    expect(validateIbcDenom('IBC/ABC')).toBe(true);
    expect(validateIbcDenom('uixo')).toBe(false);
    expect(validateIbcDenom('notibc/abc')).toBe(false);
  });
});
