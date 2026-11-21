import { describe, expect, it } from 'vitest';

import type { SelfLinkErrorCode, SelfLinkState } from 'types/kyc';
import {
  SELF_POLL_INTERVAL_MS,
  SELF_POLL_SLOW_INTERVAL_MS,
  canRetrySelfCheck,
  SELF_ACTIVE_ELSEWHERE_COPY,
  SELF_COULD_NOT_CHECK_COPY,
  SELF_REVERIFY_COPY,
  SELF_NOT_IN_WALLET_COPY,
  SELF_STRANDED_COPY,
  isSelfCheckOver,
  isSelfLinkOpenable,
  selfCheckCopy,
  selfCheckPhase,
  selfCheckPollDelayMs,
  selfLinkErrorMessage,
  selfProgressView,
  selfStatusErrorAction,
  type SelfCheckPhase,
} from './checkView';

describe('selfCheckPhase', () => {
  it('maps every link status', () => {
    const expected: Record<SelfLinkState, SelfCheckPhase> = {
      sent: 'waiting',
      opened: 'waiting',
      in_progress: 'in_progress',
      passed: 'passed',
      failed: 'failed',
      expired: 'expired',
      cancelled: 'cancelled',
    };
    for (const [status, phase] of Object.entries(expected)) {
      expect(selfCheckPhase({ status: status as SelfLinkState })).toBe(phase);
    }
  });

  it('reads review and saving only beside in_progress', () => {
    expect(selfCheckPhase({ status: 'in_progress', review: true })).toBe('review');
    expect(selfCheckPhase({ status: 'in_progress', saving: true })).toBe('saving');
    expect(selfCheckPhase({ status: 'in_progress', review: true, saving: true })).toBe('saving');
    expect(selfCheckPhase({ status: 'passed', review: true })).toBe('passed');
    expect(selfCheckPhase({ status: 'sent', saving: true })).toBe('waiting');
  });
});

describe('polling', () => {
  it('stops on the final states and slows down under review', () => {
    expect(selfCheckPollDelayMs('waiting')).toBe(SELF_POLL_INTERVAL_MS);
    expect(selfCheckPollDelayMs('in_progress')).toBe(SELF_POLL_INTERVAL_MS);
    expect(selfCheckPollDelayMs('saving')).toBe(SELF_POLL_INTERVAL_MS);
    expect(selfCheckPollDelayMs('review')).toBe(SELF_POLL_SLOW_INTERVAL_MS);
    for (const phase of ['passed', 'failed', 'expired', 'cancelled'] as const) {
      expect(isSelfCheckOver(phase)).toBe(true);
      expect(selfCheckPollDelayMs(phase)).toBeNull();
    }
  });

  it('stays well under the 30 calls a minute the status route allows', () => {
    expect(60_000 / SELF_POLL_INTERVAL_MS).toBeLessThanOrEqual(15);
  });

  it('decides what a failed status call means', () => {
    expect(selfStatusErrorAction('not_found')).toBe('reset');
    expect(selfStatusErrorAction('unauthorized')).toBe('stop');
    expect(selfStatusErrorAction('not_configured')).toBe('stop');
    for (const code of ['unavailable', 'rate_limited', 'unknown', 'bad_request', 'daily_limit'] as const) {
      expect(selfStatusErrorAction(code)).toBe('retry');
    }
  });
});

describe('selfCheckCopy', () => {
  it('has copy for every phase', () => {
    const phases: SelfCheckPhase[] = [
      'waiting',
      'in_progress',
      'review',
      'saving',
      'passed',
      'failed',
      'expired',
      'cancelled',
    ];
    for (const phase of phases) {
      const copy = selfCheckCopy(phase);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.text.length).toBeGreaterThan(0);
    }
    expect(selfCheckCopy('waiting').text).toBe('Waiting for you to start the check in the other tab.');
    expect(selfCheckCopy('review').text).toContain('up to 48 hours');
    expect(selfCheckCopy('saving').text).toBe('Saving your credential.');
  });

  it('says how many tries are left after a failed check, when known', () => {
    expect(selfCheckCopy('failed').text).toBe('We couldn’t verify your identity this time.');
    expect(selfCheckCopy('failed', { startsLeft: 2 }).text).toContain('You have 2 tries left.');
    expect(selfCheckCopy('failed', { startsLeft: 1 }).text).toContain('You have 1 try left.');
    expect(selfCheckCopy('failed', { startsLeft: 0 }).text).toContain('no tries left');
    expect(selfCheckCopy('failed', { failure: 'too_many_attempts', startsLeft: 1 }).text).toContain(
      'too many attempts',
    );
  });

  it('offers another try unless none are left', () => {
    expect(canRetrySelfCheck(undefined)).toBe(true);
    expect(canRetrySelfCheck(1)).toBe(true);
    expect(canRetrySelfCheck(0)).toBe(false);
  });
});

