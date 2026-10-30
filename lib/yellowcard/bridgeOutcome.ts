/**
 * Bridge OUTCOME values the YellowCard worker stamps into `OfframpTransaction.skip_status`.
 * Any other value is a raw Skip state (e.g. STATE_COMPLETED_SUCCESS) and is not an outcome.
 */
export const BRIDGE_OUTCOMES = [
  'refund_pending_on_ixo',
  'refunded_on_ixo',
  'in_transit_late',
  'delivered_late_to_yc',
  'held_at_recovery',
  // The worker sends funds Skip released on our recovery wallet back to the user's
  // wallet automatically (yellowcard-worker src/schemas/offramp.ts `skip_status`).
  'returning_to_ixo',
  'returned_to_ixo',
  'return_needs_attention',
] as const;

export type BridgeOutcome = (typeof BRIDGE_OUTCOMES)[number];

export type BridgeOutcomeTone = 'good' | 'pending' | 'warn';

export interface BridgeOutcomeDescription {
  label: string;
  detail: string;
  tone: BridgeOutcomeTone;
}

const DESCRIPTIONS: Record<BridgeOutcome, BridgeOutcomeDescription> = {
  refund_pending_on_ixo: {
    label: 'Returning USDC to your wallet…',
    detail: 'The transfer timed out, so your USDC is on its way back to your wallet. Nothing was sent to YellowCard.',
    tone: 'pending',
  },
  refunded_on_ixo: {
    label: 'USDC returned to your wallet',
    detail: 'The transfer timed out, so your USDC was returned to your wallet. Nothing was sent to YellowCard.',
    tone: 'good',
  },
  in_transit_late: {
    label: 'Deposit still in transit',
    detail: 'Your USDC is still on its way to YellowCard, and the payment window has closed. It has not been lost.',
    tone: 'pending',
  },
  delivered_late_to_yc: {
    label: 'Deposit arrived late at YellowCard',
    detail:
      'Your USDC reached YellowCard after the payment window closed, so we are arranging the refund with YellowCard.',
    tone: 'warn',
  },
  // The worker now returns these automatically: `held_at_recovery` is the moment before it starts.
  held_at_recovery: {
    label: 'Returning USDC to your wallet…',
    detail: 'We couldn’t finish this transfer, so we’re sending your USDC back to your wallet.',
    tone: 'pending',
  },
  returning_to_ixo: {
    label: 'Returning USDC to your wallet…',
    detail: 'We couldn’t finish this transfer, so we’re sending your USDC back to your wallet.',
    tone: 'pending',
  },
  returned_to_ixo: {
    label: 'USDC back in your wallet',
    detail: 'Your USDC is back in your wallet.',
    tone: 'good',
  },
  // Also what the team's manual resolution ends in is `returned_to_ixo` (worker admin route).
  return_needs_attention: {
    label: 'Our team is on it',
    detail:
      'We couldn’t finish this automatically, so our team is bringing your USDC back to your wallet by hand. It’s safe, and you don’t need to do anything.',
    tone: 'warn',
  },
};

/** Maps a worker-stamped `skip_status` to user-facing copy, or null when it is not a bridge outcome. */
export function describeBridgeOutcome(skipStatus: string | null): BridgeOutcomeDescription | null {
  if (skipStatus == null) return null;
  return (BRIDGE_OUTCOMES as readonly string[]).includes(skipStatus) ? DESCRIPTIONS[skipStatus as BridgeOutcome] : null;
}

/**
 * The transfer's progress for the history "Transfer" row, from Skip's raw state
 * (`STATE_SUBMITTED`, `STATE_COMPLETED_SUCCESS`, …) — never shown raw.
 * `withinPollWindow`: Skip reports ABANDONED when its tracking stalls on a long
 * route; inside the poll window that still means on its way.
 */
export function describeTransferState(skipState: string | null | undefined, withinPollWindow: boolean): string {
  if (!skipState || skipState === 'unknown') return 'Checking…';
  if (/COMPLETED_SUCCESS/i.test(skipState)) return 'Delivered';
  if (/ABANDON/i.test(skipState)) return withinPollWindow ? 'On its way' : 'Didn’t complete';
  if (/ERROR|FAIL/i.test(skipState)) return 'Didn’t complete';
  return 'On its way';
}

const YC_STATUS_LABELS: Record<string, string> = {
  created: 'Waiting for your transfer',
  deposit_submitted: 'Transfer received, paying out',
  pending_approval: 'Being checked',
  completed: 'Paid out',
  failed: 'Didn’t go through',
  expired: 'Expired',
  refunded: 'Refunded',
};

/** YellowCard's payout status in plain words (unknown values: "In progress", never raw). */
export function describePayoutStatus(status: string): string {
  return YC_STATUS_LABELS[status] ?? 'In progress';
}

/** Shown when a payout failed and YellowCard gave no readable reason (never the raw code). */
export const PAYOUT_FAILED_FALLBACK =
  'This payout didn’t go through. Your USDC is not lost — contact support with your YellowCard payment ID.';
