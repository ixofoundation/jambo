import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';
import { LEGACY_USDC_DENOMS, USDC_DENOM } from '@constants/usdc';
import { PRE_SIGN_TIMEOUT_MS, withTimeout } from '@utils/fetchTimeout';

export interface TokenBalance {
  /** The denom queried. */
  denom: string;
  /** Balance in the base unit (6 decimals). */
  amountMicro: string;
  /** Balance in whole tokens. */
  amount: number;
  /** False when the query failed: the zero above is then UNKNOWN, not an empty balance. */
  ok: boolean;
}

/** A legacy USDC denom the wallet was asked about (zero balances included). */
export interface LegacyUsdcBalance {
  denom: string;
  /** Base units (6 decimals). */
  micro: bigint;
}

/** The user's USDC: the ONE withdrawable denom plus any legacy USDC still held.
 *  `totalMicro` is the one amount the screens show; only `usdcMicro` can be
 *  withdrawn — legacy USDC has to be upgraded first (hooks/useUsdcUpgrade). */
export interface UsdcBalances {
  /** The withdrawable USDC (constants/usdc `USDC_DENOM`, or test mode's stand-in), base units. */
  usdcMicro: bigint;
  /** Sum of every legacy row. */
  legacyMicro: bigint;
  /** usdcMicro + legacyMicro. */
  totalMicro: bigint;
  /** One row per legacy denom asked about, in the order asked. */
  legacy: LegacyUsdcBalance[];
}

/** Which denoms to read: the withdrawable one (null = none on this network) and the legacy ones. */
export interface UsdcDenomSet {
  usdc: string | null;
  legacy: readonly string[];
}

/** This build's network: Injective USDC + legacy Noble USDC on mainnet, nothing elsewhere. */
export const NETWORK_USDC_DENOMS: UsdcDenomSet = { usdc: USDC_DENOM, legacy: LEGACY_USDC_DENOMS };

export interface WalletBalances {
  /** The user's USDC (constants/usdc). */
  usdc: UsdcBalances;
  /** False when any query failed (or the RPC could not be reached): treat these numbers as
   *  unknown — keep the last good read and say it could not be refreshed, never show zero. */
  complete: boolean;
}

/** The slice of the ixo query client this module uses (so tests can pass a fake). */
export interface BankQueryClient {
  cosmos: {
    bank: {
      v1beta1: {
        balance(req: { address: string; denom: string }): Promise<{ balance?: { amount?: string } | null } | undefined>;
      };
    };
  };
}

type QueryClient = BankQueryClient;

/** One bank balance query; never throws — a failure is a zero marked `ok: false`. */
async function queryBalance(queryClient: QueryClient | null, address: string, denom: string): Promise<TokenBalance> {
  const failed: TokenBalance = { denom, amountMicro: '0', amount: 0, ok: false };
  if (!queryClient || !address) return failed;
  try {
    const res = await withTimeout(
      queryClient.cosmos.bank.v1beta1.balance({ address, denom }),
      PRE_SIGN_TIMEOUT_MS,
      `balance ${denom}`,
    );
    const micro = res?.balance?.amount ?? '0';
    // Reject anything that is not a plain base-unit integer — BigInt() would throw on it later.
    if (!/^\d+$/.test(micro)) return failed;
    return { denom, amountMicro: micro, amount: Number(micro) / 1e6, ok: true };
  } catch {
    return failed;
  }
}

async function connect(): Promise<QueryClient | null> {
  try {
    return await withTimeout(createQueryClient(CHAIN_RPC_URL), PRE_SIGN_TIMEOUT_MS, 'rpc connect');
  } catch {
    return null;
  }
}

/** Whole tokens from base units (6 decimals), for display only. */
export function fromMicro(micro: bigint): number {
  return Number(micro) / 1e6;
}

/** Base units (6 decimals) from a whole amount, as an integer string — exponent form for an
 *  absurd amount, which callers check for before BigInt(). */
export function toMicro(amount: number): string {
  return Math.round(amount * 1e6).toString();
}

/** "$10.00" — a USD amount as currency, for hints and limits. */
export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(amount);
}

/** Sum the withdrawable and legacy balances into the shape the screens render. Pure, bigint math. */
export function summarizeUsdc(usdcMicro: bigint, legacy: readonly LegacyUsdcBalance[]): UsdcBalances {
  let legacyMicro = BigInt(0);
  for (const row of legacy) legacyMicro += row.micro;
  return { usdcMicro, legacyMicro, totalMicro: usdcMicro + legacyMicro, legacy: legacy.map((r) => ({ ...r })) };
}

/** The query side of `getWalletBalances`, with the client injected (tests). One
 *  `balance` query per denom, in parallel; any failure makes the read `complete: false`. */
export async function queryWalletBalances(
  queryClient: QueryClient | null,
  address: string,
  denoms: UsdcDenomSet = NETWORK_USDC_DENOMS,
): Promise<WalletBalances> {
  // No withdrawable denom on this network: a known zero, not a failed read.
  const zero: TokenBalance = { denom: denoms.usdc ?? '', amountMicro: '0', amount: 0, ok: true };
  const [usdc, ...legacyParts] = await Promise.all([
    denoms.usdc ? queryBalance(queryClient, address, denoms.usdc) : Promise.resolve(zero),
    ...denoms.legacy.map((d) => queryBalance(queryClient, address, d)),
  ]);
  return {
    usdc: summarizeUsdc(
      BigInt(usdc.amountMicro),
      denoms.legacy.map((denom, i) => ({ denom, micro: BigInt(legacyParts[i].amountMicro) })),
    ),
    complete: !!queryClient && usdc.ok && legacyParts.every((p) => p.ok),
  };
}

/**
 * Read the user's USDC (the withdrawable denom + legacy ones) over one connection. Never throws; when any query fails the result is
 * `complete: false` and its numbers must not be shown as the balance.
 *
 * `denoms` overrides the set: the off-ramp's testnet test mode passes IXO
 * (`uixo`), which stands in for USDC there, as `usdc`.
 */
export async function getWalletBalances(
  address: string,
  denoms: UsdcDenomSet = NETWORK_USDC_DENOMS,
): Promise<WalletBalances> {
  const queryClient = address ? await connect() : null;
  return queryWalletBalances(queryClient, address, denoms);
}
