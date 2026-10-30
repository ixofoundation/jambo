import { SignBroadcastError } from 'lib/authHub/signAndBroadcast';
import { UnroutableChainError } from 'lib/skip/chainAddresses';
import { BridgeBuildError, BridgeQuoteError } from 'lib/skip/skipBridge';
import {
  type RampApiErrorDetails,
  RAMP_KYC_CREDENTIAL_FAILURE_CODES,
  RAMP_KYC_REQUIRED_CODE,
  RampApiError,
  rampApiErrorDetails,
} from 'lib/yellowcard/offrampClient';
import { RequestTimeoutError } from '@utils/fetchTimeout';

/**
 * The off-ramp create call's decision-rail refusals, mapped to what the
 * Withdraw screen shows. Every withdrawal is first judged by the IXO decision
 * engine; the worker answers the create call with one of these codes when it
 * isn't approved (yellowcard-worker `src/lib/decision-rail.ts`):
 *
 *   403 `decision_rejected`  — refused by the rules; `message` is the first
 *                              rule's sentence, `reasons[]` every rule.
 *   503 `decision_pending`   — no decision right now (engine slow/down);
 *                              `Retry-After: 10`. Retrying the SAME withdrawal
 *                              resumes the same decision.
 *   503 `decision_in_review` — with a compliance reviewer; `Retry-After: 300`.
 *                              Not a problem on the user's side.
 *
 * `kyc_required` / `name_mismatch` (and the other credential codes) keep their
 * own notices in components/Ramp/KycRequiredCard.
 *
 * None of these means money moved: the worker refuses before it asks
 * YellowCard for a sell, and the bridge from the user's wallet only starts
 * after a successful create.
 *
 * All user-facing strings for these states live here.
 */

export const OFFRAMP_DECISION_REJECTED_CODE = 'decision_rejected';
export const OFFRAMP_DECISION_PENDING_CODE = 'decision_pending';
export const OFFRAMP_DECISION_IN_REVIEW_CODE = 'decision_in_review';

/** `code` on a create 400 when the withdrawal named a legacy USDC denom. Jambo
 *  only ever sends the withdrawable USDC, so this should not happen; the screen
 *  still answers it with the upgrade step (hooks/useUsdcUpgrade). */
export const OFFRAMP_USDC_UPGRADE_REQUIRED_CODE = 'usdc_upgrade_required';
const USDC_UPGRADE_REQUIRED_MESSAGE =
  'Part of your USDC needs a quick upgrade before it can be withdrawn. Nothing was sent — your USDC is safe in your wallet.';

/** The route asked for an address we cannot vouch for (lib/skip/chainAddresses), or the
 *  transfer to sign failed its checks (lib/skip/skipBridge) — aborted before anything was
 *  signed. The technical reason goes to the console. */
const ROUTE_UNAVAILABLE_MESSAGE =
  'Withdrawals aren’t available for a moment. Nothing was sent — your USDC is safe in your wallet. Please try again later.';

/** Skip could not price the amount (before any sell or signature). */
const QUOTE_FAILED_MESSAGE =
  'We couldn’t get a price for this amount right now. Try a different amount, or try again in a few minutes. Nothing was sent — your USDC is safe in your wallet.';

const INSUFFICIENT_FUNDS_MESSAGE = 'Your wallet doesn’t have enough USDC for this amount right now. Nothing was sent.';
const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again — nothing was sent.';

/** The transfer was refused or failed in its block: nothing moved. */
export const OFFRAMP_NOT_THROUGH =
  'The withdrawal didn’t go through, so nothing was sent. Your USDC is safe in your wallet.';

/** The worker would not record the signed transfer (`deposit_mismatch`, …) — it may have moved. */
export const OFFRAMP_DEPOSIT_UNCONFIRMED =
  'We couldn’t confirm this transfer. Your USDC isn’t lost — please contact support and we’ll sort it out.';

/** `409 deposit_already_recorded` (yellowcard-worker fix round, 30 Oct 2026). */
export const OFFRAMP_DEPOSIT_RECORDED_ELSEWHERE =
  'We’ve already recorded a transfer for this withdrawal. Check “Your withdrawals” before trying again.';

