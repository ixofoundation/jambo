// Tiny localStorage-backed cache for worker responses (entity whitelist,
// per-entity collection blacklist). These are small, non-sensitive, public
// values; caching them lets the app render last-known data instantly and work
// offline, while a background sync keeps them fresh.

const PREFIX = 'yoma:cache:';

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Ignore quota / serialization errors — the cache is best-effort.
  }
}
