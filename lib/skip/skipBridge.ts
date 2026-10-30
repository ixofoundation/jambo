import { ibc } from '@ixo/impactxclient-sdk';

import { INJECTIVE_USDC_DENOM } from '@constants/usdc';
import { IXO_CHAIN_ID, OFFRAMP_DESTINATION, SKIP_API_URL } from '@constants/yellowcard';
import { OFFRAMP_RECEIVER_RE, timeoutProblem } from 'lib/skip/txChecks';
import { fetchWithTimeout } from '@utils/fetchTimeout';

/**
 * Skip Go bridge — ixo USDC → Base USDC — WITHOUT Skip's `executeRoute`.
 *
 * The source is always Injective USDC on ixo (constants/usdc — legacy Noble USDC
 * is upgraded first, never withdrawn): ixo → injective-1 → CCTP V2 (from
 * Injective's EVM side, chain `1776`) → Base. The user signs ONE ixo transaction.
 *
 * ixo accounts are smart accounts: a tx is only valid when jambo's signing
 * client wraps it with the session authenticator (`signAndBroadcastWithSessionKey`,
 * surfaced as `useAuth().onSign`). Skip's `executeRoute` builds its own vanilla
 * client, so it can't broadcast for ixo. Instead we ask Skip for the messages
 * (`/v2/fungible/msgs_direct`), broadcast the ixo tx ourselves via `onSign`,
 * then tell Skip to relay (`/v2/tx/track`) and poll (`/v2/tx/status`).
 *
 * Everything here is plain `fetch` against the worker's `/skip` proxy — no
 * `@skip-go/client` dependency — each with a time limit (utils/fetchTimeout).
 *
 * What is signed is checked first (`validateBridgeTxs`, the worker's own rules —
 * yellowcard-worker `checkOfframpTransfer`): exactly 1 ixo tx with exactly 1
 * `MsgTransfer` on transfer/channel-31 (ixo → injective-1), from the user, of
 * exactly the amount asked, in the withdrawable USDC, timing out within 2 h,
 * with NO memo and an `inj1…` receiver. That receiver is Skip's forwarding
 * account, derived from the `1776` (our refund wallet) and `8453` (the
 * YellowCard deposit) addresses — not computable here; the worker checks it
 * against Skip when the deposit is recorded (422 `deposit_mismatch`). Front end
 * only: what is signed must deliver no less than the quote that sized the sell.
 */

const ROUTE = `${SKIP_API_URL}/v2/fungible/route`;
const MSGS_DIRECT = `${SKIP_API_URL}/v2/fungible/msgs_direct`;
const TRACK = `${SKIP_API_URL}/v2/tx/track`;
const STATUS = `${SKIP_API_URL}/v2/tx/status`;

const MSG_TRANSFER = '/ibc.applications.transfer.v1.MsgTransfer';

/** The withdrawable USDC leaves ixo on this channel (ixo → injective-1); verified in the live
 *  msgs_direct answer (30 Oct 2026) and in the denom's own trace (constants/usdc). */
export const OFFRAMP_SOURCE_CHANNEL = 'channel-31';

/** The signed route may deliver at most 0.5% less than the quote the sell was sized on. */
const MIN_OUT_VS_QUOTE_PER_MILLE = BigInt(995);

/** Skip could not price the amount (before anything is created or signed). `detail` is for the console. */
export class BridgeQuoteError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('Skip could not price this withdrawal');
    Object.setPrototypeOf(this, BridgeQuoteError.prototype);
    this.name = 'BridgeQuoteError';
    this.detail = detail;
  }
}

/** The transaction to sign could not be built or failed its checks — nothing was signed. */
export class BridgeBuildError extends Error {
  readonly detail: string;

