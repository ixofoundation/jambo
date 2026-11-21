import type { SelfLinkCreateResult, SelfLinkErrorCode, SelfLinkStatus, SelfLinkStatusResult } from 'types/kyc';

/**
 * What the identity-check screen (screens/selfKyc.tsx) shows for each answer
 * of Jambo's Self routes. Pure, so the mapping and the copy can be tested.
 */

/** Where an open check stands, as the person sees it. */
export type SelfCheckPhase =
  /** Link made; the person has not started in the other tab yet. */
  | 'waiting'
  | 'in_progress'
  /** A person is reviewing the check (up to 48 hours). */
  | 'review'
  /** Approved; the credential is being saved. */
  | 'saving'
  | 'passed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export function selfCheckPhase(link: Pick<SelfLinkStatus, 'status' | 'review' | 'saving'>): SelfCheckPhase {
  switch (link.status) {
    case 'sent':
    case 'opened':
      return 'waiting';
    case 'in_progress':
      // Saving comes after a review, so it wins if both are ever set.
      return link.saving ? 'saving' : link.review ? 'review' : 'in_progress';
    default:
      return link.status;
  }
}

/** Nothing more will happen to this link: stop polling. */
export function isSelfCheckOver(phase: SelfCheckPhase): boolean {
  return phase === 'passed' || phase === 'failed' || phase === 'expired' || phase === 'cancelled';
}

export const SELF_POLL_INTERVAL_MS = 5_000;
/** Under review (up to 48 hours), and after a failed status call. */
export const SELF_POLL_SLOW_INTERVAL_MS = 30_000;

/** How long to wait before the next status call; null = stop. The route allows 30 calls a minute. */
export function selfCheckPollDelayMs(phase: SelfCheckPhase): number | null {
  if (isSelfCheckOver(phase)) return null;
  return phase === 'review' ? SELF_POLL_SLOW_INTERVAL_MS : SELF_POLL_INTERVAL_MS;
}

export type SelfCheckCopy = { title: string; text: string };

function triesLeftLine(startsLeft: number | undefined): string {
  if (startsLeft === undefined) return '';
  if (startsLeft <= 0) return ' You have no tries left for now. Please try again later.';
  return startsLeft === 1 ? ' You have 1 try left.' : ` You have ${startsLeft} tries left.`;
}

export function selfCheckCopy(
  phase: SelfCheckPhase,
  detail: Pick<SelfLinkStatus, 'failure' | 'startsLeft'> = {},
): SelfCheckCopy {
  switch (phase) {
    case 'waiting':
      return {
        title: 'Waiting for you to start',
        text: 'Waiting for you to start the check in the other tab.',
      };
    case 'in_progress':
      return {
        title: 'Check in progress',
        text: 'Finish the check in the other tab. This page updates by itself.',
      };
    case 'review':
      return {
        title: 'Under review',
        text: 'A person is reviewing your check. This can take up to 48 hours. You can close this page.',
      };
    case 'saving':
      return { title: 'Almost done', text: 'Saving your credential.' };
    case 'passed':
      return { title: 'Check passed', text: 'Your identity check passed. Saving your credential.' };
    case 'failed':
      return {
        title: 'The check didn’t pass',
        text:
          (detail.failure === 'too_many_attempts'
            ? 'There were too many attempts in this check.'
            : 'We couldn’t verify your identity this time.') + triesLeftLine(detail.startsLeft),
      };
    case 'expired':
      return {
        title: 'The link expired',
        text: 'The check wasn’t finished in time. You can start a new one.',
      };
    case 'cancelled':
      return { title: 'The check was cancelled', text: 'You can start a new one whenever you’re ready.' };
  }
}

/** What the screen shows while a link is being followed. */
export type SelfProgressView =
  /** The first status answer is not in yet. */
  | 'looking_up'
  /** Self will not start the check on this link: the person's tries are used up for now. */
  | 'limit'
  /**
   * The check was never started and this page no longer holds its link (a
   * reload, or the link's time ran out): it can't be opened from here. Self
   * replaces a link nobody started a check on, so a new one can be made at once.
   */
  | 'stranded'
  /** The browser refused the new tab; the link is one tap away. */
  | 'popup_blocked'
  /** The plain copy of the phase (`selfCheckCopy`). */
  | 'phase';

export function selfProgressView(state: {
  phase: SelfCheckPhase | null;
  /** This page still holds the link's URL (memory only). */
  holdsLink: boolean;
  popupBlocked: boolean;
  /** The last status answer carried `limit`. */
  limited: boolean;
}): SelfProgressView {
  if (!state.phase) return 'looking_up';
  if (state.phase === 'waiting') {
    if (state.limited) return 'limit';
    if (!state.holdsLink) return 'stranded';
  }
  if (state.popupBlocked && state.holdsLink) return 'popup_blocked';
  return 'phase';
}

