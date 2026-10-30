import { describe, expect, it } from 'vitest';

import { baseToDisplay, denomDisplay, displayToBase } from '@utils/denomAmount';

const NOBLE = 'ibc/6BBE9BD4246F8E04948D5A4EEE7164B2630263B9EBB5E7DC5F0A46C62A2FF97B';
const INJ = 'ibc/77C12480BD8C29BF0ACEC2143736C15BAF8CD232CA27BAE09336677B828955E6';

describe('denomDisplay', () => {
  it('shows both USDC denoms as plain USDC (6 dp), IXO, and passes unknown denoms through', () => {
    expect(denomDisplay(NOBLE)).toEqual({ symbol: 'USDC', decimals: 6 });
    expect(denomDisplay(INJ)).toEqual({ symbol: 'USDC', decimals: 6 });
    expect(denomDisplay('uixo')).toEqual({ symbol: 'IXO', decimals: 6 });
    expect(denomDisplay('ibc/2658C97F')).toEqual({ symbol: 'ibc/2658C97F', decimals: 0 });
  });
});

describe('base ↔ display', () => {
  it('scales both ways without float error', () => {
    expect(baseToDisplay('1500000', 6)).toBe('1.5');
    expect(baseToDisplay('1', 6)).toBe('0.000001');
    expect(baseToDisplay('25000000', 6)).toBe('25');
    expect(displayToBase('1.5', 6)).toBe('1500000');
    expect(displayToBase('0.1', 6)).toBe('100000');
    expect(displayToBase('.25', 6)).toBe('250000');
    expect(displayToBase('25', 6)).toBe('25000000');
    expect(displayToBase(baseToDisplay('123456789', 6), 6)).toBe('123456789');
  });

  it('rounds extra digits down and rejects junk', () => {
    expect(displayToBase('1.0000019', 6)).toBe('1000001');
    expect(displayToBase('-1', 6)).toBeNull();
    expect(displayToBase('abc', 6)).toBeNull();
    expect(displayToBase('', 6)).toBeNull();
  });

  it('0-decimal denoms are unscaled', () => {
    expect(baseToDisplay('42', 0)).toBe('42');
    expect(displayToBase('42', 0)).toBe('42');
  });
});
