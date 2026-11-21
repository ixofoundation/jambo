import { BurnRefusedError } from './burn';
import { isAirtimeVoucherError } from './errors';

/**
 * Every refusal of the airtime swap, in plain words (PRODUCT.md: money words,
 * never token words; always say where the user's vouchers are). The service's
 * own `message` is written for developers and is never shown; the one
 * exception is the fixed text it answers about an unissued PIN, which the
 * screens show as it is. Unit-tested in messages.test.ts.
 */

/**
 * What the screen offers next:
 * - `resume`: open the swap that is already open (`swapId`).
 * - `wait`: try again after `waitSec`.
 * - `retry`: try the same thing again now.
 * - `burn_again`: nothing was burned; the same swap can be confirmed again.
 * - `amount`: go back and choose another amount.
 * - `check`: the swap is safe; ask the service again later.
 * - `support`: an operator must look at it; show the reference to quote.
 * - `none`: nothing to do but come back later.
 */
export type RefusalAction =
  | 'resume'
  | 'wait'
  | 'retry'
  | 'burn_again'
  | 'amount'
  | 'check'
  | 'support'
  | 'verify'
  | 'none';

export interface RefusalCopy {
  /** The service's code (or a local one), for analytics. Never shown. */
  code: string;
  title: string;
  body: string;
  action: RefusalAction;
  /** `resume`: the open swap. */
  swapId?: string;
  /** `wait`: seconds until another try may succeed. */
  waitSec?: number;
  /** `amount`: the vouchers the service counted, in rand. */
  held?: number;
  /** `verify`: the user is verified already and must verify again. */
  reverify?: boolean;
}

/** Where the refusal happened: it decides what is said about the vouchers. */
export type RefusalStage = 'request' | 'burn' | 'redeem' | 'read';

export interface RefusalContext {
  stage: RefusalStage;
  minZar?: number;
  maxZar?: number;
}

