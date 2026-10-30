import { describe, expect, it } from 'vitest';

import { BRIDGE_OUTCOMES, describeBridgeOutcome, describePayoutStatus, describeTransferState } from './bridgeOutcome';

describe('describeBridgeOutcome', () => {
  it('maps the automatic-return states to the contract copy', () => {
    expect(describeBridgeOutcome('returning_to_ixo')?.detail).toBe(
      'We couldn’t finish this transfer, so we’re sending your USDC back to your wallet.',
    );
    expect(describeBridgeOutcome('returned_to_ixo')).toEqual({
      label: 'USDC back in your wallet',
      detail: 'Your USDC is back in your wallet.',
      tone: 'good',
    });
    expect(describeBridgeOutcome('return_needs_attention')).toEqual({
      label: 'Our team is on it',
      detail:
        'We couldn’t finish this automatically, so our team is bringing your USDC back to your wallet by hand. It’s safe, and you don’t need to do anything.',
      tone: 'warn',
    });
    // Released on our recovery wallet: the worker starts the return on its own.
    expect(describeBridgeOutcome('held_at_recovery')?.tone).toBe('pending');
  });

  it('raw Skip states and null are not outcomes', () => {
    expect(describeBridgeOutcome('STATE_COMPLETED_SUCCESS')).toBeNull();
    expect(describeBridgeOutcome(null)).toBeNull();
  });

  it('no outcome copy uses technical words', () => {
    for (const o of BRIDGE_OUTCOMES) {
      const d = describeBridgeOutcome(o)!;
      expect(`${d.label} ${d.detail}`).not.toMatch(/noble|injective|ibc|skip|cctp|chain|bridge|ixo/i);
    }
  });
});

describe('history wording (never raw Skip / YellowCard states)', () => {
  it('maps Skip states', () => {
    expect(describeTransferState('STATE_SUBMITTED', true)).toBe('On its way');
    expect(describeTransferState('STATE_PENDING', false)).toBe('On its way');
    expect(describeTransferState('STATE_RECEIVED', false)).toBe('On its way');
    expect(describeTransferState('STATE_COMPLETED_SUCCESS', false)).toBe('Delivered');
    expect(describeTransferState('STATE_ABANDONED', true)).toBe('On its way');
    expect(describeTransferState('STATE_ABANDONED', false)).toBe('Didn’t complete');
    expect(describeTransferState('STATE_COMPLETED_ERROR', true)).toBe('Didn’t complete');
    expect(describeTransferState('STATE_PENDING_ERROR', true)).toBe('Didn’t complete');
    expect(describeTransferState(undefined, true)).toBe('Checking…');
    expect(describeTransferState('unknown', true)).toBe('Checking…');
  });

  it('maps YellowCard statuses; unknown ones are never shown raw', () => {
    expect(describePayoutStatus('created')).toBe('Waiting for your transfer');
    expect(describePayoutStatus('deposit_submitted')).toBe('Transfer received, paying out');
    expect(describePayoutStatus('pending_approval')).toBe('Being checked');
    expect(describePayoutStatus('completed')).toBe('Paid out');
    expect(describePayoutStatus('failed')).toBe('Didn’t go through');
    expect(describePayoutStatus('expired')).toBe('Expired');
    expect(describePayoutStatus('refunded')).toBe('Refunded');
    expect(describePayoutStatus('SOME_NEW_STATE')).toBe('In progress');
  });
});
