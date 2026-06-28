import { createQueryClient } from '@ixo/impactxclient-sdk';

import { CHAIN_RPC_URL } from '@constants/common';
import { IXO_USDC_DENOM } from '@constants/yellowcard';

export interface UsdcBalance {
  /** The denom actually held (the canonical mainnet USDC IBC denom). */
  denom: string;
  /** Balance in micro-USDC (6 decimals). */
  amountMicro: string;
  /** Balance in whole USDC. */
  amount: number;
}

/**
 * Read the user's ixo USDC balance (canonical mainnet IBC denom). Returns a
 * zero balance on any query failure so the UI can render without throwing.
 */
export async function getUsdcBalance(address: string): Promise<UsdcBalance> {
  const zero: UsdcBalance = { denom: IXO_USDC_DENOM, amountMicro: '0', amount: 0 };
  if (!address) return zero;
  try {
    const queryClient = await createQueryClient(CHAIN_RPC_URL);
    const res = await queryClient.cosmos.bank.v1beta1.balance({ address, denom: IXO_USDC_DENOM });
    const micro = res?.balance?.amount ?? '0';
    return { denom: IXO_USDC_DENOM, amountMicro: micro, amount: Number(micro) / 1e6 };
  } catch {
    return zero;
  }
}
