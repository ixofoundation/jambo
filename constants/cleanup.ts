/**
 * The World Cleanup Day deed.
 *
 * One deed in the deck is not a deed to read but a door to walk through: the
 * campaign's entity, whose work happens in the youth app served on this
 * domain at /cleanup (next.config.js proxies it; the login is shared). So
 * wherever this deed would open — a card in the deck, a row in the list, or
 * its own address, which is what the Yoma hand-off lands on — the youth app
 * opens instead of the deed view with its claim collections.
 *
 * NEXT_PUBLIC_CLEANUP_ENTITY_DID names it, one value per network; blank means
 * no deed is special.
 */
export const CLEANUP_ENTITY_DID = (process.env.NEXT_PUBLIC_CLEANUP_ENTITY_DID || '').trim();

export const CLEANUP_PATH = '/cleanup';

export const isCleanupEntity = (did: string | null | undefined): boolean =>
  Boolean(CLEANUP_ENTITY_DID) && did === CLEANUP_ENTITY_DID;

/** Full navigation: /cleanup is another app on this domain, not one of these pages. */
export function openCleanup(replace = false): void {
  if (replace) window.location.replace(CLEANUP_PATH);
  else window.location.assign(CLEANUP_PATH);
}

// ---------------------------------------------------------------------------
// Cleanup rewards hold
// ---------------------------------------------------------------------------

/**
 * World Cleanup Day rewards are paid in PAY (IXO_PAY_DENOM, 1 PAY = 1 USDC),
 * and the PAY → USDC conversion the off-ramp needs isn't built yet. Until it
 * is, the Withdraw screen holds those rewards:
 *
 *   - a youth holding only PAY sees a friendly "check back on <date>" card in
 *     place of the KYC gate and the form — deliberately NO KYC, the KYC flow
 *     itself is being reworked before then and we don't want them verifying
 *     against the old one;
 *   - a youth holding PAY and any USDC at all keeps the normal flow (KYC gate
 *     first, then the form), with a banner saying only the USDC can go out
 *     today;
 *   - a youth holding USDC and no PAY sees no change at all;
 *   - a youth holding nothing sees a friendly "nothing to withdraw yet" card
 *     instead of the KYC gate — there is nothing to verify for.
 *
 * The Wallet screen shows the rewards in the total with the same date.
 *
 * Flip CLEANUP_REWARDS_HOLD to false when conversion ships (the PAY balance
 * then simply becomes withdrawable money). The date can be moved without a
 * code change via NEXT_PUBLIC_CLEANUP_REWARDS_WITHDRAW_FROM (YYYY-MM-DD,
 * build-time like every NEXT_PUBLIC_ var — redeploy to apply).
 */
export const CLEANUP_REWARDS_HOLD = true;

/** The day withdrawals of Cleanup rewards open, YYYY-MM-DD, local calendar. */
export const CLEANUP_REWARDS_WITHDRAW_FROM = (
  process.env.NEXT_PUBLIC_CLEANUP_REWARDS_WITHDRAW_FROM || '2026-09-23'
).trim();

export interface CleanupRewardsWhen {
  /** Sentence fragment: "on Wednesday 23 September" or "in the next few days". */
  when: string;
  /** "then" when a real date is shown, "soon" otherwise — for "check back …". */
  checkBack: 'then' | 'soon';
}

/**
 * When Cleanup rewards can be withdrawn, as copy. A future date renders as
 * "on Wednesday 23 September"; a missing, malformed or already-passed date
 * (the hold outlived its estimate) falls back to "in the next few days" so
 * the screen never promises a day that's gone.
 */
export function cleanupRewardsWithdrawWhen(now: Date = new Date()): CleanupRewardsWhen {
  const fallback: CleanupRewardsWhen = { when: 'in the next few days', checkBack: 'soon' };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(CLEANUP_REWARDS_WITHDRAW_FROM);
  if (!m) return fallback;
  // Build in local time: `new Date('YYYY-MM-DD')` is UTC midnight and shows
  // the previous day west of Greenwich.
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const opens = new Date(y, mo, d);
  // Date() silently rolls impossible parts over ("2026-13-40" → Feb 2027);
  // only accept a date that reads back exactly as written.
  if (opens.getFullYear() !== y || opens.getMonth() !== mo || opens.getDate() !== d) return fallback;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (opens.getTime() <= today.getTime()) return fallback;
  const day = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(opens);
  return { when: `on ${day}`, checkBack: 'then' };
}

/** "$10.00" — Cleanup rewards are shown as their USD value (1 PAY = 1 USDC),
 *  never as a token amount. */
export function formatRewardsUsd(amount: number): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(amount);
}
