/**
 * Checks shared by every Skip-built transaction jambo signs (the USDC upgrade in
 * lib/skip/usdcUpgradeRoute and the off-ramp bridge in lib/skip/skipBridge):
 * WHERE the money can go. Pure — unit-tested in txChecks.test.ts.
 *
 * These mirror the YellowCard worker's own checks EXACTLY (yellowcard-worker
 * `src/lib/skip-memo.ts`, rules shared 30 Oct 2026): the worker refuses at
 * `POST /usdc-upgrade` (422 `not_an_upgrade`) and `POST /offramp/{id}/deposit`
 * (422 `deposit_mismatch`) whatever these let through, so jambo must never be
 * looser — a transfer the worker refuses is one it cannot follow or return.
 *
 * The memo of an IBC `MsgTransfer` decides every later hop (packet-forward
 * `forward.receiver`, the swap contract, the post-swap transfer's `receiver`
 * and `recover_address`, nested JSON memos). Every address-looking string in
 * it — bech32 of any prefix, `0x…` EVM addresses, 32-byte hex / base64 values
 * such as a CCTP mint recipient — must be one we can vouch for: the user's own
 * ixo address, the worker's recovery wallet (`GET /offramp/config`
 * `skip_chain_addresses`, every value) or a Skip entry contract pinned below.
 * Values under a `pool` key (a swap pool id / pool contract) are skipped: funds
 * are never released there — the entry contract enforces the swap minimum, or
 * the hop fails back to `recover_address`.
 */

/**
 * Skip's entry contracts named by the upgrade route's memo (`forward.receiver` =
 * `wasm.contract`), per chain. Observed on 30 Oct 2026 in live, read-only
 * `/v2/fungible/msgs` responses (osmosis-poolmanager: the default route; Terra:
 * terra-astroport, which Skip picks for some amounts) — the same values the
 * worker pins. If Skip moves its entry contracts every check fails CLOSED;
 * update this constant from a fresh probe, in all three repos.
 */
export const SKIP_ENTRY_CONTRACTS: Readonly<Record<string, string>> = {
  'osmosis-1': 'osmo10a3k4hvk37cc4hnxctw4p95fhscd2z6h2rmx0aukc6rm8u9qqx9smfsh7u',
  'phoenix-1': 'terra13jfx06k2zpajtxymdgq2r6mrezzx3ngrhzfe24gdh9mqs8x67lmspee8lp',
};

/** The newest `timeout_timestamp` we accept on a signed transfer: now + 2 h (Skip uses ~5 min). */
export const MAX_TIMEOUT_AHEAD_MS = 2 * 60 * 60 * 1000;

const BECH32_RE = /^[a-z][a-z0-9]{0,82}1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38,}$/;
const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX32_RE = /^(0x)?[0-9a-fA-F]{64}$/;
const BASE64_32_RE = /^[A-Za-z0-9+/]{43}=$/;

/** The off-ramp's first-hop receiver: an `inj1…` account (20-byte data). */
export const OFFRAMP_RECEIVER_RE = /^inj1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{38}$/;

/** Address-looking: bech32 of any prefix (lower-cased), 0x + 20 bytes, or a 32-byte hex /
 *  base64 value. Denoms (`ibc/…`, `uusdc`, `erc20:0x…`), channels, ports and venue names never match. */
export function isAddressLike(s: string): boolean {
  return BECH32_RE.test(s.toLowerCase()) || EVM_RE.test(s) || HEX32_RE.test(s) || BASE64_32_RE.test(s);
}

/** Comparable form: bech32 lower-cased, hex lower-cased. */
export const normAddress = (s: string) => s.toLowerCase();

const MAX_DEPTH = 32;

export interface MemoFacts {
  /** Every address-looking string (values under a `pool` key excluded), lower-cased. */
  addresses: string[];
  /** Values of `receiver` keys, lower-cased. */
  receivers: string[];
  /** Values of `recover_address` keys, lower-cased. */
  recoverAddresses: string[];
}

/**
 * Walk a memo: it must parse as a JSON OBJECT; then every value recursively. A string
 * that starts with `{` must itself parse as a JSON object and is walked the same way
 * (the nested `ibc_info.memo`). Throws on anything malformed or nested deeper than 32.
 */