export const SELF_LIMIT_TITLE = 'No tries left for now';

export const SELF_STRANDED_COPY: SelfCheckCopy = {
  title: 'This check was started earlier',
  text: 'Its link can’t be opened again from this page. If the check is still open in another tab, finish it there. Otherwise, start a new check.',
};

/** Self has checked the person, but the Auth Hub wallet lists no credential (not saved, or removed). */
export const SELF_NOT_IN_WALLET_COPY: SelfCheckCopy = {
  title: 'Your credential isn’t in your wallet yet',
  text: 'Your identity was already checked, but the credential isn’t in your wallet yet. Open your wallet to save it, then check again.',
};

/** The Auth Hub could not be asked whether the credential is there: nothing is known, so nothing is claimed. */
export const SELF_COULD_NOT_CHECK_COPY: SelfCheckCopy = {
  title: 'We couldn’t check your verification',
  text: 'We couldn’t check whether your identity is already verified. Please try again.',
};

/** A ramp sent a person with an earlier (legacy) verification here to verify again. */
export const SELF_REVERIFY_COPY: SelfCheckCopy = {
  title: 'Verify your identity again',
  text: 'If a withdrawal or top-up couldn’t use your earlier verification, you can verify again here.',
};

/** Self answered `link_active` without naming the link, so where it was started is not known. */
export const SELF_ACTIVE_ELSEWHERE_COPY: SelfCheckCopy = {
  title: 'A check is already in progress',
  text: 'Finish it where you started it, or try again in a few minutes.',
};

/** A failed check can be started again unless Self says no tries are left. */
export function canRetrySelfCheck(startsLeft: number | undefined): boolean {
  return startsLeft === undefined || startsLeft > 0;
}

function formatResetTime(resetsAt: string | undefined, now: number): string | null {
  const at = resetsAt ? Date.parse(resetsAt) : NaN;
  if (!Number.isFinite(at) || at <= now) return null;
  const date = new Date(at);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameDay = date.toDateString() === new Date(now).toDateString();
  return sameDay ? time : `${time} on ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

type SelfLinkFailure = Extract<SelfLinkCreateResult, { outcome: 'error' }>;

const ERROR_COPY: Record<Exclude<SelfLinkErrorCode, 'daily_limit'>, string> = {
  rate_limited: 'Too many tries in a short time. Please wait a minute and try again.',
  not_configured: 'Identity verification is not available right now.',
  unauthorized: 'Please sign in again to verify your identity.',
  unavailable: 'The identity check can’t be reached right now. Please try again in a minute.',
  offer_consent_invalid:
    'We couldn’t set up your identity check. Please try again. If this keeps happening, contact support.',
  // A device clock that is wrong makes the signed request look expired or not yet valid.
  clock_skew: 'Your device’s date and time look wrong. Set them to automatic, then try again.',
  bad_request: 'We couldn’t start your identity check. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/** Why a check could not be started, in the person's words. */
export function selfLinkErrorMessage(
  error: Pick<SelfLinkFailure, 'code' | 'message' | 'resetsAt'>,
  now = Date.now(),
): string {
  if (error.code === 'daily_limit') {
    const resets = formatResetTime(error.resetsAt, now);
    if (resets) return `You’ve used your tries for now. You can try again after ${resets}.`;
    // Self's own sentence says how long to wait.
    return error.message || 'You’ve used your tries for now. Please try again in a few hours.';
  }
  return ERROR_COPY[error.code] ?? ERROR_COPY.unknown;
}

/** What a failed status call means for the screen. */
export type SelfStatusErrorAction =
  /** The link is gone (or was never ours): forget it and offer a new start. */
  | 'reset'
  /** Nothing this page can do until the person signs in again / the feature is configured. */
  | 'stop'
  /** A passing problem: keep polling, slowly. */
  | 'retry';

export function selfStatusErrorAction(
  code: Extract<SelfLinkStatusResult, { outcome: 'error' }>['code'],
): SelfStatusErrorAction {
  if (code === 'not_found') return 'reset';
  if (code === 'unauthorized' || code === 'not_configured') return 'stop';
  return 'retry';
}

/** The link stays usable for 15 minutes; a small margin avoids opening one that is about to lapse. */
export function isSelfLinkOpenable(expiresAt: string | undefined, now = Date.now()): boolean {
  const at = expiresAt ? Date.parse(expiresAt) : NaN;
  return Number.isFinite(at) && at - now > 15_000;
}
