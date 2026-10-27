import { type RampApiErrorDetails, RampApiError, rampApiErrorDetails } from 'lib/yellowcard/offrampClient';

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
 *  throws a TypeError whose wording differs per engine. */
export function isNetworkFailure(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(err.message)
  );
}

/**
 * One customer-facing line for any withdrawal failure — never a raw
 * "Failed to fetch" or a "Worker … returned 502" fallback.
 *
 * `fundsMayHaveMoved`: the failure happened at or after the bridge step (the
 * user was asked to sign the transfer), so we must not say nothing was sent.
 *
 * A worker sentence (`message`) is shown as-is; errors that aren't from the
 * worker or the network (signing, bridge routing) keep their own message.
 */
export function offrampErrorMessage(err: unknown, opts: { fundsMayHaveMoved: boolean }): string {
  if (err instanceof RampApiError) {
    const view = offrampDecisionView(rampApiErrorDetails(err));
    if (view) return view.kind === 'rejected' ? view.message ?? view.reasons.join(' ') : view.message;
    if (err.serverMessage) return err.serverMessage;
    return opts.fundsMayHaveMoved ? WORKER_AFTER_SEND : WORKER_BEFORE_SEND;
  }
  if (isNetworkFailure(err)) return opts.fundsMayHaveMoved ? NETWORK_AFTER_SEND : NETWORK_BEFORE_SEND;
  if (err instanceof Error && err.message) return err.message;
  return 'Withdrawal failed';
}