  constructor(detail: string) {
    super('The withdrawal transfer could not be prepared safely');
    Object.setPrototypeOf(this, BridgeBuildError.prototype);
    this.name = 'BridgeBuildError';
    this.detail = detail;
  }
}

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
export async function getBridgeRoute(params: { amountInMicro: string }): Promise<BridgeRoute> {
  let res: Response;
  try {
    res = await fetchWithTimeout(ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount_in: params.amountInMicro,
        source_asset_chain_id: IXO_CHAIN_ID,
        source_asset_denom: INJECTIVE_USDC_DENOM,
        dest_asset_chain_id: OFFRAMP_DESTINATION.skipChainId,
        dest_asset_denom: OFFRAMP_DESTINATION.skipDenom,
        smart_relay: true,
        // One ixo signature is all jambo can give (same flag as msgs_direct below).
        allow_multi_tx: false,
        // Allow routes that fail the USD price-safety check — on small amounts the
        // relay/CCTP fees make output < input by enough to trip it. The user
        // accepts the cost shown in the quote.
        allow_unsafe: true,
      }),
    });
  } catch (err) {
    throw new BridgeQuoteError(`route request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json) {
    throw new BridgeQuoteError(`route ${res.status}: ${json?.message ?? json?.error ?? 'no body'}`);
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

export interface WireCosmosMsg {
  msg?: string;
  msg_type_url?: string;
  msgTypeUrl?: string;
}
export interface WireCosmosTx {
  chain_id?: string;
  chainId?: string;
  signer_address?: string;
  msgs?: WireCosmosMsg[];
}

/** Convert one Skip cosmos message (proto3-JSON string) into a CosmJS
 *  EncodeObject the ixo signing client can encode. The ixo source tx is a
 *  single IBC `MsgTransfer` (with a forwarding memo); other types fall
 *  through as parsed JSON. Also used by the USDC upgrade (lib/skip/usdcUpgradeRoute). */
export function toTrxMsg(m: WireCosmosMsg): TrxMsg {
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

export interface BridgeTxExpectation {
  userAddress: string;
  amountInMicro: string;
  /** The quoted arrival (base units) the YellowCard sell was created for. */
  quotedAmountOutMicro: string;
  /** The ONE inj1 account the transfer may name (the worker's `bridge_receiver`). */
  expectedReceiver: string;
  /** For the timeout window; defaults to now. */
  nowMs?: number;
}

const isBaseUnits = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v);

/**
 * Validate Skip's `/v2/fungible/msgs_direct` answer and return the ONE message to
 * sign. Pure — unit-tested in skipBridge.test.ts. Throws `BridgeBuildError`
 * (nothing signed) on anything unexpected.
 */
export function validateBridgeTxs(json: any, expect: BridgeTxExpectation): TrxMsg {
  const txs: Array<{ cosmos_tx?: WireCosmosTx; cosmosTx?: WireCosmosTx }> = Array.isArray(json?.txs) ? json.txs : [];
  // The route needs exactly one ixo signature. A route that also wants a signature
  // elsewhere can't be completed from jambo — abort before signing anything.
  if (txs.length !== 1) throw new BridgeBuildError(`skip returned ${txs.length} transactions, expected 1`);
  const tx = txs[0]?.cosmos_tx ?? txs[0]?.cosmosTx;
  const chainId = tx?.chain_id ?? tx?.chainId;
  if (!tx || chainId !== IXO_CHAIN_ID) throw new BridgeBuildError(`the transaction is not an ixo one (${chainId ?? 'none'})`);
  if (tx.signer_address && tx.signer_address !== expect.userAddress) {
    throw new BridgeBuildError(`signer ${tx.signer_address} is not the user`);
  }
  const msgs: WireCosmosMsg[] = Array.isArray(tx.msgs) ? tx.msgs : [];
  if (msgs.length !== 1) throw new BridgeBuildError(`the transaction has ${msgs.length} messages`);
  const m = msgs[0];
  const typeUrl = m.msg_type_url ?? m.msgTypeUrl;
  if (typeUrl !== MSG_TRANSFER) throw new BridgeBuildError(`unexpected message ${typeUrl}`);
  let v: any;
  try {
    v = JSON.parse(m.msg ?? '');
  } catch {
    throw new BridgeBuildError('unreadable MsgTransfer');
  }
  if (
    v?.sender !== expect.userAddress ||
    v?.token?.denom !== INJECTIVE_USDC_DENOM ||
    !isBaseUnits(v?.token?.amount) ||
    BigInt(v.token.amount) !== BigInt(expect.amountInMicro)
  ) {
    throw new BridgeBuildError(`the transfer is not ours: ${v?.sender} ${v?.token?.amount} ${v?.token?.denom}`);
  }
  if ((v?.source_port ?? v?.sourcePort) !== 'transfer' || (v?.source_channel ?? v?.sourceChannel) !== OFFRAMP_SOURCE_CHANNEL) {
    throw new BridgeBuildError(`the transfer leaves on ${v?.source_port}/${v?.source_channel}`);
  }
  const timeout = timeoutProblem(v?.timeout_timestamp ?? v?.timeoutTimestamp, expect.nowMs ?? Date.now());
  if (timeout) throw new BridgeBuildError(timeout);
  if (v?.memo != null && (typeof v.memo !== 'string' || v.memo.trim() !== '')) {
    throw new BridgeBuildError('the memo is not empty');
  }
  if (typeof v?.receiver !== 'string' || !OFFRAMP_RECEIVER_RE.test(v.receiver)) {
    throw new BridgeBuildError(`receiver ${v?.receiver} is not an inj1 account`);
  }
  if (!OFFRAMP_RECEIVER_RE.test(expect.expectedReceiver) || v.receiver !== expect.expectedReceiver) {
    throw new BridgeBuildError(`receiver ${v.receiver} is not this withdrawal's (${expect.expectedReceiver})`);
  }
  // msgs_direct re-routes: what is signed must still deliver what the sell was sized on.
  const out = json?.route?.amount_out;
  if (!isBaseUnits(out) || !isBaseUnits(expect.quotedAmountOutMicro)) {
    throw new BridgeBuildError(`route amount_out ${String(out)} / quote ${expect.quotedAmountOutMicro}`);
  }
  if (BigInt(out) * BigInt(1000) < BigInt(expect.quotedAmountOutMicro) * MIN_OUT_VS_QUOTE_PER_MILLE) {
    throw new BridgeBuildError(`route delivers ${out}, quote was ${expect.quotedAmountOutMicro}`);
  }
  return toTrxMsg(m);
}

