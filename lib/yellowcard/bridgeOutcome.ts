/**
 * Bridge OUTCOME values the YellowCard worker stamps into `OfframpTransaction.skip_status`.
 * Any other value is a raw Skip state (e.g. STATE_COMPLETED_SUCCESS) and is not an outcome.
 */
export const BRIDGE_OUTCOMES = [
  'refund_pending_on_ixo',
  'refunded_on_ixo',
  'in_transit_late',
  'delivered_late_to_yc',
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
    detail: 'The bridge timed out, so your USDC is on its way back to your ixo wallet. Nothing was sent to YellowCard.',
    tone: 'pending',
  },
  refunded_on_ixo: {
    label: 'USDC returned to your wallet',
    detail: 'The bridge timed out, so your USDC was returned to your ixo wallet. Nothing was sent to YellowCard.',
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
};

/** Maps a worker-stamped `skip_status` to user-facing copy, or null when it is not a bridge outcome. */
export function describeBridgeOutcome(skipStatus: string | null): BridgeOutcomeDescription | null {
  if (skipStatus == null) return null;
  return (BRIDGE_OUTCOMES as readonly string[]).includes(skipStatus) ? DESCRIPTIONS[skipStatus as BridgeOutcome] : null;
}
