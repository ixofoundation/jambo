import { MIN_UPGRADE_MICRO, USDC_UPGRADE_DEADLINE } from '@constants/usdc';
import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { UPGRADE_START_FAILED, UsdcUpgradeError } from 'lib/skip/usdcUpgradeRoute';
import { RampApiError, type UsdcUpgradeStatus } from 'lib/yellowcard/offrampClient';

/**
 * The one-tap USDC upgrade's pure parts (hooks/useUsdcUpgrade drives them):
 * whether an upgrade is on offer, the pending upgrade remembered across reloads,
 * the status mapping (worker first, Skip as the fallback), how `POST
 * /usdc-upgrade` refusals are treated, the poll cadence, the amount still on
 * its way (counted in the one USDC total), and every customer-facing string.
 * Unit-tested in upgradeState.test.ts.
 *
 * Copy rules: short, warm, no Noble / Injective / Skip / chain words, and always
 * say where the money is. The wording per state is shared with the portal
 * (review-customer-copy `wording_by_state`, 30 Oct 2026).
 */

// ---------------------------------------------------------------------------
// Offer
// ---------------------------------------------------------------------------

export interface LegacyHolding {
  denom: string;
  micro: bigint;
}

/**
 * The legacy USDC the user can upgrade right now — the WHOLE balance of the first
 * legacy denom that is both held and listed by the worker (`GET /offramp/config`
 * `legacy_usdc_denoms`) — or null. An empty worker list (testnet/devnet, or a
 * worker that predates the upgrade) means nothing is offered; so does dust below
 * `MIN_UPGRADE_MICRO`.
 */
