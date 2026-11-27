/**
 * Client-side state for the DID ↔ Yoma account link flow.
 *
 * - The hand-off — `yref`, with the worker's signature `ysig` and expiry
 *   `yexp` when it sends them — that the yoma worker appends to its redirect
 *   (`/entities/<did>?yref=<partnerUserId>&ysig=…&yexp=…`). `yref` names WHICH
 *   Yoma user this hand-off was for; after login we compare it against the
 *   logged-in account's own `yomaId` to detect a wrong-account sign-in, and
 *   the bind forwards all three so the worker can settle an ambiguous match
 *   (it honours only a yref whose signature verifies). The three are one
 *   record: captured together, only from the worker's redirect into the
 *   entity page (yomaLinkHandOffRoute), replaced together by a newer
 *   hand-off, cleared together, and never changed. Kept in sessionStorage so
 *   it survives the same-tab auth-hub round trip.
 * - Link cache — the last `{ email, yomaId }` the worker reported, keyed by
 *   DID, so the root check doesn't re-query on every page. A completed link
 *   (`yomaId` set) is permanent server-side; an incomplete one is re-checked
 *   once per browser session (the Yoma match can complete server-side later).
 *
 * Everything here is cleared on logout — a public PC must not leak the
 * previous user's link state (or resume their hand-off) to the next login.
 */

const YREF_KEY = 'ixo_yoma_yref';
const LINK_CACHE_KEY = 'ixo_yoma_link';
const CHECKED_KEY = 'ixo_yoma_checked';
const HANDOFF_BOUND_KEY = 'ixo_yoma_handoff_bound';
// A hand-off marker older than a day is stale — drop rather than confuse.
const YREF_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The Next route the yoma worker redirects into: the only place a hand-off is taken from. */
export const YOMA_HANDOFF_ROUTE = '/entities/[entityId]';

/** The hand-off query parameters, stripped from the address bar wherever they appear. */
export const YOMA_HANDOFF_PARAMS = ['yref', 'ysig', 'yexp'] as const;

export interface YomaLinkState {
  email: string | null;
  yomaId: string | null;
}

/** One hand-off, exactly as the worker sent it. `ysig`/`yexp` are null for an older, unsigned link. */
export interface YomaHandOff {
  yref: string;
  ysig: string | null;
  yexp: string | null;
}

type QueryValue = string | string[] | null | undefined;

/** A single, non-empty query value; a repeated or missing parameter is no value. */
function single(value: QueryValue): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * The hand-off in a redirect's query (URLSearchParams `get` values or a Next
 * `router.query`), or null without a `yref`. A `ysig`/`yexp` without `yref`
 * is ignored. Values are taken as they are, never trimmed or rebuilt.
 */
export function handOffFromQuery(query: {
  yref?: QueryValue;
  ysig?: QueryValue;
  yexp?: QueryValue;
}): YomaHandOff | null {
  const yref = single(query.yref);
  if (!yref) return null;
  return { yref, ysig: single(query.ysig), yexp: single(query.yexp) };
}

/**
 * Reads the hand-off parameters of a page address: the hand-off itself only
 * on the worker's entry route (YOMA_HANDOFF_ROUTE), the address with all
 * three removed on any route. `cleaned` is null when there was nothing to
 * remove. A repeated parameter counts as absent.
 */
export function takeHandOffFromUrl(
  href: string,
  routePathname: string,
): { handOff: YomaHandOff | null; cleaned: string | null } {
  const url = new URL(href);
  if (!YOMA_HANDOFF_PARAMS.some((name) => url.searchParams.has(name))) return { handOff: null, cleaned: null };
  const one = (name: string) => {
    const values = url.searchParams.getAll(name);
    return values.length === 1 ? values[0] : null;
  };
  const handOff =
    routePathname === YOMA_HANDOFF_ROUTE
      ? handOffFromQuery({ yref: one('yref'), ysig: one('ysig'), yexp: one('yexp') })
      : null;
  for (const name of YOMA_HANDOFF_PARAMS) url.searchParams.delete(name);
  return { handOff, cleaned: url.pathname + url.search + url.hash };
}

/** Stores a hand-off, replacing any earlier one whole (never a mix of two). */
export function saveHandOff(handOff: YomaHandOff): void {
  if (!handOff.yref) return;
  try {
    sessionStorage.setItem(
      YREF_KEY,
      JSON.stringify({ yref: handOff.yref, ysig: handOff.ysig, yexp: handOff.yexp, ts: Date.now() }),
    );
  } catch {
    // Storage unavailable — losing the marker only skips the mismatch check.
  }
}

