/**
 * The time by Jambo's server clock, for the browser.
 *
 * Everything the person signs (the Self delegations, the Auth Hub token)
 * carries an expiry, and the services compare it with THEIR clock. A device
 * whose clock is minutes off would sign requests that are already expired, or
 * that live "too long", and be locked out. So the expiry is counted from the
 * server's time, learnt from the `Date` header of a same-origin answer (a
 * `HEAD /api/self/links`, which does nothing else). `Date` has one-second
 * resolution, which is plenty: the lifetimes are minutes.
 *
 * The offset is kept in this module's memory only. When it cannot be learnt the
 * device clock is used as it is.
 */

const PROBE_PATH = '/api/self/links';
const PROBE_TIMEOUT_MS = 4_000;
const OFFSET_TTL_MS = 10 * 60 * 1000;
/** A failed probe is not repeated for this long (the last offset learnt, or 0, is used meanwhile). */
const FAILURE_TTL_MS = 60 * 1000;

let cached: { offsetMs: number; until: number } | null = null;
let inFlight: Promise<number> | null = null;

async function probeOffsetMs(): Promise<number | null> {
  // Server-side there is no "device" clock to correct (and no origin for a relative URL).
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const sent = Date.now();
    const response = await fetch(PROBE_PATH, {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    });
    const received = Date.now();
    const serverMs = Date.parse(response.headers.get('date') || '');
    if (Number.isNaN(serverMs)) return null;
    // `Date` is cut to the second (so half a second is added), and the answer
    // was written somewhere between sending and receiving.
    return Math.round(serverMs + 500 - (sent + received) / 2);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Milliseconds to add to `Date.now()` to get the server's time. `refresh`
 * forgets what was learnt and asks again (after a `clock_skew` refusal).
 * Never throws; when the server's time cannot be read, the last offset learnt, or 0.
 */
export async function serverClockOffsetMs(opts: { refresh?: boolean } = {}): Promise<number> {
  if (!opts.refresh && cached && cached.until > Date.now()) return cached.offsetMs;
  if (!inFlight) {
    inFlight = probeOffsetMs()
      .then((offsetMs) => {
        cached =
          offsetMs === null
            ? // What was learnt before is still the best guess.
              { offsetMs: cached?.offsetMs ?? 0, until: Date.now() + FAILURE_TTL_MS }
            : { offsetMs, until: Date.now() + OFFSET_TTL_MS };
        return cached.offsetMs;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** "Now" in unix seconds by the server's clock: what a signed expiry is counted from. */
export async function serverNowSeconds(opts: { refresh?: boolean } = {}): Promise<number> {
  const offsetMs = await serverClockOffsetMs(opts);
  return Math.floor((Date.now() + offsetMs) / 1000);
}

/** Test seam. */
export function __resetServerTimeForTest(): void {
  cached = null;
  inFlight = null;
}
