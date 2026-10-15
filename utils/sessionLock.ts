/**
 * Cross-tab Data Store session lock: only one tab of this origin runs the Matrix client (and so
 * holds the rust crypto store open) at a time.
 *
 * Adapted from the portal (impacts-x-web matrix/utils/sessionLock.ts), which follows
 * element-web's SessionLock. Coordination happens through localStorage:
 * - PING: timestamp the holder rewrites every PING_INTERVAL_MS; stale after EXPIRY_MS, so the
 *   lock of a tab that died (crash, killed by the OS) expires on its own.
 * - OWNER: tab id of the holder.
 * - CLAIMANT: tab id of the newest tab that wants the lock. A holder that sees another claimant
 *   (storage event, or its own ping tick) releases and calls its `onLost` callback.
 *
 * Unlike the portal, a new tab does not steal the lock on its own: `acquireSessionLock` fails
 * while another tab holds a live lock, and only `claimSessionLock` (the "Use here" button) forces
 * the holder to let go.
 *
 * Keys deliberately do not start with `mx_`: `clearLocalStore()` sweeps every `mx_*` key and
 * would otherwise drop a lock this tab still holds.
 *
 * Known limit: localStorage is not a real mutex (browsers may propagate writes between tabs
 * asynchronously). The settle delay plus the per-tick owner/claimant check make two tabs that
 * start at the same instant converge on one holder within one ping interval.
 */

const STORAGE_ITEM_PING = 'jambo_data_store_lock_ping';
const STORAGE_ITEM_OWNER = 'jambo_data_store_lock_owner';
const STORAGE_ITEM_CLAIMANT = 'jambo_data_store_lock_claimant';

export const SESSION_LOCK_PING_INTERVAL_MS = 5000;
export const SESSION_LOCK_EXPIRY_MS = 15000;
/** Time given to a concurrent claimant's write to reach this tab before taking a free lock. */
const SETTLE_MS = 150;

/** `claimed`: another tab took the lock. `cleared`: another tab signed out (lock keys removed). */
export type SessionLockLostReason = 'claimed' | 'cleared';
export type SessionLockLostHandler = (reason: SessionLockLostReason) => void;

function createTabId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const tabId = createTabId();
let servicer: ReturnType<typeof setInterval> | null = null;
let onLostHandler: SessionLockLostHandler | null = null;
let listenersAttached = false;
/** Set while the page sits in the back/forward cache after releasing a lock it held. */
let releasedForPageHide = false;

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    getStorage()?.setItem(key, value);
  } catch (err) {
    console.warn('[SessionLock] localStorage write failed:', err);
  }
}

function remove(key: string) {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}

function pingIsFresh(): boolean {
  const ping = Number(read(STORAGE_ITEM_PING));
  if (!ping) return false;
  // abs(): a ping "from the future" (clock change) must still expire.
  return Math.abs(Date.now() - ping) < SESSION_LOCK_EXPIRY_MS;
}

function heldByAnotherTab(): boolean {
  return pingIsFresh() && read(STORAGE_ITEM_OWNER) !== tabId;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Resolves on the next lock-related storage event, or after `ms`. */
function waitForLockChange(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('storage', onStorage);
      clearTimeout(timer);
      resolve();
    };
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === STORAGE_ITEM_PING ||
        event.key === STORAGE_ITEM_OWNER ||
        event.key === STORAGE_ITEM_CLAIMANT
      ) {
        done();
      }
    };
    const timer = setTimeout(done, ms);
    window.addEventListener('storage', onStorage);
  });
}

/** Stop pinging and drop the PING/OWNER entries if they are ours. Keeps the handler. */
function stopServicing() {
  if (servicer !== null) {
    clearInterval(servicer);
    servicer = null;
  }
  if (read(STORAGE_ITEM_OWNER) === tabId) {
    remove(STORAGE_ITEM_PING);
    remove(STORAGE_ITEM_OWNER);
  }
}

function lose(reason: SessionLockLostReason) {
  if (servicer === null) return;
  const handler = onLostHandler;
  onLostHandler = null;
  stopServicing();
  console.info(`[SessionLock] lock lost (${reason})`);
  if (handler) {
    try {
      handler(reason);
    } catch (err) {
      console.error('[SessionLock] onLost handler failed:', err);
    }
  }
}

function serviceLock() {
  if (servicer === null) return;
  const claimant = read(STORAGE_ITEM_CLAIMANT);
  const owner = read(STORAGE_ITEM_OWNER);
  // Catches storage events this tab missed (frozen or throttled in the background).
  if (claimant === null && owner === null) {
    lose('cleared');
    return;
  }
  if ((claimant !== null && claimant !== tabId) || (owner !== null && owner !== tabId && pingIsFresh())) {
    lose('claimed');
    return;
  }
  write(STORAGE_ITEM_OWNER, tabId);
  write(STORAGE_ITEM_PING, Date.now().toString());
}

