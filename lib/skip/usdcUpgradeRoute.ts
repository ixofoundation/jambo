import { fromBech32 } from '@cosmjs/encoding';

import { INJECTIVE_USDC_DENOM } from '@constants/usdc';
import { IXO_CHAIN_ID, SKIP_API_URL } from '@constants/yellowcard';
import { type TrxMsg, type WireCosmosMsg, type WireCosmosTx, toTrxMsg } from 'lib/skip/skipBridge';
import { memoValuesByKey, normAddress, timeoutProblem, upgradeMemoProblem } from 'lib/skip/txChecks';
import { RequestTimeoutError, fetchWithTimeout } from '@utils/fetchTimeout';

/**
 * The one-tap USDC upgrade's Skip Go leg: legacy (Noble) USDC on ixo → Injective
 * USDC on ixo, ONE ixo signature, ~2 minutes (ixo → noble-1 → a 1:1 swap on
 * osmosis-1 or phoenix-1 → injective-1 → ixo). The same route the pay-convert
 * treasury float took on 29 Oct 2026 (pay-convert-oracle scripts/stack/pod.ts,
 * phase `float-swap`), with the same guards:
 *
 *  - quote with `allow_multi_tx:false, smart_relay:true, go_fast:true,
 *    allow_unsafe:false`, re-quoted right before signing (Skip's messages carry
 *    short IBC timeouts);
 *  - refuse a quote that would return less than 99.5% (it is a 1:1 swap);
 *  - `address_list`: `ixo-5` → the user's own address; every other chain → the
 *    YellowCard worker's refund wallet from `GET /offramp/config`
 *    `skip_chain_addresses` (never derived from the user's key, which cannot
 *    control them anyway); a chain missing there → abort before signing;
 *  - exactly 1 tx, on `ixo-5`, with exactly 1 `MsgTransfer` on `transfer` /
 *    `channel-26` (ixo → noble-1) whose sender is the user, whose token is
 *    exactly the legacy USDC amount asked for, whose receiver is the worker's
 *    noble-1 address, and whose timeout lies within the next 2 h;
 *  - its memo (recursively, nested JSON memos included) routes only to the
 *    user, the worker's recovery wallet or a Skip entry contract, recovers only
 *    to the worker's recovery wallet and ends with a hop to the user's own ixo
 *    address (lib/skip/txChecks — the worker's own rules), and every swap's
 *    minimum output is the withdrawable USDC, at least 99.0% of what is sent.
 *
 * Every failure is a `UsdcUpgradeError` whose `message` is customer copy
 * (nothing was signed, the USDC is still in the wallet) and whose `detail` is
 * the technical reason, for the console only. Pure parts are unit-tested in
 * usdcUpgradeRoute.test.ts. Calls go through the worker's `/skip` proxy, each
 * with a time limit.
 */

const ROUTE = `${SKIP_API_URL}/v2/fungible/route`;
const MSGS = `${SKIP_API_URL}/v2/fungible/msgs`;

const MSG_TRANSFER = '/ibc.applications.transfer.v1.MsgTransfer';

/** The upgrade's destination: the withdrawable USDC. Mainnet only — Skip routes nothing else. */
export const UPGRADE_DEST_DENOM = INJECTIVE_USDC_DENOM;

/** A 1:1 swap: refuse a quote that keeps less than 995‰ (the float-swap guard). */
const MIN_OUT_PER_MILLE = BigInt(995);
/** Each swap's on-chain minimum (`min_asset`) may sit at most 1% below what is sent: Skip sets it
 *  at the 0.5% slippage below its own estimate (observed: Osmosis 995000 / Terra 994765 for 1 USDC). */
const MIN_ASSET_PER_MILLE = BigInt(990);
const SLIPPAGE_PERCENT = '0.5';

/** Bech32 prefix per hop Skip has named for this route (30 Oct 2026). A chain not
 *  listed here is still accepted when the worker gives an address for it. */
const HOP_PREFIX: Record<string, string> = {
  'noble-1': 'noble',
  'osmosis-1': 'osmo',
  'phoenix-1': 'terra',
  'injective-1': 'inj',
};

/** The legacy USDC leaves ixo on this channel (ixo → noble-1); verified in the live route (30 Oct 2026). */
export const UPGRADE_SOURCE_CHANNEL = 'channel-26';