/** Reads without clearing — the hand-off stays until matched, dismissed, or logout. */
export function peekHandOff(): YomaHandOff | null {
  try {
    const raw = sessionStorage.getItem(YREF_KEY);
    if (!raw) return null;
    const { yref, ysig, yexp, ts } = JSON.parse(raw) as {
      yref?: unknown;
      ysig?: unknown;
      yexp?: unknown;
      ts?: unknown;
    };
    if (typeof yref !== 'string' || !yref) return null;
    if (typeof ts !== 'number' || Date.now() - ts > YREF_MAX_AGE_MS) {
      sessionStorage.removeItem(YREF_KEY);
      return null;
    }
    return {
      yref,
      ysig: typeof ysig === 'string' && ysig ? ysig : null,
      yexp: typeof yexp === 'string' && yexp ? yexp : null,
    };
  } catch {
    return null;
  }
}

/** The stored hand-off's `yref` only (the sign-in pages' "joining from Yoma" line). */
export function peekYref(): string | null {
  return peekHandOff()?.yref ?? null;
}

/** Clears the whole hand-off: yref, ysig and yexp together. */
export function clearYref(): void {
  try {
    sessionStorage.removeItem(YREF_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

function handOffKey(did: string, handOff: YomaHandOff): string {
  return JSON.stringify([did, handOff.yref, handOff.ysig, handOff.yexp]);
}

/**
 * Whether this exact hand-off was already sent with a bind for this DID in
 * this tab. A bind the worker answered with `yomaId: null` (an unsigned,
 * expired or non-matching marker) is not sent again on every page load.
 */
export function wasHandOffBound(did: string, handOff: YomaHandOff): boolean {
  try {
    return sessionStorage.getItem(HANDOFF_BOUND_KEY) === handOffKey(did, handOff);
  } catch {
    return false;
  }
}

/**
 * Whether the link check calls bind (it costs auth-hub reads), given the
 * worker's status answer:
 *  - the DID never bound (no verified contact yet);
 *  - a signed hand-off this tab has not sent yet, for a DID still unmatched;
 *  - once per browser session, a DID bound by phone alone and not linked (a
 *    phone-only Yoma account, which Yoma never hands off): the worker reports
 *    its completions to Yoma by that phone and re-reads it from the hub on
 *    every bind, so the number stays the one Yoma verified most recently.
 */
export function shouldBind(
  status: { email: string | null; yomaId: string | null; contact?: 'email' | 'phone' | null },
  options: { handOff: YomaHandOff | null; handOffSent: boolean; checkedThisSession: boolean },
): boolean {
  if (status.contact === 'phone' && !status.yomaId && !options.checkedThisSession) return true;
  const bound = !!status.email || !!status.contact;
  return !options.handOffSent && (!bound || (!!options.handOff && !status.yomaId));
}

export function markHandOffBound(did: string, handOff: YomaHandOff): void {
  try {
    sessionStorage.setItem(HANDOFF_BOUND_KEY, handOffKey(did, handOff));
  } catch {
    // Storage unavailable — worst case one more bind on the next page load.
  }
}

export function getCachedLink(did: string): YomaLinkState | null {
  try {
    const raw = localStorage.getItem(LINK_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { did?: unknown; email?: unknown; yomaId?: unknown };
    if (parsed.did !== did) return null; // another account's cache — ignore
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      yomaId: typeof parsed.yomaId === 'string' ? parsed.yomaId : null,
    };
  } catch {
    return null;
  }
}

export function setCachedLink(did: string, link: YomaLinkState): void {
  try {
    localStorage.setItem(LINK_CACHE_KEY, JSON.stringify({ did, ...link, ts: Date.now() }));
  } catch {
    // Storage unavailable — the check just re-runs next session.
  }
}

/** Once-per-browser-session guard for the root status/bind check. */
export function wasCheckedThisSession(did: string): boolean {
  try {
    return sessionStorage.getItem(CHECKED_KEY) === did;
  } catch {
    return false;
  }
}

export function markCheckedThisSession(did: string): void {
  try {
    sessionStorage.setItem(CHECKED_KEY, did);
  } catch {
    // Storage unavailable — worst case the check repeats (it's cheap).
  }
}

/**
 * Clears the link cache + session-check flag. Called on EVERY logout. The
 * yref is cleared separately — a "switch account" logout keeps it so the
 * hand-off comparison re-runs for the next sign-in.
 */
export function clearLinkState(): void {
  try {
    localStorage.removeItem(LINK_CACHE_KEY);
    sessionStorage.removeItem(CHECKED_KEY);
    sessionStorage.removeItem(HANDOFF_BOUND_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
