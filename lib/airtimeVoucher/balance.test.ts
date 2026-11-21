import { describe, expect, it, vi } from 'vitest';

import {
  BALANCE_CHUNK,
  fetchVoucherList,
  parseVoucherList,
  queryVoucherBalance,
  type VoucherToken,
  type WasmQueryClient,
} from './balance';

const OWNER = 'ixo1qqqsyqcyq5rqwzqfpg9scrgwpugpzysn3w7apx';

function voucher(over: Partial<VoucherToken> = {}): VoucherToken {
  return {
    name: 'Test Airtime ZAR',
    description: '',
    image: 'https://example.com/i.png',
    contractAddress: 'ixo1contract',
    valueZar: 1,
    test: true,
    tokenIds: ['a', 'b'],
    ...over,
  };
}

/** A contract that answers `batch_balance` from `held` (by token id), and records what it was asked. */
function chain(held: Record<string, string>, answer?: (ids: string[]) => unknown) {
  const asked: { address: string; owner: string; ids: string[] }[] = [];
  const client: WasmQueryClient = {
    cosmwasm: {
      wasm: {
        v1: {
          async smartContractState({ address, queryData }) {
            const query = JSON.parse(new TextDecoder().decode(queryData)) as {
              batch_balance: { owner: string; token_ids: string[] };
            };
            const ids = query.batch_balance.token_ids;
            asked.push({ address, owner: query.batch_balance.owner, ids });
            const body = answer ? answer(ids) : { balances: ids.map((id) => held[id] ?? '0') };
            return { data: new TextEncoder().encode(JSON.stringify(body)) };
          },
        },
      },
    },
  };
  return { client, asked };
}

describe('parseVoucherList', () => {
  it('reads a list, also an empty one', () => {
    expect(parseVoucherList({ vouchers: [] })).toEqual([]);
    expect(parseVoucherList({ vouchers: [voucher()] })).toEqual([voucher()]);
  });

  it('refuses anything else', () => {
    expect(parseVoucherList(null)).toBeNull();
    expect(parseVoucherList({})).toBeNull();
    expect(parseVoucherList({ vouchers: [{ ...voucher(), contractAddress: '' }] })).toBeNull();
    expect(parseVoucherList({ vouchers: [{ ...voucher(), tokenIds: [1] }] })).toBeNull();
    expect(parseVoucherList({ vouchers: [{ ...voucher(), valueZar: 0 }] })).toBeNull();
  });
});

describe('fetchVoucherList', () => {
  const answer = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status })) as never;

  it('asks the public route, with no token and the browser cache left on', async () => {
    const doFetch = vi.fn(async () => new Response(JSON.stringify({ vouchers: [voucher()] })));
    expect(await fetchVoucherList('https://airtime.example.org/', doFetch as never)).toEqual([voucher()]);
    const [url, init] = doFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://airtime.example.org/api/vouchers');
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.cache).toBeUndefined();
  });

  it('throws on a refusal and on an answer it cannot read', async () => {
    await expect(fetchVoucherList('https://a.example', answer(503, {}))).rejects.toThrow('503');
    await expect(fetchVoucherList('https://a.example', answer(200, { nope: 1 }))).rejects.toThrow('could not be read');
  });
});

describe('queryVoucherBalance', () => {
  it('sums the listed batches of every token, in rand', async () => {
    const { client, asked } = chain({ a: '70', b: '5', c: '25' });
    const vouchers = [voucher(), voucher({ contractAddress: 'ixo1other', tokenIds: ['c'] })];
    expect(await queryVoucherBalance(client, OWNER, vouchers)).toBe(100);
    expect(asked).toEqual([
      { address: 'ixo1contract', owner: OWNER, ids: ['a', 'b'] },
      { address: 'ixo1other', owner: OWNER, ids: ['c'] },
    ]);
  });

  it('is zero without asking when no batch is listed', async () => {
    const { client, asked } = chain({});
    expect(await queryVoucherBalance(client, OWNER, [voucher({ tokenIds: [] })])).toBe(0);
    expect(await queryVoucherBalance(client, OWNER, [])).toBe(0);
    expect(asked).toEqual([]);
  });

  it('asks in chunks and counts a repeated id once', async () => {
    const ids = Array.from({ length: BALANCE_CHUNK + 3 }, (_, i) => `id${i}`);
    const held = Object.fromEntries(ids.map((id) => [id, '1']));
    const { client, asked } = chain(held);
    expect(await queryVoucherBalance(client, OWNER, [voucher({ tokenIds: [...ids, 'id0'] })])).toBe(ids.length);
    expect(asked.map((q) => q.ids.length)).toEqual([BALANCE_CHUNK, 3]);
  });

  it('is unknown, not zero, when the contract cannot be read', async () => {
    const short = chain({}, () => ({ balances: ['1'] }));
    expect(await queryVoucherBalance(short.client, OWNER, [voucher()])).toBeNull();
    const odd = chain({}, (ids) => ({ balances: ids.map(() => '1.5') }));
    expect(await queryVoucherBalance(odd.client, OWNER, [voucher()])).toBeNull();
    const huge = chain({}, (ids) => ({ balances: ids.map(() => '9'.repeat(30)) }));
    expect(await queryVoucherBalance(huge.client, OWNER, [voucher()])).toBeNull();
    const down: WasmQueryClient = {
      cosmwasm: { wasm: { v1: { smartContractState: () => Promise.reject(new Error('down')) } } },
    };
    expect(await queryVoucherBalance(down, OWNER, [voucher()])).toBeNull();
  });
});