/**
 * The withdrawable USDC as it appears on each swap chain — the only denom a
 * swap's `min_asset` may name. Observed in live Skip upgrade routes on 30 Oct
 * 2026 (osmosis-poolmanager pool 3497; terra-astroport): both are then sent on
 * to injective-1 and from there to the user's ixo address as the withdrawable USDC.
 */
export const UPGRADE_SWAP_OUT_DENOMS: readonly string[] = [
  'ibc/794C7D7F3B857713878A3A1927251FA6AC1EEE520424C1F6FAFE9BA26D476138', // osmosis-1
  'ibc/E8481AD838C31D4FC12A504B10F9B4E2F830F8818D2735C2FFC707579B5FA60B', // phoenix-1
];

/** Customer copy for any failure before signing. */
export const UPGRADE_START_FAILED =
  'We couldn’t start the upgrade just now. Your USDC is safe in your wallet — please try again in a few minutes.';

/** Customer copy when the upgrade cannot be offered safely (no recovery address, account mismatch). */
export const UPGRADE_NOT_AVAILABLE = 'Upgrading isn’t available right now. Your USDC is safe in your wallet.';

export type UsdcUpgradeErrorReason =
  | 'no_route'
  | 'unexpected_route'
  | 'quote_too_low'
  | 'missing_address'
  | 'unexpected_msgs'
  | 'not_available';

export class UsdcUpgradeError extends Error {
  readonly reason: UsdcUpgradeErrorReason;
  /** Technical reason — log it, never show it. */
  readonly detail: string;

  constructor(reason: UsdcUpgradeErrorReason, detail: string) {
    super(reason === 'missing_address' || reason === 'not_available' ? UPGRADE_NOT_AVAILABLE : UPGRADE_START_FAILED);
    Object.setPrototypeOf(this, UsdcUpgradeError.prototype);
    this.name = 'UsdcUpgradeError';
    this.reason = reason;
    this.detail = detail;
  }
}

export interface UpgradeRoute {
  sourceDenom: string;
  amountIn: string;
  amountOut: string;
  requiredChainAddresses: string[];
  operations: unknown[];
  estimatedDurationSeconds?: number;
}

const isBaseUnits = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v);

/** Validate Skip's `/v2/fungible/route` answer for upgrading `amountMicro` of `sourceDenom`. Pure. */
export function parseUpgradeRoute(json: any, expect: { sourceDenom: string; amountMicro: string }): UpgradeRoute {
  if (!json || typeof json !== 'object') throw new UsdcUpgradeError('no_route', 'empty route response');
  if (json.txs_required !== 1) {
    throw new UsdcUpgradeError('unexpected_route', `route needs ${json.txs_required} transactions, expected 1`);
  }
  if (
    json.source_asset_chain_id !== IXO_CHAIN_ID ||
    json.dest_asset_chain_id !== IXO_CHAIN_ID ||
    json.source_asset_denom !== expect.sourceDenom ||
    json.dest_asset_denom !== UPGRADE_DEST_DENOM
  ) {
    throw new UsdcUpgradeError(
      'unexpected_route',
      `route ${json.source_asset_chain_id}/${json.source_asset_denom} → ${json.dest_asset_chain_id}/${json.dest_asset_denom}`,
    );
  }
  if (!isBaseUnits(json.amount_in) || json.amount_in !== expect.amountMicro || !isBaseUnits(json.amount_out)) {
    throw new UsdcUpgradeError('unexpected_route', `route amounts ${json.amount_in} → ${json.amount_out}`);
  }
  if (BigInt(json.amount_out) * BigInt(1000) < BigInt(json.amount_in) * MIN_OUT_PER_MILLE) {
    throw new UsdcUpgradeError('quote_too_low', `route would return only ${json.amount_out} for ${json.amount_in}`);
  }
  const required = json.required_chain_addresses;
  if (!Array.isArray(required) || required.length === 0 || !required.every((c) => typeof c === 'string')) {
    throw new UsdcUpgradeError('unexpected_route', 'route lists no required chain addresses');
  }
  return {
    sourceDenom: json.source_asset_denom,
    amountIn: json.amount_in,
    amountOut: json.amount_out,
    requiredChainAddresses: required,
    operations: Array.isArray(json.operations) ? json.operations : [],
    estimatedDurationSeconds:
      typeof json.estimated_route_duration_seconds === 'number' ? json.estimated_route_duration_seconds : undefined,
  };
}

