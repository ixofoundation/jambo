import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';
import { fetchWithTimeout, PRE_SIGN_TIMEOUT_MS, withTimeout } from '@utils/fetchTimeout';

/**
 * The holder's voucher balance, for display: the worker's public list of
 * voucher tokens (`GET /api/vouchers`, no sign-in) and one read of each
 * token's contract for the balance of the listed batches. Only vouchers of
 * those batches can be swapped, so only those are counted.
 *
 * The list is fetched with the browser's own cache: the worker answers with
 * an ETag and a short max-age, so a repeat costs a "not modified" at most.
 * Nothing here signs anything, and no figure here decides a swap: the worker
 * counts again when a swap is asked for.
 */

/** One voucher token of the service, as `GET /api/vouchers` lists it. */
export interface VoucherToken {
  name: string;
  description: string;
  image: string;
  /** The token's 1155 contract. */
  contractAddress: string;
  /** What one voucher is worth, in rand. */
  valueZar: number;
  /** True when PINs are test PINs. */
  test: boolean;
  /** The 1155 ids of the batches that can be swapped, oldest first. */
  tokenIds: string[];
}

export const VOUCHERS_PATH = '/api/vouchers';

/** Token ids per `batch_balance` query; the worker reads in the same size. */
export const BALANCE_CHUNK = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVoucherToken(value: unknown): value is VoucherToken {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.contractAddress === 'string' &&
    value.contractAddress !== '' &&
    typeof value.valueZar === 'number' &&
    Number.isFinite(value.valueZar) &&
    value.valueZar > 0 &&
    Array.isArray(value.tokenIds) &&
    value.tokenIds.every((id) => typeof id === 'string' && id !== '')
  );
}

/** The voucher tokens in an answer of `GET /api/vouchers`; null when it is not one. */
export function parseVoucherList(json: unknown): VoucherToken[] | null {
  if (!isRecord(json) || !Array.isArray(json.vouchers)) return null;
  return json.vouchers.every(isVoucherToken) ? json.vouchers : null;
}

/** `GET /api/vouchers`. Throws when the service cannot be reached or its answer cannot be read. */
export async function fetchVoucherList(baseUrl: string, doFetch: typeof fetchWithTimeout = fetchWithTimeout) {
  const url = `${baseUrl.trim().replace(/\/+$/, '')}${VOUCHERS_PATH}`;
  const res = await doFetch(url, { headers: { Accept: 'application/json' } }, PRE_SIGN_TIMEOUT_MS);
  if (!res.ok) throw new Error(`The airtime service answered ${res.status} to GET ${VOUCHERS_PATH}`);
  const vouchers = parseVoucherList(await res.json());
  if (!vouchers) throw new Error(`The airtime service's answer to GET ${VOUCHERS_PATH} could not be read`);
  return vouchers;
}

/** The slice of the ixo query client this module uses (so tests can pass a fake). */
export interface WasmQueryClient {
  cosmwasm: {
    wasm: {
      v1: {
        smartContractState(req: { address: string; queryData: Uint8Array }): Promise<{ data?: Uint8Array } | undefined>;
      };
    };
  };
}

/** How many vouchers of `ids` `owner` holds on one contract. Throws on any answer it cannot read. */
async function heldOn(client: WasmQueryClient, contract: string, owner: string, ids: string[]): Promise<bigint> {
  let held = BigInt(0);
  for (let start = 0; start < ids.length; start += BALANCE_CHUNK) {
    const chunk = ids.slice(start, start + BALANCE_CHUNK);
    const query = { batch_balance: { owner, token_ids: chunk } };
    const res = await withTimeout(
      client.cosmwasm.wasm.v1.smartContractState({
        address: contract,
        queryData: new TextEncoder().encode(JSON.stringify(query)),
      }),
      PRE_SIGN_TIMEOUT_MS,
      'voucher balance',
    );
    const answer: unknown = JSON.parse(new TextDecoder().decode(res?.data ?? new Uint8Array()));
    const balances = isRecord(answer) ? answer.balances : null;
    if (!Array.isArray(balances) || balances.length !== chunk.length) {
      throw new Error('The token contract answered with the wrong number of balances');
    }
    for (const balance of balances) {
      if (typeof balance !== 'string' || !/^\d+$/.test(balance)) {
        throw new Error('The token contract answered with a balance that is not a whole number');
      }
      held += BigInt(balance);
    }
  }
  return held;
}

/**
 * What `owner` holds across `vouchers`, in rand. Null when any read failed
 * or the sum is not a number that can be shown: unknown, never zero.
 */
export async function queryVoucherBalance(
  client: WasmQueryClient,
  owner: string,
  vouchers: readonly VoucherToken[],
): Promise<number | null> {
  try {
    let rand = 0;
    for (const voucher of vouchers) {
      const ids = [...new Set(voucher.tokenIds)];
      if (ids.length === 0) continue;
      const held = await heldOn(client, voucher.contractAddress, owner, ids);
      if (held > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      rand += Number(held) * voucher.valueZar;
    }
    return Number.isSafeInteger(rand) ? rand : null;
  } catch {
    return null;
  }
}

/**
 * The holder's voucher balance in rand, read fresh. Never throws: null means
 * it could not be read (the service or the chain did not answer), and must
 * not be shown as zero.
 */
export async function getVoucherBalance(baseUrl: string, owner: string): Promise<number | null> {
  if (!baseUrl || !owner) return null;
  try {
    const vouchers = await fetchVoucherList(baseUrl);
    if (vouchers.every((voucher) => voucher.tokenIds.length === 0)) return 0;
    const client = await withTimeout(createQueryClient(CHAIN_RPC_URL), PRE_SIGN_TIMEOUT_MS, 'rpc connect');
    return await queryVoucherBalance(client as unknown as WasmQueryClient, owner, vouchers);
  } catch {
    return null;
  }
}