/** Ask Skip for the exact messages to broadcast. `chainIdsToAddresses` must
 *  cover every chain the route's `requiredChainAddresses` lists: ixo + `1776` +
 *  Base (the `1776` address is the YellowCard worker's refund wallet — see
 *  hooks/useOfframp). The one ixo transaction is checked (`validateBridgeTxs`)
 *  before it is returned; it is the only one the user signs. */
export async function buildBridgeTx(params: {
  amountInMicro: string;
  quotedAmountOutMicro: string;
  userAddress: string;
  chainIdsToAddresses: Record<string, string>;
  expectedReceiver: string;
}): Promise<BridgeTx> {
  let res: Response;
  try {
    res = await fetchWithTimeout(MSGS_DIRECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_asset_denom: INJECTIVE_USDC_DENOM,
        source_asset_chain_id: IXO_CHAIN_ID,
        dest_asset_denom: OFFRAMP_DESTINATION.skipDenom,
        dest_asset_chain_id: OFFRAMP_DESTINATION.skipChainId,
        amount_in: params.amountInMicro,
        chain_ids_to_addresses: params.chainIdsToAddresses,
        slippage_tolerance_percent: '1',
        smart_relay: true,
        allow_multi_tx: false,
        allow_unsafe: true,
      }),
    });
  } catch (err) {
    throw new BridgeBuildError(`msgs_direct request failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new BridgeBuildError(`msgs_direct ${res.status}: ${json?.message ?? json?.error ?? 'no body'}`);
  const msg = validateBridgeTxs(json, {
    userAddress: params.userAddress,
    amountInMicro: params.amountInMicro,
    quotedAmountOutMicro: params.quotedAmountOutMicro,
    expectedReceiver: params.expectedReceiver,
  });
  return { chainId: IXO_CHAIN_ID, msgs: [msg] };
}

/** Register the broadcast tx with Skip so Smart Relay completes the route.
 *  Right after broadcast the tx often isn't indexed on Skip's RPC yet
 *  ("tx not found"), so retry with backoff before giving up (no wait after the
 *  last attempt). */
export async function trackTx(chainId: string, txHash: string, attempts = 8, delayMs = 4000): Promise<void> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetchWithTimeout(TRACK, {
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
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
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
  const res = await fetchWithTimeout(url);
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Skip status ${res.status}`);
  return { state: String(json?.state ?? json?.status ?? 'unknown'), raw: json };
}