describe('selfLinkErrorMessage', () => {
  const now = Date.parse('2026-11-18T10:00:00.000Z');

  it('has a message for every code', () => {
    const codes: SelfLinkErrorCode[] = [
      'not_configured',
      'daily_limit',
      'rate_limited',
      'offer_consent_invalid',
      'unauthorized',
      'unavailable',
      'clock_skew',
      'bad_request',
      'unknown',
    ];
    for (const code of codes) {
      expect(selfLinkErrorMessage({ code, message: '' }, now).length).toBeGreaterThan(0);
    }
  });

  it('points at the device clock only for a clock problem, and at signing in for an expired session', () => {
    expect(selfLinkErrorMessage({ code: 'clock_skew', message: 'x' }, now)).toBe(
      'Your device’s date and time look wrong. Set them to automatic, then try again.',
    );
    expect(selfLinkErrorMessage({ code: 'bad_request', message: 'x' }, now)).not.toContain('date and time');
    expect(selfLinkErrorMessage({ code: 'unauthorized', message: 'x' }, now)).toContain('sign in again');
  });

  it('uses the reset time for the daily limit, else the server’s sentence', () => {
    const withReset = selfLinkErrorMessage(
      { code: 'daily_limit', message: 'server says', resetsAt: '2026-11-18T15:00:00.000Z' },
      now,
    );
    expect(withReset).toContain('You can try again after');
    expect(withReset).not.toContain('server says');
    expect(selfLinkErrorMessage({ code: 'daily_limit', message: 'Try again in about 5 hours.' }, now)).toBe(
      'Try again in about 5 hours.',
    );
    // A reset time in the past, or one that is not a date, is not shown.
    expect(
      selfLinkErrorMessage({ code: 'daily_limit', message: 'server says', resetsAt: '2026-11-18T09:00:00.000Z' }, now),
    ).toBe('server says');
    expect(selfLinkErrorMessage({ code: 'daily_limit', message: 'server says', resetsAt: 'soon' }, now)).toBe(
      'server says',
    );
  });

  it('never repeats another code’s server text', () => {
    expect(selfLinkErrorMessage({ code: 'unknown', message: 'https://self.example/l/secret' }, now)).not.toContain(
      'secret',
    );
  });
});

describe('isSelfLinkOpenable', () => {
  const now = Date.parse('2026-11-18T10:00:00.000Z');

  it('is true only while the link has time left', () => {
    expect(isSelfLinkOpenable('2026-11-18T10:15:00.000Z', now)).toBe(true);
    expect(isSelfLinkOpenable('2026-11-18T10:00:10.000Z', now)).toBe(false);
    expect(isSelfLinkOpenable('2026-11-18T09:59:00.000Z', now)).toBe(false);
    expect(isSelfLinkOpenable(undefined, now)).toBe(false);
    expect(isSelfLinkOpenable('not a date', now)).toBe(false);
  });
});

describe('selfProgressView', () => {
  const base = { phase: 'waiting' as SelfCheckPhase | null, holdsLink: true, popupBlocked: false, limited: false };

  it('shows the plain phase while the page holds the link', () => {
    expect(selfProgressView(base)).toBe('phase');
    expect(selfProgressView({ ...base, phase: 'in_progress' })).toBe('phase');
  });

  it('is looking up until the first status answer', () => {
    expect(selfProgressView({ ...base, phase: null, holdsLink: false })).toBe('looking_up');
    expect(selfProgressView({ ...base, phase: null, popupBlocked: true })).toBe('looking_up');
  });

  it('says the link can’t be reopened when an unstarted check is found without its link', () => {
    expect(selfProgressView({ ...base, holdsLink: false })).toBe('stranded');
    // A blocked pop-up followed by a reload: there is no link left to open.
    expect(selfProgressView({ ...base, holdsLink: false, popupBlocked: true })).toBe('stranded');
  });

  it('never calls a check that is running, under review or being saved stranded', () => {
    for (const phase of ['in_progress', 'review', 'saving'] as const) {
      expect(selfProgressView({ ...base, phase, holdsLink: false })).toBe('phase');
    }
  });

  it('offers the held link when the browser blocked the new tab', () => {
    expect(selfProgressView({ ...base, popupBlocked: true })).toBe('popup_blocked');
    expect(selfProgressView({ ...base, phase: 'in_progress', popupBlocked: true })).toBe('popup_blocked');
  });

  it('shows the daily limit instead of "waiting for you to start"', () => {
    expect(selfProgressView({ ...base, limited: true })).toBe('limit');
    expect(selfProgressView({ ...base, limited: true, holdsLink: false })).toBe('limit');
    expect(selfProgressView({ ...base, limited: true, popupBlocked: true })).toBe('limit');
    // Once the check runs, a limit no longer applies to it.
    expect(selfProgressView({ ...base, phase: 'in_progress', limited: true })).toBe('phase');
  });

  it('words the limit with its reset time', () => {
    const now = Date.parse('2026-11-18T10:00:00.000Z');
    const text = selfLinkErrorMessage({ code: 'daily_limit', message: '', resetsAt: '2026-11-18T15:00:00.000Z' }, now);
    expect(text).toMatch(/^You’ve used your tries for now\. You can try again after /);
    expect(selfLinkErrorMessage({ code: 'daily_limit', message: '' }, now)).toContain('try again in a few hours');
  });
});

describe('copy of the new final states', () => {
  it('is neutral about where an active check was started', () => {
    expect(SELF_ACTIVE_ELSEWHERE_COPY.text).not.toMatch(/device/i);
    expect(SELF_ACTIVE_ELSEWHERE_COPY.text).toContain('where you started it');
  });

  it('tells the person what to do next', () => {
    expect(SELF_STRANDED_COPY.text).toContain('start a new check');
    expect(SELF_NOT_IN_WALLET_COPY.text).toContain('isn’t in your wallet yet');
  });

  it('does not send the person to their wallet when the wallet could not be asked', () => {
    expect(SELF_COULD_NOT_CHECK_COPY.text).not.toMatch(/wallet/i);
    expect(SELF_COULD_NOT_CHECK_COPY.text).toContain('try again');
  });

  it('does not state that the earlier verification cannot be used', () => {
    expect(SELF_REVERIFY_COPY.text).toMatch(/^If /);
    expect(SELF_REVERIFY_COPY.text).not.toMatch(/can’t be used/);
  });
});