function bech32Prefix(address: string): string | null {
  try {
    return fromBech32(address).prefix;
  } catch {
    return null;
  }
}

/** Skip's `address_list`, one entry per `required_chain_addresses` entry. Pure. */
export function upgradeAddressList(
  requiredChainAddresses: readonly string[],
  userAddress: string,
  skipChainAddresses: Readonly<Record<string, string>>,
): string[] {
  if (!userAddress || bech32Prefix(userAddress) !== 'ixo') {
    throw new UsdcUpgradeError('missing_address', 'no valid ixo address for the user');
  }
  return requiredChainAddresses.map((chainId) => {
    if (chainId === IXO_CHAIN_ID) return userAddress;
    const addr = skipChainAddresses[chainId];
    if (!addr) throw new UsdcUpgradeError('missing_address', `no recovery address for ${chainId}`);
    const want = HOP_PREFIX[chainId];
    if (want && bech32Prefix(addr) !== want) {
      throw new UsdcUpgradeError('missing_address', `recovery address for ${chainId} is not a ${want}1… address`);
    }
    return addr;
  });
}

export interface UpgradeTxExpectation {
  userAddress: string;
  /** The legacy USDC denom and exact base-unit amount being upgraded. */
  denom: string;
  amountMicro: string;
  /** The worker's recovery wallet per chain (`GET /offramp/config` `skip_chain_addresses`). */
  skipChainAddresses: Readonly<Record<string, string>>;
  /** For the timeout window; defaults to now. */
  nowMs?: number;
}

/**
 * Where the upgrade's money can go, from the parsed `MsgTransfer` (pure): the
 * first hop is the worker's noble-1 address; the memo passes the worker's own
 * rules (`upgradeMemoProblem`); and — front-end only — every swap keeps at
 * least 99.0% as the withdrawable USDC. Returns the problem, or null.
 */
export function upgradeRoutingProblem(v: any, expect: UpgradeTxExpectation): string | null {
  const noble = expect.skipChainAddresses?.['noble-1'];
  if (!noble || typeof v?.receiver !== 'string' || normAddress(v.receiver) !== normAddress(noble)) {
    return `first-hop receiver ${v?.receiver} is not our noble-1 address`;
  }
  const memoProblem = upgradeMemoProblem(v?.memo, {
    user: expect.userAddress,
    chainAddresses: expect.skipChainAddresses,
  });
  if (memoProblem) return memoProblem;
  // Every swap: a minimum output in the withdrawable USDC, at least 99.0% of what is sent.
  const minAssets = memoValuesByKey(v.memo, 'min_asset');
  if (memoValuesByKey(v.memo, 'swap_and_action').length !== minAssets.length) return 'a swap has no minimum output';
  for (const minAsset of minAssets as any[]) {
    const min = minAsset?.native;
    if (!min || !UPGRADE_SWAP_OUT_DENOMS.includes(min.denom) || !isBaseUnits(min.amount)) {
      return `swap minimum ${JSON.stringify(minAsset)} is not the withdrawable USDC`;
    }
    if (BigInt(min.amount) * BigInt(1000) < BigInt(expect.amountMicro) * MIN_ASSET_PER_MILLE) {
      return `swap minimum ${min.amount} is below 99.0% of ${expect.amountMicro}`;
    }
  }
  return null;
}

/**
 * Validate Skip's `/v2/fungible/msgs` answer and return the ONE message to sign.
 * Pure. Exactly 1 tx, on ixo, 1 `MsgTransfer` on transfer/channel-26, from the
 * user, of exactly the legacy USDC amount, timing out within 2 h, routed only to
 * addresses we vouch for (`upgradeRoutingProblem`) — anything else aborts
 * before signing.
 */
