import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';
import { IXO_PAY_DENOM, IXO_USDC_DENOM } from '@constants/yellowcard';

export interface TokenBalance {
  /** The denom queried. */
  denom: string;
  /** Balance in the base unit (6 decimals for both USDC and PAY). */
  amountMicro: string;
  /** Balance in whole tokens. */
  amount: number;
}

/** The USDC balance — the denom is the canonical mainnet USDC IBC denom. */
export type UsdcBalance = TokenBalance;

export interface WalletBalances {
  /** Withdrawable money: the canonical mainnet USDC IBC denom. */
  usdc: TokenBalance;
  /** PAY (`upay`, 1 PAY = 1 USDC) — World Cleanup Day rewards land here. */
  pay: TokenBalance;
}

type QueryClient = Awaited<ReturnType<typeof createQueryClient>>;

/** One bank balance query; a zero balance on any failure so callers never throw. */
async function queryBalance(queryClient: QueryClient | null, address: string, denom: string): Promise<TokenBalance> {
  const zero: TokenBalance = { denom, amountMicro: '0', amount: 0 };
  if (!queryClient || !address) return zero;
  try {
    const res = await queryClient.cosmos.bank.v1beta1.balance({ address, denom });
    const micro = res?.balance?.amount ?? '0';
    return { denom, amountMicro: micro, amount: Number(micro) / 1e6 };
  } catch {
    return zero;
  }
}

async function connect(): Promise<QueryClient | null> {
  try {
    return await createQueryClient(CHAIN_RPC_URL);
  } catch {
    return null;
  }
}

/**
 * Read the user's ixo USDC balance (canonical mainnet IBC denom). Returns a
 * zero balance on any query failure so the UI can render without throwing.
 */
export async function getUsdcBalance(address: string): Promise<UsdcBalance> {
  if (!address) return { denom: IXO_USDC_DENOM, amountMicro: '0', amount: 0 };
  return queryBalance(await connect(), address, IXO_USDC_DENOM);
}

/**
 * Read the user's USDC and PAY balances over one connection. Each side fails
 * to zero on its own, so a PAY query problem can never hide a USDC balance
 * (or the other way round) — the screens fall back to today's USDC-only view.
 */
export async function getWalletBalances(address: string): Promise<WalletBalances> {
  const queryClient = address ? await connect() : null;
  const [usdc, pay] = await Promise.all([
    queryBalance(queryClient, address, IXO_USDC_DENOM),
    queryBalance(queryClient, address, IXO_PAY_DENOM),
  ]);
  return { usdc, pay };
}