/** Worker codes whose own `message` is shown (they are written for customers); every other
 *  worker sentence is replaced by our copy and logged. */
const TRUSTED_SERVER_MESSAGE_CODES: readonly string[] = [RAMP_KYC_REQUIRED_CODE, ...RAMP_KYC_CREDENTIAL_FAILURE_CODES];

/** What the worker sends as its wait today. The last fallback, used only when
 *  the body carries no `retryAfterSec` and the `Retry-After` header is absent
 *  or may not be exposed to the browser (CORS). */
export const DECISION_PENDING_RETRY_SEC = 10;
export const DECISION_IN_REVIEW_RETRY_SEC = 300;

const REJECTED_TITLE = 'We can’t send this withdrawal';
const REJECTED_FALLBACK = 'This withdrawal wasn’t approved.';
const REJECTED_NOTE = 'Nothing was sent from your wallet.';

const PENDING_TITLE = 'Please try again in a moment';
const PENDING_MESSAGE =
  'We couldn’t get this withdrawal approved just now. Nothing was sent from your wallet — try again in a moment with the same details.';

const REVIEW_TITLE = 'Your withdrawal is being reviewed';
const REVIEW_MESSAGE =
  'Our team is taking a closer look at this withdrawal — there’s nothing you need to fix. Nothing has been sent or charged.';
const REVIEW_FOLLOW_UP =
  'Come back later today and withdraw again with the same amount and details. Once it’s approved, it goes through then.';

/** Shown with a decision notice when the rewards conversion (step 1 of a
 *  two-step withdrawal) already paid out. */
export const OFFRAMP_CONVERTED_NOTE =
  'Your rewards were converted — the USDC is in your wallet, so no new conversion is needed.';

export const DECISION_RETRY_LABEL = 'Try again';
export const DECISION_CHECK_AGAIN_LABEL = 'Check again';

export function decisionRetryLabel(waitSec: number): string {
  return waitSec > 0 ? `${DECISION_RETRY_LABEL} in ${waitSec}s` : DECISION_RETRY_LABEL;
}

export function decisionCheckAgainLine(waitSec: number): string {
  return `You can check again in about ${Math.max(1, Math.ceil(waitSec / 60))} min.`;
}

const NETWORK_BEFORE_SEND =
  'We couldn’t reach the withdrawal service. Check your connection and try again — nothing was sent from your wallet.';
const NETWORK_AFTER_SEND =
  'We lost the connection while sending your withdrawal. Check “Your withdrawals” below before trying again.';
const WORKER_BEFORE_SEND =
  'We couldn’t start your withdrawal just now. Nothing was sent from your wallet — please try again.';
const WORKER_AFTER_SEND =
  'Something went wrong while finishing your withdrawal. Check “Your withdrawals” below before trying again.';

export type OfframpDecisionView =
  | {
      kind: 'rejected';
      title: string;
      /** The primary sentence, or null when `reasons` already lists it. */
      message: string | null;
      /** Each rule's sentence, de-duplicated — only when there is more than
       *  one (a single reason is the `message`). */
      reasons: string[];
      note: string;
      /** Public decision receipt id. Not shown today — the Withdraw screen has
       *  no support-reference slot. */
      receiptCid: string | null;
    }
  | { kind: 'pending'; title: string; message: string; retryAfterSec: number }
  | { kind: 'review'; title: string; message: string; followUp: string; retryAfterSec: number };

/** The screen state for a decision-rail refusal, or null for any other error
 *  (including `kyc_required` / `name_mismatch`, which have their own notices). */
export function offrampDecisionView(details: RampApiErrorDetails | null | undefined): OfframpDecisionView | null {
  if (!details) return null;
  switch (details.code) {
    case OFFRAMP_DECISION_REJECTED_CODE: {
      const reasons = Array.from(
        new Set((details.reasons ?? []).map((r) => r.reason.trim()).filter((r) => r.length > 0)),
      );
      const primary = details.serverMessage?.trim() || reasons[0] || REJECTED_FALLBACK;
      const listed = reasons.length > 1 ? reasons : [];
      return {
        kind: 'rejected',
        title: REJECTED_TITLE,
        message: listed.includes(primary) ? null : primary,
        reasons: listed,
        note: REJECTED_NOTE,
        receiptCid: details.receiptCid ?? null,
      };
    }
    case OFFRAMP_DECISION_PENDING_CODE:
      return {
        kind: 'pending',
        title: PENDING_TITLE,
        message: PENDING_MESSAGE,
        retryAfterSec: details.retryAfterSec ?? DECISION_PENDING_RETRY_SEC,
      };
    case OFFRAMP_DECISION_IN_REVIEW_CODE:
      return {
        kind: 'review',
        title: REVIEW_TITLE,
        message: REVIEW_MESSAGE,
        followUp: REVIEW_FOLLOW_UP,
        retryAfterSec: details.retryAfterSec ?? DECISION_IN_REVIEW_RETRY_SEC,
      };
    default:
      return null;
  }
}

