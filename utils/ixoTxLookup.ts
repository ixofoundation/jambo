import { StargateClient } from '@cosmjs/stargate';

import { CHAIN_RPC_URL } from '@constants/common';
import { PRE_SIGN_TIMEOUT_MS, withTimeout } from '@utils/fetchTimeout';

/**
 * Whether the ixo chain knows a transaction: `{ found: true, code }` once it is in a
 * block (`code` 0 = success), `{ found: false }` while it is not, `null` when the
 * chain could not be asked (RPC down / slow) — unknown, never "not found".
 *
 * Uses the same RPC tx index the signing client relies on to confirm inclusion
 * (cosmjs `broadcastTx` polls `getTx`).
 */
export type IxoTxLookup = { found: true; code: number } | { found: false } | null;

export async function lookupIxoTx(txHash: string): Promise<IxoTxLookup> {
  let client: StargateClient | null = null;
  try {
    client = await withTimeout(StargateClient.connect(CHAIN_RPC_URL), PRE_SIGN_TIMEOUT_MS, 'rpc connect');
    const tx = await withTimeout(client.getTx(txHash), PRE_SIGN_TIMEOUT_MS, 'getTx');
    return tx ? { found: true, code: tx.code } : { found: false };
  } catch {
    return null;
  } finally {
    client?.disconnect();
  }
}
