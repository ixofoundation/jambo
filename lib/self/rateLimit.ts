/**
 * A small fixed-window limiter kept in this process's memory.
 *
 * Best effort only: serverless instances do not share it, and a cold start
 * forgets it, so the real ceiling is `max` per instance. It keeps a single
 * caller from hammering the Self routes through one warm instance; Self applies
 * its own limits per service and per person behind it.
 */
export type RateLimiter = {
  /** Counts one request for `key`. `ok: false` = over the limit. */
  take: (key: string, now?: number) => { ok: true } | { ok: false; retryAfterSeconds: number };
  /** Test seam. */
  reset: () => void;
};

/** At most this many keys are remembered: expired windows go first, then the oldest live ones. */
const MAX_KEYS = 10_000;

export function createRateLimiter(max: number, windowMs: number, maxKeys: number = MAX_KEYS): RateLimiter {
  // Kept in the order the windows were opened. Every window lasts `windowMs`,
  // so that is also the order they end in: the front of the map is always the
  // oldest, and the expired ones (if any) are there.
  const windows = new Map<string, { count: number; resetAt: number }>();

  /**
   * Makes room for one more key. Only what must go is forgotten, never the
   * whole map: a flood of new keys cannot reset every other caller's count (it
   * can still push out the oldest windows, which are the closest to ending).
   */
  const makeRoom = (now: number) => {
    // Stops at the first window that may stay, so this does not walk the whole map.
    const oldestFirst = windows.entries();
    for (let next = oldestFirst.next(); !next.done; next = oldestFirst.next()) {
      const [key, window] = next.value;
      if (window.resetAt > now && windows.size < maxKeys) break;
      windows.delete(key);
    }
  };

  return {
    take(key, now = Date.now()) {
      const current = windows.get(key);
      if (!current || current.resetAt <= now) {
        // Removed first, so the new window goes to the back of the order.
        if (current) windows.delete(key);
        if (windows.size >= maxKeys) makeRoom(now);
        windows.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true };
      }
      if (current.count >= max) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
      }
      current.count += 1;
      return { ok: true };
    },
    reset() {
      windows.clear();
    },
  };
}
