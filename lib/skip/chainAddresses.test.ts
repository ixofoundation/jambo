import { describe, expect, it } from 'vitest';
import { toBech32, fromHex } from '@cosmjs/encoding';

import { completeChainAddresses, resolvePreSellChainAddresses, routeNeedsRecoveryAddresses } from './chainAddresses';

const USER = 'ixo1user';
const EVM = '0x1111111111111111111111111111111111111111';
const INJ = toBech32('inj', fromHex(EVM.slice(2)));
const OTHER_INJ = toBech32('inj', fromHex('2222222222222222222222222222222222222222'));

describe('chain address mapping', () => {
  it('a route with no recovery chain: ixo + Base, no recovery config needed', () => {
    const required = ['ixo-5', '8453'];
    expect(routeNeedsRecoveryAddresses(required)).toBe(false);
    const pre = resolvePreSellChainAddresses({ requiredChainAddresses: required, ixoAddress: USER });
    expect(
      completeChainAddresses({ requiredChainAddresses: required, preSell: pre, destinationAddress: '0xdep' }),
    ).toEqual({
      'ixo-5': USER,
      '8453': '0xdep',
    });
  });

  it('Injective route: 1776 → the worker refund wallet', () => {
    const required = ['ixo-5', '1776', '8453'];
    expect(routeNeedsRecoveryAddresses(required)).toBe(true);
    const pre = resolvePreSellChainAddresses({
      requiredChainAddresses: required,
      ixoAddress: USER,
      recoveryAddresses: { '1776': EVM, 'injective-1': INJ },
    });
    expect(pre).toEqual({ 'ixo-5': USER, '1776': EVM });
  });

  it('injective-1 when Skip asks for it, cross-checked against 1776', () => {
    const required = ['ixo-5', '1776', 'injective-1', '8453'];
    expect(
      resolvePreSellChainAddresses({
        requiredChainAddresses: required,
        ixoAddress: USER,
        recoveryAddresses: { '1776': EVM, 'injective-1': INJ },
      }),
    ).toEqual({ 'ixo-5': USER, '1776': EVM, 'injective-1': INJ });
    expect(() =>
      resolvePreSellChainAddresses({
        requiredChainAddresses: required,
        ixoAddress: USER,
        recoveryAddresses: { '1776': EVM, 'injective-1': OTHER_INJ },
      }),
    ).toThrow(/differ/);
  });

  it('throws for any other chain ("Aborting for safety")', () => {
    expect(() =>
      resolvePreSellChainAddresses({ requiredChainAddresses: ['ixo-5', 'noble-1', '8453'], ixoAddress: USER }),
    ).toThrow(/Aborting for safety/);
  });

  it('throws when the recovery address is missing or malformed', () => {
    expect(() =>
      resolvePreSellChainAddresses({
        requiredChainAddresses: ['ixo-5', '1776'],
        ixoAddress: USER,
        recoveryAddresses: {},
      }),
    ).toThrow(/Aborting for safety/);
    expect(() =>
      resolvePreSellChainAddresses({
        requiredChainAddresses: ['1776'],
        ixoAddress: USER,
        recoveryAddresses: { '1776': 'inj1notevm' },
      }),
    ).toThrow(/not an EVM address/);
  });
});
