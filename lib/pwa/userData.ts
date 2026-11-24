/**
 * Small pieces of the user's data kept on the phone so the app still has
 * something true to show offline (docs/pwa.md, Phase 2). Each is labelled with
 * when it was read, scoped to one account, and wiped on logout
 * (`clearPwaUserData`, called from providers/auth.tsx).
 *
 * Display only. Nothing here may decide a money movement or a signature: the
 * wallet passes the LIVE balance to the upgrade/withdraw logic, and the chain
 * re-checks permissions when a claim is sent.
 */

const BALANCE_KEY = 'jambo-last-balance';
const AUTHZ_PREFIX = 'jambo-authz:';
// The service worker's cache that can hold the user's own avatar (sw/sw.js).
const USER_IMAGE_CACHE = 'jambo-images-v1';

type SavedBalance = { address: string; totalMicro: string; at: number };

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: offline display is a nicety, not required */
  }
}

/** The last good USDC total (base units) for this address. */
export function rememberBalance(address: string, totalMicro: bigint): void {
  const saved: SavedBalance = { address, totalMicro: totalMicro.toString(), at: Date.now() };
  write(BALANCE_KEY, saved);
}

export function loadBalance(address: string): { totalMicro: bigint; at: number } | null {
  const saved = read<SavedBalance>(BALANCE_KEY);
  if (!saved || saved.address !== address) return null;
  try {
    return { totalMicro: BigInt(saved.totalMicro), at: saved.at };
  } catch {
    return null;
  }
}

/** The roles last confirmed on chain for this account in this claim collection. */
export function rememberCollectionAuths(address: string, collectionId: string, auths: string[]): void {
  write(`${AUTHZ_PREFIX}${address}:${collectionId}`, { auths, at: Date.now() });
}

export function loadCollectionAuths(address: string, collectionId: string): string[] {
  return read<{ auths: string[] }>(`${AUTHZ_PREFIX}${address}:${collectionId}`)?.auths ?? [];
}

/** Logout: forget everything above, and the cached images. */
export function clearPwaUserData(): void {
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key === BALANCE_KEY || key.startsWith(AUTHZ_PREFIX))) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage blocked: nothing was saved either */
  }
  if ('caches' in window) caches.delete(USER_IMAGE_CACHE).catch(() => undefined);
}

/** "10:42" today, "Mon 10:42" this week, else "3 Nov". */
export function formatSavedAt(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (new Date(now).toDateString() === d.toDateString()) return time;
  if (now - at < 6 * 24 * 60 * 60 * 1000) return `${d.toLocaleDateString([], { weekday: 'short' })} ${time}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