function onStorageEvent(event: StorageEvent) {
  if (servicer === null) return;
  // `key === null` means another tab called localStorage.clear().
  if (event.key === null) {
    lose('cleared');
    return;
  }
  if (event.key !== STORAGE_ITEM_CLAIMANT) return;
  if (event.newValue === null) lose('cleared');
  else if (event.newValue !== tabId) lose('claimed');
}

function onPageHide() {
  if (servicer === null) return;
  // Release so another tab (or the next document) can take over at once; remember it so a page
  // restored from the back/forward cache tries to take the lock back.
  releasedForPageHide = true;
  stopServicing();
}

function onPageShow(event: PageTransitionEvent) {
  if (!event.persisted || !releasedForPageHide) return;
  releasedForPageHide = false;
  const handler = onLostHandler;
  if (!handler) return;
  void acquireSessionLock(handler).then((acquired) => {
    if (!acquired && onLostHandler === handler) {
      onLostHandler = null;
      handler('claimed');
    }
  });
}

function attachListeners() {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;
  window.addEventListener('storage', onStorageEvent);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
}

function takeLock(onLost: SessionLockLostHandler) {
  onLostHandler = onLost;
  releasedForPageHide = false;
  write(STORAGE_ITEM_CLAIMANT, tabId);
  write(STORAGE_ITEM_OWNER, tabId);
  write(STORAGE_ITEM_PING, Date.now().toString());
  if (servicer === null) servicer = setInterval(serviceLock, SESSION_LOCK_PING_INTERVAL_MS);
  attachListeners();
}

/** True while this tab holds the lock. */
export function isSessionLockHeld(): boolean {
  return servicer !== null;
}

/** True when another tab holds a live (non-expired) lock. */
export function isSessionLockHeldElsewhere(): boolean {
  return heldByAnotherTab();
}

/**
 * Take the lock if no other tab holds a live one. Does not disturb a live holder.
 * Without localStorage there is nothing to coordinate with, so it succeeds.
 *
 * @param onLost called once when this tab later loses the lock; must stop the Matrix client.
 * @returns true when this tab now holds the lock.
 */
export async function acquireSessionLock(onLost: SessionLockLostHandler): Promise<boolean> {
  if (!getStorage()) return true;
  if (servicer !== null) {
    onLostHandler = onLost;
    return true;
  }
  if (heldByAnotherTab()) return false;
  write(STORAGE_ITEM_CLAIMANT, tabId);
  await sleep(SETTLE_MS);
  // Another tab may have claimed (or taken) the lock in the meantime: it wins.
  if (servicer !== null) {
    onLostHandler = onLost;
    return true;
  }
  if (read(STORAGE_ITEM_CLAIMANT) !== tabId || heldByAnotherTab()) return false;
  takeLock(onLost);
  return true;
}

/**
 * Take the lock even when another tab holds it ("Use here"): the holder sees the new claimant,
 * stops its client and releases. A holder that does not answer is overridden once its lock
 * could have expired.
 *
 * @returns true when this tab now holds the lock, false when yet another tab claimed it first.
 */
export async function claimSessionLock(onLost: SessionLockLostHandler): Promise<boolean> {
  if (!getStorage()) return true;
  if (servicer !== null) {
    onLostHandler = onLost;
    return true;
  }
  write(STORAGE_ITEM_CLAIMANT, tabId);
  const deadline = Date.now() + SESSION_LOCK_EXPIRY_MS + SESSION_LOCK_PING_INTERVAL_MS;
  while (heldByAnotherTab() && Date.now() < deadline) {
    if (read(STORAGE_ITEM_CLAIMANT) !== tabId) return false;
    await waitForLockChange(Math.min(1000, Math.max(deadline - Date.now(), 0)));
  }
  if (read(STORAGE_ITEM_CLAIMANT) !== tabId) return false;
  takeLock(onLost);
  return true;
}

/** Release this tab's lock (no-op when not held). Other tabs may take it at once. */
export function releaseSessionLock() {
  onLostHandler = null;
  releasedForPageHide = false;
  stopServicing();
}

/**
 * Sign-out: release this tab's lock and remove every lock entry, which tells a tab that still
 * holds the lock that the session is gone (its `onLost` gets `cleared`).
 */
export function clearSessionLock() {
  releaseSessionLock();
  remove(STORAGE_ITEM_PING);
  remove(STORAGE_ITEM_OWNER);
  remove(STORAGE_ITEM_CLAIMANT);
}
