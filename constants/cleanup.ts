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