/** `fetch` itself failed (offline, DNS, CORS, connection reset) — the browser
 *  throws a TypeError whose wording differs per engine — or one of our time limits hit. */
export function isNetworkFailure(err: unknown): boolean {
  return (
    err instanceof RequestTimeoutError ||
    (err instanceof TypeError &&
      /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(err.message))
  );
}

const SESSION_RE = /session (expired|key not found)|not authenticated|not signed in|signing mnemonic not available/i;
const INSUFFICIENT_RE = /insufficient funds/i;

/**
 * One customer-facing line for any withdrawal failure — never a raw Skip, chain,
 * wallet or worker string (those go to the console).
 *
 * `fundsMayHaveMoved`: the failure happened after the user was asked to sign the
 * transfer, so we must not say nothing was sent — unless the signer itself says
 * the transfer never went out (`SignBroadcastError` `not_sent` / `failed_on_chain`).
 *
 * Only worker sentences written for customers are shown as they are: the
 * decision rail's reasons and the identity-check codes (`TRUSTED_SERVER_MESSAGE_CODES`).
 */
export function offrampErrorMessage(err: unknown, opts: { fundsMayHaveMoved: boolean }): string {
  console.warn(
    '[offramp] withdrawal failed:',
    err instanceof BridgeBuildError || err instanceof BridgeQuoteError ? err.detail : err,
  );
  if (err instanceof SignBroadcastError) {
    if (err.stage === 'maybe_sent') return NETWORK_AFTER_SEND;
    if (SESSION_RE.test(err.message)) return SESSION_ENDED_MESSAGE;
    if (INSUFFICIENT_RE.test(err.message)) return INSUFFICIENT_FUNDS_MESSAGE;
    return err.stage === 'failed_on_chain' ? OFFRAMP_NOT_THROUGH : WORKER_BEFORE_SEND;
  }
  if (err instanceof UnroutableChainError || err instanceof BridgeBuildError) return ROUTE_UNAVAILABLE_MESSAGE;
  if (err instanceof BridgeQuoteError) return QUOTE_FAILED_MESSAGE;
  if (err instanceof RampApiError) {
    if (err.code === OFFRAMP_USDC_UPGRADE_REQUIRED_CODE) return USDC_UPGRADE_REQUIRED_MESSAGE;
    const view = offrampDecisionView(rampApiErrorDetails(err));
    if (view) return view.kind === 'rejected' ? view.message ?? view.reasons.join(' ') : view.message;
    if (err.serverMessage && err.code && TRUSTED_SERVER_MESSAGE_CODES.includes(err.code)) return err.serverMessage;
    if (err.status === 429) return 'Too many withdrawals at once — please try again in a minute. Nothing was sent.';
    return opts.fundsMayHaveMoved ? WORKER_AFTER_SEND : WORKER_BEFORE_SEND;
  }
  if (isNetworkFailure(err)) return opts.fundsMayHaveMoved ? NETWORK_AFTER_SEND : NETWORK_BEFORE_SEND;
  const message = err instanceof Error ? err.message : '';
  if (/was submitted but was not yet found/i.test(message)) return NETWORK_AFTER_SEND;
  if (SESSION_RE.test(message)) return SESSION_ENDED_MESSAGE;
  if (!opts.fundsMayHaveMoved && INSUFFICIENT_RE.test(message)) return INSUFFICIENT_FUNDS_MESSAGE;
  return opts.fundsMayHaveMoved ? WORKER_AFTER_SEND : WORKER_BEFORE_SEND;
}
