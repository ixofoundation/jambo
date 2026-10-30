import { describe, expect, it } from 'vitest';
import { toBech32 } from '@cosmjs/encoding';

import { SKIP_ENTRY_CONTRACTS, isAddressLike, timeoutProblem, upgradeMemoProblem, walkMemo } from './txChecks';

const USER = toBech32('ixo', new Uint8Array(20).fill(1));
const OURS = {
  'noble-1': toBech32('noble', new Uint8Array(20).fill(2)),
  'osmosis-1': toBech32('osmo', new Uint8Array(20).fill(3)),
};

describe('isAddressLike (same rule as the worker)', () => {
  it('matches bech32 of any prefix, EVM and 32-byte values', () => {
    expect(isAddressLike(USER)).toBe(true);
    expect(isAddressLike(SKIP_ENTRY_CONTRACTS['osmosis-1'])).toBe(true);
    expect(isAddressLike(USER.toUpperCase())).toBe(true);
    expect(isAddressLike('0x' + 'ab'.repeat(20))).toBe(true);
    expect(isAddressLike('ab'.repeat(32))).toBe(true);
    expect(isAddressLike('q6urq6urq6urq6urq6urq6urq6urq6urq6urq6urq6s=')).toBe(true);
  });

  it('never matches denoms, channels, ports, amounts or venue names', () => {
    for (const s of [
      'ibc/6BBE9BD4246F8E04948D5A4EEE7164B2630263B9EBB5E7DC5F0A46C62A2FF97B',
      'uusdc',
      'erc20:0xa00C59fF5a080D2b954d0c75e46E22a0c371235a',
      'channel-26',
      'transfer',
      '4975000',
      '1793342554989991567',
      'osmosis-poolmanager',
    ]) {
      expect(isAddressLike(s)).toBe(false);
    }
  });
});

describe('walkMemo', () => {
  it('follows nested JSON memos and skips pool ids', () => {
    const memo = JSON.stringify({
      forward: {
        receiver: 'osmo1x',
        next: {
          pool: toBech32('osmo', new Uint8Array(32).fill(9)),
          memo: JSON.stringify({ forward: { receiver: USER } }),
        },
      },
    });
    const f = walkMemo(memo);
    expect(f.receivers).toContain(USER);
    expect(f.addresses).toEqual([USER]);
  });

  it('throws on a memo that is not a JSON object, a broken nested memo, or nesting deeper than 32', () => {
    expect(() => walkMemo('hello')).toThrow();
    expect(() => walkMemo('[1]')).toThrow();
    expect(() => walkMemo(JSON.stringify({ a: '{broken' }))).toThrow();
    let deep: unknown = 'x';
    for (let i = 0; i < 40; i++) deep = { n: deep };
    expect(() => walkMemo(JSON.stringify(deep))).toThrow();
  });
});

describe('upgradeMemoProblem', () => {
  const memo = (o: unknown) => JSON.stringify(o);
  const ctx = { user: USER, chainAddresses: OURS };

  it('accepts a route that recovers to us and ends at the user', () => {
    expect(
      upgradeMemoProblem(
        memo({
          forward: {
            receiver: SKIP_ENTRY_CONTRACTS['osmosis-1'],
            recover_address: OURS['osmosis-1'],
            next: { receiver: USER },
          },
        }),
        ctx,
      ),
    ).toBeNull();
  });

  it('refuses a stranger, a foreign recover_address, or no final hop to the user', () => {
    const stranger = toBech32('osmo', new Uint8Array(20).fill(7));
    expect(upgradeMemoProblem(memo({ forward: { receiver: stranger }, x: { receiver: USER } }), ctx)).toMatch(
      /allow-list/,
    );
    expect(upgradeMemoProblem(memo({ forward: { receiver: USER, recover_address: USER } }), ctx)).toMatch(
      /recover_address/,
    );
    expect(upgradeMemoProblem(memo({ forward: { receiver: OURS['noble-1'] } }), ctx)).toMatch(/does not end/);
    expect(upgradeMemoProblem('', ctx)).toMatch(/no memo/);
  });
});

describe('timeoutProblem', () => {
  const now = 1_793_342_255_003;
  it('accepts (now, now + 2 h], number or string', () => {
    expect(timeoutProblem((now + 300_000) * 1e6, now)).toBeNull();
    expect(timeoutProblem(String(BigInt(now + 7_200_000) * BigInt(1_000_000)), now)).toBeNull();
  });
  it('refuses the past, more than 2 h ahead, or no timestamp', () => {
    expect(timeoutProblem(now * 1e6 - 1e9, now)).toMatch(/past/);
    expect(timeoutProblem((now + 7_300_000) * 1e6, now)).toMatch(/2 h/);
    expect(timeoutProblem(undefined, now)).toMatch(/timeout_timestamp/);
    expect(timeoutProblem('0x1', now)).toMatch(/timeout_timestamp/);
  });
});
