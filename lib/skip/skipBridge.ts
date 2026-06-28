import { ibc } from '@ixo/impactxclient-sdk';

import { IXO_CHAIN_ID, IXO_USDC_DENOM, OFFRAMP_DESTINATION, SKIP_API_URL } from '@constants/yellowcard';

/**
 * Skip Go bridge — ixo USDC → Base USDC — WITHOUT Skip's `executeRoute`.
 *
 * ixo accounts are smart accounts: a tx is only valid when jambo's signing
 * client wraps it with the session authenticator (`signAndBroadcastWithSessionKey`,
 * surfaced as `useAuth().onSign`). Skip's `executeRoute` builds its own vanilla
 * client, so it can't broadcast for ixo. Instead we ask Skip for the messages
 * (`/v2/fungible/msgs_direct`), broadcast the ixo tx ourselves via `onSign`,
 * then tell Skip to relay (`/v2/tx/track`) and poll (`/v2/tx/status`).
 *
 * Everything here is plain `fetch` against the worker's `/skip` proxy — no
 * `@skip-go/client` dependency.
 */

const ROUTE = `${SKIP_API_URL}/v2/fungible/route`;
const MSGS_DIRECT = `${SKIP_API_URL}/v2/fungible/msgs_direct`;
const TRACK = `${SKIP_API_URL}/v2/tx/track`;
const STATUS = `${SKIP_API_URL}/v2/tx/status`;

/** A CosmJS-encodable message (typeUrl + decoded value). */
export interface TrxMsg {
  typeUrl: string;
  value: any;
}

export interface BridgeRoute {
  amountInMicro: string;
  amountOutMicro: string;
  usdAmountIn?: string;
  usdAmountOut?: string;
  estimatedDurationSeconds?: number;
  requiredChainAddresses: string[];
  /** Raw Skip route, for the msgs_direct call / debugging. */
  raw: unknown;
}

/** Quote-only: estimated output + USD + duration for display. Reads the Skip
 *  REST shape (snake_case) returned by the worker proxy. */
export async function getBridgeRoute(params: { amountInMicro: string; sourceDenom?: string }): Promise<BridgeRoute> {
  const res = await fetch(ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_in: params.amountInMicro,
      source_asset_chain_id: IXO_CHAIN_ID,
      source_asset_denom: params.sourceDenom ?? IXO_USDC_DENOM,
      dest_asset_chain_id: OFFRAMP_DESTINATION.skipChainId,
      dest_asset_denom: OFFRAMP_DESTINATION.skipDenom,
      smart_relay: true,
      // Allow routes that fail the USD price-safety check — on small amounts the
      // relay/CCTP fees make output < input by enough to trip it. The user
      // accepts the cost shown in the quote.
      allow_unsafe: true,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new Error(json?.message || json?.error || `Skip found no route for ixo USDC → Base USDC (try a different amount).`);
  }
  return {
    amountInMicro: params.amountInMicro,
    amountOutMicro: json.amount_out ?? json.estimated_amount_out ?? '0',
    usdAmountIn: json.usd_amount_in,
    usdAmountOut: json.usd_amount_out,
    estimatedDurationSeconds: json.estimated_route_duration_seconds,
    requiredChainAddresses: json.required_chain_addresses ?? [],
    raw: json,
  };
}

interface WireCosmosMsg {
  msg?: string;
  msg_type_url?: string;
  msgTypeUrl?: string;
}
interface WireCosmosTx {
  chain_id?: string;
  chainId?: string;
  signer_address?: string;
  msgs?: WireCosmosMsg[];
}

/** Convert one Skip cosmos message (proto3-JSON string) into a CosmJS
 *  EncodeObject the ixo signing client can encode. The ixo source tx is a
 *  single IBC `MsgTransfer` (with a CCTP-forward memo); other types fall
 *  through as parsed JSON. */