export function validateUpgradeTxs(json: any, expect: UpgradeTxExpectation): TrxMsg {
  const txs: Array<{ cosmos_tx?: WireCosmosTx; cosmosTx?: WireCosmosTx }> = Array.isArray(json?.txs) ? json.txs : [];
  if (txs.length !== 1) throw new UsdcUpgradeError('unexpected_msgs', `skip returned ${txs.length} transactions`);
  const tx = txs[0]?.cosmos_tx ?? txs[0]?.cosmosTx;
  const chainId = tx?.chain_id ?? tx?.chainId;
  if (!tx || chainId !== IXO_CHAIN_ID) {
    throw new UsdcUpgradeError('unexpected_msgs', `the transaction is not an ixo one (${chainId ?? 'none'})`);
  }
  if (tx.signer_address && tx.signer_address !== expect.userAddress) {
    throw new UsdcUpgradeError('unexpected_msgs', `signer ${tx.signer_address} is not the user`);
  }
  const msgs: WireCosmosMsg[] = Array.isArray(tx.msgs) ? tx.msgs : [];
  if (msgs.length !== 1) throw new UsdcUpgradeError('unexpected_msgs', `the transaction has ${msgs.length} messages`);
  const m = msgs[0];
  const typeUrl = m.msg_type_url ?? m.msgTypeUrl;
  if (typeUrl !== MSG_TRANSFER) throw new UsdcUpgradeError('unexpected_msgs', `unexpected message ${typeUrl}`);
  let v: any;
  try {
    v = JSON.parse(m.msg ?? '');
  } catch {
    throw new UsdcUpgradeError('unexpected_msgs', 'unreadable MsgTransfer');
  }
  if (
    v?.sender !== expect.userAddress ||
    v?.token?.denom !== expect.denom ||
    !isBaseUnits(v?.token?.amount) ||
    BigInt(v.token.amount) !== BigInt(expect.amountMicro)
  ) {
    throw new UsdcUpgradeError(
      'unexpected_msgs',
      `the transfer is not ours: ${v?.sender} ${v?.token?.amount} ${v?.token?.denom}`,
    );
  }
  if (
    (v?.source_port ?? v?.sourcePort) !== 'transfer' ||
    (v?.source_channel ?? v?.sourceChannel) !== UPGRADE_SOURCE_CHANNEL
  ) {
    throw new UsdcUpgradeError(
      'unexpected_msgs',
      `the transfer leaves on ${v?.source_port}/${v?.source_channel}, expected transfer/${UPGRADE_SOURCE_CHANNEL}`,
    );
  }
  const timeout = timeoutProblem(v?.timeout_timestamp ?? v?.timeoutTimestamp, expect.nowMs ?? Date.now());
  if (timeout) throw new UsdcUpgradeError('unexpected_msgs', timeout);
  const routing = upgradeRoutingProblem(v, expect);
  if (routing) throw new UsdcUpgradeError('unexpected_msgs', routing);
  return toTrxMsg(m);
}

async function skipPost(url: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const why = err instanceof RequestTimeoutError ? 'timed out' : 'unreachable';
    throw new UsdcUpgradeError('no_route', `skip ${why}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new UsdcUpgradeError('no_route', `skip ${res.status}: ${json?.message ?? json?.error ?? 'no body'}`);
  }
  return json;
}

/** Price the upgrade of the WHOLE legacy balance (`amountMicro`). */
export async function quoteUpgradeRoute(sourceDenom: string, amountMicro: string): Promise<UpgradeRoute> {
  const json = await skipPost(ROUTE, {
    amount_in: amountMicro,
    source_asset_chain_id: IXO_CHAIN_ID,
    source_asset_denom: sourceDenom,
    dest_asset_chain_id: IXO_CHAIN_ID,
    dest_asset_denom: UPGRADE_DEST_DENOM,
    allow_unsafe: false,
    allow_multi_tx: false,
    smart_relay: true,
    go_fast: true,
  });
  return parseUpgradeRoute(json, { sourceDenom, amountMicro });
}

/** Ask Skip for the route's messages and return the one validated message to sign. */
export async function buildUpgradeMsg(
  route: UpgradeRoute,
  addressList: string[],
  userAddress: string,
  skipChainAddresses: Readonly<Record<string, string>>,
): Promise<TrxMsg> {
  const json = await skipPost(MSGS, {
    source_asset_denom: route.sourceDenom,
    source_asset_chain_id: IXO_CHAIN_ID,
    dest_asset_denom: UPGRADE_DEST_DENOM,
    dest_asset_chain_id: IXO_CHAIN_ID,
    amount_in: route.amountIn,
    amount_out: route.amountOut,
    address_list: addressList,
    operations: route.operations,
    slippage_tolerance_percent: SLIPPAGE_PERCENT,
  });
  return validateUpgradeTxs(json, {
    userAddress,
    denom: route.sourceDenom,
    amountMicro: route.amountIn,
    skipChainAddresses,
  });
}
