import { describe, expect, it, vi } from 'vitest';

// The query layer is tested with an injected fake client; keep the real SDK out of the test run.
vi.mock('@ixo/impactxclient-sdk', () => ({ createQueryClient: vi.fn() }));

import { INJECTIVE_USDC_DENOM, NOBLE_USDC_DENOM } from '@constants/usdc';
import { type BankQueryClient, NETWORK_USDC_DENOMS, queryWalletBalances, summarizeUsdc } from '@utils/usdcBalance';

const NOBLE = NOBLE_USDC_DENOM;
const INJ = INJECTIVE_USDC_DENOM;
const MAINNET = { usdc: INJ, legacy: [NOBLE] };

function fakeClient(balances: Record<string, string | Error>): BankQueryClient {
  return {
    cosmos: {
      bank: {
        v1beta1: {
          balance: async ({ denom }) => {
            const v = balances[denom];
            if (v instanceof Error) throw v;
            return { balance: { amount: v ?? '0' } };
          },
        },
      },
    },
  };
}

describe('summarizeUsdc', () => {
  it('one total = withdrawable + legacy, exact beyond Number precision', () => {
    const big = BigInt('9007199254740993'); // 2^53 + 1
    const s = summarizeUsdc(BigInt(1), [{ denom: NOBLE, micro: big }]);
    expect(s.totalMicro).toBe(BigInt('9007199254740994'));
    expect(s.usdcMicro).toBe(BigInt(1));
    expect(s.legacyMicro).toBe(big);
  });

  it('no legacy rows → total is the withdrawable USDC', () => {
    const s = summarizeUsdc(BigInt(25_000_000), []);
    expect(s).toEqual({
      usdcMicro: BigInt(25_000_000),
      legacyMicro: BigInt(0),
      totalMicro: BigInt(25_000_000),
      legacy: [],
    });
  });
});

describe('queryWalletBalances', () => {
  it('reads the withdrawable USDC and the legacy USDC — never PAY', async () => {
    const b = await queryWalletBalances(
      fakeClient({ [NOBLE]: '50000000', [INJ]: '25000000', upay: '7000000' }),
      'ixo1test',
      MAINNET,
    );
    expect(b.usdc.usdcMicro).toBe(BigInt(25_000_000));
    expect(b.usdc.legacy).toEqual([{ denom: NOBLE, micro: BigInt(50_000_000) }]);
    expect(b.usdc.totalMicro).toBe(BigInt(75_000_000));
    expect(b).not.toHaveProperty('pay');
    expect(b.complete).toBe(true);
  });

  it('one denom failing never throws, but marks the whole read unknown (not zero)', async () => {
    const b = await queryWalletBalances(
      fakeClient({ [NOBLE]: new Error('rpc down'), [INJ]: '25000000', upay: '1' }),
      'ixo1test',
      MAINNET,
    );
    expect(b.complete).toBe(false);
    expect(b.usdc.usdcMicro).toBe(BigInt(25_000_000));
  });

  it('a malformed amount is a failed read instead of throwing', async () => {
    const b = await queryWalletBalances(fakeClient({ [NOBLE]: '1.5', [INJ]: '2', upay: '0' }), 'ixo1test', MAINNET);
    expect(b.usdc.usdcMicro).toBe(BigInt(2));
    expect(b.complete).toBe(false);
  });

  it('no client / no address → unknown', async () => {
    const b = await queryWalletBalances(null, '', MAINNET);
    expect(b.complete).toBe(false);
    expect(b.usdc.legacy).toHaveLength(1);
  });

  it('testnet shape (no USDC, no legacy): nothing is read, a known zero', async () => {
    const asked: string[] = [];
    const client = fakeClient({ upay: '3' });
    const spy: BankQueryClient = {
      cosmos: {
        bank: {
          v1beta1: {
            balance: (req) => {
              asked.push(req.denom);
              return client.cosmos.bank.v1beta1.balance(req);
            },
          },
        },
      },
    };
    const b = await queryWalletBalances(spy, 'ixo1test', { usdc: null, legacy: [] });
    expect(asked).toEqual([]);
    expect(b.usdc.totalMicro).toBe(BigInt(0));
    expect(b.complete).toBe(true);
  });

  it('the mainnet build reads Injective USDC as withdrawable and Noble USDC as legacy', () => {
    expect(NETWORK_USDC_DENOMS).toEqual(MAINNET);
  });
});
