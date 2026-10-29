import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';
import { IXO_INJECTIVE_USDC_DENOM, IXO_NOBLE_USDC_DENOM, IXO_PAY_DENOM, IXO_USDC_DENOM } from '@constants/yellowcard';

export interface TokenBalance {
  /** The denom queried. */
  denom: string;
  /** Balance in the base unit (6 decimals for both USDC and PAY). */
  amountMicro: string;
  /** Balance in whole tokens. */
  amount: number;
}

/** A USDC balance on ixo (one denom). */
export type UsdcBalance = TokenBalance;

export interface WalletBalances {
  /** Withdrawable money: the ONE USDC denom a withdrawal spends (see
   *  `pickWithdrawableUsdc`). Its `denom` is the Skip source denom. */
  usdc: TokenBalance;
  /** The other ixo USDC denom's balance (readable, counted in totals, not
   *  spent by this withdrawal). Zero when a denom override was given. */
  otherUsdc: TokenBalance;
  /** PAY (`upay`, 1 PAY = 1 USDC) — World Cleanup Day rewards land here. */
  pay: TokenBalance;
}

/**
 * Which ixo USDC a withdrawal spends: Injective USDC (canonical — what
 * pay-convert pays), except when the user holds ONLY Noble USDC and no PAY
 * (nothing would land in Injective USDC), then Noble. With PAY in the wallet
 * the answer stays Injective, so a convert-then-withdraw spends the denom the
 * conversion pays out in.
 */
export function pickWithdrawableUsdc(
  injective: TokenBalance,
  noble: TokenBalance,
  pay: TokenBalance,
): { usdc: TokenBalance; otherUsdc: TokenBalance } {
  const nobleOnly = BigInt(injective.amountMicro) === BigInt(0) && BigInt(noble.amountMicro) > BigInt(0);
  const payHeld = BigInt(pay.amountMicro) > BigInt(0);
  return nobleOnly && !payHeld ? { usdc: noble, otherUsdc: injective } : { usdc: injective, otherUsdc: noble };
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
 * Read the user's ixo USDC balance (canonical Injective USDC denom). Returns a
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
 *
 * Without `usdcDenom`: both mainnet USDC denoms (Injective + Noble) are read
 * and `pickWithdrawableUsdc` decides which one `usdc` is.
 *
 * `usdcDenom` reads exactly that denom as `usdc`: on a testnet build the
 * conversion oracle pays out IXO in place of USDC (there is no testnet USDC),
 * and the off-ramp's test mode reads that denom so the payout shows up; after
 * a conversion the screen waits on the payout denom itself.
 */
export async function getWalletBalances(address: string, usdcDenom?: string): Promise<WalletBalances> {
  const queryClient = address ? await connect() : null;
  if (usdcDenom) {
    const [usdc, pay] = await Promise.all([
      queryBalance(queryClient, address, usdcDenom),
      queryBalance(queryClient, address, IXO_PAY_DENOM),
    ]);
    return { usdc, otherUsdc: { denom: IXO_NOBLE_USDC_DENOM, amountMicro: '0', amount: 0 }, pay };
  }
  const [injective, noble, pay] = await Promise.all([
    queryBalance(queryClient, address, IXO_INJECTIVE_USDC_DENOM),
    queryBalance(queryClient, address, IXO_NOBLE_USDC_DENOM),
    queryBalance(queryClient, address, IXO_PAY_DENOM),
  ]);
  return { ...pickWithdrawableUsdc(injective, noble, pay), pay };
}