/** "45 seconds", "about 2 minutes", "about 1 hour". */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const minutes = Math.ceil(s / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} hour${hours === 1 ? '' : 's'}`;
}

export const rand = (amount: number): string => `R${amount}`;

const NOTHING_TAKEN = 'Nothing was taken from your vouchers.';
const SWAP_SAFE = 'Your swap is saved and nothing is lost.';

const FLAGGED_TITLE = 'We need to look at this swap';
const FLAGGED_BODY =
  'Your vouchers were used, but the swap did not match what was asked for, so no PIN was issued. The airtime team has been told and will look at it. If you contact support, quote the reference below.';

export function flaggedCopy(code = 'swap_flagged'): RefusalCopy {
  return { code, title: FLAGGED_TITLE, body: FLAGGED_BODY, action: 'support' };
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function refusalCopy(err: unknown, context: RefusalContext): RefusalCopy {
  const afterBurn = context.stage === 'redeem' || context.stage === 'read';

  if (err instanceof BurnRefusedError) {
    if (err.check === 'expiry') {
      return {
        code: 'local_expiry',
        title: 'This swap ran out of time',
        body: `${NOTHING_TAKEN} Start again when you are ready.`,
        action: 'amount',
      };
    }
    return {
      code: `local_${err.check}`,
      title: 'We stopped this swap',
      body: `What the airtime service asked for did not match what you confirmed, so nothing was signed. ${NOTHING_TAKEN} Please try again later, or contact support if it keeps happening.`,
      action: 'none',
    };
  }

  if (!isAirtimeVoucherError(err)) {
    return {
      code: 'unknown',
      title: 'Something went wrong',
      body: afterBurn ? `${SWAP_SAFE} Check again in a moment.` : `${NOTHING_TAKEN} Please try again.`,
      action: afterBurn ? 'check' : 'retry',
    };
  }

  const { code, details } = err;
  const waitSec = err.retryAfterSec ?? undefined;

  switch (code) {
    case 'swap_in_progress':
      return {
        code,
        title: 'You already have a swap open',
        body: 'Finish that swap first. If you leave it, it runs out by itself after a few minutes.',
        action: 'resume',
        swapId: typeof details.swapId === 'string' ? details.swapId : undefined,
      };
    case 'insufficient_vouchers': {
      const held = num(details.held);
      return {
        code,
        title: 'Not enough vouchers',
        body:
          held === undefined
            ? 'You have fewer airtime vouchers than this amount. Choose a smaller amount.'
            : held <= 0
            ? 'You have no airtime vouchers to swap yet.'
            : `You have ${rand(held)} in airtime vouchers. Choose ${rand(held)} or less.`,
        action: 'amount',
        held,
      };
    }
    case 'insufficient_airtime_balance':
      return {
        code,
        title: 'Airtime is not available right now',
        body: `The airtime account must be topped up before this swap can be made. ${NOTHING_TAKEN} Please try again later, or try a different amount.`,
        action: 'amount',
      };
    case 'swap_reserve_full':
      return {
        code,
        title: 'Busy right now',
        body: `Other people are swapping at the moment. ${NOTHING_TAKEN} Try again in a few minutes.`,
        action: 'retry',
      };
    case 'swap_cooldown':
      return {
        code,
        title: 'Please wait a little',
        body: `An earlier swap ran out before it was finished, so there is a short wait before the next one.${
          waitSec === undefined ? '' : ` You can try again in ${formatWait(waitSec)}.`
        } ${NOTHING_TAKEN}`,
        action: 'wait',
        waitSec,
      };
    case 'swaps_paused':
      return {
        code,
        title: 'Swaps are paused',
        body: `The airtime service has paused new swaps while its team sorts out a problem. Your vouchers are safe. Please try again later.`,
        action: 'none',
      };
    case 'token_not_active':
    case 'token_not_found':
      return {
        code,
        title: 'Swaps are not available right now',
        body: `Your vouchers are safe. Please try again later.`,
        action: 'none',
      };
    case 'validation_error':
      return {
        code,
        title: 'That amount can’t be swapped',
        body:
          context.minZar !== undefined && context.maxZar !== undefined
            ? `Choose a whole amount from ${rand(context.minZar)} to ${rand(context.maxZar)}.`
            : 'Choose a whole amount in rand.',
        action: 'amount',
      };
    case 'swap_burn_failed':
      return {
        code,
        title: 'Nothing was used',
        body: 'The transaction did not go through, so your vouchers are still in your wallet. You can try again.',
        action: 'burn_again',
      };
    case 'swap_burn_invalid':
      if (details.flagged === true) return flaggedCopy(code);
      return {
        code,
        title: 'We could not match your vouchers to this swap',
        body: 'Please do not try again. Contact support and quote the reference below, so the airtime team can look at it.',
        action: 'support',
      };
    case 'swap_flagged':
      return flaggedCopy(code);
    case 'swap_already_redeemed':
      return {
        code,
        title: 'This swap is already done',
        body: 'Open it under your recent swaps to see the PIN.',
        action: 'check',
      };
    // Identity is asked for with the request, so none of these is ever
    // answered after vouchers were used.
    case 'kyc_required':
      return {
        code,
        title: 'Verify your identity first',
        body: `Swapping vouchers for airtime needs your identity to be verified. ${NOTHING_TAKEN}`,
        action: 'verify',
      };
    case 'kyc_expired':
      return {
        code,
        title: 'Your identity verification has expired',
        body: `Verify your identity again, then come back for your airtime. ${NOTHING_TAKEN}`,
        action: 'verify',
        reverify: true,
      };
    case 'kyc_revoked':
    case 'kyc_invalid':
      return {
        code,
        title: 'We couldn’t accept your identity verification',
        body: `Verify your identity again, then come back for your airtime. If it keeps happening, contact support. ${NOTHING_TAKEN}`,
        action: 'verify',
        reverify: true,
      };
    case 'credential_check_unavailable':
      return {
        code,
        title: 'We couldn’t check your identity just now',
        body: `${NOTHING_TAKEN} Please try again in a moment.`,
        action: 'retry',
      };
    case 'pin_unavailable':
      return {
        code,
        title: 'Your PIN can’t be shown right now',
        body: 'Your airtime is bought and it is yours. The service cannot show the PIN at the moment, and its team has been told. Check again in a while.',
        action: 'check',
      };
    case 'rate_limited':
      return {
        code,
        title: 'Too many tries',
        body: `Please wait${waitSec === undefined ? ' a minute' : ` ${formatWait(waitSec)}`} and try again. ${
          afterBurn ? SWAP_SAFE : NOTHING_TAKEN
        }`,
        action: afterBurn ? 'check' : 'wait',
        waitSec,
      };
    case 'chain_unavailable':
    case 'provider_unavailable':
    case 'internal_error':
    case 'bad_response':
      return {
        code,
        title: 'The airtime service is having trouble',
        body: afterBurn ? `${SWAP_SAFE} Check again in a moment.` : `${NOTHING_TAKEN} Try again in a moment.`,
        action: afterBurn ? 'check' : 'retry',
      };
    case 'network_error':
    case 'timeout':
      return {
        code,
        title: 'No connection',
        body: afterBurn
          ? `We could not reach the airtime service. ${SWAP_SAFE} Check again when you are online.`
          : context.stage === 'request'
          ? 'We could not reach the airtime service. Nothing was taken from your vouchers. Check your connection and try again.'
          : `We could not reach the airtime service. Check your connection and try again.`,
        action: afterBurn ? 'check' : 'retry',
      };
    case 'not_found':
      return {
        code,
        title: 'We could not find this swap',
        body: 'It may belong to another account. If vouchers left your wallet for it, contact support and quote the reference below.',
        action: 'support',
      };
    case 'expired':
      return {
        code,
        title: 'We could not confirm it’s you',
        body: `Check that the date and time on this phone are right, then try again. ${
          afterBurn ? SWAP_SAFE : NOTHING_TAKEN
        }`,
        action: afterBurn ? 'check' : 'retry',
      };
    case 'replay':
      return {
        code,
        title: 'Please try again',
        body: afterBurn ? `${SWAP_SAFE} Check again.` : `${NOTHING_TAKEN} Please try again.`,
        action: afterBurn ? 'check' : 'retry',
      };
    case 'unauthorized':
    case 'invalid_signature':
    case 'capability_mismatch':
    case 'audience_mismatch':
    case 'missing_bearer':
    case 'invalid_format':
      return {
        code,
        title: 'We could not confirm it’s you',
        body: `The airtime service did not accept this account’s signature. ${
          afterBurn ? SWAP_SAFE : NOTHING_TAKEN
        } Try again in a minute. If it keeps happening, sign out and in again, or contact support.`,
        action: afterBurn ? 'check' : 'retry',
      };
    default:
      return {
        code,
        title: 'Swaps are not available right now',
        body: afterBurn ? `${SWAP_SAFE} Check again later.` : `${NOTHING_TAKEN} Please try again later.`,
        action: afterBurn ? 'check' : 'none',
      };
  }
}