export function walkMemo(memo: string): MemoFacts {
  const facts: MemoFacts = { addresses: [], receivers: [], recoverAddresses: [] };
  const parseObject = (raw: string): Record<string, unknown> => {
    const v: unknown = JSON.parse(raw);
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('memo is not a JSON object');
    return v as Record<string, unknown>;
  };
  const visit = (v: unknown, key: string | null, depth: number): void => {
    if (depth > MAX_DEPTH) throw new Error('memo nests too deep');
    if (typeof v === 'string') {
      if (key === 'pool') return;
      if (v.trim().startsWith('{')) {
        visit(parseObject(v), key, depth + 1);
        return;
      }
      if (isAddressLike(v)) facts.addresses.push(normAddress(v));
      if (key === 'receiver') facts.receivers.push(normAddress(v));
      if (key === 'recover_address') facts.recoverAddresses.push(normAddress(v));
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item, key, depth + 1);
      return;
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, item] of Object.entries(v as Record<string, unknown>)) visit(item, k, depth + 1);
    }
  };
  visit(parseObject(memo), null, 0);
  return facts;
}

/**
 * The upgrade memo's routing (the memo part of the worker's `checkUpgradeTransfer`):
 * every address is the user / our recovery wallet / a Skip entry contract, every
 * `recover_address` is our recovery wallet, and some `receiver` is the user (the
 * final hop). Returns the problem, or null.
 */
export function upgradeMemoProblem(
  memo: unknown,
  ctx: { user: string; chainAddresses: Readonly<Record<string, string>> },
): string | null {
  if (typeof memo !== 'string' || !memo) return 'no memo (the route needs one)';
  let facts: MemoFacts;
  try {
    facts = walkMemo(memo);
  } catch (err) {
    return `memo unreadable: ${err instanceof Error ? err.message : String(err)}`;
  }
  const ours = Object.values(ctx.chainAddresses ?? {}).map(normAddress);
  const allowed = new Set([normAddress(ctx.user), ...ours, ...Object.values(SKIP_ENTRY_CONTRACTS).map(normAddress)]);
  const stranger = facts.addresses.find((a) => !allowed.has(a));
  if (stranger) return `memo names an address outside the allow-list: ${stranger}`;
  const badRecover = facts.recoverAddresses.find((a) => !ours.includes(a));
  if (badRecover) return `recover_address ${badRecover} is not ours`;
  if (!facts.receivers.includes(normAddress(ctx.user))) return 'the route does not end at the user’s ixo address';
  return null;
}

/** Every value under `key` at any depth of a memo (nested JSON memos included); [] when unreadable. */
export function memoValuesByKey(memo: unknown, key: string): unknown[] {
  const out: unknown[] = [];
  const visit = (v: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (typeof v === 'string') {
      if (!v.trim().startsWith('{')) return;
      try {
        visit(JSON.parse(v), depth + 1);
      } catch {
        /* walkMemo reports it */
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
        if (k === key) out.push(x);
        visit(x, depth + 1);
      }
    }
  };
  visit(memo, 0);
  return out;
}

/**
 * A `MsgTransfer.timeout_timestamp` (ns since epoch, number or string) must lie in
 * (now, now + 2 h]. Returns the problem, or null when it is fine. (Skip sends it as a
 * JSON number above 2^53; Number precision is enough for this window.)
 */
export function timeoutProblem(raw: unknown, nowMs: number, maxAheadMs: number = MAX_TIMEOUT_AHEAD_MS): string | null {
  let ns: bigint;
  try {
    if (typeof raw === 'number' && Number.isFinite(raw)) ns = BigInt(Math.trunc(raw));
    else if (typeof raw === 'string' && /^\d+$/.test(raw)) ns = BigInt(raw);
    else return `timeout_timestamp is ${String(raw)}`;
  } catch {
    return `timeout_timestamp is ${String(raw)}`;
  }
  const nowNs = BigInt(Math.trunc(nowMs)) * BigInt(1_000_000);
  const maxNs = nowNs + BigInt(Math.trunc(maxAheadMs)) * BigInt(1_000_000);
  if (ns <= nowNs) return 'timeout_timestamp is in the past';
  if (ns > maxNs) return 'timeout_timestamp is more than 2 h ahead';
  return null;
}