function toTrxMsg(m: WireCosmosMsg): TrxMsg {
  const typeUrl = m.msg_type_url ?? m.msgTypeUrl ?? '';
  const v = m.msg ? (JSON.parse(m.msg) as Record<string, any>) : {};
  if (typeUrl.endsWith('MsgTransfer')) {
    const th = (v.timeout_height ?? v.timeoutHeight) as Record<string, any> | undefined;
    const value = ibc.applications.transfer.v1.MsgTransfer.fromPartial({
      sourcePort: v.source_port ?? v.sourcePort ?? 'transfer',
      sourceChannel: v.source_channel ?? v.sourceChannel,
      token: v.token,
      sender: v.sender,
      receiver: v.receiver,
      timeoutHeight: th
        ? { revisionNumber: th.revision_number ?? th.revisionNumber ?? '0', revisionHeight: th.revision_height ?? th.revisionHeight ?? '0' }
        : undefined,
      timeoutTimestamp: v.timeout_timestamp ?? v.timeoutTimestamp ?? '0',
      memo: v.memo ?? '',
    });
    return { typeUrl, value };
  }
  return { typeUrl, value: v };
}

export interface BridgeTx {
  chainId: string;
  msgs: TrxMsg[];
}

/** Ask Skip for the exact messages to broadcast. `chainIdsToAddresses` must
 *  cover every chain in the path (ixo source, Base dest — CCTP routes through
 *  Noble without needing a Noble address). */
export async function buildBridgeTx(params: {
  amountInMicro: string;
  sourceDenom?: string;
  chainIdsToAddresses: Record<string, string>;
}): Promise<BridgeTx> {
  const res = await fetch(MSGS_DIRECT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_asset_denom: params.sourceDenom ?? IXO_USDC_DENOM,
      source_asset_chain_id: IXO_CHAIN_ID,
      dest_asset_denom: OFFRAMP_DESTINATION.skipDenom,
      dest_asset_chain_id: OFFRAMP_DESTINATION.skipChainId,
      amount_in: params.amountInMicro,
      chain_ids_to_addresses: params.chainIdsToAddresses,
      slippage_tolerance_percent: '1',
      smart_relay: true,
      allow_unsafe: true,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || json?.error || `Skip msgs_direct ${res.status}`);
  const txs: Array<{ cosmos_tx?: WireCosmosTx; cosmosTx?: WireCosmosTx }> = json?.txs ?? [];
  const cosmos = txs
    .map((t) => t.cosmos_tx ?? t.cosmosTx)
    .find((t): t is WireCosmosTx => !!t && (t.chain_id === IXO_CHAIN_ID || t.chainId === IXO_CHAIN_ID));
  if (!cosmos) throw new Error('Skip returned no ixo transaction to sign');
  const msgs = (cosmos.msgs ?? []).map(toTrxMsg);
  return { chainId: IXO_CHAIN_ID, msgs };
}

/** Register the broadcast tx with Skip so Smart Relay completes the route.
 *  Right after broadcast the tx often isn't indexed on Skip's RPC yet
 *  ("tx not found"), so retry with backoff before giving up. */
export async function trackTx(chainId: string, txHash: string, attempts = 8, delayMs = 4000): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(TRACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chain_id: chainId, tx_hash: txHash }),
    });
    if (res.ok) return;
    const json = await res.json().catch(() => null);
    const msg = String(json?.message ?? json?.error ?? `Skip track ${res.status}`);
    lastErr = new Error(msg);
    // Retry only the propagation case; fail fast on anything else.
    if (!/not found/i.test(msg)) throw lastErr;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw lastErr ?? new Error('Skip track failed');
}

export interface BridgeStatus {
  state: string;
  raw: unknown;
}

/** Poll Skip for the cross-chain transfer state. */
export async function getStatus(chainId: string, txHash: string): Promise<BridgeStatus> {
  const url = `${STATUS}?chain_id=${encodeURIComponent(chainId)}&tx_hash=${encodeURIComponent(txHash)}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Skip status ${res.status}`);
  return { state: String(json?.state ?? json?.status ?? 'unknown'), raw: json };
}