export function upgradeOffer(
  legacy: readonly LegacyHolding[] | null,
  upgradeable: readonly string[],
): LegacyHolding | null {
  if (!legacy) return null;
  for (const row of legacy) {
    if (row.micro >= MIN_UPGRADE_MICRO && upgradeable.includes(row.denom)) return { denom: row.denom, micro: row.micro };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The pending upgrade, remembered locally so a reload resumes the progress view
// ---------------------------------------------------------------------------

export interface PendingUpgrade {
  v: 2;
  /** The ixo address that signed it — a record never carries over to another account. */
  address: string;
  /** sha256 of the signed tx bytes, upper-case hex — known (and saved) BEFORE broadcast. */
  txHash: string;
  /** Legacy USDC sent, base units. */
  amountMicro: string;
  /** ms since epoch, when the transfer was signed. */
  startedAt: number;
  /** `signed`: saved right before broadcast (it may or may not have gone out);
   *  `broadcast`: the node accepted it (or the inclusion wait timed out). */
  stage: 'signed' | 'broadcast';
  /** Whether `POST /usdc-upgrade` has succeeded. */
  registered: boolean;
  /** The legacy and withdrawable USDC right before signing (base units) — so the amount
   *  still on its way is never counted twice (`inFlightMicro`). */
  legacyAtStartMicro: string;
  upgradedAtStartMicro: string;
}

/** The subset of `Storage` used here (so tests can pass a Map-backed fake). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY_PREFIX = 'jambo.usdcUpgrade.pending.';

export function pendingUpgradeKey(address: string): string {
  return `${KEY_PREFIX}${address}`;
}

/** A stored record, or null when absent, malformed, or for another address. */
export function parsePendingUpgrade(raw: string | null, address: string): PendingUpgrade | null {
  if (!raw || !address) return null;
  let v: any;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const digits = (x: unknown): x is string => typeof x === 'string' && /^\d+$/.test(x);
  if (
    v?.v !== 2 ||
    v.address !== address ||
    typeof v.txHash !== 'string' ||
    !/^[0-9A-Fa-f]{64}$/.test(v.txHash) ||
    !digits(v.amountMicro) ||
    typeof v.startedAt !== 'number' ||
    !Number.isFinite(v.startedAt) ||
    (v.stage !== 'signed' && v.stage !== 'broadcast') ||
    !digits(v.legacyAtStartMicro) ||
    !digits(v.upgradedAtStartMicro)
  ) {
    return null;
  }
  return {
    v: 2,
    address: v.address,
    txHash: v.txHash.toUpperCase(),
    amountMicro: v.amountMicro,
    startedAt: v.startedAt,
    stage: v.stage,
    registered: v.registered === true,
    legacyAtStartMicro: v.legacyAtStartMicro,
    upgradedAtStartMicro: v.upgradedAtStartMicro,
  };
}

/** Storage can be missing or throw (private mode, blocked site data): every access is guarded. */
export function loadPendingUpgrade(store: KeyValueStore | null, address: string): PendingUpgrade | null {
  if (!store || !address) return null;
  try {
    const raw = store.getItem(pendingUpgradeKey(address));
    const record = parsePendingUpgrade(raw, address);
    if (raw && !record) store.removeItem(pendingUpgradeKey(address));
    return record;
  } catch {
    return null;
  }
}

export function savePendingUpgrade(store: KeyValueStore | null, record: PendingUpgrade): void {
  if (!store) return;
  try {
    store.setItem(pendingUpgradeKey(record.address), JSON.stringify(record));
  } catch {
    /* the in-memory record still drives this page */
  }
}

export function clearPendingUpgrade(store: KeyValueStore | null, address: string): void {
  if (!store || !address) return;
  try {
    store.removeItem(pendingUpgradeKey(address));
  } catch {
    /* nothing to clear */
  }
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/**
 * The status to show. The worker is authoritative (it also knows about automatic
 * returns); only when it cannot be reached (or does not know the tx yet) does
 * Skip's own status decide — and then only "completed" is concluded from it,
 * anything else stays in progress.
 */
export function resolveUpgradeStatus(input: {
  worker: UsdcUpgradeStatus | null;
  skipState: string | null;
}): UsdcUpgradeStatus {
  if (input.worker) return input.worker;
  if (input.skipState && /COMPLETED_SUCCESS/i.test(input.skipState)) return 'completed';
  return 'in_progress';
}

/** The record is done with: the USDC is in the wallet (upgraded or returned). */
export function isSettledStatus(status: UsdcUpgradeStatus): boolean {
  return status === 'completed' || status === 'returned';
}

/** After this long in progress the copy says "taking a little longer than usual" (and the
 *  withdraw step offers "Withdraw what's ready now"). */
export const UPGRADE_SLOW_AFTER_MS = 10 * 60 * 1000;

/** An upgrade with the team (`needs_attention`) stops blocking a NEW upgrade of fresh legacy
 *  USDC after this long (same as the portal); the worker and ops keep handling the old one. */
export const UPGRADE_ATTENTION_RELEASE_MS = 24 * 60 * 60 * 1000;

export function attentionReleased(p: { status: string; unconfirmed: boolean; startedAt: number; now: number }): boolean {
  return !p.unconfirmed && p.status === 'needs_attention' && p.now - p.startedAt >= UPGRADE_ATTENTION_RELEASE_MS;
}

/** Polling stops after this long in one visit (the record is kept; the next visit resumes). */
export const UPGRADE_POLL_BUDGET_MS = 30 * 60 * 1000;

/** `POST /usdc-upgrade` is retried (503 / 429 / network) for this long, then "couldn't confirm". */
export const UPGRADE_REGISTER_BUDGET_MS = 15 * 60 * 1000;

/** A signed tx the chain still does not know after this long never went out (the worker's own
 *  rule for its broadcasts: not found 10 min after broadcast = not sent). */
export const UPGRADE_NOT_FOUND_AFTER_MS = 10 * 60 * 1000;

/** Every 15 s for the first 3 minutes, then every 30 s until 10 minutes, then every minute. */
export function nextPollDelayMs(elapsedSinceStartMs: number): number {
  if (elapsedSinceStartMs < 3 * 60 * 1000) return 15_000;
  if (elapsedSinceStartMs < 10 * 60 * 1000) return 30_000;
  return 60_000;
}

/**
 * What a failed `POST /usdc-upgrade` means:
 *  - `retry`: 503 `tx_pending` / `verification_unavailable`, 429, any 5xx, a network
 *    failure or time-out — try again later (`retryAfterMs` when the worker said);
 *  - `tx_failed`: 422 `tx_failed` — the transfer failed on chain, nothing moved;
 *  - `refused`: any other 400 / 403 / 409 / 422 (`not_an_upgrade`, `not_your_transaction`,
 *    `unsupported_account`, `conflict`, `upgrade_not_available`, …) — permanent.
 */
export type RegisterFailure = { kind: 'retry'; retryAfterMs?: number } | { kind: 'tx_failed' } | { kind: 'refused' };

export function classifyRegisterError(err: unknown): RegisterFailure {
  if (!(err instanceof RampApiError)) return { kind: 'retry' };
  const retryAfterMs = err.retryAfterSec != null ? err.retryAfterSec * 1000 : undefined;
  if (err.status === 422 && err.code === 'tx_failed') return { kind: 'tx_failed' };
  if (err.status === 400 || err.status === 403 || err.status === 409 || err.status === 422) return { kind: 'refused' };
  return { kind: 'retry', retryAfterMs };
}

/**
 * How a sign-and-broadcast failure leaves the upgrade (lib/authHub/signAndBroadcast):
 * `not_sent` / `failed_on_chain` → nothing moved, the record is dropped;
 * `maybe_sent` → it may still land: keep tracking it.
 */
export function broadcastFailureStage(err: unknown): 'not_sent' | 'failed_on_chain' | 'maybe_sent' {
  if (err instanceof SignBroadcastError) return err.stage;
  // A cosmjs inclusion time-out that reached us without the wrapper: it was broadcast.
  const message = err instanceof Error ? err.message : '';
  return /was submitted but was not yet found/i.test(message) ? 'maybe_sent' : 'not_sent';
}

const ZERO = BigInt(0);
const clamp = (v: bigint, lo: bigint, hi: bigint) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The part of a running upgrade that is in neither balance right now — on its way —
 * so the one USDC total (withdrawable + legacy + this) never drops and never counts
 * the amount twice. Before broadcast the amount is still legacy (0 on the way); once it
 * left, the whole amount is on the way; as the upgraded USDC lands it stops counting.
 */
export function inFlightMicro(p: {
  amountMicro: bigint;
  legacyAtStartMicro: bigint;
  upgradedAtStartMicro: bigint;
  legacyNowMicro: bigint;
  upgradedNowMicro: bigint;
}): bigint {
  const amount = p.amountMicro > ZERO ? p.amountMicro : ZERO;
  // How much of the amount is still sitting in the wallet as legacy USDC.
  const stillLegacy = clamp(p.legacyNowMicro - (p.legacyAtStartMicro - amount), ZERO, amount);
  // How much has already landed as the withdrawable USDC.
  const landed = clamp(p.upgradedNowMicro - p.upgradedAtStartMicro, ZERO, amount);
  const rest = amount - stillLegacy - landed;
  return rest > ZERO ? rest : ZERO;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * What the UI is showing. `confirm` is the short explainer before the one signature.
 * `unconfirmed`: the transfer went out but the worker could not confirm it (it refused
 * it, or did not answer for 15 minutes) — the USDC is not lost, support can help.
 */
export type UpgradeView =
  | { kind: 'offer' }
  | { kind: 'confirm' }
  | { kind: 'preparing' }
  | { kind: 'in_progress'; slow: boolean }
  | { kind: 'returning' }
  | { kind: 'completed' }
  | { kind: 'returned'; returnedMicro: bigint | null }
  | { kind: 'needs_attention' }
  | { kind: 'unconfirmed' }
  | { kind: 'failed'; title: string; message: string; retry: boolean };

/** The signing overlay's label and the tx memo (wallets and explorers show it). */
export const UPGRADE_SIGN_LABEL = 'Upgrade your USDC';

export const UPGRADE_FAILED_TITLE = 'The upgrade didn’t start';
export const UPGRADE_NOT_THROUGH_TITLE = 'The upgrade didn’t go through';

const NETWORK_FEE_FAILED =
  'We couldn’t cover the small network fee for the upgrade right now. Your USDC is safe in your wallet — please try again later.';
const SESSION_ENDED = 'Please sign in again to upgrade your USDC. Your USDC is safe in your wallet.';
/** The transfer was included but failed (nothing moved), or never made it out. */
export const UPGRADE_NOT_THROUGH = 'Nothing was changed — your USDC is safe in your wallet. Please try again.';

/** Customer copy for a failure BEFORE anything was sent. Never a raw Skip / chain string. */
export function upgradeErrorMessage(err: unknown): string {
  if (err instanceof UsdcUpgradeError) return err.message;
  const message = err instanceof Error ? err.message : '';
  if (/session (expired|key not found)|not authenticated|not signed in|signing mnemonic not available/i.test(message)) {
    return SESSION_ENDED;
  }
  if (/insufficient (funds|fee)|out of gas|fee-?grant|fee allowance/i.test(message)) return NETWORK_FEE_FAILED;
  return UPGRADE_START_FAILED;
}

/** Whether "Try again" makes sense after this failure (not for "isn't available right now"). */
export function upgradeErrorRetryable(err: unknown): boolean {
  return !(err instanceof UsdcUpgradeError && (err.reason === 'missing_address' || err.reason === 'not_available'));
}

export type UpgradeVariant = 'notice' | 'gate';

export type UpgradeAction =
  | 'open' // show the explainer
  | 'start' // sign
  | 'retry' // show the explainer again
  | 'dismiss' // close the card
  | 'cancel' // leave the explainer
  | 'back' // gate: back to the form
  | 'ready_now' // gate: withdraw the USDC that is ready now
  | 'support'; // open the support chat

export interface UpgradeCopy {
  title: string | null;
  lines: string[];
  /** 0 = confirm, 1 = upgrading, 2 = ready; null = no step indicator. */
  step: 0 | 1 | 2 | null;
  /** Show the "you can leave this page" line. */
  canLeave: boolean;
  /** Buttons, in display order; the `primary` one is the filled button. */
  actions: Array<{ label: string; action: UpgradeAction; primary: boolean }>;
  tone: 'calm' | 'good' | 'warn';
}

export interface UpgradeCopyContext {
  /** Pre-formatted amount being upgraded ("50 USDC"). */
  amount: string;
  /** Pre-formatted returned amount ("49.96 USDC") — `returned` only; falls back to `amount`. */
  returned?: string;
  /** `returned` only: less came back than was sent (the return's network fee). */
  feeUsed?: boolean;
  /** `returned` only: legacy USDC is still in the wallet, so "Try again" can do something. */
  canRetry?: boolean;
  /** Gate only: some USDC can be withdrawn right now without the upgrade. */
  readyNow?: boolean;
}

export const UPGRADE_STEPS = ['Confirm', 'Upgrading', 'Ready'] as const;

/** Shown while the upgrade runs (`canLeave`). */
export const UPGRADE_LEAVE_LINE = 'You can leave this page — we’ll finish in the background.';

/** Gate, once the upgrade is done: the withdrawal carries on by itself. */
export const UPGRADE_CONTINUING = 'All set — continuing your withdrawal…';

const BACK = { label: 'Back', action: 'back', primary: false } as const;
const SUPPORT = { label: 'Contact support', action: 'support', primary: true } as const;
const READY_NOW = { label: 'Withdraw what’s ready now', action: 'ready_now', primary: false } as const;

/**
 * Every string and button the upgrade card shows, by state. In the withdraw step
 * (`gate`) there is always a way back to the form, and — once the upgrade is slow,
 * needs the team, came back or could not be confirmed — a way to withdraw the USDC
 * that is ready now.
 */
export function upgradeCopy(view: UpgradeView, variant: UpgradeVariant, ctx: UpgradeCopyContext): UpgradeCopy {
  const gate = variant === 'gate';
  const back = gate ? [BACK] : [];
  const readyNow = gate && ctx.readyNow ? [READY_NOW] : [];
  switch (view.kind) {
    case 'offer':
      return gate
        ? {
            title: 'One quick step before you withdraw',
            lines: [
              'Part of your USDC needs a quick upgrade before it can be withdrawn. It takes about 2 minutes, then your withdrawal carries on right where you left off.',
            ],
            step: null,
            canLeave: false,
            actions: [BACK, { label: 'Upgrade now', action: 'open', primary: true }],
            tone: 'calm',
          }
        : {
            title: null,
            lines: [
              `Part of your USDC needs a quick upgrade to keep working after ${USDC_UPGRADE_DEADLINE}. It takes about 2 minutes.`,
            ],
            step: null,
            canLeave: false,
            actions: [{ label: 'Upgrade now', action: 'open', primary: true }],
            tone: 'calm',
          };
    case 'confirm':
      return {
        title: 'Upgrade your USDC',
        lines: [
          `We’ll upgrade all ${ctx.amount} in one step. It takes about 2 minutes and you only need to confirm once.`,
          'The amount stays essentially the same, and your balance keeps showing it while it’s on its way back to your wallet.',
        ],
        step: 0,
        canLeave: false,
        actions: [
          { label: 'Not now', action: 'cancel', primary: false },
          { label: 'Start upgrade', action: 'start', primary: true },
        ],
        tone: 'calm',
      };
    case 'preparing':
      return {
        title: 'Getting your upgrade ready…',
        lines: ['Your USDC is safe in your wallet.'],
        step: 0,
        canLeave: false,
        actions: back,
        tone: 'calm',
      };
    case 'in_progress':
      return {
        title: 'Upgrading your USDC…',
        lines: view.slow
          ? ['This is taking a little longer than usual. Your USDC is safe and we’re keeping an eye on it.']
          : [`About 2 minutes. Your ${ctx.amount} is on its way back to your wallet, upgraded.`],
        step: 1,
        canLeave: true,
        actions: view.slow ? [...back, ...readyNow] : back,
        tone: 'calm',
      };
    case 'returning':
      return {
        title: 'Bringing your USDC back',
        lines: [
          'We couldn’t finish the upgrade, so we’re sending your USDC back to your wallet. You don’t need to do anything.',
        ],
        step: 1,
        canLeave: true,
        actions: back,
        tone: 'calm',
      };
    case 'completed':
      return gate
        ? { title: UPGRADE_CONTINUING, lines: [], step: 2, canLeave: false, actions: [], tone: 'good' }
        : {
            title: 'All set — your USDC is ready',
            lines: ['Your USDC is upgraded and in your wallet.'],
            step: 2,
            canLeave: false,
            actions: [{ label: 'Done', action: 'dismiss', primary: true }],
            tone: 'good',
          };
    case 'returned': {
      const lines = [`We couldn’t finish the upgrade, so ${ctx.returned ?? ctx.amount} is back in your wallet.`];
      if (ctx.feeUsed) lines.push('A small network fee was used to send it back.');
      return {
        title: 'Your USDC is back in your wallet',
        lines,
        step: null,
        canLeave: false,
        actions: [
          ...(gate ? [BACK, ...readyNow] : [{ label: 'Done', action: 'dismiss' as const, primary: !ctx.canRetry }]),
          ...(ctx.canRetry ? [{ label: 'Try again', action: 'retry' as const, primary: true }] : []),
        ],
        tone: 'warn',
      };
    }
    case 'needs_attention':
      return {
        title: 'Our team is on it',
        lines: [
          'We couldn’t finish this automatically, so our team is bringing your USDC back to your wallet by hand. It’s safe, and you don’t need to do anything.',
        ],
        step: null,
        canLeave: false,
        actions: gate ? [BACK, ...readyNow, SUPPORT] : [{ label: 'Close', action: 'dismiss', primary: false }, SUPPORT],
        tone: 'warn',
      };
    case 'unconfirmed':
      return {
        title: 'We couldn’t confirm your upgrade yet',
        lines: [
          'Your USDC isn’t lost. If it isn’t back in your wallet within a few minutes, contact support and we’ll sort it out.',
        ],
        step: null,
        canLeave: false,
        actions: gate ? [BACK, ...readyNow, SUPPORT] : [{ label: 'Close', action: 'dismiss', primary: false }, SUPPORT],
        tone: 'warn',
      };
    case 'failed':
      return {
        title: view.title,
        lines: [view.message],
        step: null,
        canLeave: false,
        actions: [
          ...(gate ? [BACK] : view.retry ? [] : [{ label: 'Close', action: 'dismiss' as const, primary: false }]),
          ...(view.retry ? [{ label: 'Try again', action: 'retry' as const, primary: true }] : []),
        ],
        tone: 'warn',
      };
  }
}
